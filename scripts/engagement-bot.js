// engagement-bot.js — IG 상호작용 가이드 (매일 09:00 KST)
// 사람이 직접 실행. 자동 좋아요/댓글 금지.
// 타겟 계정은 직접 설정 필요

import { sendTelegram } from '../src/telegram.js';

// ⚠️ 여기에 실제 타겟 계정을 입력하세요
// 예: { handle: 'real_cafe_account', note: '홍대 카페' }
const TARGETS = [
  { industry: '카페', accounts: [], comments: ['분위기가 좋아보여요! ☕', '여기 가보고 싶었어요~'] },
  { industry: '뷰티', accounts: [], comments: ['스타일 예뻐요! 💇‍♀️', '잘 어울리세요!'] },
  { industry: '피트니스', accounts: [], comments: ['대단하세요! 💪', '자극 받고 갑니다'] },
];

function pickTargets(count = 2) {
  const day = Math.floor(Date.now() / 86400000);
  const result = [];
  for (let i = 0; i < count; i++) {
    const t = TARGETS[(day + i) % TARGETS.length];
    if (t.accounts.length === 0) {
      result.push({ industry: t.industry, text: '🔴 타겟 계정 미설정 — engagement-bot.js에서 계정을 입력하세요', comment: '' });
    } else {
      const a = t.accounts[(day + i) % t.accounts.length];
      const c = t.comments[(day + i) % t.comments.length];
      result.push({ industry: t.industry, account: a, comment: c });
    }
  }
  return result;
}

async function main() {
  const targets = pickTargets(2);
  const today = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });

  let msg = `☀️ ${today}\n─────────────────\n\n`;
  msg += `📌 오늘 할 일\n\n`;

  targets.forEach((t, i) => {
    if (t.account) {
      msg += `${i+1}. @${t.account.handle} (${t.account.note})\n`;
      msg += `   좋아요 3개 + 댓글 "${t.comment}"\n\n`;
    } else {
      msg += `${i+1}. ${t.text}\n\n`;
    }
  });

  msg += `💡 왜: 상대방이 내 프로필을 방문 = 자연 노출\n`;
  msg += `📊 측정: 일주일 후 팔로우/방문자 수 변화\n\n`;
  msg += `⏳ 3분이면 끝남. 가볍게!`;

  const result = await sendTelegram(msg);
  console.log(result ? '[Engagement Bot] ✅ Sent' : '[Engagement Bot] ❌ Failed');
  console.log(msg);
}

main().catch(e => console.error(e.message));
