#!/usr/bin/env python3
"""
make-frank-reel.py — 프랭크 릴스 자동 생성기 v5
텍스트 → TTS + 배경이미지(자동 페칭) + 텍스트 프레임 → 최종 영상.mp4

배경 이미지 소스 (우선순위):
  1. GIPHY — 반응 밈/GIF (API 키, mood 기반 검색) ← PRIMARY
  2. Imgflip — 밈 템플릿 (키 불필요)
  3. Pexels — 고퀄 이미지 (키 불필요? 가끔 됨)
  4. 그라데이션 — 최종 fallback

사용법:
  python3 make-frank-reel.py \\
    --title "팔로워0명" \\
    --lines "줄1|줄2|줄3" \\
    --text "내레이션 전체 텍스트"
    [--mood sad|confused|shocked|funny]
    [--bg-image /path/to/image.jpg]
"""
import argparse, asyncio, os, sys, tempfile, json, subprocess, urllib.request, random
from PIL import Image, ImageDraw, ImageFont
from datetime import datetime

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REEL_DIR = os.path.join(SCRIPT_DIR, '..', 'reels')

# ── Font (Pretendard 기본) ────────────────────────────
_home = os.path.expanduser('~')
FONT_PATH = os.path.join(_home, 'Library', 'Fonts', 'Pretendard-ExtraBold.otf')
if not os.path.exists(FONT_PATH):
    FONT_PATH = os.path.join(_home, 'Library', 'Fonts', 'Pretendard-Bold.otf')
if not os.path.exists(FONT_PATH):
    FONT_PATH = '/System/Library/Fonts/AppleSDGothicNeo.ttc'

# ── GIPHY API Key ─────────────────────────────────────
GIPHY_API_KEY = os.environ.get('GIPHY_API_KEY', '')
if not GIPHY_API_KEY:
    # .env 파일 직접 파싱 (dotenv 없이)
    env_path = os.path.join(SCRIPT_DIR, '..', '.env')
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith('GIPHY_API_KEY='):
                    GIPHY_API_KEY = line.split('=', 1)[1].strip().strip('"').strip("'")
                    break

# GIPHY mood → search tag mapping
GIPHY_TAGS = {
    'sad':      ['sad', 'crying', 'depressed', 'alone'],
    'confused': ['confused', 'what', 'confusion', 'thinking'],
    'shocked':  ['shocked', 'surprise', 'omg', 'scared'],
    'funny':    ['funny', 'lol', 'laughing', 'hilarious'],
    'scared':   ['scared', 'horror', 'fear', 'panic'],
    'cute':     ['cute', 'adorable', 'aww', 'sweet'],
}

# ── Mood → Keyword mapping ───────────────────────────
MOOD_KEYWORDS = {
    'sad':      ['sad', 'lonely', 'melancholy', 'depressed', 'alone'],
    'confused': ['confused', 'confusion', 'question mark', 'thinking'],
    'shocked':  ['shocked', 'surprised', 'fear', 'amazed', 'anxiety'],
    'funny':    ['funny', 'humor', 'comedy', 'smile', 'laugh', 'fun'],
    'scared':   ['scared', 'horror', 'dark', 'frightened', 'panic'],
    'cute':     ['cute', 'adorable', 'kawaii', 'sweet', 'lovely'],
}

# Imgflip meme templates (publicly accessible)
MEME_TEMPLATES = {
    'confused': 'https://imgflip.com/s/meme/Confused-Gandalf.jpg',
    'shocked':  'https://imgflip.com/s/meme/Disaster-Girl.jpg',
    'funny':    'https://imgflip.com/s/meme/Drake-Hotline-Bling.jpg',
    'sad':      'https://imgflip.com/s/meme/Hide-the-Pain-Harold.jpg',
    'scared':   'https://imgflip.com/s/meme/One-Does-Not-Simply.jpg',
    'default':  'https://imgflip.com/s/meme/Distracted-Boyfriend.jpg',
}

# ── Helpers ────────────────────────────────────────────

def detect_mood(text: str) -> str:
    """감정 키워드 기반 무드 자동 탐지."""
    t = text.lower()
    mood_scores = {}
    for mood, keywords in MOOD_KEYWORDS.items():
        score = 0
        for kw in keywords:
            if kw in t:
                score += 1
        # Also check Korean keywords
        if mood == 'sad' and any(w in t for w in ['눈물', '슬프', '외로', '울고', '혼자', '힘들']):
            score += 2
        if mood == 'confused' and any(w in t for w in ['모르', '뭐', '왜', '어이', '당황', '멍']):
            score += 2
        if mood == 'shocked' and any(w in t for w in ['무서', '놀라', '깜짝', '허걱', '대박']):
            score += 2
        if mood == 'funny' and any(w in t for w in ['ㅋㅋ', 'ㅎㅎ', '웃', '^.^', '-3-']):
            score += 2
        mood_scores[mood] = score
    best = max(mood_scores, key=mood_scores.get)
    return best if mood_scores[best] > 0 else 'funny'


