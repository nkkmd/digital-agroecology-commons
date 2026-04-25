# Toitoi インデクサー・アーキテクチャ設計書：問いの系譜の抽出とAPI提供
**バージョン: 2.2 (本番環境デプロイメント)**

本ドキュメントは、デジタル・アグロエコロジー・コモンズ「Toitoi」における **コモンズAPI・インデクサー層** のリファレンス実装および本番環境構築ガイドです。

分散ネットワーク（Nostr）から「問い（Kind: 11042）」をリアルタイムで収集・整理し、フロントエンド（スマホアプリやWeb画面）に超高速なAPIを提供するシステムの **「開発から本番稼働（24時間運用）」** までの全設計を定義します。本バージョンでは、Webサーバーにモダンな **Caddy** を採用し、よりセキュアでメンテナンスフリーな構成としています。

---

## 1. 本番環境のアーキテクチャ

Toitoiのインデクサーをインターネット上に安全かつ安定して公開するため、以下の5層構造（レイヤー）でシステムを構築します。

```text[ スマホアプリ / Webフロントエンド ]
       │ (HTTPS通信 : https://api.toitoi.cultivationdata.net)
       ▼
┌───────────────── サーバー本体 (Ubuntu Linux等) ─────────────────┐
│                                                               │
│  ①【受付係】 Caddy (自動HTTPS・リバースプロキシ)                │
│       ├─ 役割: SSL証明書の自動取得・更新、通信の安全な中継          │
│       │                                                       │
│       ▼ (内部ポート: 3000へ転送)                                │
│                                                               │
│  ②【 店長 】 PM2 (プロセスマネージャー)                          │
│       ├─ 役割: 24時間監視、クラッシュ時の「1秒以内の自動蘇生」      │
│       │                                                       │
│       ├──▶ ③【窓口担当】 APIサーバー (Express / Node.js)        │
│       │        └─ 役割: アプリからの検索要求に応え、データを返す   │
│       │                                                       │
│       └──▶ ④【裏方職人】 インデクサー・ワーカー (node-cron)     │
│                └─ 役割: 10分毎にリレーから「問い」を集めDBへ保存   │
│                                                               │
│  ⑤【整理棚】 PostgreSQL (リレーショナル・データベース)            │
│       └─ 役割: 複雑なツリー構造の高速検索(WITH RECURSIVE)       │
└───────────────────────────────────────────────────────────────┘
```

---

## 2. 事前準備（必要なパッケージとDBの初期化）

本システムを構築するために、あらかじめ実行が必要なコマンド群です。

### 2.1 サーバー・OSレベルの必須ソフトウェア
サーバー本体（Ubuntu等を想定）に以下のミドルウェアをインストールします。

*   **Node.js (v18以上推奨):** APIとワーカーを動かすための実行環境。
*   **PostgreSQL (v14以上推奨):** 系統樹の再帰クエリを超高速に処理するための必須データベース。
*   **Caddy:** リバースプロキシおよび自動HTTPS化を担うWebサーバー。
*   **PM2:** Node.jsプロセスを24時間監視・自動再起動させるための管理ツール。
    ```bash
    npm install -g pm2
    ```

### 2.2 プロジェクトレベルのパッケージインストール
プロジェクトのディレクトリを作成し、以下のコマンドを実行して必須ライブラリをインストールします。

```bash
npm init -y
npm install express nostr-tools node-cron @prisma/client
npm install --save-dev prisma
```

### 2.3 データベースの初期構築とPrismaの生成 【重要】
後述の「3. データベース設計」で作成する `schema.prisma` の設計図を、実際のデータベースとNode.jsのプログラムに反映させるための必須工程です。**これを実行しないと `worker.js` や `api.js` はデータベースにアクセスできません。**

```bash
# 1. 環境変数(.env)ファイルを作成し、PostgreSQLの接続URLを記載する
# 例: DATABASE_URL="postgresql://user:password@localhost:5432/toitoi_db?schema=public"

# 2. 設計図を実際のPostgreSQLデータベースに反映（テーブルの作成）
npx prisma db push

# 3. 設計図からNode.js用のDB操作プログラム(@prisma/client)を自動生成
npx prisma generate
```

