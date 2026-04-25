# Toitoi インデクサー・アーキテクチャ設計書：問いの系譜の抽出とAPI提供
**バージョン: 1.0 (本番環境デプロイメント) — Python実装版**

本ドキュメントは、デジタル・アグロエコロジー・コモンズ「Toitoi」における **コモンズAPI・インデクサー層** のリファレンス実装および本番環境構築ガイドです（Python実装版）。

分散ネットワーク（Nostr）から「問い（Kind: 11042）」をリアルタイムで収集・整理し、フロントエンド（スマホアプリやWeb画面）に超高速なAPIを提供するシステムの **「開発から本番稼働（24時間運用）」** までの全設計を定義します。本バージョンでは、WebフレームワークにPythonの標準的な **Flask**、データベースに軽量・ゼロメンテナンスの **SQLite**、WebサーバーにシェアNo.1の実績を持つ **Nginx** を採用した、小〜中規模運用向けの構成としています。

> **オリジナル版との比較:** Node.js + PostgreSQL + Caddy 版（`INDEXER_API_SETUP.md`）と比較して、本構成はセットアップの容易さと依存関係の少なさを重視します。SQLiteはDBサーバーが不要なためRaspberry Pi等のエッジ環境にも適していますが、同時書き込みが多い大規模運用では PostgreSQL 版が優位です。

---

## 1. 本番環境のアーキテクチャ

Toitoiのインデクサーをインターネット上に安全かつ安定して公開するため、以下の5層構造（レイヤー）でシステムを構築します。

```text
[ スマホアプリ / Webフロントエンド ]
       │ (HTTPS通信 : https://api.toitoi.cultivationdata.net)
       ▼
┌───────────────── サーバー本体 (Ubuntu Linux等) ─────────────────┐
│                                                               │
│  ①【受付係】 Nginx (リバースプロキシ + SSL終端)                 │
│       ├─ 役割: Let's Encrypt証明書管理、通信の安全な中継          │
│       │                                                       │
│       ▼ (内部Unixソケット: /run/toitoi/api.sockへ転送)          │
│                                                               │
│  ②【 店長 】 systemd (プロセスマネージャー)                      │
│       ├─ 役割: OS組み込みの監視、クラッシュ時の自動再起動          │
│       │                                                       │
│       ├──▶ ③【窓口担当】 APIサーバー (Flask + Gunicorn)         │
│       │        └─ 役割: アプリからの検索要求に応え、データを返す   │
│       │                                                       │
│       └──▶ ④【裏方職人】 インデクサー・ワーカー (APScheduler)    │
│                └─ 役割: 10分毎にリレーから「問い」を集めDBへ保存   │
│                                                               │
│  ⑤【整理棚】 SQLite (組み込みリレーショナル・データベース)         │
│       └─ 役割: 再帰CTE(WITH RECURSIVE)によるツリー高速検索      │
└───────────────────────────────────────────────────────────────┘
```

### 各コンポーネントの選定理由

| コンポーネント | 採用技術 | 理由 |
|---|---|---|
| Webフレームワーク | Flask | 軽量・シンプル・Pythonエコシステムと親和性が高い |
| WSGIサーバー | Gunicorn | 本番運用実績が豊富、マルチワーカー対応 |
| データベース | SQLite | DBサーバー不要、単一ファイル管理、バックアップが `cp` 1コマンド |
| Webサーバー | Nginx | SSL終端・リバースプロキシの定番、設定例が豊富 |
| プロセス管理 | systemd | Ubuntu標準搭載、追加ツール不要 |
| スケジューラー | APScheduler | Pythonネイティブ、Flask内に統合可能 |

---

## 2. 事前準備（必要なパッケージとDBの初期化）

本システムを構築するために、あらかじめ実行が必要なコマンド群です。

### 2.1 サーバー・OSレベルの必須ソフトウェア

サーバー本体（Ubuntu 22.04 LTS等を想定）に以下のミドルウェアをインストールします。

