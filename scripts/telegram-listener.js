// telegram-listener.js — 텔레그램 답장 확인
// 아침 미션(09:00) 이후 네가 "했다"고 답장했는지 확인
// 실행: engagement-bot / daily-wrapup 에서 호출

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, '..', 'data', 'telegram-state.json');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

// ─── 상태 관리 ───────────────────────────────────────
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }
  } catch (e) { /* ignore */ }
  return { lastUpdateId: 0, lastMissionMsgId: null, missionDate: null, missionCompleted: false };
}

function saveState(state) {
  const dir = path.dirname(STATE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ─── 최근 메시지 확인 ────────────────────────────────
export async function checkTelegramReplies(lastMissionMsgId) {
  if (!TELEGRAM_BOT_TOKEN) return { completed: false, reply: null };

  const state = loadState();
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${state.lastUpdateId + 1}&timeout=5`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (!data.ok || !data.result || data.result.length === 0) {
      return { completed: false, reply: null };
    }

    // 최신 updateId 저장
    const maxId = Math.max(...data.result.map(u => u.update_id));
    state.lastUpdateId = maxId;

    // 내 메시지에 대한 답장 찾기
    for (const update of data.result) {
      const msg = update.message;
      if (!msg || !msg.text) continue;

      const replyTo = msg.reply_to_message?.message_id;
      const text = msg.text.trim().toLowerCase();

      // 답장이 아니면 스킵
      if (!replyTo) continue;

      // 내가 보낸 미션 메시지에 답장했는지 확인
      if (lastMissionMsgId && replyTo !== lastMissionMsgId) continue;

      // 완료 키워드 확인
      const completeWords = ['했다', '완료', 'ok', 'ㅇㅋ', '했어', 'done', '네', '응'];
      const isComplete = completeWords.some(w => text.includes(w));

      const result = { completed: isComplete, reply: msg.text };
      saveState(state);
      return result;
    }

    saveState(state);
    return { completed: false, reply: null };
  } catch (e) {
    console.log(`[TelegramListener] Error: ${e.message}`);
    return { completed: false, reply: null };
  }
}

/**
 * 미션 메시지 ID 저장 (아침에 보낸 메시지 추적)
 */
export function saveMissionMessageId(messageId) {
  const state = loadState();
  state.lastMissionMsgId = messageId;
  state.missionDate = new Date().toISOString().split('T')[0];
  state.missionCompleted = false;
  saveState(state);
}

/**
 * 오늘 미션 완료 여부 확인
 */
export function isTodayMissionCompleted() {
  const state = loadState();
  const today = new Date().toISOString().split('T')[0];
  return state.missionDate === today && state.missionCompleted;
}
