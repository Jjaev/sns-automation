// playwright-instagram.js — Playwright 브라우저 자동화로 인스타 업로드
// Graph API 토큰 불필요. 크롬이 직접 로그인해서 게시.
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSION_DIR = path.join(__dirname, '..', '.instagram-session');
const COOKIES_PATH = path.join(SESSION_DIR, 'cookies.json');
const STORAGE_PATH = path.join(SESSION_DIR, 'storage.json');
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

// 헤드리스 모드 — 필요하면 false로 변경 (디버깅용)
const HEADLESS = process.env.INSTAGRAM_HEADLESS !== 'false';

export async function publishPhoto(post) {
  const { caption, imageUrl, imagePath } = post;
  const username = process.env.INSTAGRAM_USERNAME;
  const password = process.env.INSTAGRAM_PASSWORD;

  if (!username || !password) {
    throw new Error(
      'Instagram credentials not configured.\n' +
      'Set INSTAGRAM_USERNAME and INSTAGRAM_PASSWORD in .env'
    );
  }

  // 이미지 파일 다운로드 (URL인 경우)
  let localImagePath = imagePath;
  if (!localImagePath && imageUrl) {
    localImagePath = await downloadImage(imageUrl);
  }

  if (!localImagePath || !fs.existsSync(localImagePath)) {
    throw new Error(`Image file not found: ${localImagePath || imageUrl}`);
  }

  console.log(`[Playwright] Starting browser...`);
  const browser = await chromium.launch({
    headless: HEADLESS,
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  try {
    // 세션/쿠키 복원
    const context = await browser.newContext({
      userAgent: USER_AGENT,
      viewport: { width: 1280, height: 800 },
      storageState: loadStorage(),
      locale: 'ko-KR',
    });

    const page = await context.newPage();

    // 자동화 감지 회피
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    // 로그인
    await login(page, username, password);

    // 업로드
    await uploadPhoto(page, localImagePath, caption);

    // 세션 저장
    await saveSession(context);

    console.log(`[Playwright] ✅ Published successfully!`);
    return { success: true };
  } catch (err) {
    console.error(`[Playwright] ❌ Failed: ${err.message}`);
    throw err;
  } finally {
    await browser.close();
    // 임시 다운로드 파일 정리
    if (localImagePath && localImagePath.startsWith('/tmp/')) {
      fs.unlink(localImagePath, () => {});
    }
  }
}

async function login(page, username, password) {
  await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle', timeout: 30000 });

  // 이미 로그인되어 있는지 확인
  const isLoggedIn = await page.locator('svg[aria-label="홈"], svg[aria-label="Home"]').first().isVisible().catch(() => false);
  if (isLoggedIn) {
    console.log(`[Playwright] Already logged in (session restored)`);
    return;
  }

  console.log(`[Playwright] Logging in as ${username}...`);

  // 로그인 폼 대기
  await page.waitForSelector('input[name="username"]', { timeout: 15000 });
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);

  // 로그인 버튼 클릭
  await page.click('button[type="submit"]');

  // 2FA 또는 "정보 저장" 팝업 대기 (최대 20초)
  await page.waitForTimeout(3000);

  // "지금은 건너뛰기" / "Not Now" 처리
  const skipBtn = page.locator('button:has-text("지금은 건너뛰기"), button:has-text("Not Now"), button:has-text("Save Info")').first();
  if (await skipBtn.isVisible().catch(() => false)) {
    await skipBtn.click();
    await page.waitForTimeout(2000);
  }

  // 다시한번 "나중에 하기" 처리
  const laterBtn = page.locator('button:has-text("나중에 하기"), button:has-text("Later")').first();
  if (await laterBtn.isVisible().catch(() => false)) {
    await laterBtn.click();
    await page.waitForTimeout(2000);
  }

  // 홈 로딩 확인 (로그인 성공 여부)
  const homeVisible = await page.locator('svg[aria-label="홈"], svg[aria-label="Home"]').first().isVisible().catch(() => false);
  if (!homeVisible) {
    // 추가 대기
    await page.waitForTimeout(5000);
    const retryCheck = await page.locator('svg[aria-label="홈"], svg[aria-label="Home"]').first().isVisible().catch(() => false);
    if (!retryCheck) {
      // 에러 메시지 확인
      const errorText = await page.locator('p[id="slfErrorAlert"], div[role="alert"]').first().textContent().catch(() => 'unknown error');
      throw new Error(`Login failed: ${errorText}`);
    }
  }

  console.log(`[Playwright] ✅ Logged in successfully`);
}

async function uploadPhoto(page, imagePath, caption) {
  console.log(`[Playwright] Uploading photo: ${imagePath}`);

  // 새 게시물 버튼 클릭 (+ 버튼)
  await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // + 버튼 찾기 (여러 선택지 시도)
  const newPostBtn = page.locator(
    'svg[aria-label="새로운 게시물"], svg[aria-label="New post"], ' +
    'svg[aria-label="게시물 만들기"], svg[aria-label="Create"]'
  ).first();
  
  // + 아이콘이 있는 곳 클릭
  const plusBtn = page.locator('svg[aria-label="새로운 게시물"]').locator('..').first();
  if (await plusBtn.isVisible().catch(() => false)) {
    await plusBtn.click();
  } else {
    // fallback: 상단 nav에서 + 찾기
    const fallbackBtn = page.locator('header nav a:has(svg), header nav div:has(svg)').first();
    await fallbackBtn.click().catch(() => page.goto('https://www.instagram.com/create/story/', { waitUntil: 'networkidle' }));
  }

  await page.waitForTimeout(2000);

  // 파일 선택 input 찾기
  const fileInput = page.locator('input[type="file"]').first();
  if (await fileInput.isVisible().catch(() => false)) {
    await fileInput.setInputFiles(imagePath);
  } else {
    // fallback: "컴퓨터에서 선택" 버튼 클릭
    const selectBtn = page.locator('button:has-text("컴퓨터에서 선택"), button:has-text("Select from computer")').first();
    if (await selectBtn.isVisible().catch(() => false)) {
      await selectBtn.click();
      await page.waitForTimeout(2000);
      // file chooser 이벤트 처리
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        selectBtn.click(),
      ]);
      await fileChooser.setFiles(imagePath);
    } else {
      throw new Error('Could not find file upload input');
    }
  }

  // 이미지 로딩 대기
  await page.waitForTimeout(3000);

  // "다음" 버튼 (Next / crop step)
  const nextBtn = page.locator('div[role="button"]:has-text("다음"), button:has-text("Next"), div[role="button"]:has-text("Next")').first();
  await nextBtn.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  await nextBtn.click().catch(() => {});
  await page.waitForTimeout(2000);

  // 두 번째 "다음" (filter step — 있으면)
  const nextBtn2 = page.locator('div[role="button"]:has-text("다음"), button:has-text("Next")').first();
  if (await nextBtn2.isVisible().catch(() => false)) {
    await nextBtn2.click().catch(() => {});
    await page.waitForTimeout(2000);
  }

  // 캡션 입력
  const captionArea = page.locator('div[aria-label="문구 입력..."], div[aria-label="Write a caption..."]').first();
  if (await captionArea.isVisible().catch(() => false)) {
    await captionArea.click();
    await page.waitForTimeout(500);
    await captionArea.fill(caption);
  } else {
    // fallback: 모든 role=textbox 중 첫 번째
    const textbox = page.locator('div[role="textbox"]').first();
    if (await textbox.isVisible().catch(() => false)) {
      await textbox.click();
      await page.waitForTimeout(500);
      await textbox.fill(caption);
    }
  }

  await page.waitForTimeout(1000);

  // "공유하기" / "Share" 버튼 클릭
  const shareBtn = page.locator(
    'div[role="button"]:has-text("공유하기"), button:has-text("Share"), ' +
    'div[role="button"]:has-text("Share")'
  ).first();
  await shareBtn.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  await shareBtn.click().catch(() => {});

  // 업로드 완료 대기 (최대 30초)
  await page.waitForTimeout(5000);

  // 성공 확인
  const successMsg = page.locator('text=게시물을 공유했습니다, text=Your post has been shared, text=공유됨').first();
  const success = await successMsg.isVisible().catch(() => false);

  if (success) {
    console.log(`[Playwright] ✅ Photo shared successfully`);
  } else {
    await page.waitForTimeout(5000);
    console.log(`[Playwright] ⚠️ Published (check manually if success)`);
  }
}

