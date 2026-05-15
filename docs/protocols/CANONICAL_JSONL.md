# Canonical JSONL

## 概要

Toitoi のアーカイブは canonical JSONL ベースの event log format を想定しています。

1行が1イベントを表します。

---

## 目的

canonical archive format は以下を目的としています。

- append-only
- replayable
- protocol-independent
- human-readable
- machine-processable

---

## 基本構造

```json
{
  "id": "event-id",
  "actor": "identifier",
  "timestamp": 1710000000,
  "type": "question",
  "body": {},
  "references": [],
  "signatures": []
}
```

---

## 基本原則

### One Line = One Event

1行が完全なイベントオブジェクトを表します。

---

### Immutable Records

既存レコードは変更されません。

更新や修正は新しいイベントとして追加されます。

---

### Protocol Independence

canonical archive は：

- Nostr 固有フィールド
- ATProto 固有構造
- transport metadata

へ依存しないことを目指します。

---

## 外部プロトコルとの関係

例：

| Canonical Event | Nostr |
|---|---|
| actor | pubkey |
| timestamp | created_at |
| body | content |
| signatures | sig |

この mapping は実装依存であり、将来的に変更される可能性があります。