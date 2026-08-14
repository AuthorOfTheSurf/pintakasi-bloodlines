# The 10v10 journal — one continuous read

10 scripted barns vs 10 llm barns (qwen3:30b-a3b on Rivet Actors), day 1 to
day 91, coached every 4 weeks. This file stitches the whole experiment in
chronological order: each segment's verbatim sim log, then the coach session
that followed it. The per-file originals live alongside in this directory;
this is the reading copy.

Creeds (2 barns each, shared net-worth goal — GP + 0.8·LT, championships as
the +EV peaks): card shark (bot-7, bot-15) · bloodline architect (bot-marco,
bot-9) · claim scout (bot-8, bot-16) · talent scout (bot-14, bot-12) ·
operator (bot-13, bot-17).

---

## Segment 1 — days 1–28 (verbatim sim log)

```
$ bun run scripts/simulate.ts "28" "--seed=1" "--brain=qwen3:30b-a3b" "--llm=bot-7,bot-15,bot-marco,bot-9,bot-8,bot-16,bot-14,bot-12,bot-13,bot-17" --actors "--personas=championship"
Fresh world seeded at /Users/plumeria/Repos/pintakasi-bloodlines/data/sim-20260815-0137.db — day 0, Friday

Brain: qwen3:30b-a3b plays 10 stable(s) — bot-7, bot-15, bot-marco, bot-9, bot-8, bot-16, bot-14, bot-12, bot-13, bot-17

Personas set: 10 barn(s) start under the championship creeds

  [brain] Sugalan Social Club: 0 actions (12.8s)
  [brain] Hacienda Verde: 0 actions (13.6s)
  [brain] Marco Gamefarm: 0 actions (14.3s)
  [brain] Talisay Tari Club: 2 actions, 3 dropped (16.5s)
          ✗ 2× enter: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
  [brain] Ilonggo Ironworks: 0 actions (17.2s)
  [brain] Pulang Bagwis: 1 actions (18.0s)
  [brain] Cuchillos de Sonora: 1 actions (18.9s)
  [brain] Batangas Sprint Club: 1 actions (19.9s)
  [brain] Cavite Bloodlines: 1 actions, 2 dropped (21.2s)
          ✗ 1× list_stud: unknown bird #3
          ✗ 1× list_stud: unknown bird #4
  [brain] Bagong Laban: 1 actions (22.1s)
Day 1 (Saturday): 0 fights, 0 unmatched, 0 claims settled, staking paid 1687.97 GP to 11 stakers — 22.3s
  [brain] Marco Gamefarm: 1 actions, 3 dropped (2.1s)
          ✗ 2× enter: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
  [brain] Hacienda Verde: 2 actions, 6 dropped (5.2s)
          ✗ 2× enter: unknown bird #2
          ✗ 2× enter: unknown bird #3
          ✗ 2× enter: unknown bird #1
  [brain] Talisay Tari Club: 1 actions, 12 dropped (13.1s)
          ✗ 12× enter: unknown bird #3
  [brain] Sugalan Social Club: 1 actions (13.9s)
  [brain] Cuchillos de Sonora: 1 actions (14.7s)
  [brain] Bagong Laban: 1 actions (15.5s)
  [brain] Batangas Sprint Club: 2 actions, 4 dropped (19.0s)
          ✗ 3× enter: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
  [brain] Ilonggo Ironworks: 2 actions, 2 dropped (20.6s)
          ✗ 2× enter: unknown bird #3
  [brain] Pulang Bagwis: 3 actions, 3 dropped (22.9s)
          ✗ 1× enter: unknown bird #1
          ✗ 1× enter: unknown bird #2
          ✗ 1× list_stud: unknown bird #3
  [brain] Cavite Bloodlines: 1 actions (23.8s)
Day 2 (Sunday): 0 fights, 0 unmatched, 0 claims settled, staking paid 919.97 GP to 12 stakers — 23.9s
  [brain] Hacienda Verde: 1 actions, 11 dropped (5.2s)
          ✗ 11× enter: unknown bird #3
  [brain] Ilonggo Ironworks: 2 actions, 7 dropped (10.5s)
          ✗ 6× enter: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
  [brain] Talisay Tari Club: 2 actions (11.7s)
  [brain] Pulang Bagwis: 2 actions, 2 dropped (13.4s)
          ✗ 2× enter: unknown bird #3
  [brain] Batangas Sprint Club: 1 actions (14.1s)
  [brain] Marco Gamefarm: 2 actions, 11 dropped (18.8s)
          ✗ 11× enter: unknown bird #3
  [brain] Cavite Bloodlines: 2 actions, 2 dropped (20.8s)
          ✗ 1× enter: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
  [brain] Cuchillos de Sonora: 4 actions, 3 dropped (22.9s)
          ✗ 2× enter: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
  [brain] Sugalan Social Club: 2 actions (23.8s)
  [brain] Bagong Laban: 2 actions, 6 dropped (27.9s)
          ✗ 5× enter: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
Day 3 (Monday): 0 fights, 0 unmatched, 0 claims settled, staking paid 935.99 GP to 16 stakers — 28.0s
  [brain] Marco Gamefarm: 2 actions (1.1s)
  [brain] Cuchillos de Sonora: 3 actions, 1 dropped (2.5s)
          ✗ 1× list_stud: unknown bird #7
  [brain] Batangas Sprint Club: 2 actions (3.7s)
  [brain] Sugalan Social Club: 2 actions (4.7s)
  [brain] Pulang Bagwis: 3 actions, 2 dropped (6.9s)
          ✗ 1× enter: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
  [brain] Cavite Bloodlines: 2 actions, 2 dropped (8.4s)
          ✗ 2× enter: unknown bird #3
  [brain] Hacienda Verde: 3 actions, 3 dropped (10.2s)
          ✗ 2× enter: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
  [brain] Ilonggo Ironworks: 0 actions (10.9s)
  [brain] Talisay Tari Club: 0 actions (11.5s)
  [brain] Bagong Laban: 2 actions, 12 dropped (15.9s)
          ✗ 12× enter: unknown bird #3
Day 4 (Tuesday): 0 fights, 0 unmatched, 0 claims settled, staking paid 919.94 GP to 21 stakers — 16.0s
  [brain] Ilonggo Ironworks: 1 actions, 3 dropped (2.1s)
          ✗ 3× enter: unknown bird #3
  [brain] Bagong Laban: 1 actions (3.0s)
  [brain] Cavite Bloodlines: 2 actions, 3 dropped (4.7s)
          ✗ 2× enter: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
  [brain] Talisay Tari Club: 0 actions (5.4s)
  [brain] Marco Gamefarm: 2 actions, 2 dropped (6.9s)
          ✗ 1× enter: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
  [brain] Sugalan Social Club: 2 actions, 1 dropped (8.1s)
          ✗ 1× enter: unknown bird #3
  [brain] Cuchillos de Sonora: 2 actions, 2 dropped (9.8s)
          ✗ 1× enter: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
  [brain] Batangas Sprint Club: 2 actions, 12 dropped (14.9s)
          ✗ 12× enter: unknown bird #3
  [brain] Hacienda Verde: 3 actions, 4 dropped (18.2s)
          ✗ 1× enter: unknown bird #3
          ✗ 1× enter: unknown bird #5
          ✗ 1× enter: unknown bird #7
          ✗ 1× list_stud: unknown bird #9
  [brain] Pulang Bagwis: 3 actions, 2 dropped (20.6s)
          ✗ 1× enter: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
Day 5 (Wednesday): 0 fights, 0 unmatched, 0 claims settled, staking paid 936.03 GP to 21 stakers — 20.7s
  [brain] Talisay Tari Club: 2 actions, 2 dropped (1.9s)
          ✗ 2× enter: unknown bird #3
  [brain] Ilonggo Ironworks: 2 actions (2.7s)
  [brain] Marco Gamefarm: 2 actions (3.5s)
  [brain] Batangas Sprint Club: 0 actions (4.1s)
  [brain] Pulang Bagwis: 3 actions, 2 dropped (5.5s)
          ✗ 1× list_stud: unknown bird #3
          ✗ 1× enter: unknown bird #3
  [brain] Cuchillos de Sonora: 3 actions, 1 dropped (7.4s)
          ✗ 1× enter: unknown bird #3
  [brain] Hacienda Verde: 2 actions, 3 dropped (9.0s)
          ✗ 3× enter: unknown bird #3
  [brain] Cavite Bloodlines: 0 actions (9.6s)
  [brain] Bagong Laban: 4 actions (10.6s)
  [brain] Sugalan Social Club: 2 actions, 2 dropped (12.0s)
          ✗ 2× enter: unknown bird #3
Day 6 (Thursday): 0 fights, 0 unmatched, 0 claims settled, staking paid 919.97 GP to 21 stakers — 12.1s
  [brain] Sugalan Social Club: 1 actions (1.0s)
  [brain] Talisay Tari Club: 2 actions (1.8s)
  [brain] Marco Gamefarm: 2 actions, 3 dropped (3.3s)
          ✗ 2× enter: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
  [brain] Cavite Bloodlines: 2 actions, 7 dropped (6.7s)
          ✗ 7× enter: unknown bird #3
  [brain] Hacienda Verde: 1 actions (7.6s)
  [brain] Bagong Laban: 1 actions (8.5s)
  [brain] Ilonggo Ironworks: 2 actions, 3 dropped (10.1s)
          ✗ 2× enter: unknown bird #3
          ✗ 1× list_stud: unknown bird #3
  [brain] Pulang Bagwis: 1 actions (10.9s)
  [brain] Cuchillos de Sonora: 0 actions (11.4s)
  [brain] Batangas Sprint Club: 2 actions (12.4s)
Day 7 (Friday): 0 fights, 0 unmatched, 0 claims settled, staking paid 912.03 GP to 21 stakers — HATCH FRIDAY (8 hatched) — 12.6s
        wk 1 · 7 days in 2:16 · avg 19.39s/day
  [brain] Bagong Laban: 5 actions (2.8s)
  [brain] Hacienda Verde: 11 actions (6.6s)
  [brain] Marco Gamefarm: 8 actions (10.6s)
  [brain] Cavite Bloodlines: 0 actions (11.5s)
  [brain] Batangas Sprint Club: 1 actions (12.7s)
  [brain] Cuchillos de Sonora: 5 actions (15.4s)
  [brain] Pulang Bagwis: 2 actions (16.7s)
  [brain] Ilonggo Ironworks: 2 actions (17.8s)
  [brain] Sugalan Social Club: 2 actions (19.1s)
  [brain] Talisay Tari Club: 10 actions (23.5s)
Day 8 (Saturday): 76 fights, 0 unmatched, 3 claims settled, staking paid 914.78 GP to 21 stakers — 23.7s
  [brain] Hacienda Verde: 2 actions (1.5s)
  [brain] Cavite Bloodlines: 5 actions (4.2s)
  [brain] Ilonggo Ironworks: 6 actions (7.4s)
  [brain] Cuchillos de Sonora: 8 actions (10.0s)
  [brain] Bagong Laban: 11 actions (16.0s)
  [brain] Batangas Sprint Club: 5 actions (19.3s)
  [brain] Marco Gamefarm: 6 actions (21.5s)
  [brain] Talisay Tari Club: 8 actions (24.6s)
  [brain] Pulang Bagwis: 5 actions (26.6s)
  [brain] Sugalan Social Club: 5 actions (29.4s)
Day 9 (Sunday): 102 fights, 0 unmatched, 4 claims settled, staking paid 933.63 GP to 21 stakers — 29.8s
  [brain] Talisay Tari Club: 0 actions (1.3s)
  [brain] Pulang Bagwis: 2 actions (2.5s)
  [brain] Cuchillos de Sonora: 5 actions (5.0s)
  [brain] Sugalan Social Club: 2 actions (6.4s)
  [brain] Bagong Laban: 11 actions (12.3s)
  [brain] Ilonggo Ironworks: 5 actions (14.4s)
  [brain] Hacienda Verde: 9 actions (17.8s)
  [brain] Marco Gamefarm: 10 actions (23.3s)
  [brain] Batangas Sprint Club: 7 actions (27.2s)
  [brain] Cavite Bloodlines: 8 actions (30.0s)
Day 10 (Monday): 67 fights, 0 unmatched, 2 claims settled, staking paid 939.56 GP to 21 stakers — 30.3s
  [brain] Bagong Laban: 11 actions (6.3s)
  [brain] Cuchillos de Sonora: 0 actions (7.4s)
  [brain] Cavite Bloodlines: 6 actions (10.1s)
  [brain] Marco Gamefarm: 0 actions (11.3s)
  [brain] Talisay Tari Club: 10 actions (15.6s)
  [brain] Hacienda Verde: 0 actions (16.8s)
  [brain] Pulang Bagwis: 5 actions (20.2s)
  [brain] Ilonggo Ironworks: 2 actions (21.6s)
  [brain] Sugalan Social Club: 0 actions (22.8s)
  [brain] Batangas Sprint Club: 8 actions (26.0s)
Day 11 (Tuesday): 78 fights, 0 unmatched, 8 claims settled, staking paid 916.80 GP to 21 stakers — 26.3s
  [brain] Cuchillos de Sonora: 6 actions (3.5s)
  [brain] Sugalan Social Club: 2 actions (4.7s)
  [brain] Cavite Bloodlines: 6 actions (7.1s)
  [brain] Batangas Sprint Club: 0 actions (8.4s)
  [brain] Talisay Tari Club: 8 actions (11.7s)
  [brain] Hacienda Verde: 4 actions (14.2s)
  [brain] Marco Gamefarm: 10 actions (17.8s)
  [brain] Pulang Bagwis: 5 actions (20.9s)
  [brain] Bagong Laban: 2 actions (22.3s)
  [brain] Ilonggo Ironworks: 5 actions (24.9s)
Day 12 (Wednesday): 78 fights, 1 unmatched, 4 claims settled, staking paid 949.61 GP to 21 stakers — 25.2s
  [brain] Ilonggo Ironworks: 6 actions (2.7s)
  [brain] Cuchillos de Sonora: 5 actions (4.9s)
  [brain] Bagong Laban: 0 actions (6.2s)
  [brain] Marco Gamefarm: 0 actions (7.5s)
  [brain] Hacienda Verde: 10 actions (11.3s)
  [brain] Talisay Tari Club: 6 actions (14.7s)
  [brain] Batangas Sprint Club: 0 actions (16.0s)
  [brain] Sugalan Social Club: 7 actions (18.8s)
  [brain] Cavite Bloodlines: 7 actions (22.8s)
  [brain] Pulang Bagwis: 0 actions (24.1s)
Day 13 (Thursday): 43 fights, 2 unmatched, 5 claims settled, staking paid 937.01 GP to 21 stakers — 24.5s
  [brain] Batangas Sprint Club: 12 actions (7.1s)
  [brain] Hacienda Verde: 4 actions (9.2s)
  [brain] Cavite Bloodlines: 5 actions (12.4s)
  [brain] Talisay Tari Club: 6 actions (15.1s)
  [brain] Bagong Laban: 4 actions (17.9s)
  [brain] Cuchillos de Sonora: 11 actions (22.3s)
  [brain] Marco Gamefarm: 2 actions (23.7s)
  [brain] Pulang Bagwis: 5 actions (27.0s)
  [brain] Sugalan Social Club: 8 actions (30.1s)
  [brain] Ilonggo Ironworks: 11 actions (36.4s)
Day 14 (Friday): 90 fights, 0 unmatched, 5 claims settled, staking paid 937.99 GP to 21 stakers — HATCH FRIDAY (2 hatched) — 36.8s
        wk 2 · 7 days in 3:17 · avg 28.08s/day
  [brain] Sugalan Social Club: 11 actions (7.6s)
  [brain] Bagong Laban: 1 actions (9.1s)
  [brain] Ilonggo Ironworks: 2 actions (11.1s)
  [brain] Hacienda Verde: 0 actions (12.6s)
  [brain] Cuchillos de Sonora: 23 actions (19.1s)
  [brain] Cavite Bloodlines: 0 actions (20.5s)
  [brain] Pulang Bagwis: 14 actions (26.5s)
  [brain] Talisay Tari Club: 5 actions (29.6s)
  [brain] Marco Gamefarm: 0 actions (31.0s)
  [brain] Batangas Sprint Club: 7 actions (34.0s)
Day 15 (Saturday): 107 fights, 1 unmatched, 7 claims settled, staking paid 942.42 GP to 21 stakers — 34.3s
  [brain] Hacienda Verde: 6 actions (2.5s)
  [brain] Talisay Tari Club: 11 actions (10.1s)
  [brain] Cuchillos de Sonora: 7 actions (14.3s)
  [brain] Cavite Bloodlines: 0 actions (15.5s)
  [brain] Sugalan Social Club: 6 actions (18.5s)
  [brain] Marco Gamefarm: 10 actions (23.6s)
  [brain] Ilonggo Ironworks: 12 actions (31.9s)
  [brain] Bagong Laban: 0 actions (33.2s)
  [brain] Pulang Bagwis: 1 actions (34.8s)
  [brain] Batangas Sprint Club: 1 actions (36.6s)
Day 16 (Sunday): 91 fights, 5 unmatched, 2 claims settled, staking paid 911.19 GP to 21 stakers — 37.0s
  [brain] Cuchillos de Sonora: 6 actions (3.6s)
  [brain] Ilonggo Ironworks: 7 actions (7.1s)
  [brain] Sugalan Social Club: 5 actions (10.3s)
  [brain] Pulang Bagwis: 5 actions (13.7s)
  [brain] Hacienda Verde: 7 actions (18.8s)
  [brain] Marco Gamefarm: 0 actions (20.2s)
  [brain] Batangas Sprint Club: 0 actions (22.1s)
  [brain] Talisay Tari Club: 7 actions (26.5s)
  [brain] Bagong Laban: 7 actions (31.0s)
  [brain] Cavite Bloodlines: 5 actions (34.5s)
Day 17 (Monday): 94 fights, 1 unmatched, 6 claims settled, staking paid 928.19 GP to 21 stakers — 34.9s
  [brain] Cavite Bloodlines: 6 actions (2.6s)
  [brain] Marco Gamefarm: 0 actions (3.8s)
  [brain] Bagong Laban: 8 actions (7.9s)
  [brain] Batangas Sprint Club: 11 actions (11.8s)
  [brain] Pulang Bagwis: 9 actions (17.7s)
  [brain] Cuchillos de Sonora: 0 actions (18.9s)
  [brain] Talisay Tari Club: 6 actions (22.2s)
  [brain] Hacienda Verde: 6 actions (26.0s)
  [brain] Ilonggo Ironworks: 22 actions (33.6s)
  [brain] Sugalan Social Club: 2 actions (35.3s)
Day 18 (Tuesday): 84 fights, 0 unmatched, 5 claims settled, staking paid 955.00 GP to 21 stakers — 35.7s
  [brain] Hacienda Verde: 0 actions (1.7s)
  [brain] Marco Gamefarm: 4 actions (5.0s)
  [brain] Bagong Laban: 1 actions (6.6s)
  [brain] Cuchillos de Sonora: 1 actions (8.2s)
  [brain] Talisay Tari Club: 6 actions (11.5s)
  [brain] Ilonggo Ironworks: 0 actions (13.0s)
  [brain] Batangas Sprint Club: 2 actions (15.1s)
  [brain] Cavite Bloodlines: 11 actions (21.8s)
  [brain] Pulang Bagwis: 8 actions (25.6s)
  [brain] Sugalan Social Club: 1 actions (27.3s)
Day 19 (Wednesday): 101 fights, 0 unmatched, 7 claims settled, staking paid 937.20 GP to 21 stakers — 27.7s
  [brain] Bagong Laban: 2 actions (1.6s)
  [brain] Cavite Bloodlines: 4 actions (3.9s)
  [brain] Pulang Bagwis: 2 actions (6.0s)
  [brain] Marco Gamefarm: 6 actions (8.5s)
  [brain] Ilonggo Ironworks: 11 actions (12.6s)
  [brain] Talisay Tari Club: 8 actions (15.7s)
  [brain] Hacienda Verde: 5 actions (19.0s)
  [brain] Batangas Sprint Club: 0 actions (20.4s)
  [brain] Cuchillos de Sonora: 7 actions (24.5s)
  [brain] Sugalan Social Club: 4 actions (27.6s)
Day 20 (Thursday): 49 fights, 2 unmatched, 0 claims settled, staking paid 920.02 GP to 21 stakers — 27.9s
  [brain] Pulang Bagwis: 7 actions (4.5s)
  [brain] Sugalan Social Club: 0 actions (5.8s)
  [brain] Ilonggo Ironworks: 6 actions (8.8s)
  [brain] Batangas Sprint Club: 0 actions (10.2s)
  [brain] Hacienda Verde: 6 actions (13.9s)
  [brain] Cavite Bloodlines: 2 actions (15.7s)
  [brain] Bagong Laban: 5 actions (19.4s)
  [brain] Cuchillos de Sonora: 0 actions (20.7s)
  [brain] Talisay Tari Club: 7 actions (23.7s)
  [brain] Marco Gamefarm: 0 actions (24.9s)
Day 21 (Friday): 85 fights, 1 unmatched, 5 claims settled, staking paid 932.60 GP to 21 stakers — HATCH FRIDAY (0 hatched) — 25.2s
        wk 3 · 7 days in 3:43 · avg 31.83s/day
  [brain] Marco Gamefarm: 6 actions (3.6s)
  [brain] Ilonggo Ironworks: 0 actions (5.0s)
  [brain] Cuchillos de Sonora: 7 actions (8.2s)
  [brain] Cavite Bloodlines: 7 actions (11.1s)
  [brain] Hacienda Verde: 0 actions (12.5s)
  [brain] Batangas Sprint Club: 6 actions (15.8s)
  [brain] Talisay Tari Club: 13 actions (19.5s)
  [brain] Bagong Laban: 6 actions (23.6s)
  [brain] Sugalan Social Club: 0 actions (25.1s)
  [brain] Pulang Bagwis: 0 actions (26.8s)
Day 22 (Saturday): 75 fights, 1 unmatched, 6 claims settled, staking paid 918.39 GP to 21 stakers — 27.2s
  [brain] Marco Gamefarm: 1 actions (1.5s)
  [brain] Cuchillos de Sonora: 6 actions (5.0s)
  [brain] Hacienda Verde: 25 actions (13.4s)
  [brain] Sugalan Social Club: 7 actions (17.8s)
  [brain] Ilonggo Ironworks: 2 actions (19.6s)
  [brain] Talisay Tari Club: 0 actions (21.2s)
  [brain] Cavite Bloodlines: 5 actions (24.9s)
  [brain] Batangas Sprint Club: 7 actions (29.4s)
  [brain] Pulang Bagwis: 6 actions (32.2s)
  [brain] Bagong Laban: 5 actions (35.7s)
Day 23 (Sunday): 94 fights, 3 unmatched, 5 claims settled, staking paid 922.01 GP to 21 stakers — 36.2s
  [brain] Ilonggo Ironworks: 8 actions (4.9s)
  [brain] Hacienda Verde: 2 actions (7.4s)
  [brain] Cuchillos de Sonora: 8 actions (10.7s)
  [brain] Bagong Laban: 2 actions (12.7s)
  [brain] Cavite Bloodlines: 5 actions (15.6s)
  [brain] Pulang Bagwis: 9 actions (21.3s)
  [brain] Marco Gamefarm: 5 actions (24.7s)
  [brain] Sugalan Social Club: 5 actions (28.1s)
  [brain] Talisay Tari Club: 1 actions (29.6s)
  [brain] Batangas Sprint Club: 9 actions (33.6s)
Day 24 (Monday): 88 fights, 2 unmatched, 5 claims settled, staking paid 922.98 GP to 21 stakers — 34.1s
  [brain] Bagong Laban: 6 actions (2.9s)
  [brain] Talisay Tari Club: 7 actions (8.7s)
  [brain] Batangas Sprint Club: 2 actions (10.9s)
  [brain] Pulang Bagwis: 6 actions (15.0s)
  [brain] Ilonggo Ironworks: 0 actions (16.3s)
  [brain] Cuchillos de Sonora: 2 actions (17.9s)
  [brain] Sugalan Social Club: 7 actions (23.2s)
  [brain] Hacienda Verde: 8 actions (28.5s)
  [brain] Marco Gamefarm: 5 actions (32.4s)
  [brain] Cavite Bloodlines: 0 actions (34.1s)
Day 25 (Tuesday): 77 fights, 2 unmatched, 5 claims settled, staking paid 938.84 GP to 21 stakers — 34.4s
  [brain] Sugalan Social Club: 1 actions (1.8s)
  [brain] Cavite Bloodlines: 6 actions (5.0s)
  [brain] Batangas Sprint Club: 8 actions (9.2s)
  [brain] Cuchillos de Sonora: 0 actions (10.4s)
  [brain] Ilonggo Ironworks: 7 actions (14.0s)
  [brain] Hacienda Verde: 5 actions (17.3s)
  [brain] Pulang Bagwis: 7 actions (22.3s)
  [brain] Marco Gamefarm: 13 actions (29.7s)
  [brain] Talisay Tari Club: 12 actions (34.4s)
  [brain] Bagong Laban: 6 actions (38.6s)
Day 26 (Wednesday): 112 fights, 0 unmatched, 7 claims settled, staking paid 937.96 GP to 21 stakers — 39.0s
  [brain] Hacienda Verde: 7 actions (4.6s)
  [brain] Cuchillos de Sonora: 1 actions (6.1s)
  [brain] Batangas Sprint Club: 1 actions (8.2s)
  [brain] Bagong Laban: 7 actions (12.7s)
  [brain] Marco Gamefarm: 0 actions (13.9s)
  [brain] Cavite Bloodlines: 6 actions (18.4s)
  [brain] Sugalan Social Club: 5 actions (22.5s)
  [brain] Ilonggo Ironworks: 12 actions (31.4s)
  [brain] Pulang Bagwis: 5 actions (34.5s)
  [brain] Talisay Tari Club: 0 actions (35.9s)
Day 27 (Thursday): 52 fights, 2 unmatched, 1 claims settled, staking paid 897.80 GP to 21 stakers — 36.3s
  [brain] Batangas Sprint Club: 0 actions (1.6s)
  [brain] Cavite Bloodlines: 7 actions (5.4s)
  [brain] Cuchillos de Sonora: 6 actions (9.4s)
  [brain] Bagong Laban: 8 actions (13.5s)
  [brain] Sugalan Social Club: 1 actions (14.9s)
  [brain] Hacienda Verde: 0 actions (16.3s)
  [brain] Pulang Bagwis: 6 actions (20.5s)
  [brain] Marco Gamefarm: 8 actions (23.6s)
  [brain] Talisay Tari Club: 0 actions (24.9s)
  [brain] Ilonggo Ironworks: 6 actions (29.2s)
Day 28 (Friday): 20 fights, 1 unmatched, 4 claims settled, staking paid 938.81 GP to 21 stakers — HATCH FRIDAY (0 hatched) — 29.7s
        wk 4 · 7 days in 3:57 · avg 33.84s/day

TIMING
  seed + bots      0.0s
  simulation      13:14   (28 day(s), avg 28.37s/day · honest 6% / tick 94%)
  brains          13:05   (28.03s/day · 99% of the run, 280 call(s), 0 failed)
  doctor           0.5s
  total           13:15
  slowest days d26 39.0s · d16 37.0s · d14 36.8s
  per unit     447.80 ms/fight · 598.19 ms/entry

BARN CAREERS (durable actor state — persists across runs)
  bot-7     28 day(s) played · last day 27 · 140 proposed, 17 dropped, 0 failure(s) · 481.8s thinking
  bot-8     28 day(s) played · last day 27 · 128 proposed, 7 dropped, 0 failure(s) · 333.3s thinking
  bot-9     28 day(s) played · last day 27 · 111 proposed, 16 dropped, 0 failure(s) · 422.4s thinking
  bot-marco  28 day(s) played · last day 27 · 105 proposed, 19 dropped, 0 failure(s) · 412.2s thinking
  bot-12    28 day(s) played · last day 27 · 97 proposed, 16 dropped, 0 failure(s) · 463.7s thinking
  bot-13    28 day(s) played · last day 27 · 129 proposed, 27 dropped, 0 failure(s) · 341.2s thinking
  bot-14    28 day(s) played · last day 27 · 91 proposed, 3 dropped, 0 failure(s) · 473.6s thinking
  bot-15    28 day(s) played · last day 27 · 141 proposed, 15 dropped, 0 failure(s) · 437.7s thinking
  bot-16    28 day(s) played · last day 27 · 125 proposed, 11 dropped, 0 failure(s) · 537.8s thinking
  bot-17    28 day(s) played · last day 27 · 120 proposed, 18 dropped, 0 failure(s) · 435.5s thinking

PINTAKASI DOCTOR · data/sim-20260815-0137.db
day 28 · Friday, January 31, 3000 · week 4 · 21 farms · 233 birds

INVARIANTS
  PASS  GP conservation            600,800.00 GP in world = 600,800.00 expected
  PASS  LT conservation            132,522.49 LT held = 132,522.49 LT ledgered
  PASS  no negative balances       staker 0.11 · juice 0.01 · 21 wallets clean
  PASS  pit figures                1774 fights · 1774 mirrored · 0 inversions
  PASS  purses settle              8 completed crown(s), exact to the cent
  PASS  no stranded entries        9 resolved championship(s), every entry settled
  PASS  one card per bird per day  1328 entries across 1328 bird-days · 0 over cap
  PASS  fight counts match the log 1328 settled entries · 3326 fights claimed · 0 mismatched
  PASS  scout book matches the log 579 book lines audited · 0 out of step

CARD HEALTH
  1328 entries · 1304 fought · 24 unmatched (1.8%) · 145 lobbies
  weather timing  300/1102 starred entries ran on the bird's own element day (27.2% vs 20.0% by chance, 1.36×) ✓ entries are being timed

GROUP STAGE
  fights per settled entry  mean 2.50 of 3 · 1328 settled entries
  full cards  809 (60.9%) took all 3 · short 495 (37.3%) fought 1–2 · 24 (1.8%) never fought
  groups  392 dealt · mean 3.39 birds · 12 of one (12 were the lobby's only entry)

LOBBY FILL
  mean 9.16 birds per lobby · 145 lobbies · 12 held a single bird (8.3%)
      1 ██                       8.3%
    2-3 ██████                   24.1%
    4-7 ████                     15.9%
   8-15 ███████                  31.0%
    16+ █████                    20.7%
  same-barn-only lobbies 2 · 4 birds stranded with no cross-barn opponent

WORST LOBBY KEYS
  real/maiden/b5                       14 entries, 21.4% unmatched
  real/claimer/b1@90                   15 entries, 20.0% unmatched
  real/claimer/b4@270                  17 entries, 11.8% unmatched

POPULATION
  eggs 0 · active 166 · retired 67 · 21 farms
  by age  1:14  2:12  3:18  4:122
  supply  hatches 233 · gacha eggs 65 · covers 0
  loss    hardcore 67
  barns   0 of 21 at capacity · 0 expansion(s) bought

FIGHT VOLUME
  wk  0       0  
  wk  1     482  ███████████████████
  wk  2     619  ████████████████████████
  wk  3     586  ███████████████████████
  wk  4      87  ███  (1 day)

BLOODLINES
  gen   birds   mean grade     stars   home margin
  0       233   B+ ( 330.6)    1.33★      8.8
  · nothing has been bred yet — every bird in the world is a founder

FIGHT ECONOMY BY RUNG
    rung                      fee  entries  share   GP risked   LT minted  LT/100GP
    juvenile/claimer@90        24       24   1.8%         528       77.46     14.67
    juvenile/maiden            30       35   2.6%         700      103.24     14.75
    juvenile/claimer@180       48       35   2.6%       1,312      208.28     15.88
    real/claimer@90            48      112   8.4%       4,224      673.59     15.95
    real/maiden                60       29   2.2%       1,040      168.49     16.20
    real/nw3                   60       27   2.0%         960      154.49     16.09
    juvenile/claimer@270       72       26   2.0%       1,488      251.40     16.90
    real/claimer@180           96       86   6.5%       7,552    1,356.30     17.96
    real/claimer@270          144       45   3.4%       4,320      796.86     18.45
    juvenile/open             150      347  26.1%      43,900    8,379.02     19.09
    real/open                 300      562  42.3%     147,800   31,322.36     21.19

LAND SUPPLY
  circulating 132,522.49 LT · 128,373.00 staked (96.9%) · 4,149.49 idle
  minted      132,522.49 LT over 29 day(s) · 4,569.74 LT per day
    purse_payout     60,000.00 LT   45.3%
    card_settled     43,491.49 LT   32.8%
    buy_land         28,000.00 LT   21.1%
    gacha             1,031.00 LT    0.8%
  burned      0.00 LT (0.0% of issuance) — the sinks
  valuation   at $0.01/LT (pencilled) the world has issued $1,325 of land against $7,510 of GP faucet — $0.18 of LT per $1 of GP
  runway      100B-token target reached in 10,000+ year(s) at this population's rate — scales with farms, not with time

REPLAY
  209/209 sampled fight rows rebuild exactly from their seed

STAKER POOL
  paid out 26,764.69 GP over 28 day(s) · 0.11 waiting · 128,373.00 LT staked
  land_purchase 22,400.00 · gacha 4,048.00 · claim_rake 316.80

CHAMPIONSHIPS
  major     3 run / 0 cancelled · field 23.3 · purse 34,584.07
            paid 33/70 entrants (47%) · biggest take 14.3% of all purse GP · smallest 195.46 GP
            entry fees 11,200.00 GP fund 32% of the purse · the rest is juice (gacha + breed fees) · net to the field 23,384.07 GP
            under the door 0/33 winners (0%) took less purse than their entry fee
  juvenile  5 run / 1 cancelled · field 9.8 · purse 17,799.92
            paid 27/49 entrants (55%) · biggest take 21.0% of all purse GP · smallest 71.61 GP
            entry fees 2,352.00 GP fund 13% of the purse · the rest is juice (gacha + breed fees) · net to the field 15,447.92 GP
            under the door 0/27 winners (0%) took less purse than their entry fee

MECHANIC ADOPTION            farms of 21
  claims placed             20  ████████████████████░
  studs listed               0  ░░░░░░░░░░░░░░░░░░░░░  ⚠ NOBODY WALKED THROUGH
  land purchased             1  █░░░░░░░░░░░░░░░░░░░░
  paid gacha rolls          10  ██████████░░░░░░░░░░░
  gacha bundles bought       1  █░░░░░░░░░░░░░░░░░░░░
  barn expanded              0  ░░░░░░░░░░░░░░░░░░░░░  ⚠ NOBODY WALKED THROUGH
  Major entries             10  ██████████░░░░░░░░░░░
  juvenile championship     10  ██████████░░░░░░░░░░░
  ⚠ 2 door(s) unused: studs listed, barn expanded

DISCOVERY
  age 1    carded 255/1158 at the true best blade (22.0% vs random 20.0%) · 49.2% on or adjacent (random 47.8%) · answer coverage 38.0% · SCOUT 200/440 right (45.5% vs random 20.0%), 67.5% on or adjacent · clear home 116/231 (50.2%, 64.9% adjacent)
  age 2–3  carded 595/2168 at the true best blade (27.4% vs random 20.0%) · 54.7% on or adjacent (random 48.3%) · answer coverage 80.8% · SCOUT 679/1751 right (38.8% vs random 20.0%), 63.0% on or adjacent · clear home 373/831 (44.9%, 68.6% adjacent)
  age 4+   0 card decisions — too few to read
  explored  5/5 blades saw an age-1 entry in the discovery year
  flock shape  median home blade beats its runner-up by 8.8 pts · 44.6% of birds clear the 10-pt bar
  ⚠ only 44.6% of birds have a home blade worth finding — the flock is being bred flat, so there is little for discovery to discover

2 warnings · 0 invariant failures

Done → /Users/plumeria/Repos/pintakasi-bloodlines/data/sim-20260815-0137.db
Run `bun dev:sim` and open http://localhost:3435/admin — it always shows the newest sim.
```

