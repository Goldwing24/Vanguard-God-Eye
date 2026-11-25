/* Vanguard Ops — HUD Command Center panels.
 *
 * Plain HTML/CSS/JS, no build step, no external libraries.
 * All data is SAMPLE / ENTERED BY GOLDWING, stored only in this
 * browser (localStorage). There is NO live data here:
 *  - Contracts: seeded sample opportunities. Won revenue is summed
 *    from those seeded contracts; the $15,000 target is Goldwing's
 *    cleaning target from the Vanguard dashboard.
 *  - Trading Lab: a SIMULATION. Random-walk EUR/USD, paper trades
 *    only, $10,000 paper balance. No broker, no real orders, no
 *    live market data.
 *  - Tasks / activity: entered locally, stored in localStorage.
 *
 * Jarvis calls window.VanguardOps.getSummary() / getTradingSummary()
 * for voice briefings. window.VanguardOps also exposes addContract,
 * moveContract, openTrade, closeTrade, positionSize, etc.
 */
(function () {
  "use strict";

  var LS_CONTRACTS = "vanguard.contracts";
  var LS_TRADES = "vanguard.trades";
  var LS_TASKS = "vanguard.tasks";
  var LS_ACTIVITY = "vanguard.activity";
  var LS_MARKET = "vanguard.market";

  var CLEANING_TARGET = 15000;
  var PAPER_START = 10000;
  var STAGES = ["Lead", "Qualifying", "Bid prep", "Submitted", "Won", "Lost"];
  var PIP = 0.0001;

  function loadJSON(key, fallback) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch (e) { return fallback; }
  }
  function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }
  function $(id) { return document.getElementById(id); }
  function el(tag, text, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  function money(n) { return "$" + Number(n).toLocaleString(); }
  function fmtDateShort(iso) {
    if (!iso) return "No due date";
    var d = new Date(iso + "T12:00:00");
    return isNaN(d) ? iso : d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  }
  function daysFromNow(days) {
    var d = new Date(); d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  /* ---------- seeded sample data ---------- */

  function seedContracts() {
    return [
      { id: "c1", client: "Navarre Clinic", division: "Cleaning", value: 2500, stage: "Qualifying", due: daysFromNow(10), source: "sample" },
      { id: "c2", client: "Harbor Dental Group", division: "Cleaning", value: 3200, stage: "Bid prep", due: daysFromNow(6), source: "sample" },
      { id: "c3", client: "Riverside Logistics", division: "Cleaning", value: 4800, stage: "Submitted", due: daysFromNow(4), source: "sample" },
      { id: "c4", client: "Meridian Office Park", division: "Cleaning", value: 6100, stage: "Lead", due: daysFromNow(18), source: "sample" },
      { id: "c5", client: "Sunset Care Homes", division: "Cleaning", value: 2900, stage: "Won", due: daysFromNow(-2), source: "sample" },
      { id: "c6", client: "Atlas Fitness — Downtown", division: "Cleaning", value: 5500, stage: "Won", due: daysFromNow(-9), source: "sample" },
      { id: "c7", client: "Northgate Retail", division: "Courier", value: 1800, stage: "Lost", due: daysFromNow(-14), source: "sample" }
    ];
  }
  function seedTasks() {
    return [
      { id: "t1", title: "Check SAM registration", owner: "Compliance", due: daysFromNow(3), status: "Open", source: "sample" },
      { id: "t2", title: "Send Riverside Logistics bid for approval", owner: "Goldwing", due: daysFromNow(2), status: "Open", source: "sample" },
      { id: "t3", title: "Follow up Harbor Dental walkthrough", owner: "Partner Scout", due: daysFromNow(5), status: "Open", source: "sample" },
      { id: "t4", title: "Review Episode 002 script", owner: "Scriptwriter", due: daysFromNow(1), status: "Needs approval", source: "sample" }
    ];
  }

  function getContracts() {
    var c = loadJSON(LS_CONTRACTS, null);
    if (!c) { c = seedContracts(); saveJSON(LS_CONTRACTS, c); }
    return c;
  }
  function saveContracts(c) { saveJSON(LS_CONTRACTS, c); }
  function getTasks() {
    var t = loadJSON(LS_TASKS, null);
    if (!t) { t = seedTasks(); saveJSON(LS_TASKS, t); }
    return t;
  }
  function saveTasks(t) { saveJSON(LS_TASKS, t); }
  function getTrades() { return loadJSON(LS_TRADES, []); }
  function saveTrades(t) { saveJSON(LS_TRADES, t); }
  function getActivity() { return loadJSON(LS_ACTIVITY, []); }

  function logActivity(text) {
    var log = getActivity();
    log.unshift({ text: text, at: new Date().toISOString() });
    saveJSON(LS_ACTIVITY, log.slice(0, 50));
    renderActivity();
  }

  /* ---------- KPIs / summaries ---------- */

  function getSummary() {
    var contracts = getContracts();
    var won = contracts.filter(function (c) { return c.stage === "Won"; });
    var lost = contracts.filter(function (c) { return c.stage === "Lost"; });
    var wonRevenue = won.reduce(function (s, c) { return s + Number(c.value || 0); }, 0);
    var active = contracts.filter(function (c) { return c.stage !== "Won" && c.stage !== "Lost"; });
    var activeValue = active.reduce(function (s, c) { return s + Number(c.value || 0); }, 0);
    var decided = won.length + lost.length;
    var winRate = decided ? Math.round((won.length / decided) * 100) : 0;
    var openTasks = getTasks().filter(function (t) { return t.status !== "Done"; });
    var now = new Date(); now.setHours(0, 0, 0, 0);
    var soon = new Date(); soon.setDate(soon.getDate() + 21);
    var deadlines = contracts.filter(function (c) {
      if (!c.due || c.stage === "Won" || c.stage === "Lost") return false;
      var d = new Date(c.due + "T12:00:00");
      return d >= now && d <= soon;
    }).sort(function (a, b) { return a.due < b.due ? -1 : 1; });
    var trading = getTradingSummary();
    return {
      activeCount: active.length, activeValue: activeValue,
      wonRevenue: wonRevenue, target: CLEANING_TARGET,
      winRate: winRate, wonCount: won.length, lostCount: lost.length,
      openTasks: openTasks.length, paperEquity: trading.equity,
      deadlines: deadlines
    };
  }

  function summaryText() {
    var s = getSummary();
    return "Vanguard Ops (sample data): " + s.activeCount + " active opportunities worth " + money(s.activeValue) +
      " a month. Won monthly revenue is " + money(s.wonRevenue) + " against the " + money(s.target) +
      " cleaning target. Win rate " + s.winRate + " percent. " + s.openTasks + " open tasks. " +
      "Paper trading equity is " + money(Math.round(s.paperEquity)) + " in simulation, not real money.";
  }

  /* ---------- contracts ---------- */

  function addContract(data) {
    var contracts = getContracts();
    var c = {
      id: "c" + Date.now(),
      client: data.client || "Untitled opportunity",
      division: data.division || "Cleaning",
      value: Number(data.value || 0),
      stage: data.stage || "Lead",
      due: data.due || "",
      source: "entered"
    };
    contracts.unshift(c);
    saveContracts(contracts);
    logActivity("Added contract: " + c.client + " — " + money(c.value) + "/mo, " + c.stage + ".");
    renderAll();
    return c;
  }
  function findContract(ref) {
    var lower = String(ref || "").toLowerCase().trim();
    if (!lower) return null;
    var found = null;
    getContracts().forEach(function (c) {
      if (c.client.toLowerCase().indexOf(lower) !== -1 || lower.indexOf(c.client.toLowerCase().split(" ")[0]) !== -1) found = c;
    });
    return found;
  }
  function moveContract(ref, stage) {
    var c = findContract(ref);
    if (!c) return null;
    var contracts = getContracts();
    contracts.forEach(function (x) { if (x.id === c.id) x.stage = stage; });
    saveContracts(contracts);
    logActivity("Moved " + c.client + " to " + stage + ".");
    renderAll();
    return c;
  }

  /* ---------- Trading Lab (simulation) ---------- */

  var market = loadJSON(LS_MARKET, { price: 1.0850, running: false, speed: 1, prevPrice: 1.0850 });
  var marketTimer = null;

  function saveMarket() { saveJSON(LS_MARKET, market); }

  function tickMarket() {
    market.prevPrice = market.price;
    var steps = market.speed || 1;
    for (var i = 0; i < steps; i++) market.price += (Math.random() - 0.5) * 0.0004;
    market.price = Math.round(market.price * 100000) / 100000;
    saveMarket();
    checkStops();
    renderTrading();
  }
  function startMarket() {
    if (market.running) return;
    market.running = true; saveMarket();
    marketTimer = setInterval(tickMarket, 2000);
    logActivity("Trading Lab: simulated EUR/USD feed started.");
    renderTrading();
  }
  function pauseMarket() {
    market.running = false; saveMarket();
    if (marketTimer) { clearInterval(marketTimer); marketTimer = null; }
    logActivity("Trading Lab: simulated EUR/USD feed paused.");
    renderTrading();
  }
  function tradePnl(t) {
    var diff = (market.price - t.entry) / PIP;
    if (t.side === "sell") diff = -diff;
    return diff * Number(t.lots) * 10; // $10 per pip per lot
  }
  function getTradingSummary() {
    var trades = getTrades();
    var open = trades.filter(function (t) { return t.status === "open"; });
    var closed = trades.filter(function (t) { return t.status !== "open"; });
    var realized = closed.reduce(function (s, t) { return s + Number(t.pnl || 0); }, 0);
    var unrealized = open.reduce(function (s, t) { return s + tradePnl(t); }, 0);
    var wins = closed.filter(function (t) { return Number(t.pnl || 0) > 0; }).length;
    return {
      price: market.price, running: market.running,
      equity: PAPER_START + realized + unrealized,
      balance: PAPER_START + realized,
      openCount: open.length, closedCount: closed.length,
      winRate: closed.length ? Math.round((wins / closed.length) * 100) : 0,
      unrealized: unrealized
    };
  }
  function openTrade(side, lots, stopPips, targetPips) {
    var trades = getTrades();
    var t = {
      id: trades.length + 1, side: side, lots: Number(lots || 0.1),
      entry: market.price, stop: Number(stopPips || 0), target: Number(targetPips || 0),
      status: "open", pnl: 0, openedAt: new Date().toISOString()
    };
    trades.push(t); saveTrades(trades);
    logActivity("Paper trade opened: " + side.toUpperCase() + " " + t.lots + " lots EUR/USD at " + t.entry + " (simulation).");
    renderAll();
    return t;
  }
  function closeTrade(id, reason) {
    var trades = getTrades(); var closed = null;
    trades.forEach(function (t) {
      if (t.id === Number(id) && t.status === "open") {
        t.status = "closed"; t.pnl = Math.round(tradePnl(t) * 100) / 100; t.closeReason = reason || "manual";
        closed = t;
      }
    });
    if (closed) {
      saveTrades(trades);
      logActivity("Paper trade " + closed.id + " closed (" + (closed.closeReason || "manual") + "): P&L " + money(Math.round(closed.pnl)) + " (simulation).");
      renderAll();
    }
    return closed;
  }
  function closeAllTrades() {
    var n = 0;
    getTrades().forEach(function (t) { if (t.status === "open" && closeTrade(t.id, "closed all")) n++; });
    return n;
  }
  function checkStops() {
    getTrades().forEach(function (t) {
      if (t.status !== "open") return;
      var diffPips = (market.price - t.entry) / PIP;
      if (t.side === "sell") diffPips = -diffPips;
      if (t.stop && diffPips <= -t.stop) closeTrade(t.id, "stop-loss");
      else if (t.target && diffPips >= t.target) closeTrade(t.id, "take-profit");
    });
  }
  function positionSize(riskPct, stopPips) {
    var s = getTradingSummary();
    if (!stopPips || stopPips <= 0) return null;
    var riskDollars = s.equity * (Number(riskPct || 1) / 100);
    var lots = riskDollars / (stopPips * 10);
    return { riskDollars: Math.round(riskDollars * 100) / 100, lots: Math.round(lots * 100) / 100 };
  }

  /* ---------- tasks ---------- */

  function addTask(data) {
    var tasks = getTasks();
    var t = { id: "t" + Date.now(), title: data.title || "Untitled task", owner: data.owner || "Goldwing", due: data.due || "", status: data.status || "Open", source: "entered" };
    tasks.unshift(t); saveTasks(tasks);
    logActivity("Task added: " + t.title + " → " + t.owner + ".");
    renderAll();
    return t;
  }

  /* ---------- rendering ---------- */

  function renderKPIs() {
    var s = getSummary();
    function set(id, text) { var n = $(id); if (n) n.textContent = text; }
    set("kpi-pipeline", s.activeCount + " active · " + money(s.activeValue) + "/mo");
    set("kpi-revenue", money(s.wonRevenue) + " / " + money(s.target));
    set("kpi-winrate", s.winRate + "%  (" + s.wonCount + " won · " + s.lostCount + " lost)");
    set("kpi-tasks", String(s.openTasks) + " open");
    set("kpi-equity", money(Math.round(s.paperEquity)) + " paper");
    var dl = $("kpi-deadlines");
    if (dl) {
      dl.innerHTML = "";
      if (!s.deadlines.length) { dl.appendChild(el("li", "No deadlines in the next 21 days.", "empty")); return; }
      s.deadlines.forEach(function (c) {
        var li = el("li");
        li.appendChild(el("span", c.client + " — " + c.stage));
        li.appendChild(el("span", fmtDateShort(c.due) + " · " + money(c.value) + "/mo", "meta"));
        dl.appendChild(li);
      });
    }
  }

  function renderContracts() {
    var list = $("contract-list"); if (!list) return;
    var q = ($("contract-search") ? $("contract-search").value : "").toLowerCase();
    var f = $("contract-filter") ? $("contract-filter").value : "all";
    list.innerHTML = "";
    var rows = getContracts().filter(function (c) {
      if (f !== "all" && c.stage !== f) return false;
      if (q && c.client.toLowerCase().indexOf(q) === -1 && c.division.toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    if (!rows.length) { list.appendChild(el("li", "No contracts match. Add one below.", "empty")); return; }
    rows.forEach(function (c) {
      var li = el("li");
      var wrap = el("div");
      wrap.appendChild(el("span", c.client + " — " + c.division));
      wrap.appendChild(el("small", money(c.value) + "/mo · due " + fmtDateShort(c.due) + (c.source === "sample" ? " · sample" : ""), "muted"));
      li.appendChild(wrap);
      var sel = document.createElement("select");
      sel.setAttribute("aria-label", "Stage for " + c.client);
      STAGES.forEach(function (st) {
        var o = document.createElement("option"); o.value = st; o.textContent = st;
        if (st === c.stage) o.selected = true; sel.appendChild(o);
      });
      sel.addEventListener("change", function () { moveContract(c.client, sel.value); });
      li.appendChild(sel);
      list.appendChild(li);
    });
  }

  function renderTrading() {
    var s = getTradingSummary();
    function set(id, text) { var n = $(id); if (n) n.textContent = text; }
    set("trade-price", s.price.toFixed(4));
    set("trade-change", (s.price >= market.prevPrice ? "▲ " : "▼ ") + ((s.price - market.prevPrice) * 10000).toFixed(1) + " pips (simulated)");
    set("trade-status", s.running ? "Market running — simulation" : "Market paused — simulation");
    set("trade-balance", money(Math.round(s.balance)));
    set("trade-equity", money(Math.round(s.equity)));
    set("trade-winrate", s.winRate + "% (" + s.closedCount + " closed)");
    var list = $("positions-list");
    if (list) {
      list.innerHTML = "";
      var open = getTrades().filter(function (t) { return t.status === "open"; });
      if (!open.length) { list.appendChild(el("li", "No open paper positions.", "empty")); }
      open.forEach(function (t) {
        var li = el("li");
        li.appendChild(el("span", "#" + t.id + " " + t.side.toUpperCase() + " " + t.lots + " lots @ " + t.entry.toFixed(4)));
        li.appendChild(el("span", "P&L " + money(Math.round(tradePnl(t))), "meta"));
        var btn = el("button", "Close", null); btn.type = "button";
        btn.addEventListener("click", function () { closeTrade(t.id, "manual"); });
        li.appendChild(btn); list.appendChild(li);
      });
      getTrades().filter(function (t) { return t.status !== "open"; }).slice(-3).reverse().forEach(function (t) {
        var li2 = el("li");
        li2.appendChild(el("span", "#" + t.id + " " + t.side.toUpperCase() + " " + t.lots + " lots — closed (" + (t.closeReason || "") + ")"));
        li2.appendChild(el("span", "P&L " + money(Math.round(t.pnl)), "meta"));
        list.appendChild(li2);
      });
    }
  }

  function renderTasks() {
    var list = $("task-list"); if (!list) return;
    list.innerHTML = "";
    var tasks = getTasks();
    if (!tasks.length) { list.appendChild(el("li", "No tasks.", "empty")); return; }
    tasks.forEach(function (t) {
      var li = el("li");
      var wrap = el("div");
      wrap.appendChild(el("span", t.title));
      wrap.appendChild(el("small", t.owner + " · due " + fmtDateShort(t.due) + " · " + t.status, "muted"));
      li.appendChild(wrap);
      var btn = el("button", t.status === "Done" ? "Reopen" : "Done", null); btn.type = "button";
      btn.addEventListener("click", function () {
        var all = getTasks();
        all.forEach(function (x) { if (x.id === t.id) x.status = x.status === "Done" ? "Open" : "Done"; });
        saveTasks(all); logActivity("Task " + (t.status === "Done" ? "reopened" : "completed") + ": " + t.title + ".");
        renderAll();
      });
      li.appendChild(btn); list.appendChild(li);
    });
  }

  function renderActivity() {
    var list = $("ops-activity-list"); if (!list) return;
    list.innerHTML = "";
    var log = getActivity();
    if (!log.length) { list.appendChild(el("li", "No activity yet — add a contract, open a paper trade, or run a bot task.", "empty")); return; }
    log.slice(0, 10).forEach(function (e) {
      var li = el("li");
      li.appendChild(el("span", e.text));
      li.appendChild(el("span", new Date(e.at).toLocaleString(), "meta"));
      list.appendChild(li);
    });
  }

  function renderAll() { renderKPIs(); renderContracts(); renderTrading(); renderTasks(); renderActivity(); }

  function boot() {
    var cf = $("contract-form");
    if (cf) cf.addEventListener("submit", function (e) {
      e.preventDefault();
      addContract({
        client: $("contract-client").value.trim(),
        division: $("contract-division").value,
        value: Number($("contract-value").value || 0),
        stage: $("contract-stage").value,
        due: $("contract-due").value
      });
      cf.reset();
      if (window.Jarvis) window.Jarvis.addLog("jarvis", "Contract added.", "jarvis");
    });
    var cs = $("contract-search"); if (cs) cs.addEventListener("input", renderContracts);
    var cf2 = $("contract-filter"); if (cf2) cf2.addEventListener("change", renderContracts);

    var ms = $("btn-market-start"); if (ms) ms.addEventListener("click", startMarket);
    var mp = $("btn-market-pause"); if (mp) mp.addEventListener("click", pauseMarket);
    var spd = $("trade-speed"); if (spd) spd.addEventListener("change", function () { market.speed = Number(spd.value || 1); saveMarket(); });
    var bb = $("btn-buy"); if (bb) bb.addEventListener("click", function () {
      openTrade("buy", Number($("trade-lots").value || 0.1), Number($("trade-stop").value || 0), Number($("trade-target").value || 0));
    });
    var bs = $("btn-sell"); if (bs) bs.addEventListener("click", function () {
      openTrade("sell", Number($("trade-lots").value || 0.1), Number($("trade-stop").value || 0), Number($("trade-target").value || 0));
    });
    var calc = $("btn-calc"); if (calc) calc.addEventListener("click", function () {
      var r = positionSize(Number($("calc-risk").value || 1), Number($("calc-stop").value || 20));
      var out = $("calc-result");
      if (out && r) out.textContent = "Risk " + money(r.riskDollars) + " → " + r.lots + " lots (simulation).";
    });

    var tf = $("task-form");
    if (tf) tf.addEventListener("submit", function (e) {
      e.preventDefault();
      addTask({ title: $("task-title").value.trim(), owner: $("task-owner").value.trim() || "Goldwing", due: $("task-due").value });
      tf.reset();
    });

    if (market.running) { market.running = false; saveMarket(); } // never auto-resume a feed on reload
    renderAll();
  }

  window.VanguardOps = {
    getSummary: getSummary, summaryText: summaryText,
    getContracts: getContracts, addContract: addContract, findContract: findContract, moveContract: moveContract,
    getTradingSummary: getTradingSummary, startMarket: startMarket, pauseMarket: pauseMarket,
    openTrade: openTrade, closeTrade: closeTrade, closeAllTrades: closeAllTrades, positionSize: positionSize,
    getTasks: getTasks, addTask: addTask,
    logActivity: logActivity, renderAll: renderAll, STAGES: STAGES
  };

  document.addEventListener("DOMContentLoaded", boot);
})();
