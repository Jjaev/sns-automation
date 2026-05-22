// engagement-bot.js — IG 상호작용 가이드 (매일 09:00 KST)
//
// 사람이 직접 실행할 수 있는 구체적인 순서로 제공
// 자동 좋아요/댓글 절대 금지 (계정 보호)
//
// 텔레그램 출력 예시:
//   ☀️ 오늘의 미션 (5/22)
//   
//   1. 인스타 앱 실행
//   2. @cafe_seoul 검색
//   3. 최근 게시물 3개 좋아요
//   4. 댓글: "분위기가 너무 좋아보여요! ☕"
//   
//   🎯 오늘 업로드: 12:00 / 18:00

import { sendTelegram } from '../src/telegram.js';

// ─── 타겟 설정 ───────────────────────────────────────
const TARGETS = [
  {
    industry: '카페',
    accounts: [
      { handle: 'cafe_seoul_sample1', note: '홍대 감성카페' },
      { handle: 'cafe_seoul_sample2', note: '연남동 브런치' },
    ],
    comments: [
      '분위기가 너무 좋아보여요! ☕',
      '여기 꼭 가보고 싶었어요~ 사진 너무 예뻐요',
      '메뉴 추천 부탁드려요! 다음에 방문할게요 😊',
    ],
  },
  {
    industry: '뷰티',
    accounts: [
      { handle: 'beauty_sample1', note: '강남 헤어샵' },
      { handle: 'beauty_sample2', note: '피부관리샵' },
    ],
    comments: [
      '스타일 너무 예뻐요! 💇‍♀️',
      '헤어 컬러 너무 잘 어울리세요!',
      '작업 깔끔하네요! 다음에 방문할게요',
    ],
  },
  {
    industry: '피트니스',
    accounts: [
      { handle: 'fit_sample1', note: '헬스 트레이너' },
      { handle: 'fit_sample2', note: '홈트 계정' },
    ],
    comments: [
      '대단하세요! 응원합니다 💪',
      '열정이 느껴져요! 저도 자극 받고 갑니다',
      '꾸준함이 진짜 실력이네요!',
    ],
  },
];

// ─── 오늘의 타겟 선정 ────────────────────────────────
function pickTodaysTargets(count = 3) {
  // 요일 기반 순회
  const dayOfYear = Math.floor(Date.now() / 86400000);
  const shuffled = [];

  for (let i = 0; i < count; i++) {
    const tIdx = (dayOfYear + i) % TARGETS.length;
    const target = TARGETS[tIdx];
    const aIdx = (dayOfYear + i) % target.accounts.length;
    const cIdx = (dayOfYear + i) % target.comments.length;
    shuffled.push({
      industry: target.industry,
      account: target.accounts[aIdx],
      comment: target.comments[cIdx],
    });
  }

  return shuffled;
}

// ─── 메시지 생성 ─────────────────────────────────────
function buildMorningMessage(todays, upcomingPosts) {
  const today = new Date().toLocaleDateString('ko-KR', {
    month: 'long', day: 'numeric', weekday: 'short'
  });

  let msg = `☀️ 오늘의 미션 (${today})\n`;
  msg += `─────────────────\n\n`;

  // 상호작용 미션
  msg += `📌 IG 상호작용 (3분)\n\n`;
  todays.forEach((t, i) => {
    msg += `${i + 1}. 인스타 앱 실행\n`;
    msg += `   → @${t.account.handle} 검색 (${t.account.note})\n`;
    msg += `   → 최근 게시물 3개 좋아요\n`;
    msg += `   → 최신 게시물 댓글:\n`;
    msg += `     "${t.comment}"\n\n`;
  });

  // 오늘 업로드 일정
  if (upcomingPosts && upcomingPosts.length > 0) {
    msg += `🎯 오늘 출시 예정\n`;
    upcomingPosts.forEach(p => {
      msg += `   ${p.time} → ${p.name}\n`;
    });
    msg += `\n`;
  }

  // 마무리
  msg += `💡 꿀팁: 상대방이 내 프로필을 방문하게 됨\n`;
  msg += `   @studio_sjw.a 노출 증가 = 유입 증가\n\n`;
  msg += `✅ 완료되면 아무 답장 없어도 돼!\n`;

  return msg;
}

// ─── Notion에서 오늘 일정 조회 ──────────────────────
async function getTodaysSchedule() {
  const dbId = process.env.NOTION_DATABASE_ID;
  if (!dbId) return [];

  const token = process.env.NOTION_TOKEN;
  if (!token) return [];

  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filter: {
          and: [
            { property: 'Status', select: { equals: 'Ready' } },
            {
              property: 'Scheduled At',
              date: {
                on_or_after: todayStart.toISOString(),
                on_or_before: todayEnd.toISOString(),
              },
            },
          ],
        },
        sorts: [{ property: 'Scheduled At', direction: 'ascending' }],
      }),
    });

    const data = await res.json();
    return data.results.map(p => {
      const name = p.properties.Name?.title?.[0]?.plain_text || '무제';
      const date = p.properties['Scheduled At']?.date?.start;
      const time = date ? new Date(date).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '미지정';
      const mediaType = p.properties['Media Type']?.select?.name || 'IMAGE';
      return { name: name.slice(0, 25), time, mediaType };
    });
  } catch (e) {
    console.log(`[Schedule] Error: ${e.message}`);
    return [];
  }
}

// ─── 메인 ─────────────────────────────────────────────
async function main() {
  console.log('[Engagement Bot] Starting...');

  // 오늘의 타겟 3개 선정
  const todaysTargets = pickTodaysTargets(3);

  // 오늘 일정 조회 (선택)
  const schedule = await getTodaysSchedule();

  // 메시지 빌드
  const message = buildMorningMessage(todaysTargets, schedule);

  // 발송
  const ok = await sendTelegram(message);
  console.log(ok ? '[Engagement Bot] ✅ Sent' : '[Engagement Bot] ❌ Failed');
  console.log(message);
}

main().catch(e => console.error('[Engagement Bot] ERROR:', e.message));
