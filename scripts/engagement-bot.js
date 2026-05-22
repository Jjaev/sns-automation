// engagement-bot.js — ☀️ 오늘 브리핑 (09:00 KST)
// 일정 + 릴스 성과 + 할 일

import { sendTelegram } from '../src/telegram.js';

async function getTodaysPlan() {
  const token = process.env.NOTION_TOKEN;
  const dbId = process.env.NOTION_DATABASE_ID;
  if (!token || !dbId) return { posts: [], yesterdayReach: null };

  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0,0,0,0);

  try {
    const [todayRes, yestRes] = await Promise.all([
      fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filter: {
            and: [
              { property: 'Status', select: { equals: 'Ready' } },
              { property: 'Scheduled At', date: { on_or_after: today.toISOString(), on_or_before: tomorrow.toISOString() } }
            ]
          },
          sorts: [{ property: 'Scheduled At', direction: 'ascending' }]
        })
      }),
      // Look for yesterday's posted reel (for reach data - placeholder)
      Promise.resolve({ json: () => ({ results: [] }) })
    ]);

    const data = await todayRes.json();
    const posts = (data.results || []).map(p => ({
      name: p.properties.Name?.title?.[0]?.plain_text?.slice(0,30) || '',
      mt: p.properties['Media Type']?.select?.name || 'IMAGE',
      time: p.properties['Scheduled At']?.date?.start
        ? new Date(p.properties['Scheduled At'].date.start).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
        : '미지정'
    }));

    return { posts, yesterdayReach: null };
  } catch (e) {
    return { posts: [], yesterdayReach: null };
  }
}

async function main() {
  const plan = await getTodaysPlan();
  const today = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });

  let msg = `☀️ ${today}\n─────────────────\n\n`;

  // 오늘 일정
  if (plan.posts.length > 0) {
    msg += `📤 오늘 출시\n`;
    plan.posts.forEach(p => {
      const icon = p.mt === 'REELS' ? '🎬' : '📷';
      msg += `   ${icon} ${p.time} → ${p.name}\n`;
    });
  } else {
    msg += `📤 오늘: 예정된 게시물 없음\n`;
  }

  // 어제 릴스 데이터 (있으면)
  if (plan.yesterdayReach !== null) {
    msg += `\n📊 어제 릴스: 도달 ${plan.yesterdayReach}회\n`;
  }

  msg += `\n📌 네가 할 일: 없음. 시스템 자동 운전 중.\n`;
  msg += `💬 필요하면 언제든 말 걸어.`;

  const result = await sendTelegram(msg);
  console.log(result ? '[Daily Brief] ✅ Sent' : '[Daily Brief] ❌ Failed');
  console.log(msg);
}

main().catch(e => console.error(e.message));
