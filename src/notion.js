// notion.js — Notion DB 읽기 / 상태 업데이트
import fetch from 'node-fetch';

const BASE = 'https://api.notion.com/v1';
function headers() {
  return {
    'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  };
}

/**
 * Notion DB에서 Status="Ready"이고 Scheduled At이 지난 포스트들 조회
 */
export async function getReadyPosts(databaseId) {
  const now = new Date().toISOString();
  const body = {
    filter: {
      and: [
        { property: 'Status', select: { equals: 'Ready' } },
        { property: 'Scheduled At', date: { on_or_before: now } },
      ],
    },
    sorts: [{ property: 'Scheduled At', direction: 'ascending' }],
    page_size: 10,
  };

  const res = await fetch(`${BASE}/databases/${databaseId}/query`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion query failed: ${err}`);
  }

  const data = await res.json();
  return data.results.map(page => ({
    id: page.id,
    name: page.properties.Name?.title?.[0]?.plain_text || '',
    caption: page.properties.Caption?.rich_text?.[0]?.plain_text || '',
    imageUrl: page.properties['Image URL']?.url || '',
    platform: page.properties.Platform?.select?.name || 'Instagram',
    scheduledAt: page.properties['Scheduled At']?.date?.start || '',
    status: page.properties.Status?.select?.name || '',
  }));
}

/**
 * 페이지 상태 업데이트
 */
export async function updateStatus(pageId, status) {
  const body = {
    properties: {
      Status: { select: { name: status } },
    },
  };

  const res = await fetch(`${BASE}/pages/${pageId}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion update failed: ${err}`);
  }

  return res.json();
}

/**
 * 새 페이지 생성 (수동 등록용)
 */
export async function createPost({ name, caption, imageUrl, platform = 'Instagram', scheduledAt, status = 'Idea' }) {
  const body = {
    parent: { database_id: process.env.NOTION_DATABASE_ID },
    properties: {
      Name: { title: [{ text: { content: name } }] },
      Caption: { rich_text: [{ text: { content: caption || '' } }] },
      'Image URL': { url: imageUrl || null },
      Platform: { select: { name: platform } },
      Status: { select: { name: status } },
    },
  };

  if (scheduledAt) {
    body.properties['Scheduled At'] = { date: { start: scheduledAt } };
  }

  const res = await fetch(`${BASE}/pages`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion create failed: ${err}`);
  }

  return res.json();
}

// --- CLI 테스트 ---
if (process.argv[1]?.includes('notion') && process.argv.includes('--test')) {
  const posts = await getReadyPosts(process.env.NOTION_DATABASE_ID);
  console.log(`Ready posts found: ${posts.length}`);
  posts.forEach(p => console.log(`  - ${p.name} (${p.platform}) @ ${p.scheduledAt}`));
}
