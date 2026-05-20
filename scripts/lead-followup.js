// lead-followup.js — 리드 자동 후속 시스템
// Notion Lead DB에서 신규 리드 감지 → 단계별 Telegram 알림 + 상태 업데이트
// 실행: GH Actions lead-followup.yml (매일 10:00, 18:00 KST)

const NOTION_TOKEN = process.env.NOTION_TOKEN || '';
const LEAD_DB_ID = process.env.NOTION_LEAD_DB_ID || '3668ab04-904c-8138-a085-f4f080357fe9';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

// 후속 시퀀스 정의 (리드 생성 후 경과 시간 기준)
const SEQUENCE = [
  {
    label: 'D0_접수확인',
    afterHours: 0,      // 즉시
    maxHours: 2,         // 2시간 이내
    status: 'Contacted',
    getMessage: (lead) => `🆕 새 리드 도착!\n\n이름: ${lead.name}\nIG: ${lead.instagram || '-'}\n업종: ${lead.businessType || '-'}\n\n📋 진단 신청 감사 메시지를 보내주세요:\n"${lead.name}님, 무료 SNS 진단 신청 감사합니다. 24시간 내로 AI 분석 리포트를 보내드릴게요!"`,
    actionable: true,
  },
  {
    label: 'D1_분석완료',
    afterHours: 24,      // 24시간 후
    maxHours: 30,
    status: 'Analyzed',
    getMessage: (lead) => `⏰ D1 후속 — ${lead.name}님\n\n📊 AI 분석 결과를 전달해주세요:\n"${lead.name}님, 진단 결과 나왔습니다! 요약드리면..."\n\n(분석 내용은 Notion에서 확인 후 직접 작성)`,
    actionable: true,
  },
  {
    label: 'D3_상담제안',
    afterHours: 72,      // 3일 후
    maxHours: 78,
    status: 'Proposed',
    getMessage: (lead) => `⏰ D3 후속 — ${lead.name}님\n\n💰 상담 제안 메시지:\n"${lead.name}님, 혹시 SNS 관리에 관심 있으신가요? 무료 상담 30분 진행해드립니다. 부담 없이 편하게 연락주세요!"`,
    actionable: true,
  },
  {
    label: 'D7_마지막',
    afterHours: 168,     // 7일 후
    maxHours: 174,
    status: 'Warm',
    getMessage: (lead) => `⏰ D7 마지막 후속 — ${lead.name}님\n\n🔔 마지막 알림:\n"${lead.name}님, 마지막 메시지입니다. SNS 관리에 관심 있으시면 언제든 연락주세요. 첫 상담은 무료입니다!"\n\n응답 없으면 Cold 처리 예정.`,
    actionable: true,
  },
  {
    label: 'D14_Cold',
    afterHours: 336,     // 14일 후
    maxHours: 360,
    status: 'Cold',
    getMessage: (lead) => `🧊 Cold 전환 — ${lead.name}님\n\n14일간 응답 없음. 리드 상태를 Cold로 자동 전환했습니다. (재접근 필요시 수동 변경)`,
    actionable: false,
  },
];

async function fetchNotionLeads() {
  const res = await fetch(`https://api.notion.com/v1/databases/${LEAD_DB_ID}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({ page_size: 100 }),
  });
  if (!res.ok) throw new Error(`Notion query failed: ${res.status}`);
  const data = await res.json();
  return data.results || [];
}

function parseLead(page) {
  const props = page.properties;
  return {
    id: page.id,
    name: props.Name?.title?.[0]?.plain_text || '이름없음',
    email: props.Email?.email || '',
    instagram: props.Instagram?.rich_text?.[0]?.plain_text || '',
    source: props.Source?.select?.name || 'unknown',
    status: props.Status?.select?.name || 'New',
    businessType: props['Business Type']?.select?.name || '',
    painPoints: (props['Pain Points']?.multi_select || []).map(o => o.name),
    followers: props.Followers?.number || 0,
    createdAt: props['Created At']?.date?.start || null,
  };
}

async function updateLeadStatus(pageId, status) {
  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      properties: { Status: { select: { name: status } } },
    }),
  });
  return res.ok;
}

async function sendTelegram(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log('[SKIP] Telegram not configured');
    return;
  }
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'HTML',
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`Telegram send failed: ${err.slice(0, 200)}`);
  }
}

function hoursSince(dateStr) {
  if (!dateStr) return Infinity;
  const created = new Date(dateStr);
  const now = new Date();
  return (now - created) / (1000 * 60 * 60);
}

async function main() {
  console.log('🚀 Lead Follow-up System');
  console.log(`   Time: ${new Date().toISOString()}`);
  console.log('');

  const leads = await fetchNotionLeads();
  console.log(`📊 Total leads: ${leads.length}`);

  let processed = 0;
  let sent = 0;
  let errors = 0;

  for (const page of leads) {
    const lead = parseLead(page);

    // Only process leads that haven't been fully handled
    if (lead.status === 'Client' || lead.status === 'Cold' || lead.status === 'Lost') {
      continue;
    }

    const elapsed = hoursSince(lead.createdAt);

    for (const step of SEQUENCE) {
      // Check if this step applies
      if (elapsed >= step.afterHours && elapsed < step.maxHours) {
        // Check if already at this status or beyond
        const statusOrder = ['New', 'Contacted', 'Analyzed', 'Proposed', 'Warm', 'Client', 'Cold', 'Lost'];
        const currentIdx = statusOrder.indexOf(lead.status);
        const targetIdx = statusOrder.indexOf(step.status);

        if (targetIdx > currentIdx) {
          // This step hasn't been done yet — send notification
          const message = step.getMessage(lead);
          await sendTelegram(message);
          processed++;

          if (step.actionable) {
            await updateLeadStatus(lead.id, step.status);
            console.log(`  ✅ ${lead.name} → ${step.status} (${step.label})`);
            sent++;
          } else {
            console.log(`  ℹ️ ${lead.name} → ${step.status} (auto)`);
            await updateLeadStatus(lead.id, step.status);
          }
        }
        break; // Only process first matching step
      }
    }
  }

  console.log('');
  console.log(`📬 Sent: ${sent} | Processed: ${processed} | Errors: ${errors}`);
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
