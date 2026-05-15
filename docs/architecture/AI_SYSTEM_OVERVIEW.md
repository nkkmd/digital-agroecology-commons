# Toitoi AI Architecture Specification

**Inquiry-Native Distributed AI for a Digital Agroecology Commons (Version 0.1.0)**

*[日本語は下に続きます]*

This document defines the architectural principles, role structure, and design constraints for AI systems operating within the Toitoi Digital Agroecology Commons.

AI in Toitoi is not defined as an autonomous decision-making authority. It is a distributed inquiry-support infrastructure that amplifies observation, reflection, interpretive diversity, and commons-based knowledge generation.

**Version: 0.1.0** | Status: Draft

---

## 1. Basic Philosophy of AI in Toitoi

### 1.1 AI as Inquiry Transformation Engine

Toitoi is not an AI application. It is an inquiry-driven socio-technical protocol. The role of AI within this protocol must be understood from first principles:

> **AI should open inquiry rather than close it.**

Conventional AI systems are optimized toward finality:

```
Question → Answer
```

Toitoi requires a structurally different model:

```
Observation
  → Inquiry
  → Multiple Interpretations
  → Reflection
  → New Inquiry
```

AI in Toitoi exists to sustain this cycle — not to terminate it.

### 1.2 Foundational Assumptions

All AI design decisions in Toitoi are grounded in the following assumptions:

- Toitoi is fundamentally an inquiry-driven socio-technical protocol.
- Inquiry itself is treated as a Boundary Object.
- AI should support inquiry transformation, not answer finalization.
- Interpretive diversity is a first-class value, not a problem to be resolved.
- Local knowledge and situated practice must remain first-class citizens.

### 1.3 Design Priorities

AI in Toitoi should prioritize:

- inquiry generation
- interpretive plurality
- reflective interaction
- contextual reasoning
- local autonomy
- commons mediation

rather than deterministic answer production.

---

## 2. AI Role Architecture

Toitoi defines four functional AI roles, each corresponding to a distinct phase of the inquiry cycle. These roles may be implemented by separate components, edge models, or federated services. They are not required to reside in a single system.

### 2.1 Inquiry Generation Layer

**Role:** Detect signals that warrant inquiry, and produce candidate questions rather than conclusions.

AI systems operating in this layer may analyze:

- sensor data
- field observations
- farming logs
- ecological signals
- conversations and local notes
- community discussions

in order to detect:

| Signal Type | Examples |
| --- | --- |
| `anomaly` | Sensor values crossing thresholds unexpectedly |
| `tension` | Competing indicators pointing in different directions |
| `contradiction` | Outcomes inconsistent with prior patterns |
| `emergent_pattern` | Novel regularities not previously observed |
| `comparative_difference` | Divergence between neighboring fields or seasons |

The output of this layer is not an answer. It is one or more of the following:

- possible questions
- hypotheses
- reflective prompts
- alternative perspectives
- uncertainty markers

**Example outputs:**

```text
"Why did soil moisture decline despite stable rainfall?"
```

```text
"Why do neighboring farms show different biodiversity recovery patterns?"
```

> **Key principle:** This layer emphasizes exploratory inquiry over optimization. A well-formed question is a more valuable output than a premature conclusion.

---

### 2.2 Inquiry Structuring Layer

**Role:** Transform natural-language observations and questions into structured inquiry objects compatible with the Toitoi Protocol Schema (`TOITOI_PROTOCOL_SCHEMA.md`).

This layer bridges the Boundary Object (Layer 1 of an inquiry event) and the DSL projection (Layer 2). Its responsibilities include:

- Inquiry DSL mapping
- semantic parsing of natural language
- schema alignment with the Nostr event structure (Kind 1042)
- protocol object generation
- Boundary Object construction

**Example transformation:**

Natural language input:
```text
"The soil feels dry even though it rained yesterday."
```

Structured output (partial):
```yaml
observation:
  actor: farmer
  phenomenon: soil_moisture_decline
  uncertainty: medium

question:
  type: causal
  scope: local-field
```

DSL tags generated:
```json
["dsl:model", "m1", "hydrological_model"],
["dsl:var",   "m1", "rainfall",       "independent"],
["dsl:var",   "m1", "soil_moisture",  "dependent"],
["dsl:rel",   "m1", "rainfall",       "soil_moisture"]
```

