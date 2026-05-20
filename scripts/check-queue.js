// check-queue.js — 큐 상태 확인 (auto-refill.yml에서 사용)
// Usage: node scripts/check-queue.js
// Output: JSON { count: number, needsRefill: boolean }

const BASE = 'https://api.notion.com/v1';
const TOKEN = process.env.NOTION_TOKEN;
const DB_ID = process.env.NOTION_DATABASE_ID;

async function main() {
  if (!TOKEN || !DB_ID) {
    console.error(JSON.stringify({ error: 'Missing NOTION_TOKEN or NOTION_DATABASE_ID', count: 0, needsRefill: true }));
    process.exit(1);
  }

  const res = await fetch(`${BASE}/databases/${DB_ID}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filter: { property: 'Status', select: { equals: 'Ready' } },
      page_size: 1,
    }),
  });

  if (!res.ok) {
    console.error(JSON.stringify({ error: `Notion API ${res.status}`, count: 0, needsRefill: true }));
    process.exit(1);
  }

  const data = await res.json();
  const count = data.results?.length || 0;

  // 단순히 count만 출력 (bash에서 파싱)
  console.log(count);
}

main().catch((err) => {
  console.error(JSON.stringify({ error: err.message, count: 0, needsRefill: true }));
  process.exit(1);
});
