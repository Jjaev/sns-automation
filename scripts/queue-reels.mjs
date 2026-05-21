// queue-reels.mjs — 릴스 콘텐츠를 Notion 큐에 추가
// 사용법: node scripts/queue-reels.mjs
// (GH Actions에서 실행되도록 설계, NOTION_TOKEN env var 필요)

import fetch from 'node-fetch';

const BASE = 'https://api.notion.com/v1';

// 릴스 콘텐츠 아이디어 10개
// 각 릴스는: caption(설명) + videoUrl(업로드할 영상 URL)
// ※ 영상은 Supabase Storage 등 공개 URL에 호스팅 필요
const REEL_IDEAS = [
  {
    name: '[릴스] SNS 운영 하루 10분 컷 방법',
    caption: 'SNS 운영에 하루 2시간씩 쓰고 계신가요? AI 자동화 시스템이면 10분이면 끝납니다. Notion에서 확인만 하세요! #SNS자동화 #AI마케팅 #인스타관리 #자영업자팁',
    mediaType: 'REELS',
    shareToFeed: true,
  },
  {
    name: '[릴스] 인스타 팔로워보다 중요한 3가지',
    caption: '팔로워 1만인데 좋아요 10개 vs 팔로워 1천인데 좋아요 100개. 진짜 중요한 건 도달률과 참여율입니다. #인스타그램 #계정성장 #SNS마케팅 #인스타팁',
    mediaType: 'REELS',
    shareToFeed: true,
  },
  {
    name: '[릴스] AI가 SNS 캡션 대신 써준다면?',
    caption: 'AI가 캡션 쓰고, 해시태그 추천하고, 정해진 시간에 자동 업로드. 사람은 Notion에서 확인만 하면 됩니다. 상상이 현실이 된 SNS 자동화! #AI자동화 #SNS운영 #스마트워크',
    mediaType: 'REELS',
    shareToFeed: true,
  },
  {
    name: '[릴스] 자영업자 인스타 절대 하지 말것',
    caption: '이 3가지만 피해도 인스타 팔로워가 늘기 시작합니다. 특히 3번은 많은 분들이 모르고 있어요. #자영업자 #인스타그램 #마케팅팁 #소상공인',
    mediaType: 'REELS',
    shareToFeed: true,
  },
  {
    name: '[릴스] Notion 하나로 SNS 관리하는 법',
    caption: 'Notion을 SNS 관리 센터로 만드는 방법. 고객이 승인하고, AI가 작성하고, 자동으로 업로드됩니다. 한 번 설정하면 평생 쓸 수 있는 시스템! #Notion #노션활용 #SNS자동화',
    mediaType: 'REELS',
    shareToFeed: true,
  },
  {
    name: '[릴스] 월 29만원 SNS 관리 퀄리티',
    caption: '29만원이면 AI가 매일 포스트를 작성하고, 정해진 시간에 업로드까지. 대행사 100만원과 뭐가 다를까요? 똑같은 AI인데 왜 더 비싸게 주고 쓰시나요? #SNS관리대행 #가성비 #AI마케팅',
    mediaType: 'REELS',
    shareToFeed: true,
  },
  {
    name: '[릴스] 인스타 알고리즘 2026 변경사항',
    caption: '2026년 인스타 알고리즘이 바뀌었습니다. 이제 해시태그보다 키워드 캡션이 더 중요해요. 지금 당장 바꿔야 할 인스타 전략! #인스타알고리즘 #SNS전략 #마케팅정보',
    mediaType: 'REELS',
    shareToFeed: true,
  },
  {
    name: '[릴스] SNS 관리 100만원 vs 29만원 차이',
    caption: '똑같은 AI 쓰는데 왜 100만원이랑 29만원이랑 차이가 날까요? 비싼 건 광고비와 인건비일 뿐. 자동화된 시스템이면 29만원이면 충분합니다. #SNS마케팅 #비교분석 #합리적인선택',
    mediaType: 'REELS',
    shareToFeed: true,
  },
  {
    name: '[릴스] 무료로 내 인스타 진단받는 방법',
    caption: '내 인스타 계정, 제대로 운영되고 있는지 궁금하신가요? 프로필 링크에서 3분만에 무료 진단 가능합니다. 계정 도달률, 참여율, 콘텐츠 전략까지 한번에! #무료진단 #인스타분석 #SNS진단',
    mediaType: 'REELS',
    shareToFeed: true,
  },
  {
    name: '[릴스] AI 비서에게 SNS 맡겼더니 생긴 일',
    caption: 'SNS 운영 AI 비서가 대신 해주는데 무슨 일이 생길까요? 시간 80% 절약, 꾸준한 업로드, 데이터 기반 최적화까지. 이제는 선택이 아니라 필수입니다. #AI비서 #SNS자동화 #일잘러',
    mediaType: 'REELS',
    shareToFeed: true,
  },
];

async function main() {
  const TOKEN = process.env.NOTION_TOKEN;
  const DB_ID = process.env.NOTION_DATABASE_ID;
  
  if (!TOKEN || !DB_ID) {
    console.log('SKIP: NOTION_TOKEN or NOTION_DATABASE_ID not set');
    return;
  }

  const headers = {
    'Authorization': `Bearer ${TOKEN}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  };

  let created = 0;
  let skipped = 0;

  for (const reel of REEL_IDEAS) {
    // Check if already in queue (by name)
    const checkBody = {
      filter: {
        property: 'Name',
        title: { equals: reel.name },
      },
      page_size: 1,
    };

    const check = await fetch(`${BASE}/databases/${DB_ID}/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify(checkBody),
    });
    const checkData = await check.json();
    
    if (checkData.results?.length > 0) {
      console.log(`  SKIP (exists): ${reel.name.slice(0, 30)}...`);
      skipped++;
      continue;
    }

    // Create new reel post
    const properties = {
      Name: { title: [{ text: { content: reel.name } }] },
      Caption: { rich_text: [{ text: { content: reel.caption } }] },
      Platform: { select: { name: 'Instagram' } },
      'Media Type': { select: { name: reel.mediaType } },
      'Share to Feed': { checkbox: reel.shareToFeed },
      Status: { select: { name: 'Idea' } },
    };

    // Image URL is required for existing pipeline fallback, use placeholder
    // Real video URL will be added when reel is rendered
    properties['Image URL'] = { url: 'https://picsum.photos/1080/1920?random=reel' };

    const res = await fetch(`${BASE}/pages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ parent: { database_id: DB_ID }, properties }),
    });

    if (res.ok) {
      console.log(`  OK: ${reel.name.slice(0, 30)}...`);
      created++;
    } else {
      const err = await res.json();
      console.log(`  FAIL: ${reel.name.slice(0, 30)}... ${err.message || res.status}`);
    }
  }

  console.log(`\nDone: ${created} created, ${skipped} skipped`);
}

main().catch(e => console.error('ERROR:', e.message));
