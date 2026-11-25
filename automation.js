/* Jarvis v1 — automation engine.
 *
 * What runs without being asked (while this page is open):
 *  1. Timers & reminders — checked every 10 seconds; when one is due,
 *     Jarvis speaks it and logs it. Timers/reminders survive a reload
 *     (they are stored in localStorage) and fire when the page is open again.
 *  2. Morning briefing — on the first open of the day at/after the
 *     configured time (default 07:00), Jarvis gives the briefing
 *     automatically. Once per day.
 *  3. Hourly time check — optional; on the hour, Jarvis announces the time.
 *  4. Daily routines — the user can add a routine by voice
 *     ("automate a morning briefing at 7am") or with the form below.
 *     Each routine fires once a day at its time while the page is open.
 *
 * Honest limit: a browser page cannot run in the background. If the tab
 * is closed, nothing fires until it is opened again. The README documents
 * a GitHub Actions option for a daily check-in file if Goldwing wants
 * something that runs even with the browser closed.
 */
(function () {
  "use strict";

  var LS_DUE = "jarvis.due";
  var LS_ROUTINES = "jarvis.routines";
  var LS_LAST = "jarvis.lastAutomation";

  function loadJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }
  function $(id) { return document.getElementById(id); }
  function todayKey() { return new Date().toDateString(); }
  function nowMinutes() {
    var d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }
  function clockToMinutes(clock) {
    var parts = clock.split(":");
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }

  var timerId = null;

  /* ---------- due items: timers & reminders ---------- */

  function renderDue() {
    var list = $("due-list");
    if (!list) return;
    var items = loadJSON(LS_DUE, []).slice().sort(function (a, b) { return a.dueAt - b.dueAt; });
    list.innerHTML = "";
    if (!items.length) {
      list.innerHTML = '<li class="empty">No timers or reminders. Say “set a timer for 5 minutes”.</li>';
      return;
    }
    items.forEach(function (item) {
      var li = document.createElement("li");
      var span = document.createElement("span");
      span.textContent = item.label;
      var meta = document.createElement("span");
      meta.className = "meta";
      meta.textContent = new Date(item.dueAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      var btn = document.createElement("button");
      btn.textContent = "Clear";
      btn.addEventListener("click", function () { window.Jarvis.clearDue(item.id); });
      li.appendChild(span); li.appendChild(meta); li.appendChild(btn);
      list.appendChild(li);
    });
  }

  function checkDue() {
    var now = Date.now();
    var items = loadJSON(LS_DUE, []);
    var remaining = [];
    items.forEach(function (item) {
      if (item.dueAt <= now) {
        var message = item.kind === "timer"
          ? "Timer finished: " + item.label + "."
          : "Reminder: " + item.label + ".";
        window.Jarvis.addLog("auto", message, "auto");
        window.Jarvis.speak(message);
      } else {
        remaining.push(item);
      }
    });
    if (remaining.length !== items.length) {
      saveJSON(LS_DUE, remaining);
      renderDue();
    }
  }

  /* ---------- routines ---------- */

  function listRoutines() { return loadJSON(LS_ROUTINES, []); }

  function addRoutine(routine) {
    var routines = listRoutines();
    routines.push({
      id: Date.now() + Math.random(),
      label: routine.label || "Daily check-in",
      time: routine.time,
      kind: routine.kind || "briefing",
      enabled: routine.enabled !== false,
      lastRun: null,
    });
    saveJSON(LS_ROUTINES, routines);
    renderRoutines();
  }

  function renderRoutines() {
    var list = $("routine-list");
    if (!list) return;
    var routines = listRoutines();
    list.innerHTML = "";
    if (!routines.length) {
      list.innerHTML = '<li class="empty">No routines yet. Say “automate a morning briefing at 7am”.</li>';
      return;
    }
    routines.forEach(function (r) {
      var li = document.createElement("li");
      var span = document.createElement("span");
      span.textContent = r.label;
      var meta = document.createElement("span");
      meta.className = "meta";
      meta.textContent = "daily at " + r.time + (r.enabled ? "" : " · off");
      var btn = document.createElement("button");
      btn.textContent = r.enabled ? "Turn off" : "Turn on";
      btn.addEventListener("click", function () {
        var all = listRoutines();
        all.forEach(function (x) { if (x.id === r.id) x.enabled = !x.enabled; });
        saveJSON(LS_ROUTINES, all);
        renderRoutines();
      });
      var del = document.createElement("button");
      del.textContent = "Delete";
      del.addEventListener("click", function () {
        saveJSON(LS_ROUTINES, listRoutines().filter(function (x) { return x.id !== r.id; }));
        renderRoutines();
      });
      li.appendChild(span); li.appendChild(meta); li.appendChild(btn); li.appendChild(del);
      list.appendChild(li);
    });
  }

  function runRoutine(routine) {
    var message = routine.kind === "briefing"
      ? "Automated routine — " + routine.label + ". " + window.Jarvis.briefingText()
      : "Automated routine — " + routine.label + ".";
    window.Jarvis.addLog("auto", message, "auto");
    window.Jarvis.speak(message);
    var routines = listRoutines();
    routines.forEach(function (x) { if (x.id === routine.id) x.lastRun = todayKey(); });
    saveJSON(LS_ROUTINES, routines);
  }

  function checkRoutines() {
    var routines = listRoutines();
    routines.forEach(function (r) {
      if (!r.enabled || r.lastRun === todayKey()) return;
      if (nowMinutes() >= clockToMinutes(r.time)) runRoutine(r);
    });
  }

  /* ---------- morning briefing & hourly chime ---------- */

  function checkMorningBriefing() {
    var settings = window.Jarvis.getSettings();
    if (!settings.morningBriefing) return;
    var last = loadJSON(LS_LAST, {});
    if (last.morningBriefing === todayKey()) return;
    if (nowMinutes() < clockToMinutes(settings.morningBriefingTime)) return;
    last.morningBriefing = todayKey();
    saveJSON(LS_LAST, last);
    var message = "Good morning. Here is your automated briefing. " + window.Jarvis.briefingText();
    window.Jarvis.addLog("auto", message, "auto");
    window.Jarvis.speak(message);
  }

  function checkHourlyChime() {
    var settings = window.Jarvis.getSettings();
    if (!settings.hourlyChime) return;
    var d = new Date();
    if (d.getMinutes() !== 0) return;
    var last = loadJSON(LS_LAST, {});
    var key = todayKey() + " " + d.getHours();
    if (last.hourly === key) return;
    last.hourly = key;
    saveJSON(LS_LAST, last);
    window.Jarvis.speak("It is " + d.getHours() + " o'clock.");
  }

  /* ---------- notes panel ---------- */

  function renderNotes() {
    var list = $("note-list");
    if (!list) return;
    var notes = window.Jarvis.getNotes();
    list.innerHTML = "";
    if (!notes.length) {
      list.innerHTML = '<li class="empty">No notes yet. Say “take a note …”.</li>';
      return;
    }
    notes.slice(-5).reverse().forEach(function (n) {
      var li = document.createElement("li");
      var span = document.createElement("span");
      span.textContent = n.text;
      var meta = document.createElement("span");
      meta.className = "meta";
      meta.textContent = new Date(n.at).toLocaleDateString();
      li.appendChild(span); li.appendChild(meta);
      list.appendChild(li);
    });
  }

  /* ---------- start / tick ---------- */

  function tick() {
    checkDue();
    checkRoutines();
    checkMorningBriefing();
    checkHourlyChime();
  }

  function start() {
    renderDue();
    renderRoutines();
    renderNotes();
    tick();
    if (timerId) clearInterval(timerId);
    timerId = setInterval(tick, 10000); // every 10 seconds

    var form = $("routine-form");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var label = $("routine-label").value.trim() || "Daily check-in";
        var time = $("routine-time").value || "07:00";
        addRoutine({ label: label, time: time, kind: "briefing", enabled: true });
        window.Jarvis.addLog("auto", "Routine added: " + label + " every day at " + time + ".", "auto");
        form.reset();
        $("routine-time").value = "07:00";
      });
    }
  }

  window.JarvisAutomation = {
    start: start,
    renderDue: renderDue,
    renderRoutines: renderRoutines,
    renderNotes: renderNotes,
    listRoutines: listRoutines,
    addRoutine: addRoutine,
  };
})();
