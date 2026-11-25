# Jarvis v1 — Automated Voice Assistant

Voice-first, automated Jarvis that runs entirely in your browser.
No build step, no external libraries, no web fonts, no server, no API key required.

Plain HTML/CSS/JS: `index.html`, `jarvis.css`, `jarvis.js` (voice assistant core),
`automation.js` (routines, timers, reminders, morning briefing).

## Run it

**Locally:**

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000

**Live site (GitHub Pages, from `main`):**

https://goldwing24.github.io/Vanguard-God-Eye/

All asset paths are relative and `.nojekyll` is included, so GitHub Pages serves it as-is.

## Voice

- Tap the glowing core (or the **Listen** button) and speak, or say **“Hey Jarvis”** when the wake-word loop is on.
- Type in the chat box any time — every voice command works by typing too.
- Voice uses the browser Web Speech API (SpeechRecognition + speechSynthesis).
  Best in **Chrome or Edge**; Safari also supports it. The browser will ask for microphone permission.
- Speech recognition needs **HTTPS or localhost** — it will not work from a plain `file://` page in most browsers, so use the local server above or GitHub Pages.
- If speech recognition is unavailable, Jarvis says so and typed chat still works fully.
- Say **“stop”** to interrupt Jarvis. Say **“voice off”** for text-only replies.

## Commands

| Say / type | What happens |
|---|---|
| `help` | List of commands |
| `what time is it` / `what date is it` | Time / date |
| `briefing` | Time, notes, upcoming timers/reminders, routines |
| `set a timer for 5 minutes` | Timer that fires with a spoken alert |
| `remind me in 10 minutes to stretch` | Reminder that fires with a spoken alert |
| `take a note …` | Saves a note (localStorage) |
| `show notes` / `clear notes` | Read / delete notes |
| `automate a morning briefing at 7am` | Adds a daily routine |
| `tell me a joke` | A joke |
| `street wise mode` / `classic mode` | Switch personality (green / blue HUD) |
| `voice off` / `voice on` | Spoken replies off / on |
| `stop` | Interrupt |

## Automation — what runs without being asked

While this page is open, Jarvis runs these on its own:

1. **Timers & reminders** — checked every 10 seconds. When one is due, Jarvis speaks it and logs it. They survive a reload (localStorage) and fire when the page is open again.
2. **Morning briefing** — on the first open of the day at or after your configured time (default 07:00), Jarvis gives the briefing automatically. Once per day. Change the time in Settings.
3. **Hourly time check** — optional (off by default). On the hour, Jarvis announces the time.
4. **Daily routines** — add one by voice (`automate a morning briefing at 7am`) or with the form in the Automation panel. Each routine fires once a day at its time. Turn routines on/off or delete them in the panel.

The Automation panel lists every routine, timer/reminder and note, so you can see exactly what is automated.

## Honest limit: no background server

A browser page cannot run while the tab is closed. If the tab is closed, timers, reminders, briefings and routines pause until the page is opened again — they then catch up (due items fire, the morning briefing runs if it is past its time).

**If you want something that runs with the browser closed**, the option is a GitHub Actions workflow in this repo (`.github/workflows/daily-checkin.yml`) that runs on a schedule and writes a daily check-in file to the repo. That is not included in v1 — it cannot speak to you or read your local notes, it can only create/update a file in the repo. Ask for it if you want it added.

## Privacy

- No API key is required and no data leaves the browser.
- Notes, timers, reminders, routines and settings are stored only in this browser's `localStorage`. Use a different browser/device and they will not be there.
- v1 has **no optional AI brain / API-key handling at all**. If an AI key is added in a later version, it must stay in localStorage and go only to a user-chosen OpenAI-compatible endpoint — never committed to the repo.
- Jarvis never submits anything, contacts anyone, or places orders. It only manages the notes, timers and routines in this page.
