// images.js — 이미지 선택, 검증, 다양성 관리
// 목표: 같은 이미지 반복 사용 최소화, 주제별 적합한 이미지 할당, 이미지 품질 확인
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
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
// 1. Unsplash (API 키 있으면) — 주제별 검색, 고품질, 1순위
// 2. SJ 브랜드 이미지 — 일주일에 1-2번만
// 3. Picsum — 최후의 fallback
export async function pickImage(postName) {
  const tracker = loadTracker();
  const style = topicToStyle(postName);

  // === 1. Unsplash 우선 ===
  const unsplashResult = await pickUnsplashImage(postName);
  if (unsplashResult) {
    console.log(`  📸 Unsplash image for "${postName}"`);
    return unsplashResult;
  }

  // SJ 이미지 / Picsum 사용 횟수 확인
  const sjUsage = SJ_IMAGES.map((_, i) => ({
    index: i,
    count: tracker.sj[i] || 0,
    url: getSjImageUrl(i),
    isSj: true,
  }));
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

  // === 2. SJ 브랜드 이미지 (20%) ===
  if (Math.random() < 0.2) {
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

  // === 3. Picsum fallback ===
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

// === Unsplash API — 주제별 고품질 이미지 검색 ===
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || '';

// 주제명 → Unsplash 검색어 매핑
const TOPIC_KEYWORDS = {
  '카페': 'cafe coffee shop',
  '음식': 'food restaurant',
  '맛집': 'food restaurant',
  '요리': 'cooking kitchen',
  '커피': 'coffee',
  '베이커리': 'bakery pastry',
  '뷰티': 'beauty skincare',
  '화장': 'makeup cosmetics',
  '패션': 'fashion style',
  '옷': 'fashion clothing',
  '인테리어': 'interior design home',
  '헬스': 'fitness workout',
  '운동': 'sports exercise',
  '여행': 'travel vacation',
  '기술': 'technology business',
  'AI': 'artificial intelligence technology',
  '자동화': 'automation technology',
  '소프트웨어': 'software technology',
  '교육': 'education learning',
  '일반': 'business office',
};

function postNameToQuery(postName) {
  const lower = (postName || '').toLowerCase();
  for (const [keyword, query] of Object.entries(TOPIC_KEYWORDS)) {
    if (lower.includes(keyword)) return query;
  }
  return 'business creative';
}

export async function pickUnsplashImage(postName = '') {
  if (!UNSPLASH_ACCESS_KEY || UNSPLASH_ACCESS_KEY.length < 10) return null;

  const query = postNameToQuery(postName);

  try {
    const res = await fetch(
      `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&w=1080&h=1080&fit=crop&orientation=squarish`,
      { headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` } }
    );
    if (!res.ok) {
      console.log(`  ⚠️ Unsplash API error: ${res.status}`);
      return null;
    }

    const data = await res.json();
    return {
      url: data.urls?.regular || data.urls?.raw || '',
      attribution: `Photo by ${data.user?.name || 'Unknown'} on Unsplash`,
      type: 'unsplash',
      authorLink: data.user?.links?.html || '',
    };
  } catch (err) {
    console.log(`  ⚠️ Unsplash fetch error: ${err.message}`);
    return null;
  }
}

// === 이미지 해싱 + 중복 검증 시스템 ===
// 이미지를 다운로드해서 SHA256 해시 계산 → 중복 게시 방지

const USED_HASHES_PATH = path.join(__dirname, '..', '.image-hashes.json');

function loadHashes() {
  try {
    if (fs.existsSync(USED_HASHES_PATH)) {
      return JSON.parse(fs.readFileSync(USED_HASHES_PATH, 'utf-8'));
    }
  } catch {}
  return { hashes: {} };
}

function saveHashes(data) {
  try {
    fs.writeFileSync(USED_HASHES_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`[WARN] Failed to save image hashes: ${err.message}`);
  }
}

/**
 * 이미지 URL을 다운로드해서 SHA256 해시 계산
 * @param {string} imageUrl
 * @returns {Promise<{hash: string, size: number, width?: number, height?: number}>}
 */
export async function fingerprintImage(imageUrl) {
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      throw new Error(`Not an image: ${contentType}`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const hash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16);

    // Content-Length로 크기 확인
    const size = parseInt(res.headers.get('content-length') || '0', 10);

    return { hash, size, contentType };
  } catch (err) {
    return { hash: '', size: 0, error: err.message };
  }
}

/**
 * 이미지가 이미 사용된 적 있는지 확인
 * @param {string} hash
 * @param {number} [expiryDays=90] — 최근 N일 이내 사용된 것만 중복으로 간주
 * @returns {{ isDuplicate: boolean, lastUsed: string|null, timesUsed: number }}
 */
export function checkDuplicate(hash, expiryDays = 90) {
  if (!hash) return { isDuplicate: false, lastUsed: null, timesUsed: 0 };

  const data = loadHashes();
  const record = data.hashes[hash];
  if (!record) return { isDuplicate: false, lastUsed: null, timesUsed: 0 };

  const lastUsed = record.lastUsed || '';
  const timesUsed = record.count || 0;
  const expired = lastUsed
    ? (Date.now() - new Date(lastUsed).getTime()) > expiryDays * 24 * 60 * 60 * 1000
    : true;

  return {
    isDuplicate: !expired,
    lastUsed,
    timesUsed,
  };
}

/**
 * 이미지 해시를 사용 기록에 저장
 */
export function markImageUsed(hash, metadata = {}) {
  if (!hash) return;

  const data = loadHashes();
  if (!data.hashes[hash]) {
    data.hashes[hash] = { count: 0, firstUsed: null, lastUsed: null, ...metadata };
  }
  data.hashes[hash].count = (data.hashes[hash].count || 0) + 1;
  data.hashes[hash].lastUsed = new Date().toISOString();
  if (!data.hashes[hash].firstUsed) {
    data.hashes[hash].firstUsed = new Date().toISOString();
  }
  saveHashes(data);
}

/**
 * 게시 전 이미지 검증: 중복 확인 + 유효성 검사
 * 중복이면 새 이미지로 교체하고 교체된 URL 반환
 */
export async function validateAndReplace(imageUrl, postName, maxRetries = 3) {
  // 1. 이미지 핑거프린트
  const fp = await fingerprintImage(imageUrl);

  if (fp.hash) {
    // 2. 중복 체크
    const dup = checkDuplicate(fp.hash);
    if (dup.isDuplicate) {
      console.log(`  ⚠️  중복 이미지 감지! (${dup.timesUsed}번째 사용, 마지막: ${dup.lastUsed?.slice(0, 10)})`);
      // 새 이미지로 교체 시도
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const fresh = await pickImage(postName);
        if (!fresh?.url) continue;

        const freshFp = await fingerprintImage(fresh.url);
        if (!freshFp.hash) continue;

        const freshDup = checkDuplicate(freshFp.hash);
        if (!freshDup.isDuplicate) {
          // 중복 아닌 이미지 찾음 → 저장
          markImageUsed(freshFp.hash, { url: fresh.url, type: fresh.type });
          console.log(`  ✅ 새 이미지로 교체: ${fresh.type}`);
          return fresh.url;
        }
      }
      // 재시도 실패: 그래도 다른 이미지 반환 (중복이더라도)
      console.log(`  ⚠️ 중복 회피 실패, 다른 이미지로 대체`);
      const fallback = await pickImage(postName);
      return fallback?.url || imageUrl;
    }

    // 3. 중복 아니면 정상
    markImageUsed(fp.hash, { url: imageUrl });
  }

  // 4. 이미지 크기 검증 (너무 작은 이미지 경고)
  if (fp.size > 0 && fp.size < 1024) {
    console.log(`  ⚠️ 이미지가 너무 작음: ${fp.size} bytes`);
  }

  return imageUrl;
}
