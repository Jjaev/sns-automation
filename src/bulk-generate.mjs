#!/usr/bin/env node
/**
 * bulk-generate.mjs — AI 콘텐츠 대량 생성기
 * 
 * DeepSeek AI로 여러 계정/플랫폼용 콘텐츠를 한 번에 생성
 * Notion SNS DB에 Status=Ready로 자동 등록
 * 
 * 사용법:
 *   node src/bulk-generate.mjs                   ← 기본 설정으로 실행
 *   node src/bulk-generate.mjs --count 20        ← 20건 생성
 *   node src/bulk-generate.mjs --accounts a,b    ← 특정 계정만
 *   node src/bulk-generate.mjs --topics "file"   ← topics.json 파일 읽기
 *   node src/bulk-generate.mjs --dry-run         ← Notion 등록 안 함
 * 
 * 환경변수: NOTION_TOKEN, NOTION_DATABASE_ID, DEEPSEEK_API_KEY
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// === 설정 ===
const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions';
const UNSPLASH_ACCESS_KEY = ''; // 선택: 실제 Unsplash API 키 있으면 무작위 이미지 검색

// === 기본 콘텐츠 주제 (계정/플랫폼별) ===
// 10개 카테고리로 다양성 확보 — 팁만 있는 느낌 제거
const TOPIC_CATEGORIES = {
  '교육_꿀팁': [
    'SNS 자동화 시스템 소개',
    'AI가 작성하는 인스타 캡션 예시',
    '자영업자를 위한 SNS 꿀팁',
    'Notion으로 마케팅 관리하는 방법',
    'SNS 대행 vs 자동화 비교',
    '무료로 쓰는 마케팅 도구 5가지',
    '해시태그 전략 완벽 가이드',
    '인스타 피드 꾸미기 팁',
    '고객 반응을 높이는 캡션 작성법',
    '릴스 기획 아이디어 5가지',
    'SNS 운영 시간 70% 줄이는 법',
    '마케팅 성과 측정 방법',
    '브랜드 톤 일관성 유지하기',
    '스토리 활용법 3가지',
    '콘텐츠 캘린더 작성법',
    '인스타그램 프로필 최적화',
    'SNS 광고 vs 유기적 도달',
    '카페 인스타그램 마케팅 전략',
    '디저트 카페 브랜딩 꿀팁',
    '카페 SNS 콘텐츠 아이디어',
    '필라테스 스튜디오 SNS 마케팅',
    '인테리어 브랜드 SNS 마케팅',
    '미용실 SNS 마케팅 전략',
    '음식점 인스타 마케팅 전략',
    'AI 툴 활용 마케팅 사례',
  ],
  '작업과정_비하인드': [
    '오늘의 작업 데스크 셋업',
    '콘텐츠 기획 회의 과정',
    '이미지 편집 비포애프터',
    '캡션 작성하는 실제 모습',
    '자동화 시스템 대시보드 공개',
    '새로운 템플릿 디자인 작업중',
    '스케줄 관리 노하우 공유',
    '피드 레이아웃 고민하는 과정',
    'AI에게 명령어 넣는 스크린샷',
    '작업실 책상 정리 전후',
    '이번주 콘텐츠 준비 현황',
    '하루 루틴 브이로그 스타일',
  ],
  '스튜디오_이야기': [
    'SJ 스튜디오를 시작한 이유',
    '프리랜서에서 스튜디오 창업까지',
    '스튜디오 이름의 의미',
    '첫 고객 후기 감사인사',
    '일하면서 느낀 점',
    '좋은 고객 만나는 법',
    '일과 삶의 균형 찾기',
    '스튜디오 이전 계획',
    '앞으로의 목표와 비전',
    '이번달 느낀 점과 배운 점',
    '일하면서 가장 보람찬 순간',
    '스튜디오 운영 에피소드',
  ],
  '결과물_포트폴리오': [
    '이번주 베스트 포스트 소개',
    '고객 계정 성장 리포트',
    '전후 비교: 팔로워 0에서 100까지',
    '최고 반응 받았던 포스트',
    '이번달 콘텐츠 성과 분석',
    '새로운 디자인 시안 공개',
    '제작한 포트폴리오 모음',
    'A/B 테스트 결과 공유',
    '고객 피드백 소개',
    '캠페인 결과 분석 인사이트',
  ],
  '업계_소식_트렌드': [
    '인스타그램 2026년 업데이트 정리',
    'AI 마케팅 트렌드 리포트',
    '요즘 뜨는 SNS 트렌드',
    '소상공인 지원 정책 소식',
    'SNS 알고리즘 변화 분석',
    '디지털 마케팅 업계 뉴스',
    '생성형 AI 최신 동향',
    '인스타 신기능 사용 후기',
    '마케팅 관련 유용한 사이트 추천',
    '요즘 주목받는 해외 마케팅 사례',
  ],
  '일상_감성': [
    '오늘의 커피와 음악',
    '주말에 다녀온 카페',
    '최근 읽은 책 소개',
    '영감 받은 장소 방문기',
    '일끝나고 즐기는 취미',
    '날씨 좋은 날 창밖 풍경',
    '최근 먹은 맛있는 음식',
    '퇴근길 풍경',
    '주말 브런치 모음',
    '감성 사진 한 컷',
  ],
  '질문_소통': [
    '가장 어려운 SNS 고민은?',
    '어떤 콘텐츠 보고 싶으세요?',
    '하루 SNS에 얼마나 시간 쓰세요?',
    'AI 자동화, 어떻게 생각하세요?',
    '인스타에서 가장 중요한 건?',
    '올해 마케팅 목표는?',
    '어떤 업종 운영하시나요?',
    'SNS 마케팅 예산 얼마나 쓰세요?',
    '요즘 가장 관심있는 주제는?',
    '인스타 게시물 몇 개나 밀려있나요?',
  ],
  '고객_사례_인터뷰': [
    '고객님 인터뷰: SNS 운영 팁',
    '협업 후기: 함께 일한 경험',
    '고객 성공 사례 소개',
    '의뢰인 만족 후기',
    '장기 고객님의 변화 이야기',
  ],
  '도구_추천_리뷰': [
    '요즘 쓰는 AI 툴 3가지',
    'Notion 활용법 꿀팁',
    '무료 디자인 툴 추천',
    '마케터용 브라우저 확장프로그램',
    '업무 효율 높여주는 앱 추천',
    '쓰면 좋은 AI 이미지 생성기',
    '데이터 분석 툴 비교',
    'SNS 관리에 유용한 사이트 모음',
    '콘텐츠 아이디어 얻는 법',
    '추천하는 마케팅 책 3권',
  ],
  '이벤트_프로모션': [
    '무료 SNS 진단 이벤트 안내',
    '신규 의뢰인 할인 프로모션',
    '1주일 무료 체험 안내',
    '지인 추천 이벤트',
    '오픈 기념 특가 안내',
  ],
};

const DEFAULT_TOPICS = {
  'studio_sjw': {
    platform: 'Instagram',
    categories: TOPIC_CATEGORIES,
    // 카테고리별 비율 (합계 100). 다양하게 섞어서 양산형 느낌 제거
    weights: {
      '교육_꿀팁': 20,
      '작업과정_비하인드': 15,
      '스튜디오_이야기': 15,
      '결과물_포트폴리오': 10,
      '업계_소식_트렌드': 10,
      '일상_감성': 10,
      '질문_소통': 8,
      '고객_사례_인터뷰': 5,
      '도구_추천_리뷰': 5,
      '이벤트_프로모션': 2,
    },
    style: 'Korean, authentic and friendly, 100-200 chars, 3-5 hashtags, 반말 허용, 너무 포멀하지 않게',
  },
  'joeslife_kr': {
    platform: 'LinkedIn',
    categories: {
      '전문_인사이트': [
        'SNS 자동화 파이프라인 구축기',
        'Notion CMS로 웹사이트 운영하기',
        '0원으로 시작하는 마케팅 자동화',
        'AI 시대의 SNS 마케팅 전략',
        '개발자가 만든 SNS 자동화 툴',
        '1인 기업의 마케팅 자동화',
        'Notion API 활용 사례',
        'GitHub Actions 24시간 자동화',
        '콘텐츠 마케팅 ROI 계산법',
        '무료 도구로 만드는 자동화 시스템',
      ],
      '경험_회고': [
        '프리랜서에서 스튜디오 창업까지',
        '일하면서 배운 것들',
        '실패에서 배운 교훈',
        '프로젝트 회고: 무엇이 달랐나',
      ],
    },
    weights: { '전문_인사이트': 70, '경험_회고': 30 },
    style: 'Korean, professional yet approachable, 200-500 chars, no hashtags, value-focused',
  },
};

// === AI 캡션 생성 ===
async function generatePostContent(topic, platform, account, style, apiKey) {
  const prompt = `You are a Korean social media manager. Generate a social media post.

Platform: ${platform}
Account: ${account}
Topic: ${topic}

Output format (JSON):
{
  "name": "Post title (Korean, engaging, 15-30 chars)",
  "caption": "Full caption following the style guide",
  "image_description": "Description of an image that would fit this post (for Unsplash search)"
}

Style guide: ${style}

Return ONLY valid JSON. No markdown, no explanation.`;

  const body = {
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 600,
    temperature: 0.8,
  };

  const res = await fetch(DEEPSEEK_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`DeepSeek API error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content?.trim();
  
  // JSON 파싱 (AI가 ```json ```로 감쌀 수도 있음)
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in AI response');
  
  return JSON.parse(jsonMatch[0]);
}

// === 이미지 URL 생성 (다양성 자동 관리) ===
import { pickImage } from './images.js';

async function getImageUrl(description) {
  // images.js의 pickImage() 사용 — Picsum + SJ 이미지 혼합, 중복 최소화
  const result = await pickImage(description || 'business');
  return result.url;
}

// === Notion DB에 등록 ===
async function createNotionPost(post, databaseId, token) {
  const body = {
    parent: { database_id: databaseId },
    properties: {
      Name: { title: [{ text: { content: post.name } }] },
      Caption: { rich_text: [{ text: { content: post.caption } }] },
      'Image URL': { url: post.imageUrl || null },
      Platform: { select: { name: post.platform } },
      Account: { select: { name: post.account } },
      Status: { select: { name: 'Ready' } },
    },
  };

  const res = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion create failed: ${err.slice(0, 200)}`);
  }

  return res.json();
}

// === 가중치 기반 카테고리 선택 ===
function selectWeightedTopics(categories, weights, total) {
  // 카테고리별 할당 개수 계산
  const weightSum = Object.values(weights).reduce((a, b) => a + b, 0);
  const allocation = {};
  for (const [cat, weight] of Object.entries(weights)) {
    const rawCount = (weight / weightSum) * total;
    allocation[cat] = Math.max(1, Math.round(rawCount)); // 최소 1개씩은 뽑도록
  }

  // 각 카테고리에서 토픽을 랜덤 선택 (섞어서)
  const selected = [];
  for (const [cat, count] of Object.entries(allocation)) {
    const pool = categories[cat] || [];
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, Math.min(count, pool.length));
    selected.push(...picked.map((t) => ({ topic: t, category: cat })));
  }

  // 최종 섞기
  return selected.sort(() => Math.random() - 0.5);
}

// === 메인 ===
async function main() {
  const args = process.argv.slice(2);
  const count = parseInt(args.find(a => a.startsWith('--count='))?.split('=')[1] || '10');
  const dryRun = args.includes('--dry-run');
  const accountsArg = args.find(a => a.startsWith('--accounts='))?.split('=')[1];

  const apiKey = process.env.DEEPSEEK_API_KEY;
  const token = process.env.NOTION_TOKEN;
  const dbId = process.env.NOTION_DATABASE_ID;

  // API 키 체크
  if (!apiKey) {
    console.log('⚠️  DEEPSEEK_API_KEY 없음. Notion Caption 필드에 수동 입력 필요.');
    console.log('   AI 생성 없이 topics만 출력합니다.\n');
  }

  // 대상 계정 선별
  const targetAccounts = accountsArg
    ? accountsArg.split(',').map(a => a.trim())
    : Object.keys(DEFAULT_TOPICS);

  console.log(`🚀 AI Bulk Content Generator`);
  console.log(`   대상: ${targetAccounts.join(', ')}`);
  console.log(`   건수: ${count}건`);
  console.log(`   모드: ${dryRun ? '🟡 DRY RUN (Notion 미등록)' : '🟢 LIVE'}`);
  console.log('');

  let totalCreated = 0;
  let totalFailed = 0;

  for (const accountName of targetAccounts) {
    const config = DEFAULT_TOPICS[accountName];
    if (!config) {
      console.log(`⚠️  "${accountName}" 설정 없음. 건너뜀.`);
      continue;
    }

    // 가중치 기반 카테고리 선택 (다양한 콘텐츠 믹스)
    const { platform, categories, weights, style } = config;

    const perAccount = Math.ceil(count / targetAccounts.length);
    const selectedTopics = selectWeightedTopics(categories, weights, perAccount);

    console.log(`\n📌 ${accountName} (${platform}) — ${selectedTopics.length}건 (${Object.keys(categories).length}개 카테고리 믹스)`);

    for (let i = 0; i < selectedTopics.length; i++) {
      const item = selectedTopics[i];
      const topicText = item.topic;
      const category = item.category;
      process.stdout.write(`   [${i + 1}/${selectedTopics.length}] [${category}] "${topicText.slice(0, 20)}..." → `);

      try {
        // AI로 콘텐츠 생성
        let postContent;
        if (apiKey) {
          // 카테고리 정보를 style에 추가해서 AI가 톤 조절
          const enhancedStyle = `${style}\nCategory: ${category} (adjust tone accordingly)`;
          postContent = await generatePostContent(topicText, platform, accountName, enhancedStyle, apiKey);
        } else {
          // AI 키 없으면 기본 템플릿 (카테고리별 톤)
          const tones = {
            '교육_꿀팁': '유용한 꿀팁을 공유하는 포스팅',
            '작업과정_비하인드': '작업 과정을 보여주는 진솔한 포스팅',
            '스튜디오_이야기': '스튜디오 일상을 진솔하게 공유',
            '결과물_포트폴리오': '자랑하고 싶은 결과물 소개',
            '업계_소식_트렌드': '최신 트렌드를 전하는 포스팅',
            '일상_감성': '감성적인 일상 사진과 짧은 글',
            '질문_소통': '팔로워와 소통하는 질문 포스팅',
            '고객_사례_인터뷰': '고객님의 이야기를 소개',
            '도구_추천_리뷰': '유용한 도구를 추천하는 포스팅',
            '이벤트_프로모션': '특별한 이벤트를 안내',
          };
          postContent = {
            name: topicText,
            caption: `${topicText}\n\n${tones[category] || ''}\n\n#SJ스튜디오 #SNS자동화`,
            image_description: `${topicText} ${category}`,
          };
        }

        const imageUrl = await getImageUrl(postContent.image_description || topicText);

        if (!dryRun) {
          await createNotionPost({
            name: postContent.name,
            caption: postContent.caption,
            imageUrl,
            platform,
            account: accountName,
          }, dbId, token);

          totalCreated++;
          console.log(`✅ "${postContent.name.slice(0, 30)}"`);
        } else {
          console.log(`🟡 [DRY RUN] "${postContent.name.slice(0, 30)}"`);
        }
      } catch (err) {
        totalFailed++;
        console.log(`❌ ${err.message.slice(0, 60)}`);
      }

      // API 호출 간격 (rate limit 방지)
      if (apiKey) await new Promise(r => setTimeout(r, 800));
    }
  }

  console.log(`\n📊 완료: ${totalCreated}건 생성, ${totalFailed}건 실패`);
  if (dryRun) {
    console.log('   (DRY RUN — Notion에 등록되지 않음)');
    console.log('   실제 실행: node src/bulk-generate.mjs');
  }
}

main().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