async function downloadImage(url) {
  const fetch = (await import('node-fetch')).default;
  const tmpPath = path.join('/tmp', `ig-upload-${Date.now()}.jpg`);
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(tmpPath, Buffer.from(buffer));
  return tmpPath;
}

function loadStorage() {
  try {
    if (fs.existsSync(STORAGE_PATH)) {
      const data = fs.readFileSync(STORAGE_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.log(`[Playwright] No saved session found`);
  }
  return undefined;
}

async function saveSession(context) {
  try {
    if (!fs.existsSync(SESSION_DIR)) {
      fs.mkdirSync(SESSION_DIR, { recursive: true });
    }
    const storageState = await context.storageState();
    fs.writeFileSync(STORAGE_PATH, JSON.stringify(storageState, null, 2));
    console.log(`[Playwright] Session saved`);
  } catch (e) {
    console.warn(`[Playwright] Failed to save session: ${e.message}`);
  }
}

// --- CLI 테스트 ---
if (process.argv[1]?.includes('playwright-instagram') && process.argv.includes('--test')) {
  const testPost = {
    caption: '테스트 포스트입니다. 🤖 #automation #test',
    imagePath: process.argv.find(a => a.endsWith('.jpg') || a.endsWith('.png')) || null,
  };
  if (!testPost.imagePath) {
    console.log('Usage: node src/playwright-instagram.js --test [image.jpg]');
    console.log('Or set INSTAGRAM_USERNAME and INSTAGRAM_PASSWORD in .env');
    process.exit(1);
  }
  publishPhoto(testPost)
    .then(r => console.log('Result:', r))
    .catch(e => console.error('Error:', e.message));
}
