#!/usr/bin/env node

/**
 * ai-assistant.mjs
 * 
 * AI 개인 비서 구독제 PoC
 * 
 * 모드:
 *   morning  — 오늘의 할일 요약 (08:00 KST)
 *   evening  — 오늘 체크인 + 내일 제안 (20:00 KST)
 *   weekly   — 주간 리뷰 (일요일 19:00 KST)
 * 
 * 실행: node scripts/ai-assistant.mjs --mode=morning
 * cron: GH Actions (schedule: ai-assistant.yml)
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const DB_ID = process.env.AI_ASSISTANT_DB_ID || '3668ab04-904c-81bb-a258-c261dcc1529d';
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;

const NOTION_BASE = 'https://api.notion.com/v1';
const NOTION_H = {
  'Authorization': `Bearer ${NOTION_TOKEN}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
};

// ===== Notion 헬퍼 =====

async function queryDB(filter) {
  const res = await fetch(`${NOTION_BASE}/databases/${DB_ID}/query`, {
    method: 'POST', headers: NOTION_H,
    body: JSON.stringify(filter),
  });
  if (!res.ok) throw new Error(`Notion query: ${await res.text()}`);
  const data = await res.json();
  return data.results.map(p => ({
    id: p.id,
    task: p.properties.Task?.title?.[0]?.text?.content || '',
    status: p.properties.Status?.select?.name || '',
    priority: p.properties.Priority?.select?.name || '',
    due: p.properties.Due?.date?.start || '',
    category: p.properties.Category?.select?.name || '',
    notes: p.properties.Notes?.rich_text?.[0]?.text?.content || '',
  }));
}

async function createTask({ task, priority = '🔵 보통', status = '해야 함', due, category = '비즈니스', notes = '' }) {
  const body = {
    parent: { database_id: DB_ID },
    properties: {
      'Task': { title: [{ text: { content: task } }] },
      'Status': { select: { name: status } },
      'Priority': { select: { name: priority } },
      'Category': { select: { name: category } },
      'Notes': { rich_text: [{ text: { content: notes } }] },
      'Client': { select: { name: '재욱' } },
    },
  };
  if (due) body.properties['Due'] = { date: { start: due } };
  const res = await fetch(`${NOTION_BASE}/pages`, {
    method: 'POST', headers: NOTION_H,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Notion create: ${await res.text()}`);
  return res.json();
}

async function updateTask(pageId, props) {
  const res = await fetch(`${NOTION_BASE}/pages/${pageId}`, {
    method: 'PATCH', headers: NOTION_H,
    body: JSON.stringify({ properties: props }),
  });
  if (!res.ok) throw new Error(`Notion update: ${await res.text()}`);
  return res.json();
}

// ===== AI 요약 =====

async function aiSummarize(prompt) {
  if (!DEEPSEEK_KEY) return null;
  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are a helpful personal assistant. Analyze tasks and give practical advice. Reply in Korean, concise, max 3 sentences.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || null;
  } catch { return null; }
}

// ===== 텔레그램 전송 =====

async function sendTelegram(msg) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log(msg);
    return;
  }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: msg,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    }),
    signal: AbortSignal.timeout(10000),
  }).catch(() => {});
}

// ===== 모드별 실행 =====

async function morningRoutine() {
  const today = new Date().toISOString().slice(0, 10);
  
  // 오늘 Due인 tasks
  const todayTasks = await queryDB({
    filter: {
      and: [
        { property: 'Due', date: { on_or_before: today } },
        { property: 'Status', select: { does_not_equal: '완료' } },
        { property: 'Status', select: { does_not_equal: '취소' } },
      ],
    },
    sorts: [{ property: 'Priority', direction: 'descending' }],
  });

  // 진행 중인 tasks
  const inProgress = await queryDB({
    filter: { property: 'Status', select: { equals: '진행 중' } },
  });

  let msg = `🌅 *굿모닝! 오늘의 할일*\n\n`;

  if (todayTasks.length > 0) {
    msg += `📋 *오늘 해야 할 일 (${todayTasks.length}건)*\n`;
    todayTasks.slice(0, 10).forEach(t => {
      msg += `  ${t.priority} ${t.task}`;
      if (t.category) msg += ` (${t.category})`;
      msg += '\n';
    });
  } else {
    msg += '✅ 오늘 Due인 할일이 없습니다. 여유로운 하루!\n';
  }

  if (inProgress.length > 0) {
    msg += `\n🔄 *진행 중인 작업 (${inProgress.length}건)*\n`;
    inProgress.slice(0, 5).forEach(t => {
      msg += `  - ${t.task}\n`;
    });
  }

  // AI 추천
  if (todayTasks.length > 0) {
    const prompt = `Today's tasks: ${todayTasks.map(t => `${t.task} (${t.priority})`).join(', ')}. Give priority advice.`;
    const ai = await aiSummarize(prompt);
    if (ai) msg += `\n🧠 *AI 조언:* ${ai}\n`;
  }

  msg += `\n🔗 https://www.notion.so/${DB_ID.replace(/-/g, '')}`;
  await sendTelegram(msg);
  console.log('✅ Morning routine done');
}

async function eveningRoutine() {
  const today = new Date().toISOString().slice(0, 10);

  // 오늘 완료된 tasks
  const completed = await queryDB({
    filter: {
      and: [
        { property: 'Status', select: { equals: '완료' } },
        { property: 'Due', date: { on_or_after: today } },
      ],
    },
  });

  // 남은 tasks
  const remaining = await queryDB({
    filter: {
      and: [
        { property: 'Due', date: { on_or_before: today } },
        { property: 'Status', select: { does_not_equal: '완료' } },
        { property: 'Status', select: { does_not_equal: '취소' } },
      ],
    },
  });

  let msg = `🌙 *하루 마무리 체크인*\n\n`;

  if (completed.length > 0) {
    msg += `✅ *오늘 완료 (${completed.length}건)*\n`;
    completed.slice(0, 10).forEach(t => msg += `  ✔ ${t.task}\n`);
  } else {
    msg += '📝 오늘 완료한 작업이 없습니다.\n';
  }

  if (remaining.length > 0) {
    msg += `\n⏳ *남은 할일 (${remaining.length}건)*\n`;
    remaining.slice(0, 5).forEach(t => msg += `  - ${t.task}\n`);
  }

  // 내일 추천 (DeepSeek)
  if (remaining.length > 0) {
    const prompt = `Remaining tasks: ${remaining.map(t => t.task).join(', ')}. Suggest top 3 priorities for tomorrow.`;
    const ai = await aiSummarize(prompt);
    if (ai) msg += `\n🧠 *내일 추천:* ${ai}\n`;
  }

  msg += `\n🔗 https://www.notion.so/${DB_ID.replace(/-/g, '')}`;
  await sendTelegram(msg);
  console.log('✅ Evening routine done');
}

async function weeklyRoutine() {
  const thisWeek = new Date();
  thisWeek.setDate(thisWeek.getDate() - 7);
  const weekAgo = thisWeek.toISOString().slice(0, 10);

  // 이번주 완료
  const completed = await queryDB({
    filter: {
      and: [
        { property: 'Status', select: { equals: '완료' } },
      ],
    },
  });

  // 미완료
  const pending = await queryDB({
    filter: {
      and: [
        { property: 'Status', select: { does_not_equal: '완료' } },
        { property: 'Status', select: { does_not_equal: '취소' } },
      ],
    },
  });

  // 카테고리별 통계
  const byCategory = {};
  completed.forEach(t => {
    const cat = t.category || '기타';
    byCategory[cat] = (byCategory[cat] || 0) + 1;
  });

  let msg = `📊 *주간 리뷰 (${new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })})\n\n`;
  msg += `✅ 이번주 완료: *${completed.length}건*\n`;
  msg += `⏳ 진행 중: *${pending.length}건*\n\n`;

  if (Object.keys(byCategory).length > 0) {
    msg += `📂 *카테고리별 완료*\n`;
    Object.entries(byCategory).forEach(([cat, count]) => {
      msg += `  ${cat}: ${count}건\n`;
    });
  }

  if (pending.length > 0) {
    msg += `\n📋 *다음주 할일 (${pending.length}건)*\n`;
    pending.slice(0, 8).forEach(t => msg += `  ${t.priority} ${t.task}\n`);
  }

  const prompt = `This week completed ${completed.length} tasks (${Object.entries(byCategory).map(([c,n]) => `${c}:${n}`).join(', ')}). Pending ${pending.length}. Give a brief weekly insight.`;
  const ai = await aiSummarize(prompt);
  if (ai) msg += `\n🧠 *AI 인사이트:* ${ai}\n`;

  msg += `\n🔗 https://www.notion.so/${DB_ID.replace(/-/g, '')}`;
  await sendTelegram(msg);
  console.log('✅ Weekly routine done');
}

// ===== 메인 =====

const args = process.argv.slice(2);
const mode = args.find(a => a.startsWith('--mode='))?.split('=')[1] || 'morning';

switch (mode) {
  case 'morning':  await morningRoutine();  break;
  case 'evening':  await eveningRoutine();  break;
  case 'weekly':   await weeklyRoutine();   break;
  default:         console.log(`Unknown mode: ${mode}`);
}
