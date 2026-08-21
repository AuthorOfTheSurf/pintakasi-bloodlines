/**
 * Public deployments are an inspection surface by default. Advancing a
 * world is an operator action, so production must opt in explicitly rather
 * than inheriting the fixed local dev key from the seeded world.
 *
 * Local development remains frictionless: `bun dev` and `bun dev:sim` keep
 * the Stewards' Office clock controls available without an environment file.
 */
export function publicTicksEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.PINTAKASI_ALLOW_PUBLIC_TICKS === "1";
}