> **Important:** Structuring is a projection, not a determination. The natural-language inquiry in `content` must always be preserved as the primary representation. The DSL is one possible interpretation — not the authoritative meaning.

**Implementation characteristics:**

- schema-first generation
- constrained decoding
- explainable transformations
- interoperability-focused structures

The goal is to make inquiry shareable, composable, and federatable across the commons.

---

### 2.3 DSL Interpretation Layer

**Role:** Interpret structured inquiry objects through one or more domain models, producing multiple candidate interpretations rather than a single answer.

Toitoi should avoid relying on a single monolithic model. Instead, multiple models may coexist:

| Model Type | Examples |
| --- | --- |
| `local_model` | Trained on a specific farm's history |
| `edge_model` | Runs offline on local hardware |
| `ecological_model` | Specializes in soil-biota interactions |
| `climate_model` | Interprets weather and microclimate signals |
| `community_model` | Reflects regional farming practices |
| `domain_model` | Specializes in a specific crop family or pest regime |

The interpretation flow is:

```
Inquiry DSL
    ↓
Multiple Interpretive Models
    ↓
Interpretive Diversity
```

This architecture preserves:

- contextual variation across farms and regions
- local perspectives and situated knowledge
- epistemic plurality
- domain-specific reasoning

rather than collapsing all interpretation into a single centralized worldview.

---

### 2.4 Difference Generation Layer

**Role:** Treat divergence between interpretations as a source of new inquiry rather than an error to be resolved.

When multiple models produce different interpretations of the same inquiry, the system should generate a meta-inquiry from the divergence itself.

**Example:**

| Model | Interpretation |
| --- | --- |
| Model A | "Irrigation issue" |
| Model B | "Microbial soil shift" |
| Model C | "Change in farming practice" |

Rather than selecting the "correct" interpretation, the system generates:

```text
"Why did interpretations diverge? What does the disagreement reveal?"
```

This divergence becomes a new inquiry event — a `synthesis` in the lineage graph (see `TOITOI_PROTOCOL_SCHEMA.md §2.4`).

This approach is structurally aligned with:

- Boundary Object theory (Star & Griesemer)
- commons-based inquiry
- participatory interpretation
- agroecological complexity

> **Key principle:** The system should preserve disagreement rather than erase it. Interpretive conflict is data.

---

## 3. Recommended AI Topology

### 3.1 Distributed Inquiry Architecture

The recommended topology for Toitoi's AI layer reflects the decentralized nature of the protocol:

```
┌──────────────────────────────┐
│ Human Commons                │
│ Farmers / Researchers        │
└──────────────┬───────────────┘
               ↓
┌──────────────────────────────┐
│ Inquiry Generation Layer     │
│ (§2.1)                       │
└──────────────┬───────────────┘
               ↓
┌──────────────────────────────┐
│ Inquiry Structuring Layer    │
│ (§2.2)                       │
│ Boundary Objects             │
│ DSL Projection               │
└──────────────┬───────────────┘
               ↓
       ┌───────┴────────┐
       ↓                ↓
 Local Models      Shared Models
 (Edge AI)         (Federated)
       ↓                ↓
       └───────┬────────┘
               ↓
    DSL Interpretation Layer (§2.3)
               ↓
    Difference Generation Layer (§2.4)
               ↓
    Commons Reflection / New Inquiry
```

No single node in this topology holds authority over interpretation. Each layer produces outputs that the next layer treats as inputs to further inquiry.

---

## 4. Edge AI Considerations

Toitoi strongly favors local-first AI execution. Edge deployment aligns with the commons principle of community-owned infrastructure and reduces dependency on centralized cloud services.

### 4.1 Desired Characteristics

| Property | Description |
| --- | --- |
| `offline_capable` | Functions without continuous internet connectivity |
| `privacy_preserving` | Does not transmit raw field data externally |
| `low_power_inference` | Suitable for field-deployed hardware |
| `community_owned` | Computation resides with the farmer, not a provider |
| `explainable` | Produces interpretations that can be inspected and questioned |
| `resilient` | Operates independently of central infrastructure failures |

### 4.2 Reference Technologies

The following technologies are considered suitable for edge deployment within Toitoi:

- `llama.cpp` — CPU-optimized LLM inference
- `Ollama` — local model management and serving
- `GGUF` — quantized model format for low-resource environments
- `ONNX Runtime` — cross-platform neural network inference
- `TinyML` — microcontroller-scale machine learning
- `whisper.cpp` — local speech-to-text for voice-recorded observations

