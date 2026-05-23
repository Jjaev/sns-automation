// telegram-mission.js — 프랭크의 일일 미션 생성기
// 실행: node scripts/telegram-mission.js
// 용도: 욱님이 수동으로 할 IG 활동(좋아요/댓글/팔로우)을 텔레그램으로 전달

import { sendTelegram } from '../src/telegram.js';

// 타겟 계정 목록 (SNS 마케팅 / AI / 인스타 팁 관련)
const TARGETS = [
  // SNS 마케팅 계정
  { name: 'kore.ai.kr', type: 'ai', desc: 'AI 팀 운영 인사이트' },
  // TODO: 더 추가 (욱님이 원하는 계정)
];

// 미션 생성
function generateMissions() {
  const missions = [];
  
  // 좋아요 미션 (랜덤 3개)
  const likeTargets = [...TARGETS].sort(() => Math.random() - 0.5).slice(0, 3);
  for (const t of likeTargets) {
    missions.push(`👍 좋아요: @${t.name}의 최근 게시물 3개`);
  }

  // 팔로우 미션 (랜덤 2개)
  const followTargets = [...TARGETS].sort(() => Math.random() - 0.5).slice(0, 2);
  for (const t of followTargets) {
    missions.push(`➕ 팔로우: @${t.name}`);
  }

  // 댓글 미션 (1개)
  if (TARGETS.length > 0) {
    const commentTarget = TARGETS[Math.floor(Math.random() * TARGETS.length)];
    const comments = [
      '와 진짜 유용한 정보네요 감사합니다!',
      '이런 콘텐츠 자주 봤으면 좋겠어요 👍',
      '대박이에요! 저장하고 갑니다',
      '와 완전 공감되네요 ㅋㅋ',
    ];
    const comment = comments[Math.floor(Math.random() * comments.length)];
    missions.push(`💬 댓글: @${commentTarget.name}의 최근 게시물에 "${comment}"`);
  }

  return missions;
}

// 실행
const missions = generateMissions();
const msg = [
  '🎯 **오늘의 프랭크 미션**',
  '',
  ...missions.map(m => `• ${m}`),
  '',
  '🕐 예상 시간: 5분',
  '✅ 완료하면 체크해주세요!',
  '',
  '💡 팁: 매일 꾸준히 하면 계정 점수가 올라갑니다',
].join('\n');

sendTelegram(msg).catch(e => console.error('Mission send failed:', e.message));
console.log('✅ Daily mission sent');