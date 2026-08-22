# Part 2: The Forgotten Draw

*Nobody can enumerate everything that can go wrong up front. The system should assume you missed one.*

---

Here's a referee for rock-paper-scissors. It has a bug you might not spot in review:

```typescript
const winnerOf = (a: Choice, b: Choice) =>
  BEATS[a] === b ? "a" : BEATS[b] === a ? "b" : "draw";

const PLAYER: Record<string, "Alice" | "Bob"> = { a: "Alice", b: "Bob" };

const Referee = actor("Referee", {
  state: { scores: { Alice: { wins: 0 }, Bob: { wins: 0 } } },
  handle: {
    Play: async ({ alice, bob }: { alice: Choice; bob: Choice }, { state }) => {
      const player = PLAYER[winnerOf(alice, bob)]!;
      state.scores[player].wins += 1;
      return { winner: player, scores: state.scores };
    },
  },
});
```

The developer handled both winners. They forgot that two rocks is a legal round. `PLAYER["draw"]` is `undefined`, and the next line crashes — on a payload the type system was perfectly happy with.

In most systems this is where the story goes dark: the client gets an opaque `internal_error`, the stack trace goes to a server log nobody is tailing, and you find out from a user. Here's what happens instead:

**1. The caller gets a typed error, not a mystery.**

```typescript
try {
  await referee.Play({ alice: "rock", bob: "rock" });
} catch (e) {
  if (isUnexpected(e)) {
    // e.actor === "Referee", e.action === "Play", e.reportId === "250ac73a-…"
  }
}
```

**2. A report goes out — pushed, not pulled.** Every unexpected failure produces a report with the actor, the action, the exact payload, the committed state at that moment, and the stack:

```
UNEXPECTED ERROR 250ac73a-cb80-4ca1-96f2-ab78c07cb2e5
actor:   Referee · action: Play · at: 2026-08-22T10:46:30.013Z
error:   TypeError: undefined is not an object (evaluating 'state.scores[player].wins')
payload: {"alice":"rock","bob":"rock"}
state:   {"scores":{"Alice":{"wins":1},"Bob":{"wins":0}}}
    at Play (monitor-demo.ts:32:24)
    …
```

This is deliberately everything a coding agent needs to produce the patch: the input that broke it, the state it broke against, and the line. Paste it into your agent and the fix — handle the draw — writes itself.

**3. The actor survives, untouched.** The state draft from the failed handler is discarded; the scores are exactly what they were; the next legal round plays fine. One bad message doesn't poison the entity.

## Where the report goes

Reports are pushed to whatever sinks you configure — this is the part that turns "logged somewhere" into "a human finds out":

```typescript
// placeholder API — the adapter design
serve({
  actors: [Referee],
  monitor: [sentry({ dsn }), slack({ webhook, channel: "#oncall" })],
});
```

Adapters compose: Sentry for the paper trail, Slack for the ping, a local web panel during development, stdout as the discouraged default. Today's v0 ships the in-process subscription (`onUnexpected(fn)`) that all of these plug into; the adapters and the panel are the next build.

## Why this matters for "just get started"

The disclosure ladder (Part 1) says: start loose, harden later. That's only honest advice if the system catches what you haven't hardened yet — visibly, gracefully, patchably. The unexpected-error channel is the confidence story behind level 0: declare the failures you know; the ones you don't know become reports instead of mysteries.