def dl_image(url: str, save_path: str, timeout=8) -> bool:
    """Download image from URL to local path."""
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
        })
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            with open(save_path, 'wb') as f:
                f.write(resp.read())
        return os.path.getsize(save_path) > 1000
    except Exception as e:
        print(f"   ⚠️  다운로드 실패: {e}")
        return False


def fetch_pexels(mood: str, save_path: str) -> bool:
    """Pexels API (키 불필요!) — mood 기반 이미지 검색."""
    keywords = MOOD_KEYWORDS.get(mood, ['funny'])
    for kw in keywords:
        url = f'https://api.pexels.com/v1/search?query={kw}&per_page=1&orientation=portrait'
        try:
            req = urllib.request.Request(url, headers={
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
                'Accept': '*/*',
            })
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read())
            if data.get('photos') and len(data['photos']) > 0:
                # Try large first, fall back to medium
                src = data['photos'][0]['src']
                img_url = src.get('large') or src.get('medium')
                if img_url:
                    print(f"   📸 Pexels: {kw} → {img_url.split('?')[0][:60]}...")
                    return dl_image(img_url, save_path)
        except Exception as e:
            print(f"   ⚠️  Pexels 검색 실패 ({kw}): {e}")
            continue
    return False


def fetch_imgflip(mood: str, save_path: str) -> bool:
    """Imgflip — 밈 템플릿 (키 불필요!)."""
    meme_url = MEME_TEMPLATES.get(mood) or MEME_TEMPLATES['default']
    print(f"   🎭 Imgflip: {meme_url.split('/')[-1].replace('.jpg','')}")
    if dl_image(meme_url, save_path):
        # Crop/smart-resize to vertical
        try:
            img = Image.open(save_path).convert('RGB')
            w, h = img.size
            target = (1080, 1920)
            # Crop center square then resize
            if w > h:
                # Landscape: crop center vertically
                left = (w - h) // 2
                img = img.crop((left, 0, left + h, h))
            elif h > w:
                # Portrait: crop center horizontally
                top = (h - w) // 2
                img = img.crop((0, top, w, top + w))
            img = img.resize(target, Image.LANCZOS)
            img.save(save_path)
            return True
        except Exception as e:
            print(f"   ⚠️  Imgflip 리사이즈 실패: {e}")
            return False
    return False


def fetch_giphy(mood: str, save_path: str) -> bool:
    """GIPHY API — 반응 GIF/밈 검색 (mood 기반)."""
    if not GIPHY_API_KEY:
        print("   ⚠️  GIPHY: API 키 없음")
        return False

    tags = GIPHY_TAGS.get(mood, ['funny'])
    for tag in tags:
        # Random offset으로 같은 태그도 다른 이미지 나오게
        offset = random.randint(0, 30)
        url = f'https://api.giphy.com/v1/gifs/search?api_key={GIPHY_API_KEY}&q={tag}&limit=1&offset={offset}&rating=g&lang=ko'
        try:
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read())
            results = data.get('data', [])
            if len(results) > 0:
                # 랜덤으로 한 개 선택 (offset에 걸린 결과 중)
                idx = 0
                # Get the largest still image URL (downsized_still or fixed_height_still)
                images = results[idx]['images']
                img_url = (images.get('downsized_large', {}).get('url')
                           or images.get('original', {}).get('url')
                           or images.get('downsized_still', {}).get('url'))
                if img_url:
                    print(f"   🎬 GIPHY: {tag} → GIF")
                    if dl_image(img_url, save_path):
                        # Crop center square → vertical
                        try:
                            img = Image.open(save_path).convert('RGB')
                            w, h = img.size
                            if w > h:
                                left = (w - h) // 2
                                img = img.crop((left, 0, left + h, h))
                            elif h > w:
                                top = (h - w) // 2
                                img = img.crop((0, top, w, top + w))
                            img = img.resize((1080, 1920), Image.LANCZOS)
                            img.save(save_path)
                            return True
                        except:
                            return True  # raw 이미지라도 있으면 사용
        except Exception as e:
            print(f"   ⚠️  GIPHY 검색 실패 ({tag}): {e}")
            continue
    return False


