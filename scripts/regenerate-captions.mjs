#!/usr/bin/env node
/**
 * regenerate-captions.mjs
 *
 * Notion에 있는 모든 포스트의 캡션을 일괄 재생성
 * - caption.js의 generateCaption() 사용 (AI 키 O → AI 생성, X → 템플릿 fallback)
 * - Ready/Posted/Failed 관계없이 전수 재생성
 *
 * 사용법: node --env-file=.env scripts/regenerate-captions.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getReadyPosts, updateCaption } from '../src/notion.js';
import { generateCaption } from '../src/caption.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.join(__dirname, '..', 'logs');

function log(message, type = 'INFO') {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${type}] ${message}`;
  console.log(line);
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
  const logFile = path.join(LOG_DIR, `regenerate-${new Date().toISOString().slice(0, 10)}.log`);
  fs.appendFileSync(logFile, line + '\n', 'utf-8');
}

// .env 로드
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const eqIdx = trimmed.indexOf('=');
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

const MODE = process.argv.includes('--dry-run') ? 'DRY_RUN' : 'LIVE';

async function main() {
  log(`=== Caption Regeneration Started (mode: ${MODE}) ===`);
  log(`DeepSeek key: ${process.env.DEEPSEEK_API_KEY ? '✅ available' : '❌ empty (template fallback)'}`);

  // Notion에서 모든 포스트 조회
  const BASE = 'https://api.notion.com/v1';
  const headers = {
    'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  };

  // 필터 없이 모든 포스트 (최대 100개)
  const res = await fetch(`${BASE}/databases/${process.env.NOTION_DATABASE_ID}/query`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ page_size: 100 }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion query failed: ${err}`);
  }

  const data = await res.json();
  const posts = data.results.map(page => {
    const name = page.properties.Name?.title?.[0]?.plain_text || '';
    const oldCaption = page.properties.Caption?.rich_text?.[0]?.plain_text || '';
    const imageUrl = page.properties['Image URL']?.url || '';
    const account = page.properties.Account?.select?.name || 'studio_sjw';
    const platform = page.properties.Platform?.select?.name || 'Instagram';
    const status = page.properties.Status?.select?.name || '';
    return { id: page.id, name, oldCaption, imageUrl, account, platform, status };
  });

  log(`Found ${posts.length} total posts to process`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const post of posts) {
    // 템플릿 캡션("에 관한 포스팅입니다")만 재생성
    // 이미 괜찮은 캡션은 건드리지 않음
    const isTemplate = /에 관한 포스팅입니다/.test(post.oldCaption);

    if (!isTemplate) {
      log(`[${updated + skipped + errors + 1}/${posts.length}] ⏭️ "${post.name}" — already has custom caption, skipping`);
      skipped++;
      continue;
    }

    // 재생성할 post 객체
    const postObj = {
      name: post.name,
      caption: post.oldCaption,
      platform: post.platform,
      account: post.account,
      imageUrl: post.imageUrl,
    };

    log(`[${updated + skipped + errors + 1}/${posts.length}] "${post.name}" (${post.status})`);

    try {
      const newCaption = await generateCaption(postObj);

      if (!newCaption || newCaption === post.oldCaption) {
        log(`  ⏭️ No change needed`, 'SKIP');
        skipped++;
        continue;
      }

      if (MODE === 'DRY_RUN') {
        log(`  📝 [DRY-RUN] OLD: ${post.oldCaption.slice(0, 60)}...`);
        log(`  📝 [DRY-RUN] NEW: ${newCaption.slice(0, 60)}...`);
      } else {
        await updateCaption(post.id, newCaption);
        log(`  ✅ Caption updated`);
        log(`  OLD: ${post.oldCaption.slice(0, 80)}`);
        log(`  NEW: ${newCaption.slice(0, 80)}`);
      }
      updated++;
    } catch (e) {
      log(`  ❌ Error: ${e.message}`, 'ERROR');
      errors++;
    }

    // Rate limit 방지 (Notion API: 3 req/sec)
    await new Promise(r => setTimeout(r, 350));
  }

  log(`=== Done ===`);
  log(`Total: ${posts.length} | Updated: ${updated} | Skipped: ${skipped} | Errors: ${errors}`);
}

main().catch(e => {
  log(`FATAL: ${e.message}`, 'ERROR');
  process.exit(1);
});
