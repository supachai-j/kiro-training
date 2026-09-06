# Kiro Training — internal course portal

Bilingual (EN / TH) self-paced course + slide decks on **AWS Kiro**, for internal team enablement.

**Live:** <https://supachai-j.github.io/kiro-training/>

## Contents

| File | What |
|------|------|
| `index.html` | Landing page (EN/TH toggle) — module list, how to use |
| `course-en.html` | Full self-paced course, English — 8 modules + `.kiro/` cheat sheet |
| `course-th.html` | Thai mirror of the course |
| `slides/training-en.html` | reveal.js deck, English — 31 slides, narrated (audio bar + captions + transcript) |
| `slides/training-th.html` | Thai mirror of the deck, narrated |
| `audio/en/`, `audio/th/` | Per-slide narration MP3s (edge-tts) |
| `assets/styles.css`, `assets/app.js` | Shared design + theme/lang/scroll-spy behaviour |

Modules: 1) What is Kiro & why · 2) Vibe / Chat mode · 3) Specs · 4) Agent Steering ·
5) Agent Hooks · 6) MCP · 7) Kiro Powers · 8) Team adoption playbook.

## View locally

```bash
cd site
python3 -m http.server 8000
# open http://localhost:8000
```

Everything is static. The reveal.js decks load from a CDN, so the slides need an internet
connection the first time; the course pages and landing work fully offline.

## Slides

- Open a deck and press **F** for fullscreen, **S** for speaker view (shows the notes), **Esc** for the slide overview.
- Canvas is 1280×800 — projector-safe.
- **Narration is built in.** Each deck has a bottom-right audio bar: per-slide voice-over (`audio/{en,th}/sNN.mp3`), an auto-advance toggle (slide advances when the clip ends unless you paused), plus optional captions and a transcript drawer.
- Speaker notes are written in a **spoken, conversational register** (see `narrating-course-slides/references/SPEAKER-NOTES-STYLE.md`) — short sentences, contractions/particles, direct address, breath-beat periods.
- Audio is generated with **Gemini Flash TTS** (`generate-gemini-tts.py`), with a per-module delivery-style prompt and F/M voice rotation. `export GEMINI_API_KEY="$(cat ~/.config/gemini-key)"` then `python3 generate-gemini-tts.py slides/training-en.html`. `TTS_SLIDES="3 4 5" python3 …` regenerates just those slides.
- `generate-edge-tts.py` is the free/offline fallback (edge-tts) — lower naturalness, no style prompts.
- Audio (~12 min per language) lives in `audio/` and is committed.

## Deploy to GitHub Pages

```bash
cd site
git init && git add -A && git commit -m "Kiro training portal"
gh repo create <org>/kiro-training --private --source=. --push
# then: Settings → Pages → Deploy from branch → main / root
touch .nojekyll && git add .nojekyll && git commit -m "disable jekyll" && git push
```

All internal links are **relative**, so the site works both at a domain root and under a
`/<repo>/` project-pages path.

## Source & maintenance

Content is distilled from the official docs at <https://kiro.dev/docs/> (specs, chat, steering,
hooks, mcp, powers) plus the team's study notes in the parent Obsidian vault
(`Kiro Noted.md`, `What is Kiro powers and Why?.md`).

Kiro ships fast — re-check exact trigger names, flags, and the Powers catalogue against the
live docs before relying on specifics. Module 8 is **our** plan, not Kiro documentation; edit
it to match how the team actually works.

Not affiliated with AWS.
