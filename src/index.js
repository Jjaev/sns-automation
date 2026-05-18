// index.js — 메인 파이프라인: Notion → AI 캡션 → SNS 업로드
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getReadyPosts, updateStatus, createPost } from './notion.js';
import { generateCaption } from './caption.js';
import { publishPhoto } from './instagram.js';

// ============================================================
// 계정 보호 정책 (저품질 방지)
// ============================================================
const DAILY_POST_LIMIT = 2;    // 하루 최대 게시물 수 (신규 계정 보호)
const IMAGE_DOMAINS_BLOCKED = [ // 스톡사진 도메인 블록
  'unsplash.com',
  'pexels.com',
  'pixabay.com',
  'shutterstock.com',
  'gettyimages.com',
  'istockphoto.com',
  '123rf.com',
  'freepik.com',
  'stock.adobe.com',
];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.join(__dirname, '..', 'logs');

// 로그 기록
function log(message, type = 'INFO') {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${type}] ${message}`;
  console.log(line);

  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
  const logFile = path.join(LOG_DIR, `${new Date().toISOString().slice(0, 10)}.log`);
  fs.appendFileSync(logFile, line + '\n', 'utf-8');
}

// ============================================================
// 인스타그램 토큰 만료일 (2026-07-16, 약 59일)
// ============================================================
const TOKEN_EXPIRY = new Date('2026-07-16T00:00:00Z');

/**
 * 토큰 만료 체크
 */
function checkTokenExpiry() {
  const now = new Date();
  const daysLeft = Math.floor((TOKEN_EXPIRY - now) / (1000 * 60 * 60 * 24));
  if (daysLeft <= 0) {
    log('🚨 Instagram token EXPIRED! Update required.', 'ERROR');
    return false;
  }
  if (daysLeft <= 14) {
    log(`⚠️ Instagram token expires in ${daysLeft} days! Renew soon.`, 'WARN');
  } else {
    log(`Instagram token valid: ${daysLeft} days remaining`);
  }
  return true;
}

/**
 * publish 재시도 (일시적 장애 대비, 최대 1회)
 */
async function publishWithRetry(post, caption) {
  const MAX_RETRIES = 1;
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      if (post.platform === 'Instagram') {
        const mediaId = await publishPhoto({ caption, imageUrl: post.imageUrl });
        return { mediaId, attempt };
      }
      return { mediaId: null, attempt }; // 미지원 플랫폼
    } catch (e) {
      if (attempt <= MAX_RETRIES) {
        log(`Retry ${attempt}/${MAX_RETRIES} for "${post.name}": ${e.message}`, 'WARN');
        await new Promise(r => setTimeout(r, 3000)); // 3초 후 재시도
      } else {
        throw e; // 최종 실패
      }
    }
  }
}

/**
 * 오늘 이미 게시한 횟수 확인 (로그 기반)
 */
function getTodayPostCount() {
  const today = new Date().toISOString().slice(0, 10);
  const logFile = path.join(LOG_DIR, `${today}.log`);
  if (!fs.existsSync(logFile)) return 0;
  const content = fs.readFileSync(logFile, 'utf-8');
  const matches = content.match(/Published to Instagram/g);
  return matches ? matches.length : 0;
}

/**
 * 이미지 URL이 스톡사진인지 확인
 */
function isStockImage(url) {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return IMAGE_DOMAINS_BLOCKED.some(domain => hostname.includes(domain));
  } catch {
    return false;
  }
}

/**
 * 1회 실행: Ready 포스트를 찾아서 업로드 (계정 보호 정책 적용)
 */
export async function run() {
  log('=== SNS Automation Pipeline Started ===');

  // 0. 토큰 만료 체크
  const tokenValid = checkTokenExpiry();

  // 1. 오늘 게시 가능 횟수 확인
  const todayCount = getTodayPostCount();
  if (todayCount >= DAILY_POST_LIMIT) {
    log(`Daily post limit reached (${todayCount}/${DAILY_POST_LIMIT}). Skipping.`);
    return;
  }
  log(`Today's post count: ${todayCount}/${DAILY_POST_LIMIT}`);

  // 2. Notion에서 Ready 포스트 조회
  let posts;
  try {
    posts = await getReadyPosts(process.env.NOTION_DATABASE_ID);
    log(`Found ${posts.length} ready post(s)`);
  } catch (e) {
    log(`Notion read failed: ${e.message}`, 'ERROR');
    return;
  }

  if (posts.length === 0) {
    log('No posts to process. Done.');
    return;
  }

  let posted = 0;
  let failed = 0;
  for (const post of posts) {
    // 하루 최대 게시량 초과 시 중단
    if (posted + todayCount >= DAILY_POST_LIMIT) {
      log(`Daily limit reached after ${posted} post(s). Stopping.`);
      break;
    }

    log(`Processing: "${post.name}" (${post.platform})`);

    // 3. 스톡 이미지 체크 (경고만, 차단 안 함)
    if (post.imageUrl && isStockImage(post.imageUrl)) {
      log(`⚠️ Stock photo detected: ${post.imageUrl}. Replace with original image.`, 'WARN');
    }

    // 4. AI 캡션 생성 (키 없으면 Notion 캡션 그대로)
    let caption;
    try {
      caption = await generateCaption(post);
    } catch (e) {
      log(`Caption generation failed: ${e.message}`, 'WARN');
      caption = post.caption || '';
    }

    if (!caption && !post.imageUrl) {
      log(`Skipped "${post.name}": no caption and no image`, 'WARN');
      await updateStatus(post.id, 'Failed');
      failed++;
      continue;
    }

    // 5. Dry-run 모드
    const isDryRun = process.env.DRY_RUN === 'true';
    if (isDryRun) {
      log(`[DRY RUN] Would publish: ${post.name} | Platform: ${post.platform}`);
      log(`[DRY RUN] Caption: ${caption?.slice(0, 60)}...`);
      await updateStatus(post.id, 'Ready');
      continue;
    }

    // 6. 실제 업로드 (재시도 로직 포함)
    if (tokenValid && post.platform === 'Instagram') {
      try {
        const { mediaId, attempt } = await publishWithRetry(post, caption);
        log(`Published to Instagram! Media ID: ${mediaId} (retries: ${attempt - 1})`);
        posted++;
        await updateStatus(post.id, 'Posted');
        log(`Status updated: "${post.name}" → Posted`);
      } catch (e) {
        log(`Upload failed after retry: "${post.name}" — ${e.message}`, 'ERROR');
        await updateStatus(post.id, 'Failed');
        failed++;
      }
    } else if (!tokenValid) {
      log(`Skipped "${post.name}": token expired`, 'ERROR');
      await updateStatus(post.id, 'Failed');
      failed++;
    } else {
      log(`Platform "${post.platform}" not yet supported`, 'WARN');
      await updateStatus(post.id, 'Failed');
      failed++;
    }
  }

  // 7. 실행 요약
  log('=== Pipeline Summary ===');
  log(`Published: ${posted} | Failed: ${failed} | Remaining: ${posts.length - posted - failed}`);
  log(`=== Pipeline Complete ===`);
}

// CLI 실행
if (process.argv[1]?.includes('index')) {
  // .env 파일 로드 (간단하게 줄 단위 파싱)
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const eqIdx = trimmed.indexOf('=');
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      // 따옴표 제거
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }

  run();
}
