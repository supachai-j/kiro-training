"""Generate per-slide MP3 narration via edge-tts (free, no API key).

Usage:
    pip3 install edge-tts
    python3 generate-edge-tts.py /path/to/training-en.html
    python3 generate-edge-tts.py /path/to/training-th.html

Output: audio/{lang}/sNN.mp3 next to the slides directory.
        (e.g. /path/to/audio/en/s01.mp3 ... s40.mp3)

Voice rotation matches the recommended pattern in narrating-course-slides
SPEAKER-NOTES-STYLE.md — alternating F/M by module for variety.

Edit VOICE_MAP below if your deck has a different module structure.
"""
import asyncio, os, re, html, sys
from pathlib import Path

# Voice rotation by slide index. Customize for your deck's module layout.
# Default below assumes: title/agenda/why=1-3, M1=4-7, M2=8-14, M3=15-17, ...
# 10 modules of varying length, totaling ~38 slides + closing/QA.
VOICE_MAP = {}
def assign(start, end, sex):
    for i in range(start, end + 1):
        VOICE_MAP[i] = sex

# Adjust these ranges to match your actual deck module layout
# This deck (34 slides): 1-2 intro/agenda, 3-5 M0 (AI-DLC), 6-8 M1,
# 9-11 M2, 12-15 M3, 16-18 M4, 19-21 M5, 22-24 M6, 25-28 M7, 29-32 M8,
# 33 cheat sheet, 34 close.
assign(1, 2, "F")    # title + agenda
assign(3, 5, "M")    # M0 AI-DLC
assign(6, 8, "F")    # M1
assign(9, 11, "M")   # M2
assign(12, 15, "F")  # M3
assign(16, 18, "M")  # M4
assign(19, 21, "F")  # M5
assign(22, 24, "M")  # M6
assign(25, 28, "F")  # M7
assign(29, 32, "M")  # M8
assign(33, 45, "F")  # cheat sheet + close + buffer

# Voice catalog — Multilingual variants for EN (newer, more natural)
# TH stays on classic Neural voices (no multilingual TH variant on edge-tts)
VOICES = {
    "en": {"F": "en-US-AvaMultilingualNeural",  "M": "en-US-AndrewMultilingualNeural"},
    "th": {"F": "th-TH-PremwadeeNeural",        "M": "th-TH-NiwatNeural"},
}

# Slow down ~8% for natural pacing on educational content
RATE = "-8%"

def detect_lang(deck_path):
    """Sniff lang= attribute from <html> tag."""
    text = deck_path.read_text(encoding="utf-8", errors="ignore")
    m = re.search(r'<html[^>]*\blang="([^"]+)"', text)
    return (m.group(1).split("-")[0] if m else "en")

def extract_notes(deck_path):
    """Return [(slide_idx, note_text)] for all <aside class="notes"> in section order."""
    text = deck_path.read_text(encoding="utf-8", errors="ignore")
    sections = re.split(r'(<section[^>]*>)', text)
    notes = []
    cur = 0
    for chunk in sections:
        if chunk.startswith('<section'):
            cur += 1
            continue
        if cur == 0:
            continue
        m = re.search(r'<aside class="notes">(.*?)</aside>', chunk, re.DOTALL)
        if m:
            t = re.sub(r'<[^>]+>', '', m.group(1))
            t = ' '.join(html.unescape(t).split())
            notes.append((cur, t))
    return notes

async def synth(text, voice, out_file):
    import edge_tts
    com = edge_tts.Communicate(text, voice, rate=RATE)
    await com.save(str(out_file))

async def main():
    if len(sys.argv) < 2:
        sys.exit("Usage: python3 generate-edge-tts.py /path/to/deck.html")
    deck = Path(sys.argv[1]).resolve()
    if not deck.exists():
        sys.exit(f"ERROR: {deck} not found")

    lang = detect_lang(deck)
    if lang not in VOICES:
        sys.exit(f"ERROR: language {lang!r} not in VOICES; add to script first")

    # Output: <repo-root>/audio/<lang>/sNN.mp3
    # Repo root assumed = parent of deck's parent (slides/training-*.html → repo/)
    repo_root = deck.parent.parent
    out_dir = repo_root / "audio" / lang
    out_dir.mkdir(parents=True, exist_ok=True)

    notes = extract_notes(deck)
    if not notes:
        sys.exit(f"ERROR: no <aside class=\"notes\"> found in {deck}")

    print(f"Deck: {deck}")
    print(f"Lang: {lang}")
    print(f"Output: {out_dir}")
    print(f"Notes: {len(notes)} slides\n")

    sem = asyncio.Semaphore(4)
    async def worker(idx, text):
        async with sem:
            sex = VOICE_MAP.get(idx, "F")
            voice = VOICES[lang][sex]
            out = out_dir / f"s{idx:02d}.mp3"
            print(f"  → s{idx:02d} [{sex}] {voice} ({len(text.split())}w)")
            await synth(text, voice, out)
            return idx

    await asyncio.gather(*(worker(idx, txt) for idx, txt in notes))
    print(f"\n✓ wrote {len(notes)} mp3s to {out_dir}/")

if __name__ == "__main__":
    asyncio.run(main())
