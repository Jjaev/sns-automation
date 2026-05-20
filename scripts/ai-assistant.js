// AI 개인 비서 PoC — Notion + Gemini + Telegram
// 매일 아침: 할일 요약 + 체크인 리마인더
// 매일 저녁: 오늘 회고 + 내일 준비
// 구독제 상품 (월 5~10만원)의 MVP

const NOTION_TOKEN = process.env.NOTION_TOKEN || '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

const TASKS_DB_ID = process.env.AI_ASSISTANT_DB_ID || '';

// === Notion: 할일/체크인 읽기 ===
async function fetchCheckins() {
  if (!TASKS_DB_ID || !NOTION_TOKEN) return [];

  const today = new Date().toISOString().split('T')[0];
  const res = await fetch(`https://api.notion.com/v1/databases/${TASKS_DB_ID}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      page_size: 20,
      filter: {
        property: 'Date',
        date: { equals: today }
      }
    })
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results || []).map(p => ({
    id: p.id,
    title: p.properties.Name?.title?.[0]?.plain_text || '할일',
    status: p.properties.Status?.select?.name || '할일',
    priority: p.properties.Priority?.select?.name || '중간',
  }));
}

// === Gemini: AI 브리핑 생성 ===
async function generateBriefing(tasks, mode) {
  // 템플릿 기반 대비책
  const template = (msg) => msg;

  if (!GEMINI_API_KEY) {
    return template(mode === 'morning'
      ? `🌅 좋은 아침입니다! 오늘은 ${tasks.length}개의 할일이 기다리고 있어요.\n\n${tasks.map(t => `• ${t.title}`).join('\n')}\n\n가장 중요한 것부터 하나씩 해봐요! 💪`
      : `🌙 수고하셨습니다! 오늘 하루도 고생 많았어요.\n\n내일을 위해 간단히 오늘을 정리해보는 건 어떨까요? 😊`);
  }

  const taskList = tasks.map(t => `[${t.priority}] ${t.title} (${t.status})`).join('\n');
  const prompt = mode === 'morning'
    ? `You are a warm, encouraging Korean personal assistant. Create a morning briefing based on today's ${tasks.length} tasks. Keep it under 300 chars, in Korean, motivational but practical.\n\nTasks:\n${taskList}`
    : `You are a warm Korean personal assistant. Write an evening check-in message. Ask what they accomplished today and gently remind them to plan tomorrow. Under 300 chars, in Korean.\n\nToday's tasks:\n${taskList}`;

  try {
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
    const res = await fetch(`https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 500 }
      })
    });
    if (res.status === 429) {
      console.log('  ⚠️ Gemini quota exceeded, using template');
      return template(mode === 'morning'
        ? `🌅 오늘의 할일 ${tasks.length}개를 준비했어요. 천천히 하나씩 해결해봐요!`
        : `🌙 하루가 끝나가네요. 내일도 힘내봐요!`);
    }
    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) return text;
    return template(mode === 'morning' ? `🌅 좋은 아침입니다!` : `🌙 안녕히 주무세요!`);
  } catch (err) {
    console.log(`  ⚠️ Gemini failed: ${err.message}, using template`);
    return template(mode === 'morning'
      ? `🌅 오늘의 할일: ${tasks.map(t => t.title).join(', ')}. 파이팅!`
      : `🌙 오늘 수고하셨어요. 내일도 화이팅!`);
  }
}

// === Telegram 전송 ===
async function sendTelegram(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'HTML' })
  });
}

// === 메인 ===
async function main() {
  const mode = process.env.MODE || 'morning'; // 'morning' | 'evening'
  const now = new Date();
  console.log(`🤖 AI Assistant — ${mode} briefing`);
  console.log(`   Time: ${now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);

  // 1. 오늘 할일 가져오기
  const tasks = await fetchCheckins();
  console.log(`   Tasks today: ${tasks.length}`);

  // 2. AI 브리핑 생성
  const briefing = await generateBriefing(tasks, mode);
  console.log(`   Briefing generated (${briefing.length} chars)`);

  // 3. Telegram 발송
  await sendTelegram(briefing);
  console.log(`   ✅ Sent to Telegram`);
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
