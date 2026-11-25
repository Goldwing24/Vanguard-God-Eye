/* Vanguard Coordinator — the Central Agent.
 *
 * Reporting chain: Bots -> Central Agent -> Jarvis -> Goldwing.
 *
 * The Central Agent collects all 7 Street Wise bot reports
 * (agents.js), deduplicates them, flags blockers and anything that
 * needs Goldwing's approval, and builds one combined summary that
 * Jarvis can speak and show.
 *
 * STANDING RULE: nothing uploads to YouTube without Goldwing's
 * approval. Approvals live here, in localStorage, and only change
 * when Goldwing taps Approve / Reject or tells Jarvis
 * "approve video …". No bot, and not this agent, can approve its
 * own work or upload anything.
 *
 * Jarvis calls: window.VanguardAgent.getJarvisBriefing()
 *   -> { text, summary, blockers, approvalsNeeded, nextSteps }
 */
(function () {
  "use strict";

  var LS_APPROVALS = "streetwise.approvals";

  function loadJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }
  function nowISO() { return new Date().toISOString(); }

  function seedApprovals() {
    return [
      {
        id: "ap-upload-ep001", type: "upload",
        title: "Upload Episode 001 — “Your First $1,000”",
        detail: "Published on @streetwisemoney 2026-11-23 — https://youtu.be/dh9pwq_xGhI — 67 views, 6 likes, 0 comments (checked 2026-11-25). No longer waiting.",
        status: "approved", decidedAt: "2026-11-25"
      },
      {
        id: "ap-script-ep002", type: "script",
        title: "Approve script — Episode 002 “5 Money Mistakes Keeping You Broke”",
        detail: "Script draft in progress. Voiceover cannot start until Goldwing approves the script.",
        status: "pending", decidedAt: null
      },
      {
        id: "ap-idea-ep003", type: "idea",
        title: "Approve new idea — “Credit Score Myths” (from Trend Researcher)",
        detail: "Sample trend proposed by the Trend Researcher. Approving it turns it into Episode 003 at the Idea stage.",
        status: "pending", decidedAt: null
      }
    ];
  }

  function getApprovals() {
    var items = loadJSON(LS_APPROVALS, null);
    if (!items) { items = seedApprovals(); saveJSON(LS_APPROVALS, items); return items; }
    // Migration 2026-11-25: Episode 001 is published, so a stored
    // pending upload approval for it is out of date — mark it approved.
    var changed = false;
    items.forEach(function (a) {
      if (a.id === "ap-upload-ep001" && a.status === "pending") {
        a.status = "approved"; a.decidedAt = "2026-11-25";
        a.detail = "Published on @streetwisemoney 2026-11-23 — https://youtu.be/dh9pwq_xGhI — 67 views, 6 likes, 0 comments (checked 2026-11-25). No longer waiting.";
        changed = true;
      }
    });
    if (changed) saveJSON(LS_APPROVALS, items);
    return items;
  }
  function saveApprovals(items) { saveJSON(LS_APPROVALS, items); }

  function pendingApprovals() {
    return getApprovals().filter(function (a) { return a.status === "pending"; });
  }

  function decideApproval(id, decision) {
    // decision: "approved" | "rejected". Only Goldwing's action calls this.
    var items = getApprovals();
    var found = null;
    items.forEach(function (a) {
      if (a.id === id) { a.status = decision; a.decidedAt = nowISO(); found = a; }
    });
    saveApprovals(items);
    if (found && window.StreetWise) {
      window.StreetWise.logActivity("Vanguard Coordinator",
        "Goldwing " + decision + ": " + found.title + ".");
    }
    if (window.VanguardAgentUI) window.VanguardAgentUI.render();
    return found;
  }

  function approveVideo(ref) {
    // Find a pending approval matching an episode title / number / id.
    var lower = String(ref || "").toLowerCase();
    var items = pendingApprovals();
    var i, a;
    var numMatch = lower.match(/episode\s*0*(\d+)/) || lower.match(/\bep0*(\d+)\b/);
    var num = numMatch ? parseInt(numMatch[1], 10) : null;
    for (i = 0; i < items.length; i++) {
      a = items[i];
      if (num !== null && a.id.indexOf("ep00" + num) !== -1) return decideApproval(a.id, "approved");
      if (lower.indexOf("credit") !== -1 && a.id.indexOf("ep003") !== -1) return decideApproval(a.id, "approved");
      if (a.title.toLowerCase().indexOf(lower) !== -1 && lower.length > 3) return decideApproval(a.id, "approved");
    }
    return null;
  }

  /* ---------- collecting and combining bot reports ---------- */

  function collectReports() {
    if (!window.StreetWise) return [];
    return window.StreetWise.collectReports();
  }

  function getSummary() {
    var reports = collectReports();
    var blockers = [];
    var approvalsNeeded = pendingApprovals();
    var nextSteps = [];
    var seen = {};

    reports.forEach(function (r) {
      if (r.blocked && !seen["b:" + r.blocked]) { seen["b:" + r.blocked] = true; blockers.push(r.name + ": " + r.blocked); }
      if (r.next && !seen["n:" + r.next]) { seen["n:" + r.next] = true; nextSteps.push(r.name + ": " + r.next); }
    });

    var videos = window.StreetWise ? window.StreetWise.getVideos() : [];
    var summary = reports.length
      ? "Street Wise: " + videos.length + " seeded episodes on file. " +
        videos.map(function (v) { return "Episode " + v.number + " (" + v.title + ") is at " + v.stage + "."; }).join(" ") +
        " " + reports.filter(function (r) { return r.needsApproval; }).length + " bots need your approval, and " +
        approvalsNeeded.length + " approval item" + (approvalsNeeded.length === 1 ? " is" : "s are") + " waiting on you."
      : "Street Wise: no bot reports available.";

    return {
      summary: summary,
      blockers: blockers,
      approvalsNeeded: approvalsNeeded,
      nextSteps: nextSteps,
      reports: reports,
      generatedAt: nowISO()
    };
  }

  // The function Jarvis calls. Returns plain text for speaking plus the
  // structured summary for the dashboard.
  function getJarvisBriefing() {
    var s = getSummary();
    var parts = [s.summary];
    if (s.blockers.length) parts.push("Blockers: " + s.blockers.join(" "));
    if (s.approvalsNeeded.length) {
      parts.push("Waiting on your approval: " + s.approvalsNeeded.map(function (a) { return a.title; }).join("; ") + ".");
    }
    if (s.nextSteps.length) parts.push("Next steps: " + s.nextSteps.join(" "));
    return {
      text: parts.join(" "),
      summary: s.summary,
      blockers: s.blockers,
      approvalsNeeded: s.approvalsNeeded,
      nextSteps: s.nextSteps,
      reports: s.reports
    };
  }

  window.VanguardAgent = {
    collectReports: collectReports,
    getSummary: getSummary,
    getJarvisBriefing: getJarvisBriefing,
    getApprovals: getApprovals,
    pendingApprovals: pendingApprovals,
    decideApproval: decideApproval,
    approveVideo: approveVideo
  };

  /* ---------- dashboard UI (agent cards, videos, approvals, KPIs) ---------- */

  function $(id) { return document.getElementById(id); }

  function el(tag, text, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  function renderAgentCards() {
    var wrap = $("agent-cards");
    if (!wrap || !window.StreetWise) return;
    wrap.innerHTML = "";
    var reports = collectReports();
    window.StreetWise.bots.forEach(function (bot, i) {
      var r = reports[i] || bot.report();
      var card = el("article", null, "agent-card");
      var head = el("div", null, "agent-head");
      head.appendChild(el("strong", bot.name));
      head.appendChild(el("span", "Stage: " + bot.stage, "meta"));
      card.appendChild(head);
      card.appendChild(el("p", bot.role, "muted"));
      card.appendChild(el("p", "Done: " + r.done));
      card.appendChild(el("p", "Next: " + r.next));
      if (r.blocked) card.appendChild(el("p", "Blocked: " + r.blocked, "blocked"));
      if (r.needsApproval) card.appendChild(el("span", "Needs Goldwing approval", "badge badge-approval"));
      var run = el("button", "Run task", null);
      run.type = "button";
      run.addEventListener("click", function () {
        // Pick the first video that has not yet passed this bot's stage,
        // so running a task never moves an episode backwards.
        var videos = window.StreetWise.getVideos();
        var stages = window.StreetWise.STAGES;
        var video = null;
        var i;
        for (i = 0; i < videos.length; i++) {
          if (stages.indexOf(videos[i].stage) <= stages.indexOf(bot.stage)) { video = videos[i]; break; }
        }
        if (!video) video = videos[0] || null;
        var result = bot.runTask(video);
        if (window.Jarvis) window.Jarvis.addLog("jarvis", bot.name + ": " + result, "jarvis");
        render();
      });
      card.appendChild(run);
      wrap.appendChild(card);
    });
  }

  function renderVideos() {
    var board = $("video-list");
    if (!board || !window.StreetWise) return;
    board.innerHTML = "";
    var videos = window.StreetWise.getVideos();
    window.StreetWise.STAGES.forEach(function (stage) {
      var col = el("div", null, "pipeline-col");
      col.appendChild(el("h3", stage));
      var inStage = videos.filter(function (v) { return v.stage === stage; });
      if (!inStage.length) { col.appendChild(el("p", "—", "muted")); }
      inStage.forEach(function (v) {
        var card = el("div", null, "pipeline-card");
        card.appendChild(el("strong", "Episode " + v.number + " — " + v.title));
        var meta = v.length + (v.approved ? " · approved" : "") + " · " + (v.source === "live" ? "live on @streetwisemoney" : v.source === "seeded" ? "seeded sample" : "entered");
        if (v.publishedAt) meta += " · published " + v.publishedAt;
        if (v.views !== undefined && v.views !== null) meta += " · " + v.views + " views";
        card.appendChild(el("span", meta, "meta"));
        if (v.url) {
          var link = el("a", "Watch on YouTube", null);
          link.href = v.url; link.target = "_blank"; link.rel = "noopener";
          card.appendChild(link);
        }
        col.appendChild(card);
      });
      board.appendChild(col);
    });
  }

  function renderApprovals() {
    var list = $("approval-list");
    if (!list) return;
    list.innerHTML = "";
    var items = getApprovals();
    if (!items.length) {
      list.appendChild(el("li", "No approval items.", "empty"));
      return;
    }
    items.forEach(function (a) {
      var li = el("li", null, "approval-item");
      var wrap = el("div");
      wrap.appendChild(el("span", a.title));
      wrap.appendChild(el("small", a.detail, "muted"));
      li.appendChild(wrap);
      var status = el("span", a.status === "pending" ? "Waiting on Goldwing" : a.status, "meta");
      li.appendChild(status);
      if (a.status === "pending") {
        var ok = el("button", "Approve", null);
        ok.type = "button";
        ok.addEventListener("click", function () {
          decideApproval(a.id, "approved");
          if (window.Jarvis) window.Jarvis.addLog("jarvis", "Approved: " + a.title, "jarvis");
          render();
        });
        var no = el("button", "Reject", null);
        no.type = "button";
        no.addEventListener("click", function () {
          decideApproval(a.id, "rejected");
          if (window.Jarvis) window.Jarvis.addLog("jarvis", "Rejected: " + a.title, "jarvis");
          render();
        });
        li.appendChild(ok);
        li.appendChild(no);
      }
      list.appendChild(li);
    });
  }

  function renderCentralSummary() {
    var box = $("central-summary");
    if (!box) return;
    var s = getSummary();
    box.innerHTML = "";
    box.appendChild(el("p", s.summary));
    if (s.blockers.length) box.appendChild(el("p", "Blockers — " + s.blockers.join(" | "), "blocked"));
    box.appendChild(el("p", s.approvalsNeeded.length
      ? s.approvalsNeeded.length + " item(s) waiting on Goldwing's approval. Nothing uploads without it."
      : "No approvals waiting.", "muted"));
  }

  function renderKPIs() {
    var list = $("kpi-list");
    if (!list || !window.StreetWise) return;
    var k = window.StreetWise.getKPIs();
    list.innerHTML = "";
    var rows = [
      ["Subscribers", k.subscribers], ["Views", k.views],
      ["Videos published", k.videosPublished], ["28-day revenue", k.revenue28d === null ? null : "$" + k.revenue28d]
    ];
    rows.forEach(function (row) {
      var li = el("li");
      li.appendChild(el("span", row[0]));
      li.appendChild(el("span", row[1] === null ? "Not set yet — enter it below" : String(row[1]), "meta"));
      list.appendChild(li);
    });
    var note = $("kpi-note");
    if (note) note.textContent = "Real numbers from @streetwisemoney, checked 2026-11-25 — 4 subscribers, 67 views, 1 video published. No live YouTube connection, so update these by hand when they change.";
  }

  function renderActivity() {
    var list = $("activity-list");
    if (!list || !window.StreetWise) return;
    list.innerHTML = "";
    var log = window.StreetWise.getActivity();
    if (!log.length) {
      list.appendChild(el("li", "No bot activity yet. Tap “Run task” on a bot card.", "empty"));
      return;
    }
    log.slice(0, 8).forEach(function (entry) {
      var li = el("li");
      li.appendChild(el("span", entry.bot + ": " + entry.text));
      li.appendChild(el("span", new Date(entry.at).toLocaleString(), "meta"));
      list.appendChild(li);
    });
  }

  function render() {
    renderAgentCards();
    renderVideos();
    renderApprovals();
    renderCentralSummary();
    renderKPIs();
    renderActivity();
  }

  function bootUI() {
    var form = $("kpi-form");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (!window.StreetWise) return;
        var map = [
          ["kpi-subscribers", "subscribers"], ["kpi-views", "views"],
          ["kpi-videos", "videosPublished"], ["kpi-revenue", "revenue28d"]
        ];
        map.forEach(function (pair) {
          var input = $(pair[0]);
          if (input && input.value !== "") {
            window.StreetWise.setKPI(pair[1], Number(input.value));
          }
        });
        form.reset();
        render();
        if (window.Jarvis) window.Jarvis.addLog("jarvis", "Channel KPIs updated.", "jarvis");
      });
    }
    render();
  }

  window.VanguardAgentUI = { render: render };
  document.addEventListener("DOMContentLoaded", bootUI);
})();
