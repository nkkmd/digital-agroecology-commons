# 構築ガイド：アグロエコロジー・コモンズ専用リレーの立ち上げ方

本ドキュメントは、「デジタル・アグロエコロジー・コモンズ」の基盤となる専用Nostrリレーサーバーを構築するための公式ガイドです。

このリレーは、スパムや無関係なSNS投稿を一切遮断し、**アグロエコロジーの「問い（Kind: 11042）」のみを永続的に保存する「知識の図書館」** として機能します。あなたがこのリレーを立ち上げることで、特定の企業に依存しない強靭な分散ネットワーク（入れ子構造のコモンズ）が実現されます。

## 1. 事前準備（システム要件）

サーバーを構築する前に、以下の準備をお願いします。

*   **Linuxサーバー（VPSなど）:**
    *   OS: Ubuntu 22.04 LTS または Debian 12 (推奨)
    *   スペック: 最小 1vCPU / 1GB RAM / 20GB SSD（月額500円〜1000円程度のVPSで十分稼働します）
*   **ドメインの取得:**
    *   例: `relay.your-domain.com`（取得したドメインのAレコードを、VPSのIPアドレスに向けておいてください）
*   **必須ソフトウェア:**
    *   Git, Docker, Docker Compose v2 がインストールされていること。

---

## 2. 構築ステップ

サーバーにSSHでログインし、以下の手順を順番に実行してください。

### Step 2.1: Nostream（リレーエンジン）の取得
世界で最も堅牢なNostrリレーソフトウェアの一つである `Nostream` を利用します。

```bash
# Nostreamのリポジトリをクローンしてディレクトリに移動
git clone https://github.com/Cameri/nostream.git
cd nostream
```

### Step 2.2: 「アグロエコロジー専用」設定の適用（最重要）
Nostreamの環境変数ファイル（`.env`）を作成し、**「Kind: 11042 のみを受け付ける」**という強力なホワイトリスト設定を行います。

```bash
# デフォルトの設定ファイルをコピー
cp .env.example .env

# 設定ファイルを編集 (nano エディタを使用)
nano .env
```

`.env` ファイルを開いたら、以下の設定を追加・変更してください。

```ini
# --- リレーの基本情報（NIP-11） ---
RELAY_NAME="Agroecology Commons Relay (Kyushu)"
RELAY_DESCRIPTION="九州地域の有機農家コミュニティが運営する、アグロエコロジー『問いの循環』専用リレーです。"
RELAY_PUBKEY="<あなたのNostr公開鍵（hex形式）があれば入力>"
RELAY_CONTACT="mailto:admin@your-domain.com"

# --- アグロエコロジー専用の制限（ホワイトリスト） ---
# Kind 11042（問い）のイベントのみを保存・配信する
EVENT_KIND_WHITELIST="11042"

# 巨大なデータ（画像スパム等）を防ぐため、イベントサイズを20KBに制限
EVENT_MAX_SIZE_BYTES=20000

# 古すぎる/未来すぎるタイムスタンプのイベントを拒否
EVENT_CREATED_AT_UPPER_LIMIT=60
EVENT_CREATED_AT_LOWER_LIMIT=31536000 # (1年前まで)
```
*※編集が終わったら `Ctrl + O` → `Enter` で保存し、`Ctrl + X` で閉じます。*

### Step 2.3: データベースのセットアップと起動
NostreamはPostgreSQLを使用します。Docker Composeを使って一発で起動します。

```bash
# Nostream本体とデータベース(PostgreSQL)のビルドと起動（バックグラウンド実行）
docker compose up -d
```
起動後、`docker compose logs -f` を実行し、エラーが出ずにリレーが `Listening on port 8008` と表示されていれば内部サーバーの起動は成功です。

---

## 3. SSL暗号化と公開（Caddyの導入）

Nostrの通信はセキュアなWebSocket（`wss://`）で行われる必要があります。SSL証明書の取得と更新を完全に自動化してくれる **Caddy** を導入します。