```bash
# システムパッケージの更新
sudo apt update && sudo apt upgrade -y

# Python環境（Ubuntu 22.04はPython 3.10+を標準搭載）
sudo apt install -y python3-pip python3-venv

# Nginx（リバースプロキシ）
sudo apt install -y nginx

# Certbot（Let's Encrypt SSL証明書の自動取得・更新）
sudo apt install -y certbot python3-certbot-nginx

# SQLiteクライアント（デバッグ・確認用）
sudo apt install -y sqlite3
```

### 2.2 プロジェクトのセットアップ

プロジェクトのディレクトリを作成し、Python仮想環境を構築します。
**仮想環境の使用は必須です。** systemdからの実行時に依存ライブラリを正確に参照させるために必要です。

```bash
# プロジェクトディレクトリの作成
sudo mkdir -p /opt/toitoi-indexer
sudo chown $USER:$USER /opt/toitoi-indexer
cd /opt/toitoi-indexer

# Python仮想環境の作成と有効化
python3 -m venv venv
source venv/bin/activate

# Gunicornのソケット用ディレクトリ
sudo mkdir -p /run/toitoi
sudo chown www-data:www-data /run/toitoi
```

### 2.3 プロジェクトレベルのパッケージインストール

```bash
# 仮想環境が有効な状態で実行
pip install flask gunicorn websockets apscheduler

# バージョンを固定したrequirements.txtを生成（本番環境での再現性確保）
pip freeze > requirements.txt
```

**`requirements.txt` の主要パッケージ（参考）:**

```
flask>=3.0.0
gunicorn>=21.2.0
websockets>=12.0
APScheduler>=3.10.4
```

### 2.4 データベースの初期構築 【重要】

後述の「3. データベース設計」で定義するスキーマをSQLiteに反映します。
**これを実行しないと `worker.py` や `api.py` はデータベースにアクセスできません。**

```bash
# プロジェクトルートで実行
# db/ディレクトリを作成（SQLiteファイルの格納場所）
mkdir -p /opt/toitoi-indexer/db

# Pythonシェルでスキーマを適用
python3 - <<'EOF'
import sqlite3
conn = sqlite3.connect('/opt/toitoi-indexer/db/toitoi.db')
with open('schema.sql', 'r') as f:
    conn.executescript(f.read())
conn.commit()
conn.close()
print("✅ データベースの初期化が完了しました。")
EOF
```

---

## 3. データベース設計（SQLiteスキーマ）

Nostrの生データを、検索・ツリー描画に最適化された状態へ分解して保存します。
プロジェクト内の `schema.sql` に以下を記述します。

```sql
-- schema.sql
-- SQLite用スキーマ定義（PostgreSQL版との主な差異: AUTOINCREMENT, JSONBはTEXT型で代替）

PRAGMA journal_mode = WAL;  -- 重要: 読み書きの同時実行性を大幅に向上させる設定
PRAGMA foreign_keys = ON;   -- 外部キー制約を有効化（SQLiteはデフォルトOFF）

-- Nostrイベントの本体を格納するメインテーブル
CREATE TABLE IF NOT EXISTS events (
    id          TEXT PRIMARY KEY,   -- Nostrイベントの32バイトSHA256ハッシュ
    pubkey      TEXT NOT NULL,
    content     TEXT NOT NULL,
    created_at  INTEGER NOT NULL,   -- Unixタイムスタンプ (整数)
    raw_json    TEXT NOT NULL,      -- 元のNostrイベントJSON全体を文字列で保存
    indexed_at  INTEGER DEFAULT (strftime('%s', 'now'))
);

-- タグ情報（context, relationship等）を正規化して格納するテーブル
CREATE TABLE IF NOT EXISTS tags (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id    TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    tag_key     TEXT NOT NULL,  -- "context", "relationship" など
    tag_value1  TEXT NOT NULL,  -- "volcanic_ash" など
    tag_value2  TEXT            -- 省略可能な第2値
);

-- 「問い」の親子関係（系統樹の枝）を記録するテーブル
CREATE TABLE IF NOT EXISTS lineages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    child_event_id  TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    parent_event_id TEXT NOT NULL,  -- 親が未収集の場合も参照できるようNULL許容しない
    relation_type   TEXT NOT NULL   -- "translation", "synthesis" など
);

-- 差分収集のための「しおり」テーブル
CREATE TABLE IF NOT EXISTS sync_state (
    relay_url   TEXT PRIMARY KEY,   -- リレーURL（一意のキー）
    last_synced INTEGER NOT NULL DEFAULT 0  -- 最後に同期したUnixタイムスタンプ
);

-- 検索・ツリー構築の高速化のためのインデックス
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_tags_event_id     ON tags(event_id);
CREATE INDEX IF NOT EXISTS idx_tags_key_value    ON tags(tag_key, tag_value1);
CREATE INDEX IF NOT EXISTS idx_lineages_child    ON lineages(child_event_id);
CREATE INDEX IF NOT EXISTS idx_lineages_parent   ON lineages(parent_event_id);
```

