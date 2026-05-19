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
const DEFAULT_TOPICS = {
  'studio_sjw': {
    platform: 'Instagram',
    topics: [
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
      '인스타 알고리즘 2026년 변화',
      '스토리 활용법 3가지',
      'AI 툴 활용 마케팅 사례',
      '소상공인 디지털 전환 이야기',
      '콘텐츠 캘린더 작성법',
      '인스타그램 프로필 최적화',
      'SNS 광고 vs 유기적 도달',
    ],
    style: 'Korean, casual-friendly, 100-200 chars, 3-5 hashtags, emojis OK',
  },
  'joeslife_kr': {
    platform: 'LinkedIn',
    topics: [
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

// === 이미지 URL 생성 (Supabase SJ 워터마크 이미지 풀) ===
const SUPABASE_IMAGES = [
  'gpti-01_2026-05-15_usb-hub-wm.png',
  'gpti-02_2026-05-15_blush-wm.png',
  'gpti-03_2026-05-15_sandwich-wm.png',
  'gpti-04_2026-05-16_open-sandwich-wm.png',
  'gpti-05_2026-05-16_tomato-detail-wm.png',
  'gpti-06_2026-05-16_sandwich-ad-wm.png',
  'gpti-07_2026-05-16_otter-profile-wm.png',
  'gpti-08_2026-05-16_kfood-ad-wm.png',
  'gpti-09_2026-05-16_temple-poster-wm.png',
  'gpti-10_2026-05-16_meal-ad-wm.png',
  'gpti-11_2026-05-16_shop-sale-card-wm.png',
  'gpti-12_2026-05-16_bakery-card-wm.png',
  'gpti-13_2026-05-16_snack-card-wm.png',
];
const SUPABASE_BASE = 'https://ffkranwhkgcwhsgskjgs.supabase.co/storage/v1/object/public/sns-images';

async function getImageUrl(description) {
  // SJ 워터마크 이미지 중 랜덤 선택 (고퀄 브랜드 이미지)
  const file = SUPABASE_IMAGES[Math.floor(Math.random() * SUPABASE_IMAGES.length)];
  return `${SUPABASE_BASE}/${file}`;
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

    const { platform, topics, style } = config;
    // 각 계정별 균등 분배
    const perAccount = Math.ceil(count / targetAccounts.length);
    const selectedTopics = [...topics].sort(() => Math.random() - 0.5).slice(0, perAccount);

    console.log(`\n📌 ${accountName} (${platform}) — ${selectedTopics.length}건`);

    for (let i = 0; i < selectedTopics.length; i++) {
      const topic = selectedTopics[i];
      process.stdout.write(`   [${i + 1}/${selectedTopics.length}] "${topic.slice(0, 25)}..." → `);

      try {
        // AI로 콘텐츠 생성
        let postContent;
        if (apiKey) {
          postContent = await generatePostContent(topic, platform, accountName, style, apiKey);
        } else {
          // AI 키 없으면 기본 템플릿
          postContent = {
            name: topic,
            caption: `${topic}에 관한 포스팅입니다. #자동화 #SNS #마케팅`,
            image_description: topic,
          };
        }

        // 이미지 URL
        const imageUrl = await getImageUrl(postContent.image_description || topic);

        const post = {
          name: postContent.name,
          caption: postContent.caption,
          imageUrl,
          platform,
          account: accountName,
        };

        if (!dryRun) {
          await createNotionPost(post, dbId, token);
          console.log(`✅ "${postContent.name.slice(0, 30)}"`);
        } else {
          console.log(`🟡 [DRY RUN] "${postContent.name.slice(0, 30)}"`);
        }
        totalCreated++;
      } catch (e) {
        console.log(`❌ ${e.message.slice(0, 60)}`);
        totalFailed++;
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
