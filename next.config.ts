import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  // A separate build dir lets the sim viewer (`bun dev:sim`, port 3435)
  // run beside the live server (`bun dev`, port 3434) — Next allows one
  // dev server per dist dir.
  distDir: process.env.PINTAKASI_DIST ?? ".next",
};

export default nextConfig;
