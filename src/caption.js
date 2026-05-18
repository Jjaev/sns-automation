// caption.js — AI 캡션 생성기 (DeepSeek API)
// DeepSeek 키가 없으면 Notion Caption 필드를 그대로 사용 (0원)

import fetch from 'node-fetch';

const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions';

/**
 * DeepSeek API로 캡션 생성
 * @param {object} post - { name, caption (optional), platform }
 * @returns {string} 생성된 캡션
 */
export async function generateCaption(post) {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  // 키 없으면 원본 caption 반환 (Notion에 입력한 그대로)
  if (!apiKey) {
    return post.caption || '';
  }

  const prompt = `You are a Korean social media manager. Create an engaging Instagram caption for this post.

Post title: "${post.name}"

Requirements:
- Write in Korean
- Include relevant hashtags (3-5)
- Keep it concise (under 200 characters)
- Engaging and friendly tone
- Target platform: ${post.platform || 'Instagram'}

${post.caption ? `Reference content from client: ${post.caption}` : ''}

Caption:`;

  const body = {
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 300,
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
