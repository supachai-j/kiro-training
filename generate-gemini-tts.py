"""Per-slide narration via Gemini Flash TTS for the Kiro training decks.

Adapted from the narrating-course-slides skill for this 34-slide layout.
Style instructions per module shape delivery; voices alternate F/M by module.

Usage:
    export GEMINI_API_KEY="$(cat ~/.config/gemini-key)"
    python3 generate-gemini-tts.py slides/training-en.html
    python3 generate-gemini-tts.py slides/training-th.html
    TTS_SLIDES="3 4 5" python3 generate-gemini-tts.py slides/training-th.html   # partial

Output: audio/{lang}/sNN.mp3  (24kHz mono WAV -> MP3 96k via ffmpeg)
"""
import asyncio, os, re, html, sys, wave, subprocess, time
from pathlib import Path

# ---- 34-slide layout: 1-2 intro, 3-5 M0, 6-8 M1, 9-11 M2, 12-15 M3,
#      16-18 M4, 19-21 M5, 22-24 M6, 25-28 M7, 29-32 M8, 33 cheat, 34 close
VOICE_MAP = {}
def assign(a, b, v):
    for i in range(a, b + 1):
        VOICE_MAP[i] = v
assign(1, 2, "Aoede")    # intro / agenda — warm F
assign(3, 5, "Charon")   # M0 AI-DLC — confident M
assign(6, 8, "Kore")     # M1 — clear F
assign(9, 11, "Puck")    # M2 — thoughtful M
assign(12, 15, "Aoede")  # M3 specs — F
assign(16, 18, "Charon") # M4 steering — M
assign(19, 21, "Kore")   # M5 hooks — practical F
assign(22, 24, "Puck")   # M6 MCP — M
assign(25, 28, "Aoede")  # M7 Powers — F
assign(29, 32, "Charon") # M8 adoption — M
assign(33, 45, "Aoede")  # cheat sheet / close — warm F

STYLE_EN = {
    "intro":  "Speak warmly and conversationally, like a colleague kicking off an internal session. Friendly, relaxed, a smile in your voice. Natural pauses at the periods.",
    "found":  "Speak with quiet conviction, like explaining the idea that everything rests on. Unhurried. Let the key sentences land.",
    "def":    "Speak with curiosity, building the picture step by step, like a teacher who genuinely likes this topic. Conversational, not a lecture.",
    "tour":   "Speak like someone walking a friend through a diagram at a whiteboard. Clear, oriented, easy pace.",
    "lab":    "Speak practical and hands-on, step by step, like talking someone through it as they follow along. Direct and encouraging.",
    "caut":   "Speak measured and a little serious, like giving a teammate advice that matters. Calm, not alarmist.",
    "build":  "Speak like a builder who has done this a lot. Practical, confident, a touch of enthusiasm.",
    "close":  "Speak warmly, wrapping things up and opening the floor. Relaxed, reflective, giving room to think.",
}
STYLE_TH = {
    "intro":  "พูดแบบเป็นกันเอง อบอุ่น เหมือนเพื่อนร่วมงานเปิดวงคุยภายในทีม น้ำเสียงผ่อนคลาย มีรอยยิ้ม เว้นจังหวะหายใจตรงจุด",
    "found":  "พูดด้วยน้ำเสียงมั่นใจแบบสงบ เหมือนอธิบายแนวคิดที่ทุกอย่างตั้งอยู่บนนั้น ไม่รีบ ปล่อยให้ประโยคสำคัญลงจอด",
    "def":    "พูดด้วยความอยากรู้ ค่อย ๆ ปะติดปะต่อภาพทีละขั้น เหมือนครูที่ชอบเรื่องนี้จริง ๆ เป็นบทสนทนา ไม่ใช่การบรรยาย",
    "tour":   "พูดเหมือนพาเพื่อนดูแผนภาพที่ไวท์บอร์ด ชัดเจน เป็นลำดับ จังหวะสบาย ๆ",
    "lab":    "พูดแบบลงมือทำจริง ทีละขั้น เหมือนพาคนทำตามไปด้วยกัน ตรงไปตรงมาและให้กำลังใจ",
    "caut":   "พูดแบบระมัดระวังและจริงจังนิดหน่อย เหมือนเตือนเพื่อนร่วมทีมเรื่องที่สำคัญ ใจเย็น ไม่ตื่นตูม",
    "build":  "พูดเหมือนคนที่ทำงานนี้มาเยอะ ปฏิบัติได้จริง มั่นใจ มีความกระตือรือร้นนิด ๆ",
    "close":  "พูดอย่างอบอุ่น สรุปปิดท้ายและเปิดให้ถาม ผ่อนคลาย ทบทวน ให้พื้นที่คิด",
}
def style_key(idx):
    if idx <= 2:  return "intro"
    if idx <= 5:  return "found"
    if idx <= 8:  return "def"
    if idx <= 11: return "def"
    if idx <= 15: return "tour"
    if idx <= 18: return "tour"
    if idx <= 21: return "lab"
    if idx <= 24: return "caut"
    if idx <= 28: return "build"
    if idx <= 32: return "lab"
    if idx <= 33: return "tour"
    return "close"