---

## Coach session #1 — day 28 (2026-08-15)

Coach: Claude (autonomous, per COACHING.md). World: `sim-20260815-0137`.
Segment 1 health: 280 calls / 0 failures / 28.03 s/day · 0 invariant failures.

## Scoreboard at day 28

```
  rank  farm                        brain      GP         LT      net worth  crowns (GP won)
     1  Reno Gamefarm               scripted     43,260   14,948     55,219  2 (8,696)
     2  Lupa Land Holdings          scripted     24,036   37,359     53,923  —
     3  Kevin Gamefarm              scripted     34,593   16,832     48,059  1 (4,773)
     4  Tari ng Bayan               scripted     36,133    8,737     43,123  2 (4,629)
     5  Sagupaan Stables            scripted     33,839    9,414     41,370  —
     6  Kidlat sa Silangan          scripted     32,170    8,468     38,944  1 (1,268)
     7  Sabungero Syndicate         scripted     31,611    7,690     37,763  1 (1,268)
     8  Bulawan Broodfarm           scripted     32,420    6,417     37,554  —
     9  Dugo't Dangal Farms         scripted     30,175    4,829     34,038  —
    10  Bagong Laban                llm          29,374      862     30,063  —
    11  Pulang Bagwis               llm          28,758    1,085     29,626  —
    12  Sugalan Social Club         llm          27,259      765     27,871  —
    13  Cavite Bloodlines           llm          27,109      771     27,726  —
    14  Cuchillos de Sonora         llm          25,964      981     26,749  —
    15  Hacienda Verde              llm          25,707    1,067     26,560  —
    16  Ilonggo Ironworks           llm          25,753    1,008     26,559  —
    17  Talisay Tari Club           llm          25,738      757     26,344  —
    18  Batangas Sprint Club        llm          24,790      695     25,346  —
    19  Marco Gamefarm              llm          23,572      417     23,906  —
    20  Ginto Gaming Club           scripted        107      431        452  —

  scripted (10): total net worth 390,444 · avg 39,044 · crowns 7
  llm      (10): total net worth 270,750 · avg 27,075 · crowns 0
```

