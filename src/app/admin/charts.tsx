/**
 * The office's chart strip — hand-rolled inline SVG, no charting library.
 *
 * Two reasons it is hand-rolled rather than pulled off npm: every chart here
 * is a bar plus (at most) one line over a dense integer day axis, which is a
 * dozen lines of geometry; and the admin page is a SERVER component all the
 * way down (see the Bracket in page.tsx), so anything needing a client
 * runtime would drag a "use client" boundary across the top of the office.
 * Tooltips are <title> elements — the browser renders them on hover for free.
 *
 * Colors are the officeTheme palette from grids.tsx, restated here because
 * that file is an AG Grid theme object and not a stylesheet these SVGs can
 * read. Keep the two in step by eye; they are the same six values the page
 * CSS already uses.
 */

const MUTED = "#9a8f78"; // axis labels, sub-text
const GRID = "#3a342a"; // rules and the axis lines
const BAR = "#e8b64c"; // the accent — always the COUNT series
const LINE = "#7fc97f"; // the office's "money in" green — always the CUMULATIVE series

// The stacked charts' series palette (round 46). First slot is the office
// accent so a one-source stack looks exactly like an ordinary bar chart; the
// rest are picked to stay tellable-apart against the #1c1914 card and to
// stay away from LINE's green, which always means "the cumulative sum".
export const SERIES_COLORS = ["#e8b64c", "#c96f4a", "#8fb4d9", "#b08fc9", "#9a8f78"];

// The drawing box. Fixed user units; the <svg> scales to whatever width the
// grid cell gives it (viewBox + preserveAspectRatio), so these are aspect
// ratio and RELATIVE type size, not pixels on anyone's screen — which is why
// the box is deliberately small. Three charts share a row, so each gets about
// 470 real pixels; at W=760 a 12-unit label would render at seven.
const W = 560;
const H = 210;
const PAD = { top: 18, right: 6, bottom: 30, left: 40 };
const AXIS_FONT = 12;

/** A tooltip on the right 40% of the axis opens leftward, or it would clip. */
const flipTip = (i: number, count: number) => i > count * 0.6;

/** Ticks that land on 1/2/2.5/5×10ⁿ, so an axis never reads "0, 37, 74". */
function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const top = Math.ceil(max / step) * step;
  const out: number[] = [];
  // Accumulate off the index rather than by repeated addition: a 2.5-step
  // axis drifts a float a tick at a time and the top rule stops landing on
  // the frame.
  for (let i = 0; step * i <= top + step / 1e6; i++) out.push(step * i);
  return out;
}

