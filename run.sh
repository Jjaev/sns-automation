#!/bin/bash
# run.sh — SNS Automation 실행/관리 스크립트
# 사용법: ./run.sh {start|stop|status|logs|dry-run}

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

case "${1:-help}" in
  start)
    echo "▶ Starting SNS Automation (background)..."
    nohup node src/index.js >> logs/daemon.log 2>&1 &
    echo $! > .pid
    echo "PID: $(cat .pid)"
    ;;
  stop)
    if [ -f .pid ]; then
      kill $(cat .pid) 2>/dev/null
      rm .pid
      echo "⏹ Stopped."
    else
      echo "Not running."
    fi
    ;;
  status)
    if [ -f .pid ] && kill -0 $(cat .pid) 2>/dev/null; then
      echo "✅ Running (PID $(cat .pid))"
    else
      echo "❌ Not running"
    fi
    ;;
  logs)
    tail -f logs/daemon.log
    ;;
  dry-run)
    DRY_RUN=true node src/index.js
    ;;
  bulk-gen|bulk-generate)
    shift
    node src/bulk-generate.mjs "$@"
    ;;
  cron-install)
    CRON_DIR="$HOME/Library/LaunchAgents"
    mkdir -p "$CRON_DIR"
    cat > "$CRON_DIR/com.sns-automation.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.sns-automation</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>${DIR}/src/index.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${DIR}</string>
    <key>StartCalendarInterval</key>
    <array>
        <dict><key>Hour</key><integer>9</integer><key>Minute</key><integer>0</integer></dict>
        <dict><key>Hour</key><integer>12</integer><key>Minute</key><integer>0</integer></dict>
        <dict><key>Hour</key><integer>18</integer><key>Minute</key><integer>0</integer></dict>
    </array>
    <key>StandardOutPath</key>
    <string>${DIR}/logs/stdout.log</string>
    <key>StandardErrorPath</key>
    <string>${DIR}/logs/stderr.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>NOTION_TOKEN</key>
        <string>${NOTION_TOKEN}</string>
        <key>NOTION_DATABASE_ID</key>
        <string>${NOTION_DATABASE_ID}</string>
        <key>INSTAGRAM_ACCESS_TOKEN</key>
        <string>${INSTAGRAM_ACCESS_TOKEN}</string>
        <key>INSTAGRAM_BUSINESS_ID</key>
        <string>${INSTAGRAM_BUSINESS_ID}</string>
        <key>INSTAGRAM_ACCOUNTS</key>
        <string>${INSTAGRAM_ACCOUNTS}</string>
        <key>DEEPSEEK_API_KEY</key>
        <string>${DEEPSEEK_API_KEY}</string>
    </dict>
</dict>
</plist>
PLIST
    launchctl load "$CRON_DIR/com.sns-automation.plist"
    echo "✅ Cron installed (runs daily at 09:00, 12:00, 18:00)"
    ;;
  cron-uninstall)
    launchctl unload "$HOME/Library/LaunchAgents/com.sns-automation.plist" 2>/dev/null
    rm -f "$HOME/Library/LaunchAgents/com.sns-automation.plist"
    echo "⏹ Cron removed"
    ;;
  *)
    echo "Usage: ./run.sh {start|stop|status|logs|dry-run|bulk-gen|cron-install|cron-uninstall}"
    echo ""
    echo "  start         - Run in background (1회 실행 후 종료)"
    echo "  stop          - Stop background process"
    echo "  status        - Check if running"
    echo "  logs          - View real-time logs"
    echo "  dry-run       - Test without uploading"
    echo "  bulk-gen      - AI generate content [--count N] [--accounts a,b] [--dry-run]"
    echo "  cron-install  - Install macOS launchd schedule (09/12/18시)"
    echo "  cron-uninstall- Remove schedule"
    ;;
esac