---

## 4. アプリケーションの実装（Python）

本番環境では、リレーからデータを収集する「ワーカー」と、フロントエンドにデータを返す「APIサーバー」を別々のファイルとして作成します。

### 4.1 共通データベースモジュール (`database.py`)

接続管理を一か所に集約し、スレッドセーフな操作を保証します。

```python
# database.py
import sqlite3
import threading
import os

DB_PATH = os.environ.get("DB_PATH", "/opt/toitoi-indexer/db/toitoi.db")

# スレッドローカルストレージ: 各スレッドが独立した接続を持つ
_local = threading.local()

def get_connection() -> sqlite3.Connection:
    """スレッドセーフなSQLite接続を返す。"""
    if not hasattr(_local, "conn") or _local.conn is None:
        conn = sqlite3.connect(DB_PATH, check_same_thread=False)
        conn.row_factory = sqlite3.Row  # 結果を辞書ライクに参照可能にする
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        _local.conn = conn
    return _local.conn

def save_event_to_db(event: dict) -> bool:
    """
    Nostrイベントをデータベースに保存する。
    Event, Tag, Lineage を単一トランザクションで一括保存する。
    既に存在するイベントはスキップ（冪等性の保証）。
    戻り値: 保存成功=True, スキップ=False
    """
    import json
    conn = get_connection()
    try:
        with conn:  # トランザクション（成功で自動COMMIT、例外で自動ROLLBACK）
            # 重複チェック（INSERT OR IGNOREでも可）
            exists = conn.execute(
                "SELECT 1 FROM events WHERE id = ?", (event["id"],)
            ).fetchone()
            if exists:
                return False  # スキップ

            # events テーブルへ保存
            conn.execute(
                "INSERT INTO events (id, pubkey, content, created_at, raw_json) VALUES (?, ?, ?, ?, ?)",
                (event["id"], event["pubkey"], event["content"],
                 event["created_at"], json.dumps(event))
            )

            # tags テーブルへ保存（正規化）
            for tag in event.get("tags", []):
                if len(tag) >= 2:
                    conn.execute(
                        "INSERT INTO tags (event_id, tag_key, tag_value1, tag_value2) VALUES (?, ?, ?, ?)",
                        (event["id"], tag[0], tag[1], tag[2] if len(tag) > 2 else None)
                    )

            # lineages テーブルへ保存（"e"タグを親子関係として解釈）
            relation_type = next(
                (t[1] for t in event.get("tags", []) if t[0] == "relationship"), "unknown"
            )
            for tag in event.get("tags", []):
                if tag[0] == "e" and len(tag) >= 2:
                    conn.execute(
                        "INSERT INTO lineages (child_event_id, parent_event_id, relation_type) VALUES (?, ?, ?)",
                        (event["id"], tag[1], relation_type)
                    )
        return True
    except sqlite3.Error as e:
        print(f"DB保存エラー: {e}")
        return False
```