---

## 3. データベース設計（Prismaスキーマ）

Nostrの生データを、検索・ツリー描画に最適化された状態へ分解して保存します。
プロジェクト内の `prisma/schema.prisma` に以下を記述します。

```prisma
// prisma/schema.prisma

// DB接続設定 (PostgreSQLを使用)
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Event {
  id         String    @id
  pubkey     String
  content    String
  createdAt  Int
  rawJson    Json
  tags       Tag[]
  lineages   Lineage[] @relation("ChildEvent")
}

model Tag {
  id         Int    @id @default(autoincrement())
  eventId    String
  tagKey     String // "context", "relationship" など
  tagValue1  String // "volcanic_ash" など
  tagValue2  String?
  event      Event  @relation(fields: [eventId], references:[id])
}

model Lineage {
  id            Int    @id @default(autoincrement())
  childEventId  String
  parentEventId String
  relationType  String
  childEvent    Event  @relation("ChildEvent", fields:[childEventId], references: [id])
}

model SyncState {
  relayUrl   String @id // リレーURL（しおりの役割）
  lastSynced Int    // 最後に同期したUnixタイム
}
```

---

## 4. アプリケーションの実装（Node.js）

本番環境では、リレーからデータを収集する「ワーカー」と、フロントエンドにデータを返す「APIサーバー」を別々のファイルとして作成します。

### 4.1 ワーカープロセス (`worker.js`)
リレーからのデータ収集を担当します。多重実行のロックと、安全な切断（`eose`）を実装します。

```javascript
// worker.js
import cron from 'node-cron';
import { Relay, verifyEvent } from 'nostr-tools';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient(); // 2.3で生成されたプログラムを読み込む
const RELAY_URL = 'wss://relay.toitoi.cultivationdata.net';
let isRunning = false;

// 10分ごとに定期実行
cron.schedule('*/10 * * * *', async () => {
    if (isRunning) return; // 多重実行防止用のロック
    isRunning = true;

    try {
        // 1. 「しおり」の取得
        const state = await prisma.syncState.findUnique({ where: { relayUrl: RELAY_URL } });
        const since = state ? state.lastSynced : 0;
        let latestCreatedAt = since;

        const relay = await Relay.connect(RELAY_URL);
        
        // 2. 差分（since）のみを要求
        relay.subscribe([{ kinds:[11042], since: since }], {
            async onevent(event) {
                // 3. 署名検証（不正データ排除）
                if (!verifyEvent(event)) return;

                // 4. DB保存（既に存在する場合はスキップ）
                const exists = await prisma.event.findUnique({ where: { id: event.id } });
                if (!exists) {
                    // トランザクションで Event, Tag, Lineage を一括保存する処理（詳細は省略）
                    await saveEventToDB(event);
                }
                if (event.created_at > latestCreatedAt) {
                    latestCreatedAt = event.created_at;
                }
            },
            async oneose() {
                // 5. 過去データ取得完了時の処理
                relay.close(); // 安全に切断（行儀よく閉じる）
                
                // 6. 「しおり」の更新
                await prisma.syncState.upsert({
                    where: { relayUrl: RELAY_URL },
                    update: { lastSynced: latestCreatedAt },
                    create: { relayUrl: RELAY_URL, lastSynced: latestCreatedAt }
                });
                isRunning = false; // ロック解除
            }
        });
    } catch (error) {
        console.error("Worker Error:", error);
        isRunning = false; // エラー時もロック解除
    }
});
```

### 4.2 APIサーバー (`api.js`)
スマホアプリ等からのリクエストに応えます。「系統樹（ツリー）」の取得には、PostgreSQLの再帰クエリを使用します。

