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

// The drawing box. Fixed user units; the <svg> scales to whatever width the
// grid cell gives it (viewBox + preserveAspectRatio), so these are aspect
// ratio and RELATIVE type size, not pixels on anyone's screen — which is why
// the box is deliberately small. Three charts share a row, so each gets about
// 470 real pixels; at W=760 a 12-unit label would render at seven.
const W = 560;
const H = 210;
const PAD = { top: 18, right: 6, bottom: 30, left: 40 };
const AXIS_FONT = 12;

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

const full = (v: number) => Math.round(v).toLocaleString("en-US");

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

        {bars.map((v, i) =>
          v > 0 ? <rect key={`b-${i}`} x={xOf(i)} y={yBar(v)} width={barW} height={yBase - yBar(v)} fill={BAR} /> : null
        )}

        {line ? (
          <polyline
            fill="none"
            stroke={LINE}
            strokeWidth={2}
            strokeLinejoin="round"
            points={line.map((v, i) => `${xOf(i) + barW / 2},${yLine(v)}`).join(" ")}
          />
        ) : null}

        {/* THE HOVER LAYER: one invisible full-height column per day, on top
            of everything. Hovering a 3px bar is hopeless and a zero-count day
            has no bar to hover at all — the column gives every day the same
            target and reports both series at once. */}
        {days.map((d, i) => (
          <rect key={`h-${d}`} x={xOf(i)} y={y0} width={slot} height={plotH} fill="transparent">
            {/* ONE string child, not two: React treats <title> as text-only
                and warns loudly about an array of children here. */}
            <title>
              {`day ${d} — ${full(bars[i])} ${barUnit}` +
                (line ? `\n${full(line[i])} ${lineUnit ?? ""} ${lineLabel ?? "to date"}` : "")}
            </title>
          </rect>
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

/** The strip itself — three charts, laid out by the page's .charts grid. */
export function ChartStrip({ charts }: { charts: DayChartProps[] }) {
  return (
    <section className="charts">
      {charts.map((c) => (
        <DayChart key={c.title} {...c} />
      ))}
    </section>
  );
}

export const CHART_CSS = `
  .charts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .75rem;
    margin-top: 1.25rem; }
  .chart { background: #1c1914; border: 1px solid #3a342a; border-radius: 6px;
    padding: .6rem .7rem .4rem; margin: 0; min-width: 0; }
  .chart figcaption { color: #e8b64c; margin-bottom: .2rem; }
  .chart svg { display: block; width: 100%; height: auto; }
  /* The bars are the hit targets' backdrop — the transparent hover columns sit
     on top, so the cursor should say "there is something here". */
  .chart svg rect[fill="transparent"]:hover { fill: #e8e0d008; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0);
    white-space: nowrap; }
  @media (max-width: 1100px) { .charts { grid-template-columns: 1fr; } }
`;
