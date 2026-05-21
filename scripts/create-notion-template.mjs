// SNS 콘텐츠 캘린더 - Notion 무료 템플릿 생성
// GH Actions에서 실행 (valid token 사용)
import fetch from 'node-fetch';

const BASE = 'https://api.notion.com/v1';
const TOKEN = process.env.NOTION_TOKEN;
const DB_ID = process.env.NOTION_DATABASE_ID;

async function main() {
  if (!TOKEN) { console.log('SKIP: no NOTION_TOKEN'); return; }

  const headers = {
    'Authorization': `Bearer ${TOKEN}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  };

  const pageBody = {
    parent: { database_id: DB_ID },
    properties: {
      Name: { title: [{ text: { content: '[템플릿] SNS 콘텐츠 캘린더 (무료)' } }] },
      Caption: { rich_text: [{ text: { content: 'Notion으로 SNS 콘텐츠 기획부터 업로드까지 관리하는 무료 템플릿입니다. 더 자동화된 관리는 studio-sj-agency.vercel.app' } }] },
      Platform: { select: { name: 'Instagram' } },
      Status: { select: { name: 'Template' } },
    },
    children: [
      { object: 'block', type: 'heading_1', heading_1: { rich_text: [{ type: 'text', text: { content: 'SNS 콘텐츠 캘린더 템플릿 (무료)' } }] } },
      { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: 'Notion으로 SNS 콘텐츠를 계획·작성·관리하세요. AI SNS 매니지먼트: studio-sj-agency.vercel.app', link: { url: 'https://studio-sj-agency.vercel.app' } }] } },
      { object: 'block', type: 'divider', divider: {} },

      // Week 1
      { object: 'block', type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '1주차' } }] } },
      { object: 'block', type: 'heading_3', heading_3: { rich_text: [{ type: 'text', text: { content: '월요일' } }] } },
      { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: '주제: ' } }] } },
      { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: '캡션: ' } }] } },
      { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: '해시태그: ' } }] } },
      { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: '이미지: ' } }] } },
      { object: 'block', type: 'to_do', to_do: { rich_text: [{ type: 'text', text: { content: '게시 완료' } }], checked: false } },

      { object: 'block', type: 'heading_3', heading_3: { rich_text: [{ type: 'text', text: { content: '화요일' } }] } },
      { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: '주제: ' } }] } },
      { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: '캡션: ' } }] } },
      { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: '해시태그: ' } }] } },
      { object: 'block', type: 'to_do', to_do: { rich_text: [{ type: 'text', text: { content: '게시 완료' } }], checked: false } },

      { object: 'block', type: 'heading_3', heading_3: { rich_text: [{ type: 'text', text: { content: '수요일' } }] } },
      { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: '주제: ' } }] } },
      { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: '캡션: ' } }] } },
      { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: '해시태그: ' } }] } },
      { object: 'block', type: 'to_do', to_do: { rich_text: [{ type: 'text', text: { content: '게시 완료' } }], checked: false } },

      { object: 'block', type: 'heading_3', heading_3: { rich_text: [{ type: 'text', text: { content: '목요일' } }] } },
      { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: '주제: ' } }] } },
      { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: '캡션: ' } }] } },
      { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: '해시태그: ' } }] } },
      { object: 'block', type: 'to_do', to_do: { rich_text: [{ type: 'text', text: { content: '게시 완료' } }], checked: false } },

      { object: 'block', type: 'heading_3', heading_3: { rich_text: [{ type: 'text', text: { content: '금요일' } }] } },
      { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: '주제: ' } }] } },
      { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: '캡션: ' } }] } },
      { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: '해시태그: ' } }] } },
      { object: 'block', type: 'to_do', to_do: { rich_text: [{ type: 'text', text: { content: '게시 완료' } }], checked: false } },

      { object: 'block', type: 'divider', divider: {} },

      // Results
      { object: 'block', type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: '이번 주 성과' } }] } },
      { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: '좋아요 합계: ' } }] } },
      { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: '팔로워 증가: ' } }] } },
      { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: '도달률: ' } }] } },
      { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: '인기 게시물: ' } }] } },

      { object: 'block', type: 'divider', divider: {} },

      // Footer with CTA
      { object: 'block', type: 'quote', quote: { rich_text: [{ type: 'text', text: { content: 'SNS 운영을 완전 자동화하고 싶으신가요? AI SNS 매니지먼트 서비스를 이용해보세요. Notion에서 관리하고 AI가 작성하고 자동으로 업로드됩니다.', link: { url: 'https://studio-sj-agency.vercel.app' } }] } },
      { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: '무료 SNS 진단 받기: studio-sj-agency.vercel.app' } }] } },
    ],
  };

  const res = await fetch(`${BASE}/pages`, {
    method: 'POST',
    headers,
    body: JSON.stringify(pageBody),
  });
  const data = await res.json();
  if (res.ok) {
    console.log(`OK: Template created → https://notion.so/${data.id.replace(/-/g, '')}`);
  } else {
    console.log(`FAIL: ${data.message || res.status}`);
  }
}

main();
