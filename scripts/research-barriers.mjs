#!/usr/bin/env node

/**
 * research-barriers.mjs
 * 
 * AI가 진입장벽을 무너뜨린 새로운 사례/데이터/시장 동향을
 * 여러 무료 소스에서 수집하여 구조화된 로그로 저장.
 * 
 * 실행: node scripts/research-barriers.mjs
 * cron: 매주 일요일 09:00 KST (GH Actions)
 * 
 * 소스: Hacker News, Reddit, Google News RSS (모두 무료, API 키 불필요)
 */

import fetch from 'node-fetch';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// ===== 설정 =====
const CONFIG = {
  // 검색 키워드 (영문 + 한글)
  keywords: [
    // English
    '"AI" "barrier to entry" "democratize"',
    '"AI" "small business" "enterprise" "now affordable"',
    '"AI" "solo founder" "instead of team"',
    '"AI" "lowered cost" "SMB"',
    '"AI agent" "small business" subscription',
    // 한국어
    '"AI" "진입장벽" "소상공인"',
    '"AI" "1인 기업" "대기업" "서비스"',
  ],

  // 결과 저장 경로 (repo 내 상대 경로)
  outputDir: '분석',
  outputFile: 'ai-barrier-case-studies.md',

  // Notion 연구 DB ID (.env에 있으면 사용)
  notionDbId: process.env.RESEARCH_DATABASE_ID || null,

  // 소스별 설정
  sources: {
    hackernews: { enabled: true, maxResults: 10 },
    reddit: { enabled: true, maxResults: 10 },
    googleNews: { enabled: true, maxResults: 10 },
  },

  // DeepSeek API (선택) - 있으면 요약, 없으면 raw 저장
  deepseekKey: process.env.DEEPSEEK_API_KEY || null,
};

// ===== 수집 모듈 =====

/**
 * Hacker News Algolia API에서 검색
 */
async function searchHackerNews(keyword, maxResults = 10) {
  try {
    const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(keyword)}&tags=story&hitsPerPage=${maxResults}&numericFilters=created_at_i>${Math.floor(Date.now()/1000 - 7*86400)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const data = await res.json();
    return (data.hits || []).map(hit => ({
      source: 'Hacker News',
      title: hit.title || '',
      url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
      points: hit.points || 0,
      author: hit.author || '',
      createdAt: new Date(hit.created_at).toISOString().split('T')[0],
      relevance: hit.points || 0,
    }));
  } catch (err) {
    console.error(`[HN Error] ${keyword}: ${err.message}`);
    return [];
  }
}

/**
 * Reddit JSON API에서 검색
 */
async function searchReddit(keyword, maxResults = 10) {
  try {
    const subreddits = ['artificial', 'artificialintelligence', 'Entrepreneur', 'smallbusiness', 'SaaS', 'Automate'];
    const allResults = [];
    
    for (const sub of subreddits.slice(0, 3)) { // 최대 3개 subreddit
      const url = `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(keyword)}&restrict_sr=1&sort=new&t=week&limit=${Math.ceil(maxResults/3)}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ResearchBot/1.0)' },
        signal: AbortSignal.timeout(10000)
      });
      const data = await res.json();
      const posts = data?.data?.children || [];
      posts.forEach(post => {
        const d = post.data;
        if (d && d.title) {
          allResults.push({
            source: `Reddit r/${sub}`,
            title: d.title,
            url: `https://reddit.com${d.permalink}`,
            points: d.score || 0,
            author: d.author || '',
            createdAt: new Date(d.created_utc * 1000).toISOString().split('T')[0],
            relevance: d.score || 0,
          });
        }
      });
    }
    
    return allResults;
  } catch (err) {
    console.error(`[Reddit Error] ${keyword}: ${err.message}`);
    return [];
  }
}

/**
 * Google News RSS에서 검색 (RSS to JSON 변환)
 */
