# Protocol Abstraction

## 概要

Toitoi は現在、主な transport layer として Nostr を利用しています。

しかし内部アーキテクチャは、特定プロトコルへ依存しない構造を目指しています。

目的は：

- 知識アーカイブの長期保存
- protocol portability
- semantic continuity

を、単一プロトコル寿命から切り離すことです。

---

## 設計方針

Toitoi では以下を分離します。

| Layer | Responsibility |
|---|---|
| Canonical Event Model | 内部イベント表現 |
| Transport Protocol | イベント配送 |
| Storage Layer | 永続化 |
| Application Layer | UI / Interaction |

---

## 現在の構成

現在の実装：

- Nostr relay ベース同期
- JSON event transport
- signature-based verification

Nostr は「最初の operational transport layer」として扱われています。

---

## 将来的な可能性

将来的には以下の adapter を探索する可能性があります。

- AT Protocol
- ActivityPub
- local-first synchronization
- file-based exchange

これらは現時点では未実装です。

---

## Canonical Archive

Toitoi は protocol-independent な canonical archive format を目指しています。

これにより：

- replayability
- protocol migration
- long-term preservation
- semantic interoperability

を可能にします。

関連：

- ../protocols/CANONICAL_JSONL.md