Scripted sweeps ranks 1–9; all ten llm barns hold 10–19. (Rank 20 is Ginto,
the scripted whale, doing exactly its job: rolling to the bottom of its
wallet.)

## Diagnosis

One cause: **volume.**

- **Fights in 28 days**: scripted barns 164–547; llm barns **29–55**. The llm
  barns enter 1–2 birds a day like careful managers; scripted pit crews card
  most of their roster nightly.
- Fights mint land win or lose (`landForFight`), so low volume is why the LT
  column is a wasteland: llm barns hold 417–1,085 LT vs scripted 4,317–37,359.
  Staked land compounds daily, so the gap widens on its own.
- Aggravator #1: the bloodline architects (bot-marco, bot-9) bred **once** in
  four weeks, combined. The pipeline creed produced no pipeline.
- Aggravator #2: **zero uses of the `crown` verb across all ten barns** — not
  one Major declaration in a month, in an experiment whose shared goal names
  championships as the +EV peaks.
- The models play cautious, tidy, and small. Nothing is *wrong* — 0 failures,
  drops are early-world eggs-only artifacts — they are simply under-playing
  the game's central loop: fight → land → stake → compound.

## Orders written (identical within each creed pair, per protocol)

| Barns | Creed | Orders |
|---|---|---|
| bot-7, bot-15 | card shark | Keep picking edges, but your volume is starving you: fights mint land win or lose, so enter every healthy bird at fair odds or better, every single day. Declare for a Major crown the moment any bird qualifies — that is where the purses are. |
| bot-marco, bot-9 | bloodline architect | You bred once in four weeks — the pipeline IS the business: pair a hen and a stud every time barn space allows. Meanwhile campaign every healthy bird daily; fights mint land win or lose. Declare for a Major crown whenever a bird qualifies. |
| bot-8, bot-16 | claim scout | Good claiming; now campaign what you built: enter every healthy bird every single day — fights mint land win or lose. Keep claiming undervalued birds. Declare for a Major crown whenever a bird qualifies. |
| bot-14, bot-12 | talent scout | Keep rolling for prospects, but FIGHT them: enter every healthy bird every single day — fights mint land win or lose. Cull the misses without sentiment. Declare for a Major crown whenever a bird qualifies. |
| bot-13, bot-17 | operator | The math this month says volume: enter every healthy bird every day (fights mint land win or lose), breed whenever space allows, and declare for a Major crown whenever a bird qualifies. Claim or roll only when clearly +EV. |

