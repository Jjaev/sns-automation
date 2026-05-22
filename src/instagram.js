// instagram.js — Instagram Graph API 업로드 (멀티계정 + 하위호환)
import fetch from 'node-fetch';

const GRAPH_BASE = 'https://graph.facebook.com/v22.0';

/**
 * 계정명으로 토큰/비즈니스ID 조회
 * 신규: INSTAGRAM_ACCOUNTS JSON에서 조회
 * 구형: INSTAGRAM_ACCESS_TOKEN + INSTAGRAM_BUSINESS_ID (하위호환)
 */
function getAccountConfig(accountName) {
  const newConfig = process.env.INSTAGRAM_ACCOUNTS;

  // 신규 방식: JSON config
  if (newConfig) {
    let accounts;
    try {
      accounts = JSON.parse(newConfig);
    } catch (e) {
      throw new Error(`INSTAGRAM_ACCOUNTS JSON parse failed: ${e.message}`);
    }

    if (accountName) {
      const config = accounts[accountName];
      if (!config) {
        throw new Error(
          `Account "${accountName}" not found.\n` +
          `Available: ${Object.keys(accounts).join(', ')}`
        );
      }
      return config;
    }

    // 첫 번째 계정 반환 (accountName 없을 때)
    const firstKey = Object.keys(accounts)[0];
    if (firstKey) return accounts[firstKey];
  }

  // 구형 방식: 단일 계정 (하위호환)
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const businessId = process.env.INSTAGRAM_BUSINESS_ID;
  if (token && businessId) {
    return { token, businessId };
  }

  throw new Error(
    'Instagram credentials not configured.\n' +
    'Option 1: Set INSTAGRAM_ACCOUNTS={"account":{"token":"...","businessId":"..."}}\n' +
    'Option 2: Set INSTAGRAM_ACCESS_TOKEN + INSTAGRAM_BUSINESS_ID (legacy)'
  );
}

/**
 * Instagram에 이미지 포스트 생성 및 발행
 * @param {object} post - { caption, imageUrl, account }
 * @returns {string} media_id
 */
export async function publishPhoto(post) {
  const { caption, imageUrl, account } = post;
  const config = getAccountConfig(account);
  const { token: accessToken, businessId } = config;

  const createUrl = `${GRAPH_BASE}/${businessId}/media`;
  const createParams = new URLSearchParams({
    image_url: imageUrl,
    caption: caption,
    access_token: accessToken,
  });

  const createRes = await fetch(`${createUrl}?${createParams}`, { method: 'POST' });
  const createData = await createRes.json();

  if (createData.error) {
    throw new Error(`Instagram media create failed: ${createData.error.message}`);
  }

  const containerId = createData.id;

  const publishUrl = `${GRAPH_BASE}/${businessId}/media_publish`;
  const publishParams = new URLSearchParams({
    creation_id: containerId,
    access_token: accessToken,
  });

  const publishRes = await fetch(`${publishUrl}?${publishParams}`, { method: 'POST' });
  const publishData = await publishRes.json();

  if (publishData.error) {
    throw new Error(`Instagram publish failed: ${publishData.error.message}`);
  }

  return publishData.id;
}

/**
 * Instagram Reels 게시 (릴스 탭 + 피드)
 * @param {object} post - { caption, videoUrl, account, shareToFeed }
 * @returns {string} media_id
 */
export async function publishReel(post) {
  const { caption, videoUrl, account, shareToFeed = true } = post;
  const config = getAccountConfig(account);
  const { token: accessToken, businessId } = config;

  // Step 1: Create REELS media container
  const createUrl = `${GRAPH_BASE}/${businessId}/media`;
  const params = new URLSearchParams({
    media_type: 'REELS',
    video_url: videoUrl,
    caption: caption,
    share_to_feed: shareToFeed ? 'true' : 'false',
    access_token: accessToken,
  });

  const createRes = await fetch(`${createUrl}?${params}`, { method: 'POST' });
  const createData = await createRes.json();

  if (createData.error) {
    throw new Error(`Instagram Reels create failed: ${createData.error.message}`);
  }

  const containerId = createData.id;

  // Step 2: Retry publish until ready (IG needs time to process video)
  const MAX_RETRIES = 6;
  const RETRY_DELAY = 10000; // 10초

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    // Wait before trying (first attempt also waits - IG needs processing time)
    if (attempt > 1) {
      console.log(`  ⏳ Waiting ${RETRY_DELAY/1000}s for video processing (attempt ${attempt}/${MAX_RETRIES})...`);
    }
    await new Promise(r => setTimeout(r, attempt === 1 ? 5000 : RETRY_DELAY));

    const publishUrl = `${GRAPH_BASE}/${businessId}/media_publish`;
    const publishParams = new URLSearchParams({
      creation_id: containerId,
      access_token: accessToken,
    });

    const publishRes = await fetch(`${publishUrl}?${publishParams}`, { method: 'POST' });
    const publishData = await publishRes.json();

    if (!publishData.error) {
      return publishData.id; // ✅ 성공
    }

    const errMsg = publishData.error.message;

    // "Media ID is not available" = 아직 처리 중 → 재시도
    if (errMsg.includes('Media ID is not available') || errMsg.includes('processing')) {
      continue;
    }

    // 다른 에러 = 실패
    throw new Error(`Instagram Reels publish failed: ${errMsg}`);
  }

  throw new Error(`Instagram Reels publish failed after ${MAX_RETRIES} retries: video processing timeout`);
}

export async function getInstagramBusinessId(facebookPageId, accountName) {
  const config = getAccountConfig(accountName);
  const res = await fetch(
    `${GRAPH_BASE}/${facebookPageId}?fields=instagram_business_account&access_token=${config.token}`
  );
  const data = await res.json();
  return data.instagram_business_account?.id || null;
}
