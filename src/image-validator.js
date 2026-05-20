// image-validator.js — AI 기반 이미지 품질 검증
// Gemini API (무료)로 이미지 분석 → 품질 점수 + 설명 + 문제 감지
// 키 없으면 basic 검증만 (기존 SHA256 중복 체크)

// Gemini API 엔드포인트 (무료 티어)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_API = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash';

import { fingerprintImage, checkDuplicate, markImageUsed } from './images.js';

export async function analyzeImageQuality(imageUrl) {
  if (!GEMINI_API_KEY) {
    return basicCheck(imageUrl);
  }

  try {
    const result = await geminiAnalysis(imageUrl);
    return result;
  } catch (err) {
    console.error(`[WARN] Gemini analysis failed: ${err.message}`);
    return basicCheck(imageUrl);
  }
}

// === Gemini 기반 이미지 분석 ===
async function geminiAnalysis(imageUrl) {
  // 1. 이미지 다운로드 → base64
  const res = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const buffer = Buffer.from(await res.arrayBuffer());
  const base64 = buffer.toString('base64');

  // 2. Gemini API 호출 — 이미지 + 품질 평가 프롬프트
  const prompt = `You are an Instagram image quality inspector. Analyze this image and return ONLY valid JSON:

{
  "score": 0-100,
  "is_blurry": true/false,
  "aspect_ratio_ok": true/false,
  "issues": ["issue1", "issue2"],
  "description_kr": "이미지에 대한 간단한 한국어 설명 (10-15자)"
}

Rules:
- Score < 40 = do NOT post (too low quality)
- Check: blur, compression artifacts, watermarks, text readability
- Aspect ratio should be near 1:1 (square) for Instagram
- Description_kr: VERY short, just what's in the image`;

  const apiRes = await fetch(`${GEMINI_API}:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: contentType, data: base64 } }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 200,
      }
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!apiRes.ok) {
    const errText = await apiRes.text().catch(() => '');
    throw new Error(`Gemini API ${apiRes.status}: ${errText.slice(0, 200)}`);
  }

  const data = await apiRes.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // JSON 파싱 시도
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        method: 'gemini',
        ...parsed,
        raw: text.slice(0, 200),
      };
    }
  } catch {}

  return {
    method: 'gemini',
    score: 50,
    is_blurry: false,
    aspect_ratio_ok: true,
    issues: ['Could not parse AI response'],
    description_kr: '분석 실패',
    raw: text.slice(0, 200),
  };
}

// === Basic 기술 검증 (API 키 없을 때) ===
async function basicCheck(imageUrl) {
  try {
    // 첫 4KB만 다운로드해서 이미지 타입 확인
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(imageUrl, { signal: controller.signal });
    if (!res.ok) {
      clearTimeout(timer);
      controller.abort();
      return {
        method: 'basic',
        score: 0,
        is_valid: false,
        issues: [`HTTP ${res.status}`],
        description_kr: '접근 불가',
      };
    }

    const contentType = res.headers.get('content-type') || '';
    const contentLength = parseInt(res.headers.get('content-length') || '0', 10);

    // body 일부만 읽고 연결 종료
    try { await res.arrayBuffer(); } catch {}
    clearTimeout(timer);

    const issues = [];
    let score = 80;

    if (!contentType.startsWith('image/')) {
      issues.push(`Not an image: ${contentType}`);
      score -= 40;
    }
    if (contentLength > 0 && contentLength < 1024) {
      issues.push(`Too small: ${contentLength} bytes`);
      score -= 30;
    }
    if (contentLength > 5 * 1024 * 1024) {
      issues.push(`Too large: ${(contentLength / 1024 / 1024).toFixed(1)}MB`);
      score -= 10;
    }

    return {
      method: 'basic',
      score: Math.max(0, score),
      is_valid: score >= 40,
      contentType,
      contentLength,
      issues,
      description_kr: `${contentLength > 0 ? Math.round(contentLength / 1024) + 'KB' : '크기확인불가'} 이미지`,
    };
  } catch (err) {
    return {
      method: 'basic',
      score: 0,
      is_valid: false,
      issues: [err.message],
      description_kr: '확인 실패',
    };
  }
}

// === 게시 전 최종 판단 ===
// 기존 validateAndReplace() + 품질 검증 통합
export async function fullImageValidation(imageUrl, postName) {
  const result = {
    imageUrl,
    passed: true,
    warnings: [],
    quality: null,
  };

  // 1. 이미지 핑거프린트 + 중복 체크
  const fp = await fingerprintImage(imageUrl);
  if (fp.hash) {
    const dup = checkDuplicate(fp.hash);
    if (dup.isDuplicate) {
      result.passed = false;
      result.warnings.push(`중복 이미지 (${dup.timesUsed}회 사용, 마지막: ${dup.lastUsed?.slice(0,10)})`);
      return result;
    }
    markImageUsed(fp.hash, { url: imageUrl });
  }

  // 2. 품질 분석
  const quality = await analyzeImageQuality(imageUrl);
  result.quality = quality;

  if (quality.score < 40) {
    result.passed = false;
    result.warnings.push(`품질 미달: ${quality.score}점 — ${quality.issues?.join(', ')}`);
  } else if (quality.score < 70) {
    result.warnings.push(`품질 보통: ${quality.score}점 — ${quality.issues?.join(', ')}`);
    // 70점 이상이면 패스 (경고만)
  }

  if (quality.description_kr) {
    result.description = quality.description_kr;
  }

  return result;
}
