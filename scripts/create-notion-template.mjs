// Create Notion free template page (SNS Content Calendar)
import fetch from 'node-fetch';

const BASE = 'https://api.notion.com/v1';

async function main() {
  const TOKEN = process.env.NOTION_TOKEN;
  const DB_ID = process.env.NOTION_DATABASE_ID;
  
  if (!TOKEN) {
    console.log('SKIP: no NOTION_TOKEN');
    return;
  }

  const headers = {
    'Authorization': 'Bearer ' + TOKEN,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  };

  const heading1 = {
    object: 'block',
    type: 'heading_1',
    heading_1: {
      rich_text: [
        { type: 'text', text: { content: 'SNS Content Calendar Template (Free)' } },
      ],
    },
  };

  const intro = {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [
        {
          type: 'text',
          text: {
            content: 'Use this template to plan your SNS content. For AI-powered auto-posting: ',
          },
        },
        {
          type: 'text',
          text: {
            content: 'studio-sj-agency.vercel.app',
            link: { url: 'https://studio-sj-agency.vercel.app' },
          },
        },
      ],
    },
  };

  const divider = { object: 'block', type: 'divider', divider: {} };

  const weekTitle = {
    object: 'block',
    type: 'heading_2',
    heading_2: { rich_text: [{ type: 'text', text: { content: 'Week 1' } }] },
  };

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const dayBlocks = [];
  for (const day of days) {
    dayBlocks.push({
      object: 'block',
      type: 'heading_3',
      heading_3: { rich_text: [{ type: 'text', text: { content: day } }] },
    });
    dayBlocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: [{ type: 'text', text: { content: 'Topic: ' } }] },
    });
    dayBlocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: [{ type: 'text', text: { content: 'Caption: ' } }] },
    });
    dayBlocks.push({
      object: 'block',
      type: 'to_do',
      to_do: { rich_text: [{ type: 'text', text: { content: 'Posted' } }], checked: false },
    });
  }

  const resultsTitle = {
    object: 'block',
    type: 'heading_2',
    heading_2: { rich_text: [{ type: 'text', text: { content: 'Weekly Results' } }] },
  };

  const results = [
    { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: 'Total Likes: ' } }] } },
    { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: 'New Followers: ' } }] } },
    { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: 'Reach Rate: ' } }] } },
  ];

  const ctaBlock = {
    object: 'block',
    type: 'quote',
    quote: {
      rich_text: [
        { type: 'text', text: { content: 'Want fully automated SNS management? Try AI SNS Management at ' } },
        { type: 'text', text: { content: 'studio-sj-agency.vercel.app', link: { url: 'https://studio-sj-agency.vercel.app' } } },
      ],
    },
  };

  const children = [
    heading1,
    intro,
    divider,
    weekTitle,
    ...dayBlocks,
    divider,
    resultsTitle,
    ...results,
    divider,
    ctaBlock,
  ];

  const body = {
    parent: { database_id: DB_ID },
    properties: {
      Name: { title: [{ text: { content: '[Template] SNS Content Calendar (Free)' } }] },
      Caption: { rich_text: [{ text: { content: 'Free SNS Content Calendar Notion template. Plan, create, and manage your social media content.' } }] },
      Platform: { select: { name: 'Instagram' } },
      Status: { select: { name: 'Template' } },
    },
    children: children,
  };

  const res = await fetch(BASE + '/pages', {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (res.ok) {
    console.log('OK: Template page created - ID: ' + data.id);
  } else {
    console.log('FAIL: ' + (data.message || res.status));
  }
}

main().catch(e => console.log('ERROR: ' + e.message));