### 4.3 Suitable Tasks for Edge AI

Edge AI is especially suitable for the following tasks within Toitoi:

- sensor summarization
- anomaly detection
- field observation processing
- local inquiry generation (§2.1)
- contextual interpretation (§2.3)

---

## 5. Federation Considerations

Toitoi's inquiry objects are structurally compatible with federated knowledge systems. Inquiry events (Kind 1042) may function as:

- shareable semantic units
- federated boundary objects
- distributed reflective artifacts
- commons-native protocol entities

### 5.1 Compatible Federation Protocols

| Protocol | Notes |
| --- | --- |
| `Nostr` | Primary transport layer for Toitoi inquiry events |
| `ActivityPub` | Potential interoperability layer for broader commons |
| `ATProto` | Alternative decentralized protocol |
| `libp2p` | Peer-to-peer transport for resilient local networks |
| `CRDT-based sync` | Conflict-free replication for offline-first scenarios |

### 5.2 Federation Properties

This architecture may enable:

- local autonomy — each node generates and interprets inquiries independently
- distributed governance — no central authority controls interpretation
- asynchronous collaboration — inquiry lineage accumulates across time and geography
- resilient knowledge exchange — the network degrades gracefully under partial connectivity

without requiring centralized AI infrastructure.

---

## 6. Non-Goals

### 6.1 AI as Final Authority

Toitoi must avoid the following pattern:

```
AI = Authority
```

The intended pattern is:

```
AI = Facilitator
```

AI should support reflection, interpretation, comparison, questioning, and dialogue — not replace human ecological judgment. All AI-generated outputs should be treated as inquiry inputs, not conclusions.

### 6.2 Monolithic Optimization

Large centralized models tend to:

- converge toward uniform answers
- suppress ambiguity
- erase contextual differences
- centralize epistemic authority

This conflicts with:

- agroecological diversity
- situated knowledge
- commons-based inquiry
- local interpretation

Toitoi should therefore avoid architectures that optimize for a single universal answer. The system should prioritize plural models, contextual reasoning, interpretive diversity, and local-first operation.

---

## 7. Future Directions

Potential future work areas, subject to community governance (TIPs):

| Area | Description |
| --- | --- |
| Inquiry DSL formalization | Extending the DSL sub-key set (see `TOITOI_PROTOCOL_SCHEMA.md §2.6.7`) |
| Boundary Object schema design | Formalizing the semantics of inquiry as a shared object |
| Protocol-level interoperability | AI output formats compatible across Nostr relays |
| CRDT-based inquiry synchronization | Offline-first inquiry accumulation |
| Multi-model interpretive comparison | Tooling for surfacing and navigating interpretive divergence |
| Inquiry provenance tracking | Lineage graph visualization and analysis |
| Explainable inquiry generation | Human-readable justification for AI-generated questions |
| Ecological knowledge federation | Cross-community inquiry sharing and translation |
| Edge-native inquiry systems | Full inquiry lifecycle on low-power field hardware |
| Reflective AI interaction design | UX patterns for human-AI inquiry dialogue |

These directions should be pursued through community-driven TIPs, consistent with the governance model described in `TOITOI_PROTOCOL_SCHEMA.md §4`.

---

---

# Toitoi AI アーキテクチャ仕様書

**デジタル・アグロエコロジー・コモンズのための問い中心型分散AI（バージョン 0.1.0）**

本ドキュメントは、デジタル・アグロエコロジー・コモンズ「Toitoi」において機能するAIシステムの設計原則・役割構造・設計上の制約を定義するものです。

ToitoiにおけるAIは、自律的な意思決定の権威として定義されるのではありません。観察・省察・解釈の多様性・コモンズに基づく知の生成を増幅する、分散型の問いサポートインフラとして位置づけられます。

**バージョン: 0.1.0** ｜ ステータス: Draft

---

## 1. ToitoiにおけるAIの基本思想

### 1.1 問い変換エンジンとしてのAI

Toitoiはアプリケーションではありません。問いを駆動力とする社会技術的プロトコルです。このプロトコルにおけるAIの役割は、根本から定義し直す必要があります。

> **AIは問いを開くものであり、閉じるものであってはならない。**

従来のAIシステムは、終結に向けて最適化されています：

```
問い → 答え
```

Toitoiが必要とするのは、構造的に異なるモデルです：

