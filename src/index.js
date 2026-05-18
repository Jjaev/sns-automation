// index.js — 메인 파이프라인: Notion → SNS 자동 업로드 (멀티플랫폼/멀티계정)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getReadyPosts, updateStatus, createPost } from './notion.js';
import { generateCaption } from './caption.js';
import { publishPhoto } from './instagram.js';

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

/**
 * 플랫폼별로 publish 함수 라우팅
 * 새 플랫폼 추가: 여기만 건드리면 됨
 */
async function publish(post, caption) {
  switch (post.platform) {
    case 'Instagram':
      return await publishPhoto({
        caption,
        imageUrl: post.imageUrl,
        account: post.account,   // ← 계정 정보 전달
      });
    // TODO: 다음 플랫폼들
    // case 'LinkedIn':
    //   return await publishLinkedin({ caption, account: post.account });
    // case 'Twitter':
    //   return await publishTwitter({ caption, account: post.account });
    default:
      throw new Error(`Platform "${post.platform}" not yet supported`);
  }
}

/**
 * 1회 실행: Ready 포스트를 찾아서 업로드
 */
export async function run() {
  log('=== SNS Automation Pipeline Started ===');

  // 1. Notion에서 Ready 포스트 조회
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

  for (const post of posts) {
    log(`Processing: "${post.name}"`);
    log(`  ├─ Platform: ${post.platform}`);
    log(`  └─ Account:  ${post.account}`);

    // 2. AI 캡션 생성
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
      continue;
    }

    // 3. 업로드
    const isDryRun = process.env.DRY_RUN === 'true';
    if (isDryRun) {
      log(`[DRY RUN] Would publish: ${post.name}`);
      log(`[DRY RUN] → ${post.platform} @ ${post.account}`);
      log(`[DRY RUN] Caption: ${caption?.slice(0, 60)}...`);
      await updateStatus(post.id, 'Ready');
      continue;
    }

    try {
      const mediaId = await publish(post, caption);
      log(`✅ Published! Media ID: ${mediaId}`);

      await updateStatus(post.id, 'Posted');
      log(`✅ Status updated: "${post.name}" → Posted`);
    } catch (e) {
      log(`❌ Upload failed: "${post.name}" — ${e.message}`, 'ERROR');
      await updateStatus(post.id, 'Failed');
    }
  }

  log('=== Pipeline Complete ===');
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
