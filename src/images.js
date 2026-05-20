// images.js — 이미지 선택 및 다양성 관리
// 목표: 같은 이미지 반복 사용 최소화, 주제별 적합한 이미지 할당
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TRACKER_PATH = path.join(__dirname, '..', '.image-tracker.json');

// === SJ 브랜드 워터마크 이미지 (Supabase) ===
const SUPABASE_BASE = 'https://ffkranwhkgcwhsgskjgs.supabase.co/storage/v1/object/public/sns-images';
const SJ_IMAGES = [
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

// === Picsum 이미지 ID 풀 (무작위 고품질 사진, API 키 불필요) ===
// Picsum에서 자주 사용되는 인기 이미지 50개 seed 고정
const PICSUM_SEEDS = [
  1, 10, 20, 30, 40, 50, 60, 70, 80, 90,
  100, 110, 120, 130, 140, 150, 160, 170, 180, 190,
  200, 210, 220, 230, 240, 250, 260, 270, 280, 290,
  300, 310, 320, 330, 340, 350, 360, 370, 380, 390,
  400, 410, 420, 430, 440, 450, 460, 470, 480, 490,
  500, 510, 520, 530, 540, 550, 560, 570, 580, 590,
  600, 610, 620, 630, 640, 650, 660, 670, 680, 690,
  700, 710, 720, 730, 740, 750, 760, 770, 780, 790,
  800, 810, 820, 830, 840, 850, 860, 870, 880, 890,
  900, 910, 920, 930, 940, 950, 960, 970, 980, 990,
];

// === 이미지 사용 추적기 ===
function loadTracker() {
  try {
    if (fs.existsSync(TRACKER_PATH)) {
      return JSON.parse(fs.readFileSync(TRACKER_PATH, 'utf-8'));
    }
  } catch {}
  return { sj: {}, picsum: {}, history: [] };
}

function saveTracker(tracker) {
  try {
    fs.writeFileSync(TRACKER_PATH, JSON.stringify(tracker, null, 2), 'utf-8');
  } catch (err) {
    console.error(`[WARN] Failed to save image tracker: ${err.message}`);
  }
}

function markUsed(sjIndex = -1, picsumSeed = -1) {
  const tracker = loadTracker();
  const now = new Date().toISOString();
  if (sjIndex >= 0) {
    tracker.sj[sjIndex] = (tracker.sj[sjIndex] || 0) + 1;
  }
  if (picsumSeed >= 0) {
    tracker.picsum[picsumSeed] = (tracker.picsum[picsumSeed] || 0) + 1;
  }
  tracker.history.push({ sj: sjIndex, picsum: picsumSeed, time: now });
  // Keep last 500 entries
  if (tracker.history.length > 500) {
    tracker.history = tracker.history.slice(-500);
  }
  saveTracker(tracker);
}

// === SJ 이미지 URL ===
function getSjImageUrl(index) {
  return `${SUPABASE_BASE}/${SJ_IMAGES[index]}`;
}

// === Picsum 이미지 URL (고정 시드, 800×800) ===
function getPicsumUrl(seed) {
  return `https://picsum.photos/seed/${seed}/800/800`;
}

// === 주제 → 이미지 스타일 매핑 ===
function topicToStyle(name) {
  const lower = (name || '').toLowerCase();
  if (/카페|음식|맛집|요리|커피|베이커리/.test(lower)) return 'food';
  if (/뷰티|화장|피부|메이크업|미용/.test(lower)) return 'beauty';
  if (/패션|옷|코디|스타일|쇼핑/.test(lower)) return 'fashion';
  if (/헬스|운동|피트니스|다이어트|건강/.test(lower)) return 'fitness';
  if (/교육|클래스|레슨|학습|공부/.test(lower)) return 'education';
  if (/기술|개발|코딩|AI|자동화|소프트웨어|디지털/.test(lower)) return 'tech';
  if (/여행|여행지|호텔|리조트/.test(lower)) return 'travel';
  if (/인테리어|홈|리모델링|가구/.test(lower)) return 'interior';
  return 'general';
}

// === 메인 이미지 선택 함수 ===
// 전략:
// 1. SJ 브랜드 이미지는 최대한 아껴씀 (일주일에 1-2번만)
// 2. Picsum 이미지를 기본으로 사용 (무제한, 다양함)
// 3. 같은 이미지가 30일 내에 재사용되지 않도록 추적
export async function pickImage(postName) {
  const tracker = loadTracker();
  const style = topicToStyle(postName);

  // SJ 이미지 사용 횟수 확인 — 적게 쓴 이미지 우선
  const sjUsage = SJ_IMAGES.map((_, i) => ({
    index: i,
    count: tracker.sj[i] || 0,
    url: getSjImageUrl(i),
    isSj: true,
  }));

  // Picsum 사용 횟수 확인
  const picsumUsage = PICSUM_SEEDS.map((seed) => ({
    seed,
    count: tracker.picsum[seed] || 0,
    url: getPicsumUrl(seed),
    isSj: false,
  }));

  // 최근 30일간 사용된 이미지 추적
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentSJ = new Set(
    tracker.history
      .filter((h) => h.sj >= 0 && new Date(h.time).getTime() > thirtyDaysAgo)
      .map((h) => h.sj)
  );
  const recentPicsum = new Set(
    tracker.history
      .filter((h) => h.picsum >= 0 && new Date(h.time).getTime() > thirtyDaysAgo)
      .map((h) => h.picsum)
  );

  // 결정: 80% 확률로 Picsum, 20% 확률로 SJ 브랜드 이미지
  const useSj = Math.random() < 0.2;

  if (useSj) {
    // SJ 이미지: 가장 적게 사용되고, 최근 30일 내 사용 안 한 것 우선
    const available = sjUsage
      .filter((img) => !recentSJ.has(img.index))
      .sort((a, b) => a.count - b.count);

    if (available.length > 0) {
      const chosen = available[0];
      markUsed(chosen.index, -1);
      return {
        url: chosen.url,
        type: 'sj-brand',
        attribution: '',
      };
    }
  }

  // Picsum: 가장 적게 사용되고, 최근 30일 내 사용 안 한 것 우선
  const available = picsumUsage
    .filter((img) => !recentPicsum.has(img.seed))
    .sort((a, b) => a.count - b.count);

  if (available.length > 0) {
    const chosen = available[Math.floor(Math.random() * Math.min(available.length, 30))];
    markUsed(-1, chosen.seed);
    return {
      url: chosen.url,
      type: 'picsum',
      attribution: '',
    };
  }

  // 모두 사용됐으면 랜덤 (어쨌든 다양성 확보)
  const fallback = picsumUsage[Math.floor(Math.random() * picsumUsage.length)];
  markUsed(-1, fallback.seed);
  return {
    url: fallback.url,
    type: 'picsum',
    attribution: '',
  };
}

// === 상태 리포트 ===
export function getImageStats() {
  const tracker = loadTracker();
  const totalSJ = Object.values(tracker.sj).reduce((a, b) => a + b, 0);
  const totalPicsum = Object.values(tracker.picsum).reduce((a, b) => a + b, 0);
  const sjUsage = SJ_IMAGES.map((_, i) => ({
    name: SJ_IMAGES[i],
    count: tracker.sj[i] || 0,
  }));

  return {
    sjImages: SJ_IMAGES.length,
    picsumSeeds: PICSUM_SEEDS.length,
    sjUsage: sjUsage.sort((a, b) => b.count - a.count),
    totalSjUsed: totalSJ,
    totalPicsumUsed: totalPicsum,
    totalUses: totalSJ + totalPicsum,
    recentHistory: tracker.history.slice(-10).reverse(),
  };
}

// === (선택) Unspash API 연동 — API 키가 있으면 사용 ===
// Unsplash 액세스 키가 설정된 경우에만 활성화
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || '';

export async function pickUnsplashImage(query = 'business', width = 800, height = 800) {
  if (!UNSPLASH_ACCESS_KEY || UNSPLASH_ACCESS_KEY.length < 10) return null;

  try {
    const res = await fetch(
      `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&w=${width}&h=${height}&fit=crop`,
      { headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` } }
    );
    if (!res.ok) return null;

    const data = await res.json();
    return {
      url: data.urls?.regular || data.urls?.raw || '',
      attribution: `Photo by ${data.user?.name || 'Unknown'} on Unsplash`,
      type: 'unsplash',
    };
  } catch {
    return null;
  }
}