### 4.2 ワーカープロセス (`worker.py`)

リレーからのデータ収集を担当します。非同期WebSocket通信と多重実行防止ロックを実装します。

```python
# worker.py
import asyncio
import json
import os
import time
import threading
import websockets
from database import get_connection, save_event_to_db

RELAY_URL = os.environ.get("RELAY_URL", "wss://relay.toitoi.cultivationdata.net")

# 多重実行防止用のロック
_is_running = False
_lock = threading.Lock()


def _verify_nostr_event(event: dict) -> bool:
    """
    Nostrイベントの署名を検証する（簡易実装）。
    本番環境では secp256k1 ライブラリを使った完全な署名検証を推奨。
    pip install coincurve で secp256k1 ECDSAが利用可能。
    """
    import hashlib
    required_keys = {"id", "pubkey", "created_at", "kind", "tags", "content", "sig"}
    if not required_keys.issubset(event.keys()):
        return False

    # イベントIDの再計算による整合性チェック
    serialized = json.dumps(
        [0, event["pubkey"], event["created_at"], event["kind"], event["tags"], event["content"]],
        separators=(",", ":"), ensure_ascii=False
    )
    computed_id = hashlib.sha256(serialized.encode()).hexdigest()
    return computed_id == event["id"]


async def _fetch_from_relay():
    """リレーに接続し、差分イベントをフェッチして保存する非同期関数。"""
    conn = get_connection()

    # 1. 「しおり」の取得
    state = conn.execute(
        "SELECT last_synced FROM sync_state WHERE relay_url = ?", (RELAY_URL,)
    ).fetchone()
    since = state["last_synced"] if state else 0
    latest_created_at = since

    saved_count = 0
    subscription_id = f"toitoi-worker-{int(time.time())}"

    try:
        async with websockets.connect(RELAY_URL, open_timeout=15) as ws:
            # 2. 差分（since）のみを要求するサブスクリプションを送信
            req = json.dumps(["REQ", subscription_id, {"kinds": [11042], "since": since}])
            await ws.send(req)
            print(f"[Worker] リレーへ接続完了。since={since} で差分を要求中...")

            async for raw_message in ws:
                message = json.loads(raw_message)
                msg_type = message[0]

                if msg_type == "EVENT" and message[1] == subscription_id:
                    event = message[2]

                    # 3. 署名検証（不正データ排除）
                    if not _verify_nostr_event(event):
                        print(f"[Worker] 署名検証失敗。スキップ: {event.get('id', 'unknown')[:8]}...")
                        continue

                    # 4. DB保存
                    if save_event_to_db(event):
                        saved_count += 1
                    if event.get("created_at", 0) > latest_created_at:
                        latest_created_at = event["created_at"]

                elif msg_type == "EOSE":
                    # 5. 過去データ取得完了の合図（End Of Stored Events）
                    print(f"[Worker] EOSE受信。{saved_count}件を新規保存。安全に切断します。")

                    # 6. 「しおり」の更新（Upsert）
                    conn.execute(
                        "INSERT INTO sync_state (relay_url, last_synced) VALUES (?, ?) "
                        "ON CONFLICT(relay_url) DO UPDATE SET last_synced = excluded.last_synced",
                        (RELAY_URL, latest_created_at)
                    )
                    conn.commit()

                    # 7. サブスクリプションのクローズを送信し、行儀よく切断
                    await ws.send(json.dumps(["CLOSE", subscription_id]))
                    break

    except (websockets.exceptions.WebSocketException, asyncio.TimeoutError) as e:
        print(f"[Worker] WebSocketエラー: {e}")


def run_sync_job():
    """スケジューラーから呼び出される同期ラッパー関数。"""
    global _is_running
    with _lock:
        if _is_running:
            print("[Worker] 前回のジョブが実行中のためスキップします。")
            return
        _is_running = True

    try:
        asyncio.run(_fetch_from_relay())
    except Exception as e:
        print(f"[Worker] 予期しないエラー: {e}")
    finally:
        with _lock:
            _is_running = False
```

