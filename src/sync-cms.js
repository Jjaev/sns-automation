// sync-cms.js — Notion CMS → Supabase 자동 동기화
// 
// Notion DB (joeslife CMS) → Supabase posts 테이블로 내용 동기화
// 최신 published posts를 Notion에서 읽어 Supabase에 upsert
// 
// 사용법: node src/sync-cms.js

import { getPosts } from './notion-cms.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const NOTION_CMS_DATABASE_ID = process.env.NOTION_CMS_DATABASE_ID;

async function sync() {
  if (!SUPABASE_URL || !SUPABASE_KEY || !NOTION_CMS_DATABASE_ID) {
    console.error('Missing env vars. Need: SUPABASE_URL, SUPABASE_SERVICE_KEY, NOTION_CMS_DATABASE_ID');
    process.exit(1);
  }

  console.log(`[${new Date().toISOString()}] Syncing Notion CMS → Supabase...`);

  // 1. Notion에서 published posts 읽기
  let posts;
  try {
    posts = await getPosts({ status: 'published', limit: 50 });
    console.log(`  Found ${posts.length} published posts in Notion`);
  } catch (e) {
    console.error(`  Notion fetch failed: ${e.message}`);
    process.exit(1);
  }

  if (posts.length === 0) {
    console.log('  Nothing to sync.');
    return;
  }

  // 2. 각 post를 Supabase에 upsert (slug 기준)
  let ok = 0, fail = 0;
  for (const post of posts) {
    try {
      // Check if exists
      const check = await fetch(
        `${SUPABASE_URL}/rest/v1/posts?slug=eq.${encodeURIComponent(post.slug)}&select=slug`,
        { headers: { 'apiKey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
      );
      const existing = await check.json();
      const method = existing.length > 0 ? 'PATCH' : 'POST';
      const url = existing.length > 0
        ? `${SUPABASE_URL}/rest/v1/posts?slug=eq.${encodeURIComponent(post.slug)}`
        : `${SUPABASE_URL}/rest/v1/posts`;

      const body = {
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt || null,
        body_md: post.body_md || '',
        cover_image_url: post.cover_image_url || null,
        kind: post.kind || 'writing',
        status: 'published',
        tags: post.tags || [],
        published_at: post.published_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'apiKey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(existing.length > 0 ? body : { ...body, created_at: new Date().toISOString() }),
      });

      if (res.ok || res.status === 204) {
        const action = existing.length > 0 ? 'Updated' : 'Created';
        console.log(`  ${action}: ${post.title}`);
        ok++;
      } else {
        const err = await res.text();
        console.log(`  Failed: ${post.title} — ${err.slice(0, 100)}`);
        fail++;
      }
    } catch (e) {
      console.log(`  Error: ${post.title} — ${e.message}`);
      fail++;
    }
  }

  console.log(`\nSync complete: ${ok} ok, ${fail} failed`);
  return { ok, fail };
}

sync().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
