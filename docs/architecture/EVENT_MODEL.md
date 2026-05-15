# Event Model

## 概要

Toitoi は append-only なイベントモデルを中心に設計されています。

問い、観察、応答、注釈などを「変更可能な状態」ではなく、
時系列に蓄積される immutable なイベントとして扱います。

この構造により、以下を可能にします。

- provenance（来歴）の保持
- replayable なアーカイブ
- 分散同期
- protocol portability
- semantic continuity

---

## 基本原則

### Immutable Events

イベントは公開後に変更されません。

修正や更新は、新しいイベントとして追加されます。

---

### Append-Only Structure

アーカイブは append-only なログとして扱われます。

これにより：

- deterministic replay
- offline synchronization
- historical traceability

を可能にします。

---

### Semantic Relationships

イベントは他のイベントを参照できます。

例：

- 問いへの応答
- 観察の補足
- 概念間の意味的リンク

---

## イベント種別

現在想定しているイベントカテゴリ：

| Type | 説明 |
|---|---|
| question | 問い |
| observation | 観察・記録 |
| response | 他イベントへの応答 |
| annotation | 補足情報 |

この一覧は固定ではなく、将来的に変更される可能性があります。

---

## Canonical Representation

Toitoi は内部的に protocol-independent な canonical event structure を目指しています。

Nostr などの外部プロトコルは transport layer として扱われます。

関連：

- ../protocols/CANONICAL_JSONL.md
- PROTOCOL_ABSTRACTION.md