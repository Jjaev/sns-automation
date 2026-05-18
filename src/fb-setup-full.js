// fb-setup-full.js — 권한 추가 → Graph API Explorer → 토큰 생성 완전 자동
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.join(__dirname, '..', '.env');

const APP_ID = '1263832569067531';
const IG_API_PAGE = `https://developers.facebook.com/apps/${APP_ID}/instagram-graph-api/`;
const GRAPH_EXPLORER = `https://developers.facebook.com/tools/explorer/?app_id=${APP_ID}`;

async function main() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox'],
  });

  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // ===== STEP 1: 권한 추가 =====
  console.log('📌 STEP 1/3 — Instagram 권한 추가');
  await page.goto(IG_API_PAGE, { waitUntil: 'networkidle', timeout: 60000 });

  // 로그인 확인
  const needsLogin = await page.locator('input[name="email"]').first().isVisible().catch(() => false);
  if (needsLogin) {
    console.log('🔑 kore.ai.kr 계정으로 로그인해주세요.');
    console.log('   로그인 후 엔터 ➡️');
    await new Promise(r => process.stdin.once('data', () => r()));
    await page.goto(IG_API_PAGE, { waitUntil: 'networkidle' });
  }

  await page.waitForTimeout(3000);

  // "Facebook 로그인이 포함된 API 설정" 찾아서 클릭
  const fbOption = page.locator('a[href*="facebook-login"], a:has-text("Facebook 로그인이 포함")').first();
  if (await fbOption.isVisible().catch(() => false)) {
    await fbOption.click();
    await page.waitForTimeout(2000);
    console.log('  ✅ Facebook 로그인 API 설정 선택');
  } else {
    console.log('  ⚠️ Facebook 로그인 옵션을 찾을 수 없음');
  }

  // "필수 권한 모두 추가" 버튼
  const addBtn = page.locator('button:has-text("필수 권한 모두 추가"), button:has-text("Add All Required"), span:has-text("필수 권한")').first();
  if (await addBtn.isVisible().catch(() => false)) {
    await addBtn.click();
    await page.waitForTimeout(2000);
    console.log('  ✅ 필수 권한 추가됨!');
  } else {
    console.log('  ⚠️ "필수 권한 모두 추가" 버튼을 찾을 수 없음');
    console.log('  → 브라우저에서 직접 찾아서 클릭해주세요.');
    console.log('  → 완료되면 엔터 ➡️');
    await new Promise(r => process.stdin.once('data', () => r()));
  }

  // ===== STEP 2: 권한 확인 (Permissions 페이지) =====
  console.log('');
  console.log('📌 STEP 2/3 — 인스타 권한이 추가되었는지 확인');
  
  // Permissions 페이지로 이동
  await page.goto(`https://developers.facebook.com/apps/${APP_ID}/permissions/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  console.log('  권한 페이지에서 다음이 있는지 확인:');
  console.log('  → instagram_basic');
  console.log('  → instagram_content_publish');
  console.log('  → pages_read_engagement');
  console.log('  → pages_show_list');
  console.log('  있으면 엔터 ➡️');
  await new Promise(r => process.stdin.once('data', () => r()));

  // ===== STEP 3: Graph API Explorer =====
  console.log('');
  console.log('📌 STEP 3/3 — Graph API Explorer에서 토큰 생성');
  await page.goto(GRAPH_EXPLORER, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // 앱 선택
  const appDropdown = page.locator('div[aria-haspopup="listbox"]').first();
  if (await appDropdown.isVisible().catch(() => false)) {
    await appDropdown.click();
    await page.waitForTimeout(1000);
    const appOption = page.locator('div[role="option"]:has-text("sj ai agency")').first();
    if (await appOption.isVisible().catch(() => false)) {
      await appOption.click();
      await page.waitForTimeout(1000);
      console.log('  ✅ 앱 선택: sj ai agency');
    }
  }

  // Permissions에 권한 추가 시도
  const permInput = page.locator('input[placeholder*="권한"], input[placeholder*="Permission"]').first();
  if (await permInput.isVisible().catch(() => false)) {
    const perms = ['instagram_basic', 'instagram_content_publish', 'pages_read_engagement', 'pages_show_list'];
    for (const p of perms) {
      await permInput.click();
      await permInput.fill(p);
      await page.waitForTimeout(300);
      // 첫 번째 suggestion 선택
      const suggestion = page.locator('div[role="option"]').first();
      if (await suggestion.isVisible().catch(() => false)) {
        await suggestion.click();
        await page.waitForTimeout(300);
        console.log(`  ✅ ${p} 추가`);
      }
    }
  }

  // Generate Access Token
  const genBtn = page.locator('button:has-text("Generate Access Token")').first();
  if (await genBtn.isVisible().catch(() => false)) {
    await genBtn.click();
    console.log('');
    console.log('⚠️ 팝업에서 "계속" 또는 "허용" 클릭 후 토큰이 나오면');
    console.log('   터미널에 토큰을 붙여넣고 엔터 입력해주세요 ➡️');
  }

  // 사용자 입력 대기
  console.log('');
  console.log('📋 토큰을 입력하세요 (붙여넣기 후 엔터):');
  const token = await new Promise(resolve => {
    process.stdin.once('data', (data) => {
      resolve(data.toString().trim());
    });
  });

  if (token && token.length > 50) {
    // .env 업데이트
    let env = fs.readFileSync(ENV_PATH, 'utf-8');
    env = env.replace(/INSTAGRAM_ACCESS_TOKEN=.*/g, `INSTAGRAM_ACCESS_TOKEN=${token}`);
    fs.writeFileSync(ENV_PATH, env);
    console.log('✅ 토큰이 .env에 저장됨!');

    // Graph API 테스트
    console.log('🔄 토큰 테스트 중...');
    const res = await fetch(`https://graph.facebook.com/v22.0/me/accounts?access_token=${token}`).then(r => r.json());
    console.log('📋 Pages:', JSON.stringify(res.data, null, 2));

    if (res.data && res.data.length > 0) {
      const pageId = res.data[0].id;
      const instaRes = await fetch(`https://graph.facebook.com/v22.0/${pageId}?fields=instagram_business_account&access_token=${token}`).then(r => r.json());
      console.log('📋 Instagram:', JSON.stringify(instaRes, null, 2));

      if (instaRes.instagram_business_account?.id) {
        env = fs.readFileSync(ENV_PATH, 'utf-8');
        env = env.replace(/INSTAGRAM_BUSINESS_ID=.*/g, `INSTAGRAM_BUSINESS_ID=${instaRes.instagram_business_account.id}`);
        fs.writeFileSync(ENV_PATH, env);
        console.log(`✅ INSTAGRAM_BUSINESS_ID = ${instaRes.instagram_business_account.id}`);
      }
    }
  }

  console.log('');
  console.log('✅ 모든 설정 완료!');
  console.log(`📁 .env 파일 확인: ${ENV_PATH}`);

  await browser.close();
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