# ── Background generation ────────────────────────────
BG_IMAGE_PATH = None

def set_bg_image(path):
    global BG_IMAGE_PATH
    BG_IMAGE_PATH = path


def make_gradient(w, h):
    """Vertical gradient: dark → purple-ish dark."""
    top_c = (2, 2, 20)
    bot_c = (45, 20, 60)
    base = Image.new('RGB', (w, h), top_c)
    for y in range(h):
        ratio = y / h
        r = int(top_c[0] * (1 - ratio) + bot_c[0] * ratio)
        g = int(top_c[1] * (1 - ratio) + bot_c[1] * ratio)
        b = int(top_c[2] * (1 - ratio) + bot_c[2] * ratio)
        for x in range(w):
            base.putpixel((x, y), (r, g, b))
    return base


def make_bg(w, h):
    """Create background — image (dark overlay) or gradient."""
    global BG_IMAGE_PATH
    if BG_IMAGE_PATH and os.path.exists(BG_IMAGE_PATH):
        bg = Image.open(BG_IMAGE_PATH).convert('RGB').resize((w, h), Image.LANCZOS)
        overlay = Image.new('RGB', (w, h), (0, 0, 0))
        bg = Image.blend(bg, overlay, 0.80)
        return bg
    return make_gradient(w, h)


# ── Frame creation ────────────────────────────────────

def create_frame(text: str, frame_index: int, total_frames: int, width=1080, height=1920):
    """Single frame with text overlay."""
    img = make_bg(width, height)
    draw = ImageDraw.Draw(img)

    try:
        font_main = ImageFont.truetype(FONT_PATH, 110)
        font_small = ImageFont.truetype(FONT_PATH, 26)
        font_watermark = ImageFont.truetype(FONT_PATH, 22)
    except Exception:
        font_main = font_small = font_watermark = ImageFont.load_default()

    # Watermark
    draw.text((30, 30), "frank.ai_0_", fill=(255, 255, 255, 60), font=font_watermark)

    # Progress bar
    px, py, pw, ph = 60, height - 50, width - 120, 3
    fw = int(pw * (frame_index + 1) / total_frames)
    draw.rectangle([px, py, px + pw, py + ph], fill=(255, 255, 255, 30))
    draw.rectangle([px, py, px + fw, py + ph], fill=(255, 255, 255, 180))

    # Page indicator
    draw.text((width - 80, height - 80), f"{frame_index+1}/{total_frames}",
              fill=(255, 255, 255, 60), font=font_small)

    # Main text — B급 감성: Pretendard ExtraBold + 테두리 4~5px + 의도적 오프셋
    lines = text.split('\n')
    lh = 140
    # 의도적 오프셋: 랜덤해 보이지만 고정된 값 (B급 감성)
    offset_x = 7
    offset_y = 3
    y0 = height // 2 - (len(lines) * lh) // 2 + offset_y
    border_width = 5
    for i, line in enumerate(lines):
        x_base = width // 2 + offset_x
        y_pos = y0 + i * lh
        # Border (검정, 5px)
        for dx in range(-border_width, border_width + 1):
            for dy in range(-border_width, border_width + 1):
                if dx * dx + dy * dy <= border_width * border_width:
                    draw.text((x_base + dx, y_pos + dy), line, fill=(0, 0, 0), font=font_main, anchor='mt')
        # 본문 (흰색)
        draw.text((x_base, y_pos), line, fill=(255, 255, 255), font=font_main, anchor='mt')

    return img


# ── TTS ────────────────────────────────────────────────

async def generate_tts(text: str, output_path: str):
    import edge_tts
    # 유나 (SunHi) — 여성, deadpan, 속도 +30% (~155 wpm)
    tts = edge_tts.Communicate(text, "ko-KR-SunHiNeural",
                               rate="+30%", pitch="+0Hz")
    await tts.save(output_path)


