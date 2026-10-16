/**
 * The live world's pre-deploy check: drives a running production server
 * (`next start`) through every door a stranger can reach, and asserts each.
 *
 *   bun run alpha-e2e <base-url> <steward-key> [--world=alpha-1]
 *
 * ⚠ IT WRITES. It files two applications, approves one (a real farm), and
 * nudges the live clock. Point it at a staging copy of the world, never at
 * the live database. The server must run with NODE_ENV=production (what
 * `next start` sets), PINTAKASI_STEWARD_KEY, PINTAKASI_LIVE_START and
 * PINTAKASI_PUBLIC_ORIGIN, and must NOT set PINTAKASI_OPEN_REGISTRATION or
 * PINTAKASI_ALLOW_PUBLIC_TICKS. Exits non-zero if any check fails.
 */

export {}; // a module, so the checks below can await at the top level

const [base, stewardKey] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const world = process.argv.find((a) => a.startsWith("--world="))?.slice("--world=".length);
if (!base || !stewardKey) {
  console.error("usage: bun run alpha-e2e <base-url> <steward-key> [--world=alpha-1]");
  process.exit(2);
}

let failures = 0;
function check(label: string, ok: boolean, detail = ""): void {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` (${detail})` : ""}`);
}

const JSON_HEADERS = { "content-type": "application/json" };
const MCP_HEADERS = { ...JSON_HEADERS, accept: "application/json, text/event-stream" };
const url = (p: string) => `${base.replace(/\/+$/, "")}${p}`;
const post = (p: string, body?: unknown, headers: Record<string, string> = JSON_HEADERS) =>
  fetch(url(p), {
    method: "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const mcpCall = async (key: string, name: string, args: Record<string, unknown> = {}) =>
  (
    await post(
      `/api/mcp?key=${key}`,
      { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } },
      MCP_HEADERS
    )
  ).text();
// Next streams server components as escaped JSON inside the HTML.
const unescape = (html: string) => html.replace(/\\"/g, '"').replace(/<!-- -->/g, "");

// ── the server is up ────────────────────────────────────────────────────────
let up = false;
for (let i = 0; i < 30 && !up; i++) {
  up = await fetch(url("/join"))
    .then((r) => r.status === 200)
    .catch(() => false);
  if (!up) await new Promise((r) => setTimeout(r, 1000));
}
check("GET /join answers 200", up);
if (!up) process.exit(1);

// ── closed doors ────────────────────────────────────────────────────────────
const sneaky = { name: "Sneaky", primaryColor: "red", secondaryColor: "gold" };
check("open registration is closed", (await post("/api/farms/register", sneaky)).status === 403);
check(
  "MCP register_farm is closed",
  (await mcpCall("none", "register_farm", sneaky)).includes("Registration is closed")
);
for (const key of ["fk_dev", "fk_bot-10"]) {
  const res = await fetch(url(`/api/state?key=${key}`));
  check(`guessable key ${key} is rejected`, res.status === 400, `status ${res.status}`);
}
check("public /api/tick/day is refused", (await post("/api/tick/day")).status === 403);

// ── apply ───────────────────────────────────────────────────────────────────
const stamp = Date.now().toString(36);
const farmName = `E2E Gamefarm ${stamp}`;
const contact = `e2e-${stamp}@example.com`;
const applied = await post("/api/alpha/apply", {
  farmName,
  handler: "E2E",
  contact,
  country: "🇵🇭",
  primaryColor: "green",
  secondaryColor: "gold",
  website: "",
});
check("apply is accepted", applied.status === 200, `status ${applied.status}`);
const spamName = `Spam Farm ${stamp}`;
const spam = await post("/api/alpha/apply", {
  farmName: spamName,
  handler: "x",
  contact: "x",
  primaryColor: "red",
  secondaryColor: "gold",
  website: "http://spam.example",
});
check("honeypot apply gets the same 200", spam.status === 200);

// ── /admin ──────────────────────────────────────────────────────────────────
const publicAdmin = unescape(await (await fetch(url("/admin"))).text());
check("public /admin shows no applicant contact", !publicAdmin.includes(contact));
check("public /admin shows no hidden stats", !publicAdmin.includes('"agility"'));
check("public /admin asks for a steward key", publicAdmin.includes("steward key"));

const stewardAdminUrl = url(`/admin?steward=${encodeURIComponent(stewardKey)}`);
const stewardAdmin = unescape(await (await fetch(stewardAdminUrl)).text());
check("steward /admin shows the application", stewardAdmin.includes(contact));
check("honeypot left no application row", !stewardAdmin.includes(spamName));
check("steward /admin labels house stables", stewardAdmin.includes(">HOUSE<"));
if (world)
  check(
    `admin badge reads ${world.toUpperCase()}`,
    new RegExp(`world-badge[^>]*>${world.toUpperCase()}<`).test(stewardAdmin)
  );
const idMatch = new RegExp(`"id":(\\d+),"createdAt":[^}]*?"farmName":"${farmName}"`).exec(
  stewardAdmin
);
check("steward /admin lists the application id", idMatch !== null);
if (!idMatch) process.exit(1);
const appId = idMatch[1];

// ── approve ─────────────────────────────────────────────────────────────────
const approvePath = `/api/alpha/applications/${appId}/approve`;
check("approve without a key is 401", (await post(approvePath)).status === 401);
check(
  "approve with a wrong key is 401",
  (await post(approvePath, undefined, { "x-steward-key": "wrong" })).status === 401
);
const approved = await post(approvePath, undefined, {
  "x-steward-key": stewardKey,
  "x-forwarded-host": "evil.example",
});
const approval = (await approved.json()) as { claimUrl?: string };
check("approve with the steward key is 200", approved.status === 200);
const claimUrl = approval.claimUrl ?? "";
check("claim link carries a claim token", /\/join\/claim\/[\w-]{20,}$/.test(claimUrl));
check("claim link ignores a forged x-forwarded-host", !claimUrl.includes("evil.example"), claimUrl);
const again = await post(approvePath, undefined, { "x-steward-key": stewardKey });
check("approving twice is refused", again.status === 400);

// ── claim ───────────────────────────────────────────────────────────────────
// Fetched from the base URL: the link's origin is the public one, which a
// staging server need not answer on.
const claimPath = new URL(claimUrl).pathname;
const claimPage = await (await fetch(url(claimPath))).text();
const farmKey = /fk_[0-9a-f]{32}/.exec(claimPage)?.[0] ?? "";
check("claim page shows a random farm key", farmKey !== "");
check("claim page is noindex", claimPage.includes("noindex"));
check(
  "an unknown claim token is 404",
  (await fetch(url("/join/claim/not-a-token"))).status === 404
);

// ── playing ─────────────────────────────────────────────────────────────────
const state = await fetch(url(`/api/state?key=${farmKey}`));
const farmState = (await state.json()) as { farm?: { name?: string } };
check("the new key opens its own farm", farmState.farm?.name === farmName);
const farms = (await (await fetch(url("/api/farms"))).json()) as {
  name: string;
  houseStable: boolean;
}[];
check(
  "/api/farms labels house stables",
  farms.some((f) => f.houseStable) && farms.some((f) => f.name === farmName && !f.houseStable)
);
const listed = await mcpCall(farmKey, "list_farms");
check(
  "MCP list_farms labels house stables",
  /\\?"houseStable\\?":\s*true/.test(listed) && /\\?"houseStable\\?":\s*false/.test(listed)
);

// ── the live clock ──────────────────────────────────────────────────────────
check("/api/tick/live without a key is 401", (await post("/api/tick/live")).status === 401);
const nudge = await post("/api/tick/live", undefined, { "x-steward-key": stewardKey });
const nudged = (await nudge.json()) as { ran?: boolean; to?: number; target?: number };
check(
  "/api/tick/live with the steward key runs and lands on its target",
  nudge.status === 200 && nudged.ran === true && nudged.to === nudged.target,
  JSON.stringify(nudged)
);

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
