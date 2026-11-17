/* Plain scripts (rather than ES modules) also run from file://. */
"use strict";
(() => {
  const $ = id => document.getElementById(id);
  const api = window.HSG_API_BASE.replace(/\/$/, "");
  const mode = n => ["Stroke", "Match Play", "Mini golf"][n] || `Mode ${n}`;
  const courses = ["Mt. Sakura C.C.", "Aloha Beach Resort", "Western Valley C.C.", "Bagpipe Classic", "United Forest G.C.", "Northern Fox C.C.", "Day Dream G.C.", "Wild Green C.C.", "Silk Road Classic", "Blue Lagoon C.C.", "Fujizakura C.C.", "Kawana Hotel G.C.", "Samurai Golf Club"];
  const course = n => courses[n] || `Course ${n + 1}`;
  const date = ms => ms == null ? "Pending" : new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  const delta = n => n == null ? "Pending / unrated" : `${n > 0 ? "+" : ""}${(Math.abs(n) < .05 ? 0 : n).toFixed(1)}`;
  function el(tag, text, cls) { const e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; }
  function link(text, hash, cls) { const a = el("a", text, cls); a.href = hash; return a; }
  const person = name => name ? link(name, `#player/${encodeURIComponent(name)}`, "name") : el("span", "Unavailable player");
  const badge = (text, cls = "") => el("span", text, `badge ${cls}`);
  let turn = 0, routeKey = "", page = 0, pages = [null], next = null, controller;
  async function get(path, signal) {
    const response = await fetch(api + path, { signal, credentials: "omit", referrerPolicy: "no-referrer" });
    if (!response.ok) throw Error(response.status === 404 ? "This match was not found or is not public." : "The clubhouse API is unreachable.");
    return response.json();
  }
  function table(headings, rows, cls = "") {
    const wrap = el("div", null, "table-wrap"), t = el("table", null, cls), head = el("thead"), hr = el("tr");
    headings.forEach(x => { const th = el("th", x); th.scope = "col"; hr.append(th); }); head.append(hr); t.append(head);
    const body = el("tbody"); rows.forEach(cells => { const tr = el("tr"); cells.forEach(x => { const td = el("td"); td.append(x instanceof Node ? x : document.createTextNode(String(x))); tr.append(td); }); body.append(tr); });
    t.append(body); wrap.append(t); return wrap;
  }
  function results(m) {
    return table(["Player", "Pos.", "Score", m.ranked ? "Elo Δ" : "Result"], m.players.map(p => [person(p.login), p.position ?? "—", p.total ?? "—", m.ranked ? delta(p.delta) : p.outcome]));
  }
  function match(m, full = false) {
    const article = el("article", null, "match"), header = el("div", null, "match-head"), title = el("div");
    title.append(link(`${mode(m.mode)} · ${course(m.course)}`, `#match/${m.match_id}`));
    title.append(el("p", `${date(m.ended_at)} · Holes ${m.first_hole}–${m.end_hole ?? m.last_hole}`));
    header.append(title, badge(m.ranked ? "Ranked" : "Casual", m.ranked ? "ranked" : "")); article.append(header, results(m));
    const notes = [m.status];
    if (m.ranked && m.rated_at == null) notes.push("rating pending / unrated");
    if (m.players.some(p => p.vote_rejected)) notes.push("vote rejected");
    if (m.mode === 1 && m.final_lead != null) {
      const winner = m.players.find(p => p.position === 1);
      notes.push(m.final_lead === 0 ? "All square" : `${winner?.login ?? "Winner"} wins · ${Math.abs(m.final_lead)} up at hole ${m.end_hole ?? m.last_hole}`);
      notes.push("Match Play positions use the match lead; stroke totals are informational.");
    }
    if (m.status !== "completed") notes.push("Partial scores; — means no final score or position.");
    if (full) notes.push(`Tee ${m.tee === 0 ? "regular" : "back"} · Season ${["spring", "summer", "autumn", "winter"][m.season] ?? m.season}`);
    article.append(el("p", notes.join(" · "), "match-note"));
    if (full) {
      const count = Math.max(0, ...m.players.map(p => p.strokes.length));
      const headings = ["Player", ...Array.from({ length: count }, (_, i) => `H${m.first_hole + i}`), "Total"];
      article.append(table(headings, m.players.map(p => [person(p.login), ...Array.from({ length: count }, (_, i) => p.strokes[i] ?? "—"), p.total ?? "—"]), "scorecard"));
      article.append(el("p", "Scroll the scorecard sideways to see every hole. Scores are strokes, not scores relative to par.", "match-note"));
    }
    return article;
  }
  function route() {
    const raw = location.hash.slice(1) || "leaderboard", [path, query] = raw.split("?");
    if (path.startsWith("player/")) return { view: "history", username: decodeURIComponent(path.slice(7)), profile: true };
    if (path.startsWith("match/")) return { view: "match", id: path.slice(6) };
    return { view: ["leaderboard", "history", "rules"].includes(path) ? path : "leaderboard", username: new URLSearchParams(query).get("username") || "" };
  }
  async function load(reset = false) {
    const id = ++turn; controller?.abort(); controller = new AbortController();
    // A timeout gives file:// and low-bandwidth visitors a useful offline state.
    const timer = setTimeout(() => controller.abort(), 12000);
    let r;
    try { r = route(); } catch { r = { view: "history", username: "invalid" }; }
    const key = JSON.stringify(r); if (reset || key !== routeKey) { page = 0; pages = [null]; next = null; } routeKey = key;
    const names = { leaderboard: "Leaderboard", history: r.username ? `${r.username} · History` : "Match history", match: "Match scorecard", rules: "How it works" };
    $("heading").textContent = names[r.view];
    $("description").textContent = r.view === "leaderboard" ? "The all-time ladder. First ten rated rounds are provisional." : r.view === "history" ? "Ranked rounds and completed casual games, newest first." : r.view === "match" ? "The round, hole by hole." : "A friendly ladder, with a few simple rules.";
    $("username").value = r.username || "";
    document.querySelectorAll("nav a").forEach(a => { if (a.hash === `#${r.view}` || r.view === "match" && a.hash === "#history") a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    $("status").className = ""; $("status").textContent = "Loading…"; $("content").setAttribute("aria-busy", "true");
    $("next").disabled = true; $("previous").disabled = true;
    try {
      let path;
      if (r.view === "leaderboard") path = `/api/leaderboard?limit=50&offset=${pages[page] ?? 0}`;
      else if (r.view === "history") {
        const params = new URLSearchParams({ limit: "20" }); if (pages[page]) params.set("cursor", pages[page]);
        if (r.username && !r.profile) params.set("username", r.username);
        path = `${r.profile ? `/api/players/${encodeURIComponent(r.username)}/matches` : "/api/matches"}?${params}`;
      } else path = r.view === "match" ? `/api/matches/${encodeURIComponent(r.id)}` : "/api/rules";
      const [data, profile] = await Promise.all([get(path, controller.signal), r.profile ? get(`/api/players/${encodeURIComponent(r.username)}`, controller.signal) : null]);
      if (id !== turn) return;
      const fragment = document.createDocumentFragment(); next = null;
      if (r.view === "leaderboard") {
        if (data.players.length) fragment.append(table(["Rank", "GitHub player", "Elo", "Rounds"], data.players.map(p => {
          const name = el("span"); name.append(person(p.login)); if (p.provisional) name.append(badge("Provisional", "provisional"));
          return [p.rank, name, p.elo, p.rounds];
        }), "leaderboard")); else fragment.append(el("p", "No ranked players yet.", "empty"));
        next = data.next_offset;
      } else if (r.view === "history") {
        if (profile?.player) { const p = profile.player, box = el("div", null, "profile"); box.append(el("h2", p.login), el("p", p.elo == null ? "No ranked rounds yet" : `${p.elo} Elo · ${p.rounds} rated rounds${p.provisional ? " · Provisional" : ""}`)); fragment.append(box); }
        if (r.username) fragment.append(link("← All match history", "#history"), el("p"));
        if (!data.matches.length) fragment.append(el("p", "No public matches found.", "empty"));
        data.matches.forEach(m => fragment.append(match(m))); next = data.next_cursor;
      } else if (r.view === "match") { fragment.append(link("← Match history", "#history"), el("p"), match(data.match, true)); }
      else {
        const box = el("div", null, "rules"); box.append(el("h2", "One all-time ladder"));
        [`Start at ${data.initial_elo} Elo. The first ${data.provisional_rounds} rated rounds are provisional; K is ${data.k} throughout.`,
          `${data.ranked_holes}-hole ranked rounds: ${data.modes.join("; ")}. Elo uses pairwise results from each player's pre-round rating.`,
          data.quit_rule, "Interrupted, disputed and abandoned rounds are unrated. Pending results can update later.",
          "History includes ranked rounds and completed casual rounds. A player's public name is their GitHub login; older games follow their current login.",
          "Rankings use unrounded ratings, with a stable order for ties. Displayed Elo is rounded; history changes show one decimal. Rounds count rated completed and quit rounds.",
          "Pages update on request and may be cached for 60 seconds. The leaderboard shows up to the first 1,050 players; history has no depth cap.",
          `Formula: ${data.formula}. This community ladder cannot prove the absence of modified clients or collusion.`].forEach(t => box.append(el("p", t))); fragment.append(box);
      }
      $("content").replaceChildren(fragment);
      $("updated").textContent = `Updated ${date(Date.parse(data.updated_at))}`;
      $("status").textContent = "";
      $("page").textContent = ["leaderboard", "history"].includes(r.view) ? `Page ${page + 1}` : "";
      $("pagination").hidden = !["leaderboard", "history"].includes(r.view);
      $("previous").disabled = page === 0; $("next").disabled = next == null;
    } catch (e) {
      if (id !== turn) return;
      $("status").className = "error";
      $("status").textContent = `${e.name === "AbortError" ? "The clubhouse API timed out." : e.message || "The clubhouse API is unreachable."} ${$("content").childNodes.length ? "Previously loaded results remain below and may be stale or from another view." : "Results are unavailable."} Please try Refresh.`;
    } finally { clearTimeout(timer); if (id === turn) $("content").setAttribute("aria-busy", "false"); }
  }
  $("search").addEventListener("submit", e => { e.preventDefault(); const name = $("username").value.trim(); location.hash = name ? `history?username=${encodeURIComponent(name)}` : "history"; });
  $("refresh").onclick = () => load();
  $("next").onclick = () => { if (next == null) return; pages[++page] = next; load(); window.scrollTo(0, 0); };
  $("previous").onclick = () => { if (page > 0) { page--; load(); window.scrollTo(0, 0); } };
  window.addEventListener("hashchange", () => load(true)); load(true);
})();
