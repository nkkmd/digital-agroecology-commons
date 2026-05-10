# Toitoi エッジ・アーキテクチャ設計書：ローカルAIと「問い」の生成

**バージョン: 0.3.0**　｜　前バージョン (v0.2.0) からの主な修正：

* §1・§2・§3：**問いの二層構造**を導入（ARCHITECTURE v0.3.0 §1 / TOITOI_PROTOCOL_SCHEMA v0.1.2 §1.1 対応）。第1層：自然言語（`content` フィールド：バウンダリー・オブジェクト）、第2層：構造化された意味的射影（`dsl:*` タグ群：DSL）。
* §2.2：Problematizing Pipelineを更新。自然言語問い生成（第1層）に続き、DSL生成（第2層）をオプションの第二ステップとして追加記述。
* §3・§4：`dsl:*` タグ群（`dsl:model` / `dsl:var` / `dsl:rel` / `dsl:meta`）の記述・コード例を追加。
* §4：コード例の `relationship` タグ値を `nutrient` → **`nutrient_cycle`** に修正（TOITOI_PROTOCOL_SCHEMA v0.1.2 §2.2 推奨ボキャブラリーへの統一）。
* 全体：参照先を ARCHITECTURE.md v0.3.0 / TOITOI_PROTOCOL_SCHEMA.md v0.1.2 に更新。

本ドキュメントは、デジタル・アグロエコロジー・コモンズ「Toitoi」における **ローカルAI・エッジ層（エッジクライアント）** のリファレンス実装ガイドです。

この層は、農地固有の「生データ（センサー値・観察メモ）」を、他者が翻訳可能な「境界対象（バウンダリー・オブジェクト）」としての **『問い（Kind: 1042）』** に変換し、Nostrコモンズ・ネットワークへ送信する役割を担います。

---

## 1. エッジ層の基本思想とセキュリティ原則

1.  **ゼロ・データ・エクスポージャー（生データの完全隠蔽）:**
    土壌水分量、温度の時系列データ、正確な位置情報（GPS）などの生データは、農家のスマートフォンやローカルPC、エッジサーバー内に**完全に留め置かれます**。クラウドやリレーサーバーには一切送信しません。
2.  **秘密鍵のローカル管理:**
    Nostrプロトコルの根幹であるアイデンティティ（秘密鍵：`nsec` / `hex`）は、エッジデバイス内のみに保存され、すべてのイベント（問い）は送信前にローカルで暗号署名されます。
3.  **「答え」ではなく「問い」の抽出（Problematizing）:**
    ローカルAIは、データから「明日の朝に灌水せよ」というマニュアル（答え）を導き出すのではなく、「なぜ北側区画の乾きが遅いのか？」という『問い』を導き出すようプロンプト設計されます。
4.  **問いの二層構造（ARCHITECTURE v0.3.0 §1 / TOITOI_PROTOCOL_SCHEMA v0.1.2 §1.1）:**
    生成される問いは以下の二層で構成されます。
    ```
    【第1層】 バウンダリー・オブジェクト ── 自然言語（content フィールド）
                      ↓  意味的射影（任意）
    【第2層】 DSL ────────────────────── 構造化された解釈モデル（dsl:* タグ群）
    ```
    第1層は常に存在し、農家・研究者・AIが各々の視点で読める「社会的インターフェース」です。第2層は任意・非権威的であり、同一の問いに複数の競合する解釈モデルを共存させることができます。**DSLタグを持たない問いも完全に有効です。**

---

## 2. エッジ・パイプラインの構成

ローカルAIクライアントは、以下の4つのパイプラインで動作します。

```text
[生データ] ──(1.収集)──> [ローカルDB] ──(2.LLM解析)──> [『問い』の生成] ──(3.Nostr署名)──> [マルチパブリッシュ(送信)]
```

### 2.1 データ収集フェーズ

*   **IoTセンサー:** 水分、温度、照度などの時系列データをローカル（SQLite等）に保存。
*   **人間の観察:** 農家がアプリに入力した「テキストメモ」や「写真」。

### 2.2 LLM解析フェーズ（Problematizing）

収集したコンテキストをLLM（ローカルで動く Llama-3-8B や、商用APIの Claude 3.5 Sonnet 等）に渡し、以下の2ステップで問いを生成します。

