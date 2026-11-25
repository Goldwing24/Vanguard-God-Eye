# Jarvis — HUD Command Center

Voice-first, automated Jarvis plus a full Vanguard command center, running
entirely in your browser. No build step, no external libraries, no web
fonts, no server, no API key required.

Plain HTML/CSS/JS: `index.html`, `jarvis.css`, `jarvis.js` (voice assistant
core), `automation.js` (routines, timers, reminders, morning briefing),
`agents.js` (the 7 Street Wise Money bots), `central-agent.js`
(the Vanguard Coordinator — Central Agent — plus the Agents panel UI and
the CEO Approval Queue), and `vanguard.js` (Vanguard Ops: Overview KPIs,
contracts, Trading Lab simulation, tasks and activity).

## HUD Command Center layout

The page, top to bottom:

1. **Jarvis HUD** — the glowing core. Tap it or say “Hey Jarvis” to talk.
   Conversation log and typed commands sit beside the Automation panel.
2. **Overview** — KPI cards: active pipeline (count + $/mo), won monthly
   revenue vs the $15,000 cleaning target, win rate, open tasks, and paper
   equity (simulation). Plus deadlines in the next 21 days.
3. **Contracts pipeline** — Lead → Qualifying → Bid prep → Submitted →
   Won / Lost, with search, stage filter, inline stage dropdowns, and an
   add-opportunity form (also by voice).
4. **Trading Lab** — simulated EUR/USD feed (start / pause, 1×/3×/8×),
   paper trades at market with stop-loss / take-profit, live paper P&L,
   paper balance from $10,000, win rate, and a position-size calculator.
5. **Tasks & Agents board** — tasks with owner, due date and status,
   plus an Activity log of everything that happened on the dashboard.
6. **Street Wise Money — Agents** — the 7 bots, Central Agent summary,
   video pipeline board (Idea → Published), CEO Approval Queue and
   channel KPIs. See below.
7. **Automation, Settings, Commands** — routines, timers, reminders,
   notes, voice / wake-word / morning-briefing settings, and the full
   command list.

Jarvis can report on all of it by voice — say “briefing” for the full
picture, or “contracts”, “trading”, “agents report”, “approvals”, or
“street wise status” for one part.

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
| `briefing` | Time, notes, timers, routines — plus Vanguard Ops and Street Wise summaries |
| `set a timer for 5 minutes` | Timer that fires with a spoken alert |
| `remind me in 10 minutes to stretch` | Reminder that fires with a spoken alert |
| `take a note …` | Saves a note (localStorage) |
| `show notes` / `clear notes` | Read / delete notes |
| `automate a morning briefing at 7am` | Adds a daily routine |
| `tell me a joke` | A joke |
| `street wise mode` / `classic mode` | Switch personality (green / blue HUD) |
| `voice off` / `voice on` | Spoken replies off / on |
| `stop` | Interrupt |

### Vanguard Ops voice commands

| Say / type | What happens |
|---|---|
| `contracts` / `show pipeline` | Active pipeline, won revenue vs $15,000 target, win rate, open tasks, paper equity |
| `add cleaning opportunity Navarre clinic $2500 due in 10 days` | Adds a contract as a Lead |
| `move navarre to submitted` / `we won navarre` / `mark navarre lost` | Changes that contract's stage |
| `start market` / `pause market` / `price` | Controls the simulated EUR/USD feed / reads the simulated price |
| `buy 0.2 lots stop 15 target 30` / `sell 0.1 lots` | Opens a paper trade (simulation — no real order) |
| `positions` / `close trade 1` / `close all` / `account` | Paper positions, balance, equity, win rate |
| `position size 1% 20 pips` | Position-size calculator |
| `assign Compliance to check SAM registration due in 3 days` / `open tasks` | Adds a task / lists open tasks |
| `go to contracts` / `trading` / `agents` / `approvals` / `overview` / `activity` | Scrolls to that section |

## 🎬 Street Wise Money bots

Reporting chain: **Bots → Vanguard Coordinator (Central Agent) → Jarvis → Goldwing.**

