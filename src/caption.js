// caption.js — AI 캡션 생성기 (멀티플랫폼 지원)
// DeepSeek 키 O → AI 생성 / 키 X → 템플릿 엔진 fallback (0원, 쓸만함)

import fetch from 'node-fetch';

const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions';

// ─── 해시태그 라이브러리 (10~15개/포스트) ────────────────────────────
// 유입 목적: 각 카테고리에서 다양한 볼륨의 태그를 섞어 
// 소량(도달 정확) + 대량(도달 확장) 조합
const HASHTAGS = {
  automation: [
    '#자동화', '#업무자동화', '#마케팅자동화', '#AI자동화', '#워크플로우',
    '#생산성향상', '#스마트워크', '#디지털전환', '#시간절약', '#효율화',
    '#자동화솔루션', '#일잘러', '#업무효율', '#스마트오피스', '#프로세스자동화',
  ],
  sns: [
    '#SNS마케팅', '#인스타그램', '#인스타관리대행', '#SNS운영', '#콘텐츠마케팅',
    '#소셜미디어', '#인스타팁', '#마케팅전략', '#SNS전략', '#피드관리',
    '#인스타그램마케팅', '#인스타계정', '#인스타피드', '#SNS관리', '#게시물관리',
    '#인스타늘리기', '#인스타소통', '#인스타그램팁', '#SNS마케터', '#인스타관리',
  ],
  ai: [
    '#인공지능', '#AI', '#챗GPT활용', '#AI도구', '#생성형AI',
    '#AI마케팅', '#AI활용법', '#똑똑한기술', '#AITREND', '#스마트AI',
    '#AI비서', '#AI자동화', '#챗GPT', '#생성형AI도구', '#AI트렌드',
    '#AI코워커', '#프롬프트', '#AI서비스', '#인공지능마케팅', '#GPT',
  ],
  smallbiz: [
    '#소상공인', '#자영업자', '#1인기업', '#스타트업', '#프리랜서',
    '#소규모비즈니스', '#창업꿀팁', '#사용설명서', '#온라인비즈니스', '#혼자하는일',
    '#소상공인마케팅', '#자영업팁', '#매장운영', '#동네가게', '#소상공인지원',
    '#자영업고민', '#내가게', '#오프라인매장', '#자영업일기', '#소자본창업',
  ],
  marketing: [
    '#마케팅', '#디지털마케팅', '#온라인마케팅', '#성과마케팅', '#그로스해킹',
    '#마케터필수', '#요즘마케팅', '#데이터마케팅', '#전환최적화', '#리드확보',
    '#마케팅공부', '#마케팅인사이트', '#콘텐츠전략', '#마케터라이프', '#퍼포먼스마케팅',
    '#바이럴마케팅', '#마케팅전문가', '#브랜딩', '#마케팅트렌드', '#온라인광고',
  ],
  tip: [
    '#꿀팁', '#노하우', '#실전팁', '#정보공유', '#초보가능',
    '#쉽게배우기', '#오늘부터', '#바로적용', '#저장해두기', '#실용정보',
    '#꿀팁저장', '#알아두면쓸데있는', '#생활꿀팁', '#도움되는정보', '#유용한정보',
    '#꿀팁대방출', '#초보탈출', '#실무팁', '#따라하기', '#바로써먹기',
  ],
  biz: [
    '#비즈니스', '#비즈니스팁', '#회사생활', '#직장인', '#스몰비즈니스',
    '#수익창출', '#돈되는정보', '#경제적자유', '#파이프라인', '#지속가능경영',
    '#비즈니스성장', '#매출늘리기', '#고객유치', '#비즈니스모델', '#수익모델',
    '#경제공부', '#재테크', '#부업', '#사이드프로젝트', '#N잡',
  ],
  growth: [
    '#계정성장', '#팔로워늘리기', '#인스타성장', '#계정관리', '#팔로워증가',
    '#인스타활성화', '#계정최적화', '#성장전략', '#도달률높이기', '#인게이지먼트',
    '#팔로워소통', '#계정분석', '#인스타통계', '#성장하는계정', '#활성화전략',
  ],
  content: [
    '#콘텐츠', '#콘텐츠제작', '#콘텐츠기획', '#콘텐츠전략', '#콘텐츠크리에이터',
    '#피드제작', '#이미지제작', '#디자인팁', '#피드디자인', '#콘텐츠캘린더',
    '#콘텐츠아이디어', '#포스팅아이디어', '#게시물디자인', '#콘텐츠마케터', '#인스타콘텐츠',
  ],
  engage: [
    '#소통', '#댓글소통', '#DM', '#이웃소통', '#인스타소통',
    '#소통해요', '#서로이웃', '#이웃환영', '#소통왕', '#활발한소통',
    '#맞팔', '#선팔', '#일촌', '#소통해요', '#피드이웃',
  ],
  tools: [
    '#노션', '#Notion', '#노션활용', '#노션템플릿', '#생산성도구',
    '#디지털도구', '#온라인도구', '#협업도구', '#프로젝트관리', '#스케줄관리',
    '#노션꿀팁', '#노션대시보드', '#노션정리', '#노션업무', '#노션마스터',
  ],
  local: [
    '#지역마케팅', '#동네홍보', '#지역소상공인', '#우리동네', '#지역사랑',
    '#동네가게홍보', '#지역자영업자', '#로컬비즈니스', '#상권분석', '#지역경제',
    '#우리동네맛집', '#동네카페', '#지역맛집', '#동네소식', '#내지역',
  ],
};

