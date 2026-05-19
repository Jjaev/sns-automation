#!/usr/bin/env node
/**
 * track-stats.mjs
 * 운영 현황을 Notion/Supabase에서 조회 → JSON 출력
 * GitHub Actions에서 주기적으로 실행
 *
 * Usage: node src/track-stats.mjs
 * Env: NOTION_TOKEN, NOTION_DATABASE_ID, NOTION_CMS_DATABASE_ID, SUPABASE_URL, SUPABASE_SERVICE_KEY
 */

const NT = process.env.NOTION_TOKEN;
const SNS_DB = process.env.NOTION_DATABASE_ID;        // SNS Automation DB
const CMS_DB = process.env.NOTION_CMS_DATABASE_ID;    // CMS DB
const SU = process.env.SUPABASE_URL;
const SK = process.env.SUPABASE_SERVICE_KEY;

const headers = {
  Authorization: `Bearer ${NT}`,
  'Notion-Version': '2022-06-28',
};

async function queryNotionDB(dbId, filter = null) {
  const body = filter ? { filter } : {};
  const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Notion query failed: ${res.status} ${await res.text()}`);
  return (await res.json()).results;
}

async function getSupabaseCount(table) {
  const res = await fetch(`${SU}/rest/v1/${table}?select=count`, {
    headers: {
      apikey: SK,
      Authorization: `Bearer ${SK}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Supabase count failed: ${res.status}`);
  const data = await res.json();
  return data?.[0]?.count ?? 0;
}

async function main() {
  const timestamp = new Date().toISOString();

  // Notion SNS DB stats
  const allPosts = await queryNotionDB(SNS_DB);
  const posted = allPosts.filter(p => p.properties.Status.select?.name === 'Posted').length;
  const ready = allPosts.filter(p => p.properties.Status.select?.name === 'Ready').length;
  const failed = allPosts.filter(p => p.properties.Status.select?.name === 'Failed').length;
  const idea = allPosts.filter(p => p.properties.Status.select?.name === 'Idea').length;

  // Notion CMS DB stats
  const cmsPosts = await queryNotionDB(CMS_DB);
  const cmsPublished = cmsPosts.filter(p => {
    const s = p.properties.Status?.status?.name || p.properties.Status?.select?.name;
    return s === 'Published' || s === 'Done';
  }).length;

  // Supabase stats (gracefully handle missing tables)
  let portfolioCount = 0;
  try { portfolioCount = await getSupabaseCount('portfolio_items'); } catch (e) { console.warn('Supabase portfolio_items not available:', e.message); }
  let postCount = 0;
  try { postCount = await getSupabaseCount('posts'); } catch (e) { console.warn('Supabase posts not available:', e.message); }

  // Instagram stats placeholder (manual update for now)
  const stats = {
    timestamp,
    instagram: {
      account: '@studio_sjw.a',
      posts_auto_uploaded: posted,
      posts_queued: ready,
      followers: null,      // manual
      engagement: null,     // manual
    },
    notion: {
      sns_db_total: allPosts.length,
      sns_posted: posted,
      sns_ready: ready,
      sns_failed: failed,
      sns_idea: idea,
      cms_total: cmsPosts.length,
      cms_published: cmsPublished,
    },
    supabase: {
      portfolio_items: portfolioCount,
      posts: postCount,
    },
    system: {
      uptime_days: Math.round((Date.now() - new Date('2026-05-17').getTime()) / 86400000),
      operational_cost: 0,
    },
  };

  console.log(JSON.stringify(stats, null, 2));
}

main().catch(err => {
  console.error('Stats tracking failed:', err.message);
  process.exit(1);
});
