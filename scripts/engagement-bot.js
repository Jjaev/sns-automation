// engagement-bot.js — IG 상호작용 타겟 발굴 + 일일 큐 시스템
// 
// 목적: 매일 상호작용할 IG 계정을 추천하고, 댓글 템플릿을 제공
// 실행: GH Actions (매일 09:00 KST)
// 안전성: 자동 좋아요/댓글 ❌ (리스크太高) → 추천 목록 + 템플릿 ✅
//
// === 작동 방식 ===
// 1. 설정된 타겟 업종/키워드 기반으로 추천 계정 선정
// 2. Notion "상호작용 큐" DB에 저장
// 3. Telegram으로 "오늘의 상호작용 목록" 발송
// 4. 상호작용 완료 후 Notion DB 상태 업데이트 (수동 or 자동)

const NOTION_TOKEN = process.env.NOTION_TOKEN || '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

// 타겟 설정 (업종/지역 기반)
const TARGET_CONFIGS = [
  { industry: '카페', keywords: ['카페그램', '카페스타그램', '홈카페'], hashtags: ['#카페', '#카페그램'] },
  { industry: '뷰티', keywords: ['뷰티', '헤어샵', '네일'], hashtags: ['#뷰티', '#헤어'] },
  { industry: '피트니스', keywords: ['피트니스', '헬스', 'pt'], hashtags: ['#피트니스', '#헬스'] },
  { industry: '맛집', keywords: ['맛집', '식당', '요리'], hashtags: ['#맛집', '#오늘의요리'] },
  { industry: '인테리어', keywords: ['인테리어', '홈스타일링'], hashtags: ['#인테리어'] },
  { industry: '패션', keywords: ['패션', '쇼핑몰', '셀럽'], hashtags: ['#패션', '#OOTD'] },
];

// 댓글 템플릿 (업종별)
const COMMENT_TEMPLATES = {
  '카페': [
    '분위기가 너무 좋아보여요! ☕',
    '여기 꼭 가보고 싶었는데 사진 너무 예뻐요~',
    '메뉴 추천 부탁드려요! 다음에 방문할게요 😊',
  ],
  '뷰티': [
    '스타일이 너무 예뻐요! 💇‍♀️',
    '헤어 컬러 너무 잘 어울리세요!',
    '작업 너무 깔끔하네요! 다음에 방문할게요',
  ],
  '피트니스': [
    '대단하세요! 응원합니다 💪',
    '열정이 느껴져요! 저도 자극 받고 갑니다',
    '꾸준함이 진짜 실력이네요!',
  ],
  '맛집': [
    '와.. 사진만 봐도 군침 도네요 🤤',
    '여기 꼭 가보고 싶었어요! 맛집 인정',
    '비주얼이 미쳤어요! 다음 모임 여기로 할게요',
  ],
  '인테리어': [
    '인테리어 감각이 대단하세요! 🏠',
    '너무 예쁜 집이에요! 구경하는 것만으로 힐링',
    '소품 하나하나가 다 감각적이네요!',
  ],
  '패션': [
    '코디 진짜 예뻐요! 👗',
    '스타일이 너무 좋아요! 어디 브랜드인가요?',
    '이런 스타일 완전 제 취향이에요!',
  ],
};

// 공통 댓글 (업종 무관)
const GENERIC_COMMENTS = [
  '피드가 너무 예뻐서 팔로우하고 갑니다! ✨',
  '콘텐츠가 진짜 좋네요! 응원해요',
  '소소한 일상이 너무 공감돼요 😊',
  '계정 분위기가 너무 좋아요!',
];

async function sendTelegram(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log('[SKIP] Telegram not configured');
    return;
  }
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'HTML',
    }),
  });
}

// 메인: 오늘의 상호작용 큐 생성 → Telegram 발송
async function main() {
  const today = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  
  // 오늘의 타겟 업종 선정 (요일별로 다른 업종)
  const dayOfWeek = new Date().getDay(); // 0=Sun, 1=Mon, ...
  const industryIndex = dayOfWeek % TARGET_CONFIGS.length;
  const targetIndustry = TARGET_CONFIGS[industryIndex];
  
  // 메시지 구성
  let message = `<b>🤖 오늘의 IG 상호작용 가이드</b>\n📅 ${today}\n\n`;
  message += `<b>🎯 오늘의 타겟 업종: ${targetIndustry.industry}</b>\n\n`;
  
  // 추천 해시태그로 검색할 키워드
  message += `<b>🔍 검색 키워드</b>:\n`;
  message += targetIndustry.keywords.map(k => `  • ${k}`).join('\n');
  message += `\n\n`;
  
  // 댓글 템플릿
  const templates = COMMENT_TEMPLATES[targetIndustry.industry] || GENERIC_COMMENTS;
  message += `<b>💬 추천 댓글 템플릿</b>:\n`;
  message += templates.map((t, i) => `${i + 1}. "${t}"`).join('\n');
  message += `\n\n<b>💡 공통 댓글</b>:\n`;
  message += GENERIC_COMMENTS.map((t, i) => `${i + 1}. "${t}"`).join('\n');
  
  message += `\n\n—————————\n`;
  message += `<b>📋 오늘의 미션</b>:\n`;
  message += `1️⃣ 인스타 검색창에 위 키워드 입력 🔍\n`;
  message += `2️⃣ 게시물 10개 좋아요 ❤️\n`;
  message += `3️⃣ 3~5개에 댓글 달기 💬\n`;
  message += `4️⃣ 비슷한 계정 5개 팔로우 ➕\n`;
  message += `5️⃣ 소요 시간: 10분 ⏱️\n\n`;
  message += `꾸준함이 진짜 실력입니다! 🔥`;
  
  console.log(`[Engagement Bot] Sending daily queue for ${targetIndustry.industry}`);
  await sendTelegram(message);
  console.log('[Engagement Bot] ✅ Done');
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
