/**
 * The public-release guard.
 *
 * Pintakasi is source-available for portfolio evaluation, not an open-source
 * project. This is deliberately a narrow, dependency-free check for mistakes
 * that are easy to make when moving a local project into public view:
 *
 * - credentials or private keys committed by accident;
 * - private-machine and sibling-repository references that dead-end readers;
 * - local database and environment files that should never be tracked.
 *
 * It scans the current tracked tree. Before changing repository visibility,
 * also use GitHub's secret scanning on the full history.
 */
import { existsSync } from "node:fs";

function trackedFiles(): string[] {
  const result = Bun.spawnSync(["git", "ls-files", "-z"]);
  if (result.exitCode !== 0) throw new Error("git ls-files failed");
  return Buffer.from(result.stdout)
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
}

const forbiddenPaths = [
  /(^|\/)\.env(?:\.|$)/i,
  /\.(?:pem|key|p12|pfx)$/i,
  /(^|\/)(?:credentials?|secrets?)(?:\.|\/|$)/i,
  /(^|\/)data\/.*\.db(?:-|$)/i,
];

const forbiddenContent = [
  {
    label: "private key",
    pattern: /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/,
  },
  {
    label: "AWS access key",
    pattern: /\bAKIA[0-9A-Z]{16}\b/,
  },
  {
    label: "GitHub token",
    pattern: /\b(?:ghp|github_pat)_[A-Za-z0-9_-]{16,}\b/,
  },
  {
    label: "provider secret",
    pattern: /\b(?:sk|rk)_[A-Za-z0-9_-]{16,}\b/,
  },
];

const forbiddenPublicReferences = [
  {
    label: "private local path",
    pattern: /\/Users\/|\/home\/[^/\s]+\/workspace|zane-knowledge-system/,
  },
];

const failures: string[] = [];
for (const file of trackedFiles()) {
  if (forbiddenPaths.some((pattern) => pattern.test(file))) {
    failures.push(`${file}: forbidden tracked path`);
    continue;
  }
  if (!existsSync(file)) continue;
  const bytes = await Bun.file(file).arrayBuffer();
  const text = Buffer.from(bytes).toString("utf8");
  // Skip binary content. The release guard is for readable source and docs.
  if (text.includes("\0")) continue;
  for (const { label, pattern } of forbiddenContent) {
    if (pattern.test(text)) failures.push(`${file}: ${label}`);
  }
  // Archived run logs are evidence, not onboarding material. Preserve their
  // historical local paths while keeping every source and public document
  // free of references a new reader cannot follow.
  if (!file.startsWith("runs/") && file !== "scripts/public-check.ts") {
    for (const { label, pattern } of forbiddenPublicReferences) {
      if (pattern.test(text)) failures.push(`${file}: ${label}`);
    }
  }
}

if (failures.length) {
  console.error("Public-release check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Public-release check passed.");
