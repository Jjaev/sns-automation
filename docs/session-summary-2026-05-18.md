# 2026-05-18 세션 요약 — 부업자동화 SNS 파이프라인

---

## ✅ 오늘 한 작업

### 1. 인스타그램 실제 업로드 테스트 (성공)
- **2건 실제 게시 완료**
  - ☕️ 카페 마케팅 샘플 → https://www.instagram.com/p/DYeLK6pkldp/
  - 🛍️ 제품 홍보 샘플 → https://www.instagram.com/p/DYePyPfEvMQ/
- Notion DB에 Status=Ready로 등록 → 파이프라인이 자동 감지 → Instagram Graph API로 업로드 → Status=Posted 전환
- 전체 파이프라인 검증 완료

### 2. 저품질/쉐도우밴 방지 대책
- **Bio 변경**: "SNS Management Studio | 포트폴리오 샘플 계정"으로 명확히 표시
- **캡션 수정**: "저희가 관리하는..." → "[포트폴리오 샘플]" (허위광고 제거)
- **Daily limit**: 하루 최대 2개 게시 (DAILY_POST_LIMIT=2)
- **Unsplash 경고**: 스톡사진 도메인 자동 감지 (WARN 로그)
- **업로드 재시도**: 일시적 장애 시 1회 자동 재시도
- **크론 빈도 축소**: 3회→2회 (12, 18시 KST)

### 3. run.sh 전면 개편
```bash
./run.sh health          # 전체 시스템 건강진단
./run.sh status-report   # 🎯 목표 진행상황 리포트
./run.sh daemon-start    # 30분 간격 계속 체크
./run.sh run             # 1회 실행
./run.sh dry-run         # 테스트 (업로드 안 함)
./run.sh cron-install    # launchd 등록
```

### 4. GitHub 셋업
- 레포: `github.com/Jjaev/sns-automation` (public)
- 시크릿 5개 설정 완료 (NOTION_TOKEN, DB_ID, IG TOKEN, IG ID, DEEPSEEK)
- 코드 17개 파일 푸시 완료

### 5. 포트폴리오 샘플 6개 준비
| 상태 | 포스트 | 업로드 예정 |
|------|--------|------------|
| ✅ Posted | 카페 마케팅 | 오늘 07:23 UTC |
| ✅ Posted | 제품 홍보 | 오늘 08:03 UTC |
| 🔜 Ready | 자영업자 마케팅 | 내일 5/19 09:00 KST |
| 🔜 Ready | 패션 브랜드 | 내일 5/19 12:00 KST |
| 🔜 Ready | 피트니스 센터 | 모레 5/20 12:00 KST |
| 🔜 Ready | 인테리어 브랜딩 | 5/21 12:00 KST |

### 6. 문서화
- `docs/kmong-profile.md` — 크몽 서비스 프로필 초안
- `docs/client-acquisition.md` — 첫 클라이언트 확보 전략
- `docs/session-summary-2026-05-18.md` — 이 파일

---

## ⚠️ 발견된 문제

| 문제 | 상태 | 설명 |
|------|------|------|
| Unsplash 이미지 사용 | ⚠️ 경고만 | 이미 게시된 건 수정 불가, 앞으로 오리지널 이미지 필요 |
| IG 토큰 만료 (7/16) | ✅ 코드 탐지 | 만료 14일 전부터 로그 경고, 59일 남음 |
| health check가 실제 publish 함 | ✅ 수정 | pipeline run 분리 완료 |
| launchd Load error (5) | ⚠️ 무시 가능 | macOS 권한 문제지만 서비스는 정상 동작 |
| GitHub Actions workflow 미등록 | ⏳ 보류 | gh 토큰에 `workflow` 스코프 없음 → 아래 참고 |

---

## 🧑 욱님이 필요한 것

### 1. (선택) GitHub Actions 활성화 — 5분
맥 안 켜도 24시간 자동 운영하려면 필요.
```bash
# 터미널에 아래 명령어 입력 → 브라우저 열리면 인증
gh auth refresh --hostname github.com -s workflow

# 그 다음 워크플로우 푸시
cd ~/.opencode/agents/frank/work/sns-automation
git push origin main
```
이거 한 번만 하면 앞으로 GitHub 서버에서 cron 돌아감.

### 2. 포트폴리오 샘플 검토 — 5분
- Notion DB `Social Media Automation DB` 에 6개 샘플 있음
- 캡션/이미지 확인하고 괜찮으면 놔두기
- 수정 원하면 Notion에서 직접 편집

### 3. 첫 클라이언트 — 네가 가장 중요함
- `docs/client-acquisition.md` 참고
- 지인 중에 카페/식당/피트니스/뷰티샵 하는 사람 있으면 "SNS 관리 해줄까?" 한번만 물어봐줘
- 크몽에 서비스 등록하면 문의 올 수 있음 (프로필 초안 있음)

---

## 🎯 현재 목표 대비 진척

| 목표 | 상태 | 비고 |
|------|------|------|
| Instagram API 연동 | ✅ 완료 | 실제 업로드 2건 성공 |
| Notion DB 파이프라인 | ✅ 완료 | Ready→자동업로드→Posted |
| 포트폴리오 샘플 | ✅ 6개 | 2개 게시, 4개 예약 |
| 크몽 프로필 | 📄 초안 | `docs/kmong-profile.md` |
| 클라이언트 확보 | ❌ 미시작 | docs만 있음 |
| 월 100만원 | 0% | 첫 클라이언트부터 |

---

## 📁 프로젝트 구조

```
sns-automation/
├── run.sh              ← 관리 스크립트 (health/run/daemon/cron)
├── .env                ← 환경변수 (토큰들)
├── .env.example        ← 템플릿 (깃헙용)
├── package.json
├── .github/workflows/schedule.yml  ← GitHub Actions (토큰만 있으면 활성화)
├── src/
│   ├── index.js        ← 메인 파이프라인
│   ├── notion.js       ← Notion DB 읽기/쓰기
│   ├── instagram.js    ← Instagram Graph API 업로드
│   ├── caption.js      ← AI 캡션 생성 (DeepSeek)
│   └── playwright-instagram.js  ← 대비용 (미사용)
└── docs/
    ├── kmong-profile.md
    ├── client-acquisition.md
    └── session-summary-2026-05-18.md
```

---

## 바로 실행 가능한 명령어

```bash
cd ~/.opencode/agents/frank/work/sns-automation

./run.sh health          # 지금 상태 한눈에
./run.sh status-report   # 목표 진척도
./run.sh logs            # 오늘 로그 실시간
./run.sh dry-run         # 테스트만 (안전함)
```

---

*세션 종료 — 2026-05-18 17:30 KST*
