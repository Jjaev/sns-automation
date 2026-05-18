// instagram.js — Instagram Graph API 업로드
import fetch from 'node-fetch';

const GRAPH_BASE = 'https://graph.facebook.com/v22.0';

/**
 * Instagram에 이미지 포스트 생성 및 발행
 * @param {object} post - { caption, imageUrl }
 * @returns {string} media_id
 */
export async function publishPhoto(post) {
  const { caption, imageUrl } = post;
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const businessId = process.env.INSTAGRAM_BUSINESS_ID;

  if (!accessToken || !businessId) {
    throw new Error(
      'Instagram credentials not configured.\n' +
      'Set INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_BUSINESS_ID in .env\n' +
      'Facebook Dev Setting guide: https://developers.facebook.com/docs/instagram-api/getting-started'
    );
  }

  // Step 1: Create media container
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

  // Step 2: Publish the container
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
 * Instagram Business 계정 ID 조회 (Facebook Page → Instagram)
 * @param {string} facebookPageId - Facebook Page ID
 */
export async function getInstagramBusinessId(facebookPageId) {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const res = await fetch(
    `${GRAPH_BASE}/${facebookPageId}?fields=instagram_business_account&access_token=${accessToken}`
  );
  const data = await res.json();
  return data.instagram_business_account?.id || null;
}

// --- CLI 테스트 ---
if (process.argv[1]?.includes('instagram') && process.argv.includes('--test')) {
  if (!process.env.INSTAGRAM_ACCESS_TOKEN) {
    console.log('Instagram not configured. Skipping test.');
    process.exit(0);
  }
  console.log('Instagram module loaded. Ready to publish.');
}
