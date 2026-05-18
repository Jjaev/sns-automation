#!/bin/bash
# run.sh — SNS Automation 실행/관리 스크립트
# 사용법: ./run.sh {start|stop|status|logs|dry-run|health|env|cron-install|cron-uninstall}

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# .env 로드 (있으면)
ENV_FILE="$DIR/.env"
if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

# 필요한 변수들
NODE_BIN="${NODE_BIN:-$(which node)}"
LOG_DIR="$DIR/logs"
DAILY_LOG="$LOG_DIR/$(date +%Y-%m-%d).log"

# 색상
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

ok()   { echo -e "${GREEN}✅${NC} $1"; }
warn() { echo -e "${YELLOW}⚠️${NC} $1"; }
fail() { echo -e "${RED}❌${NC} $1"; }
info() { echo -e "${CYAN}ℹ️${NC} $1"; }

mkdir -p "$LOG_DIR"

case "${1:-help}" in
  daemon-start)
    # daemon 모드: 30분마다 파이프라인 실행
    # launchd가 이 프로세스를 띄우고 KeepAlive로 유지함
    info "Daemon started (30-min interval)"
    echo $$ > "$DIR/.daemon.pid"
    while true; do
      echo "[$(date '+%Y-%m-%d %H:%M')] Daemon heartbeat — running pipeline..."
      node src/index.js 2>&1
      echo "[$(date '+%Y-%m-%d %H:%M')] Daemon heartbeat — sleeping 30m..."
      sleep 1800
    done
    ;;
  daemon-stop)
    if [ -f .daemon.pid ]; then
      kill $(cat .daemon.pid) 2>/dev/null
      rm -f .daemon.pid
    fi
    rm -f .pid
    ok "Daemon stopped."
    ;;
  daemon-status)
    if [ -f .daemon.pid ] && kill -0 $(cat .daemon.pid) 2>/dev/null; then
      PID=$(cat .daemon.pid)
      UPTIME=$(ps -o etime= -p $PID 2>/dev/null | tr -d ' ')
      ok "Daemon running (PID $PID, uptime: ${UPTIME:-?})"
    else
      fail "Daemon not running"
    fi
    ;;
  logs)
    LOG_FILE="$LOG_DIR/$(date +%Y-%m-%d).log"
    if [ "$2" ]; then
      # 특정 날짜 로그: ./run.sh logs 2026-05-17
      LOG_FILE="$LOG_DIR/$2.log"
    fi
    if [ -f "$LOG_FILE" ]; then
      tail -f "$LOG_FILE"
    else
      fail "No log file: $LOG_FILE"
    fi
    ;;
  dry-run)
    info "Dry run — no actual uploads"
    DRY_RUN=true node src/index.js
    ;;
  run)
    info "Running pipeline once..."
    node src/index.js
    ;;
  health)
    echo ""
    echo "══════════════════════════════════════"
    echo "   SNS Automation — Health Check"
    echo "══════════════════════════════════════"
    echo ""

    # 1. Node.js
    if command -v node &>/dev/null; then
      ok "Node.js $(node -v)"
    else
      fail "Node.js not found"
    fi

    # 2. .env
    if [ -f "$ENV_FILE" ]; then
      ok ".env file exists"
    else
      fail ".env file missing"
    fi

    # 3. Notion Token
    if [ -n "$NOTION_TOKEN" ]; then
      ok "Notion token: ${NOTION_TOKEN:0:8}..."
    else
      fail "Notion token not set"
    fi

    # 4. Instagram Token
    if [ -n "$INSTAGRAM_ACCESS_TOKEN" ]; then
      ok "Instagram token: ${INSTAGRAM_ACCESS_TOKEN:0:8}... (만료: 2026-07-16)"
    else
      fail "Instagram token not set"
    fi

    # 5. Instagram Business ID
    if [ -n "$INSTAGRAM_BUSINESS_ID" ]; then
      ok "Instagram Business ID: $INSTAGRAM_BUSINESS_ID"
    else
      fail "Instagram Business ID not set"
    fi

    # 6. Notion DB ID
    if [ -n "$NOTION_DATABASE_ID" ]; then
      ok "Notion Database ID: ${NOTION_DATABASE_ID:0:8}..."
    else
      fail "Notion Database ID not set"
    fi

    # 7. Cron status
    PLIST="$HOME/Library/LaunchAgents/com.sns-automation.plist"
    if [ -f "$PLIST" ]; then
      if launchctl list | grep -q com.sns-automation; then
        ok "launchd cron: loaded"
        info "Schedule: 12:00, 18:00 KST"
      else
        warn "launchd plist exists but not loaded"
      fi
    else
      warn "launchd cron not installed"
    fi

    # 8. 오늘 게시 현황
    TODAY=$(date +%Y-%m-%d)
    TODAY_LOG="$LOG_DIR/$TODAY.log"
    if [ -f "$TODAY_LOG" ]; then
      POSTED=$(grep -c "Published to Instagram" "$TODAY_LOG" 2>/dev/null) || POSTED=0
      FAILED=$(grep -c "Upload failed" "$TODAY_LOG" 2>/dev/null) || FAILED=0
      ok "Today ($TODAY): $POSTED posted, $FAILED failed"
    else
      info "No activity yet today"
    fi

    # 9. 오늘의 Ready 포스트 확인
    info "Checking ready posts..."
    node src/index.js 2>&1 | grep -E "(Found|No posts|Daily post limit)" || true

    # 10. 디스크
    DU_SIZE=$(du -sh "$DIR" 2>/dev/null | awk '{print $1}')
    ok "Project size: $DU_SIZE"

    echo ""
    echo "══════════════════════════════════════"
    echo "   run.sh health — $(date '+%Y-%m-%d %H:%M')"
    echo "══════════════════════════════════════"
    ;;
  env)
    echo "=== Environment ==="
    echo "NOTION_TOKEN:        ${NOTION_TOKEN:+✔ 설정 (${#NOTION_TOKEN}자)}${NOTION_TOKEN:-✘ 없음}"
    echo "NOTION_DATABASE_ID:  ${NOTION_DATABASE_ID:+✔ ${NOTION_DATABASE_ID:0:8}...}${NOTION_DATABASE_ID:-✘ 없음}"
    echo "INSTAGRAM_ACCESS_TOKEN: ${INSTAGRAM_ACCESS_TOKEN:+✔ 설정 (${#INSTAGRAM_ACCESS_TOKEN}자)}${INSTAGRAM_ACCESS_TOKEN:-✘ 없음}"
    echo "INSTAGRAM_BUSINESS_ID: ${INSTAGRAM_BUSINESS_ID:+✔ $INSTAGRAM_BUSINESS_ID}${INSTAGRAM_BUSINESS_ID:-✘ 없음}"
    echo "DEEPSEEK_API_KEY:    ${DEEPSEEK_API_KEY:+✔ 설정}${DEEPSEEK_API_KEY:-✘ 없음 (Notion 캡션 사용)}"
    echo "DRY_RUN:             ${DRY_RUN:-false}"
    echo ""
    echo "Working directory: $DIR"
    echo "Node: $(node -v 2>/dev/null || echo 'N/A')"
    ;;
  status-report)
    echo ""
    echo "╔══════════════════════════════════════════════╗"
    echo "║     🎯 SNS Automation — Goal Status Report   ║"
    echo "╚══════════════════════════════════════════════╝"
    echo ""

    # 1. 지금까지 포스트 현황
    echo "📊 Post Performance"
    echo "────────────────────"
    TOTAL_POSTED=$(grep -rhl "Published to Instagram" "$LOG_DIR" 2>/dev/null | xargs grep -ch "Published to Instagram" 2>/dev/null | awk '{s+=$1} END {print s+0}')
    TOTAL_FAILED=$(grep -rhl "Upload failed" "$LOG_DIR" 2>/dev/null | xargs grep -ch "Upload failed" 2>/dev/null | awk '{s+=$1} END {print s+0}')
    echo "  Total posted:  $TOTAL_POSTED"
    echo "  Total failed:  $TOTAL_FAILED"
    if [ "$((TOTAL_POSTED + TOTAL_FAILED))" -gt 0 ]; then
    SUCCESS_RATE=$(( (TOTAL_POSTED * 100) / (TOTAL_POSTED + TOTAL_FAILED) ))
    echo "  Success rate:  ${SUCCESS_RATE}%"
  else
    echo "  Success rate:  N/A"
  fi
    echo ""

    # 2. 오늘
    echo "📅 Today ($(date +%Y-%m-%d))"
    echo "────────────────────"
    TODAY_LOG="$LOG_DIR/$(date +%Y-%m-%d).log"
    if [ -f "$TODAY_LOG" ]; then
      TODAY_POSTED=$(grep -c "Published to Instagram" "$TODAY_LOG" 2>/dev/null) || TODAY_POSTED=0
      TODAY_FAILED=$(grep -c "Upload failed" "$TODAY_LOG" 2>/dev/null) || TODAY_FAILED=0
      echo "  Posted: $TODAY_POSTED  Failed: $TODAY_FAILED"
    else
      echo "  No activity today"
    fi
    echo ""

    # 3. Notion DB 상태
    echo "📋 Notion DB Pipeline"
    echo "────────────────────"
    if [ -n "$NOTION_TOKEN" ] && [ -n "$NOTION_DATABASE_ID" ]; then
      READY=$(curl -s -X POST "https://api.notion.com/v1/databases/$NOTION_DATABASE_ID/query" \
        -H "Authorization: Bearer $NOTION_TOKEN" \
        -H "Notion-Version: 2022-06-28" \
        -H "Content-Type: application/json" \
        -d '{"filter":{"property":"Status","select":{"equals":"Ready"}},"page_size":100}' 2>/dev/null | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('results',[])))" 2>/dev/null || echo '?')
      echo "  Ready posts waiting: $READY"
    else
      echo "  ⚠️ Notion not configured"
    fi
    echo ""

    # 4. 수익 현황
    echo "💰 Revenue (월 100만원 목표)"
    echo "────────────────────"
    echo "  Current:    0원 (아직 클라이언트 없음)"
    echo "  Target:   100만원/월"
    echo "  Progress:  0%"
    echo "  Next step: 크몽 서비스 등록 → 첫 클라이언트"
    echo ""

    # 5. 시스템 상태
    echo "⚙️ System Health"
    echo "────────────────────"
    if [ -f "$DIR/.daemon.pid" ] && kill -0 $(cat "$DIR/.daemon.pid") 2>/dev/null; then
      ok "Daemon running (PID $(cat "$DIR/.daemon.pid"))"
    else
      PLIST="$HOME/Library/LaunchAgents/com.sns-automation.plist"
      if [ -f "$PLIST" ] && launchctl list | grep -q com.sns-automation; then
        ok "launchd daemon registered (KeepAlive)"
      else
        fail "No automation running"
      fi
    fi
    # 토큰 만료까지 남은 일수 (macOS 호환)
    TOKEN_EXPIRY_SECS=$(( $(date -j -f "%Y-%m-%d" "2026-07-16" +%s) - $(date +%s) ))
    TOKEN_DAYS_LEFT=$(( TOKEN_EXPIRY_SECS / 86400 ))
    echo "  Token expiry:    2026-07-16 (${TOKEN_DAYS_LEFT}일 남음)"
    echo "  Project size:    $(du -sh "$DIR" 2>/dev/null | awk '{print $1}')"
    echo ""

    # 6. Goal timeline
    echo "🎯 Goal Timeline"
    echo "────────────────────"
    echo "  Week 1 (5/17~23): ✅ 설치 완료"
    echo "  Week 2 (5/24~30): 🔲 검증 (크몽 등록, 파일럿)"
    echo "  Week 3 (6/1~14):  🔲 첫 수익"
    echo "  Month 2 (6/15~):  🔲 확장 (3~5클라이언트)"
    echo "  Month 3 (7/15~):  🔲 안정화 (월 100만원)"
    echo ""

    # 7. 다음 액션
    echo "🎬 Next Actions"
    echo "────────────────────"
    echo "  1. 크몽 서비스 등록 (프로필 초안 있음)"
    echo "  2. 첫 클라이언트 찾기 (지인/네트워크)"
    echo "  3. 2주 후 cron 3회로 확대"
    echo ""
    echo "  $(date '+%Y-%m-%d %H:%M KST') — run.sh status-report"
    echo ""
    ;;
  goal|goal-update)
    # goal/plan.md 업데이트 안내
    echo "📝 goal/plan.md is at ~/.opencode/agents/frank/work/goal/plan.md"
    echo "   Edit it directly to update goal status."
    echo ""
    echo "   Quick view:"
    echo "   ────────────────────"
    grep -E "^(### |\`\`\`|\✔︎|\➤|\- \[)" "$DIR/../../work/goal/plan.md" 2>/dev/null | head -20 || echo "   (plan.md not found)"
    ;;
  cron-install)
    CRON_DIR="$HOME/Library/LaunchAgents"
    mkdir -p "$CRON_DIR"
    # launchd interval 방식 — 30분마다 pipeline 실행 (KeepAlive보다 안정적)
    cat > "$CRON_DIR/com.sns-automation.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.sns-automation</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>-c</string>
        <string>cd /Users/joe/.opencode/agents/frank/work/sns-automation && set -a && source .env && set +a && node src/index.js 2>&1 | tee -a logs/$(date +\%Y-\%m-\%d).log</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/Users/joe/.opencode/agents/frank/work/sns-automation</string>
    <key>StartCalendarInterval</key>
    <array>
        <dict><key>Hour</key><integer>12</integer><key>Minute</key><integer>0</integer></dict>
        <dict><key>Hour</key><integer>18</integer><key>Minute</key><integer>0</integer></dict>
    </array>
    <key>StandardOutPath</key>
    <string>/Users/joe/.opencode/agents/frank/work/sns-automation/logs/launchd.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/joe/.opencode/agents/frank/work/sns-automation/logs/launchd_error.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin</string>
    </dict>
