# Attempt 1 — aborted at day 75, world contaminated by infrastructure

World: `data/sim-20260815-1625.db` (kept — the brain_log and ledger data are
still useful). Not comparable to exp1–4; do not put its scoreboard in the
arc table.

## What contaminated it

1. **Cold-tuning ten barns with no sim running** (the day-28 coach session)
   wedged five envoy registrations — the pinned lease-poisoning bug in
   textbook form.
2. Segment 2's first launch then hit `actor_ready_timeout` on the poisoned
   leases; daemon restart applied (the known cure)... and during the restart
   window the daemon's own actor store took a **disk I/O error**
   (`sqlite atomic commit failed`, `timed out flushing sqlite database`) —
   a NEW, WORSE failure mode: the poison went durable. Restarts stopped
   curing; every barn wake timed out on a fresh daemon.
3. Recovery required moving the daemon store aside entirely (preserved at
   `~/Library/Application Support/rivet-engine.corrupt-20260815` as
   evidence). Fresh store = barn actors recreated = **standing orders
   wiped**. Days 57–75 played with no orders at all.
4. Along the way, barns sat out whole days during wedge storms, and the
   days-31–56 segment log was overwritten by a relaunch reusing the
   filename (world db retains the ground truth).

By day 75: llm actives had collapsed to 17 vs scripted 211 (the age-9
force-retire cap emptied the un-restocked llm rosters), ratio 0.31 —
measuring the outages, not the instruments.

## What attempt 1 still proved

- **Crown economics: every llm crown week was profitable** (day-28 ledger:
  +3,024 / +8,120 / +892 / +469 GP net for the four barns that entered).
- **The juvenile instrument fires** (24 proposals in brain_log) but the
  binding constraint is chicks: age-1 lasts ONE week, needs 2 wins banked
  by Wednesday — no pipeline, no tickets. Confirmed 0 llm juvenile entries
  while scripted logged 106 by day 28.
- **The retire verb works** (3 uses logged after the day-28 fix shipped).
- Day-28 ratio was 0.56 — the strongest start of any experiment — before
  the infrastructure took the wheel.

## The operational law this bought

**Never cold-tune a fleet.** Tune only while a sim is running (mid-run
binds 10/10, proven twice today). And the envoy bug now has a documented
escalation path: wedged leases + hard daemon kill can corrupt the durable
store itself, at which point the only cure is retiring the store — which
costs every actor's standing orders. Report both to Rivet.

Attempt 2 (the clean exp5) starts fresh in the parent directory: same
protocol, all instruments live from day 1 including the retire verb.