```
観察
  → 問い
  → 複数の解釈
  → 省察
  → 新たな問い
```

ToitoiにおけるAIは、このサイクルを持続させるために存在します。終わらせるためではありません。

### 1.2 基本的前提

Toitoiにおけるすべての設計判断は、以下の前提に基づきます：

- Toitoiは本質的に、問いを駆動力とする社会技術的プロトコルである。
- 問いそのものが、バウンダリー・オブジェクトとして扱われる。
- AIは問いの変換を支援するものであり、答えの確定を行うものではない。
- 解釈の多様性は解消すべき問題ではなく、第一級の価値である。
- ローカルな知と実践的文脈は、常に第一級の存在として扱われなければならない。

### 1.3 設計上の優先事項

ToitoiのAIは以下を優先します：

- 問いの生成
- 解釈の複数性
- 省察的な相互作用
- 文脈的推論
- ローカル自律性
- コモンズの媒介

決定論的な答えの生産よりも、これらを優先します。

---

## 2. AIの役割アーキテクチャ

Toitoiは、問いサイクルの各フェーズに対応する4つのAI機能役割を定義します。これらの役割は、独立したコンポーネント・エッジモデル・連合サービスとして実装できます。単一のシステムに集約される必要はありません。

### 2.1 問い生成層（Inquiry Generation Layer）

**役割：** 問いに値するシグナルを検出し、結論ではなく候補となる問いを生成する。

この層で動作するAIシステムが分析する対象：

- センサーデータ
- フィールド観察
- 農作業記録
- 生態系シグナル
- 会話・ローカルノート
- コミュニティ議論

検出するシグナルの種類：

| シグナル種別 | 例 |
| --- | --- |
| `anomaly` | センサー値の予期しない閾値超過 |
| `tension` | 異なる方向を示す競合する指標 |
| `contradiction` | これまでのパターンと矛盾する結果 |
| `emergent_pattern` | これまで観察されなかった新たな規則性 |
| `comparative_difference` | 隣接農地間・季節間の乖離 |

この層の出力は答えではありません。以下のいずれかです：

- 可能性のある問い
- 仮説
- 省察的プロンプト
- 代替的視点
- 不確実性マーカー

**出力例：**

```text
「降水量が安定しているにもかかわらず、なぜ土壌水分が低下したのか？」
```

```text
「なぜ隣接農地では生物多様性の回復パターンが異なるのか？」
```

> **設計原則：** この層は最適化よりも探索的な問いを優先します。よく構造化された問いは、拙速な結論よりも価値の高い出力です。

---

### 2.2 問い構造化層（Inquiry Structuring Layer）

**役割：** 自然言語による観察・問いを、Toitoiプロトコルスキーマ（`TOITOI_PROTOCOL_SCHEMA.md`）と互換性のある構造化された問いオブジェクトに変換する。

この層は、バウンダリー・オブジェクト（問いイベントの第1層）とDSL射影（第2層）を橋渡しします。責務は以下の通りです：

- Inquiry DSLマッピング
- 自然言語の意味的解析
- Nostrイベント構造（Kind 1042）とのスキーマ整合
- プロトコルオブジェクト生成
- バウンダリー・オブジェクト構築

**変換例：**

自然言語入力：
```text
「昨日雨が降ったのに、土が乾いている気がする。」
```

構造化出力（抜粋）：
```yaml
observation:
  actor: farmer
  phenomenon: soil_moisture_decline
  uncertainty: medium

question:
  type: causal
  scope: local-field
```

生成されるDSLタグ：
```json
["dsl:model", "m1", "hydrological_model"],
["dsl:var",   "m1", "rainfall",       "independent"],
["dsl:var",   "m1", "soil_moisture",  "dependent"],
["dsl:rel",   "m1", "rainfall",       "soil_moisture"]
```

> **重要：** 構造化は「決定」ではなく「射影」です。`content` フィールドの自然言語による問いは、常に一次的な表現として保持されなければなりません。DSLはあくまでひとつの解釈モデルであり、権威的な意味ではありません。

**実装上の特性：**

- スキーマファーストな生成
- 制約付きデコーディング
- 説明可能な変換
- 相互運用性を重視した構造

目標は、問いをコモンズ全体で共有可能・合成可能・連合可能にすることです。

---

### 2.3 DSL解釈層（DSL Interpretation Layer）

