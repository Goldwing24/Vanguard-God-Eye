/* Jarvis v1 — voice assistant core.
 *
 * Voice: Web Speech API — SpeechRecognition for listening,
 * speechSynthesis for speaking. Works in Chrome / Edge / Safari
 * with microphone permission. If speech recognition is unavailable,
 * Jarvis still works fully by typing.
 *
 * No API key is required. No data leaves the browser.
 * State (notes, timers, reminders, routines, settings) lives in
 * localStorage under keys starting with "jarvis.".
 *
 * Automation lives in automation.js, which calls the public
 * window.Jarvis API defined at the bottom of this file.
 */
(function () {
  "use strict";

  var LS = {
    notes: "jarvis.notes",
    settings: "jarvis.settings",
    routines: "jarvis.routines",
  };

  var DEFAULT_SETTINGS = {
    voiceOn: true,
    wakeWord: true,
    morningBriefing: true,
    morningBriefingTime: "07:00",
    hourlyChime: false,
    personality: "classic", // "classic" | "streetwise"
  };

  /* ---------- small helpers ---------- */

  function loadJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage full/blocked */ }
  }

  function $(id) { return document.getElementById(id); }

  function fmtTime(date) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  function fmtDate(date) {
    return date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }

  function parseMinutes(text) {
    // "5 minutes", "1 hour", "90 seconds", "an hour", "a minute"
    var m = text.match(/(\d+)\s*(hour|hr|minute|min|second|sec)s?/);
    if (m) {
      var n = parseInt(m[1], 10);
      if (m[2].indexOf("hour") === 0 || m[2] === "hr") return n * 60;
      if (m[2].indexOf("second") === 0 || m[2] === "sec") return n / 60;
      return n;
    }
    if (/an?\s+hour/.test(text)) return 60;
    if (/an?\s+minute/.test(text)) return 1;
    return null;
  }

  function parseClockTime(text) {
    // "7am", "7:30 pm", "19:00"
    var m = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (!m) return null;
    var h = parseInt(m[1], 10);
    var min = m[2] ? parseInt(m[2], 10) : 0;
    if (m[3] === "pm" && h < 12) h += 12;
    if (m[3] === "am" && h === 12) h = 0;
    if (h > 23 || min > 59) return null;
    return (h < 10 ? "0" : "") + h + ":" + (min < 10 ? "0" : "") + min;
  }

  /* ---------- state ---------- */

  var settings = Object.assign({}, DEFAULT_SETTINGS, loadJSON(LS.settings, {}));
  var notes = loadJSON(LS.notes, []);
  var listening = false;
  var wakeListening = false;
  var recognition = null;

  function saveSettings() { saveJSON(LS.settings, settings); }

  /* ---------- UI ---------- */

  var statusEl, logEl;

  function setState(state) { document.body.dataset.state = state; }

  function setStatus(text) {
    if (statusEl) statusEl.innerHTML = text;
  }

  function addLog(who, text, kind) {
    if (!logEl) return;
    var li = document.createElement("li");
    li.className = kind || who;
    var label = who === "you" ? "You" : who === "auto" ? "Jarvis · automated" : "Jarvis";
    var small = document.createElement("small");
    small.textContent = label + " · " + fmtTime(new Date());
    li.appendChild(small);
    // textContent (not innerHTML) so voice/typed input cannot inject HTML.
    li.appendChild(document.createTextNode(text));
    logEl.prepend(li);
    while (logEl.children.length > 40) logEl.removeChild(logEl.lastChild);
  }

  /* ---------- speech ---------- */

  var synth = window.speechSynthesis || null;

  function speak(text) {
    if (!settings.voiceOn || !synth) return;
    try {
      synth.cancel();
      var utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1;
      utter.onstart = function () { setState("speaking"); };
      utter.onend = function () { setState("idle"); };
      utter.onerror = function () { setState("idle"); };
      synth.speak(utter);
    } catch (e) { /* speech unavailable */ }
  }

  function stopSpeaking() {
    if (synth) { try { synth.cancel(); } catch (e) {} }
    setState("idle");
  }

  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  var speechSupported = !!SpeechRecognition;
  var lastRecError = null;

  function startRecognition(continuous, onResult, onEnd) {
    if (!SpeechRecognition) return null;
    try {
      var rec = new SpeechRecognition();
      rec.lang = "en-US";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.continuous = !!continuous;
      rec.onresult = function (event) {
        var last = event.results[event.results.length - 1];
        if (last.isFinal) onResult(last[0].transcript.trim());
      };
      // Remember mic errors so the wake-word loop does not retry forever
      // after the user denies microphone permission.
      rec.onerror = function (event) { lastRecError = event && event.error; };
      rec.onend = function () { if (onEnd) onEnd(); };
      rec.start();
      return rec;
    } catch (e) {
      return null;
    }
  }

  // One-shot listening: tap the core (or press the Listen button).
  function listenOnce() {
    if (!speechSupported) {
      setStatus("Speech recognition is not available in this browser — type below instead.");
      return;
    }
    if (listening) return;
    stopWakeListening();
    listening = true;
    setState("listening");
    setStatus("Listening… speak now.");
    recognition = startRecognition(false, function (text) {
      listening = false;
      handleInput(text, "voice");
      maybeRestartWake();
    }, function () {
      listening = false;
      setState("idle");
      setStatus("Tap the core or say “Hey Jarvis” to talk.");
      maybeRestartWake();
    });
    if (!recognition) {
      listening = false;
      setStatus("Could not start the microphone. Check mic permission and try again.");
    }
  }

  // Wake-word loop: keeps listening in the background for "Hey Jarvis".
  // Browsers stop recognition after a pause, so we restart it on end.
  // This only works while the page is open — see README / automation.js.
  function startWakeListening() {
    if (!settings.wakeWord || !speechSupported || wakeListening || listening) return;
    wakeListening = true;
    setStatus("Wake word on — say “Hey Jarvis”.");
    recognition = startRecognition(true, function (text) {
      if (/hey jarvis/i.test(text)) {
        stopWakeListening();
        speak("Yes?");
        setStatus("Yes? Listening…");
        listenOnce();
      }
    }, function () {
      wakeListening = false;
      // If the mic was denied, stop the loop instead of retrying forever.
      if (lastRecError === "not-allowed" || lastRecError === "service-not-allowed") {
        setStatus("Microphone access was denied — typed chat still works. Allow the mic and reload to use voice.");
        return;
      }
      // Restart the loop shortly after it ends, unless the user turned it off.
      setTimeout(function () { if (settings.wakeWord && !listening) startWakeListening(); }, 400);
    });
    if (!recognition) wakeListening = false;
  }

  function stopWakeListening() {
    wakeListening = false;
    if (recognition) { try { recognition.abort(); } catch (e) {} recognition = null; }
  }

  function maybeRestartWake() {
    if (settings.wakeWord && speechSupported && !listening) startWakeListening();
  }

  /* ---------- timers, reminders, notes ---------- */

  // Stored in memory + localStorage via automation.js's due-list.
  // automation.js owns firing; this file owns creating them.
  function addDueItem(kind, label, dueAt) {
    var items = loadJSON("jarvis.due", []);
    items.push({ kind: kind, label: label, dueAt: dueAt, id: Date.now() + Math.random() });
    saveJSON("jarvis.due", items);
    if (window.JarvisAutomation) window.JarvisAutomation.renderDue();
  }

  function listDue() { return loadJSON("jarvis.due", []); }

  function clearDue(id) {
    saveJSON("jarvis.due", listDue().filter(function (i) { return i.id !== id; }));
    if (window.JarvisAutomation) window.JarvisAutomation.renderDue();
  }

  /* ---------- briefing ---------- */

  function briefingText() {
    var now = new Date();
    var due = listDue().filter(function (i) { return i.dueAt > now.getTime(); });
    var lines = [
      "Good " + (now.getHours() < 12 ? "morning" : now.getHours() < 18 ? "afternoon" : "evening") + ".",
      "It is " + fmtTime(now) + " on " + fmtDate(now) + ".",
      notes.length
        ? "You have " + notes.length + " note" + (notes.length === 1 ? "" : "s") + ". The latest: " + notes[notes.length - 1].text
        : "No notes saved.",
      due.length
        ? "You have " + due.length + " timer" + (due.length === 1 ? "" : "s") + " or reminder" + (due.length === 1 ? "" : "s") + " coming up."
        : "No timers or reminders coming up.",
    ];
    if (window.JarvisAutomation) {
      var routines = window.JarvisAutomation.listRoutines();
      if (routines.length) lines.push(routines.length + " automated routine" + (routines.length === 1 ? " is" : "s are") + " set up.");
    }
    // Street Wise: the Central Agent's combined bot summary, if available.
    if (window.VanguardAgent) {
      var sw = window.VanguardAgent.getSummary();
      lines.push("Street Wise: " + sw.summary);
      if (sw.approvalsNeeded.length) lines.push(sw.approvalsNeeded.length + " approval item" + (sw.approvalsNeeded.length === 1 ? " is" : "s are") + " waiting on you.");
    }
    return lines.join(" ");
  }

  /* ---------- command parser ---------- */

  var JOKES = [
    "I would tell you a UDP joke, but you might not get it.",
    "There are only 10 kinds of people: those who understand binary and those who do not.",
    "I asked the cloud for a joke. It said it was feeling a little foggy.",
    "Why do programmers prefer dark mode? Because light attracts bugs.",
  ];

  function respond(text) {
    addLog("jarvis", text, "jarvis");
    setStatus("Tap the core or say “Hey Jarvis” to talk.");
    speak(text);
  }

  function handleInput(raw, source) {
    var text = (raw || "").trim();
    if (!text) return;
    addLog("you", text, "you");
    setState("thinking");
    var lower = text.toLowerCase();

    // Interrupt / stop.
    if (/^(stop|quiet|shut up|never mind|cancel)$/.test(lower)) {
      stopSpeaking();
      respond("Stopped.");
      return;
    }

    // Voice on/off.
    if (/voice off|mute/.test(lower)) {
      settings.voiceOn = false; saveSettings(); syncSettingsUI();
      addLog("jarvis", "Voice off. I will reply in text only.", "jarvis");
      setStatus("Voice off — replies are text only.");
      return;
    }
    if (/voice on|unmute/.test(lower)) {
      settings.voiceOn = true; saveSettings(); syncSettingsUI();
      respond("Voice on.");
      return;
    }

    // Personality.
    if (/street wise mode|streetwise mode/.test(lower)) {
      settings.personality = "streetwise"; saveSettings(); applyPersonality();
      respond("Street Wise mode. Let us get to it.");
      return;
    }
    if (/classic mode/.test(lower)) {
      settings.personality = "classic"; saveSettings(); applyPersonality();
      respond("Classic mode, at your service.");
      return;
    }

    // Help.
    if (/^(help|what can you do|commands)$/.test(lower)) {
      respond("I can tell the time and date, give a briefing, set timers and reminders, take notes, run your automated routines, and tell a joke. For Street Wise, say “agents report”, “approvals”, “show trend report”, or “approve video episode 1”. Say “help” any time, or look at the commands list below.");
      return;
    }

    // Time / date.
    if (/\btime\b/.test(lower)) { respond("It is " + fmtTime(new Date()) + "."); return; }
    if (/\bdate\b|what day is it/.test(lower)) { respond("Today is " + fmtDate(new Date()) + "."); return; }

    // Briefing / status.
    if (/briefing|status|how am i doing|what is on|what's on/.test(lower)) {
      respond(briefingText());
      return;
    }

    // Timer: "set a timer for 5 minutes"
    var timerMatch = lower.match(/timer for (.+)/);
    if (/timer/.test(lower)) {
      var minutes = parseMinutes(lower);
      if (minutes) {
        var dueAt = Date.now() + minutes * 60000;
        addDueItem("timer", "Timer (" + minutes + " min)", dueAt);
        respond("Timer set for " + minutes + " minute" + (minutes === 1 ? "" : "s") + ". I will let you know when it is up.");
      } else {
        respond("How long should the timer be? Say, for example, “set a timer for 5 minutes”.");
      }
      return;
    }

    // Reminder: "remind me in 10 minutes to call mum"
    if (/remind me/.test(lower)) {
      var mins = parseMinutes(lower);
      var what = lower.replace(/remind me (in|to) ?/, "").replace(/in \d+ (minutes?|hours?|seconds?).*/, "").trim();
      var whatMatch = text.match(/remind me.*?\bto\b\s+(.+)/i);
      if (mins) {
        addDueItem("reminder", whatMatch ? whatMatch[1] : "Reminder", Date.now() + mins * 60000);
        respond("Reminder set for " + mins + " minute" + (mins === 1 ? "" : "s") + (whatMatch ? ": " + whatMatch[1] : "") + ".");
      } else {
        respond("When should I remind you? Say, for example, “remind me in 10 minutes to stretch”.");
      }
      return;
    }

    // Routine: "automate a morning briefing at 7am" / "automate a briefing every day at 7am"
    if (/automate/.test(lower)) {
      var clock = parseClockTime(lower);
      if (window.JarvisAutomation && clock) {
        var label = /briefing/.test(lower) ? "Morning briefing" : "Daily check-in";
        window.JarvisAutomation.addRoutine({ label: label, time: clock, kind: "briefing", enabled: true });
        respond("Done — I have automated a " + label.toLowerCase() + " every day at " + clock + ". You will see it in the routines panel.");
      } else {
        respond("Tell me a time, for example: “automate a morning briefing at 7am”.");
      }
      return;
    }

    // Notes.
    if (/take a note|note:/.test(lower)) {
      var noteText = text.replace(/take a note (that |to )?/i, "").replace(/^note:\s*/i, "").trim();
      if (noteText) {
        notes.push({ text: noteText, at: Date.now() });
        saveJSON(LS.notes, notes);
        if (window.JarvisAutomation) window.JarvisAutomation.renderNotes();
        respond("Noted: " + noteText);
      } else {
        respond("What should the note say?");
      }
      return;
    }
    if (/show notes|read my notes|my notes/.test(lower)) {
      if (!notes.length) { respond("You have no notes yet. Say “take a note …” to add one."); return; }
      respond("Your notes: " + notes.slice(-3).map(function (n) { return n.text; }).join("; "));
      return;
    }
    if (/clear notes|delete notes/.test(lower)) {
      notes = []; saveJSON(LS.notes, notes);
      if (window.JarvisAutomation) window.JarvisAutomation.renderNotes();
      respond("Notes cleared.");
      return;
    }

    // ----- Street Wise Money: bots -> Central Agent -> Jarvis -> Goldwing -----
    // These run before the generic fallback. They only report and prepare;
    // nothing here uploads to YouTube — approvals are Goldwing-only.
    if (/agents? report|agent briefing|street wise status|youtube status|video pipeline/.test(lower)) {
      if (window.VanguardAgent) {
        var briefing = window.VanguardAgent.getJarvisBriefing();
        if (window.VanguardAgentUI) window.VanguardAgentUI.render();
        respond(briefing.text);
      } else {
        respond("The Street Wise agents are not loaded yet. Reload the page and try again.");
      }
      return;
    }
    if (/show trend report|trend report|trends/.test(lower)) {
      if (window.StreetWise) {
        var trendBot = window.StreetWise.getBot("trend");
        var tr = trendBot.report();
        respond("Trend Researcher report (sample trends, not live data). " + tr.done + " Next: " + tr.next);
      } else {
        respond("The Trend Researcher is not loaded yet.");
      }
      return;
    }
    if (/approvals|approval queue|what needs approval|waiting on me/.test(lower)) {
      if (window.VanguardAgent) {
        var pending = window.VanguardAgent.pendingApprovals();
        if (!pending.length) { respond("Nothing is waiting on your approval right now."); return; }
        respond("Waiting on your approval: " + pending.map(function (a) { return a.title; }).join("; ") + ". Say “approve video episode 1” to approve one.");
      } else {
        respond("The approval queue is not loaded yet.");
      }
      return;
    }
    if (/approve (video|episode|idea)/.test(lower)) {
      if (window.VanguardAgent) {
        var approved = window.VanguardAgent.approveVideo(lower);
        if (approved) {
          if (window.VanguardAgentUI) window.VanguardAgentUI.render();
          respond("Approved: " + approved.title + ". That clears it for you to act on in YouTube Studio — I do not upload anything myself.");
        } else {
          respond("I could not find a pending approval matching that. Say “approvals” to hear what is waiting on you.");
        }
      } else {
        respond("The approval queue is not loaded yet.");
      }
      return;
    }
    if (/reject (video|episode|idea)/.test(lower)) {
      if (window.VanguardAgent) {
        var items = window.VanguardAgent.pendingApprovals();
        var target = null;
        var numMatch = lower.match(/episode\s*0*(\d+)/);
        items.forEach(function (a) {
          if (numMatch && a.id.indexOf("ep00" + parseInt(numMatch[1], 10)) !== -1) target = a;
        });
        if (target) {
          window.VanguardAgent.decideApproval(target.id, "rejected");
          if (window.VanguardAgentUI) window.VanguardAgentUI.render();
          respond("Rejected: " + target.title + ".");
        } else {
          respond("I could not find a pending approval matching that. Say “approvals” to hear what is waiting on you.");
        }
      } else {
        respond("The approval queue is not loaded yet.");
      }
      return;
    }
    // Channel KPIs, entered by Goldwing: "set subscribers 1250", "set views 12000", etc.
    var kpiMatch = lower.match(/set (subscribers?|views?|videos? published|revenue)\s+([\d,.]+)k?/);
    if (kpiMatch && window.StreetWise) {
      var keyMap = { subscribers: "subscribers", subscriber: "subscribers", views: "views", view: "views", "videos published": "videosPublished", videos: "videosPublished", revenue: "revenue28d" };
      var key = keyMap[kpiMatch[1]];
      var rawNum = parseFloat(kpiMatch[2].replace(/,/g, ""));
      var value = /k$/.test(lower.match(/set (?:subscribers?|views?|videos? published|revenue)\s+([\d,.]+k?)/)[1]) ? rawNum * 1000 : rawNum;
      if (key) {
        window.StreetWise.setKPI(key, value);
        if (window.VanguardAgentUI) window.VanguardAgentUI.render();
        respond("Saved. " + kpiMatch[1] + " is now " + value + ".");
      } else {
        respond("I can track subscribers, views, videos published, or 28-day revenue. Say, for example, “set subscribers 1250”.");
      }
      return;
    }

    // Joke / small talk.
    if (/joke/.test(lower)) { respond(JOKES[Math.floor(Math.random() * JOKES.length)]); return; }
    if (/^(hello|hi|hey|good morning|good afternoon|good evening)\b/.test(lower)) {
      respond("Hello, Goldwing. How can I help?");
      return;
    }
    if (/thank/.test(lower)) { respond("Any time."); return; }
    if (/who are you|your name/.test(lower)) {
      respond("I am Jarvis, your voice assistant. I run in this browser, and I can keep timers, reminders, notes and daily routines going while this page is open.");
      return;
    }

    // Fallback — honest about scope, no invented answer.
    respond("I did not catch a command in that. I can do the time and date, a briefing, timers, reminders, notes, and automated routines. Say “help” for the full list.");
  }

  /* ---------- settings UI ---------- */

  function applyPersonality() {
    document.body.dataset.personality = settings.personality;
    var label = $("personality-label");
    if (label) label.textContent = settings.personality === "streetwise" ? "Street Wise" : "Classic";
  }

  function syncSettingsUI() {
    // These are checkboxes, so sync their checked state (not aria-pressed).
    var v = $("toggle-voice"); if (v) v.checked = settings.voiceOn;
    var w = $("toggle-wake"); if (w) w.checked = settings.wakeWord;
    var m = $("toggle-morning"); if (m) m.checked = settings.morningBriefing;
    var h = $("toggle-hourly"); if (h) h.checked = settings.hourlyChime;
    var t = $("morning-time"); if (t) t.value = settings.morningBriefingTime;
    applyPersonality();
  }

  /* ---------- boot ---------- */

  function boot() {
    statusEl = $("status");
    logEl = $("log");
    document.body.dataset.state = "idle";
    document.body.dataset.personality = settings.personality;

    if (!speechSupported) {
      setStatus("Speech recognition is not supported in this browser — type your commands below. Chrome or Edge recommended for voice.");
    } else {
      setStatus("Tap the core or say “Hey Jarvis” to talk.");
    }
    if (!synth) {
      var note = $("voice-note");
      if (note) note.textContent = "Spoken replies are not available in this browser — replies will appear as text.";
    }

    $("core").addEventListener("click", listenOnce);
    $("btn-listen").addEventListener("click", listenOnce);
    $("btn-stop").addEventListener("click", function () { stopSpeaking(); stopWakeListening(); listening = false; setState("idle"); });
    $("btn-briefing").addEventListener("click", function () { handleInput("briefing", "button"); });

    var form = $("chat-form");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = $("chat-input");
      var value = input.value;
      input.value = "";
      handleInput(value, "typed");
    });

    $("toggle-voice").addEventListener("click", function () {
      settings.voiceOn = !settings.voiceOn; saveSettings(); syncSettingsUI();
      if (!settings.voiceOn) stopSpeaking();
    });
    $("toggle-wake").addEventListener("click", function () {
      settings.wakeWord = !settings.wakeWord; saveSettings(); syncSettingsUI();
      if (settings.wakeWord) startWakeListening(); else stopWakeListening();
    });
    $("toggle-morning").addEventListener("click", function () {
      settings.morningBriefing = !settings.morningBriefing; saveSettings(); syncSettingsUI();
    });
    $("toggle-hourly").addEventListener("click", function () {
      settings.hourlyChime = !settings.hourlyChime; saveSettings(); syncSettingsUI();
    });
    $("morning-time").addEventListener("change", function (e) {
      settings.morningBriefingTime = e.target.value || "07:00"; saveSettings();
    });
    $("btn-personality").addEventListener("click", function () {
      settings.personality = settings.personality === "classic" ? "streetwise" : "classic";
      saveSettings(); applyPersonality();
    });

    syncSettingsUI();

    // Automation boots after this file; it will run the morning briefing
    // and start the timer/reminder engine.
    if (window.JarvisAutomation) window.JarvisAutomation.start();

    // Start the wake-word loop (if enabled and supported).
    if (settings.wakeWord) startWakeListening();
  }

  /* ---------- public API for automation.js ---------- */

  window.Jarvis = {
    handleInput: handleInput,
    respond: respond,
    speak: speak,
    briefingText: briefingText,
    listDue: listDue,
    clearDue: clearDue,
    addLog: addLog,
    getSettings: function () { return settings; },
    getNotes: function () { return notes; },
  };

  document.addEventListener("DOMContentLoaded", boot);
})();
