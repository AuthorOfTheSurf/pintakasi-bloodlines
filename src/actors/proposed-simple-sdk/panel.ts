/**
 * The tiny web panel: a live view over the monitor channels. One page,
 * no dependencies, served straight from the process running the actors.
 *
 *  - Actors table (activity channel): last action, outcome, latency —
 *    with a per-row watchdog that flags an actor QUIET when it has emitted
 *    nothing for the threshold. Silent failures become visible here.
 *  - Issues table (pass an issueTracker): defects grouped by fingerprint
 *    with counts, Sentry-style. Resolve marks one handled; if it comes
 *    back the row goes loud as a REGRESSION.
 *  - Failure feed (unexpected-error channel): the agent-patchable report
 *    blocks, newest first, streamed live over server-sent events (SSE).
 */
import type { Issue, IssueTracker } from "./issues.ts";
import { onActivity, onUnexpected, type ActivityEvent, type UnexpectedReport } from "./layer.ts";

const MAX_REPORTS = 100;

export function startPanel({ port = 4949, quietAfterMs = 30_000, tracker }: { port?: number; quietAfterMs?: number; tracker?: IssueTracker } = {}) {
  const reports: UnexpectedReport[] = [];
  const lastActivity = new Map<string, ActivityEvent>();
  const clients = new Set<(line: string) => void>();

  const push = (event: "activity" | "report" | "issue", data: unknown) => {
    const line = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const send of clients) send(line);
  };

  const stopActivity = onActivity((ev) => {
    lastActivity.set(ev.actor, ev);
    push("activity", ev);
  });
  const stopReports = onUnexpected((r) => {
    reports.unshift(r);
    if (reports.length > MAX_REPORTS) reports.pop();
    push("report", r);
  });
  const stopIssues = tracker?.on((ev) => push("issue", { ...ev.issue, lastKind: ev.kind }));

  const issueRow = (i: Issue) => ({ ...i, lastKind: undefined });

  const server = Bun.serve({
    port,
    fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/events") {
        let send: (line: string) => void;
        const stream = new ReadableStream({
          start(controller) {
            send = (line) => {
              try { controller.enqueue(new TextEncoder().encode(line)); } catch { clients.delete(send); }
            };
            clients.add(send);
            // Backlog on connect: liveness snapshot, issues, then reports oldest-first.
            for (const ev of lastActivity.values()) send(`event: activity\ndata: ${JSON.stringify(ev)}\n\n`);
            if (tracker) for (const i of tracker.issues.values()) send(`event: issue\ndata: ${JSON.stringify(issueRow(i))}\n\n`);
            for (const r of [...reports].reverse()) send(`event: report\ndata: ${JSON.stringify(r)}\n\n`);
          },
          cancel() { clients.delete(send); },
        });
        return new Response(stream, {
          headers: { "content-type": "text/event-stream", "cache-control": "no-cache" },
        });
      }
      if (url.pathname === "/resolve" && req.method === "POST" && tracker) {
        const fingerprint = url.searchParams.get("fp") ?? "";
        const issue = tracker.resolve(fingerprint);
        if (issue) push("issue", issueRow(issue));
        return new Response(issue ? "resolved" : "not found", { status: issue ? 200 : 404 });
      }
      return new Response(
        PAGE.replace("__QUIET_MS__", String(quietAfterMs)).replace("__HAS_ISSUES__", String(Boolean(tracker))),
        { headers: { "content-type": "text/html; charset=utf-8" } },
      );
    },
  });

  return {
    url: `http://localhost:${server.port}`,
    stop: () => { stopActivity(); stopReports(); stopIssues?.(); server.stop(true); },
  };
}