</dict>
</PLIST>
PLIST
    launchctl unload "$CRON_DIR/com.sns-automation.plist" 2>/dev/null; sleep 1
    launchctl load "$CRON_DIR/com.sns-automation.plist" 2>&1
    ok "launchd cron installed (runs 12:00, 18:00 KST)"
    ;;
  cron-uninstall)
    launchctl unload "$HOME/Library/LaunchAgents/com.sns-automation.plist" 2>/dev/null
    rm -f "$HOME/Library/LaunchAgents/com.sns-automation.plist"
    rm -f .daemon.pid .pid
    ok "Daemon cron removed"
    ;;
  *)
    echo "SNS Automation — 관리 스크립트"
    echo ""
    echo "Usage: ./run.sh {command}"
    echo ""
    echo "  run              Run pipeline once (foreground)"
    echo "  dry-run          Test without uploading"
    echo ""
    echo "  daemon-start     Start 30-min interval daemon"
    echo "  daemon-stop      Stop daemon"
    echo "  daemon-status    Check daemon status"
    echo ""
    echo "  cron-install     launchd 등록 (KeepAlive + 30m daemon)"
    echo "  cron-uninstall   launchd 제거"
    echo ""
    echo "  health           전체 시스템 건강진단"
    echo "  status-report    🎯 목표 진행상황 리포트"
    echo "  goal             goal/plan.md 요약"
    echo "  env              환경변수 현황"
    echo "  logs [date]      실시간 로그 (예: logs 2026-05-18)"
    ;;
esac
