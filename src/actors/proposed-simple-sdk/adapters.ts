/**
 * Monitor adapters: composable sinks for unexpected-error reports. This is
 * the "last mile" — the channel pushes reports at failure time; an adapter
 * is what carries them out of the process to where a human actually looks.
 * All names are placeholders.
 *
 *   const stop = watch(stdout(), discord({ webhookUrl }));
 */
import { onUnexpected, type UnexpectedReport } from "./layer.ts";

export type MonitorAdapter = (r: UnexpectedReport) => void | Promise<void>;

/** The agent-patchable report block. */
export function format(r: UnexpectedReport): string {
  return [
    `UNEXPECTED ERROR ${r.reportId}`,
    `actor:   ${r.actor} · action: ${r.action} · at: ${new Date(r.at).toISOString()}`,
    `error:   ${r.error.name}: ${r.error.message}`,
    `payload: ${JSON.stringify(r.payload)}`,
    `state:   ${JSON.stringify(r.state)}`,
    r.error.stack ?? "(no stack)",
  ].join("\n");
}

/**
 * Attach adapters to the unexpected-error channel; returns a detach fn.
 * Adapter failures are swallowed (a broken sink must never mask a report
 * from the other sinks) but noted on stderr.
 */
export function watch(...adapters: MonitorAdapter[]): () => void {
  return onUnexpected((r) => dispatch(adapters, r));
}

/** Fan one report out to every adapter; failures logged, never propagated. */
export function dispatch(adapters: MonitorAdapter[], r: UnexpectedReport): void {
  for (const adapter of adapters) {
    Promise.resolve()
      .then(() => adapter(r))
      .catch((e) => console.error(`[monitor] adapter failed: ${e}`));
  }
}

/** The default, and the discouraged one: the report block on stderr. */
export const stdout = (): MonitorAdapter => (r) => {
  console.error(format(r));
};

const clip = (s: string, max: number) =>
  s.length <= max ? s : `${s.slice(0, max - 1)}…`;

const codeBlock = (s: string, max: number) =>
  `\`\`\`\n${clip(s, max - 8)}\n\`\`\``;

/**
 * Post each report to a Discord channel webhook.
 * Create one under Server Settings → Integrations → Webhooks.
 */
export const discord = ({ webhookUrl }: { webhookUrl: string }): MonitorAdapter =>
  async (r) => {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content: `🚨 **UnexpectedError** in \`${r.actor}.${r.action}\` — ${r.error.name}: ${clip(r.error.message, 300)}`,
        embeds: [
          {
            title: `Report ${r.reportId}`,
            color: 0xe74c3c,
            timestamp: new Date(r.at).toISOString(),
            fields: [
              { name: "payload", value: codeBlock(JSON.stringify(r.payload), 1024) },
              { name: "state", value: codeBlock(JSON.stringify(r.state), 1024) },
              { name: "stack", value: codeBlock(r.error.stack ?? "(no stack)", 1024) },
            ],
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`discord webhook: HTTP ${res.status}`);
  };
