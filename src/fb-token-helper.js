// fb-token-helper.js — Graph API 토큰 자동 생성 도우미
import { chromium } from 'playwright';

const APP_ID = '1263832569067531';
const GRAPH_EXPLORER = `https://developers.facebook.com/tools/explorer/?app_id=${APP_ID}`;

async function main() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox'],
  });

  const page = await browser.newPage({
    viewport: { width: 1400, height: 900 },
  });

  // 1. Graph API Explorer 열기
  console.log('📂 Graph API Explorer를 엽니다...');
  await page.goto(GRAPH_EXPLORER, { waitUntil: 'networkidle', timeout: 60000 });

  // 2. 로그인 필요하면 대기
  const needsLogin = await page.locator('input[name="email"]').first().isVisible().catch(() => false);
  if (needsLogin) {
    console.log('🔑 로그인 필요! 브라우저에서 kore.ai.kr 계정으로 로그인하세요.');
    console.log('   로그인 완료되면 터미널에서 엔터를 눌러주세요 ➡️');
    await new Promise(r => process.stdin.once('data', () => r()));
    // 재이동
    await page.goto(GRAPH_EXPLORER, { waitUntil: 'networkidle' });
  }

  console.log('✅ 로그인됨');

  // 3. 앱 선택
  await page.waitForTimeout(2000);
  
  // 앱 선택 드롭다운
  const appDropdown = page.locator('div[aria-haspopup="listbox"]:has-text("앱"), div[aria-haspopup="listbox"]:has-text("App")').first();
  if (await appDropdown.isVisible().catch(() => false)) {
    await appDropdown.click();
    await page.waitForTimeout(1000);
    
    // sj ai agency 선택
    const appOption = page.locator('div[role="option"]:has-text("sj ai agency")').first();
    if (await appOption.isVisible().catch(() => false)) {
      await appOption.click();
      await page.waitForTimeout(1000);
      console.log('✅ 앱 선택: sj ai agency');
    }
  }

  // 4. Permissions에 권한 추가
  const permissions = ['instagram_basic', 'instagram_content_publish', 'pages_read_engagement', 'pages_show_list'];
  
  for (const perm of permissions) {
    const permInput = page.locator('input[placeholder="권한 추가"], input[placeholder="Add a Permission"]').first();
    if (await permInput.isVisible().catch(() => false)) {
      await permInput.click();
      await permInput.fill(perm);
      await page.waitForTimeout(500);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      console.log(`  ✅ 권한 추가: ${perm}`);
    }
  }

  // 5. Generate Token 버튼
  console.log('🔄 Generate Access Token 클릭 중...');
  const genBtn = page.locator('button:has-text("Generate Access Token")').first();
  if (await genBtn.isVisible().catch(() => false)) {
    await genBtn.click();
    console.log('⚠️  팝업이 뜨면 "계속" 또는 "허용"을 클릭해주세요.');
    console.log('   토큰이 생성되면 복사해서 알려주세요!');
  }

  console.log('');
  console.log('📋 브라우저는 열어둡니다.');
  console.log('✅ 완료되면 여기서 Ctrl+C 로 종료하세요.');

  await new Promise(() => {});
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
