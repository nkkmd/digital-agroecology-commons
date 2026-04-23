// test_relay.js
const { generateSecretKey, finalizeEvent, Relay } = require('nostr-tools');
const WebSocket = require('ws');
global.WebSocket = WebSocket;

async function test() {
    const relay = await Relay.connect('wss://relay.toitoi.cultivationdata.net');
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
        tags:[],
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