#!/bin/bash
# create-reel.sh — IG 릴스 자동 생성기 (FFmpeg)
# 이미지 슬라이드쇼 → 1080x1920 세로 영상 (IG 릴스 포맷)
# 
# 설치: brew install ffmpeg
# 사용법: ./create-reel.sh 이미지1.jpg [이미지2.jpg ...]
# 출력: reels/reel-YYYYMMDD-HHMMSS.mp4

OUTPUT_DIR="reels"
mkdir -p "$OUTPUT_DIR"

IMAGES=("$@")
NUM=${#IMAGES[@]}
DUR=3
TS=$(date +%Y%m%d-%H%M%S)
OUT="${OUTPUT_DIR}/reel-${TS}.mp4"

if [ $NUM -lt 1 ]; then
    echo "사용법: $0 이미지1.jpg [이미지2.jpg ...]"
    echo "  FFmpeg으로 이미지를 슬라이드쇼 영상으로 변환 (1080x1920, 15fps)"
    exit 1
fi

# Create concat file with absolute paths
CONF=$(mktemp)
for img in "${IMAGES[@]}"; do
    # Resolve absolute path (macOS compatible)
    case "$img" in
        /*) ABS_PATH="$img" ;;
        *) ABS_PATH="$(cd "$(dirname "$img")" && pwd)/$(basename "$img")" ;;
    esac
    echo "file '${ABS_PATH}'" >> "$CONF"
    echo "duration ${DUR}" >> "$CONF"
done

echo "릴스 생성: ${NUM}장 이미지, $(($NUM * $DUR))초"

ffmpeg -y -f concat -safe 0 -i "$CONF" \
    -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=#1a1a1a,fps=15,format=yuv420p" \
    -c:v libx264 -preset medium -crf 23 \
    -movflags +faststart \
    "$OUT" 2>&1 | grep -E "Duration|kb/s|output"

rm -f "$CONF"

SIZE=$(du -h "$OUT" | cut -f1)
echo "✅ $OUT (${SIZE})"
