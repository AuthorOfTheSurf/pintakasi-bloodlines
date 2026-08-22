/**
 * The tiny web panel: a live view over both monitor channels. One page,
 * no dependencies, served straight from the process running the actors.
 *
 *  - Actors table (activity channel): last action, outcome, latency —
 *    and a per-row watchdog that flags an actor QUIET when it has emitted
 *    nothing for the threshold. Silent failures become visible here.
 *  - Failure feed (unexpected-error channel): the agent-patchable report
 *    blocks, newest first, streamed live over server-sent events (SSE).
 */
import { onActivity, onUnexpected, type ActivityEvent, type UnexpectedReport } from "./layer.ts";

const MAX_REPORTS = 100;

export function startPanel({ port = 4949, quietAfterMs = 30_000 } = {}) {
  const reports: UnexpectedReport[] = [];
  const lastActivity = new Map<string, ActivityEvent>();
  const clients = new Set<(line: string) => void>();

  const push = (event: "activity" | "report", data: unknown) => {
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
            // Backlog on connect: current liveness snapshot, then reports oldest-first.
            for (const ev of lastActivity.values()) send(`event: activity\ndata: ${JSON.stringify(ev)}\n\n`);
            for (const r of [...reports].reverse()) send(`event: report\ndata: ${JSON.stringify(r)}\n\n`);
          },
          cancel() { clients.delete(send); },
        });
        return new Response(stream, {
          headers: { "content-type": "text/event-stream", "cache-control": "no-cache" },
        });
      }
      return new Response(PAGE.replace("__QUIET_MS__", String(quietAfterMs)), {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    },
  });

  return {
    url: `http://localhost:${server.port}`,
    stop: () => { stopActivity(); stopReports(); server.stop(true); },
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
  .report { background: #1b1e24; border-left: 3px solid #e26d6d; padding: .8rem 1rem; margin: .6rem 0; white-space: pre-wrap; overflow-x: auto; }
  #empty { color: #4c525c; }
</style>
<h1>Actors</h1>
<table><thead><tr><th>actor</th><th>last action</th><th>outcome</th><th>latency</th><th>last seen</th></tr></thead>
<tbody id="actors"></tbody></table>
<h1>Unexpected errors</h1>
<div id="empty">none yet — that's either good news or a monitoring gap</div>
<div id="reports"></div>
<script>
  const QUIET_MS = __QUIET_MS__;
  const actors = new Map();
  const tbody = document.getElementById("actors");
  const reportsEl = document.getElementById("reports");

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
  }

  const es = new EventSource("/events");
  es.addEventListener("activity", (e) => { const ev = JSON.parse(e.data); actors.set(ev.actor, ev); render(); });
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
