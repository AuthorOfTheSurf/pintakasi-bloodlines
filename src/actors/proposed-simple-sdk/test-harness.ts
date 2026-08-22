/**
 * One engine + one registry for every effect suite in this process. Two
 * `Registry.test` instances against the same local engine clobber each
 * other's registrations, so all effect actors register here and suites
 * share the runtime via refcount.
 */
import { BarnLedgerLive } from "../current-effect-sdk/live.ts";
import { ChatRoom, Moderator } from "./chat.ts";
import { Referee } from "./monitor-demo.ts";
import { testEngine } from "./layer.ts";

export const engine = testEngine(ChatRoom, Moderator, Referee, BarnLedgerLive);

// bun loads test files one at a time, so a per-suite refcount would hit
// zero between files. Dispose exactly once, when the whole process ends.
let disposed = false;
const disposeOnce = async () => {
  if (!disposed) {
    disposed = true;
    await engine.dispose();
  }
};
process.on("beforeExit", disposeOnce);
export const retain = () => {};
export const release = () => {};