// 카테고리별 해시태그 조합 생성 (10~15개)
function pickHashtags(topics = []) {
  const pool = topics.length > 0
    ? topics.flatMap(t => HASHTAGS[t] || [])
    : [...HASHTAGS.sns, ...HASHTAGS.automation];
  // 중복 제거 + 랜덤 셔플 후 10~15개
  const unique = [...new Set(pool)];
  const shuffled = unique.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 12 + Math.floor(Math.random() * 4));
}

// ─── 캡션 템플릿 (AI 키 없을 때 fallback) ──────────────────────────
// 여러 템플릿 중 랜덤 선택 + title 삽입 + 해시태그 조합
function templateCaption(title, topics = []) {
  const tags = pickHashtags(topics).join(' ');

  const templates = [
    // 템플릿 1 — 질문형 hook
    (t) => `🤔 "${t}"\n\n"이거 나만 몰랐나?" 싶은 내용 가져왔습니다.\n\n요즘 SNS 운영하는 분들이라면 꼭 알아야 할 핵심만 정리했어요.\n\n저장해두고 하나씩 적용해보세요 👇\n\n${tags}`,

    // 템플릿 2 — 혜택/결과 강조
    (t) => `💡 ${t}\n\nSNS 운영, 더 이상 어렵게 하지 마세요.\n이 방법 하나면 시간은 절반으로, 효율은 두 배로.\n\n지금 시작하면 늦지 않습니다.\n\n궁금한 점은 DM 주세요!\n\n${tags}`,

    // 템플릿 3 — 공감형
    (t) => `😅 "${t}"\n\n혹시 이런 고민, 한 번쯤 해보셨나요?\n- 시간은 부족한데 SNS는 해야 하고\n- 도대체 뭘 올려야 할지 모르겠고\n- 했는데도 반응이 없고\n\n걱정 마세요. 방법이 있습니다.\n\n하나씩 알려드릴게요 ✨\n\n${tags}`,

    // 템플릿 4 — 간결 팁형
    (t) => `📌 ${t}\n\n3가지만 기억하세요:\n1. 꾸준함이 답이다\n2. 도구를 활용하라\n3. 데이터로 개선하라\n\n이 중에 지금 실천할 수 있는 것부터 해보세요.\n\n${tags}`,

    // 템플릿 5 — 이야기형
    (t) => `📖 ${t}\n\n처음엔 저도 몰랐습니다.\n"이게 되네?" 싶은 순간이 있었어요.\n\n이 방법을 알게 된 이후로\nSNS 운영 시간이 70% 줄었습니다.\n\n여러분도 충분히 할 수 있어요 💪\n\n${tags}`,

    // 템플릿 6 — CTA형 (사이트 유입 유도)
    (t) => `🎯 ${t}\n\nSNS 운영, 자동화로 해결하세요.\nNotion 하나로 관리하는 AI 기반 시스템이면\n하루 10분이면 충분합니다.\n\n👉 프로필 링크에서 무료 진단 받아보세요\n\n${tags}`,

    // 템플릿 7 — 저장 유도형 (바이럴)
    (t) => `📌 "${t}" — 저장하고 나중에 보세요!\n\nSNS 운영에 지친 자영업자분들,\n이 방법 하나면 해결됩니다.\n\n저장해두고 필요할 때 꺼내보세요.\n\n더 많은 꿀팁은 프로필 링크에서 확인 가능합니다 🔗\n\n${tags}`,

    // 템플릿 8 — 무료 진단 유도형
    (t) => `⚡ ${t}\n\n"내 인스타, 제대로 운영되고 있는 걸까?"\n궁금하시다면 지금 바로 확인해보세요.\n\n👉 프로필 링크 → 무료 SNS 진단\n3분이면 내 계정 상태를 알 수 있습니다.\n\n${tags}`,
  ];

  const pick = templates[Math.floor(Math.random() * templates.length)];
  return pick(title);
}