Operational note: nine tunes landed on the first pass; bot-7 wedged on the
cold-tune path and needed a second engine-daemon restart before its orders
applied (verified: career 28 days, orders present).

## What day 56 must show for the coaching to be judged working

1. Fight volume per llm barn well above the 29–55 band — the single number to
   watch.
2. LT accumulation inflecting (the compounding loop finally entered).
3. First `crown` verbs in `brain_log`; ideally a first llm crown won.
4. Breeds from the architects at a pipeline cadence, not once a month.

---

## Segment 2 — days 29–56 (verbatim sim log)

```
$ bun run scripts/simulate.ts "28" --keep "--seed=1" "--brain=qwen3:30b-a3b" "--llm=bot-7,bot-15,bot-marco,bot-9,bot-8,bot-16,bot-14,bot-12,bot-13,bot-17" --actors
Brain: qwen3:30b-a3b plays 10 stable(s) — bot-7, bot-15, bot-marco, bot-9, bot-8, bot-16, bot-14, bot-12, bot-13, bot-17

  [brain] Marco Gamefarm: 7 actions (14.7s)
  [brain] Sugalan Social Club: 0 actions (15.8s)
  [brain] Pulang Bagwis: 6 actions (19.7s)
  [brain] Bagong Laban: 0 actions (21.0s)
  [brain] Cuchillos de Sonora: 11 actions (25.5s)
  [brain] Ilonggo Ironworks: 7 actions (29.8s)
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"hgr47cmvra01x8hulmaiz35puqal00\"}"
  [brain] Batangas Sprint Club: 2 actions (31.2s)
  [brain] Hacienda Verde: 0 actions (32.4s)
  [brain] Cavite Bloodlines: 5 actions (35.8s)
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"hgr47cmvra01x8hulmaiz35puqal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"hgr47cmvra01x8hulmaiz35puqal00\"}"
[bot-brain] bot-7 proposed nothing: Actor failed to start (hgr47cmvra01x8hulmaiz35puqal00): "no_envoys"
Day 29 (Saturday): 29 fights, 1 unmatched, 4 claims settled, staking paid 1282.82 GP to 21 stakers — 2:00
  [brain] Ilonggo Ironworks: 7 actions (4.4s)
  [brain] Hacienda Verde: 10 actions (10.4s)
  [brain] Sugalan Social Club: 11 actions (14.1s)
  [brain] Batangas Sprint Club: 8 actions (16.9s)
  [brain] Marco Gamefarm: 1 actions (18.1s)
  [brain] Cavite Bloodlines: 12 actions (24.4s)
  [brain] Cuchillos de Sonora: 0 actions (25.5s)
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"hgr47cmvra01x8hulmaiz35puqal00\"}"
  [brain] Pulang Bagwis: 8 actions (30.0s)
  [brain] Bagong Laban: 9 actions (35.3s)
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"hgr47cmvra01x8hulmaiz35puqal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"hgr47cmvra01x8hulmaiz35puqal00\"}"
[bot-brain] bot-7 proposed nothing: Actor failed to start (hgr47cmvra01x8hulmaiz35puqal00): "no_envoys"
Day 30 (Sunday): 54 fights, 5 unmatched, 2 claims settled, staking paid 979.57 GP to 21 stakers — 2:00
  [brain] Cavite Bloodlines: 6 actions (3.3s)
  [brain] Sugalan Social Club: 7 actions (5.7s)
  [brain] Pulang Bagwis: 0 actions (6.9s)
  [brain] Ilonggo Ironworks: 7 actions (10.2s)
  [brain] Cuchillos de Sonora: 10 actions (16.4s)
  [brain] Marco Gamefarm: 6 actions (18.8s)
  [brain] Hacienda Verde: 15 actions (24.2s)
  [brain] Bagong Laban: 0 actions (25.4s)
  [brain] Batangas Sprint Club: 9 actions (29.3s)
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"hgr47cmvra01x8hulmaiz35puqal00\"}"
level=warn msg="http error response" group=guard code=actor_ready_timeout message="Timed out waiting for actor to become ready. Ensure that the pool selector is accurate and there are envoys available in the namespace you created this actor." metadata="{\"actor_id\":\"hgr47cmvra01x8hulmaiz35puqal00\"}"
  [brain] Talisay Tari Club: 12 actions (6.8s)
Day 31 (Monday): 60 fights, 3 unmatched, 0 claims settled, staking paid 928.03 GP to 21 stakers — 1:37
  [brain] Pulang Bagwis: 2 actions (1.7s)
  [brain] Talisay Tari Club: 6 actions (4.1s)
  [brain] Cuchillos de Sonora: 0 actions (5.2s)
  [brain] Marco Gamefarm: 6 actions (7.2s)
  [brain] Hacienda Verde: 1 actions (8.6s)
  [brain] Sugalan Social Club: 13 actions (12.8s)
  [brain] Cavite Bloodlines: 2 actions (14.1s)
  [brain] Bagong Laban: 0 actions (15.2s)
  [brain] Batangas Sprint Club: 0 actions (16.3s)
  [brain] Ilonggo Ironworks: 16 actions (23.8s)
Day 32 (Tuesday): 34 fights, 2 unmatched, 1 claims settled, staking paid 917.39 GP to 21 stakers — 24.1s
  [brain] Sugalan Social Club: 8 actions (3.2s)
  [brain] Cavite Bloodlines: 7 actions (6.4s)
  [brain] Pulang Bagwis: 8 actions (10.8s)
  [brain] Cuchillos de Sonora: 18 actions (15.4s)
  [brain] Hacienda Verde: 10 actions (18.8s)
  [brain] Talisay Tari Club: 13 actions (24.8s)
  [brain] Ilonggo Ironworks: 12 actions (29.4s)
  [brain] Marco Gamefarm: 0 actions (30.3s)
  [brain] Batangas Sprint Club: 9 actions (35.8s)
  [brain] Bagong Laban: 6 actions (38.6s)
Day 33 (Wednesday): 60 fights, 3 unmatched, 4 claims settled, staking paid 906.79 GP to 21 stakers — 39.0s
  [brain] Bagong Laban: 0 actions (1.6s)
  [brain] Cuchillos de Sonora: 11 actions (5.2s)
  [brain] Cavite Bloodlines: 8 actions (7.8s)
  [brain] Marco Gamefarm: 1 actions (8.8s)
  [brain] Batangas Sprint Club: 8 actions (11.7s)
  [brain] Talisay Tari Club: 8 actions (16.0s)
  [brain] Sugalan Social Club: 1 actions (17.2s)
  [brain] Ilonggo Ironworks: 10 actions (21.7s)
  [brain] Pulang Bagwis: 11 actions (25.5s)
  [brain] Hacienda Verde: 14 actions (30.5s)
Day 34 (Thursday): 51 fights, 4 unmatched, 3 claims settled, staking paid 933.40 GP to 21 stakers — 30.9s
  [brain] Sugalan Social Club: 5 actions (2.9s)
  [brain] Marco Gamefarm: 5 actions (4.8s)
  [brain] Talisay Tari Club: 7 actions (8.1s)
  [brain] Cuchillos de Sonora: 1 actions (9.4s)
  [brain] Bagong Laban: 12 actions (13.8s)
  [brain] Hacienda Verde: 7 actions (18.0s)
  [brain] Ilonggo Ironworks: 11 actions (21.7s)
  [brain] Cavite Bloodlines: 7 actions (25.2s)
  [brain] Batangas Sprint Club: 0 actions (26.4s)
  [brain] Pulang Bagwis: 1 actions (28.0s)
Day 35 (Friday): 24 fights, 1 unmatched, 1 claims settled, staking paid 921.83 GP to 21 stakers — HATCH FRIDAY (0 hatched) — 28.3s
        wk 5 · 7 days in 7:40 · avg 65.74s/day
  [brain] Sugalan Social Club: 7 actions (4.3s)
  [brain] Cavite Bloodlines: 7 actions (7.0s)
  [brain] Cuchillos de Sonora: 1 actions (8.5s)
  [brain] Talisay Tari Club: 8 actions (13.5s)
  [brain] Ilonggo Ironworks: 2 actions (14.7s)
  [brain] Batangas Sprint Club: 8 actions (18.6s)
  [brain] Marco Gamefarm: 5 actions (20.7s)
  [brain] Hacienda Verde: 2 actions (22.5s)
  [brain] Bagong Laban: 2 actions (24.3s)
  [brain] Pulang Bagwis: 1 actions (26.0s)
Day 36 (Saturday): 34 fights, 0 unmatched, 2 claims settled, staking paid 1291.59 GP to 21 stakers — 26.3s
  [brain] Marco Gamefarm: 0 actions (1.4s)
  [brain] Batangas Sprint Club: 1 actions (2.8s)
  [brain] Cuchillos de Sonora: 8 actions (7.7s)
  [brain] Bagong Laban: 13 actions (12.9s)
  [brain] Sugalan Social Club: 9 actions (18.1s)
  [brain] Cavite Bloodlines: 0 actions (19.3s)
  [brain] Pulang Bagwis: 9 actions (23.3s)
  [brain] Hacienda Verde: 8 actions (27.0s)
  [brain] Ilonggo Ironworks: 10 actions (31.0s)
  [brain] Talisay Tari Club: 7 actions (34.0s)
Day 37 (Sunday): 38 fights, 0 unmatched, 1 claims settled, staking paid 1019.61 GP to 21 stakers — 34.3s
  [brain] Cuchillos de Sonora: 7 actions (4.3s)
  [brain] Marco Gamefarm: 2 actions (5.8s)
  [brain] Sugalan Social Club: 8 actions (9.2s)
  [brain] Batangas Sprint Club: 0 actions (10.4s)
  [brain] Hacienda Verde: 0 actions (11.9s)
  [brain] Bagong Laban: 0 actions (13.7s)
  [brain] Cavite Bloodlines: 5 actions (17.0s)
  [brain] Pulang Bagwis: 10 actions (23.0s)
  [brain] Talisay Tari Club: 6 actions (25.9s)
  [brain] Ilonggo Ironworks: 8 actions (29.3s)
Day 38 (Monday): 28 fights, 1 unmatched, 3 claims settled, staking paid 1012.59 GP to 21 stakers — 29.6s
  [brain] Hacienda Verde: 0 actions (1.5s)
  [brain] Marco Gamefarm: 0 actions (2.9s)
  [brain] Sugalan Social Club: 0 actions (4.4s)
  [brain] Cuchillos de Sonora: 11 actions (8.7s)
  [brain] Pulang Bagwis: 10 actions (13.1s)
  [brain] Bagong Laban: 17 actions (19.0s)
  [brain] Talisay Tari Club: 10 actions (23.0s)
  [brain] Batangas Sprint Club: 0 actions (24.3s)
  [brain] Cavite Bloodlines: 1 actions (25.8s)
  [brain] Ilonggo Ironworks: 11 actions (30.0s)
Day 39 (Tuesday): 55 fights, 3 unmatched, 2 claims settled, staking paid 947.59 GP to 21 stakers — 30.3s
  [brain] Ilonggo Ironworks: 0 actions (1.3s)
  [brain] Cavite Bloodlines: 0 actions (2.3s)
  [brain] Cuchillos de Sonora: 7 actions (7.0s)
  [brain] Hacienda Verde: 0 actions (8.4s)
  [brain] Talisay Tari Club: 0 actions (9.6s)
  [brain] Sugalan Social Club: 2 actions (11.5s)
  [brain] Marco Gamefarm: 0 actions (12.6s)
  [brain] Batangas Sprint Club: 0 actions (14.0s)
  [brain] Bagong Laban: 0 actions (15.4s)
  [brain] Pulang Bagwis: 0 actions (17.0s)
Day 40 (Wednesday): 19 fights, 1 unmatched, 2 claims settled, staking paid 931.59 GP to 21 stakers — 17.3s
  [brain] Bagong Laban: 6 actions (4.2s)
  [brain] Talisay Tari Club: 7 actions (8.5s)
  [brain] Pulang Bagwis: 8 actions (12.0s)
  [brain] Cavite Bloodlines: 9 actions (15.7s)
  [brain] Ilonggo Ironworks: 10 actions (22.0s)
  [brain] Cuchillos de Sonora: 2 actions (23.7s)
  [brain] Marco Gamefarm: 5 actions (27.0s)
  [brain] Sugalan Social Club: 7 actions (30.1s)
  [brain] Batangas Sprint Club: 1 actions (31.9s)
  [brain] Hacienda Verde: 0 actions (33.7s)
Day 41 (Thursday): 22 fights, 3 unmatched, 0 claims settled, staking paid 919.99 GP to 21 stakers — 34.0s
  [brain] Cavite Bloodlines: 7 actions (4.3s)
  [brain] Ilonggo Ironworks: 10 actions (8.3s)
  [brain] Sugalan Social Club: 6 actions (12.3s)
  [brain] Talisay Tari Club: 6 actions (15.2s)
  [brain] Marco Gamefarm: 5 actions (18.3s)
  [brain] Pulang Bagwis: 9 actions (23.1s)
  [brain] Bagong Laban: 2 actions (24.8s)
  [brain] Cuchillos de Sonora: 11 actions (29.7s)
  [brain] Hacienda Verde: 7 actions (34.1s)
  [brain] Batangas Sprint Club: 0 actions (35.7s)
Day 42 (Friday): 33 fights, 1 unmatched, 2 claims settled, staking paid 927.21 GP to 21 stakers — HATCH FRIDAY (2 hatched) — 36.0s
        wk 6 · 7 days in 3:28 · avg 29.68s/day
  [brain] Batangas Sprint Club: 8 actions (5.2s)
  [brain] Talisay Tari Club: 7 actions (9.4s)
  [brain] Cavite Bloodlines: 6 actions (11.8s)
  [brain] Pulang Bagwis: 0 actions (13.3s)
  [brain] Cuchillos de Sonora: 12 actions (18.8s)
  [brain] Marco Gamefarm: 2 actions (20.4s)
  [brain] Hacienda Verde: 6 actions (23.8s)
  [brain] Ilonggo Ironworks: 0 actions (25.0s)
  [brain] Sugalan Social Club: 12 actions (30.1s)
  [brain] Bagong Laban: 0 actions (31.8s)
Day 43 (Saturday): 64 fights, 1 unmatched, 2 claims settled, staking paid 1267.60 GP to 21 stakers — 32.3s
  [brain] Talisay Tari Club: 0 actions (1.3s)
  [brain] Ilonggo Ironworks: 11 actions (7.5s)
  [brain] Marco Gamefarm: 14 actions (13.2s)
  [brain] Pulang Bagwis: 15 actions (19.0s)
  [brain] Batangas Sprint Club: 2 actions (21.0s)
  [brain] Cuchillos de Sonora: 15 actions (26.1s)
  [brain] Cavite Bloodlines: 5 actions (28.9s)
  [brain] Sugalan Social Club: 8 actions (32.6s)
  [brain] Hacienda Verde: 0 actions (34.2s)
  [brain] Bagong Laban: 0 actions (35.9s)
Day 44 (Sunday): 47 fights, 1 unmatched, 3 claims settled, staking paid 1062.41 GP to 21 stakers — 36.3s
  [brain] Sugalan Social Club: 7 actions (3.2s)
  [brain] Talisay Tari Club: 7 actions (7.9s)
  [brain] Cavite Bloodlines: 0 actions (9.2s)
  [brain] Bagong Laban: 8 actions (13.0s)
  [brain] Cuchillos de Sonora: 10 actions (19.9s)
  [brain] Pulang Bagwis: 10 actions (26.2s)
  [brain] Batangas Sprint Club: 10 actions (32.6s)
  [brain] Hacienda Verde: 2 actions (34.2s)
  [brain] Marco Gamefarm: 0 actions (35.3s)
  [brain] Ilonggo Ironworks: 10 actions (41.8s)
Day 45 (Monday): 71 fights, 0 unmatched, 1 claims settled, staking paid 1005.39 GP to 21 stakers — 42.1s
  [brain] Bagong Laban: 0 actions (2.0s)
  [brain] Cuchillos de Sonora: 0 actions (3.8s)
  [brain] Sugalan Social Club: 9 actions (8.7s)
  [brain] Talisay Tari Club: 0 actions (10.6s)
  [brain] Cavite Bloodlines: 10 actions (15.8s)
  [brain] Pulang Bagwis: 0 actions (17.2s)
  [brain] Batangas Sprint Club: 0 actions (18.8s)
  [brain] Marco Gamefarm: 0 actions (20.4s)
  [brain] Ilonggo Ironworks: 9 actions (25.5s)
  [brain] Hacienda Verde: 9 actions (29.4s)
Day 46 (Tuesday): 55 fights, 1 unmatched, 7 claims settled, staking paid 1011.81 GP to 21 stakers — 29.8s
  [brain] Marco Gamefarm: 1 actions (1.4s)
  [brain] Bagong Laban: 0 actions (2.8s)
  [brain] Pulang Bagwis: 0 actions (4.3s)
  [brain] Ilonggo Ironworks: 0 actions (6.1s)
  [brain] Cavite Bloodlines: 8 actions (10.6s)
  [brain] Batangas Sprint Club: 14 actions (16.2s)
  [brain] Hacienda Verde: 0 actions (17.7s)
  [brain] Sugalan Social Club: 7 actions (22.2s)
  [brain] Talisay Tari Club: 9 actions (28.0s)
  [brain] Cuchillos de Sonora: 9 actions (34.0s)
Day 47 (Wednesday): 66 fights, 3 unmatched, 6 claims settled, staking paid 933.59 GP to 21 stakers — 34.3s
  [brain] Batangas Sprint Club: 0 actions (1.5s)
  [brain] Bagong Laban: 0 actions (3.2s)
  [brain] Cuchillos de Sonora: 11 actions (10.3s)
  [brain] Talisay Tari Club: 0 actions (11.5s)
  [brain] Pulang Bagwis: 14 actions (17.6s)
  [brain] Cavite Bloodlines: 7 actions (21.1s)
  [brain] Sugalan Social Club: 5 actions (24.9s)
  [brain] Ilonggo Ironworks: 10 actions (29.0s)
  [brain] Marco Gamefarm: 10 actions (35.3s)
  [brain] Hacienda Verde: 0 actions (37.0s)
Day 48 (Thursday): 35 fights, 2 unmatched, 1 claims settled, staking paid 893.42 GP to 21 stakers — 37.4s
  [brain] Hacienda Verde: 7 actions (4.6s)
  [brain] Cavite Bloodlines: 0 actions (6.0s)
  [brain] Sugalan Social Club: 0 actions (8.1s)
  [brain] Marco Gamefarm: 0 actions (9.6s)
  [brain] Pulang Bagwis: 0 actions (11.2s)
  [brain] Talisay Tari Club: 16 actions (16.7s)
  [brain] Bagong Laban: 0 actions (18.7s)
  [brain] Ilonggo Ironworks: 0 actions (20.5s)
  [brain] Cuchillos de Sonora: 9 actions (24.2s)
  [brain] Batangas Sprint Club: 6 actions (28.0s)
Day 49 (Friday): 42 fights, 2 unmatched, 4 claims settled, staking paid 911.19 GP to 21 stakers — HATCH FRIDAY (5 hatched) — 28.4s
        wk 7 · 7 days in 4:01 · avg 34.37s/day
  [brain] Marco Gamefarm: 1 actions (1.4s)
  [brain] Bagong Laban: 0 actions (2.7s)
  [brain] Hacienda Verde: 1 actions (4.5s)
  [brain] Cuchillos de Sonora: 2 actions (6.5s)
  [brain] Sugalan Social Club: 8 actions (12.0s)
  [brain] Talisay Tari Club: 9 actions (15.8s)
  [brain] Ilonggo Ironworks: 10 actions (22.3s)
  [brain] Pulang Bagwis: 10 actions (29.0s)
  [brain] Batangas Sprint Club: 2 actions (30.5s)
  [brain] Cavite Bloodlines: 1 actions (31.9s)
Day 50 (Saturday): 80 fights, 1 unmatched, 4 claims settled, staking paid 1282.79 GP to 21 stakers — 32.4s
  [brain] Sugalan Social Club: 13 actions (5.8s)
  [brain] Talisay Tari Club: 6 actions (8.9s)
  [brain] Batangas Sprint Club: 0 actions (10.7s)
  [brain] Marco Gamefarm: 2 actions (12.6s)
  [brain] Pulang Bagwis: 0 actions (14.2s)
  [brain] Ilonggo Ironworks: 12 actions (18.8s)
  [brain] Bagong Laban: 0 actions (20.2s)
  [brain] Hacienda Verde: 9 actions (26.3s)
  [brain] Cuchillos de Sonora: 0 actions (27.6s)
  [brain] Cavite Bloodlines: 5 actions (30.2s)
Day 51 (Sunday): 77 fights, 2 unmatched, 4 claims settled, staking paid 1072.99 GP to 21 stakers — 30.7s
  [brain] Batangas Sprint Club: 0 actions (1.5s)
  [brain] Talisay Tari Club: 9 actions (5.2s)
  [brain] Bagong Laban: 0 actions (6.9s)
  [brain] Marco Gamefarm: 0 actions (8.4s)
  [brain] Cuchillos de Sonora: 10 actions (13.4s)
  [brain] Sugalan Social Club: 0 actions (15.2s)
  [brain] Pulang Bagwis: 1 actions (16.8s)
  [brain] Cavite Bloodlines: 7 actions (19.8s)
  [brain] Hacienda Verde: 0 actions (21.5s)
  [brain] Ilonggo Ironworks: 9 actions (25.1s)
Day 52 (Monday): 97 fights, 1 unmatched, 4 claims settled, staking paid 1018.82 GP to 21 stakers — 25.5s
  [brain] Ilonggo Ironworks: 10 actions (6.6s)
  [brain] Marco Gamefarm: 2 actions (8.1s)
  [brain] Cuchillos de Sonora: 8 actions (13.1s)
  [brain] Pulang Bagwis: 15 actions (19.0s)
  [brain] Bagong Laban: 7 actions (23.6s)
  [brain] Cavite Bloodlines: 11 actions (27.6s)
  [brain] Talisay Tari Club: 8 actions (31.1s)
  [brain] Hacienda Verde: 7 actions (36.1s)
  [brain] Batangas Sprint Club: 21 actions (48.0s)
  [brain] Sugalan Social Club: 0 actions (49.3s)
Day 53 (Tuesday): 119 fights, 3 unmatched, 2 claims settled, staking paid 955.61 GP to 21 stakers — 49.8s
  [brain] Pulang Bagwis: 1 actions (2.3s)
  [brain] Cuchillos de Sonora: 0 actions (4.1s)
  [brain] Batangas Sprint Club: 2 actions (6.6s)
  [brain] Cavite Bloodlines: 0 actions (8.2s)
  [brain] Marco Gamefarm: 7 actions (11.2s)
  [brain] Bagong Laban: 2 actions (13.4s)
  [brain] Hacienda Verde: 7 actions (18.2s)
  [brain] Talisay Tari Club: 0 actions (19.5s)
  [brain] Ilonggo Ironworks: 9 actions (25.7s)
  [brain] Sugalan Social Club: 14 actions (30.8s)
Day 54 (Wednesday): 91 fights, 2 unmatched, 10 claims settled, staking paid 979.96 GP to 21 stakers — 31.3s
  [brain] Cuchillos de Sonora: 0 actions (1.5s)
  [brain] Marco Gamefarm: 5 actions (4.3s)
  [brain] Bagong Laban: 0 actions (6.0s)
  [brain] Cavite Bloodlines: 6 actions (10.3s)
  [brain] Hacienda Verde: 0 actions (11.8s)
  [brain] Batangas Sprint Club: 1 actions (13.9s)
  [brain] Sugalan Social Club: 11 actions (18.4s)
  [brain] Ilonggo Ironworks: 9 actions (23.5s)
  [brain] Pulang Bagwis: 0 actions (25.1s)
  [brain] Talisay Tari Club: 9 actions (30.4s)
Day 55 (Thursday): 17 fights, 5 unmatched, 0 claims settled, staking paid 912.03 GP to 21 stakers — 30.8s
  [brain] Pulang Bagwis: 9 actions (3.7s)
  [brain] Talisay Tari Club: 9 actions (9.4s)
  [brain] Cuchillos de Sonora: 0 actions (11.3s)
  [brain] Bagong Laban: 10 actions (17.8s)
  [brain] Hacienda Verde: 8 actions (23.6s)
  [brain] Batangas Sprint Club: 10 actions (30.4s)
  [brain] Ilonggo Ironworks: 6 actions (34.5s)
  [brain] Marco Gamefarm: 0 actions (36.0s)
  [brain] Cavite Bloodlines: 1 actions (37.7s)
  [brain] Sugalan Social Club: 7 actions (42.8s)
Day 56 (Friday): 85 fights, 2 unmatched, 2 claims settled, staking paid 930.79 GP to 21 stakers — HATCH FRIDAY (5 hatched) — 43.3s
        wk 8 · 7 days in 4:04 · avg 34.86s/day

TIMING
  seed + bots      0.0s
  simulation      19:13   (28 day(s), avg 41.17s/day · honest 7% / tick 93%)
  brains          19:04   (40.84s/day · 99% of the run, 280 call(s), 2 failed)
  doctor           0.8s
  total           19:14
  slowest days d29 2:00 · d30 2:00 · d31 1:37
  per unit     342.91 ms/fight · 434.38 ms/entry

BARN CAREERS (durable actor state — persists across runs)
  bot-7     54 day(s) played · last day 55 · 319 proposed, 17 dropped, 0 failure(s) · 876.9s thinking
  bot-8     56 day(s) played · last day 55 · 312 proposed, 7 dropped, 0 failure(s) · 740.0s thinking
  bot-9     56 day(s) played · last day 55 · 254 proposed, 16 dropped, 0 failure(s) · 899.7s thinking
  bot-marco  56 day(s) played · last day 55 · 192 proposed, 19 dropped, 0 failure(s) · 821.1s thinking
  bot-12    56 day(s) played · last day 55 · 219 proposed, 16 dropped, 0 failure(s) · 1033.9s thinking
  bot-13    56 day(s) played · last day 55 · 259 proposed, 27 dropped, 0 failure(s) · 946.1s thinking
  bot-14    56 day(s) played · last day 55 · 276 proposed, 3 dropped, 0 failure(s) · 939.6s thinking
  bot-15    56 day(s) played · last day 55 · 367 proposed, 15 dropped, 0 failure(s) · 1027.3s thinking
  bot-16    56 day(s) played · last day 55 · 283 proposed, 11 dropped, 0 failure(s) · 1016.6s thinking
  bot-17    56 day(s) played · last day 55 · 214 proposed, 18 dropped, 0 failure(s) · 898.9s thinking

PINTAKASI DOCTOR · data/sim-20260815-0137.db
day 56 · Friday, February 28, 3000 · week 8 · 21 farms · 430 birds

INVARIANTS
  PASS  GP conservation            1,006,400.00 GP in world = 1,006,400.00 expected
  PASS  LT conservation            384,540.54 LT held = 384,540.54 LT ledgered
  PASS  no negative balances       staker 0.11 · juice 0.01 · 21 wallets clean
  PASS  pit figures                3362 fights · 3362 mirrored · 0 inversions
  PASS  purses settle              25 completed crown(s), exact to the cent
  PASS  no stranded entries        26 resolved championship(s), every entry settled
  PASS  one card per bird per day  2654 entries across 2654 bird-days · 0 over cap
  PASS  fight counts match the log 2654 settled entries · 6300 fights claimed · 0 mismatched
  PASS  scout book matches the log 1083 book lines audited · 0 out of step

CARD HEALTH
  2654 entries · 2576 fought · 78 unmatched (2.9%) · 378 lobbies
  weather timing  598/2299 starred entries ran on the bird's own element day (26.0% vs 20.0% by chance, 1.30×) ✓ entries are being timed

GROUP STAGE
  fights per settled entry  mean 2.37 of 3 · 2654 settled entries
  full cards  1381 (52.0%) took all 3 · short 1195 (45.0%) fought 1–2 · 78 (2.9%) never fought
  groups  821 dealt · mean 3.23 birds · 42 of one (42 were the lobby's only entry)

LOBBY FILL
  mean 7.02 birds per lobby · 378 lobbies · 42 held a single bird (11.1%)
      1 ███                      11.1%
    2-3 ██████                   25.9%
    4-7 ██████                   23.5%
   8-15 ███████                  30.2%
    16+ ██                       9.3%
  same-barn-only lobbies 12 · 25 birds stranded with no cross-barn opponent

WORST LOBBY KEYS
  real/maiden/b5                       15 entries, 26.7% unmatched
  real/claimer/b1@90                   36 entries, 25.0% unmatched
  real/claimer/b3@270                   9 entries, 22.2% unmatched

POPULATION
  eggs 42 · active 282 · retired 106 · 21 farms
  by age  1:48  2:49  3:46  4:6  5:9  6:6  7:13  8:105
  supply  hatches 388 · gacha eggs 116 · covers 146
  loss    hardcore 106
  barns   0 of 21 at capacity · 0 expansion(s) bought

FIGHT VOLUME
  wk  0       0  
  wk  1     482  ███████████████████
  wk  2     619  ████████████████████████
  wk  3     586  ███████████████████████
  wk  4     376  ███████████████
  wk  5     239  █████████
  wk  6     408  ████████████████
  wk  7     559  ██████████████████████
  wk  8      93  ████  (1 day)
  trough wk5 (239) = 38.6% of the wk2 peak (619) — EXPECTED: the age-3 founder flock is culled by the hardcore
  Majors before the first bred generation reaches fighting age, then volume
  recovers. Reference: wk3/4/5/6/7 = 1092/397/145/498/871 fights (20 farms, 91 days).

BLOODLINES
  gen   birds   mean grade     stars   home margin
  0       284   B+ ( 330.8)    1.56★      8.3
  1       146   B+ ( 344.2)    1.69★     14.1
  gen 1 vs gen 0  +13.4 mean stat · +0.1★ · +5.9 pts of home margin

FIGHT ECONOMY BY RUNG
    rung                      fee  entries  share   GP risked   LT minted  LT/100GP
    juvenile/claimer@90        24       46   1.7%         880      126.92     14.42
    juvenile/maiden            30       56   2.1%         980      143.32     14.62
    juvenile/claimer@180       48       57   2.1%       1,856      292.84     15.78
    real/claimer@90            48      200   7.5%       6,976    1,108.37     15.89
    real/maiden                60       45   1.7%       1,320      210.56     15.95
    real/nw3                   60       46   1.7%       1,440      230.16     15.98
    juvenile/claimer@270       72       42   1.6%       2,352      396.34     16.85
    real/claimer@180           96      116   4.4%       9,024    1,607.43     17.81
    real/claimer@270          144       96   3.6%       9,216    1,704.64     18.50
    juvenile/open             150      679  25.6%      81,600   15,483.90     18.98
    real/open                 300    1,271  47.9%     319,800   67,419.06     21.08

LAND SUPPLY
  circulating 384,540.54 LT · 384,361.00 staked (100.0%) · 179.54 idle
  minted      389,640.54 LT over 57 day(s) · 6,835.80 LT per day
    purse_payout    243,000.00 LT   62.4%
    card_settled     88,723.54 LT   22.8%
    buy_land         56,000.00 LT   14.4%
    gacha             1,917.00 LT    0.5%
  burned      5,100.00 LT (1.3% of issuance) — the sinks
    stud_listed       5,100.00 LT  100.0%
  valuation   at $0.01/LT (pencilled) the world has issued $3,896 of land against $12,580 of GP faucet — $0.31 of LT per $1 of GP
  runway      100B-token target reached in 10,000+ year(s) at this population's rate — scales with farms, not with time

REPLAY
  204/204 sampled fight rows rebuild exactly from their seed

STAKER POOL
  paid out 54,923.09 GP over 56 day(s) · 0.11 waiting · 384,361.00 LT staked
  land_purchase 44,800.00 · gacha 7,240.00 · breed 2,336.00 · claim_rake 547.20

CHAMPIONSHIPS
  major     14 run / 0 cancelled · field 8.6 · purse 75,732.87
            paid 59/120 entrants (49%) · biggest take 6.5% of all purse GP · smallest 195.46 GP
            entry fees 19,200.00 GP fund 25% of the purse · the rest is juice (gacha + breed fees) · net to the field 56,532.87 GP
            under the door 0/59 winners (0%) took less purse than their entry fee
  juvenile  11 run / 1 cancelled · field 10.6 · purse 28,323.12
            paid 63/117 entrants (54%) · biggest take 13.2% of all purse GP · smallest 41.73 GP
            entry fees 5,616.00 GP fund 20% of the purse · the rest is juice (gacha + breed fees) · net to the field 22,707.12 GP
            under the door 1/63 winners (2%) took less purse than their entry fee

MECHANIC ADOPTION            farms of 21
  claims placed             20  ████████████████████░
  studs listed               9  █████████░░░░░░░░░░░░
  land purchased             1  █░░░░░░░░░░░░░░░░░░░░
  paid gacha rolls          10  ██████████░░░░░░░░░░░
  gacha bundles bought       1  █░░░░░░░░░░░░░░░░░░░░
  barn expanded              0  ░░░░░░░░░░░░░░░░░░░░░  ⚠ NOBODY WALKED THROUGH
  Major entries             10  ██████████░░░░░░░░░░░
  juvenile championship     10  ██████████░░░░░░░░░░░
  ⚠ 1 door(s) unused: barn expanded

DISCOVERY
  age 1    carded 482/2054 at the true best blade (23.5% vs random 20.0%) · 49.6% on or adjacent (random 48.3%) · answer coverage 35.5% · SCOUT 355/730 right (48.6% vs random 20.0%), 69.6% on or adjacent · clear home 210/383 (54.8%, 69.7% adjacent)
  age 2–3  carded 748/2937 at the true best blade (25.5% vs random 20.0%) · 53.4% on or adjacent (random 48.8%) · answer coverage 81.4% · SCOUT 923/2391 right (38.6% vs random 20.0%), 64.5% on or adjacent · clear home 499/1148 (43.5%, 69.9% adjacent)
  age 4+   carded 332/1309 at the true best blade (25.4% vs random 20.0%) · 50.3% on or adjacent (random 47.6%) · answer coverage 69.4% · SCOUT 407/909 right (44.8% vs random 20.0%), 59.0% on or adjacent · clear home 283/494 (57.3%, 65.0% adjacent)
  explored  5/5 blades saw an age-1 entry in the discovery year
  flock shape  median home blade beats its runner-up by 9.5 pts · 48.4% of birds clear the 10-pt bar
  breeding  131 bot covers · hens carry +63.5 of their own shape (any bird: +59.0) · the sires chosen reinforce it by +43.5 (an unchosen sire: +4.5) · foals land at +60.5
  broodmare band  93.5% of 46 settled retired hens have ever carried · busiest hen 4 foals
  ✓ the scout beats chance on mature birds with a home — 57.3% vs 20.0%
  ⚠ only 48.4% of birds have a home blade worth finding — the flock is being bred flat, so there is little for discovery to discover

2 warnings · 0 invariant failures

Done → /Users/plumeria/Repos/pintakasi-bloodlines/data/sim-20260815-0137.db
Run `bun dev:sim` and open http://localhost:3435/admin — it always shows the newest sim.
```

