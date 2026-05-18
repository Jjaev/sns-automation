# SNS Automation — Notion → Instagram 자동 업로드

## 🚀 1분 요약

```
Notion DB에 포스트 등록 → 자동 업로드 → 상태 업데이트
```

**운영비: 0원** (Notion 무료 + GitHub Actions 무료 + 자체 코드)

---

## 📋 관리 방법 (Notion에서만 하면 됨)

### 1. 포스트 등록
Notion DB "Social Media Automation DB"에 아래 필드 입력:
- **Name** (필수) — 포스트 제목
- **Caption** (선택) — 캡션 (비워두면 AI 자동 생성)
- **Image URL** (필수) — 업로드할 이미지 주소
- **Platform** — Instagram (현재 지원)
- **Scheduled At** (필수) — 업로드 예약 시간
- **Status** — `Ready`로 설정하면 다음 실행 때 업로드됨

### 2. 상태 흐름
```
Idea → Ready → Posted (성공)
               → Failed (실패)
```

---

## 🔧 실행 방법

### 테스트 실행 (업로드 안 함)
```bash
cd /Users/joe/.opencode/agents/frank/work/sns-automation
./run.sh dry-run
```

### 1회 실행 (수동)
```bash
./run.sh start
```

### 백그라운드 실행
```bash
./run.sh start
./run.sh status
./run.sh logs
```

### macOS 자동 스케줄 등록 (09/12/18시)
```bash
./run.sh cron-install
```

---

## 🔐 Instagram 연동 설정 (최초 1회)

아래 2개 값을 `.env`에 입력해야 실제 업로드 가능:

1. **Facebook Developer 앱 생성**  
   https://developers.facebook.com/apps/ → 새 앱 → 비즈니스

2. **Instagram 계정 연결**  
   앱 설정 → Instagram Basic Display → Instagram Business Account 연결

3. **액세스 토큰 발급**  
   Graph API Explorer에서 `instagram_content_publish` 권한 포함 토큰 생성

4. **`.env`에 입력**:
   ```
   INSTAGRAM_ACCESS_TOKEN=EA...
   INSTAGRAM_BUSINESS_ID=1784...
   ```

---

## 💰 비용 구조

| 항목 | 금액 | 비고 |
|------|------|------|
| Notion | 무료 | |
| GitHub Actions | 무료 | public repo, 2000분/월 |
| Node.js 코드 | 무료 | 직접 실행 |
| DeepSeek API | 0원~$0.14/1M토큰 | 옵션, 키 없으면 Notion 캡션 사용 |
| Instagram API | 무료 | |
| **합계** | **0원** | |

---

## 📁 파일 구조

```
sns-automation/
├── src/
│   ├── index.js      ← 메인 파이프라인
│   ├── notion.js     ← Notion DB 읽기/쓰기
│   ├── instagram.js  ← Instagram 업로드
│   └── caption.js    ← AI 캡션 생성 (DeepSeek)
├── .env              ← 설정 (토큰 등)
├── run.sh            ← 관리 스크립트
├── .github/workflows/ ← GitHub Actions 스케줄러
└── logs/             ← 실행 로그
```