const PAGE = `<!doctype html>
<meta charset="utf-8">
<title>Actor Monitor</title>
<style>
  :root { color-scheme: dark; }
  body { background: #14161a; color: #d6dae0; font: 14px/1.5 ui-monospace, monospace; margin: 2rem; }
  h1 { font-size: 1.1rem; letter-spacing: .06em; text-transform: uppercase; color: #8b93a1; }
  table { border-collapse: collapse; margin-bottom: 2rem; min-width: 40rem; }
  th, td { text-align: left; padding: .35rem .9rem .35rem 0; border-bottom: 1px solid #262a31; }
  th { color: #8b93a1; font-weight: normal; }
  .ok { color: #7dc87d; }
  .declared-error { color: #e0b45c; }
  .unexpected-error { color: #e26d6d; font-weight: bold; }
  .quiet { color: #e26d6d; }
  .resolved { color: #7dc87d; }
  .open { color: #e26d6d; }
  .regression { color: #ff7b3d; font-weight: bold; }
  .report { background: #1b1e24; border-left: 3px solid #e26d6d; padding: .8rem 1rem; margin: .6rem 0; white-space: pre-wrap; overflow-x: auto; }
  button { background: #262a31; color: #d6dae0; border: 1px solid #3a404a; border-radius: 4px; padding: .15rem .6rem; cursor: pointer; font: inherit; }
  button:hover { background: #3a404a; }
  #empty { color: #4c525c; }
</style>
<h1>Actors</h1>
<table><thead><tr><th>actor</th><th>last action</th><th>outcome</th><th>latency</th><th>last seen</th></tr></thead>
<tbody id="actors"></tbody></table>
<div id="issues-section" style="display:none">
<h1>Issues</h1>
<table><thead><tr><th>issue</th><th>status</th><th>count</th><th>first seen</th><th>last seen</th><th></th></tr></thead>
<tbody id="issues"></tbody></table>
</div>
<h1>Unexpected errors</h1>
<div id="empty">none yet — that's either good news or a monitoring gap</div>
<div id="reports"></div>
<script>
  const QUIET_MS = __QUIET_MS__;
  if (__HAS_ISSUES__) document.getElementById("issues-section").style.display = "";
  const actors = new Map();
  const issues = new Map();
  const tbody = document.getElementById("actors");
  const issuesBody = document.getElementById("issues");
  const reportsEl = document.getElementById("reports");
  const when = (t) => new Date(t).toLocaleTimeString();

  function render() {
    tbody.innerHTML = "";
    for (const [name, ev] of [...actors].sort((a, b) => a[0] < b[0] ? -1 : 1)) {
      const age = Date.now() - ev.at;
      const quiet = age > QUIET_MS;
      const row = document.createElement("tr");
      row.innerHTML =
        "<td>" + name + (quiet ? " <span class=quiet>● QUIET</span>" : " <span class=ok>●</span>") + "</td>" +
        "<td>" + ev.action + "</td>" +
        "<td class=" + ev.outcome + ">" + ev.outcome + "</td>" +
        "<td>" + ev.ms + "ms</td>" +
        "<td>" + Math.round(age / 1000) + "s ago</td>";
      tbody.appendChild(row);
    }
    issuesBody.innerHTML = "";
    for (const [fp, i] of [...issues].sort((a, b) => b[1].lastSeen - a[1].lastSeen)) {
      const row = document.createElement("tr");
      const status = i.lastKind === "regression" ? "<span class=regression>REGRESSION</span>" : "<span class=" + i.status + ">" + i.status + "</span>";
      row.innerHTML =
        "<td>" + i.title + "</td>" +
        "<td>" + status + "</td>" +
        "<td>" + i.count + "×</td>" +
        "<td>" + when(i.firstSeen) + "</td>" +
        "<td>" + when(i.lastSeen) + "</td>" +
        "<td>" + (i.status === "open" ? "<button data-fp='" + encodeURIComponent(fp) + "'>Resolve</button>" : "") + "</td>";
      issuesBody.appendChild(row);
    }
  }

  issuesBody.parentElement.addEventListener("click", (e) => {
    const fp = e.target?.dataset?.fp;
    if (fp) fetch("/resolve?fp=" + fp, { method: "POST" });
  });

  const es = new EventSource("/events");
  es.addEventListener("activity", (e) => { const ev = JSON.parse(e.data); actors.set(ev.actor, ev); render(); });
  es.addEventListener("issue", (e) => { const i = JSON.parse(e.data); issues.set(i.fingerprint, i); render(); });
  es.addEventListener("report", (e) => {
    const r = JSON.parse(e.data);
    document.getElementById("empty").style.display = "none";
    const div = document.createElement("div");
    div.className = "report";
    div.textContent =
      "UNEXPECTED ERROR " + r.reportId + "\\n" +
      "actor:   " + r.actor + " · action: " + r.action + " · at: " + new Date(r.at).toISOString() + "\\n" +
      "error:   " + r.error.name + ": " + r.error.message + "\\n" +
      "payload: " + JSON.stringify(r.payload) + "\\n" +
      "state:   " + JSON.stringify(r.state) + "\\n" +
      (r.error.stack || "(no stack)");
    reportsEl.prepend(div);
  });
  setInterval(render, 1000); // keep ages + quiet flags ticking
</script>`;