The 7 bots live in `agents.js`. Each one owns one stage of the pipeline
(Idea → Script → Voiceover → Edit → Thumbnail → Approval → Scheduled → Published)
and reports `{ done, next, blocked, needsApproval }` to the Central Agent
(`central-agent.js`). The Central Agent deduplicates the reports, flags
blockers and approvals, and hands one combined summary to Jarvis
(`window.VanguardAgent.getJarvisBriefing()`). Jarvis speaks it in a
briefing and shows it in the Agents panel.

| Bot | Job | Stage |
|---|---|---|
| Trend Researcher | Finds trending money topics, reports the top 3 with a suggested angle | Idea |
| Scriptwriter | Drafts scripts/outlines from an approved idea | Script |
| Voiceover Producer | Tracks recording readiness | Voiceover |
| Video Editor | Tracks edit status / cut progress | Edit |
| Thumbnail & Title Designer | Proposes 3 titles + thumbnail concepts per video | Thumbnail |
| Upload / SEO Manager | Prepares the upload checklist, SEO title, description, tags | Scheduled |
| Analytics | Tracks KPIs Goldwing enters (subscribers, views, videos published, 28-day revenue) | Published |

Episodes: Episode 001, *Your First $1,000* — **published** on
@streetwisemoney, 2026-11-23, https://youtu.be/dh9pwq_xGhI (2:11, 67 views,
6 likes, 0 comments, checked 2026-11-25; channel then 4 subscribers,
1 video). Episode 002, *5 Money Mistakes Keeping You Broke*, is seeded
sample data at the script stage. Cadence: 2 long videos a week (Tue & Fri,
6–12 min) plus 3–5 Shorts.

### Approval — the standing rule

**Nothing uploads to YouTube without Goldwing's approval.** The Upload /
SEO Manager only prepares a checklist and marks it "needs Goldwing
approval". The CEO Approval Queue in the Agents panel (and Jarvis voice:
`approvals`, `approve video episode 1`) is the only way an item clears —
and approving it only clears it for *Goldwing* to publish in YouTube
Studio. This dashboard never uploads, never schedules a publish, and has
no YouTube connection.

### Voice commands (Street Wise)

| Say / type | What happens |
|---|---|
| `agents report` / `agent briefing` / `street wise status` | Central Agent's combined report from all 7 bots |
| `show trend report` | Top 3 sample trends from the Trend Researcher |
| `approvals` | What is waiting on Goldwing |
| `approve video episode 1` / `approve episode 2` | Approve that item (Goldwing only) |
| `set subscribers 1250` / `set views …` / `set revenue …` | Enter real channel KPIs for Analytics |

### Honest limit

The bots run in the browser while the page is open. They do **not** fetch
live YouTube data, live trends, or live stats — trends are labelled sample
starting points for Goldwing to check, and KPIs are whatever Goldwing
enters, except for Episode 001 / channel KPIs, which are the real numbers
verified 2026-11-25 and must be updated by hand when they change. They do not upload, publish, or contact anyone.

## Vanguard Ops — honest limits

- **Contracts:** the 7 seeded contracts are sample data (labelled
  sample in the UI). Add, edit and move your real opportunities and the
  KPIs recompute from what you entered. Nothing is synced to a server.
- **Trading Lab:** a simulation. The EUR/USD price is a random walk,
  paper trades use a $10,000 paper balance, and stop-loss / take-profit
  close paper trades automatically. There is no live price, no broker,
  no real orders and no real money.
- **Tasks / Activity:** local only, stored in this browser.

## YouTube upload — SolMarrow connected, wrong channel in SolMarrow

SolMarrow is connected to Muse (2026-11-25, workspace "Goldwing's
workspace"), but the YouTube account it sees is Lynail Walker,
@lynailwalker9289 — Goldwing confirmed that is **not** the channel to
use. Street Wise Money (@streetwisemoney) is the only channel.
SolMarrow must be signed in with the @streetwisemoney Google account
and that channel connected instead; until then it cannot upload to
Street Wise, and nothing should be uploaded to Lynail Walker.
The approval rule stands: Jarvis prepares, Goldwing approves, then
upload private-first, then publish. Episode 001 is already published
(see above); Episode 002 has no finished video file yet, so there is
nothing to upload for it today even with the right connection.

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