**ステップ1：第1層の生成（バウンダリー・オブジェクト）**

プロンプト制約のもと、自然言語の「問い」を `content` フィールド向けに出力させます。

> **[システムプロンプトの例]**
> あなたはアグロエコロジー実践を支援する認知的パートナー（AI）です。提供されたセンサーデータと農家の観察メモを読み解き、「処方箋（答え）」ではなく、農家の生態学的直感を刺激する「関係性についての問い」を生成してください。出力は指定された Toitoi Nostr Schema に準拠した JSON 形式のみとします。

**ステップ2：第2層の生成（DSL：任意）**

第1層の自然言語問いを入力として、第二のLLMパス（またはルールベース処理）により `dsl:*` タグ群を生成します。変数間の関係性を構造的に射影できる場合に付与します。AIが信頼できる構造的射影を生成できない場合は、DSLタグを省略します。

### 2.3 イベント署名フェーズ

出力されたJSONを、`nostr-tools` 等のライブラリを使用してハッシュ化（ID生成）し、農家の秘密鍵でシュノア署名（Schnorr signature）を施します。

### 2.4 マルチパブリッシュ・フェーズ

署名済みのイベントを、コモンズを構成する**3つ以上**のリレー（アンカーリレー、地域リレー、パブリックリレー）へWebSocket（`wss://`）経由で**並列に**同時送信します。フェイルセーフのため、いずれかのリレーへの送信が失敗しても他のリレーへの送信は継続されます。

---

## 3. 送信データの構造（概要）

生成されるNostrイベント（JSON）の基本的な構造です。
※ 各タグの厳密な定義・標準ボキャブラリー・DSLサブキー定義については、**[`TOITOI_PROTOCOL_SCHEMA.md`](../TOITOI_PROTOCOL_SCHEMA.md)** (v0.1.2) を必ず参照して実装してください。

```json
{
  "kind": 1042,
  "pubkey": "<農家の公開鍵 (32-bytes hex)>",
  "created_at": <Unix Timestamp>,

  // 【第1層】バウンダリー・オブジェクト：農家・研究者・AIが各々の視点で読める自然言語の問い
  "content": "北側斜面において、土壌の乾きの遅さとスギナの繁茂に相関が見られます。この微気候は天敵群集にどのような影響を与えているでしょうか？",

  "tags": [
    // [必須] コモンズ・ルーティング用
    ["t", "agroecology"],

    // [必須/複数可] Context: 属地性の抽象化メタデータ
    ["context", "climate_zone",    "warm-temperate"],
    ["context", "soil_type",       "volcanic_ash"],
    ["context", "farming_context", "no_till"],
    ["context", "crop_family",     "solanaceae"],

    // [必須] Relationship: 注目する生態学的関係性
    ["relationship", "microclimate", "weed_flora"],

    // [必須] Phase: 熟達段階（beginner / intermediate / expert）
    ["phase", "intermediate"],

    // [任意] Trigger: 問いの起点
    ["trigger", "sensor_anomaly", "soil_moisture"],

    // [任意] Lineage: 問いの系譜（relation_type: derived_from | synthesis）
    ["e", "<親イベントID>", "wss://relay.toitoi.cultivationdata.net", "derived_from"],

    // 【第2層】DSL: 構造化された意味的射影（任意・非権威的）
    // 複数の解釈モデルを model_id で識別して共存させることができる
    ["dsl:model", "m1", "climate_model"],
    ["dsl:var",   "m1", "microclimate", "independent"],
    ["dsl:var",   "m1", "weed_flora",   "dependent"],
    ["dsl:rel",   "m1", "microclimate", "weed_flora"]
  ],

  "id": "<sha256(serialize(event))>",
  "sig": "<schnorr_signature(id, privkey)>"
}
```

> **DSLタグについて（第2層）:** DSLタグは任意です。付与することで、インデクサーがモデル名・変数・関係性による絞り込み検索（`/api/v1/inquiries/query?dsl_model=<name>` 等）に対応できます。詳細は TOITOI_PROTOCOL_SCHEMA v0.1.2 §2.6 を参照してください。

