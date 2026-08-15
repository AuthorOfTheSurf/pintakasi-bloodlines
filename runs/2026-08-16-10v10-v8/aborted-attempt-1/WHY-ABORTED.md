# Attempt 1 — aborted at day 28 by the fail-fast gate (Zane's rule)

World: `data/sim-20260816-0518.db` (kept). Gate: juvenile fights 388 ✓,
juvenile crown entries 7 ✓ — but **eggs 0, hatched 0, retire proposals 0**
despite the DAILY-breed order delivered bluntly at day 2. The one-lever
hypothesis (wording cadence) is dead: blunter wording cannot fix this.

The diagnosis found **instrument gap #7, the pipeline killer of all seven
experiments**: 18 breed proposals, every one refused — because the brief's
`studs` list only ever showed the barn's OWN retired roosters, while
scripted bots breed by shopping OTHER farms' listed studs. The stud MARKET
was invisible; most barns had no legal father to name even when they tried.
The engine has always accepted a cross-farm listed stud — only the
visibility was missing.

Fix (round 60): `studMarket` in the view + brief (top listed studs by
stars, cross-farm), breeding rule + A GOOD DAY second-priority line.
Attempt 2 relaunched with it.
