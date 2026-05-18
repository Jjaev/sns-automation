// caption.js — AI 캡션 생성기 (멀티플랫폼 지원)
// DeepSeek 키가 없으면 Notion Caption 필드를 그대로 사용 (0원)

import fetch from 'node-fetch';

const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions';

/**
 * 플랫폼별 톤/길이 가이드
 */
const PLATFORM_GUIDES = {
  Instagram: 'Korean, casual & friendly, 100-200 chars, 3-5 hashtags, emojis OK',
  LinkedIn: 'Korean, professional yet approachable, 200-500 chars, no hashtags, value-focused',
  Twitter: 'Korean, concise & punchy, under 280 chars, 1-2 hashtags max',
};

/**
 * DeepSeek API로 플랫폼별 캡션 생성
 * @param {object} post - { name, caption, platform, account }
 * @returns {string} 생성된 캡션
 */
export async function generateCaption(post) {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  // 키 없으면 원본 caption 반환
  if (!apiKey) {
    return post.caption || '';
  }

  const guide = PLATFORM_GUIDES[post.platform] || PLATFORM_GUIDES.Instagram;

  const prompt = `You are a Korean social media manager. Create a caption for this post.

Title: "${post.name}"
Platform: ${post.platform || 'Instagram'}
Account: ${post.account || 'general'}

Style guide:
- ${guide}

${post.caption ? `Client's reference: ${post.caption}` : ''}

Caption:`;

  const body = {
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 400,
    temperature: 0.7,
  };

  try {
    const res = await fetch(DEEPSEEK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.warn(`DeepSeek API error (${res.status}), fallback to original caption`);
      return post.caption || '';
    }

    const data = await res.json();
    const caption = data.choices?.[0]?.message?.content?.trim();
    return caption || post.caption || '';
  } catch (e) {
    console.warn(`DeepSeek call failed: ${e.message}, fallback to original caption`);
    return post.caption || '';
  }
}
