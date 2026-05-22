// telegram-inbox.js — 텔레그램 수신함
// GH Actions가 3시간마다 실행해서 새 메시지를 읽고 저장
// 프랭크가 OpenCode 켜면 inbox.json 읽고 처리

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendTelegram } from '../src/telegram.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INBOX_FILE = path.join(__dirname, '..', 'data', 'inbox.json');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

function loadInbox() {
  try {
    if (fs.existsSync(INBOX_FILE)) return JSON.parse(fs.readFileSync(INBOX_FILE, 'utf-8'));
  } catch (e) { /* ignore */ }
  return { lastUpdateId: 0, messages: [] };
}

function saveInbox(inbox) {
  const dir = path.dirname(INBOX_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(INBOX_FILE, JSON.stringify(inbox, null, 2));
}

async function checkInbox() {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log('[Inbox] SKIP: Telegram not configured');
    return;
  }

  const inbox = loadInbox();
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${inbox.lastUpdateId + 1}&timeout=3`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!data.ok || !data.result) return;

    let newCount = 0;
    for (const update of data.result) {
      const msg = update.message;
      if (!msg || !msg.text) continue;

      // 내가 보낸 메시지는 스킵 (봇 자신)
      if (msg.from?.is_bot) continue;

      // 내 채팅방에서 온 메시지만
      if (msg.chat.id.toString() !== TELEGRAM_CHAT_ID) continue;

      inbox.messages.push({
        id: update.update_id,
        text: msg.text,
        from: msg.from?.first_name || 'unknown',
        date: new Date(msg.date * 1000).toISOString(),
        processed: false
      });
      newCount++;
    }

    // updateId 갱신
    if (data.result.length > 0) {
      inbox.lastUpdateId = Math.max(...data.result.map(u => u.update_id));
    }

    saveInbox(inbox);

    if (newCount > 0) {
      console.log(`[Inbox] ✅ ${newCount}개 새 메시지 저장됨`);
      await sendTelegram(`📬 메시지 ${newCount}개 받았어. 프랭크가 다음에 확인할게.`);
    } else {
      console.log('[Inbox] 새 메시지 없음');
    }
  } catch (e) {
    console.log(`[Inbox] Error: ${e.message}`);
  }
}

// CLI 실행
checkInbox();