---

## Coach session #2 — day 56 (2026-08-15)

World: `sim-20260815-0137`. Segment 2 health: 280 calls / 2 failed /
40.84 s/day (briefs grow with the world) · 0 invariant failures.

## Scoreboard at day 56

```
  rank  farm                        brain      GP         LT      net worth  crowns (GP won)
     1  Kevin Gamefarm              scripted     73,119   92,454    147,082  7 (21,724)
     2  Reno Gamefarm               scripted     74,836   51,751    116,237  6 (15,670)
     3  Lupa Land Holdings          scripted     25,386   83,174     91,925  —
     4  Kidlat sa Silangan          scripted     56,415   27,539     78,446  3 (4,261)
     5  Sabungero Syndicate         scripted     58,245   24,150     77,565  3 (4,624)
     6  Tari ng Bayan               scripted     60,218   15,821     72,875  2 (4,629)
     7  Sagupaan Stables            scripted     56,499   10,516     64,912  —
     8  Bulawan Broodfarm           scripted     53,257    8,619     60,152  —
     9  Dugo't Dangal Farms         scripted     51,037   11,193     59,991  —
    10  Sugalan Social Club         llm          46,410    3,301     49,051  —
    11  Pulang Bagwis               llm          45,535    3,951     48,696  —
    12  Cavite Bloodlines           llm          46,236    2,164     47,967  —
    13  Talisay Tari Club           llm          44,494    3,814     47,545  —
    14  Ilonggo Ironworks           llm          43,883    4,423     47,422  —
    15  Cuchillos de Sonora         llm          40,618    4,222     43,995  —
    16  Batangas Sprint Club        llm          39,619    2,624     41,718  —
    17  Bagong Laban                llm          39,674    2,331     41,538  —
    18  Hacienda Verde              llm          38,918    3,264     41,529  —
    19  Marco Gamefarm              llm          39,202    1,281     40,227  —
    20  Ginto Gaming Club           scripted        181      739        772  —

  scripted (10): total net worth 769,958 · avg 76,996 · crowns 21
  llm      (10): total net worth 449,689 · avg 44,969 · crowns 0
```