```javascript
// api.js
import express from 'express';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient(); // 2.3で生成されたプログラムを読み込む

// ツリー取得エンドポイント
app.get('/api/v1/inquiries/:id/tree', async (req, res) => {
    const rootId = req.params.id;

    // WITH RECURSIVE による一撃ツリー抽出
    const treeData = await prisma.$queryRaw`
        WITH RECURSIVE tree AS (
            -- ルートノード
            SELECT e.id, e.content, e."createdAt", NULL as parent_id
            FROM "Event" e WHERE e.id = ${rootId}
            
            UNION ALL
            
            -- 再帰的に子ノードを取得
            SELECT e.id, e.content, e."createdAt", l."parentEventId"
            FROM "Event" e
            INNER JOIN "Lineage" l ON e.id = l."childEventId"
            INNER JOIN tree t ON l."parentEventId" = t.id
        )
        SELECT * FROM tree;
    `;

    // 取得したフラットな配列を階層型のJSONにパースする処理（詳細は省略）
    const structuredTree = buildNestedTree(treeData, rootId);
    
    res.json(structuredTree);
});

// ポート3000番で常時リクエストを待ち受ける
app.listen(3000, () => {
    console.log("🚀 API Server running on port 3000");
});
```

---

## 5. 本番環境へのデプロイ（24時間運用設定）

作成したプログラムを、安全かつ永遠に動かし続けるためのサーバー設定です。

### 5.1 PM2（プロセスマネージャー）の設定
APIとワーカーの両方を監視・管理するための設計図（`ecosystem.config.js`）を作成します。

```javascript
// ecosystem.config.js
module.exports = {
  apps :[
    {
      name: "toitoi-api",
      script: "./api.js",
      instances: "max",       // CPUコアをフル活用してAPI受付を並列起動
      exec_mode: "cluster",   // クラスタモードで負荷分散
      env_production: { NODE_ENV: "production" }
    },
    {
      name: "toitoi-worker",
      script: "./worker.js",
      instances: 1,           // ワーカーは多重同期を防ぐため必ず1つだけ起動
      autorestart: true,      // エラーで落ちても自動再起動
      env_production: { NODE_ENV: "production" }
    }
  ]
}
```

**起動コマンド:** 
ターミナルで以下のコマンドを実行するだけで、2つのプログラムがバックグラウンドで完璧に稼働し始めます。
```bash
pm2 start ecosystem.config.js --env production
pm2 save # サーバー再起動時の自動復旧設定を保存
```

### 5.2 Caddy（自動HTTPS受付係）の設定
インターネットからのアクセス（[https://api.toitoi.cultivationdata.net](https://api.toitoi.cultivationdata.net)）を受け取り、内部のAPI（3000ポート）に安全に繋ぎます。
Caddy最大の魅力は、**設定ファイルにドメイン名を書くだけで、裏側で自動的にLet's EncryptからSSL証明書を取得し、永久に自動更新し続けてくれる**点です。

**`Caddyfile` の記述例（これだけで完結します）:**
```caddyfile
api.toitoi.cultivationdata.net {
    
    # 内部のNode.js API(3000番ポート)へリクエストを転送
    reverse_proxy localhost:3000

    # 最低限のセキュリティヘッダーを付与
    header {
        X-Frame-Options "SAMEORIGIN"
        X-XSS-Protection "1; mode=block"
    }
}
```
設定後、ターミナルで `caddy reload`（またはCaddyサービスの再起動）を実行すると、完全にセキュアなHTTPS化されたAPIサーバーが公開されます。

---

## 6. 運用保守の重要ポイント

1.  **ゼロメンテナンスのHTTPS**
    Caddyを使用しているため、SSL証明書の有効期限切れ（よくあるWebサーバーのトラブル）を気にする必要が一切なくなります。
2.  **データベースのバックアップ**
    PostgreSQLには大量の系統樹データが蓄積されます。定期的な `pg_dump` による自動バックアップをOSの `cron` 等で設定してください。
3.  **ログの監視**
    PM2はすべてのログを記録しています。エラーが起きていないか確認するには、サーバー上で `pm2 logs` と打ち込むだけで、APIとワーカー両方のリアルタイムログを監視できます。