# ── Main ───────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="프랭크 릴스 자동 생성기 v4")
    parser.add_argument("--title", required=True, help="릴스 제목 (파일명)")
    parser.add_argument("--lines", required=True, help="자막 줄들 (| 구분)")
    parser.add_argument("--text", required=True, help="TTS 내레이션")
    parser.add_argument("--out", default="", help="출력 파일 경로")
    parser.add_argument("--mood", default="", help="무드 지정 (sad/confused/shocked/funny/auto)")
    parser.add_argument("--bg-image", default="", help="배경 이미지 경로 (우선 순위 최상)")
    parser.add_argument("--no-fetch", action='store_true', help="이미지 페칭 안 함 (그라데이션만)")
    args = parser.parse_args()

    # ── Step 0: Background image ──
    if args.bg_image:
        set_bg_image(args.bg_image)
        print(f"📷 배경: 지정된 이미지")
    elif args.no_fetch:
        print(f"🎨 배경: 그라데이션")
    else:
        # Auto-detect mood
        mood = args.mood.lower() if args.mood and args.mood != 'auto' else detect_mood(args.text)
        print(f"🎯 감지된 무드: {mood}")

        # GIPHY → Imgflip → Pexels 순서
        bg_tmp = os.path.join(tempfile.gettempdir(), f"bg-{datetime.now().strftime('%Y%m%d-%H%M%S')}.jpg")
        fetched = fetch_giphy(mood, bg_tmp)

        if not fetched:
            fetched = fetch_imgflip(mood, bg_tmp)

        if not fetched:
            fetched = fetch_pexels(mood, bg_tmp)

        if fetched:
            set_bg_image(bg_tmp)
            print(f"   ✅ 배경 이미지 적용")
        else:
            print(f"   → 그라데이션 fallback")

    lines = [l.strip() for l in args.lines.split('|') if l.strip()]
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    os.makedirs(REEL_DIR, exist_ok=True)

    # ── Step 1: TTS ──
    print(f"1/4 TTS 생성 중...")
    tts_path = os.path.join(tempfile.gettempdir(), f"tts-{ts}.mp3")
    asyncio.run(generate_tts(args.text, tts_path))

    result = subprocess.run(
        ['ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_format', tts_path],
        capture_output=True, text=True)
    audio_dur = float(json.loads(result.stdout)['format']['duration'])
    audio_sec = int(audio_dur) + 1
    print(f"   음성: {audio_sec}초")

    # ── Step 2: Frames ──
    print(f"2/4 프레임 생성 중 ({len(lines)}장)...")
    frame_dir = os.path.join(tempfile.gettempdir(), f"frames-{ts}")
    os.makedirs(frame_dir, exist_ok=True)
    frame_paths = []
    for i, line in enumerate(lines):
        fp = os.path.join(frame_dir, f"frame-{i:03d}.png")
        create_frame(line, i, len(lines)).save(fp)
        frame_paths.append(fp)
        print(f"   프레임 {i+1}/{len(lines)}: {line[:30]}...")

    # ── Step 3: Video ──
    # 글자 수 비율로 프레임 duration 배분 (TTS 싱크 맞춤)
    total_chars = sum(len(l.replace(' ', '')) for l in lines)
    durations = []
    for l in lines:
        chars = len(l.replace(' ', ''))
        prop = chars / total_chars
        dur = max(round(audio_sec * prop), 2)
        durations.append(dur)
    # 반올림 오차: 모자란 시간은 첫 프레임에 추가 (줄이지 않음)
    diff = audio_sec - sum(durations)
    if diff > 0 and len(durations) > 0:
        durations[0] += diff

    print(f"3/4 영상 생성 중...")
    for i, (l, d) in enumerate(zip(lines, durations)):
        print(f"   프레임 {i+1}: {l[:20]}... → {d}초 (비율 {d/audio_sec:.0%})")

    output = args.out or os.path.join(REEL_DIR, f"frank-{args.title}-{ts}.mp4")
    os.makedirs(os.path.dirname(output), exist_ok=True)

    concat_file = os.path.join(tempfile.gettempdir(), f"concat-{ts}.txt")
    with open(concat_file, 'w') as f:
        for fp, dur in zip(frame_paths, durations):
            f.write(f"file '{os.path.abspath(fp)}'\nduration {dur}\n")

    subprocess.run([
        'ffmpeg', '-y',
        '-f', 'concat', '-safe', '0', '-i', concat_file,
        '-i', tts_path,
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
        '-c:a', 'aac', '-b:a', '96k',
        '-shortest', '-movflags', '+faststart', '-pix_fmt', 'yuv420p',
        output
    ], capture_output=True)

    # ── Step 4: Verify & Cleanup ──
    result = subprocess.run(
        ['ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_format', output],
        capture_output=True, text=True)
    info = json.loads(result.stdout)
    final_dur = float(info['format']['duration'])
    final_size = int(info['format']['size'])

    # Cleanup
    os.remove(tts_path)
    os.remove(concat_file)
    for fp in frame_paths:
        os.remove(fp)
    os.rmdir(frame_dir)

    print(f"4/4 완료!")
    print(f"✅ {output}")
    print(f"   {final_dur:.1f}초 | {final_size//1024}KB")

if __name__ == '__main__':
    main()