## Did session #1's orders take? Half.

**The volume order took.** Enter proposals per barn, segment 1 → segment 2:
bot-15 71→157, bot-8 44→111, bot-14 33→103, bot-16 45→102, bot-7 65→106.
Fleet total 487→874 proposals; llm fights roughly 2.5× segment 1's rate. LT
holdings tripled-to-quadrupled (417–1,085 → 1,281–4,423). Two barns ignored
the order (bot-marco 40→40, bot-17 54→52) — noted for session #3.

**The crown order could not take, and now we know why.** Zero uses of the
crown verb in 280 more calls — 560 for the experiment — despite an explicit
order. Investigation: **the morning brief contains no tournament section at
all.** No majorsThisWeek, no eligibility flag, nothing. Scripted bots read
the crown facts straight from the database (`chaseCrowns`); an outside brain
only knows what its mail says, and its mail never mentioned the Majors.

**The lesson, stated as doctrine: a coach cannot fix a fact-gap.** "Facts in
the brief, skill in the standing orders" — the crown order was skill aimed at
a missing fact. No amount of language makes a barn see a tournament its
brief doesn't carry.

## The instrument fix (applied at this boundary, in the open)

`BotView.crowns` now carries this week's Major formats and the ids of MY
birds clearing the declare bar (same facts, same indexed query as
`chaseCrowns`: active, named, hardcore age, ≥1 real win). The digest adds
`majorsThisWeek` and marks eligible fighters `crownEligible: true`; the
system prompt gains the crown rule and a GOOD-DAY line. This changes the
world every barn sees from day 57 — recorded here precisely because a
mid-experiment instrument change is a discontinuity the story must own.

## Orders: KEEP, all ten barns

Deliberate: the standing orders already demand crowns and volume. Holding
them constant while the brief gains the crown facts isolates the
instrument's effect — segment 3 measures the fix, not a new speech.

## What day 91 must show

1. First crown declarations (and ideally a first llm crown won) — if crowns
   appear now, the blindness diagnosis is confirmed by the cure.
2. The two order-ignoring barns (bot-marco, bot-17) vs their compliant
   creed-twins — the first within-creed compliance comparison.
3. Whether the net-worth gap (76,996 vs 44,969 avg) stops WIDENING — the
   compounding land base makes catching up unlikely in 35 days; the honest
   target is the second derivative.