/** 1234 → "1.2k". Axis labels have ~40px of room; six digits do not fit. */
function short(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

// Small fractional values keep one decimal — the sim-cost chart's early days
// run 0.1–2s, and a tooltip that says "0 seconds" reads as a broken chart.
// Counts and GP totals are integers or large, so every older chart is unmoved.
const full = (v: number) =>
  Number.isInteger(v) || Math.abs(v) >= 100
    ? Math.round(v).toLocaleString("en-US")
    : v.toFixed(1);

/**
 * The instant tooltip (round 46, Zane's ask). The charts used to lean on SVG
 * <title>, which is free but arrives on the BROWSER's hover-intent delay —
 * about a second of standing still before anything shows. This is a real
 * tooltip drawn in the SVG and toggled by pure CSS (`.daycol:hover .tip`), so
 * it appears the instant the pointer enters a day's column, and the page
 * stays a server component. Width is estimated from the longest line — SVG
 * has no auto-sizing box, and ~6.3 units/char at font 12 is close enough
 * that nothing clips.
 */
function InstantTip({ lines, xAnchor, flip, y }: { lines: string[]; xAnchor: number; flip: boolean; y: number }) {
  const boxW = Math.max(...lines.map((l) => l.length)) * 6.3 + 12;
  const boxH = lines.length * 14 + 8;
  const x = flip ? xAnchor - boxW - 4 : xAnchor + 4;
  return (
    <g className="tip" pointerEvents="none">
      <rect x={x} y={y} width={boxW} height={boxH} rx={3} fill="#0f0d0a" stroke="#4a4436" opacity={0.97} />
      {lines.map((l, j) => (
        <text key={j} x={x + 6} y={y + 14 + j * 14} fill="#e8e0d0" fontSize={AXIS_FONT}>
          {l}
        </text>
      ))}
    </g>
  );
}

export interface DayChartProps {
  title: string;
  /** Game day indices, ascending and contiguous — one slot per day. */
  days: number[];
  /** The bar series, index-aligned with `days`. */
  bars: number[];
  /** What one bar counts, e.g. "fights" — used on the left axis and in tooltips. */
  barUnit: string;
  /**
   * The optional right-axis series. It is a RUNNING TOTAL, so it only rises;
   * the component does not accumulate for you.
   */
  line?: number[];
  lineUnit?: string;
  /** Tooltip wording for the line, e.g. "spent on covers to date". */
  lineLabel?: string;
  note?: string;
}

/**
 * One chart: bars on the left axis, an optional cumulative line on the right.
 *
 * ⚠ A second y-scale is normally a mistake — the two series are not comparable
 * and a reader can be talked into any story by re-scaling one of them. It
 * earns its place here only because the pairing is fixed and self-evident
 * (a per-day count and the SAME events' money, rising by construction), and
 * because each axis is drawn in its own series' color so nobody has to guess
 * which line belongs to which scale.
 */
export function DayChart({
  title,
  days,
  bars,
  barUnit,
  line,
  lineUnit,
  lineLabel,
  note,
}: DayChartProps) {
  const plotW = W - PAD.left - PAD.right - (line ? 34 : 0); // the right axis needs its own gutter
  const plotH = H - PAD.top - PAD.bottom;
  const x0 = PAD.left;
  const y0 = PAD.top;
  const yBase = y0 + plotH;

  const barTicks = niceTicks(Math.max(...bars, 0));
  const barTop = barTicks[barTicks.length - 1];
  const lineTicks = line ? niceTicks(Math.max(...line, 0)) : [];
  const lineTop = line ? lineTicks[lineTicks.length - 1] : 1;

  const slot = plotW / Math.max(days.length, 1);
  // A hairline of surface between neighbouring bars, but never so much that a
  // 200-day world draws 200 slivers: at that width the bars ARE the gap.
  const gap = Math.min(2, slot * 0.3);
  const barW = Math.max(slot - gap, 0.6);
  const xOf = (i: number) => x0 + i * slot;
  const yBar = (v: number) => yBase - (v / barTop) * plotH;
  const yLine = (v: number) => yBase - (v / lineTop) * plotH;

  // ~7 day labels regardless of how long the world has run.
  const labelEvery = Math.max(1, Math.ceil(days.length / 7));

  return (
    <figure className="chart">
      <figcaption>
        {title}
        {note ? <span className="dim"> — {note}</span> : null}
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={title}>
        {/* Horizontal rules, drawn off the BAR scale — the left axis is the
            one the bars sit on, so it owns the grid; the line's own scale
            gets ticks but no rules, or the plot reads as two overlaid grids. */}
        {barTicks.map((t) => (
          <g key={`bt-${t}`}>
            <line x1={x0} x2={x0 + plotW} y1={yBar(t)} y2={yBar(t)} stroke={GRID} strokeWidth={1} />
            <text x={x0 - 6} y={yBar(t) + 3.5} textAnchor="end" fill={BAR} fontSize={AXIS_FONT}>
              {short(t)}
            </text>
          </g>
        ))}
        {line ? (
          <>
            {lineTicks.map((t) => (
              <text
                key={`lt-${t}`}
                x={x0 + plotW + 6}
                y={yLine(t) + 3.5}
                textAnchor="start"
                fill={LINE}
                fontSize={AXIS_FONT}
              >
                {short(t)}
              </text>
            ))}
            <line x1={x0 + plotW} x2={x0 + plotW} y1={y0} y2={yBase} stroke={GRID} strokeWidth={1} />
          </>
        ) : null}

        {/* The line draws BEFORE the day columns so the columns' hover layer
            sits on top of it — it is display only, never a pointer target. */}
        {line ? (
          <polyline
            fill="none"
            stroke={LINE}
            strokeWidth={2}
            strokeLinejoin="round"
            pointerEvents="none"
            points={line.map((v, i) => `${xOf(i) + barW / 2},${yLine(v)}`).join(" ")}
          />
        ) : null}

        {/* THE HOVER LAYER: one group per day — the bar, an invisible
            full-height column (hovering a 3px bar is hopeless, and a
            zero-count day has no bar at all), and the instant tooltip, all
            toggled by CSS. Grouping them is what lets :hover reach both the
            highlight and the tip with no client runtime. */}
        {days.map((d, i) => (
          <g key={`c-${d}`} className="daycol">
            {bars[i] > 0 ? (
              <rect className="bar" x={xOf(i)} y={yBar(bars[i])} width={barW} height={yBase - yBar(bars[i])} fill={BAR} />
            ) : null}
            <rect className="hcol" x={xOf(i)} y={y0} width={slot} height={plotH} fill="transparent" />
            <InstantTip
              lines={[
                `day ${d} — ${full(bars[i])} ${barUnit}`,
                ...(line ? [`${full(line[i])} ${lineUnit ?? ""} ${lineLabel ?? "to date"}`] : []),
              ]}
              xAnchor={flipTip(i, days.length) ? xOf(i) : xOf(i) + barW}
              flip={flipTip(i, days.length)}
              y={y0 + 2}
            />
          </g>
        ))}

        {/* A world can be young enough that a mechanic has simply not happened
            yet (a 20-day sim has no covers). An empty frame reads as a broken
            chart, so it says which of the two it is. */}
        {barTop <= 1 && !bars.some((v) => v > 0) ? (
          <text x={x0 + plotW / 2} y={y0 + plotH / 2} textAnchor="middle" fill={MUTED} fontSize={AXIS_FONT}>
            no {barUnit} yet
          </text>
        ) : null}

        <line x1={x0} x2={x0 + plotW} y1={yBase} y2={yBase} stroke={GRID} strokeWidth={1} />
        {days.map((d, i) =>
          i % labelEvery === 0 ? (
            <text key={`x-${d}`} x={xOf(i) + barW / 2} y={yBase + 13} textAnchor="middle" fill={MUTED} fontSize={AXIS_FONT}>
              {d}
            </text>
          ) : null
        )}
        <text x={x0 + plotW / 2} y={H - 3} textAnchor="middle" fill={MUTED} fontSize={AXIS_FONT}>
          game day
        </text>
        {/* The legend doubles as the axis units — with two scales in one frame
            the colour is the only thing saying which number belongs where. */}
        <text x={x0} y={y0 - 4} fill={BAR} fontSize={AXIS_FONT}>
          ▮ {barUnit} per day (left)
        </text>
        {line ? (
          <text x={x0 + plotW} y={y0 - 4} textAnchor="end" fill={LINE} fontSize={AXIS_FONT}>
            ▬ cumulative {lineUnit ?? ""} (right)
          </text>
        ) : null}
      </svg>
      <span className="sr-only" aria-hidden={false}>
        {`${title}: ${full(bars.reduce((s, v) => s + v, 0))} ${barUnit} over ${days.length} days`}
        {line ? `, ${full(line[line.length - 1] ?? 0)} ${lineUnit ?? ""} in total` : ""}
      </span>
    </figure>
  );
}

export interface StackedDayChartProps {
  title: string;
  /** Game day indices, ascending and contiguous — one slot per day. */
  days: number[];
  /**
   * The stacked series, each index-aligned with `days`, drawn bottom-up in
   * array order — pass them largest-total-first so the biggest source sits
   * on the axis and the slivers ride on top where they can still be seen.
   */
  series: { label: string; color: string; values: number[] }[];
  barUnit: string;
  /** Running total of the whole stack — same contract as DayChart's line. */
  line?: number[];
  lineUnit?: string;
  lineLabel?: string;
  note?: string;
}

/**
 * A stacked variant of DayChart (round 46, Zane's ask): one bar per day,
 * segmented by source, with the same optional cumulative line. It exists for
 * the two subsidy pools — "who is actually funding this?" is a question about
 * the MIX, which side-by-side charts of each source can't answer because the
 * reader has to add them in their head.
 */
export function StackedDayChart({
  title,
  days,
  series,
  barUnit,
  line,
  lineUnit,
  lineLabel,
  note,
}: StackedDayChartProps) {
  const plotW = W - PAD.left - PAD.right - (line ? 34 : 0);
  const plotH = H - PAD.top - PAD.bottom;
  const x0 = PAD.left;
  const y0 = PAD.top;
  const yBase = y0 + plotH;

  // The left axis is scaled to the day's TOTAL — the top of the stack.
  const dayTotals = days.map((_, i) => series.reduce((s, ser) => s + (ser.values[i] ?? 0), 0));
  const barTicks = niceTicks(Math.max(...dayTotals, 0));
  const barTop = barTicks[barTicks.length - 1];
  const lineTicks = line ? niceTicks(Math.max(...line, 0)) : [];
  const lineTop = line ? lineTicks[lineTicks.length - 1] : 1;

  const slot = plotW / Math.max(days.length, 1);
  const gap = Math.min(2, slot * 0.3);
  const barW = Math.max(slot - gap, 0.6);
  const xOf = (i: number) => x0 + i * slot;
  const yOf = (v: number) => yBase - (v / barTop) * plotH;
  const yLine = (v: number) => yBase - (v / lineTop) * plotH;
  const labelEvery = Math.max(1, Math.ceil(days.length / 7));

  return (
    <figure className="chart">
      <figcaption>
        {title}
        {note ? <span className="dim"> — {note}</span> : null}
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={title}>
        {barTicks.map((t) => (
          <g key={`bt-${t}`}>
            <line x1={x0} x2={x0 + plotW} y1={yOf(t)} y2={yOf(t)} stroke={GRID} strokeWidth={1} />
            <text x={x0 - 6} y={yOf(t) + 3.5} textAnchor="end" fill={MUTED} fontSize={AXIS_FONT}>
              {short(t)}
            </text>
          </g>
        ))}
        {line ? (
          <>
            {lineTicks.map((t) => (
              <text
                key={`lt-${t}`}
                x={x0 + plotW + 6}
                y={yLine(t) + 3.5}
                textAnchor="start"
                fill={LINE}
                fontSize={AXIS_FONT}
              >
                {short(t)}
              </text>
            ))}
            <line x1={x0 + plotW} x2={x0 + plotW} y1={y0} y2={yBase} stroke={GRID} strokeWidth={1} />
          </>
        ) : null}

        {line ? (
          <polyline
            fill="none"
            stroke={LINE}
            strokeWidth={2}
            strokeLinejoin="round"
            pointerEvents="none"
            points={line.map((v, i) => `${xOf(i) + barW / 2},${yLine(v)}`).join(" ")}
          />
        ) : null}

        {/* One group per day, same hover contract as DayChart: the stack's
            segments draw bottom-up (each segment's bottom is the previous
            segments' top), then the full-height hover column, then the
            instant tooltip carrying the day's whole breakdown — biggest
            source first, then the running total. */}
        {days.map((d, i) => {
          let acc = 0;
          return (
            <g key={`c-${d}`} className="daycol">
              {series.map((ser, s) => {
                const v = ser.values[i] ?? 0;
                if (v <= 0) return null;
                const yTopEdge = yOf(acc + v);
                const yBottomEdge = yOf(acc);
                acc += v;
                return (
                  <rect
                    key={`s-${s}`}
                    className="bar"
                    x={xOf(i)}
                    y={yTopEdge}
                    width={barW}
                    height={yBottomEdge - yTopEdge}
                    fill={ser.color}
                  />
                );
              })}
              <rect className="hcol" x={xOf(i)} y={y0} width={slot} height={plotH} fill="transparent" />
              <InstantTip
                lines={[
                  `day ${d} — ${full(dayTotals[i])} ${barUnit}`,
                  ...series
                    .filter((ser) => (ser.values[i] ?? 0) > 0)
                    .map((ser) => `  ${ser.label} ${full(ser.values[i])}`),
                  ...(line ? [`${full(line[i])} ${lineUnit ?? ""} ${lineLabel ?? "to date"}`] : []),
                ]}
                xAnchor={flipTip(i, days.length) ? xOf(i) : xOf(i) + barW}
                flip={flipTip(i, days.length)}
                y={y0 + 2}
              />
            </g>
          );
        })}

        {barTop <= 1 && !dayTotals.some((v) => v > 0) ? (
          <text x={x0 + plotW / 2} y={y0 + plotH / 2} textAnchor="middle" fill={MUTED} fontSize={AXIS_FONT}>
            no {barUnit} yet
          </text>
        ) : null}

        <line x1={x0} x2={x0 + plotW} y1={yBase} y2={yBase} stroke={GRID} strokeWidth={1} />
        {days.map((d, i) =>
          i % labelEvery === 0 ? (
            <text key={`x-${d}`} x={xOf(i) + barW / 2} y={yBase + 13} textAnchor="middle" fill={MUTED} fontSize={AXIS_FONT}>
              {d}
            </text>
          ) : null
        )}
        <text x={x0 + plotW / 2} y={H - 3} textAnchor="middle" fill={MUTED} fontSize={AXIS_FONT}>
          game day
        </text>
        {/* The legend is the series key — with a stack, color is the only
            thing saying which layer is which. */}
        <text x={x0} y={y0 - 4} fontSize={AXIS_FONT}>
          {series.map((ser, s) => (
            <tspan key={ser.label} fill={ser.color} dx={s === 0 ? 0 : 10}>
              ▮ {ser.label}
            </tspan>
          ))}
        </text>
        {line ? (
          <text x={x0 + plotW} y={y0 - 4} textAnchor="end" fill={LINE} fontSize={AXIS_FONT}>
            ▬ cumulative {lineUnit ?? ""} (right)
          </text>
        ) : null}
      </svg>
      <span className="sr-only" aria-hidden={false}>
        {`${title}: ${full(dayTotals.reduce((s, v) => s + v, 0))} ${barUnit} over ${days.length} days, ` +
          series.map((ser) => `${ser.label} ${full(ser.values.reduce((s, v) => s + v, 0))}`).join(", ")}
      </span>
    </figure>
  );
}

/** The strip itself — the page's trend charts, laid out by the .charts grid. */
export function ChartStrip({ charts }: { charts: (DayChartProps | StackedDayChartProps)[] }) {
  return (
    <section className="charts">
      {charts.map((c) =>
        "series" in c ? <StackedDayChart key={c.title} {...c} /> : <DayChart key={c.title} {...c} />
      )}
    </section>
  );
}

export const CHART_CSS = `
  /* Two per row since round 43 (Zane's ask) — the strip lives in its own tab
     now, so each chart can afford half the page instead of a third, and four
     charts pack a clean 2×2 instead of 3+1. Thin screens stack to one. */
  .charts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .75rem;
    margin-top: 1.25rem; }
  .chart { background: #1c1914; border: 1px solid #3a342a; border-radius: 6px;
    padding: .6rem .7rem .4rem; margin: 0; min-width: 0; }
  .chart figcaption { color: #e8b64c; margin-bottom: .2rem; }
  .chart svg { display: block; width: 100%; height: auto; }
  /* THE HOVER CONTRACT (round 46 — instant, no transitions, no client JS):
     entering a day's column immediately washes the column, brightens that
     day's bar(s), and shows the SVG tooltip. Everything is a plain CSS
     toggle — a transition here would re-add the latency the round removed. */
  .chart svg g.daycol .tip { visibility: hidden; }
  .chart svg g.daycol:hover .tip { visibility: visible; }
  .chart svg g.daycol:hover rect.hcol { fill: #e8e0d012; }
  .chart svg g.daycol:hover rect.bar { filter: brightness(1.35); }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0);
    white-space: nowrap; }
  @media (max-width: 1100px) { .charts { grid-template-columns: 1fr; } }
`;