// ─── DeepSeek API 공통 호출 ────────────────────────────────────────
async function callDeepSeek(prompt, temperature = 0.7, maxTokens = 400) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(DEEPSEEK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

// ─── 공개 함수 ─────────────────────────────────────────────────────

/**
 * 일반 SNS 캡션 생성
 * - DeepSeek 키 O: AI 생성 (hashtags 포함)
 * - DeepSeek 키 X: 템플릿 fallback (hashtags 포함)
 */
export async function generateCaption(post) {
  const title = post.name || '';
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (apiKey) {
    // AI 모드: 캡션 + 해시태그 10~15개
    const prompt = `You are a Korean Instagram marketing expert. Create an engaging caption for this post.

Title: "${title}"

Requirements:
- Write in Korean, casual & friendly tone
- Start with a hook (question or surprising fact)
- Include practical value (tip, insight, or lesson)
- End with a CTA (save, DM, or follow)
- Include 12-15 RELEVANT hashtags at the end
- Total length: 150-300 chars (excluding hashtags)
- Hashtags must be Korean + English mix, relevant to SNS/automation/marketing

Caption:`;

    const result = await callDeepSeek(prompt, 0.7, 500);
    if (result) return result;
  }

  // Fallback: 템플릿 엔진
  const topics = inferTopics(title);
  return templateCaption(title, topics);
}

/**
 * 광고/마케팅 카피 생성 (훅 + CTA + 혜택 중심)
 */
export async function generateAdCopy(post) {
  const title = post.name || '';
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (apiKey) {
    const prompt = `You are a Korean direct-response copywriter. Create AD COPY for this offer.

Offer: "${title}"
Platform: Instagram
Target: Korean small business owners (30-50, busy, want automation)

Requirements:
- Hook (1 line, curiosity/benefit)
- Problem (1 line, "혹시 이런 고민 있나요?")
- Solution (2-3 lines, how it solves)
- CTA (1 line, "지금 시작하세요")
- 10-12 relevant hashtags
- Warm but urgent tone
- Max 200 chars (excluding hashtags)

AD COPY:`;

    const result = await callDeepSeek(prompt, 0.8, 500);
    if (result) return result;
  }

  // Fallback: 광고용 템플릿
  const hubbub = [
    '이걸 안 하면 손해입니다',
    'SNS 운영, 이렇게 쉬웠나?',
    '당신의 시간이 소중하다면',
    '더 이상 SNS에 시간 낭비하지 마세요',
  ];
  const hook = hubbub[Math.floor(Math.random() * hubbub.length)];
  const tags = pickHashtags(['sns', 'marketing', 'smallbiz']).join(' ');

  return `${title}\n\n${hook}\n\n혼자서 SNS 운영하시나요?\n자동화로 해결하세요. 시간 70% 절약.\n\n지금 바로 시작할 수 있습니다 💪\n\n${tags}`;
}

/**
 * 3가지 캡션 변형 생성 (A/B 테스트용)
 */
export async function generateVariants(post, count = 3) {
  const title = post.name || '';
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (apiKey) {
    const prompt = `You are a Korean social media manager. Create ${count} DIFFERENT caption variants for this post.

Title: "${title}"

Requirements:
- Each variant must have a DIFFERENT angle (educational / emotional / humorous / urgent)
- Include 10-12 relevant hashtags per variant
- Korean, casual & friendly
- Max 200 chars per variant (excluding hashtags)
- Number as "Variant 1:", "Variant 2:", etc.`;

    const result = await callDeepSeek(prompt, 0.9, 700);
    if (result) {
      const variants = result.split(/Variant \d:/).filter(v => v.trim());
      if (variants.length > 0) return variants.map(v => v.trim());
    }
  }

  // Fallback: 템플릿 3개
  const topics = inferTopics(title);
  return [
    templateCaption(title, topics),
    templateCaption(title, [...topics, 'marketing']),
    templateCaption(title, [...topics, 'tip']),
  ];
}

// ─── 헬퍼 ──────────────────────────────────────────────────────────

/** 제목에서 키워드 기반 카테고리 추론 */
function inferTopics(title) {
  const t = (title || '').toLowerCase();
  const topics = [];
  if (/자동화|워크플로우|효율|pipe|bot|자동|batch|cron/i.test(t)) topics.push('automation');
  if (/sns|인스타|소셜|instagram|feed|피드|팔로워|계정/i.test(t)) topics.push('sns');
  if (/ai|인공지능|챗|gpt|봇|learn/i.test(t)) topics.push('ai');
  if (/소상공|자영업|1인|창업|프리랜서|스타트업|동네|지역/i.test(t)) topics.push('smallbiz');
  if (/마케팅|광고|리드|전환|고객|브랜드/i.test(t)) topics.push('marketing');
  if (/팁|꿀팁|방법|가이드|how|노하우|저장|꿀/i.test(t)) topics.push('tip');
  if (/비즈니스|수익|돈|경제|매출|사업/i.test(t)) topics.push('biz');
  if (/성장|팔로워|늘리기|활성화|도달|인게이지/i.test(t)) topics.push('growth');
  if (/콘텐츠|제작|디자인|이미지|피드/i.test(t)) topics.push('content');
  if (/소통|댓글|이웃|맞팔|dm/i.test(t)) topics.push('engage');
  if (/노션|notion|도구|템플릿|툴|관리/i.test(t)) topics.push('tools');
  if (/지역|동네|로컬|우리동네|맛집|상권/i.test(t)) topics.push('local');
  return topics.length > 0 ? topics : ['sns', 'automation', 'tip'];
}
