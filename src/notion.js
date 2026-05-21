// notion.js — Notion DB 읽기 / 상태 업데이트
// 모든 플랫폼과 계정을 DB에서 관리

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
 * Account, Platform 필드 포함해서 리턴
 */
export async function getReadyPosts(databaseId) {
  const now = new Date().toISOString();
  const body = {
    filter: {
      and: [
        { property: 'Status', select: { equals: 'Ready' } },
        {
          or: [
            { property: 'Scheduled At', date: { on_or_before: now } },
            { property: 'Scheduled At', date: { is_empty: true } },
          ],
        },
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
    account: page.properties.Account?.select?.name || '',
    scheduledAt: page.properties['Scheduled At']?.date?.start || '',
    status: page.properties.Status?.select?.name || '',
  }));
}

/**
 * 페이지 상태 업데이트
 */
/**
 * 오늘(UTC 기준) 게시된 포스트 수 조회 (daily limit 용)
 */
export async function getTodayPostCount(databaseId) {
  // Posted count만 필터 (Published At 속성은 DB에 없을 수 있음)
  const body = {
    filter: {
      property: 'Status',
      select: { equals: 'Posted' },
    },
    page_size: 100,
  };

  const res = await fetch(`${BASE}/databases/${databaseId}/query`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Notion daily count query failed: ${errText}`);
  }

  const data = await res.json();
  return data.results ? data.results.length : 0;
}

/**
 * 페이지 Caption 필드 업데이트 (재생성/수정용)
 */
export async function updateCaption(pageId, caption) {
  const body = {
    properties: {
      Caption: { rich_text: [{ text: { content: caption || '' } }] },
    },
  };

  const res = await fetch(`${BASE}/pages/${pageId}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion caption update failed: ${err}`);
  }

  return res.json();
}

export async function updateStatus(pageId, status, opts = {}) {
  // 1. 항상 Status 업데이트 (필수)
  const properties = {
    Status: { select: { name: status } },
  };

  const res = await fetch(`${BASE}/pages/${pageId}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ properties }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion update failed: ${err}`);
  }

  // 2. Published At 업데이트 (선택 — 속성 없으면 에러 로그만)
  if (opts.publishedAt) {
    try {
      const dateProps = { 'Published At': { date: { start: opts.publishedAt } } };
      const dateRes = await fetch(`${BASE}/pages/${pageId}`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({ properties: dateProps }),
      });
      if (!dateRes.ok) {
        const errText = await dateRes.text();
        console.warn(`[WARN] Published At update skipped (property may not exist): ${errText.slice(0, 100)}`);
      }
    } catch (err) {
      console.warn(`[WARN] Published At update error (non-fatal): ${err.message}`);
    }
  }

  return res.json();
}

/**
 * 새 페이지 생성 (수동 등록용, account 지원)
 */
export async function createPost({ name, caption, imageUrl, platform = 'Instagram', account = '', scheduledAt, status = 'Idea' }) {
  const properties = {
    Name: { title: [{ text: { content: name } }] },
    Caption: { rich_text: [{ text: { content: caption || '' } }] },
    'Image URL': { url: imageUrl || null },
    Platform: { select: { name: platform } },
    Account: account ? { select: { name: account } } : undefined,
    Status: { select: { name: status } },
  };

  if (scheduledAt) {
    properties['Scheduled At'] = { date: { start: scheduledAt } };
  }

  // undefined 제거
  const cleanProps = {};
  for (const [k, v] of Object.entries(properties)) {
    if (v !== undefined) cleanProps[k] = v;
  }

  const body = {
    parent: { database_id: process.env.NOTION_DATABASE_ID },
    properties: cleanProps,
  };

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
  posts.forEach(p => console.log(`  - [${p.account}] ${p.name} (${p.platform}) @ ${p.scheduledAt}`));
}