**役割：** 構造化された問いオブジェクトを1つ以上のドメインモデルで解釈し、単一の答えではなく複数の候補解釈を生成する。

Toitoiは単一のモノリシックモデルへの依存を避けます。代わりに、複数のモデルが共存します：

| モデル種別 | 例 |
| --- | --- |
| `local_model` | 特定の農場の履歴で学習されたモデル |
| `edge_model` | ローカルハードウェア上でオフライン動作するモデル |
| `ecological_model` | 土壌-生物相の相互作用に特化したモデル |
| `climate_model` | 気象・マイクロクライメートのシグナルを解釈するモデル |
| `community_model` | 地域の農業慣行を反映したモデル |
| `domain_model` | 特定の作物族・病害虫に特化したモデル |

解釈のフローは以下の通りです：

```
Inquiry DSL
    ↓
複数の解釈モデル
    ↓
解釈の多様性
```

このアーキテクチャが保全するもの：

- 農場・地域間の文脈的変異
- ローカルな視点と実践的知識
- 認識論的複数性
- ドメイン固有の推論

すべての解釈をひとつの中央集権的な世界観に収斂させるのではなく、これらを守ることが目的です。

---

### 2.4 差異生成層（Difference Generation Layer）

**役割：** 複数の解釈間の乖離を、解消すべきエラーではなく新たな問いの源泉として扱う。

複数のモデルが同一の問いに対して異なる解釈を生成した場合、システムはその乖離から新たなメタ問いを生成します。

**例：**

| モデル | 解釈 |
| --- | --- |
| モデルA | 「灌漑の問題」 |
| モデルB | 「土壌微生物叢の変化」 |
| モデルC | 「農業慣行の変化」 |

「正しい」解釈を選択するのではなく、システムは以下を生成します：

```text
「なぜ解釈が分岐したのか？この不一致が示すものは何か？」
```

この乖離は新たな問いイベントとなり、系譜グラフにおける `synthesis`（統合）として記録されます（`TOITOI_PROTOCOL_SCHEMA.md §2.4` 参照）。

このアプローチは以下と構造的に整合します：

- バウンダリー・オブジェクト理論（Star & Griesemer）
- コモンズに基づく問い探求
- 参加型解釈
- アグロエコロジーの複雑性

> **設計原則：** システムは不一致を消去するのではなく、保全するべきです。解釈の対立はデータです。

---

## 3. 推奨AIトポロジー

### 3.1 分散型問いアーキテクチャ

Toitoiのいずれのノードも、解釈に対する権威を持ちません。各層は次の層が更なる問いへの入力として扱う出力を生産します。

```
┌──────────────────────────────┐
│ ヒューマン・コモンズ           │
│ 農家 / 研究者                 │
└──────────────┬───────────────┘
               ↓
┌──────────────────────────────┐
│ 問い生成層（§2.1）            │
└──────────────┬───────────────┘
               ↓
┌──────────────────────────────┐
│ 問い構造化層（§2.2）          │
│ バウンダリー・オブジェクト     │
│ DSL射影                       │
└──────────────┬───────────────┘
               ↓
       ┌───────┴────────┐
       ↓                ↓
 ローカルモデル     共有モデル
 （エッジAI）      （連合型）
       ↓                ↓
       └───────┬────────┘
               ↓
    DSL解釈層（§2.3）
               ↓
    差異生成層（§2.4）
               ↓
    コモンズの省察 / 新たな問い
```

---

## 4. エッジAIの考慮事項

ToitoiはローカルファーストなAI実行を強く志向します。エッジ展開は、コミュニティが所有するインフラというコモンズ原則と整合し、中央集権的なクラウドサービスへの依存を低減します。

### 4.1 望ましい特性

| 特性 | 説明 |
| --- | --- |
| `offline_capable` | 常時インターネット接続なしに機能する |
| `privacy_preserving` | 生のフィールドデータを外部に送信しない |
| `low_power_inference` | フィールド展開ハードウェアに適合する |
| `community_owned` | 計算リソースがプロバイダーではなく農家の手元にある |
| `explainable` | 点検・問い直しが可能な解釈を生成する |
| `resilient` | 中央インフラの障害から独立して動作する |

### 4.2 参照技術

エッジ展開に適した技術として、以下が候補に挙がります：

