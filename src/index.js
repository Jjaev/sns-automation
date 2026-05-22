// index.js — 메인 파이프라인: Notion → SNS 자동 업로드 (멀티플랫폼/멀티계정)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getReadyPosts, updateStatus, createPost, getTodayPostCount } from './notion.js';
import { generateCaption, generateAdCopy } from './caption.js';
import { publishPhoto, publishReel } from './instagram.js';
import { pickImage, getImageStats } from './images.js';
import { fullImageValidation } from './image-validator.js';
import { sendTelegram } from './telegram.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.join(__dirname, '..', 'logs');
const POST_DELAY_MINUTES = parseInt(process.env.POST_DELAY_MINUTES || '60', 10);

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
      if (post.mediaType === 'REELS') {
        return await publishReel({
          caption,
          videoUrl: post.videoUrl,
          account: post.account,
          shareToFeed: post.shareToFeed !== false,
        });
      }
      return await publishPhoto({
        caption,
        imageUrl: post.imageUrl,
        account: post.account,
      });
    case 'Instagram_REELS':
      // REELS 전용 alias (platform을 REELS로 설정해도 동작)
      return await publishReel({
        caption,
        videoUrl: post.videoUrl,
        account: post.account,
        shareToFeed: post.shareToFeed !== false,
      });
    default:
      log(`Platform "${post.platform}" not yet supported. Skipping.`, 'WARN');
      return { skipped: true, reason: `Platform ${post.platform} not supported` };
  }
}

/**
 * 1회 실행: Ready 포스트를 찾아서 업로드
 */
export async function run() {
  log('=== SNS Automation Pipeline Started ===');

  // 0a. 이미지 다양성 상태 로깅
  try {
    const imgStats = getImageStats();
    log(`Image pool: ${imgStats.sjImages} SJ + ${imgStats.picsumSeeds} Picsum = ${imgStats.sjImages + imgStats.picsumSeeds} unique`);
    log(`Total uses tracked: ${imgStats.totalUses} (SJ: ${imgStats.totalSjUsed}, Picsum: ${imgStats.totalPicsumUsed})`);
  } catch (e) {
    log(`Image stats unavailable: ${e.message}`);
  }

  const DAILY_LIMIT = parseInt(process.env.DAILY_POST_LIMIT || '2');

  // 0. 오늘 게시된 포스트 수 확인 (daily limit)
  try {
    const todayCount = await getTodayPostCount(process.env.NOTION_DATABASE_ID);
    log(`Today's posts: ${todayCount} / ${DAILY_LIMIT}`);
    if (todayCount >= DAILY_LIMIT) {
      log(`Daily limit (${DAILY_LIMIT}) reached. Done.`);
      return;
    }
  } catch (e) {
    log(`Daily count check failed: ${e.message}`, 'WARN');
  }

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

    // 2. AI 캡션 생성 (이름에 [AD] prefix → 광고 카피)
    let caption;
    try {
      caption = post.name?.startsWith('[AD]')
        ? await generateAdCopy(post)
        : await generateCaption(post);
    } catch (e) {
      log(`Caption generation failed: ${e.message}`, 'WARN');
      caption = post.caption || '';
    }

    if (!caption && !post.imageUrl && post.mediaType !== 'REELS') {
      log(`Skipped "${post.name}": no caption and no image`, 'WARN');
      await updateStatus(post.id, 'Failed');
      continue;
    }
    // REELS: 비디오 URL 없으면 스킵
    if (post.mediaType === 'REELS' && !post.videoUrl) {
      log(`Skipped "${post.name}": REELS type but missing videoUrl`, 'WARN');
      await updateStatus(post.id, 'Failed');
      continue;
    }

    // 2.5 이미지 검증: 중복 + 품질 체크 후 필요 시 교체
    let imageUrl = post.imageUrl;
    if (imageUrl) {
      try {
        const validation = await fullImageValidation(imageUrl, post.name);
        if (!validation.passed) {
          log(`  ⚠️  Image rejected: ${validation.warnings.join('; ')}`);
          // 새 이미지 할당
          const freshImage = await pickImage(post.name);
          if (freshImage?.url) {
            imageUrl = freshImage.url;
            log(`  └─ Replaced with fresh: ${freshImage.type}`);
          }
        } else if (validation.warnings.length > 0) {
          log(`  └─ Image OK (warnings: ${validation.warnings.join('; ')})`);
        }
        if (validation.description) {
          log(`  └─ Image: ${validation.description}`);
        }
      } catch (e) {
        log(`Image validation error: ${e.message}`, 'WARN');
        // 검증 실패해도 기존 이미지로 진행
      }
    } else {
      // 이미지 없으면 새로 할당
      try {
        const freshImage = await pickImage(post.name);
        if (freshImage?.url) {
          imageUrl = freshImage.url;
          log(`  └─ New image assigned: ${freshImage.type}`);
        }
      } catch (e) {
        log(`Image pick failed: ${e.message}`, 'WARN');
      }
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
      const result = await publish({ ...post, imageUrl }, caption);

      if (result && result.skipped) {
        log(`⏭️ Skipped "${post.name}": ${result.reason}`);
        await updateStatus(post.id, 'Ready'); // 다시 큐에 유지 (다음에 다른 플랫폼으로 변경 가능)
        continue;
      }

      log(`✅ Published! Media ID: ${result}`);
      await updateStatus(post.id, 'Posted', { publishedAt: new Date().toISOString() });
      log(`✅ Status updated: "${post.name}" → Posted`);

      // 텔레그램 알림
      const mediaType = post.mediaType === 'REELS' ? '🎬 릴스' : '📷 포스트';
      const accountName = post.account || 'studio_sjw';
      const tgMsg = [
        `✅ ${mediaType} 발행 완료`,
        `   계정: @${accountName}`,
        `   제목: ${post.name}`,
        `   시간: ${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`,
        post.mediaType === 'REELS' ? `   📱 릴스 탭 + 피드 동시 게시` : '',
      ].filter(Boolean).join('\n');
      sendTelegram(tgMsg, { silent: true });

      // 게시 간격 (여러 개 연속 업로드 방지)
      if (POST_DELAY_MINUTES > 0) {
        const ms = POST_DELAY_MINUTES * 60 * 1000;
        log(`⏳ Waiting ${POST_DELAY_MINUTES} min before next post...`);
        await new Promise(r => setTimeout(r, ms));
      }
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