> **`trigger` タグについて:** センサー異常や特定の観察が問いの直接的な起点となった場合に付与する任意タグです（TOITOI_PROTOCOL_SCHEMA v0.1.2 §2.5 参照）。フォーマット: `["trigger", "<category>", "<value>"]`。自動生成パイプラインでは、センサー異常検知時に自動付与することを推奨します。

---

## 4. 実装例（Node.js / nostr-tools）

ローカルのLLMからJSONが出力された後、それをNostrイベントに署名・送信する最小実装のコード例です。DSL（第2層）の付与を含む構成を示します。

```javascript
import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools/pure';
import { Relay } from 'nostr-tools/relay';
import WebSocket from 'ws';
global.WebSocket = WebSocket;

// 1. 農家のローカル管理キー（本番環境ではセキュアストレージから読み込む）
const secretKey = generateSecretKey();
const pubKey = getPublicKey(secretKey);

// 2. LLMが生成した「問い」のデータ構造 (※詳細は TOITOI_PROTOCOL_SCHEMA.md v0.1.2 参照)
const inquiryPayload = {
    kind: 1042,
    created_at: Math.floor(Date.now() / 1000),

    // 【第1層】バウンダリー・オブジェクト: 自然言語の問い（必須・主要表現）
    content: "九州の微気候の問いを当圃場（黒ボク土）で観察したところ、ハコベが優占しました。初期窒素量が関係しているのではないでしょうか？",

    tags: [
        ["t", "agroecology"],
        ["context", "climate_zone",    "cool-temperate"],
        ["context", "soil_type",       "volcanic_ash"],
        ["context", "farming_context", "open_field"],
        ["context", "crop_family",     "brassica"],
        ["relationship", "weed_flora", "nutrient_cycle"],    // TOITOI_PROTOCOL_SCHEMA v0.1.2 §2.2 推奨ボキャブラリー
        ["phase", "intermediate"],
        ["trigger", "sensor_anomaly", "soil_moisture"],      // [任意] センサー異常が問いの起点の場合に付与
        ["e", "abc123def456...", "wss://relay.toitoi.cultivationdata.net", "derived_from"],

        // 【第2層】DSL: 構造化された意味的射影（任意）
        // AIが信頼できる構造的射影を生成できない場合はこのブロックを省略する
        ["dsl:model", "m1", "nutrient_model"],
        ["dsl:var",   "m1", "nutrient_cycle", "independent"],
        ["dsl:var",   "m1", "weed_flora",     "dependent"],
        ["dsl:rel",   "m1", "nutrient_cycle", "weed_flora"],

        // 複数の解釈モデルを共存させる場合は model_id を変えて追加（解釈の多様性）
        // ["dsl:model", "m2", "soil_model"],
        // ["dsl:var",   "m2", "soil_moisture", "independent"],
        // ["dsl:var",   "m2", "weed_flora",    "dependent"],
        // ["dsl:rel",   "m2", "soil_moisture", "weed_flora"],
    ]
};

// 3. ローカル環境で暗号署名（ここでIDとsigが生成される）
const signedEvent = finalizeEvent(inquiryPayload, secretKey);
console.log("署名済みイベントID:", signedEvent.id);

// 4. コモンズ・ネットワークへ送信（マルチパブリッシュ：3つ以上のリレーへ並列送信）
// フェイルセーフ: Promise.allSettled により、一部のリレーが失敗しても他への送信を継続
async function publishToCommons() {
    const targetRelays = [
        'wss://relay.toitoi.cultivationdata.net',            // アンカーリレー（必須）
        'wss://relay.local.toitoi.cultivationdata.net',      // 地域のコモンズリレー
        'wss://relay.damus.io'                               // パブリックリレー（冗長性確保）
    ];

    const results = await Promise.allSettled(
        targetRelays.map(async (url) => {
            const relay = await Relay.connect(url);
            await relay.publish(signedEvent);
            relay.close();
            return url;
        })
    );

    results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
            console.log(`✅ [${targetRelays[i]}] へ送信完了`);
        } else {
            console.error(`❌ [${targetRelays[i]}] への送信失敗:`, result.reason);
        }
    });
}

publishToCommons();
```

---

*このドキュメントはデジタル・アグロエコロジー・コモンズ推進プロジェクトの一環として作成されました。*
*v0.3.0 — 2026年5月*