async function searchGoogleNews(keyword, maxResults = 10) {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=en-US&gl=US&ceid=US:en`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const xml = await res.text();
    
    // 간단한 XML 파싱 (정규식)
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null && items.length < maxResults) {
      const itemXml = match[1];
      const title = itemXml.match(/<title>(.*?)<\/title>/)?.[1] || '';
      const link = itemXml.match(/<link>(.*?)<\/link>/)?.[1] || '';
      const pubDate = itemXml.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
      const source = itemXml.match(/<source>(.*?)<\/source>/)?.[1] || 'Google News';
      
      // HTML entity 디코딩
      const cleanTitle = title
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      
      items.push({
        source: `Google News (${source.trim()})`,
        title: cleanTitle,
        url: link,
        points: 0,
        author: '',
        createdAt: pubDate ? new Date(pubDate).toISOString().split('T')[0] : '',
        relevance: 0,
      });
    }
    
    return items;
  } catch (err) {
    console.error(`[Google News Error] ${keyword}: ${err.message}`);
    return [];
  }
}

/**
 * 수집된 결과에서 관련성 높은 항목 필터링
 */
function filterRelevant(results) {
  // 중복 제거 (같은 URL)
  const seen = new Set();
  const unique = results.filter(r => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  // 관련성 키워드 기반 점수 계산
  const relevanceKeywords = [
    'barrier', 'democratiz', 'small business', 'SMB', 'solo', 'founder',
    'affordable', 'lower cost', '진입장벽', '소상공인', '1인',
    'subscription', 'agent', 'automation', 'no code', 'no-code',
    'enterprise', 'disrupt', 'transform', 'accessib',
    '가격', '비용', '무료', '자동화', 'AI 서비스',
  ];

  return unique
    .map(r => {
      let score = r.relevance || 0;
      const text = `${r.title} ${r.source}`.toLowerCase();
      relevanceKeywords.forEach(kw => {
        if (text.includes(kw.toLowerCase())) score += 2;
      });
      return { ...r, score };
    })
    .filter(r => r.score > 0 && r.title.length > 10)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
}

/**
 * DeepSeek AI로 요약 생성 (선택사항)
 */
async function summarizeWithAI(findings) {
  if (!CONFIG.deepseekKey || findings.length === 0) return null;

  const content = findings.map(f => `- [${f.source}] ${f.title} (${f.url})`).join('\n');
  
  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.deepseekKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{
          role: 'system',
          content: 'You are a market research analyst. Analyze the following AI-related news/articles and extract: 1) Key trend 2) Market opportunity for a solo founder 3) Relevance to "AI lowering barriers to entry" theme. Reply in Korean. Keep concise, 2-3 sentences max.'
        }, {
          role: 'user',
          content: content
        }],
        temperature: 0.3,
        max_tokens: 300,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.warn(`[DeepSeek API] ${res.status}: ${await res.text()}`);
      return null;
    }
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error(`[DeepSeek Error] ${err.message}`);
    return null;
  }
}

// ===== Notion 저장 모듈 =====

/**
 * Notion 연구 DB에 새 항목들을 추가
 */
async function saveToNotion(findings, summary) {
  if (!CONFIG.notionDbId) {
    console.log('  ⏭️ Notion DB ID 없음. 마크다운만 저장.');
    return;
  }

  const BASE = 'https://api.notion.com/v1';
  const h = {
    'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  };

  const today = new Date().toISOString().split('T')[0];
  let saved = 0;
  let errors = 0;

  for (const item of findings.slice(0, 15)) { // max 15 per run
    // Tags 추론: title + source 기반
    const tags = inferTags(item.title, item.source);
    
    // Market 추론
    const market = inferMarket(item.title, item.source);

    const body = {
      parent: { database_id: CONFIG.notionDbId },
      properties: {
        'Title': { title: [{ text: { content: item.title.slice(0, 2000) } }] },
        'Source': { select: { name: item.source.includes('Hacker') ? 'Hacker News' : 
                                   item.source.includes('Reddit') ? 'Reddit' : 
                                   item.source.includes('Google') ? 'Google News' : '직접 발견' } },
        'URL': { url: item.url || null },
        'Summary': { rich_text: [{ text: { content: item.title.slice(0, 2000) } }] },
        'Relevance': { number: item.score || item.relevance || 0 },
        'Discovered': { date: { start: today } },
        'Status': { select: { name: 'New' } },
        'Tags': { multi_select: tags.map(t => ({ name: t })) },
        'Market': market ? { select: { name: market } } : undefined,
      },
    };

    // AI 요약 있으면 추가
    if (summary) {
      body.properties['AI 요약'] = { rich_text: [{ text: { content: summary.slice(0, 2000) } }] };
    }

    // undefined 제거
    for (const [k, v] of Object.entries(body.properties)) {
      if (v === undefined) delete body.properties[k];
    }

    try {
      const res = await fetch(`${BASE}/pages`, {
        method: 'POST',
        headers: h,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        saved++;
      } else {
        const errText = await res.text();
        console.warn(`  ⚠️ Notion insert failed: ${item.title.slice(0, 40)}... ${res.status} ${errText.slice(0, 100)}`);
        errors++;
      }
    } catch (err) {
      console.warn(`  ⚠️ Notion error: ${item.title.slice(0, 40)}... ${err.message}`);
      errors++;
    }
  }

  console.log(`  📥 Notion 저장: ${saved}건 성공${errors > 0 ? `, ${errors}건 실패` : ''}`);
}

/**
 * 제목/출처 기반으로 관련 태그 추론
 */
function inferTags(title, source) {
  const tags = [];
  const t = `${title} ${source}`.toLowerCase();
  
  if (t.includes('personal assistant') || t.includes('비서') || t.includes('scheduler') || t.includes('calendar')) tags.push('AI 개인 비서');
  if (t.includes('content') || t.includes('재가공') || t.includes('repost') || t.includes('curation')) tags.push('AI 콘텐츠 재가공');
  if (t.includes('social media') || t.includes('sns') || t.includes('instagram') || t.includes('automated post')) tags.push('SNS 자동화');
  if (t.includes('document') || t.includes('contract') || t.includes('legal') || t.includes('계약') || t.includes('문서')) tags.push('AI 문서/계약');
  if (t.includes('smb') || t.includes('small business') || t.includes('소상공인') || t.includes('automation agency')) tags.push('SMB 자동화 구축');
  if (t.includes('n8n') || t.includes('agent') || t.includes('workflow') || t.includes('make.com') || t.includes('zapier')) tags.push('n8n/AI Agent');
  if (t.includes('micro saas') || t.includes('micro-saas') || t.includes('saas') || t.includes('subscription')) tags.push('Micro SaaS');
  if (t.includes('tutorial') || t.includes('course') || t.includes('learn') || t.includes('교육') || t.includes('training')) tags.push('AI 교육');
  if (t.includes('trend') || t.includes('market') || t.includes('report') || t.includes('트렌드') || t.includes('시장')) tags.push('시장 트렌드');

  // 기본 태그
  if (tags.length === 0) tags.push('시장 트렌드');
  
  return [...new Set(tags)]; // 중복 제거
}

/**
 * 제목 기반 Market 카테고리 추론
 */
function inferMarket(title, source) {
  const t = `${title} ${source}`.toLowerCase();

  if (t.includes('personal assistant') || t.includes('비서') || t.includes('scheduler') || t.includes('calendar') || t.includes('todo')) return 'AI 개인 비서';
  if (t.includes('content') || t.includes('재가공') || t.includes('repost') || t.includes('curation') || t.includes('social media')) return 'AI 콘텐츠 재가공';
  if (t.includes('document') || t.includes('contract') || t.includes('legal') || t.includes('계약') || t.includes('문서') || t.includes('pdf')) return 'AI 문서/계약';
  if (t.includes('smb') || t.includes('small business') || t.includes('소상공인') || t.includes('automation') && t.includes('agency')) return 'SMB 자동화';
  if (t.includes('blog') || t.includes('블로그') && (t.includes('sns') || t.includes('social'))) return '블로그→SNS';
  
  return '일반 트렌드';
}

// ===== 메인 =====

async function main() {
  console.log('🔍 AI Barrier Research — Starting...\n');
  
  const today = new Date().toISOString().split('T')[0];
  const allResults = [];

  // 1. 모든 키워드로 모든 소스 검색
  for (const keyword of CONFIG.keywords) {
    console.log(`  Searching: "${keyword}"`);
    
    const promises = [];
    if (CONFIG.sources.hackernews.enabled) promises.push(searchHackerNews(keyword, CONFIG.sources.hackernews.maxResults));
    if (CONFIG.sources.reddit.enabled) promises.push(searchReddit(keyword, CONFIG.sources.reddit.maxResults));
    if (CONFIG.sources.googleNews.enabled) promises.push(searchGoogleNews(keyword, CONFIG.sources.googleNews.maxResults));
    
    const results = await Promise.allSettled(promises);
    results.forEach(r => {
      if (r.status === 'fulfilled') allResults.push(...r.value);
    });
  }

  // 2. 관련성 필터링
  const relevant = filterRelevant(allResults);
  console.log(`\n  Total collected: ${allResults.length}`);
  console.log(`  Relevant after filter: ${relevant.length}`);

  // 3. AI 요약 (옵션)
  const summary = await summarizeWithAI(relevant);
  if (summary) console.log(`\n  AI Summary: ${summary}`);

  // 4. Notion DB 저장
  console.log('\n  💾 Saving to Notion DB...');
  await saveToNotion(relevant, summary);

  // 6. 마크다운 로그 생성
  const dateStr = today;
  const weekStr = new Date().toLocaleDateString('ko-KR', { 
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' 
  });

  let logEntry = `\n---\n\n### 📅 ${weekStr}\n\n`;
  
  if (summary) {
    logEntry += `**🧠 AI 요약:** ${summary}\n\n`;
  }
  
  logEntry += `**📊 수집 결과:** 총 ${allResults.length}건 → 관련 ${relevant.length}건\n\n`;
  
  if (relevant.length > 0) {
    logEntry += '| # | 출처 | 제목 | 관련도 | 링크 |\n';
    logEntry += '|---|------|------|:----:|------|\n';
    relevant.forEach((item, i) => {
      const scoreStr = '⭐'.repeat(Math.min(Math.ceil(item.score / 5), 5)) || '·';
      logEntry += `| ${i+1} | ${item.source} | ${item.title.replace(/\|/g, '\\|')} | ${scoreStr} | [바로가기](${item.url}) |\n`;
    });
  } else {
    logEntry += '*이번 주 새로운 발견 없음*\n';
  }

  // 5. 파일 읽기/추가
  const outputPath = path.join(CONFIG.outputDir, CONFIG.outputFile);
  let existing = '';
  try {
    existing = await fs.readFile(outputPath, 'utf-8');
  } catch {
    // 새 파일 생성
    existing = `# 📡 AI 진입장벽 붕괴 — 사례 연구 로그\n\n> **🔄 자동 수집:** 매주 ${dateStr} 기준 업데이트\n> **소스:** Hacker News, Reddit, Google News RSS\n\n---\n`;
  }

  // 헤더 업데이트 (최종 업데이트 날짜)
  const headerUpdated = existing.replace(
    /> \*\*🔄 자동 수집:.*\n/,
    `> **🔄 자동 수집:** ${dateStr} 기준 업데이트\n`
  );

  const updatedLog = headerUpdated + logEntry;

  // 7. 저장
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, updatedLog, 'utf-8');
  
  console.log(`\n✅ Log saved to: ${outputPath}`);
  console.log(`📝 Total entries in log: ${relevant.length}`);

  // 8. GitHub Actions Summary 출력
  if (process.env.GITHUB_STEP_SUMMARY) {
    let summaryMd = `## 📡 AI Barrier Research — ${dateStr}\n\n`;
    summaryMd += `**수집:** 총 ${allResults.length}건 → **관련 ${relevant.length}건**\n\n`;
    
    if (summary) {
      summaryMd += `### AI 요약\n${summary}\n\n`;
    }
    
    if (relevant.length > 0) {
      summaryMd += '### 발견된 사례\n\n';
      relevant.slice(0, 10).forEach((item, i) => {
        const scoreStr = '⭐'.repeat(Math.min(Math.ceil(item.score / 5), 5)) || '·';
        summaryMd += `${i+1}. **[${item.source}]** ${item.title} ${scoreStr}\n`;
      });
    }
    
    await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, summaryMd, 'utf-8');
  }

  // 9. 텔레그램 알림 발송
  await sendTelegramAlert(relevant, summary, allResults.length);

  // 10. 콘솔 출력에도 요약
  console.log('\n📋 === 발견된 사례 Top 10 ===');
  relevant.slice(0, 10).forEach((item, i) => {
    console.log(`  ${i+1}. [${item.source}] ${item.title}`);
  });
  console.log('========================\n');
}