### 4.3 APIサーバー (`api.py`)

スマホアプリ等からのリクエストに応えます。「系統樹（ツリー）」の取得には、SQLiteの再帰CTE（`WITH RECURSIVE`）を使用します。APSchedulerを統合し、1つのプロセスでAPIとワーカーの両方を動かします。

```python
# api.py
import json
import os
from flask import Flask, jsonify, abort
from apscheduler.schedulers.background import BackgroundScheduler
from database import get_connection
from worker import run_sync_job

app = Flask(__name__)


def _build_nested_tree(rows: list, root_id: str) -> dict | None:
    """
    SQLiteから取得したフラットな行リストを、階層型の辞書（ネストされたJSON）に変換する。
    """
    nodes = {row["id"]: dict(row) | {"children": []} for row in rows}
    root = None
    for node in nodes.values():
        parent_id = node.get("parent_id")
        if parent_id and parent_id in nodes:
            nodes[parent_id]["children"].append(node)
        else:
            root = node
    return root


# ── エンドポイント定義 ─────────────────────────────────────────────

@app.get("/api/v1/inquiries/<string:event_id>/tree")
def get_inquiry_tree(event_id: str):
    """
    指定されたイベントIDをルートとする「問いの系統樹」を返す。
    SQLiteのWITH RECURSIVE（再帰CTE）で一撃でツリー全体を取得する。
    """
    conn = get_connection()
    rows = conn.execute("""
        WITH RECURSIVE tree AS (
            -- ベースケース: ルートノード
            SELECT
                e.id,
                e.content,
                e.created_at,
                NULL AS parent_id
            FROM events e
            WHERE e.id = ?

            UNION ALL

            -- 再帰ステップ: 子ノードを辿る
            SELECT
                e.id,
                e.content,
                e.created_at,
                l.parent_event_id AS parent_id
            FROM events e
            INNER JOIN lineages l ON e.id = l.child_event_id
            INNER JOIN tree t ON l.parent_event_id = t.id
        )
        SELECT * FROM tree;
    """, (event_id,)).fetchall()

    if not rows:
        abort(404, description=f"イベントID '{event_id}' が見つかりません。")

    tree = _build_nested_tree(rows, event_id)
    return jsonify(tree)


@app.get("/api/v1/inquiries")
def list_inquiries():
    """
    「問い」の一覧を返す。クエリパラメータでフィルタリング可能。
    例: /api/v1/inquiries?context=volcanic_ash&limit=20
    """
    from flask import request
    context = request.args.get("context")
    limit = min(int(request.args.get("limit", 50)), 200)  # 最大200件に制限

    conn = get_connection()
    if context:
        rows = conn.execute("""
            SELECT DISTINCT e.id, e.content, e.created_at
            FROM events e
            INNER JOIN tags t ON e.id = t.event_id
            WHERE t.tag_key = 'context' AND t.tag_value1 = ?
            ORDER BY e.created_at DESC
            LIMIT ?
        """, (context, limit)).fetchall()
    else:
        rows = conn.execute("""
            SELECT id, content, created_at FROM events
            ORDER BY created_at DESC LIMIT ?
        """, (limit,)).fetchall()

    return jsonify([dict(row) for row in rows])


@app.get("/api/v1/health")
def health_check():
    """死活監視用エンドポイント。Nginxやモニタリングツールから定期的に叩く。"""
    conn = get_connection()
    event_count = conn.execute("SELECT COUNT(*) FROM events").fetchone()[0]
    return jsonify({"status": "ok", "event_count": event_count})


# ── APSchedulerの設定（ワーカーをAPIサーバーに統合） ───────────────

def start_scheduler():
    """アプリ起動時にバックグラウンドスケジューラーを開始する。"""
    scheduler = BackgroundScheduler(daemon=True)
    # 10分ごとにリレー同期ジョブを実行
    scheduler.add_job(run_sync_job, trigger="interval", minutes=10, id="nostr_sync")
    scheduler.start()
    print("[Scheduler] バックグラウンド同期スケジューラーを開始しました（10分間隔）。")
    return scheduler


# Gunicornからの起動時にスケジューラーを開始
scheduler = start_scheduler()

if __name__ == "__main__":
    # 開発時の直接起動用（本番はGunicornを使用すること）
    app.run(host="127.0.0.1", port=3000, debug=False)
```

