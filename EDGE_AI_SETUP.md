# Toitoi エッジ・アーキテクチャ設計書：ローカルAIと「問い」の生成
**バージョン: 1.0**

本ドキュメントは、デジタル・アグロエコロジー・コモンズ「Toitoi」における **ローカルAI・エッジ層（エッジクライアント）** のリファレンス実装ガイドです。

この層は、農地固有の「生データ（センサー値・観察メモ）」を、他者が翻訳可能な「境界対象（バウンダリー・オブジェクト）」としての **『問い（Kind: 11042）』** に変換し、Nostrコモンズ・ネットワークへ送信する役割を担います。

---

## 1. エッジ層の基本思想とセキュリティ原則

1.  **ゼロ・データ・エクスポージャー（生データの完全隠蔽）:**
    土壌水分量、温度の時系列データ、正確な位置情報（GPS）などの生データは、農家のスマートフォンやローカルPC、エッジサーバー（Raspberry Pi等）内に**完全に留め置かれます**。クラウドやリレーサーバーには一切送信しません（知識の囲い込み防止）。
2.  **秘密鍵のローカル管理:**
    Nostrプロトコルの根幹であるアイデンティティ（秘密鍵：`nsec` / `hex`）は、エッジデバイス内のみに保存され、すべてのイベント（問い）は送信前にローカルで暗号署名されます。
3.  **「答え」ではなく「問い」の抽出（Problematizing）:**
    ローカルAIは、データから「明日の朝に灌水せよ」というマニュアル（答え）を導き出すのではなく、「なぜ北側区画の乾きが遅いのか？」という『問い』を導き出すようプロンプト設計されます。

---

## 2. エッジ・パイプラインの構成

ローカルAIクライアントは、以下の4つのパイプラインで動作します。

```text
[生データ] ──(1.収集)──> [ローカルDB] ──(2.LLM解析)──> [『問い』の生成] ──(3.Nostr署名)──> [マルチパブリッシュ(送信)]
```

### 2.1 データ収集フェーズ
*   **IoTセンサー:** 水分、温度、照度などの時系列データをローカル（SQLite等）に保存。
*   **人間の観察:** 農家がアプリに入力した「テキストメモ（例: スギナが増えてきた）」や「写真」。

### 2.2 LLM解析フェーズ（Problematizing）
収集したコンテキストをLLM（ローカルで動く Llama-3-8B や、商用APIの Claude 3.5 Sonnet 等）に渡し、以下のプロンプト制約のもとでJSONを出力させます。

> **[システムプロンプトの例]**
> あなたはアグロエコロジー実践を支援する認知的パートナー（AI）です。提供されたセンサーデータと農家の観察メモを読み解き、「処方箋（答え）」ではなく、農家の生態学的直感を刺激する「関係性についての問い」を生成してください。出力は指定された Toitoi Nostr Schema に準拠した JSON 形式のみとします。

### 2.3 イベント署名フェーズ
出力されたJSONを、`nostr-tools` 等のライブラリを使用してハッシュ化（ID生成）し、農家の秘密鍵でシュノア署名（Schnorr signature）を施します。

### 2.4 マルチパブリッシュ・フェーズ
署名済みのイベントを、コモンズを構成する複数のリレー（アンカーリレー、地域リレー等）へWebSocket（`wss://`）経由で同時に送信します。

---

## 3. 【核心】Toitoi プロトコル仕様：「問いの形式」

このシステムが機能するための最大の要（かなめ）が、Nostr Event (`Kind: 11042`) におけるデータ構造の厳密な定義です。
属地性のジレンマを克服するため、**「文脈（Context）」「関係性（Relationship）」「系譜（Lineage）」** の3層構造でメタデータを定義します。

### 3.1 イベント（Event JSON）の完全なスキーマ

送信される最終的なNostrイベントは以下の構造を満たす必要があります。

```json
{
  "kind": 11042,
  "pubkey": "<農家の公開鍵 (32-bytes hex)>",
  "created_at": <Unix Timestamp>,
  "content": "北側斜面において、土壌の乾きの遅さとスギナの繁茂に相関が見られます。この微気候は天敵群集にどのような影響を与えているでしょうか？",
  "tags": [
    // [必須] コモンズ・ルーティング用（フィルタリングリレー通過用）
    ["t", "agroecology"],

    // 【層1】Context: 属地性の抽象化（生データの代わり）
    ["context", "climate_zone", "warm-temperate"],
    ["context", "soil_type", "volcanic_ash"],

    // 【層2】Relationship: 注目している生態学的関係性
    ["relationship", "microclimate", "weed_flora"],

    // 【層3】Phase: 足場掛け(Scaffolding)の熟達段階
    ["phase", "intermediate"],

    // 【層4】Lineage: 問いの系譜（翻訳の連鎖）※派生・結合時のみ必須
    ["e", "<親イベントID>", "wss://relay.cultivationdata.net", "derived_from"]
  ],
  "id": "<sha256(serialize(event))>",
  "sig": "<schnorr_signature(id, privkey)>"
}
```

---

## 4. `tags` 設計のディープ・リファレンス

バウンダリー・オブジェクト（境界対象）として機能させるため、各タグの役割と推奨ボキャブラリーを厳密に定義します。

