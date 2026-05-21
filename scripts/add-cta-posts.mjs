import fetch from 'node-fetch';
import 'dotenv/config';

const BASE = 'https://api.notion.com/v1';
const headers = () => ({
  'Authorization': 'Bearer ' + process.env.NOTION_TOKEN,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
});
const DB_ID = process.env.NOTION_DATABASE_ID;

const ctaPosts = [
  {
    name: '[CTA] 당신의 인스타그램, 무료로 진단해드립니다',
    caption: '인스타그램, 제대로 운영되고 계신가요?\n\n"팔로워는 있는데 반응이 없어요"\n"도대체 뭘 올려야 할지 모르겠어요"\n"매일 올리는데 성과가 안 나요"\n\n이런 고민 있다면 지금 바로 확인해보세요.\n3분이면 내 계정 상태를 알 수 있습니다.\n\n프로필 링크 클릭 무료 SNS 진단',
    imageUrl: 'https://picsum.photos/800/800?random=cta1',
    status: 'Ready',
  },
  {
    name: '[CTA] SNS 운영, 하루 10분이면 충분한 이유',
    caption: 'SNS 운영하는 데 하루 2시간씩 쓰시나요?\n\nAI 자동화 시스템이면 하루 10분이면 끝납니다.\n\nAI가 캡션 작성\nAI가 해시태그 추천\nNotion에서 확인만 하면 자동 업로드\n\n프로필 링크에서 더 자세히 알아보세요',
    imageUrl: 'https://picsum.photos/800/800?random=cta2',
    status: 'Ready',
  },
  {
    name: '[CTA] 인스타 팔로워보다 중요한 것',
    caption: '팔로워 수보다 중요한 것은 도달률과 참여율입니다.\n\n팔로워 1만 명인데 좋아요 10개?\n팔로워 1천 명인데 좋아요 100개?\n\n무엇이 다를까요?\n\n바로 콘텐츠 전략과 운영 방식입니다.\n지금 내 계정의 도달률을 확인해보세요.\n\n프로필 링크에서 무료 SNS 진단',
    imageUrl: 'https://picsum.photos/800/800?random=cta3',
    status: 'Ready',
  },
];

for (const post of ctaPosts) {
  const body = {
    parent: { database_id: DB_ID },
    properties: {
      Name: { title: [{ text: { content: post.name } }] },
      Caption: { rich_text: [{ text: { content: post.caption } }] },
      'Image URL': { url: post.imageUrl },
      Platform: { select: { name: 'Instagram' } },
      Status: { select: { name: post.status } },
    },
  };

  const res = await fetch(BASE + '/pages', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  console.log(post.name.slice(0, 40) + '... ' + (res.ok ? 'OK' : 'FAIL: ' + (data.message || res.status)));
}