MODEL_CANDIDATES = [
    "gemini-3.1-flash-tts-preview",
    "gemini-3.0-flash-preview-tts",
    "gemini-2.5-flash-preview-tts",
    "gemini-2.5-pro-preview-tts",
]

def pick_model(client):
    avail = {m.name.replace("models/", "") for m in client.models.list()}
    for c in MODEL_CANDIDATES:
        if c in avail:
            return c
    sys.exit("no TTS model available: " + ", ".join(sorted(m for m in avail if "tts" in m.lower())))

def detect_lang(p):
    m = re.search(r'<html[^>]*\blang="([^"]+)"', p.read_text(encoding="utf-8", errors="ignore"))
    return (m.group(1).split("-")[0] if m else "en")

def extract_notes(p):
    text = p.read_text(encoding="utf-8", errors="ignore")
    parts = re.split(r'(<section[^>]*>)', text)
    notes, cur = [], 0
    for c in parts:
        if c.startswith('<section'):
            cur += 1; continue
        if cur == 0:
            continue
        m = re.search(r'<aside class="notes">(.*?)</aside>', c, re.DOTALL)
        if m:
            t = re.sub(r'<[^>]+>', '', m.group(1))
            t = ' '.join(html.unescape(t).split())
            notes.append((cur, t))
    return notes

def find_ffmpeg():
    for c in ("ffmpeg", "/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg"):
        try:
            subprocess.run([c, "-version"], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return c
        except Exception:
            pass
    sys.exit("ffmpeg not found")

async def synth_one(client, model, lang, idx, text, out_dir, ffmpeg, retries=4):
    from google.genai import types
    voice = VOICE_MAP.get(idx, "Aoede")
    style = (STYLE_TH if lang == "th" else STYLE_EN)[style_key(idx)]
    prompt = f"{style}\n\n---\n\n{text}"
    wav_out = out_dir / f"s{idx:02d}.wav"
    mp3_out = out_dir / f"s{idx:02d}.mp3"
    for attempt in range(1, retries + 1):
        try:
            resp = await asyncio.to_thread(
                client.models.generate_content,
                model=model, contents=prompt,
                config=types.GenerateContentConfig(
                    response_modalities=["AUDIO"],
                    speech_config=types.SpeechConfig(
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice))),
                ),
            )
            pcm = resp.candidates[0].content.parts[0].inline_data.data
            with wave.open(str(wav_out), "wb") as w:
                w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000)
                w.writeframes(pcm)
            subprocess.run([ffmpeg, "-y", "-loglevel", "error", "-i", str(wav_out),
                            "-b:a", "96k", str(mp3_out)], check=True)
            wav_out.unlink()
            sz = mp3_out.stat().st_size
            if sz < 3000:
                raise RuntimeError(f"tiny mp3 {sz}B")
            return True
        except Exception as e:
            print(f"  x s{idx:02d} attempt {attempt}: {str(e)[:120]}", flush=True)
            if attempt < retries:
                await asyncio.sleep(4 * attempt)
    return False

async def main():
    if len(sys.argv) < 2:
        sys.exit("usage: generate-gemini-tts.py slides/training-en.html")
    if not (os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")):
        sys.exit("GEMINI_API_KEY not set")
    deck = Path(sys.argv[1]).resolve()
    lang = detect_lang(deck)
    out_dir = deck.parent.parent / "audio" / lang
    out_dir.mkdir(parents=True, exist_ok=True)
    ffmpeg = find_ffmpeg()
    notes = extract_notes(deck)
    only = os.environ.get("TTS_SLIDES", "").strip()
    if only:
        want = {int(x) for x in re.split(r"[,\s]+", only) if x}
        notes = [(i, t) for i, t in notes if i in want]

    from google import genai
    client = genai.Client()
    model = pick_model(client)
    print(f"Deck {deck.name} | lang {lang} | model {model} | {len(notes)} slides\n")

    sem = asyncio.Semaphore(3)
    ok, bad = [], []
    async def worker(idx, text):
        async with sem:
            print(f"  -> s{idx:02d} [{VOICE_MAP.get(idx,'Aoede')}] {text[:48]}...", flush=True)
            (ok if await synth_one(client, model, lang, idx, text, out_dir, ffmpeg) else bad).append(idx)
    t0 = time.time()
    await asyncio.gather(*(worker(i, t) for i, t in notes))
    print(f"\ndone in {time.time()-t0:.0f}s | ok {len(ok)} | failed {sorted(bad)}")
    if bad:
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
