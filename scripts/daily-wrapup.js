// daily-wrapup.js — 🌙 오늘 마무리 (21:00 KST)
// 무엇 + 왜 + 측정 포맷

import { sendTelegram } from '../src/telegram.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function getStats() {
  const token = process.env.NOTION_TOKEN;
  const dbId = process.env.NOTION_DATABASE_ID;
  if (!token || !dbId) return { posted: 0, reels: 0, upcoming: [] };

  const today = new Date(); today.setHours(0,0,0,0);
  const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);

  try {
    const [postedRes, upcomingRes] = await Promise.all([
      fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
        body: JSON.stringify({ filter: { and: [
          { property: 'Status', select: { equals: 'Posted' } },
          { property: 'Published At', date: { on_or_after: today.toISOString(), on_or_before: todayEnd.toISOString() } }
        ]}})
      }),
      fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
        body: JSON.stringify({ filter: { property: 'Status', select: { equals: 'Ready' } }, sorts: [{ property: 'Scheduled At', direction: 'ascending' }], page_size: 3 })
      })
    ]);

    const posted = await postedRes.json();
    const upcoming = await upcomingRes.json();

    const postedList = (posted.results || []).map(p => ({
      name: p.properties.Name?.title?.[0]?.plain_text || '',
      mt: p.properties['Media Type']?.select?.name || 'IMAGE'
    }));

    return {
      posted: postedList.length,
      reels: postedList.filter(p => p.mt === 'REELS').length,
      upcoming: (upcoming.results || []).map(p => ({
        name: p.properties.Name?.title?.[0]?.plain_text?.slice(0,25) || '',
        mt: p.properties['Media Type']?.select?.name || 'IMAGE'
      }))
    };
  } catch (e) {
    return { posted: 0, reels: 0, upcoming: [] };
  }
}

async function main() {
  const stats = await getStats();
  const today = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });

  let msg = `🌙 ${today}\n─────────────────\n\n`;
  msg += `📊 오늘 업로드: ${stats.posted}건`;
  if (stats.reels > 0) msg += ` (릴스 ${stats.reels} 포함)`;
  msg += `\n\n`;

  if (stats.upcoming.length > 0) {
    msg += `📅 다음 출시\n`;
    stats.upcoming.forEach(p => {
      const icon = p.mt === 'REELS' ? '🎬' : '📷';
      msg += `   ${icon} ${p.name}\n`;
    });
    msg += `\n`;
  }

  msg += `💡 시스템 정상. 내일도 자동으로 굴러감. 🔥`;

  await sendTelegram(msg);
  console.log(msg);
}

main().catch(e => console.error(e.message));
