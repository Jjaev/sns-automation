// fb-setup.js — Facebook Developer 앱 설정 자동 도우미
// Playwright로 브라우저 띄워서 로그인/설정 도움
import { chromium } from 'playwright';

const APP_ID = '1263832569067531';
const FB_LOGIN_URL = 'https://www.facebook.com/';
const APP_DASHBOARD_URL = `https://developers.facebook.com/apps/${APP_ID}/`;
const IG_API_URL = `https://developers.facebook.com/apps/${APP_ID}/instagram-graph-api/`;
const GRAPH_EXPLORER_URL = 'https://developers.facebook.com/tools/explorer/';

async function main() {
  console.log('🚀 Facebook Developer 설정 도우미 시작...');
  console.log('📌 브라우저가 열리면 kore.ai.kr 계정으로 로그인하세요.');
  console.log('');

  const browser = await chromium.launch({
    headless: false,  // 네가 직접 봐야 함
    args: ['--no-sandbox'],
  });

  const page = await browser.newPage({
    viewport: { width: 1400, height: 900 },
  });

  // 1. Instagram Graph API 설정 페이지로 이동
  console.log('➡️  Instagram Graph API 설정 페이지로 이동 중...');
  await page.goto(IG_API_URL, { waitUntil: 'networkidle', timeout: 60000 });

  // 2. 로그인 필요하면 대기
  const loginNeeded = await page.locator('input[name="email"], input[name="pass"]').first().isVisible().catch(() => false);
  if (loginNeeded) {
    console.log('🔑 로그인 필요 — 브라우저 창에서 kore.ai.kr 계정으로 로그인해주세요.');
    console.log('   로그인 완료되면 여기서 엔터를 눌러주세요...');
    
    // 엔터 입력 대기
    await new Promise(resolve => {
      process.stdin.once('data', () => resolve());
    });
    
    // 로그인 후 페이지 이동
    await page.goto(IG_API_URL, { waitUntil: 'networkidle', timeout: 30000 });
  }

  console.log('✅ 로그인 확인됨');
  console.log('➡️  Instagram Graph API 설정 중...');

  // 3. "Facebook 로그인이 포함된 API 설정" 찾기
  try {
    // 왼쪽 메뉴에서 "Facebook 로그인이 포함된 API 설정" 클릭
    const fbLoginOption = page.locator('a:has-text("Facebook 로그인이 포함된 API 설정"), a:has-text("Facebook Login")').first();
    if (await fbLoginOption.isVisible().catch(() => false)) {
      await fbLoginOption.click();
      await page.waitForTimeout(2000);
    }

    // "필수 권한 모두 추가" 버튼
    const addPermBtn = page.locator('button:has-text("필수 권한 모두 추가"), button:has-text("Add All Required"), button:has-text("Add All Required Permissions")').first();
    if (await addPermBtn.isVisible().catch(() => false)) {
      await addPermBtn.click();
      await page.waitForTimeout(2000);
      console.log('✅ 필수 권한 추가 완료!');
    }

    // "저장" 버튼 있으면 클릭
    const saveBtn = page.locator('button:has-text("저장"), button:has-text("Save")').first();
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click();
      await page.waitForTimeout(1000);
    }
  } catch (e) {
    console.log('⚠️  자동 설정 중 문제 발생 (수동 진행 필요):', e.message);
  }

  console.log('');
  console.log('✅ 설정 완료! 이제 Graph API Explorer에서 토큰을 생성하세요.');
  console.log('➡️  Graph API Explorer로 이동합니다...');
  
  // 4. Graph API Explorer 열기
  await page.goto(GRAPH_EXPLORER_URL, { waitUntil: 'networkidle' });
  console.log('📋 Graph API Explorer에서 할 일:');
  console.log('   1. 앱 선택: sj ai agency');
  console.log('   2. Permissions에 다음 4개 입력:');
  console.log('      instagram_basic, instagram_content_publish,');
  console.log('      pages_read_engagement, pages_show_list');
  console.log('   3. Generate Access Token 클릭');
  console.log('   4. 토큰 복사 → .env에 입력');

  console.log('');
  console.log('브라우저는 열어둡니다. 다 되면 여기서 Ctrl+C 로 종료하세요.');

  // 브라우저 계속 열어둠
  await new Promise(() => {}); // infinity
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