- `llama.cpp` — CPU最適化LLM推論
- `Ollama` — ローカルモデルの管理とサービング
- `GGUF` — 低リソース環境向け量子化モデル形式
- `ONNX Runtime` — クロスプラットフォーム推論
- `TinyML` — マイクロコントローラースケールの機械学習
- `whisper.cpp` — 音声観察記録のためのローカル音声認識

### 4.3 エッジAIに適したタスク

Toitoi内でエッジAIが特に適しているタスク：

- センサーデータの要約
- 異常検知
- フィールド観察の処理
- ローカルな問いの生成（§2.1）
- 文脈的解釈（§2.3）

---

## 5. 連合型アーキテクチャの考慮事項

Toitoiの問いオブジェクトは、連合型知識システムと構造的に互換性があります。問いイベント（Kind 1042）は以下として機能しえます：

- 共有可能な意味単位
- 連合型バウンダリー・オブジェクト
- 分散型省察アーティファクト
- コモンズネイティブなプロトコルエンティティ

### 5.1 互換性のある連合プロトコル

| プロトコル | 備考 |
| --- | --- |
| `Nostr` | Toitoi問いイベントの主トランスポート層 |
| `ActivityPub` | より広いコモンズとの相互運用の可能性 |
| `ATProto` | 代替となる分散型プロトコル |
| `libp2p` | 耐障害性のあるローカルネットワーク向けP2Pトランスポート |
| `CRDT-based sync` | オフラインファーストシナリオ向け競合フリー複製 |

### 5.2 連合型アーキテクチャが実現するもの

- **ローカル自律性** — 各ノードが独立して問いを生成・解釈する
- **分散型ガバナンス** — 解釈を支配する中央権威が存在しない
- **非同期的協働** — 問いの系譜が時間と地理を超えて蓄積される
- **耐障害性のある知識交換** — 部分的な接続障害下でもネットワークが機能し続ける

中央集権的なAIインフラを必要とせずに、これらを実現します。

---

## 6. 非目標（Non-Goals）

### 6.1 最終権威としてのAI

Toitoiは以下のパターンを避けなければなりません：

```
AI = 権威
```

意図するパターンは以下です：

```
AI = 媒介者（ファシリテーター）
```

AIは省察・解釈・比較・問いかけ・対話を支援するものであり、人間の生態学的判断を置き換えるものではありません。すべてのAI生成出力は、結論ではなく問いへの入力として扱われるべきです。

### 6.2 モノリシックな最適化

大規模な中央集権型モデルは以下に向かう傾向があります：

- 一様な答えへの収斂
- 曖昧さの抑制
- 文脈的差異の消去
- 認識論的権威の中央集権化

これは以下と相容れません：

- アグロエコロジーの多様性
- 実践的・状況的知識
- コモンズに基づく問い探求
- ローカルな解釈

したがってToitoiは、複数のモデル・文脈的推論・解釈の多様性・ローカルファーストな運用を優先し、単一の普遍的答えに向けた最適化アーキテクチャを避けます。

---

## 7. 今後の方向性

コミュニティガバナンス（TIPs）の対象となる将来の作業領域：

| 領域 | 説明 |
| --- | --- |
| Inquiry DSLの形式化 | DSLサブキーセットの拡張（`TOITOI_PROTOCOL_SCHEMA.md §2.6.7` 参照） |
| バウンダリー・オブジェクトのスキーマ設計 | 共有オブジェクトとしての問いの意味論の形式化 |
| プロトコルレベルの相互運用性 | Nostrリレー間で互換性のあるAI出力フォーマット |
| CRDTに基づく問いの同期 | オフラインファーストな問いの蓄積 |
| マルチモデル解釈比較 | 解釈の乖離を表示・ナビゲートするツール群 |
| 問いの来歴追跡 | 系譜グラフの可視化と分析 |
| 説明可能な問い生成 | AI生成の問いに対する人間可読な根拠の提示 |
| 生態学的知識の連合 | コミュニティ間の問いの共有と翻訳 |
| エッジネイティブな問いシステム | 低消費電力フィールドハードウェア上での問いライフサイクルの完結 |
| 省察的AI対話デザイン | 人間とAIの問い対話のためのUXパターン |

これらの方向性は、`TOITOI_PROTOCOL_SCHEMA.md §4` に記述されたガバナンスモデルに則り、コミュニティ主導のTIPsを通じて追求されます。

---

*本ドキュメントはデジタル・アグロエコロジー・コモンズ推進プロジェクトの一環として作成されました。*
*v0.1.0 — 2026年5月*
