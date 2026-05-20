import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = '/Users/joe/Desktop/claude space/mac_uk_work/01_Projects/Pjt_진행중_부업자동화_100_frank/코드/sns-automation/.env';
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

const res = await fetch('https://api.notion.com/v1/databases/' + process.env.NOTION_DATABASE_ID + '/query', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + process.env.NOTION_TOKEN,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    filter: { property: 'Status', select: { equals: 'Ready' } },
    page_size: 20,
  }),
});
const data = await res.json();
for (const page of data.results) {
  const name = page.properties.Name?.title?.[0]?.plain_text || '';
  const caption = page.properties.Caption?.rich_text?.[0]?.plain_text || '';
  console.log('---');
  console.log('TITLE: ' + name);
  console.log('CAPTION: ' + caption.substring(0, 300));
}
