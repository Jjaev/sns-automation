# 🤖 SNS 자동화 템플릿 패키지
https://raw.githubusercontent.com/Jjaev/sns-automation/main/reels/reel-sns-tips-7.mp4

## Notion + GitHub Actions + AI = 자동 SNS 운영

> **AI가 콘텐츠 만들고, 정해진 시간에 자동 업로드까지**
> 사람은 Notion에서 승인만 하면 됩니다

---

## 시스템 구성

```
[Notion DB] ← 고객이 콘텐츠 승인
     ↓
[GitHub Actions] ← 09:00 / 12:00 / 15:00 KST 실행
     ↓
[AI Caption Generator] ← DeepSeek API
     ↓
[Instagram Graph API] ← 자동 업로드
     ↓
[Telegram] ← 발행 알림
```

## 핵심 기능

| 기능 | 설명 |
|------|------|
| 🤖 AI 콘텐츠 생성 | DeepSeek AI가 브랜드 톤에 맞는 캡션 자동 작성 |
| 📅 예약 발행 | Notion에 일정 설정 → 정해진 시간에 자동 업로드 |
| 📸 이미지 자동 할당 | 중복 없이 콘텐츠에 맞는 이미지 매칭 |
| 🎬 릴스 지원 | IG Reels 업로드 + 피드 공유 설정 가능 |
| 📊 이미지 중복 검사 | 동일 이미지 재사용 방지 |
| 📱 텔레그램 알림 | 발행 시 즉시 알림 + 일일 브리핑 |
| 🔄 멀티 계정 | 여러 IG 계정 동시 운영 가능 |
| 📈 성과 추적 | 24h 도달/조회수 자동 수집 |

## 패키지 구성

### 1. Notion DB 템플릿
- 콘텐츠 캘린더 (상태 관리: Idea → Ready → Posted)
- Caption / Image URL / Media Type / Schedule 등 속성
- 계정/플랫폼 멀티 지원

### 2. GitHub Actions 워크플로우
- `schedule.yml` — 09/12/15 KST 자동 발행
- `engagement-bot.yml` — 09:00 브리핑
- `daily-wrapup.yml` — 21:00 일일 요약
- `telegram-inbox.yml` — 사용자 메시지 수집
- `check-metrics.yml` — 성과 데이터 수집

### 3. AI 캡션 생성 파이프라인
- 캡션 자동 생성 (브랜드 톤 반영)
- AD 카피 자동 생성 (광고 모드)
- 해시태그 자동 추천

### 4. 설치 가이드 (PDF)
- Notion DB 복제 방법
- GitHub 레포지토리 설정
- IG API 토큰 발급
- 환경 변수 설정
- 첫 포스팅까지 30분

## 가격

| 패키지 | 구성 | 가격 |
|--------|------|------|
| **라이트** | Notion 템플릿 + 기본 워크플로우 | **30만원** |
| **스탠다드** | + AI 캡션 생성 + 텔레그램 알림 | **50만원** |
| **프리미엄** | + 릴스 지원 + 이미지 관리 + 성과 추적 | **80만원** |
| **화이트라벨** | + 브랜딩 + 재판매 라이선스 + 1:1 세팅 | **150만원** |

## 설치 후 운영 흐름

```
1일차: Notion DB 복제 + GitHub 설정 (30분)
2일차: IG 계정 연동 + 첫 포스팅 (20분)
3일차~: 매일 Notion에서 승인만 하면 자동 발행 (하루 5분)
```

## 시스템 요구사항

- GitHub 계정 (무료)
- Notion 계정 (무료)
- Instagram 비즈니스 계정 (무료)
- DeepSeek API 키 (무료 티어 가능)
- Telegram Bot (선택, 무료)

**운영비: 월 0원** (GitHub Actions Free + Notion Free + DeepSeek Free)

## 차별점

- ✅ **고객 참여**: AI가 다 하는 게 아니라 고객이 Notion에서 최종 승인
- ✅ **풀 오픈소스**: 모든 코드 공개, 데이터는 내 Notion에
- ✅ **운영비 0원**: 추가 구독료 없음
- ✅ **한국어 최적화**: 한국어 캡션, 한국 시간대, 국내 플랫폼 대응
- ✅ **확장 가능**: 새 플랫폼 추가, 새 기능 추가 자유로움

## 문의

- 카카오톡 채널: studio_sj
- 이메일: (연동 중)
- 인스타그램: @studio_sjw.a