---

## 5. 本番環境へのデプロイ（24時間運用設定）

作成したプログラムを、安全かつ永遠に動かし続けるためのサーバー設定です。

### 5.1 systemd（プロセスマネージャー）の設定

OSに標準搭載の `systemd` を使い、GunicornプロセスをAPIサーバーとして管理します。

**サービスファイル `toitoi-api.service` の作成:**

```bash
sudo nano /etc/systemd/system/toitoi-api.service
```

```ini
[Unit]
Description=Toitoi Indexer API Server (Flask + Gunicorn)
After=network.target
Documentation=https://github.com/nkkmd/Toitoi

[Service]
Type=notify
# セキュリティ: 専用ユーザーで実行（rootで動かさない）
User=www-data
Group=www-data
WorkingDirectory=/opt/toitoi-indexer

# 環境変数の設定
Environment="PATH=/opt/toitoi-indexer/venv/bin"
Environment="DB_PATH=/opt/toitoi-indexer/db/toitoi.db"
Environment="RELAY_URL=wss://relay.toitoi.cultivationdata.net"

# Gunicornの起動コマンド
# --workers: CPUコア数 × 2 + 1 が目安。小規模なら2〜4で十分。
# --bind: NginxとUnixソケットで通信（TCPより高速・セキュア）
ExecStart=/opt/toitoi-indexer/venv/bin/gunicorn \
    --workers 3 \
    --worker-class sync \
    --bind unix:/run/toitoi/api.sock \
    --timeout 60 \
    --access-logfile /var/log/toitoi/access.log \
    --error-logfile /var/log/toitoi/error.log \
    api:app

# クラッシュ時の自動再起動
Restart=on-failure
RestartSec=5s

# Unixソケット用ディレクトリの自動作成
RuntimeDirectory=toitoi
RuntimeDirectoryMode=0755

[Install]
WantedBy=multi-user.target
```

**起動コマンド:**

```bash
# ログディレクトリの作成
sudo mkdir -p /var/log/toitoi
sudo chown www-data:www-data /var/log/toitoi

# systemdへのサービス登録・起動
sudo systemctl daemon-reload
sudo systemctl enable toitoi-api   # サーバー再起動時の自動起動を有効化
sudo systemctl start toitoi-api

# 動作確認
sudo systemctl status toitoi-api
```

### 5.2 Nginx（SSL受付係）の設定

インターネットからのアクセス（`https://api.toitoi.cultivationdata.net`）を受け取り、内部のGunicorn（Unixソケット）に安全に繋ぎます。

**`/etc/nginx/sites-available/toitoi-api` の記述例:**

```nginx
server {
    # Certbotが自動で追記するHTTPS設定のためのプレースホルダー
    listen 80;
    server_name api.toitoi.cultivationdata.net;

    # Certbot実行時の認証用ディレクトリ
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # HTTPアクセスは全てHTTPSへリダイレクト
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name api.toitoi.cultivationdata.net;

    # SSL証明書（Certbot実行後に自動設定される）
    ssl_certificate     /etc/letsencrypt/live/api.toitoi.cultivationdata.net/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.toitoi.cultivationdata.net/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    # Gunicornが動くUnixソケットへリバースプロキシ
    location / {
        proxy_pass http://unix:/run/toitoi/api.sock;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 最低限のセキュリティヘッダー
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header X-XSS-Protection "1; mode=block";
}
```

**設定の反映とSSL証明書の取得:**