### 4.1 `context`（属地性のメタデータ）
生データ（緯度経度、水分%など）の代わりに、その農地の「翻訳的文脈」を分類・抽象化して表現します。これにより、インデクサーは「遠く離れているが、環境が似ている農家」をマッチングさせることができます。

*   **フォーマット:** `["context", "<分類キー>", "<値>"]`
*   **分類キーと推奨語彙（Vocabulary）:**
    *   `climate_zone` (気候帯): `subarctic`(亜寒帯), `cool-temperate`(冷温帯), `warm-temperate`(暖温帯), `subtropical`(亜熱帯)
    *   `soil_type` (土壌): `volcanic_ash`(火山灰土/黒ボク), `alluvial`(沖積土), `sandy`(砂土), `clay`(粘土質), `peat`(泥炭土)
    *   `farming_style` (農法): `no_till`(不耕起), `organic`(有機), `conventional`(慣行)
    *   `crop_family` (対象作物群): `solanaceae`(ナス科), `brassica`(アブラナ科), `legume`(マメ科) 等

### 4.2 `relationship`（観察カテゴリ）
「害虫が出た」という単一の事象ではなく、アグロエコロジーの本質である「要素と要素の相互作用（関係性）」を定義します。このタグが、多様な環境下での共通言語となります。

*   **フォーマット:** `["relationship", "<要素A>", "<要素B>"]`
*   **要素（Element）の推奨語彙:**
    `soil_moisture`(土壌水分), `weed_flora`(雑草相), `pest`(害虫), `natural_enemy`(天敵), `microclimate`(微気候), `soil_microbe`(土壌微生物), `nutrient_cycle`(養分循環)
*   **例:** `["relationship", "microclimate", "weed_flora"]` (微気候と雑草相の関係への問い)

### 4.3 `phase`（熟達の段階：足場掛けのターゲティング）
ヴィゴツキーの最近接発達領域（ZPD）に基づき、この「問い」がどのレベルの農家の直感を刺激するのに適しているかを定義します。

*   **フォーマット:** `["phase", "<レベル>"]`
*   **レベル定義:**
    *   `beginner`: 単一の事象や明示的な観察を促す問い（例：「この区画の土の湿り気はどうですか？」）
    *   `intermediate`: 複数要素のパターン認識を促す問い（例：「水はけの良さと雑草の種類に関係はありますか？」）
    *   `expert`: 生態系全体を俯瞰する高度な直感を言語化した問い（背景関係への移行期）

### 4.4 `e`タグ（Lineage：問いの系譜）
Nostrの標準仕様（NIP-10準拠）を利用し、アクター・ネットワーク理論（ANT）における「翻訳の連鎖」をツリー構造として記録します。**完全に新規の問い（Genesis）の場合、このタグは不要です。**

*   **フォーマット:** `["e", "<親のイベントID>", "<リレーURL>", "<関係性>"]`
*   **関係性（Marker）の定義:**
    *   `derived_from` (派生): 他者の問いを自分の農地（コンテキスト）に適用・翻訳した結果、生じた新たな問い。
    *   `synthesis` (結合): 複数の異なる問いを統合して、新たな一つの仮説（問い）を生み出した場合。（この場合、親となる `e` タグを複数並べます）

---

## 5. 実装例（Node.js / nostr-tools）

ローカルのLLMからJSONが出力された後、それをNostrイベントに署名・送信する最小実装のコード例です。

```javascript
import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools/pure';
import { Relay } from 'nostr-tools/relay';
import WebSocket from 'ws';
global.WebSocket = WebSocket;

// 1. 農家のローカル管理キー（本番環境ではセキュアストレージから読み込む）
const secretKey = generateSecretKey(); 
const pubKey = getPublicKey(secretKey);

// 2. LLMが生成した「問い」のデータ構造
const inquiryPayload = {
    kind: 11042,
    created_at: Math.floor(Date.now() / 1000),
    content: "九州の微気候の問いを当圃場（黒ボク土）で観察したところ、ハコベが優占しました。初期窒素量が関係しているのではないでしょうか？",
    tags: [
        ["t", "agroecology"],
        ["context", "climate_zone", "cool-temperate"],
        ["context", "soil_type", "volcanic_ash"],
        ["relationship", "weed_flora", "nutrient_cycle"],
        ["phase", "intermediate"],
        // 他者の問い（ID: abc123...）から派生したことを記録
        ["e", "abc123def456...", "wss://relay.cultivationdata.net", "derived_from"]
    ]
};

// 3. ローカル環境で暗号署名（ここでIDとsigが生成される）
const signedEvent = finalizeEvent(inquiryPayload, secretKey);
console.log("署名済みイベントID:", signedEvent.id);

// 4. コモンズ・ネットワークへ送信（マルチパブリッシュ）
async function publishToCommons() {
    const targetRelays = [
        'wss://relay.cultivationdata.net', // アンカーリレー
        'wss://relay.local-agri.org'       // 地域のコモンズリレー
    ];

    for (const url of targetRelays) {
        try {
            const relay = await Relay.connect(url);
            await relay.publish(signedEvent);
            console.log(`✅ [${url}] へ送信完了`);
            relay.close();
        } catch (error) {
            console.error(`❌ [${url}] への送信失敗:`, error);
        }
    }
}

publishToCommons();
```
