#!/bin/bash
# check-metrics.sh — IG 미디어 성과 조회 (도달/조회/참여)
# 사용법: ./scripts/check-metrics.sh [media_id ...]
# 설정: .env 또는 환경변수에 INSTAGRAM_ACCOUNTS 필요
# 결과: stdout + metrics/ 디렉토리에 JSON 로그 저장

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
METRICS_DIR="$PROJECT_DIR/metrics"
mkdir -p "$METRICS_DIR"

# .env 로드 (Python으로 파싱)
INSTAGRAM_ACCOUNTS=$(python3 -c "
import re
with open('$PROJECT_DIR/.env') as f:
    for line in f:
        m = re.match(r'^INSTAGRAM_ACCOUNTS=(.+)$', line.strip())
        if m:
            val = m.group(1)
            # Strip surrounding quotes
            if (val.startswith('\"') and val.endswith('\"')) or (val.startswith(\"'\") and val.endswith(\"'\")):
                val = val[1:-1]
            print(val)
            break
")

if [ -z "$INSTAGRAM_ACCOUNTS" ]; then
  echo '{"error":"INSTAGRAM_ACCOUNTS not set","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}'
  exit 1
fi

# studio_sjw 계정 토큰 추출
TOKEN=$(echo "$INSTAGRAM_ACCOUNTS" | python3 -c "
import sys, json
accts = json.load(sys.stdin)
sj = accts.get('studio_sjw', {})
print(sj.get('token', ''))
")

BIZ_ID=$(echo "$INSTAGRAM_ACCOUNTS" | python3 -c "
import sys, json
accts = json.load(sys.stdin)
sj = accts.get('studio_sjw', {})
print(sj.get('businessId', ''))
")

if [ -z "$TOKEN" ] || [ -z "$BIZ_ID" ]; then
  echo '{"error":"Failed to extract studio_sjw credentials","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}'
  exit 1
fi

GRAPH_BASE="https://graph.facebook.com/v22.0"
TS=$(date -u +%Y%m%d-%H%M%S)
RESULTS='{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","items":[]}'

# 미디어 ID가 인자로 주어졌는가?
MEDIA_IDS=("$@")

if [ ${#MEDIA_IDS[@]} -eq 0 ]; then
  # 인자 없음 → 최근 5개 미디어 자동 조회
  echo "No media IDs given. Fetching recent 5 media..."
  RECENT=$(curl -s "${GRAPH_BASE}/${BIZ_ID}/media?fields=id,media_type,media_url,timestamp,caption&limit=5&access_token=${TOKEN}")
  MEDIA_IDS=($(echo "$RECENT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for m in data.get('data', []):
    print(m['id'])
" 2>/dev/null))
  echo "Found ${#MEDIA_IDS[@]} media items"
fi

echo "=== IG Metrics Check $(date -u) ==="
echo "Account: studio_sjw (Business: $BIZ_ID)"

for MID in "${MEDIA_IDS[@]}"; do
  echo ""
  echo "--- Media: $MID ---"
  
  # 1. 미디어 기본 정보
  MEDIA_INFO=$(curl -s "${GRAPH_BASE}/${MID}?fields=id,media_type,media_url,timestamp,caption,permalink&access_token=${TOKEN}")
  MEDIA_TYPE=$(echo "$MEDIA_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin).get('media_type','?'))" 2>/dev/null)
  MEDIA_TS=$(echo "$MEDIA_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin).get('timestamp','?'))" 2>/dev/null)
  PERMALINK=$(echo "$MEDIA_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin).get('permalink','?'))" 2>/dev/null)
  
  echo "  Type: $MEDIA_TYPE"
  echo "  Posted: $MEDIA_TS"
  echo "  Permalink: $PERMALINK"
  
  # 2. 인사이트 조회 (REELS: reach, plays, saved, comments)
  if [ "$MEDIA_TYPE" = "REELS" ]; then
    INSIGHTS=$(curl -s "${GRAPH_BASE}/${MID}/insights?metric=reach,plays,saved,comments,shares&period=days_28&access_token=${TOKEN}" 2>/dev/null)
  else
    INSIGHTS=$(curl -s "${GRAPH_BASE}/${MID}/insights?metric=reach,impressions,saved,comments&period=days_28&access_token=${TOKEN}" 2>/dev/null)
  fi
  
  # 3. 결과 파싱
  RESULT_JSON=$(echo "$INSIGHTS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
result = {}
if 'data' in data:
    for item in data['data']:
        name = item.get('name', '?')
        values = item.get('values', [])
        if values:
            val = values[0].get('value', 0)
            result[name.lower()] = val
print(json.dumps(result))
" 2>/dev/null)
  
  echo "  Metrics: $RESULT_JSON"
  
  # JSON 배열에 추가
  ITEM=$(echo "{}" | python3 -c "
import sys, json
item = json.loads(sys.stdin.read())
item['id'] = '$MID'
item['type'] = '$MEDIA_TYPE'
item['posted_at'] = '$MEDIA_TS'
item['permalink'] = '$PERMALINK'
item['metrics'] = json.loads('$RESULT_JSON' if '$RESULT_JSON' else '{}')
print(json.dumps(item))
")
  
  RESULTS=$(echo "$RESULTS" | python3 -c "
import sys, json
r = json.loads(sys.stdin.read())
r['items'].append(json.loads('$ITEM'))
print(json.dumps(r, ensure_ascii=False))
")
done

# 파일 저장
OUTFILE="$METRICS_DIR/metrics-${TS}.json"
echo "$RESULTS" > "$OUTFILE"
echo ""
echo "=== Saved to: $OUTFILE ==="
echo "$RESULTS" | python3 -m json.tool 2>/dev/null || echo "$RESULTS"
