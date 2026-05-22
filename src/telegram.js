// telegram.js — Telegram 알림 공유 유틸
// 모든 워크플로우에서 재사용
// 사용법: import { sendTelegram } from './telegram.js';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

/**
 * 텔레그램 메시지 발송
 * @param {string} message - 보낼 메시지
 * @param {object} [opts] - 옵션
 * @param {boolean} [opts.silent=false] - 알림음 없이 발송
 * @returns {Promise<boolean>} 성공 여부
 */
export async function sendTelegram(message, opts = {}) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log('[Telegram] SKIP: token or chat_id not configured');
    return false;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const body = {
    chat_id: TELEGRAM_CHAT_ID,
    text: message,
    parse_mode: 'HTML',
    disable_notification: !!opts.silent,
    disable_web_page_preview: true,
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.ok) {
      console.error(`[Telegram] FAIL: ${data.description}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[Telegram] ERROR: ${e.message}`);
    return false;
  }
}

/**
 * CLI 직접 실행
 */
if (process.argv[1]?.includes('telegram.js') && process.argv.includes('--test')) {
  const msg = process.argv.find(a => a.startsWith('--msg='))?.replace('--msg=', '') || '🧪 테스트 메시지';
  sendTelegram(msg).then(ok => console.log(ok ? '✅ Sent' : '❌ Failed'));
}
