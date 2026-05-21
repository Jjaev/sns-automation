#!/usr/bin/env node
/**
 * tip-poster.mjs — SNS 팁 카드 생성 + 인스타그램 게시
 * 
 * 메인 pipeline(index.js)과 별도로 실행됨.
 * 하루 1회 팁 카드를 생성하여 업로드.
 * 
 * 사용법: node scripts/tip-poster.mjs [--topic "카페"]
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// ===== 팁 데이터 =====
const TIPS = [
  {
    category: '💡 SNS 꿀팁',
    title: '인스타, 언제 올려야 되냐고?',
    body: '내가 새벽에 올린다고 다 보는 거 아님. 보통 아침 9-11시, 퇴근시간 6-8시가 골드타임. 내 고객이 핸드폰 볼 때 올려야 보임.',
    tags: '#인스타그램 #SNS마케팅 #소상공인',
  },
  {
    category: '🤖 AI 인사이트',
    title: '해시태그 30개, AI가 다 찾아줌',
    body: '해시태그 찾겠다고 30분씩 스크롤하는 사람들. 이제 AI가 업종별로 딱 맞는 태그 30개 뽑아줌. 그냥 복붙만 하면 됨.',
    tags: '#AI마케팅 #해시태그 #편하게살자',
  },
  {
    category: '⏰ 시간 절약',
    title: 'SNS에 하루 10분이면 충분함',
    body: 'Notion에 아무거나 적어둬. AI가 캡션 만들고, 사진 고르고, 인스타에 알아서 올려줌. 넌 커피 마시면 됨.',
    tags: '#시간절약 #SNS자동화 #커피한잔',
  },
  {
    category: '📊 데이터 이야기',
    title: '매일 올리는 게 답이다',
    body: '주 3회 꾸준히 올리는 계정이 주 1회 올리는 계정보다 도달률 2.7배 높음. 근데 매일 할 시간이 없지? AI 시켜라.',
    tags: '#데이터 #꾸준함 #AI자동화',
  },
  {
    category: '🎯 타겟 전략',
    title: '내 단골은 인스타 할까?',
    body: '한국 20-30대 10명 중 7명은 인스타 함. 카페, 뷔페, 인테리어, 옷가게 하면 인스타 안 할 이유가 없음.',
    tags: '#타겟마케팅 #소상공인 #당연한거',
  },
  {
    category: '💰 비용 비교',
    title: 'SNS 대행, 보통 300만원인데',
    body: '에이전시에 맡기면 월 300-500만원. 근데 우리는 AI가 하니까 월 29만원. 서비스 똑같음, 가격만 1/10.',
    tags: '#비용절감 #SNS운영 #가성비',
  },
  {
    category: '🏠 업종별 전략',
    title: '카페 인스타에 커피만 올리지 말고',
    body: '공간 사진, 바리스타 얼굴, 원두 썰, 시즌 메뉴 비하인드. 커피 말고도 올릴 거 천지임. 다양하게 올려야 팔로워가 늚.',
    tags: '#카페마케팅 #인스타팁 #콘텐츠',
  },
  {
    category: '📈 성장 전략',
    title: '팔로워 1만보다 단골 100명',
    body: '팔로워 많아봤자 유령이면 소용없음. 진짜 내 가게 올 단골 100명이 가짜 팔로워 1만보다 가치 있음. 참여율이 답이다.',
    tags: '#참여율 #인스타그램 #단골',
  },
  {
    category: '🏠 업종별 전략',
    title: '인테리어 업체는 비포/애프터가 짱',
    body: '리모델링 전후 사진 한 장이 말백마디임. 30초 릴스로 찍어서 올려보셈. 저장률이 차원이 다름.',
    tags: '#인테리어 #비포애프터 #릴스',
  },
  {
    category: '💡 SNS 꿀팁',
    title: '댓글에 답변만 해도 알고리즘이 좋아짐',
    body: '올리고 1시간 안에 댓글에 답변 달면 인스타가 "아 이 계정 활동적이네" 하고 더 띄워줌. 댓글 알림 켜놓셈.',
    tags: '#인스타알고리즘 #댓글 #꿀팁',
  },
  {
    category: '🤖 AI 인사이트',
    title: 'AI는 잠을 안 잔다',
    body: '주말, 야간, 휴가. AI는 안 쉼. 니가 자는 동안에도 포스팅 올라가고 있음. 일어나보면 인스타 업데이트 되어있음.',
    tags: '#AI자동화 #24시간 #휴가',
  },
  {
    category: '📊 데이터 이야기',
    title: '릴스 안 찍으면 손해임',
    body: '인스타가 요즘 릴스 밀어줌. 일반 포스트보다 도달률 3배 높음. 릴스 찍기 귀찮아도 해야 됨. AI가 도와준다고.',
    tags: '#릴스 #인스타그램 #밀어준다',
  },
];

const CATEGORY_COLORS = {
  '💡 SNS 꿀팁': { bg: '#6366f1' },
  '🤖 AI 인사이트': { bg: '#8b5cf6' },
  '⏰ 시간 절약': { bg: '#10b981' },
  '📊 데이터 이야기': { bg: '#f59e0b' },
  '🎯 타겟 전략': { bg: '#ec4899' },
  '💰 비용 비교': { bg: '#06b6d4' },
  '🏠 업종별 전략': { bg: '#f97316' },
  '📈 성장 전략': { bg: '#6366f1' },
};

function pickTip(topic) {
  if (topic) {
    const lower = topic.toLowerCase();
    const filtered = TIPS.filter(t => {
      const cat = t.category.toLowerCase();
      const body = t.body.toLowerCase();
      return cat.includes(lower) || body.includes(lower);
    });
    if (filtered.length > 0) return filtered[Math.floor(Math.random() * filtered.length)];
  }
  return TIPS[Math.floor(Math.random() * TIPS.length)];
}

function generateHTML(tip) {
  const color = CATEGORY_COLORS[tip.category]?.bg || '#6366f1';
  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{
  width:1080px;height:1080px;
  background:linear-gradient(135deg,#0f0f13 0%,#1a1a23 50%,#0f0f13 100%);
  font-family:'Noto Sans KR',sans-serif;
  display:flex;align-items:center;justify-content:center;overflow:hidden
}
.card{
  width:920px;height:920px;
  background:linear-gradient(160deg,#1a1a23 0%,#24242f 100%);
  border-radius:48px;border:1px solid rgba(255,255,255,0.08);
  position:relative;overflow:hidden;
  display:flex;flex-direction:column;padding:60px
}
.card::before{
  content:'';position:absolute;top:-100px;right:-100px;
  width:400px;height:400px;
  background:radial-gradient(circle,rgba(99,102,241,0.12) 0%,transparent 70%);
  border-radius:50%
}
.badge{
  display:inline-flex;align-items:center;gap:6px;
  padding:10px 20px;border-radius:100px;
  background:${color}20;border:1px solid ${color}40;
  color:${color};font-size:18px;font-weight:700;
  margin-bottom:32px;width:fit-content;position:relative;z-index:1
}
.title{
  font-size:52px;font-weight:900;color:#ffffff;
  line-height:1.2;letter-spacing:-1px;
  margin-bottom:28px;position:relative;z-index:1
}
.body{
  font-size:28px;font-weight:400;color:#9ca3af;
  line-height:1.6;flex:1;position:relative;z-index:1
}
.bottom{
  display:flex;align-items:center;justify-content:space-between;
  padding-top:40px;border-top:1px solid rgba(255,255,255,0.06);
  position:relative;z-index:1
}
.brand{display:flex;align-items:center;gap:10px}
.brand-icon{
  width:36px;height:36px;border-radius:10px;
  background:linear-gradient(135deg,#6366f1,#8b5cf6);
  display:flex;align-items:center;justify-content:center;
  color:white;font-weight:900;font-size:16px
}
.brand-name{font-size:18px;font-weight:700;color:#ffffff}
.brand-name span{color:#818cf8}
.tags{font-size:16px;color:#4b5563;font-weight:500}
.accent-line{
  position:absolute;top:0;left:60px;right:60px;height:4px;
  background:linear-gradient(90deg,${color},transparent);
  border-radius:0 0 4px 4px
}
</style></head><body>
<div class="card">
  <div class="accent-line"></div>
  <div class="badge">${tip.category}</div>
  <div class="title">${tip.title}</div>
  <div class="body">${tip.body}</div>
  <div class="bottom">
    <div class="brand"><div class="brand-icon">S</div><div class="brand-name">SJ<span>.</span>AI</div></div>
    <div class="tags">${tip.tags}</div>
  </div>
</div>
</body></html>`;
}

async function generateImage(tip) {
  const html = generateHTML(tip);
  const timestamp = Date.now();
  const htmlPath = path.join(ROOT, 'images', `tip-${timestamp}.html`);
  const pngPath = path.join(ROOT, 'images', `tip-${timestamp}.png`);
  const imagesDir = path.join(ROOT, 'images');

  const fs_mod = await import('fs');
  if (!fs_mod.existsSync(imagesDir)) fs_mod.mkdirSync(imagesDir, { recursive: true });
  fs_mod.writeFileSync(htmlPath, html, 'utf-8');

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 2 });
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.screenshot({ path: pngPath, fullPage: true });
    await browser.close();
    fs_mod.unlinkSync(htmlPath);
    console.log(`✅ Card image: ${pngPath}`);
    return pngPath;
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    console.error(`❌ Card generation failed: ${err.message}`);
    return null;
  }
}

// ===== Main =====
async function main() {
  const args = process.argv.slice(2);
  const topicIdx = args.indexOf('--topic');
  const topic = topicIdx >= 0 ? args[topicIdx + 1] : null;

  const tip = pickTip(topic);
  console.log(`Topic: "${tip.title}"`);

  const imagePath = await generateImage(tip);
  if (!imagePath) {
    console.error('❌ Failed to generate card');
    process.exit(1);
  }

  if (process.env.DRY_RUN === 'true') {
    console.log(`[DRY RUN] Would post: "${tip.title}"`);
    console.log(`[DRY RUN] Image: ${imagePath}`);
    return;
  }

  console.log(`\n✅ Card ready: ${imagePath}`);
  console.log(`Caption preview:`);
  console.log(`${tip.title}\n${tip.body}\n${tip.tags}`);
  console.log(`\nTo post, use the main pipeline with image: ${imagePath}`);
}

main();