```bash
# Nginx設定を有効化（シンボリックリンク作成）
sudo ln -s /etc/nginx/sites-available/toitoi-api /etc/nginx/sites-enabled/

# 設定ファイルの文法チェック
sudo nginx -t

# Nginxの再起動
sudo systemctl reload nginx

# Let's EncryptのSSL証明書を取得（HTTPが通っている状態で実行）
sudo certbot --nginx -d api.toitoi.cultivationdata.net

# 証明書の自動更新確認（Certbot導入時に自動設定済み）
sudo certbot renew --dry-run
```

---

## 6. 運用保守の重要ポイント

### 6.1 シンプルなバックアップ（SQLiteの最大の利点）

SQLiteはデータベース全体が単一ファイルに収まるため、バックアップが極めて簡単です。
OSの `cron` で定期的なバックアップを設定します。

```bash
# crontab -e で以下を追記（毎日午前3時に実行）
0 3 * * * sqlite3 /opt/toitoi-indexer/db/toitoi.db ".backup '/opt/toitoi-indexer/db/toitoi_$(date +\%Y\%m\%d).db'" && find /opt/toitoi-indexer/db -name "toitoi_*.db" -mtime +30 -delete
```

> **解説:** `sqlite3` の `.backup` コマンドは、データベースが稼働中でもデータ整合性を保ったまま安全にコピーを作成します。最後の `find` コマンドで30日以上古いバックアップを自動削除します。

### 6.2 ログの監視

systemdは全てのログを記録しています。エラーが起きていないか確認するには以下のコマンドを使います。

```bash
# リアルタイムでログを監視（Ctrl+C で終了）
sudo journalctl -u toitoi-api -f

# 直近100行のログを表示
sudo journalctl -u toitoi-api -n 100

# Gunicornのアクセスログを確認
sudo tail -f /var/log/toitoi/access.log
```

### 6.3 SQLiteのパフォーマンス診断

データが蓄積してきた場合、以下のコマンドでクエリ実行計画を確認し、インデックスが有効に機能しているかを診断できます。

```bash
sqlite3 /opt/toitoi-indexer/db/toitoi.db
```

```sql
-- ツリー取得クエリの実行計画確認（SCAN ではなく SEARCH が出ることを確認）
EXPLAIN QUERY PLAN
WITH RECURSIVE tree AS (
    SELECT id, content, created_at, NULL AS parent_id FROM events WHERE id = 'your-root-event-id'
    UNION ALL
    SELECT e.id, e.content, e.created_at, l.parent_event_id
    FROM events e
    INNER JOIN lineages l ON e.id = l.child_event_id
    INNER JOIN tree t ON l.parent_event_id = t.id
)
SELECT * FROM tree;

-- データベースの整合性チェックと最適化
PRAGMA integrity_check;
PRAGMA optimize;
VACUUM;  -- 削除済みデータの領域を回収（ファイルサイズを縮小）
```

### 6.4 Node.js版（PostgreSQL版）からの移行ガイド

本構成（Python + SQLite）からオリジナルのNode.js + PostgreSQL版へ移行する場合、あるいは逆方向の移行を行う場合は以下の点に注意してください。

| 項目 | Python + SQLite版（本書） | Node.js + PostgreSQL版 |
|---|---|---|
| スケーラビリティ | 小〜中規模（書き込みが少ない場合） | 中〜大規模（高頻度書き込みに対応） |
| セットアップ難易度 | 低（DBサーバー不要） | 中（PostgreSQLの別途インストールが必要） |
| バックアップ | `cp` 1コマンドで可能 | `pg_dump` コマンドで取得 |
| 再帰クエリ | `WITH RECURSIVE`（SQLite 3.35+対応） | `WITH RECURSIVE`（PostgreSQL完全対応） |
| 接続数上限 | 高い同時接続時は書き込みが直列化 | 多数の並列接続に対応 |
| 推奨用途 | 個人・小規模コミュニティ・エッジ環境 | コミュニティ公開・複数管理者での運用 |