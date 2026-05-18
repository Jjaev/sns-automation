// notion-cms.js — joeslife Notion CMS 연동 모듈
// joeslife 사이트가 이 모듈로 Notion DB에서 글/포트폴리오 조회
// Supabase posts 테이블과 동일한 인터페이스 제공

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const CMS_DB_ID = process.env.NOTION_CMS_DATABASE_ID; // joeslife CMS DB
const BASE = 'https://api.notion.com/v1';

function headers() {
  return {
    'Authorization': `Bearer ${NOTION_TOKEN}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  };
}

/**
 * Notion CMS DB에서 posts 목록 조회 (Supabase 호환)
 * @param {object} opts - { kind?: 'work'|'writing', status?: 'published'|'draft', limit?: number }
 * @returns {array} posts 배열
 */
export async function getPosts(opts = {}) {
  if (!CMS_DB_ID) throw new Error('NOTION_CMS_DATABASE_ID not set');

  const filters = [];
  if (opts.kind) filters.push({ property: 'Kind', select: { equals: opts.kind } });
  if (opts.status) filters.push({ property: 'Status', select: { equals: opts.status } });

  const body = {
    page_size: opts.limit || 50,
    sorts: [{ property: 'Published At', direction: 'descending' }],
  };
  if (filters.length > 0) {
    body.filter = filters.length === 1 ? filters[0] : { and: filters };
  }

  const res = await fetch(`${BASE}/databases/${CMS_DB_ID}/query`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion CMS query failed: ${err}`);
  }

  const data = await res.json();
  return data.results.map(page => ({
    id: page.id,
    slug: page.properties.Slug?.rich_text?.[0]?.plain_text || page.properties.Name?.title?.[0]?.plain_text?.toLowerCase().replace(/\s+/g, '-') || '',
    title: page.properties.Name?.title?.[0]?.plain_text || '',
    excerpt: page.properties.Excerpt?.rich_text?.[0]?.plain_text || '',
    body_md: page.properties.Body?.rich_text?.[0]?.plain_text || '',
    cover_image_url: page.properties['Cover Image']?.url || null,
    kind: page.properties.Kind?.select?.name || 'writing',
    status: page.properties.Status?.select?.name || 'draft',
    tags: (page.properties.Tags?.multi_select || []).map(t => t.name),
    published_at: page.properties['Published At']?.date?.start || null,
    created_at: page.created_time,
    updated_at: page.last_edited_time,
  }));
}

/**
 * slug로 단일 post 조회
 */
export async function getPostBySlug(slug) {
  const posts = await getPosts({ limit: 50 });
  return posts.find(p => p.slug === slug) || null;
}

/**
 * Supabase posts 테이블 → Notion CMS 마이그레이션용
 * Supabase posts 배열을 받아 Notion DB에 생성
 */
export async function migrateFromSupabase(supabasePosts) {
  if (!CMS_DB_ID) throw new Error('NOTION_CMS_DATABASE_ID not set');

  let ok = 0, fail = 0;
  for (const post of supabasePosts) {
    try {
      const body = {
        parent: { database_id: CMS_DB_ID },
        properties: {
          Name: { title: [{ text: { content: post.title || '' } }] },
          Slug: { rich_text: [{ text: { content: post.slug || '' } }] },
          Excerpt: { rich_text: [{ text: { content: post.excerpt || '' } }] },
          Body: { rich_text: [{ text: { content: post.body_md || '' } }] },
          'Cover Image': { url: post.cover_image_url || null },
          Kind: { select: { name: post.kind || 'writing' } },
          Status: { select: { name: post.status || 'draft' } },
          Tags: { multi_select: (post.tags || []).map(t => ({ name: t })) },
          'Published At': { date: { start: post.published_at || null } },
        },
      };

      const res = await fetch(`${BASE}/pages`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body),
      });

      if (res.ok) {
        console.log(`✅ Migrated: ${post.title}`);
        ok++;
      } else {
        const err = await res.text();
        console.log(`❌ Failed: ${post.title} — ${err.slice(0, 80)}`);
        fail++;
      }
    } catch (e) {
      console.log(`❌ Error: ${post.title} — ${e.message}`);
      fail++;
    }
  }
  console.log(`\nMigration complete: ${ok} ok, ${fail} failed`);
  return { ok, fail };
}

// CLI 실행
if (process.argv[1]?.includes('notion-cms')) {
  const cmd = process.argv[2];
  if (cmd === 'migrate') {
    console.log('Fetching posts from Supabase...');
    // Supabase URL/key는 환경변수로
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      console.error('SUPABASE_URL and SUPABASE_SERVICE_KEY required');
      process.exit(1);
    }
    fetch(`${supabaseUrl}/rest/v1/posts?select=*&order=published_at`, {
      headers: { 'apiKey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    })
    .then(r => r.json())
    .then(posts => migrateFromSupabase(posts))
    .catch(e => console.error('Supabase fetch failed:', e.message));
  } else {
    console.log('Usage: node notion-cms.js migrate');
    console.log('Requires: NOTION_TOKEN, NOTION_CMS_DATABASE_ID, SUPABASE_URL, SUPABASE_SERVICE_KEY');
  }
}
