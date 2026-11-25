/* Street Wise Money — the 7 bots.
 *
 * Faceless YouTube channel @streetwisemoney: practical money and
 * business lessons for young adults. Cadence: 2 long videos a week
 * (Tue & Fri, 6-12 min) plus 3-5 Shorts.
 *
 * Content pipeline: Idea -> Script -> Voiceover -> Edit -> Thumbnail
 * -> Approval -> Scheduled -> Published.
 *
 * STANDING RULE, enforced everywhere in this file and in
 * central-agent.js: NOTHING uploads to YouTube without Goldwing's
 * approval. These bots prepare, draft and propose. They never upload,
 * never publish, and never schedule a publish without an approval
 * record set by Goldwing. The dashboard has no YouTube connection.
 *
 * All data is seeded/sample or entered by Goldwing, stored only in
 * this browser (localStorage). There is NO live YouTube data here:
 * trends are labelled sample, KPIs start unset until Goldwing enters
 * them, and episode data is the seeded Episodes 001 and 002.
 *
 * Reporting chain: each bot's report() feeds the Central Agent
 * (central-agent.js), which feeds Jarvis, which reports to Goldwing.
 */
(function () {
  "use strict";

  var LS_VIDEOS = "streetwise.videos";
  var LS_KPIS = "streetwise.kpis";
  var LS_ACTIVITY = "streetwise.activity";
  var LS_TRENDS = "streetwise.trends";

  var STAGES = ["Idea", "Script", "Voiceover", "Edit", "Thumbnail", "Approval", "Scheduled", "Published"];

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

  /* ---------- seeded data (clearly labelled sample) ---------- */

  function seedVideos() {
    return [
      {
        id: "ep001", number: 1,
        title: "Your First $1,000",
        topic: "Saving your first $1,000",
        pillar: "Saving",
        stage: "Approval",
        approved: true,
        targetPublish: "Friday",
        length: "6-12 min",
        source: "seeded",
        notes: "Approved, ready to upload. Upload itself still needs Goldwing's final approval."
      },
      {
        id: "ep002", number: 2,
        title: "5 Money Mistakes Keeping You Broke",
        topic: "Common money mistakes for young adults",
        pillar: "Money habits",
        stage: "Script",
        approved: false,
        targetPublish: "Next Tuesday",
        length: "6-12 min",
        source: "seeded",
        notes: "Script draft in progress. Script approval is waiting on Goldwing."
      }
    ];
  }

  // Sample trends only — NOT live YouTube / search data. The Trend
  // Researcher proposes these as starting points for Goldwing to check.
  function seedTrends() {
    return [
      { topic: "Credit score myths", angle: "What actually hurts your score at 18-25", source: "sample" },
      { topic: "Emergency fund in 30 days", angle: "A starter fund on a small income", source: "sample" },
      { topic: "Side hustles that actually pay", angle: "Three with real numbers, no hype", source: "sample" }
    ];
  }

  function getVideos() {
    var videos = loadJSON(LS_VIDEOS, null);
    if (!videos) { videos = seedVideos(); saveJSON(LS_VIDEOS, videos); }
    return videos;
  }
  function saveVideos(videos) { saveJSON(LS_VIDEOS, videos); }

  function getKPIs() { return loadJSON(LS_KPIS, { subscribers: null, views: null, videosPublished: null, revenue28d: null, updatedAt: null }); }
  function setKPI(key, value) {
    var kpis = getKPIs();
    kpis[key] = value;
    kpis.updatedAt = nowISO();
    saveJSON(LS_KPIS, kpis);
    return kpis;
  }

  function getTrends() {
    var trends = loadJSON(LS_TRENDS, null);
    if (!trends) { trends = seedTrends(); saveJSON(LS_TRENDS, trends); }
    return trends;
  }

  function logActivity(botName, text) {
    var log = loadJSON(LS_ACTIVITY, []);
    log.unshift({ bot: botName, text: text, at: nowISO() });
    saveJSON(LS_ACTIVITY, log.slice(0, 50));
  }
  function getActivity() { return loadJSON(LS_ACTIVITY, []); }

  function findVideo(ref) {
    var videos = getVideos();
    var lower = String(ref || "").toLowerCase();
    var i, v;
    for (i = 0; i < videos.length; i++) {
      v = videos[i];
      if (v.id === lower || ("episode " + v.number) === lower || ("ep" + v.number) === lower ||
          v.title.toLowerCase().indexOf(lower) !== -1 || lower.indexOf(v.title.toLowerCase()) !== -1) {
        return v;
      }
    }
    return null;
  }

  function advanceVideo(video, toStage, botName) {
    var videos = getVideos();
    var i;
    for (i = 0; i < videos.length; i++) {
      if (videos[i].id === video.id) {
        videos[i].stage = toStage;
        saveVideos(videos);
        logActivity(botName, "Moved Episode " + videos[i].number + " (" + videos[i].title + ") to " + toStage + ".");
        return videos[i];
      }
    }
    return video;
  }

  /* ---------- the 7 bots ---------- */

  // Every bot: id, name, role, stage it owns, report(), runTask(video).
  // report() returns { bot, name, done, next, blocked, needsApproval, timestamp }
  //   done / next / blocked are short plain-language strings.
  // runTask(video) advances that video one step in the bot's stage and
  // logs it. It never uploads, publishes or schedules anything.

  var bots = [
    {
      id: "trend", name: "Trend Researcher", role: "Finds trending money topics and proposes angles.",
      stage: "Idea",
      runTask: function (video) {
        var trends = getTrends();
        var topic = video ? video.title : (trends[0] ? trends[0].topic : "a new money topic");
        logActivity("Trend Researcher", "Researched trends and proposed an angle for: " + topic + ". (Sample trends — check them before using.)");
        return "Trend report ready for: " + topic + ". Top sample trends: " + trends.map(function (t) { return t.topic; }).join("; ") + ".";
      },
      report: function () {
        var trends = getTrends();
        return {
          bot: "trend", name: "Trend Researcher",
          done: "Top 3 sample trends ready: " + trends.map(function (t) { return t.topic + " — " + t.angle; }).join("; ") + ".",
          next: "Goldwing to pick one trend to turn into Episode 003.",
          blocked: null,
          needsApproval: true,
          timestamp: nowISO()
        };
      }
    },
    {
      id: "scriptwriter", name: "Scriptwriter", role: "Drafts scripts and outlines from an approved idea.",
      stage: "Script",
      runTask: function (video) {
        if (!video) return "No video given. Say which episode to script.";
        var done = advanceVideo(video, "Script", "Scriptwriter");
        return "Script draft started for Episode " + done.number + " (" + done.title + "). Draft outline saved in the video notes; approval still needed before voiceover.";
      },
      report: function () {
        var ep002 = findVideo("ep002");
        return {
          bot: "scriptwriter", name: "Scriptwriter",
          done: ep002 ? "Episode 002 script draft in progress (" + ep002.title + ", stage: " + ep002.stage + ")." : "No script in progress.",
          next: "Finish the Episode 002 script, then send it for Goldwing's approval.",
          blocked: "Waiting on Goldwing's approval of the Episode 002 script before voiceover can start.",
          needsApproval: true,
          timestamp: nowISO()
        };
      }
    },
    {
      id: "voiceover", name: "Voiceover Producer", role: "Tracks voiceover recording readiness and status.",
      stage: "Voiceover",
      runTask: function (video) {
        if (!video) return "No video given. Say which episode to record.";
        if (video.stage === "Script" && !video.approved) {
          return "Cannot start voiceover for Episode " + video.number + " yet — its script is not approved by Goldwing.";
        }
        var done = advanceVideo(video, "Voiceover", "Voiceover Producer");
        return "Voiceover ready to record for Episode " + done.number + " (" + done.title + "). Script approved, recording checklist prepared.";
      },
      report: function () {
        var ep001 = findVideo("ep001");
        var ep002 = findVideo("ep002");
        return {
          bot: "voiceover", name: "Voiceover Producer",
          done: ep001 ? "Episode 001 voiceover complete (" + ep001.title + ")." : "No voiceover complete.",
          next: ep002 ? "Record Episode 002 once its script is approved." : "Wait for the next approved script.",
          blocked: "Episode 002 voiceover is blocked until Goldwing approves its script.",
          needsApproval: false,
          timestamp: nowISO()
        };
      }
    },
    {
      id: "editor", name: "Video Editor", role: "Tracks edit status and cut progress.",
      stage: "Edit",
      runTask: function (video) {
        if (!video) return "No video given. Say which episode to edit.";
        var done = advanceVideo(video, "Edit", "Video Editor");
        return "Edit started for Episode " + done.number + " (" + done.title + "). Cut in progress; thumbnail stage comes next.";
      },
      report: function () {
        var ep001 = findVideo("ep001");
        return {
          bot: "editor", name: "Video Editor",
          done: ep001 ? "Episode 001 edit complete (" + ep001.title + ", now in " + ep001.stage + ")." : "No edit complete.",
          next: "Edit Episode 002 once its voiceover is recorded.",
          blocked: null,
          needsApproval: false,
          timestamp: nowISO()
        };
      }
    },
    {
      id: "thumbnail", name: "Thumbnail & Title Designer", role: "Proposes 3 titles and thumbnail concepts per video.",
      stage: "Thumbnail",
      runTask: function (video) {
        if (!video) return "No video given. Say which episode needs titles.";
        var done = advanceVideo(video, "Thumbnail", "Thumbnail & Title Designer");
        return "3 title and thumbnail concepts proposed for Episode " + done.number + " (" + done.title + "). See the agent card for the options.";
      },
      report: function () {
        var ep001 = findVideo("ep001");
        return {
          bot: "thumbnail", name: "Thumbnail & Title Designer",
          done: ep001 ? "3 title options proposed for Episode 001: “Your First $1,000 (Start Today)”, “Save $1,000 Fast — Even on a Small Income”, “The First $1,000 Is the Hardest”. Thumbnail concepts: bold number, before/after wallet, checklist." : "No titles proposed yet.",
          next: "Propose titles and thumbnails for Episode 002 once its edit is done.",
          blocked: null,
          needsApproval: true,
          timestamp: nowISO()
        };
      }
    },
    {
      id: "upload", name: "Upload / SEO Manager", role: "Prepares the upload checklist, SEO title, description and tags. Never uploads.",
      stage: "Scheduled",
      runTask: function (video) {
        if (!video) return "No video given. Say which episode to prepare for upload.";
        logActivity("Upload / SEO Manager", "Prepared the upload checklist and SEO pack for Episode " + video.number + " (" + video.title + "). Marked NEEDS GOLDWING APPROVAL — not uploaded, not scheduled.");
        return "Upload checklist and SEO pack ready for Episode " + video.number + ". It is marked needs Goldwing approval — I will not upload or schedule it until you approve it.";
      },
      report: function () {
        var ep001 = findVideo("ep001");
        return {
          bot: "upload", name: "Upload / SEO Manager",
          done: ep001 ? "Episode 001 upload checklist and SEO pack ready (title, description, tags). Status: needs Goldwing approval — NOT uploaded." : "No video ready to upload.",
          next: "Wait for Goldwing to approve the Episode 001 upload, then hand it to Goldwing to publish in YouTube Studio.",
          blocked: "Upload is blocked by design until Goldwing approves it. Nothing uploads automatically.",
          needsApproval: true,
          timestamp: nowISO()
        };
      }
    },
    {
      id: "analytics", name: "Analytics", role: "Tracks channel KPIs Goldwing enters and reports what to improve.",
      stage: "Published",
      runTask: function () {
        var kpis = getKPIs();
        if (kpis.subscribers === null) {
          return "No KPIs entered yet. Say “set subscribers 1250” (or views / videos published / revenue) and I will track them.";
        }
        return "KPIs checked. Subscribers: " + kpis.subscribers + ", views: " + (kpis.views === null ? "not set" : kpis.views) + ", videos published: " + (kpis.videosPublished === null ? "not set" : kpis.videosPublished) + ", 28-day revenue: " + (kpis.revenue28d === null ? "not set" : "$" + kpis.revenue28d) + ".";
      },
      report: function () {
        var kpis = getKPIs();
        if (kpis.subscribers === null && kpis.views === null) {
          return {
            bot: "analytics", name: "Analytics",
            done: "No channel KPIs entered yet — no invented stats. Enter them and I will track changes.",
            next: "Goldwing: say “set subscribers …”, “set views …”, “set videos published …” or “set revenue …”.",
            blocked: "Waiting on Goldwing to enter real channel numbers.",
            needsApproval: false,
            timestamp: nowISO()
          };
        }
        return {
          bot: "analytics", name: "Analytics",
          done: "KPIs on file — subscribers: " + (kpis.subscribers === null ? "not set" : kpis.subscribers) +
            ", views: " + (kpis.views === null ? "not set" : kpis.views) +
            ", videos published: " + (kpis.videosPublished === null ? "not set" : kpis.videosPublished) +
            ", 28-day revenue: " + (kpis.revenue28d === null ? "not set" : "$" + kpis.revenue28d) + ".",
          next: "Keep publishing 2 long videos a week (Tue & Fri) plus 3-5 Shorts, and update KPIs weekly to see what is working.",
          blocked: null,
          needsApproval: false,
          timestamp: nowISO()
        };
      }
    }
  ];

  function getBot(id) {
    var i;
    for (i = 0; i < bots.length; i++) { if (bots[i].id === id) return bots[i]; }
    return null;
  }

  function collectReports() {
    return bots.map(function (b) { return b.report(); });
  }

  window.StreetWise = {
    STAGES: STAGES,
    bots: bots,
    getBot: getBot,
    collectReports: collectReports,
    getVideos: getVideos,
    saveVideos: saveVideos,
    findVideo: findVideo,
    advanceVideo: advanceVideo,
    getKPIs: getKPIs,
    setKPI: setKPI,
    getTrends: getTrends,
    getActivity: getActivity,
    logActivity: logActivity
  };
})();
