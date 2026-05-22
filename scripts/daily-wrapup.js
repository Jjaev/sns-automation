// daily-wrapup.js — 🌙 오늘 마무리 리포트 (21:00 KST)
//
// 오늘 업로드 현황 + 연속 스트릭 + 내일 예정
// 텔레그램으로 발송

import { sendTelegram } from '../src/telegram.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STREAK_FILE = path.join(__dirname, '..', 'data', 'streak.json');

// ─── 스트릭 관리 ─────────────────────────────────────
function loadStreak() {
  try {
    if (fs.existsSync(STREAK_FILE)) {
      return JSON.parse(fs.readFileSync(STREAK_FILE, 'utf-8'));
    }
  } catch (e) { /* ignore */ }
  return { current: 0, longest: 0, lastDate: null };
}

function saveStreak(streak) {
  const dir = path.dirname(STREAK_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STREAK_FILE, JSON.stringify(streak, null, 2));
}

function updateStreak(hadPostsToday) {
  const streak = loadStreak();
  const today = new Date().toISOString().split('T')[0];

  if (hadPostsToday) {
    if (streak.lastDate === today) {
      // 이미 오늘 업데이트됨
    } else if (streak.lastDate === getYesterday()) {
      streak.current += 1;
    } else {
      streak.current = 1;
    }
    streak.lastDate = today;
    if (streak.current > streak.longest) {
      streak.longest = streak.current;
    }
  }

  saveStreak(streak);
  return streak;
}

function getYesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

// ─── Notion 통계 ──────────────────────────────────────
async function getTodayStats() {
  const token = process.env.NOTION_TOKEN;
  const dbId = process.env.NOTION_DATABASE_ID;
  if (!token || !dbId) return { posted: 0, upcoming: [] };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  try {
    // 오늘 Posted 게시물
    const postedRes = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filter: {
          and: [
            { property: 'Status', select: { equals: 'Posted' } },
            {
              property: 'Published At',
              date: {
                on_or_after: todayStart.toISOString(),
                on_or_before: todayEnd.toISOString(),
              },
            },
          ],
        },
      }),
    });
    const postedData = await postedRes.json();

    // 내일 Ready 게시물
    const tomorrowRes = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
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
                on_or_after: todayEnd.toISOString(),
              },
            },
          ],
        },
        sorts: [{ property: 'Scheduled At', direction: 'ascending' }],
        page_size: 5,
      }),
    });
    const tomorrowData = await tomorrowRes.json();

    const posted = postedData.results || [];
    const tomorrow = tomorrowData.results || [];

    return {
      posted: posted.length,
      postedList: posted.map(p => ({
        name: p.properties.Name?.title?.[0]?.plain_text || '무제',
        mediaType: p.properties['Media Type']?.select?.name || 'IMAGE',
      })),
      upcoming: tomorrow.map(p => ({
        name: p.properties.Name?.title?.[0]?.plain_text || '무제',
        time: p.properties['Scheduled At']?.date?.start
          ? new Date(p.properties['Scheduled At'].date.start).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
          : '09:00',
        mediaType: p.properties['Media Type']?.select?.name || 'IMAGE',
      })),
    };
  } catch (e) {
    console.log(`[WrapUp] Notion error: ${e.message}`);
    return { posted: 0, postedList: [], upcoming: [] };
  }
}

// ─── 메시지 생성 ─────────────────────────────────────
function buildWrapupMessage(stats, streak) {
  const today = new Date().toLocaleDateString('ko-KR', {
    month: 'long', day: 'numeric', weekday: 'short'
  });

  let msg = `🌙 오늘 마무리 (${today})\n`;
  msg += `─────────────────\n\n`;

  // 오늘 업로드
  const reelCount = stats.postedList.filter(p => p.mediaType === 'REELS').length;
  const imgCount = stats.postedList.filter(p => p.mediaType !== 'REELS').length;

  msg += `📊 오늘의 성과\n`;
  msg += `   업로드: ${stats.posted}건`;
  if (reelCount > 0) msg += ` (릴스 ${reelCount} 포함)`;
  msg += `\n`;

  if (streak.current > 0) {
    msg += `   🔥 연속 ${streak.current}일째`;
    if (streak.longest > streak.current) {
      msg += ` (최장: ${streak.longest}일)`;
    }
    msg += `\n`;
  }

  msg += `\n`;

  // 내일 예정
  if (stats.upcoming.length > 0) {
    msg += `📅 내일 출시 예정\n`;
    stats.upcoming.forEach(p => {
      const icon = p.mediaType === 'REELS' ? '🎬' : '📷';
      msg += `   ${icon} ${p.time} → ${p.name.slice(0, 30)}\n`;
    });
    msg += `\n`;
  } else {
    msg += `📅 내일: 등록된 게시물 없음\n\n`;
  }

  // 내일 할 일
  msg += `📍 내일 할 일\n`;
  msg += `   □ 아침 상호작용 가이드 확인 (09:00)\n`;
  msg += `   □ 업로드 결과 확인\n\n`;

  msg += `💪 오늘도 수고했어! 내일도 화이팅 🔥`;

  return msg;
}

// ─── 메인 ─────────────────────────────────────────────
async function main() {
  console.log('[Daily WrapUp] Starting...');

  // 오늘 통계
  const stats = await getTodayStats();

  // 스트릭 업데이트
  const streak = updateStreak(stats.posted > 0);

  // 메시지 빌드
  const message = buildWrapupMessage(stats, streak);

  // 발송
  const ok = await sendTelegram(message);
  console.log(ok ? '[Daily WrapUp] ✅ Sent' : '[Daily WrapUp] ❌ Failed');
  console.log(message);
}

main().catch(e => console.error('[Daily WrapUp] ERROR:', e.message));
