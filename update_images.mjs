import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '.env');
const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
  const eqIdx = trimmed.indexOf('=');
  const key = trimmed.slice(0, eqIdx).trim();
  let val = trimmed.slice(eqIdx + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
  if (!process.env[key]) process.env[key] = val;
}

const BASE = 'https://api.notion.com/v1';
const headers = {
  'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
};

const STORAGE_URL = 'https://ffkranwhkgcwhsgskjgs.supabase.co/storage/v1/object/public/sns-images';

// Map post titles to best-matching Supabase image files
const imageMap = {
  '자영업자 마케팅 - 동네 맛집 시리즈': 'gpti-10_2026-05-16_meal-ad-wm.png',
  '[샘플] 패션 브랜드 인스타그램 운영': 'gpti-02_2026-05-15_blush-wm.png',
  '당신의 비즈니스, AI와 함께 성장하세요': 'gpti-01_2026-05-15_usb-hub-wm.png',
  '[샘플] 피트니스 센터 마케팅': 'gpti-07_2026-05-16_otter-profile-wm.png',
  '인스타 피드 vs 릴스, 뭘 올려야 할까': 'gpti-11_2026-05-16_shop-sale-card-wm.png',
  '[샘플] 인테리어/공간 브랜딩': 'gpti-09_2026-05-16_temple-poster-wm.png',
  '우리의 SNS 자동화 시스템 공개': 'gpti-13_2026-05-16_snack-card-wm.png',
  'SNS 마케팅 꿀팁: 해시태그 전략': 'gpti-06_2026-05-16_sandwich-ad-wm.png',
  '포트폴리오: 뷰티 브랜드 런칭': 'gpti-02_2026-05-15_blush-wm.png',
  '포트폴리오: 카페 마케팅 성공 사례': 'gpti-12_2026-05-16_bakery-card-wm.png',
  'Notion CMS로 웹사이트까지': 'gpti-05_2026-05-16_tomato-detail-wm.png',
  '자영업자 SNS, 왜 중요한가': 'gpti-08_2026-05-16_kfood-ad-wm.png',
  '포스팅 1장이 30분이면 끝나는 이유': 'gpti-04_2026-05-16_open-sandwich-wm.png',
  '인스타그램, 이제 Notion으로 관리하세요': 'gpti-03_2026-05-15_sandwich-wm.png',
  '제품 홍보 샘플 - 뷰티 브랜드 런칭': 'gpti-02_2026-05-15_blush-wm.png',
  '카페 마케팅 샘플 - 포근한 겨울 신메뉴': 'gpti-12_2026-05-16_bakery-card-wm.png',
};

// Fetch all Ready + Posted posts
const res = await fetch(`${BASE}/databases/${process.env.NOTION_DATABASE_ID}/query`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    filter: {
      or: [
        { property: 'Status', select: { equals: 'Ready' } },
        { property: 'Status', select: { equals: 'Posted' } },
      ]
    },
    page_size: 20,
  }),
});
const data = await res.json();
console.log(`Found ${data.results.length} posts to check`);

let updated = 0;
for (const page of data.results) {
  const title = page.properties.Name?.title?.[0]?.plain_text || '';
  const imageFile = imageMap[title];
  if (!imageFile) {
    console.log(`⏭️ No mapping for: "${title}"`);
    continue;
  }
  
  const newUrl = `${STORAGE_URL}/${imageFile}`;
  const oldUrl = page.properties['Image URL']?.url || '';
  
  // Skip if already using our image
  if (oldUrl.includes('supabase.co')) {
    console.log(`⏭️ Already updated: "${title}"`);
    continue;
  }

  const updateRes = await fetch(`${BASE}/pages/${page.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      properties: {
        'Image URL': { url: newUrl }
      }
    }),
  });

  if (updateRes.ok) {
    console.log(`✅ "${title}" → ${imageFile}`);
    updated++;
  } else {
    const err = await updateRes.text();
    console.log(`❌ "${title}" — ${err}`);
  }
}

console.log(`\n📊 ${updated} images updated`);