// ===== 텔레그램 알림 =====

async function sendTelegramAlert(findings, summary, totalRaw) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) {
    console.log('  ⏭️ 텔레그램 미설정. 알림 스킵.');
    return;
  }

  const today = new Date().toLocaleDateString('ko-KR', { 
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' 
  });

  let msg = `📡 *AI 진입장벽 리서치 — ${today}*\n\n`;
  msg += `📊 수집: ${totalRaw}건 → 관련 *${findings.length}건*\n\n`;

  if (summary) {
    msg += `🧠 *AI 요약:* ${summary}\n\n`;
  }

  if (findings.length > 0) {
    msg += `🔍 *Top 5 발견:*\n`;
    findings.slice(0, 5).forEach((item, i) => {
      const score = '⭐'.repeat(Math.min(Math.ceil(item.score / 5), 5)) || '·';
      const title = item.title.length > 50 ? item.title.slice(0, 50) + '…' : item.title;
      msg += `${i+1}. [${score}] ${title}\n`;
    });
  }

  msg += `\n📋 Notion DB: https://www.notion.so/3658ab04904c8132a7e9d105bc557709`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: msg,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      console.log('  ✅ 텔레그램 알림 전송 완료');
    } else {
      const err = await res.text();
      console.warn(`  ⚠️ 텔레그램 전송 실패: ${err.slice(0, 100)}`);
    }
  } catch (err) {
    console.warn(`  ⚠️ 텔레그램 오류: ${err.message}`);
  }
}

main().catch(err => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});