### Step 3.1: Caddyのインストール
```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

### Step 3.2: Caddyfileの設定（リバースプロキシ）
Caddyの設定ファイルを編集し、あなたのドメインへのアクセスをNostream（ポート8008）に流すように設定します。

```bash
sudo nano /etc/caddy/Caddyfile
```

以下の内容をコピーし、`relay.your-domain.com` の部分をあなたの実際のドメインに書き換えて貼り付けてください。

```caddy
# あなたのドメインを指定
relay.your-domain.com {
    # Nostream (ポート8008) へリバースプロキシ
    reverse_proxy localhost:8008 {
        header_up Host {host}
        header_up X-Real-IP {remote}
        header_up X-Forwarded-For {remote}
        header_up X-Forwarded-Proto {scheme}
    }

    # NIP-11（リレー情報）へのCORSアクセス許可
    @options {
        method OPTIONS
    }
    header {
        Access-Control-Allow-Origin "*"
        Access-Control-Allow-Methods "GET, POST, OPTIONS"
        Access-Control-Allow-Headers "Content-Type, Authorization"
    }
    respond @options 204
}
```
*※ `Ctrl + O` → `Enter` で保存し、`Ctrl + X` で閉じます。*

### Step 3.3: Caddyの再起動
```bash
# 設定を反映して再起動
sudo systemctl restart caddy
```
これで、Caddyが自動的に Let's Encrypt と通信し、数秒でSSL証明書（HTTPS/WSS）が適用されます。

---

## 4. 動作確認（テスト）

あなたの構築したリレーが、正しくコモンズのネットワークとして機能しているかテストします。

### ブラウザでの確認 (NIP-11)
ブラウザを開き、`https://relay.your-domain.com` にアクセスしてください。
「Please use a Nostr client to connect.」という文字が表示されれば成功です。

### WebSocket接続とフィルタリングのテスト
Nostrの接続確認ツールを使用して、WebSocket（`wss://`）が機能しているか、そして**指定したKind以外がちゃんと弾かれるか**を確認します。

手元のPC（またはサーバー上）で以下のNode.jsスクリプトを実行してみてください。
（※ `wss://relay.your-domain.com` をあなたのドメインに変更してください）

```javascript
// test_relay.js
const { generateSecretKey, finalizeEvent } = require('nostr-tools/pure');
const { Relay } = require('nostr-tools/relay');
const WebSocket = require('ws');
global.WebSocket = WebSocket;

async function test() {
    const relay = await Relay.connect('wss://relay.your-domain.com');
    console.log(`✅ リレーに接続成功`);

    const sk = generateSecretKey();

    // テスト1: 許可されている「問い」のイベント (Kind 11042)
    const validEvent = finalizeEvent({
        kind: 11042,
        created_at: Math.floor(Date.now() / 1000),
        tags: [["t", "agroecology"], ["context", "test"]],
        content: "テストの問いです"
    }, sk);

    try {
        await relay.publish(validEvent);
        console.log(`🟢 Kind 11042 (問い) の送信に成功しました！`);
    } catch (e) {
        console.error(`🔴 失敗:`, e);
    }

    // テスト2: 許可されていない普通のSNS投稿 (Kind 1)
    const invalidEvent = finalizeEvent({
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: "おはよう！これは弾かれるべき普通のツイートです。"
    }, sk);

    try {
        await relay.publish(invalidEvent);
        console.log(`🔴 失敗: Kind 1 が送信できてしまいました（設定ミス）`);
    } catch (e) {
        console.log(`🟢 成功: Kind 1 の送信が正しく拒否されました！（スパム防御機能が作動）: ${e}`);
    }

    relay.close();
}
test();
```

---

## 5. 運用と保守（データ・コモンズを守るために）

リレーの運営者としての作業はほぼゼロですが、データベースのバックアップは重要です。

### データのバックアップ（PostgreSQL）
蓄積された「問いの系譜」は地域の財産です。定期的に以下のコマンドでDBのダンプ（バックアップ）を取ることをお勧めします。

```bash
cd nostream
docker exec -t nostream-db-1 pg_dumpall -c -U nostream > dump_`date +%Y-%m-%d`.sql
```

### システムのアップデート
Nostreamの最新のセキュリティパッチを適用する場合は以下を実行します。

```bash
cd nostream
git pull origin main
docker compose build
docker compose up -d
```

### コミュニティへの参加表明
リレーが正常に稼働したら、システムのフロントエンド（ダッシュボード）にある「リレー追加」設定から、あなたの `wss://relay.your-domain.com` をネットワークに追加してください。
これで、世界中の農家とAIが、あなたのリレーをコモンズの一部として利用し始めます。
