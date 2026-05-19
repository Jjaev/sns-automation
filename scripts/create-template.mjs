#!/usr/bin/env node
/**
 * create-template.mjs
 * 
 * 판매용 Notion 템플릿 페이지 생성
 * - SNS 콘텐츠 DB 구조를 복제한 템플릿 페이지 생성
 * - 설치 가이드 포함
 * - 공유 가능한 URL 출력
 * 
 * Usage: node scripts/create-template.mjs
 * Env: NOTION_TOKEN, NOTION_DATABASE_ID (source DB to clone schema from)
 */

const NT = process.env.NOTION_TOKEN;
const SOURCE_DB = process.env.NOTION_DATABASE_ID;
const BASE = 'https://api.notion.com/v1';

const headers = {
  Authorization: `Bearer ${NT}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
};

async function notion(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Notion ${method} ${path}: ${res.status} ${data.message || JSON.stringify(data)}`);
  return data;
}

async function main() {
  console.log('🚀 Creating SNS Automation Template...\n');

  // 1. Get source DB schema
  console.log('📡 Fetching source DB schema...');
  const sourceDb = await notion('GET', `/databases/${SOURCE_DB}`);
  const props = sourceDb.properties;

  console.log(`   Source DB: "${sourceDb.title?.[0]?.plain_text || 'SNS Automation'}"`);
  console.log(`   Properties: ${Object.keys(props).length}`);
  
  // 2. Create template as child of the known parent page
  // (Notion internal integration can't create workspace-root pages)
  const PARENT_PAGE_ID = '3658ab04-904c-81ea-b21f-f9a6c0765d5d'; // Woz Dashboard
  
  console.log('\n📄 Creating template page under parent...');
  const templatePage = await notion('POST', '/pages', {
    parent: { type: 'page_id', page_id: PARENT_PAGE_ID },
    icon: { type: 'emoji', emoji: '📋' },
    properties: {
      title: {
        title: [{ text: { content: 'SNS 자동화 시스템 템플릿' } }],
      },
    },
    children: [
      {
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ text: { content: 'SNS 자동화 시스템 — Notion 템플릿' } }],
        },
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ text: { content: '이 템플릿을 내 워크스페이스에 복제하여 사용하세요. 각종 SNS 콘텐츠를 기획·관리·자동 업로드할 수 있습니다.' } }],
        },
      },
      {
        object: 'block',
        type: 'heading_3',
        heading_3: {
          rich_text: [{ text: { content: '📦 포함 항목' } }],
        },
      },
      {
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ text: { content: 'SNS 콘텐츠 데이터베이스 (아래)' } }],
        },
      },
      {
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ text: { content: '설치 가이드 페이지 (오른쪽)' } }],
        },
      },
      {
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ text: { content: 'AI 캡션 자동 생성 연동' } }],
        },
      },
      {
        object: 'block',
        type: 'callout',
        callout: {
          rich_text: [
            { text: { content: '💡 ' } },
            { text: { content: '이 페이지를 통째로 복제한 후, 가이드를 따라 GitHub Actions + Instagram 연동을 설정하세요.' } },
          ],
          color: 'blue_background',
        },
      },
      {
        object: 'block',
        type: 'divider',
        divider: {},
      },
    ],
  });

  const templateId = templatePage.id;
  console.log(`   ✅ Template page created: ${templateId}`);
  console.log(`   🔗 https://notion.so/${templateId.replace(/-/g, '')}`);

  // 4. Create the database inside the template page
  console.log('\n📊 Creating template database...');
  
  // Build database schema from source, but keep it clean for template
  const schema = {};
  const desiredProps = ['Name', 'Status', 'Topic', 'Platform', 'Account', 'Caption', 'Image URL', 'Post Date', 'Scheduled At', 'Published At'];
  
  for (const [key, val] of Object.entries(props)) {
    if (desiredProps.includes(key)) {
      const cleanVal = { type: val.type };
      switch (val.type) {
        case 'title':
        case 'rich_text':
        case 'date':
          cleanVal[val.type] = {};
          break;
        case 'select':
          cleanVal.select = { options: val.select?.options || [] };
          break;
        case 'status':
          cleanVal.status = { options: val.status?.options || [] };
          break;
        case 'url':
          cleanVal.url = {};
          break;
        default:
          // skip complex types for template
          continue;
      }
      schema[key] = cleanVal;
    }
  }

  // Create new database inside template page
  console.log('   Creating database in template page...');
  const newDb = await notion('POST', '/databases', {
    parent: { type: 'page_id', page_id: templateId },
    title: [
      { text: { content: 'SNS 콘텐츠 DB' } },
    ],
    properties: schema,
  });

  console.log(`   ✅ Template DB created: ${newDb.id}`);
  
  // 5. Add setup guide as a child page
  console.log('\n📝 Creating setup guide page...');
  const guidePage = await notion('POST', '/pages', {
    parent: { type: 'page_id', page_id: templateId },
    properties: {
      title: {
        title: [{ text: { content: '🔧 설치 가이드' } }],
      },
    },
    children: [
      {
        object: 'block',
        type: 'heading_2',
        heading_2: { rich_text: [{ text: { content: '설치 방법 (5분)' } }] },
      },
      {
        object: 'block',
        type: 'numbered_list_item',
        numbered_list_item: {
          rich_text: [{ text: { content: 'Step 1: 이 템플릿 페이지를 내 워크스페이스로 복제하세요 (우측 상단 ··· → Duplicate)' } }],
        },
      },
      {
        object: 'block',
        type: 'numbered_list_item',
        numbered_list_item: {
          rich_text: [{ text: { content: 'Step 2: GitHub 저장소 Fork — https://github.com/Jjaev/sns-automation' } }],
        },
      },
      {
        object: 'block',
        type: 'numbered_list_item',
        numbered_list_item: {
          rich_text: [{ text: { content: 'Step 3: Instagram API 토큰 발급 (Meta Developer Console)' } }],
        },
      },
      {
        object: 'block',
        type: 'numbered_list_item',
        numbered_list_item: {
          rich_text: [{ text: { content: 'Step 4: GitHub Secrets에 토큰 등록 (Settings → Secrets → Actions)' } }],
        },
      },
      {
        object: 'block',
        type: 'numbered_list_item',
        numbered_list_item: {
          rich_text: [{ text: { content: 'Step 5: Notion DB에 콘텐츠 등록 → 자동 업로드 확인!' } }],
        },
      },
      {
        object: 'block',
        type: 'divider',
        divider: {},
      },
      {
        object: 'block',
        type: 'callout',
        callout: {
          rich_text: [{ text: { content: '자세한 설치는 구매 시 제공되는 설치 가이드 PDF를 참고하세요.' } }],
          color: 'gray_background',
        },
      },
    ],
  });

  console.log(`   ✅ Guide page created: ${guidePage.id}`);
  
  // 6. Set page icon and cover
  // Note: Notion API doesn't support setting emoji icon via API in all versions
  // Skip for now
  
  console.log('\n✅ Template creation complete!');
  console.log(`\n📋 Template page URL (share this):`);
  console.log(`   https://notion.so/${templateId.replace(/-/g, '')}`);
  console.log(`\n   v=${templateId.replace(/-/g, '')}`);
  console.log(`\n⚠️  Make sure to share the page with "Can duplicate" permission:`);
  console.log(`   1. Open the page in Notion`);
  console.log(`   2. Click "Share" in top right`);
  console.log(`   3. Enable "Share to web"`);
  console.log(`   4. Check "Allow duplicate as template"`);
}

main().catch(err => {
  console.error('❌ Template creation failed:', err.message);
  process.exit(1);
});
