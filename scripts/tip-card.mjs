#!/usr/bin/env node
/**
 * tip-card.mjs — SNS 마케팅 팁 카드 생성기
 * 
 * 사용법:
 *   node scripts/tip-card.mjs                           # 랜덤 카드 1장 생성
 *   node scripts/tip-card.mjs --count 3                  # 3장 생성
 *   node scripts/tip-card.mjs --topic "카페"              # 특정 업종 카드
 *   node scripts/tip-card.mjs --save                     # 저장만 (출력 없이)
 * 
 * 출력: images/tip-card-{timestamp}.png
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '..', 'images');

// 팁 데이터
const TIPS = [
  {
    category: '💡 SNS 꿀팁',
    title: '인스타그램, 언제 올려야 할까?',
    body: '참여율이 가장 높은 시간대는 오전 9-11시, 오후 6-8시입니다. 내 고객이 활동하는 시간을 찾아 게시하세요.',
    tags: '#인스타그램 #SNS마케팅 #소상공인',
  },
  {
    category: '🤖 AI 인사이트',
    title: 'AI가 해시태그를 대신 찾아줍니다',
    body: '최적의 해시태그 30개를 AI가 자동 추천. 업종별, 규모별로 맞춤 전략을 제안합니다. 직접 찾을 필요 없어요.',
    tags: '#AI마케팅 #해시태그 #자동화',
  },
  {
    category: '⏰ 시간 절약',
    title: '하루 10분이면 SNS 운영 끝',
    body: 'Notion에 아이디어만 적어두세요. AI가 캡션을 만들고, 이미지를 고르고, 자동으로 게시합니다.',
    tags: '#시간절약 #SNS자동화 #업무효율',
  },
  {
    category: '📊 데이터 이야기',
    title: '꾸준함이 답이다',
    body: '주 3회 꾸준히 게시하는 계정이 주 1회 게시하는 계정보다 평균 도달률이 2.7배 높습니다. AI가 도와드릴게요.',
    tags: '#데이터 #인스타그램 #꾸준함',
  },
  {
    category: '🎯 타겟 전략',
    title: '내 고객은 인스타에 있을까?',
    body: '한국 인스타그램 사용자의 67%가 20-30대. 카페, 뷰티, 인테리어 업종이라면 반드시 있어야 할 채널입니다.',
    tags: '#타겟마케팅 #소상공인 #인스타',
  },
  {
    category: '💰 비용 비교',
    title: 'SNS 대행, 얼마가 적당할까?',
    body: '전통 에이전시 월 300-500만원 vs AI 자동화 월 29만원. 품질은 비슷하고, 비용은 1/10입니다.',
    tags: '#비용절감 #SNS운영 #AI자동화',
  },
  {
    category: '🏠 업종별 전략',
    title: '카페 인스타, 커피만 올리지 마세요',
    body: '공간 사진, 직원 소개, 원두 스토리, 시즌 메뉴 비하인드. 콘텐츠 다양성이 팔로워를 늘립니다.',
    tags: '#카페마케팅 #인스타팁 #콘텐츠전략',
  },
  {
    category: '📈 성장 전략',
    title: '팔로워보다 중요한 것',
    body: '팔로워 수보다 참여율이 중요합니다. 1,000명의 충성 고객이 10,000명의 유령 팔로워보다 가치 있습니다.',
    tags: '#참여율 #인스타그램 #진짜성장',
  },
  {
    category: '🏠 업종별 전략',
    title: '인테리어 업체라면, 비포/애프터를 보여주세요',
    body: '변화가 눈에 보이는 업종일수록 전후 비교가 강력합니다. 릴스로 30초 영상을 만들어보세요.',
    tags: '#인테리어 #비포애프터 #릴스마케팅',
  },
  {
    category: '💡 SNS 꿀팁',
    title: '댓글에 답변하는 것만으로 알고리즘이 좋아집니다',
    body: '게시 후 1시간 내 댓글에 답변하면 인스타 알고리즘이 콘텐츠를 더 많은 사람에게 노출합니다.',
    tags: '#인스타알고리즘 #댓글 #SNS팁',
  },
  {
    category: '🤖 AI 인사이트',
    title: 'AI는 언제나 일합니다',
    body: '주말, 휴가, 야간에도 AI가 쉬지 않고 콘텐츠를 분석하고 게시합니다. 당신은 쉬는 날에도 인스타가 업데이트됩니다.',
    tags: '#AI자동화 #24시간 #운영',
  },
  {
    category: '📊 데이터 이야기',
    title: '릴스의 힘',
    body: '2026년 인스타그램에서 릴스의 평균 도달률은 피드 포스트보다 3배 높습니다. 릴스를 활용하세요.',
    tags: '#릴스 #인스타그램 #도달률',
  },
];

// 팁을 주제별로 매핑
const TOPIC_TIPS = {
  '카페': [0, 3, 6, 9],
  '인테리어': [0, 4, 8, 9],
  '뷰티': [0, 4, 7, 9],
  '패션': [0, 4, 7, 11],
  '일반': [0, 1, 2, 3, 4, 5, 7, 9, 10, 11],
};

// 카테고리별 뱃지 컬러
const CATEGORY_COLORS = {
  '💡 SNS 꿀팁': { bg: '#6366f1', text: '#ffffff' },
  '🤖 AI 인사이트': { bg: '#8b5cf6', text: '#ffffff' },
  '⏰ 시간 절약': { bg: '#10b981', text: '#ffffff' },
  '📊 데이터 이야기': { bg: '#f59e0b', text: '#ffffff' },
  '🎯 타겟 전략': { bg: '#ec4899', text: '#ffffff' },
  '💰 비용 비교': { bg: '#06b6d4', text: '#ffffff' },
  '🏠 업종별 전략': { bg: '#f97316', text: '#ffffff' },
  '📈 성장 전략': { bg: '#6366f1', text: '#ffffff' },
};

function pickTip(topic) {
  const indices = TOPIC_TIPS[topic] || TOPIC_TIPS['일반'];
  const idx = indices[Math.floor(Math.random() * indices.length)];
  return TIPS[idx];
}

function randomTip() {
  return TIPS[Math.floor(Math.random() * TIPS.length)];
}

function generateHTML(tip) {
  const colors = CATEGORY_COLORS[tip.category] || { bg: '#6366f1', text: '#ffffff' };

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Noto+Sans+KR:wght@400;500;700;900&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      width: 1080px;
      height: 1080px;
      background: linear-gradient(135deg, #0f0f13 0%, #1a1a23 50%, #0f0f13 100%);
      font-family: 'Noto Sans KR', 'Inter', sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    
    .card {
      width: 920px;
      height: 920px;
      background: linear-gradient(160deg, #1a1a23 0%, #24242f 100%);
      border-radius: 48px;
      border: 1px solid rgba(255,255,255,0.08);
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      padding: 60px;
    }
    
    /* Background glow */
    .card::before {
      content: '';
      position: absolute;
      top: -100px;
      right: -100px;
      width: 400px;
      height: 400px;
      background: radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%);
      border-radius: 50%;
    }
    .card::after {
      content: '';
      position: absolute;
      bottom: -100px;
      left: -100px;
      width: 400px;
      height: 400px;
      background: radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%);
      border-radius: 50%;
    }
    
    /* Category badge */
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 20px;
      border-radius: 100px;
      background: ${colors.bg}20;
      border: 1px solid ${colors.bg}40;
      color: ${colors.bg};
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.3px;
      margin-bottom: 32px;
      width: fit-content;
      position: relative;
      z-index: 1;
    }
    
    /* Tip icon */
    .icon-area {
      margin-bottom: 24px;
      position: relative;
      z-index: 1;
    }
    .icon-area svg {
      width: 48px;
      height: 48px;
      color: ${colors.bg};
    }
    
    /* Title */
    .title {
      font-size: 52px;
      font-weight: 900;
      color: #ffffff;
      line-height: 1.2;
      letter-spacing: -1px;
      margin-bottom: 28px;
      position: relative;
      z-index: 1;
    }
    
    /* Body */
    .body {
      font-size: 28px;
      font-weight: 400;
      color: #9ca3af;
      line-height: 1.6;
      letter-spacing: -0.3px;
      flex: 1;
      position: relative;
      z-index: 1;
    }
    
    /* Bottom area */
    .bottom {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 40px;
      border-top: 1px solid rgba(255,255,255,0.06);
      position: relative;
      z-index: 1;
    }
    
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .brand-icon {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 900;
      font-size: 16px;
    }
    .brand-name {
      font-size: 18px;
      font-weight: 700;
      color: #ffffff;
    }
    .brand-name span {
      color: #818cf8;
    }
    
    .tags {
      font-size: 16px;
      color: #4b5563;
      font-weight: 500;
    }
    
    /* Accent line */
    .accent-line {
      position: absolute;
      top: 0;
      left: 60px;
      right: 60px;
      height: 4px;
      background: linear-gradient(90deg, ${colors.bg}, transparent);
      border-radius: 0 0 4px 4px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="accent-line"></div>
    
    <div class="badge">${tip.category}</div>
    
    <div class="title">${tip.title}</div>
    
    <div class="body">${tip.body}</div>
    
    <div class="bottom">
      <div class="brand">
        <div class="brand-icon">S</div>
        <div class="brand-name">SJ<span>.</span>AI</div>
      </div>
      <div class="tags">${tip.tags}</div>
    </div>
  </div>
</body>
</html>`;
}

async function generateCard(tip, outputPath) {
  const html = generateHTML(tip);
  const htmlPath = outputPath.replace('.png', '.html');
  fs.writeFileSync(htmlPath, html, 'utf-8');

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      viewport: { width: 1080, height: 1080 },
      deviceScaleFactor: 2,
    });
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: outputPath, fullPage: true });
    await browser.close();
    // Clean up HTML
    try { fs.unlinkSync(htmlPath); } catch {}
    return outputPath;
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    throw err;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const countIdx = args.indexOf('--count');
  const count = countIdx >= 0 ? parseInt(args[countIdx + 1]) || 1 : 1;
  const topicIdx = args.indexOf('--topic');
  const topic = topicIdx >= 0 ? args[topicIdx + 1] : null;
  const saveOnly = args.includes('--save');

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const results = [];
  for (let i = 0; i < count; i++) {
    const tip = topic ? pickTip(topic) : randomTip();
    const filename = `tip-card-${Date.now()}.png`;
    const outputPath = path.join(OUTPUT_DIR, filename);

    console.log(`[${i + 1}/${count}] Generating: "${tip.title}"`);
    await generateCard(tip, outputPath);
    results.push(outputPath);
    console.log(`  ✅ Saved: ${outputPath}`);
  }

  if (!saveOnly) {
    console.log('\n--- Generated Cards ---');
    results.forEach((r) => console.log(`  ${r}`));
  }
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
