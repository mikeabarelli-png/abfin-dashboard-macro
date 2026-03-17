"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type SnapshotMetrics = {
  spx_price?: number;
  spx_20dma?: { level: number };
  spx_50dma?: { level: number };
  spx_100dma?: { level: number };
  spx_200dma?: { level: number };
  vti_price?: number;
  vti_20dma?: { level: number };
  vti_50dma?: { level: number };
  vti_100dma?: { level: number };
  vti_200dma?: { level: number };
  vix?: number | null;
  hy_spread?: number | null;
  yield_curve_10y_2y?: number | null;
  real_10y_yield?: number | null;
  dxy?: number | null;
  fci?: number | null;
  breadth_pct_above_20dma?: number | null;
  breadth_pct_above_50dma?: number | null;
  breadth_pct_above_100dma?: number | null;
  breadth_pct_above_200dma?: number | null;
  small_large?: number | null;
  financials_ratio?: number | null;
  copper_gold?: number | null;
  btc_proxy?: number | null;
  valuation_composite_sigma?: number | null;
  buffet_indicator_sigma?: number | null;
  cape_sigma?: number | null;
  price_sales_sigma?: number | null;
  mean_reversion_sigma?: number | null;
  earnings_yield_gap_sigma?: number | null;
};

type SnapshotPayload = {
  asOf?: string;
  source?: string;
  status?: string;
  metrics?: SnapshotMetrics;
  diagnostics?: string[];
};

const initialPayload: SnapshotPayload = {
  asOf: undefined,
  source: "LOADING",
  status: "Loading live data...",
  metrics: {},
  diagnostics: [],
};

const trendChartData = [
  { label: "Apr", spx: 5120, ma20: 5070, ma50: 5015, ma100: 4925, ma200: 4785 },
  { label: "May", spx: 5275, ma20: 5190, ma50: 5105, ma100: 4980, ma200: 4820 },
  { label: "Jun", spx: 5460, ma20: 5360, ma50: 5230, ma100: 5075, ma200: 4875 },
  { label: "Jul", spx: 5655, ma20: 5560, ma50: 5380, ma100: 5190, ma200: 4955 },
  { label: "Aug", spx: 5570, ma20: 5615, ma50: 5485, ma100: 5295, ma200: 5030 },
  { label: "Sep", spx: 5745, ma20: 5660, ma50: 5555, ma100: 5405, ma200: 5110 },
  { label: "Oct", spx: 5900, ma20: 5830, ma50: 5690, ma100: 5525, ma200: 5215 },
  { label: "Nov", spx: 6035, ma20: 5980, ma50: 5820, ma100: 5655, ma200: 5350 },
  { label: "Dec", spx: 6225, ma20: 6150, ma50: 5980, ma100: 5795, ma200: 5510 },
  { label: "Jan", spx: 6110, ma20: 6200, ma50: 6075, ma100: 5915, ma200: 5715 },
  { label: "Feb", spx: 6875, ma20: 6915, ma50: 6810, ma100: 6635, ma200: 6125 },
  { label: "Mar", spx: 6632, ma20: 6829.52, ma50: 6884.14, ma100: 6842.24, ma200: 6604.06 },
];

function pctFromLevel(price?: number | null, level?: number | null) {
  if (typeof price !== "number" || typeof level !== "number" || level === 0) {
    return undefined;
  }
  return Number((((price / level) - 1) * 100).toFixed(2));
}

function formatAsOf(asOf?: string) {
  if (!asOf) return "—";
  const parsed = new Date(asOf);
  if (Number.isNaN(parsed.getTime())) return asOf;
  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function shellCard(span = 1, rowSpan = 1): React.CSSProperties {
  return {
    background: "#2f325d",
    border: "1px solid rgba(255,255,255,0.03)",
    borderRadius: 8,
    padding: 10,
    boxShadow: "none",
    gridColumn: `span ${span}`,
    gridRow: `span ${rowSpan}`,
  };
}

function sectionLabelStyle(): React.CSSProperties {
  return {
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: 0,
    textTransform: "none",
    color: "#eef3ff",
  };
}

function bigNumberStyle(): React.CSSProperties {
  return {
    marginTop: 10,
    fontSize: 42,
    lineHeight: 0.95,
    fontWeight: 800,
    letterSpacing: "-0.04em",
    color: "#ffffff",
  };
}

function statusColor(status: "normal" | "watch" | "warning" | "critical") {
  if (status === "normal") return "#21c17a";
  if (status === "watch") return "#f4c84e";
  if (status === "warning") return "#ff9d2e";
  return "#ff5b6e";
}

function RangeTile({
  label,
  value,
  status,
  statusLabel,
  min,
  max,
  threshold,
  current,
  suffix,
  span = 1,
  hint,
  onClick,
}: {
  label: string;
  value: string;
  status: "normal" | "watch" | "warning" | "critical";
  statusLabel: string;
  min: number;
  max: number;
  threshold?: number;
  current?: number | null;
  suffix?: string;
  span?: number;
  hint?: string;
  onClick?: () => void;
}) {
  const percent =
    typeof current === "number"
      ? Math.max(0, Math.min(100, ((current - min) / (max - min)) * 100))
      : 0;
  const thresholdPct =
    typeof threshold === "number"
      ? Math.max(0, Math.min(100, ((threshold - min) / (max - min)) * 100))
      : null;
  const color = statusColor(status);

  return (
    <div
      onClick={onClick}
      style={{
        ...shellCard(span),
        background: "#0b0f2a",
        minHeight: 104,
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div style={sectionLabelStyle()}>{label}</div>
      <div
        style={{
          marginTop: 14,
          fontSize: 38,
          lineHeight: 0.92,
          fontWeight: 800,
          letterSpacing: "-0.05em",
          color: "#fff",
        }}
      >
        {value}
        {suffix ? (
          <span style={{ fontSize: 22, color: "#d9e1f7", marginLeft: 4 }}>{suffix}</span>
        ) : null}
      </div>
      <div style={{ marginTop: 10, color, fontSize: 13, fontWeight: 700 }}>
        {statusLabel}
      </div>
      {hint ? <div style={{ marginTop: 4, color: "#c5d0ef", fontSize: 11 }}>{hint}</div> : null}
      <div style={{ marginTop: 14, position: "relative" }}>
        <div
          style={{
            height: 5,
            borderRadius: 999,
            background: "#1a1f45",
            overflow: "hidden",
          }}
        >
          <div style={{ width: `${percent}%`, height: "100%", background: color }} />
        </div>
        {thresholdPct !== null ? (
          <div
            style={{
              position: "absolute",
              left: `${thresholdPct}%`,
              top: -4,
              width: 2,
              height: 16,
              background: "rgba(255,255,255,0.92)",
              transform: "translateX(-1px)",
              borderRadius: 2,
            }}
          />
        ) : null}
      </div>
      <div
        style={{
          position: "relative",
          marginTop: 10,
          fontSize: 11,
          color: "#c5d0ef",
          height: 14,
        }}
      >
        <span style={{ position: "absolute", left: 0 }}>{min}</span>
        {thresholdPct !== null ? (
          <span
            style={{
              position: "absolute",
              left: `${thresholdPct}%`,
              transform: "translateX(-50%)",
            }}
          >
            {threshold}
          </span>
        ) : null}
        <span style={{ position: "absolute", right: 0 }}>{max}</span>
      </div>
    </div>
  );
}

function KpiTile({
  label,
  value,
  subtitle,
  accent,
}: {
  label: string;
  value: string;
  subtitle: string;
  accent: string;
}) {
  return (
    <div style={shellCard()}>
      <div style={sectionLabelStyle()}>{label}</div>
      <div style={bigNumberStyle()}>{value}</div>
      <div style={{ marginTop: 10, color: "#d9e1f7", fontSize: 13, lineHeight: 1.35 }}>
        {subtitle}
      </div>
      <div
        style={{
          marginTop: 14,
          height: 5,
          borderRadius: 999,
          background: "rgba(255,255,255,0.06)",
          overflow: "hidden",
        }}
      >
        <div style={{ width: "62%", height: "100%", background: accent }} />
      </div>
    </div>
  );
}

function TrendPercentTile({
  label,
  pct,
  tone,
}: {
  label: string;
  pct: number | undefined;
  tone: "normal" | "watch" | "warning" | "critical";
}) {
  const color = statusColor(tone);
  const showAlert = tone === "watch" || tone === "critical";
  const alertColor = tone === "critical" ? "#ff5b6e" : "#f4c84e";

  return (
    <div
      style={{
        ...shellCard(),
        minHeight: 104,
        padding: 10,
        background: "#0b0f2a",
        position: "relative",
      }}
    >
      {showAlert ? (
        <div
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: alertColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 900,
            color: "#0b0f2a",
          }}
        >
          !
        </div>
      ) : null}
      <div style={{ fontSize: 13, fontWeight: 700, color: "#eef3ff" }}>{label}</div>
      <div
        style={{
          marginTop: 8,
          fontSize: 28,
          fontWeight: 800,
          color: "#fff",
          lineHeight: 1,
        }}
      >
        {pct === undefined ? "—" : `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`}
      </div>
      <div style={{ marginTop: 6, fontSize: 11, color, fontWeight: 700 }}>vs moving average</div>
    </div>
  );
}

function TrendPriceTile({
  label,
  price,
  change,
}: {
  label: string;
  price?: number;
  change?: number;
}) {
  const resolvedChange = change ?? 0;
  const changeColor = resolvedChange < 0 ? "#ff5b6e" : "#21c17a";
  const arrow = resolvedChange < 0 ? "▼" : "▲";

  return (
    <div style={{ ...shellCard(), minHeight: 104, padding: 10, background: "#0b0f2a" }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#eef3ff" }}>{label}</div>
      <div
        style={{
          marginTop: 8,
          fontSize: 28,
          fontWeight: 800,
          color: "#fff",
          lineHeight: 1,
        }}
      >
        {typeof price === "number"
          ? price.toLocaleString(undefined, { maximumFractionDigits: 0 })
          : "—"}
      </div>
      <div style={{ marginTop: 6, fontSize: 11, color: changeColor, fontWeight: 700 }}>
        {arrow} {Math.abs(resolvedChange).toFixed(1)}% today
      </div>
    </div>
  );
}

function TrendChartCard({ data }: { data: typeof trendChartData }) {
  return (
    <div style={shellCard(4, 2)}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 12,
        }}
      >
        <div>
          <div style={sectionLabelStyle()}>S&P Trend</div>
          <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800, color: "#fff" }}>
            S&P 500 vs Moving Averages
          </div>
          <div style={{ marginTop: 6, color: "#9cacd1" }}>1-year view · 20 / 50 / 100 / 200 DMA</div>
        </div>
      </div>
      <div style={{ width: "100%", height: 300 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 6, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              stroke="#8ea0d2"
              tick={{ fill: "#8ea0d2", fontSize: 12 }}
              axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
              tickLine={{ stroke: "rgba(255,255,255,0.08)" }}
            />
            <YAxis
              stroke="#8ea0d2"
              tick={{ fill: "#8ea0d2", fontSize: 12 }}
              axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
              tickLine={{ stroke: "rgba(255,255,255,0.08)" }}
              domain={["dataMin - 120", "dataMax + 120"]}
              width={70}
            />
            <Tooltip
              contentStyle={{
                background: "#0d1230",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                color: "#fff",
              }}
              labelStyle={{ color: "#e4ebff" }}
            />
            <Line type="monotone" dataKey="spx" name="S&P 500" stroke="#f8fbff" strokeWidth={3} dot={false} />
            <Line type="monotone" dataKey="ma20" name="20-DMA" stroke="#f4c84e" strokeWidth={1.6} dot={false} />
            <Line type="monotone" dataKey="ma50" name="50-DMA" stroke="#f59e0b" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="ma100" name="100-DMA" stroke="#9aa8c7" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="ma200" name="200-DMA" stroke="#ff5b6e" strokeWidth={3.4} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function CommentaryCard({ title, body }: { title: string; body: string }) {
  return (
    <div style={shellCard(3)}>
      <div style={sectionLabelStyle()}>{title}</div>
      <div style={{ marginTop: 14, color: "#edf3ff", fontSize: 16, lineHeight: 1.65 }}>{body}</div>
    </div>
  );
}

function BulletCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={shellCard(3)}>
      <div style={sectionLabelStyle()}>{title}</div>
      <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
        {items.map((item) => (
          <div key={item} style={{ color: "#edf3ff", lineHeight: 1.55, display: "flex", gap: 10 }}>
            <span style={{ color: "#5dd2ff" }}>•</span>
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function valuationStatus(
  sigma?: number | null,
): "normal" | "watch" | "warning" | "critical" {
  if (sigma == null) return "watch";
  if (sigma < 0.5) return "normal";
  if (sigma < 1.5) return "watch";
  if (sigma < 2) return "warning";
  return "critical";
}

function valuationLabel(sigma?: number | null) {
  if (sigma == null) return "Awaiting update";
  if (sigma < 0.5) return "Fair";
  if (sigma < 1.5) return "Elevated";
  if (sigma < 2) return "Overvalued";
  return "Strongly overvalued";
}

export default function Page() {
  const [payload, setPayload] = useState<SnapshotPayload>(initialPayload);
  const [loading, setLoading] = useState(false);
  const [drill, setDrill] = useState<
    | null
    | "vix"
    | "vixTerm"
    | "hy"
    | "dxy"
    | "yieldCurve"
    | "real10y"
    | "erp"
    | "valuationComposite"
    | "buffett"
    | "cape"
  >(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/smart-money-snapshot", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as SnapshotPayload;

      setPayload({
        asOf: data.asOf,
        source: data.source,
        status: data.status,
        metrics: data.metrics ?? {},
        diagnostics: data.diagnostics ?? [],
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Refresh failed";
      setPayload({
        asOf: new Date().toISOString(),
        source: "ERROR",
        status: `Data unavailable (${message})`,
        metrics: {},
        diagnostics: [message],
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const m = payload.metrics ?? {};
  const spot = m.spx_price;
  const p20 = pctFromLevel(spot, m.spx_20dma?.level);
  const p50 = pctFromLevel(spot, m.spx_50dma?.level);
  const p100 = pctFromLevel(spot, m.spx_100dma?.level);
  const p200 = pctFromLevel(spot, m.spx_200dma?.level);
  const vtiSpot = m.vti_price;
  const vti20 = pctFromLevel(vtiSpot, m.vti_20dma?.level);
  const vti50 = pctFromLevel(vtiSpot, m.vti_50dma?.level);
  const vti100 = pctFromLevel(vtiSpot, m.vti_100dma?.level);
  const vti200 = pctFromLevel(vtiSpot, m.vti_200dma?.level);

  const trendScore = [p20, p50, p100, p200].reduce(
    (sum, value) => sum + ((value ?? -999) > 0 ? 25 : 0),
    0,
  );

  const liquidityScore = useMemo(() => {
    let score = 50;
    if ((m.real_10y_yield ?? 99) < 1.5) score += 12;
    else if ((m.real_10y_yield ?? 0) > 2.0) score -= 12;
    if ((m.yield_curve_10y_2y ?? -99) > 0.3) score += 12;
    else if ((m.yield_curve_10y_2y ?? 0) < 0) score -= 12;
    if ((m.fci ?? 99) < -0.25) score += 16;
    else if ((m.fci ?? -99) > 0.1) score -= 16;
    return Math.max(0, Math.min(100, Math.round(score)));
  }, [m.real_10y_yield, m.yield_curve_10y_2y, m.fci]);

  const regimeScore = Math.round(
    trendScore * 0.35 +
      (m.hy_spread !== undefined && m.hy_spread !== null
        ? m.hy_spread < 3.5
          ? 100
          : m.hy_spread < 4.5
            ? 65
            : m.hy_spread < 5.5
              ? 35
              : 10
        : 50) *
        0.2 +
      (m.vix !== undefined && m.vix !== null
        ? m.vix < 18
          ? 100
          : m.vix < 25
            ? 70
            : m.vix < 30
              ? 40
              : 10
        : 50) *
        0.15 +
      liquidityScore * 0.3,
  );

  const proximityAlert = p200 !== undefined && p200 >= 0 && p200 <= 1.5;
  const vtiProximityAlert = vti200 !== undefined && vti200 >= 0 && vti200 <= 1.5;

  const crashProbability = Math.max(
    1,
    Math.min(
      60,
      Math.round(
        ((m.vix ?? 20) / 2) +
          (((m.hy_spread ?? 3) - 2.5) * 10) +
          (p200 !== undefined && p200 < 0 ? 15 : 0) +
          (liquidityScore < 40 ? 10 : 0),
      ),
    ),
  );

  const commentary = `The S&P 500 at ${
    typeof spot === "number"
      ? spot.toLocaleString(undefined, { maximumFractionDigits: 0 })
      : "—"
  } is ${
    p200 !== undefined ? `${p200.toFixed(1)}%` : "—"
  } vs its 200-DMA at ${
    typeof m.spx_200dma?.level === "number"
      ? m.spx_200dma.level.toLocaleString(undefined, { maximumFractionDigits: 0 })
      : "—"
  }. HY spreads at ${m.hy_spread?.toFixed(2) ?? "—"} and real 10Y at ${
    m.real_10y_yield?.toFixed(2) ?? "—"
  } frame the macro backdrop while VIX at ${m.vix?.toFixed(1) ?? "—"} tracks live stress.`;

  const watchItems = [
    proximityAlert
      ? `200-DMA Proximity Alert — S&P 500 is only ${p200?.toFixed(1)}% above its 200-DMA.`
      : "Trend cushion remains acceptable above the 200-DMA.",
    `VIX at ${m.vix?.toFixed(1) ?? "—"} vs 30 risk threshold.`,
    `Yield curve at ${m.yield_curve_10y_2y?.toFixed(2) ?? "—"} and real 10Y at ${
      m.real_10y_yield?.toFixed(2) ?? "—"
    }.`,
  ];

  const trendTiles = [
    {
      label: "20-DMA",
      delta: p20,
      tone:
        p20 === undefined
          ? ("watch" as const)
          : p20 < 0
            ? ("critical" as const)
            : p20 <= 1
              ? ("watch" as const)
              : ("normal" as const),
    },
    {
      label: "50-DMA",
      delta: p50,
      tone:
        p50 === undefined
          ? ("watch" as const)
          : p50 < 0
            ? ("critical" as const)
            : p50 <= 1
              ? ("watch" as const)
              : ("normal" as const),
    },
    {
      label: "100-DMA",
      delta: p100,
      tone:
        p100 === undefined
          ? ("watch" as const)
          : p100 < 0
            ? ("critical" as const)
            : p100 <= 1
              ? ("watch" as const)
              : ("normal" as const),
    },
    {
      label: "200-DMA",
      delta: p200,
      tone:
        p200 === undefined
          ? ("watch" as const)
          : p200 < 0
            ? ("critical" as const)
            : p200 <= 1.5
              ? ("watch" as const)
              : ("normal" as const),
    },
  ];

  const vtiTrendTiles = [
    {
      label: "20-DMA",
      delta: vti20,
      tone:
        vti20 === undefined
          ? ("watch" as const)
          : vti20 < 0
            ? ("critical" as const)
            : vti20 <= 1
              ? ("watch" as const)
              : ("normal" as const),
    },
    {
      label: "50-DMA",
      delta: vti50,
      tone:
        vti50 === undefined
          ? ("watch" as const)
          : vti50 < 0
            ? ("critical" as const)
            : vti50 <= 1
              ? ("watch" as const)
              : ("normal" as const),
    },
    {
      label: "100-DMA",
      delta: vti100,
      tone:
        vti100 === undefined
          ? ("watch" as const)
          : vti100 < 0
            ? ("critical" as const)
            : vti100 <= 1
              ? ("watch" as const)
              : ("normal" as const),
    },
    {
      label: "200-DMA",
      delta: vti200,
      tone:
        vti200 === undefined
          ? ("watch" as const)
          : vti200 < 0
            ? ("critical" as const)
            : vti200 <= 1.5
              ? ("watch" as const)
              : ("normal" as const),
    },
  ];

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#090b20",
        color: "white",
        padding: 18,
        fontFamily: "Inter, Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 1420,
          margin: "0 auto",
          border: "6px solid rgba(255,255,255,0.9)",
          borderRadius: 4,
          padding: 10,
          background: "#140f37",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <div style={{ color: "#0b7a37", fontSize: 28, fontWeight: 800 }}>
            Prospect Market Dashboard
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#d7def7", fontSize: 12 }}>Source: {payload.source ?? "—"}</div>
            <div style={{ color: "#d7def7", fontSize: 12 }}>
              {loading ? "Refreshing..." : formatAsOf(payload.asOf)}
            </div>
          </div>
        </div>

        <div
          style={{
            marginBottom: 10,
            padding: "10px 12px",
            borderRadius: 8,
            background: "rgba(255,255,255,0.04)",
            color: "#d7def7",
            fontSize: 13,
          }}
        >
          {payload.status ?? "—"}
        </div>

        <div
          style={{
            display: "grid",
            gap: 6,
            gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
            alignItems: "start",
          }}
        >
          <div style={{ ...shellCard(6), background: "#22264a" }}>
            <div style={{ ...sectionLabelStyle(), marginBottom: 8 }}>Trend Structure</div>
            <div style={{ display: "grid", gap: 6, gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}>
              <TrendPriceTile label="S&P 500" price={spot} change={-0.61} />
              {trendTiles.map((tile) => (
                <TrendPercentTile key={tile.label} label={tile.label} pct={tile.delta} tone={tile.tone} />
              ))}
            </div>
            {proximityAlert ? (
              <div
                style={{
                  marginTop: 14,
                  borderRadius: 14,
                  padding: "14px 16px",
                  background: "rgba(244,200,78,0.14)",
                  border: "1px solid rgba(244,200,78,0.45)",
                }}
              >
                <div
                  style={{
                    color: "#ffd86a",
                    fontSize: 12,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    fontWeight: 800,
                  }}
                >
                  200-DMA Proximity Alert — Immediate Watch
                </div>
                <div style={{ marginTop: 8, color: "#fff4c9", lineHeight: 1.5 }}>
                  S&P 500 is only {p200?.toFixed(1)}% above its 200-DMA (
                  {typeof m.spx_200dma?.level === "number"
                    ? m.spx_200dma.level.toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })
                    : "—"}
                  ).
                </div>
              </div>
            ) : null}
          </div>

          <div style={{ ...shellCard(6), background: "#22264a" }}>
            <div style={{ ...sectionLabelStyle(), marginBottom: 10 }}>Market Stress</div>
            <div style={{ display: "grid", gap: 6, gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
              <RangeTile
                onClick={() => setDrill("vix")}
                label="VIX"
                value={m.vix?.toFixed(1) ?? "—"}
                status={
                  (m.vix ?? 99) < 15
                    ? "normal"
                    : (m.vix ?? 99) < 20
                      ? "watch"
                      : (m.vix ?? 99) < 30
                        ? "warning"
                        : "critical"
                }
                statusLabel={
                  m.vix == null
                    ? "Awaiting feed"
                    : (m.vix ?? 99) < 15
                      ? "Calm volatility"
                      : (m.vix ?? 99) < 20
                        ? "Elevated"
                        : (m.vix ?? 99) < 30
                          ? "Warning"
                          : "High risk"
                }
                min={0}
                max={100}
                threshold={30}
                current={m.vix ?? null}
              />
              <RangeTile
                onClick={() => setDrill("vixTerm")}
                label="VIX / VXV"
                value="—"
                status="watch"
                statusLabel="Awaiting feed"
                min={0}
                max={2}
                threshold={1}
                current={null}
              />
              <RangeTile
                onClick={() => setDrill("hy")}
                label="HY Spread"
                value={m.hy_spread?.toFixed(2) ?? "—"}
                suffix="%"
                status={
                  (m.hy_spread ?? 99) < 3
                    ? "normal"
                    : (m.hy_spread ?? 99) < 4
                      ? "watch"
                      : (m.hy_spread ?? 99) < 5
                        ? "warning"
                        : "critical"
                }
                statusLabel={
                  m.hy_spread == null
                    ? "Awaiting feed"
                    : (m.hy_spread ?? 99) < 3
                      ? "Contained"
                      : (m.hy_spread ?? 99) < 4
                        ? "Watch"
                        : (m.hy_spread ?? 99) < 5
                          ? "Stress"
                          : "Crisis"
                }
                min={2}
                max={6}
                threshold={4}
                current={m.hy_spread ?? null}
              />
              <RangeTile
                onClick={() => setDrill("dxy")}
                label="DXY"
                value="—"
                status="watch"
                statusLabel="Not in v1"
                min={90}
                max={115}
                threshold={105}
                current={null}
              />
              <RangeTile
                onClick={() => setDrill("yieldCurve")}
                label="Yield Curve"
                value={m.yield_curve_10y_2y?.toFixed(2) ?? "—"}
                suffix="%"
                status={
                  (m.yield_curve_10y_2y ?? -99) > 0.5
                    ? "normal"
                    : (m.yield_curve_10y_2y ?? -99) > 0
                      ? "watch"
                      : (m.yield_curve_10y_2y ?? -99) > -0.5
                        ? "warning"
                        : "critical"
                }
                statusLabel={
                  m.yield_curve_10y_2y == null
                    ? "Awaiting feed"
                    : (m.yield_curve_10y_2y ?? -99) > 0.5
                      ? "Healthy"
                      : (m.yield_curve_10y_2y ?? -99) > 0
                        ? "Flattening"
                        : (m.yield_curve_10y_2y ?? -99) > -0.5
                          ? "Inverted"
                          : "Deep inversion"
                }
                min={-1}
                max={1.5}
                threshold={0}
                current={m.yield_curve_10y_2y ?? null}
              />
              <RangeTile
                onClick={() => setDrill("real10y")}
                label="Real 10Y"
                value={m.real_10y_yield?.toFixed(2) ?? "—"}
                suffix="%"
                status={
                  (m.real_10y_yield ?? 99) < 1.5
                    ? "normal"
                    : (m.real_10y_yield ?? 99) < 2
                      ? "watch"
                      : (m.real_10y_yield ?? 99) < 2.5
                        ? "warning"
                        : "critical"
                }
                statusLabel={
                  m.real_10y_yield == null
                    ? "Awaiting feed"
                    : (m.real_10y_yield ?? 99) < 1.5
                      ? "Supportive"
                      : (m.real_10y_yield ?? 99) < 2
                        ? "Firm"
                        : (m.real_10y_yield ?? 99) < 2.5
                          ? "Restrictive"
                          : "Pressure"
                }
                min={0}
                max={3}
                threshold={2}
                current={m.real_10y_yield ?? null}
              />
              <RangeTile
                onClick={() => setDrill("erp")}
                label="Equity Risk Premium"
                value="—"
                suffix="%"
                status="watch"
                statusLabel="Manual / later"
                min={0}
                max={5}
                threshold={1}
                current={null}
              />
            </div>
          </div>

          <div style={{ ...shellCard(6), background: "#22264a" }}>
            <div style={{ ...sectionLabelStyle(), marginBottom: 8 }}>VTI Trend Structure</div>
            <div style={{ display: "grid", gap: 6, gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}>
              <TrendPriceTile label="VTI" price={vtiSpot} change={-0.9} />
              {vtiTrendTiles.map((tile) => (
                <TrendPercentTile key={`vti-${tile.label}`} label={tile.label} pct={tile.delta} tone={tile.tone} />
              ))}
            </div>
            {vtiProximityAlert ? (
              <div
                style={{
                  marginTop: 14,
                  borderRadius: 14,
                  padding: "14px 16px",
                  background: "rgba(244,200,78,0.14)",
                  border: "1px solid rgba(244,200,78,0.45)",
                }}
              >
                <div
                  style={{
                    color: "#ffd86a",
                    fontSize: 12,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    fontWeight: 800,
                  }}
                >
                  VTI 200-DMA Circuit Breaker — Immediate Watch
                </div>
                <div style={{ marginTop: 8, color: "#fff4c9", lineHeight: 1.5 }}>
                  VTI is only {vti200?.toFixed(1)}% above its 200-DMA (
                  {typeof m.vti_200dma?.level === "number"
                    ? m.vti_200dma.level.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : "—"}
                  ).
                </div>
              </div>
            ) : null}
          </div>

          <div style={{ ...shellCard(6), background: "#22264a" }}>
            <div style={{ ...sectionLabelStyle(), marginBottom: 8 }}>Breadth</div>
            <div style={{ display: "grid", gap: 6, gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}>
              <RangeTile label="Above 20-DMA" value="—" suffix="%" status="watch" statusLabel="Later" min={0} max={100} threshold={40} current={null} />
              <RangeTile label="Above 50-DMA" value="—" suffix="%" status="watch" statusLabel="Later" min={0} max={100} threshold={40} current={null} />
              <RangeTile label="Above 100-DMA" value="—" suffix="%" status="watch" statusLabel="Later" min={0} max={100} threshold={40} current={null} />
              <RangeTile label="Above 200-DMA" value="—" suffix="%" status="watch" statusLabel="Later" min={0} max={100} threshold={40} current={null} />
              <RangeTile label="Hi / Lo Net" value="—" status="watch" statusLabel="Later" min={-500} max={500} threshold={0} current={null} />
              <RangeTile label="A / D Line" value="—" status="watch" statusLabel="Later" min={-2000} max={2000} threshold={0} current={null} />
            </div>
          </div>

          <div style={{ ...shellCard(6), background: "#22264a" }}>
            <div style={{ ...sectionLabelStyle(), marginBottom: 8 }}>Market Valuation (Long-Term Context)</div>
            <div style={{ display: "grid", gap: 6, gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}>
              <RangeTile
                onClick={() => setDrill("valuationComposite")}
                label="Valuation Composite"
                value={m.valuation_composite_sigma?.toFixed(2) ?? "—"}
                suffix="σ"
                status={valuationStatus(m.valuation_composite_sigma)}
                statusLabel={valuationLabel(m.valuation_composite_sigma)}
                min={0}
                max={3}
                threshold={1.5}
                current={m.valuation_composite_sigma ?? null}
              />
              <RangeTile
                onClick={() => setDrill("buffett")}
                label="Buffett Indicator"
                value={m.buffet_indicator_sigma?.toFixed(2) ?? "—"}
                suffix="σ"
                status={valuationStatus(m.buffet_indicator_sigma)}
                statusLabel={valuationLabel(m.buffet_indicator_sigma)}
                min={0}
                max={3}
                threshold={1.5}
                current={m.buffet_indicator_sigma ?? null}
              />
              <RangeTile
                onClick={() => setDrill("cape")}
                label="Shiller CAPE"
                value={m.cape_sigma?.toFixed(2) ?? "—"}
                suffix="σ"
                status={valuationStatus(m.cape_sigma)}
                statusLabel={valuationLabel(m.cape_sigma)}
                min={0}
                max={3}
                threshold={1.5}
                current={m.cape_sigma ?? null}
              />
              <RangeTile
                label="Price / Sales"
                value={m.price_sales_sigma?.toFixed(2) ?? "—"}
                suffix="σ"
                status={valuationStatus(m.price_sales_sigma)}
                statusLabel={valuationLabel(m.price_sales_sigma)}
                min={0}
                max={3}
                threshold={1.5}
                current={m.price_sales_sigma ?? null}
              />
              <RangeTile
                label="Mean Reversion"
                value={m.mean_reversion_sigma?.toFixed(2) ?? "—"}
                suffix="σ"
                status={valuationStatus(m.mean_reversion_sigma)}
                statusLabel={valuationLabel(m.mean_reversion_sigma)}
                min={0}
                max={3}
                threshold={1.5}
                current={m.mean_reversion_sigma ?? null}
              />
              <RangeTile
                label="Earnings Yield Gap"
                value={m.earnings_yield_gap_sigma?.toFixed(2) ?? "—"}
                suffix="σ"
                status={valuationStatus(m.earnings_yield_gap_sigma)}
                statusLabel={valuationLabel(m.earnings_yield_gap_sigma)}
                min={0}
                max={3}
                threshold={1.5}
                current={m.earnings_yield_gap_sigma ?? null}
              />
            </div>
          </div>

          <CommentaryCard title="CIO Commentary" body={commentary} />
          <BulletCard title="Watch List" items={watchItems} />
          <TrendChartCard data={trendChartData} />
          <KpiTile label="Regime Score" value={`${regimeScore}`} subtitle={regimeScore >= 55 ? "Neutral / Mixed backdrop" : "Caution / deterioration"} accent="#5dd2ff" />
          <KpiTile label="Trend Score" value={`${trendScore}/100`} subtitle="20 / 50 / 100 / 200 DMA stack" accent="#f59e0b" />
          <KpiTile label="Crash Probability" value={`${crashProbability}%`} subtitle="Heuristic macro stress model" accent="#ff5b6e" />
          <KpiTile label="Liquidity" value={`${liquidityScore}`} subtitle="Composite liquidity score" accent="#21c17a" />

          {payload.diagnostics && payload.diagnostics.length > 0 ? (
            <div
              style={{
                ...shellCard(6),
                background: "#1b1e3d",
                color: "#d7def7",
                fontSize: 12,
                lineHeight: 1.6,
              }}
            >
              <div style={{ ...sectionLabelStyle(), marginBottom: 8 }}>Diagnostics</div>
              {payload.diagnostics.map((d) => (
                <div key={d}>• {d}</div>
              ))}
            </div>
          ) : null}

          <div
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              justifyContent: "space-between",
              marginTop: 4,
              color: "#d7def7",
              fontSize: 13,
            }}
          >
            <div>Macro Risk Board &nbsp; Powered by Geckoboard-style UI</div>
            <div>{formatAsOf(payload.asOf)}</div>
          </div>
        </div>
      </div>

      {drill
        ? (() => {
            const panel = {
              vix: {
                index: "#6 Fear",
                title: "VIX",
                subtitle: "Market Fear & Volatility Index",
                value: m.vix?.toFixed(1) ?? "—",
                badge: m.vix == null ? "AWAITING FEED" : "ANXIOUS",
                badgeColor: m.vix == null ? "#f4c84e" : "#ff9d2e",
                redLine: "VIX > 30",
                percentile: "Live quote",
                note: "VIX is now intended to come from Yahoo in v1. If the feed fails, show unavailable rather than stale values.",
                summary: `VIX at ${m.vix?.toFixed(1) ?? "—"}.`,
                what: "The VIX measures the market's expectation of 30-day S&P 500 volatility derived from option prices.",
                why: "Above 30, volatility becomes the enemy of compounding and risk control tightens materially.",
                history: [
                  ["82.7", "COVID (Mar 2020)", "All-time high — flash crash, recovered in months"],
                  ["79.1", "GFC (Nov 2008)", "Sustained fear regime — 18 months of pain"],
                  ["38.6", "Aug 2024 spike", "Yen carry unwind — resolved in 2 weeks"],
                  [m.vix?.toFixed(1) ?? "—", "Today", "Current live reading"],
                  ["20", "Long-run avg", "Mean — median is lower"],
                ],
                action: "Below 30, normal posture. Above 30, pause new buying and confirm with credit and trend.",
              },
              vixTerm: {
                index: "#7 Vol Structure",
                title: "VIX / VXV",
                subtitle: "Near-Term vs 3-Month Volatility",
                value: "—",
                badge: "LATER",
                badgeColor: "#f4c84e",
                redLine: "Ratio > 1.0",
                percentile: "Phase 2",
                note: "Vol term structure is intentionally not in v1.",
                summary: "This widget is reserved for phase 2.",
                what: "Compares near-term to 3-month implied volatility.",
                why: "Backwardation is often a better panic signal than VIX alone.",
                history: [
                  ["<1.0", "Contango", "Normal"],
                  [">1.0", "Backwardation", "Short-term panic"],
                ],
                action: "Ignore for v1.",
              },
              hy: {
                index: "#3 Credit",
                title: "HY Spread",
                subtitle: "High Yield Credit Spread",
                value: `${m.hy_spread?.toFixed(2) ?? "—"}%`,
                badge: m.hy_spread == null ? "AWAITING FEED" : "LIVE",
                badgeColor: m.hy_spread == null ? "#f4c84e" : "#21c17a",
                redLine: "Stress > 4.0%",
                percentile: "FRED",
                note: "Credit is the foundation under equities. HY spreads often warn before stocks do.",
                summary: `HY spreads near ${m.hy_spread?.toFixed(2) ?? "—"}%.`,
                what: "Measures the extra yield junk-rated borrowers pay over Treasuries.",
                why: "Wider spreads signal tighter financial conditions and growing default concern.",
                history: [
                  ["3.0", "Contained", "Normal risk appetite"],
                  ["4.0", "Trigger", "Institutional caution"],
                  ["5.0+", "Crisis", "Credit stress"],
                ],
                action: "Below 4%, monitor. Above 4%, treat with more caution.",
              },
              dxy: {
                index: "#2 Liquidity",
                title: "DXY",
                subtitle: "Dollar Index",
                value: "—",
                badge: "NOT IN V1",
                badgeColor: "#f4c84e",
                redLine: "Later",
                percentile: "Deferred",
                note: "DXY is intentionally omitted in v1 to avoid mismatched feeds.",
                summary: "This tile is disabled in v1.",
                what: "Tracks the U.S. dollar vs a basket of currencies.",
                why: "Dollar strength can act as a liquidity headwind.",
                history: [["—", "Deferred", "Later phase"]],
                action: "Ignore for v1.",
              },
              yieldCurve: {
                index: "#4 Rates",
                title: "10Y-2Y Yield Curve",
                subtitle: "Treasury Curve Structure",
                value: `${m.yield_curve_10y_2y?.toFixed(2) ?? "—"}%`,
                badge: m.yield_curve_10y_2y == null ? "AWAITING FEED" : "LIVE",
                badgeColor: m.yield_curve_10y_2y == null ? "#f4c84e" : "#21c17a",
                redLine: "Watch inversion",
                percentile: "FRED",
                note: "The curve matters as much for trend as for level. Rapid changes can matter more than static inversion.",
                summary: `Curve at ${m.yield_curve_10y_2y?.toFixed(2) ?? "—"}%.`,
                what: "Compares 10Y Treasury yield to 2Y Treasury yield.",
                why: "Flattening and inversion are classic warning signals.",
                history: [
                  [">0.5%", "Healthy", "Normal expansion"],
                  ["0 to 0.5%", "Flattening", "Growth softening"],
                  ["<0", "Inverted", "Warning regime"],
                ],
                action: "Use as context with credit and trend.",
              },
              real10y: {
                index: "#5 Rates",
                title: "Real 10Y",
                subtitle: "Inflation-Adjusted Treasury Yield",
                value: `${m.real_10y_yield?.toFixed(2) ?? "—"}%`,
                badge: m.real_10y_yield == null ? "AWAITING FEED" : "LIVE",
                badgeColor: m.real_10y_yield == null ? "#f4c84e" : "#21c17a",
                redLine: "Pressure > 2.0%",
                percentile: "FRED",
                note: "Real yields are one of the cleanest discount-rate inputs for growth assets.",
                summary: `Real 10Y at ${m.real_10y_yield?.toFixed(2) ?? "—"}%.`,
                what: "Measures inflation-adjusted Treasury yields.",
                why: "Higher real yields pressure equity multiples.",
                history: [
                  ["<1.5%", "Supportive", "Friendly discount rate"],
                  ["1.5-2.0%", "Firm", "Mild pressure"],
                  [">2.0%", "Restrictive", "Valuation headwind"],
                ],
                action: "As real yields rise, treat valuation risk more seriously.",
              },
              erp: {
                index: "#1 Math",
                title: "Equity Risk Premium",
                subtitle: "What Stocks Pay Over Bonds",
                value: "—",
                badge: "MANUAL / LATER",
                badgeColor: "#f4c84e",
                redLine: "ERP < 1.0%",
                percentile: "Deferred",
                note: "ERP is valuable, but for v1 keep it out unless you have a trusted source.",
                summary: "Reserved for a later pass.",
                what: "Earnings yield minus 10Y Treasury yield.",
                why: "Shows whether you are being paid to own equities.",
                history: [["—", "Deferred", "Later phase"]],
                action: "Ignore for v1.",
              },
              valuationComposite: {
                index: "#8 Valuation",
                title: "Valuation Composite",
                subtitle: "Combined Long-Term Valuation Signal",
                value: `${m.valuation_composite_sigma?.toFixed(2) ?? "—"}σ`,
                badge: valuationLabel(m.valuation_composite_sigma).toUpperCase(),
                badgeColor: statusColor(valuationStatus(m.valuation_composite_sigma)),
                redLine: "Caution > 1.5σ",
                percentile: "Manual input",
                note: "Valuation is slow-moving context, not a timing signal.",
                summary: `Valuation composite at ${m.valuation_composite_sigma?.toFixed(2) ?? "—"}σ.`,
                what: "Combines several valuation frameworks into one normalized sigma score.",
                why: "Expensive markets are less forgiving when trend and liquidity crack.",
                history: [
                  ["<0.5σ", "Fair", "Normal valuation"],
                  ["0.5-1.5σ", "Elevated", "Rich but manageable"],
                  ["1.5-2.0σ", "Overvalued", "Reduced margin of safety"],
                  [">2.0σ", "Extreme", "Very stretched"],
                ],
                action: "Use as context, not as a standalone trigger.",
              },
              buffett: {
                index: "#9 Valuation",
                title: "Buffett Indicator",
                subtitle: "Market Cap to GDP",
                value: `${m.buffet_indicator_sigma?.toFixed(2) ?? "—"}σ`,
                badge: valuationLabel(m.buffet_indicator_sigma).toUpperCase(),
                badgeColor: statusColor(valuationStatus(m.buffet_indicator_sigma)),
                redLine: "Extreme > 2.0σ",
                percentile: "Manual input",
                note: "Total market value vs GDP.",
                summary: `Buffett Indicator at ${m.buffet_indicator_sigma?.toFixed(2) ?? "—"}σ.`,
                what: "Compares market cap to the size of the economy.",
                why: "Useful for long-run valuation context.",
                history: [
                  ["~0σ", "Fair", "Near historical norm"],
                  ["1.0σ", "Elevated", "Rich market"],
                  ["2.0σ+", "Extreme", "Historically stretched"],
                ],
                action: "Use as long-term context only.",
              },
              cape: {
                index: "#10 Valuation",
                title: "Shiller CAPE",
                subtitle: "Cyclically Adjusted P/E",
                value: `${m.cape_sigma?.toFixed(2) ?? "—"}σ`,
                badge: valuationLabel(m.cape_sigma).toUpperCase(),
                badgeColor: statusColor(valuationStatus(m.cape_sigma)),
                redLine: "Overvalued > 1.5σ",
                percentile: "Manual input",
                note: "CAPE smooths earnings over 10 years.",
                summary: `CAPE at ${m.cape_sigma?.toFixed(2) ?? "—"}σ.`,
                what: "Uses inflation-adjusted 10-year average earnings.",
                why: "One of the better long-term return context tools.",
                history: [
                  ["<0.5σ", "Fair", "Normal"],
                  ["0.5-1.5σ", "Elevated", "Rich"],
                  ["1.5-2.0σ", "Overvalued", "Stretched"],
                  [">2.0σ", "Extreme", "Historically expensive"],
                ],
                action: "Use as context, not timing.",
              },
            }[drill];

            return panel ? (
              <>
                <div
                  onClick={() => setDrill(null)}
                  style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(3,6,20,0.45)",
                    zIndex: 40,
                  }}
                />
                <aside
                  style={{
                    position: "fixed",
                    top: 0,
                    right: 0,
                    width: 430,
                    maxWidth: "92vw",
                    height: "100vh",
                    background: "#0b0f2a",
                    borderLeft: "1px solid rgba(255,255,255,0.08)",
                    boxShadow: "-20px 0 40px rgba(0,0,0,0.35)",
                    zIndex: 50,
                    overflowY: "auto",
                    padding: 20,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          color: "#8fa3d9",
                          fontSize: 12,
                          letterSpacing: "0.16em",
                          textTransform: "uppercase",
                        }}
                      >
                        {panel.index}
                      </div>
                      <div
                        style={{
                          marginTop: 8,
                          fontSize: 28,
                          fontWeight: 800,
                          lineHeight: 1.05,
                        }}
                      >
                        {panel.title}
                      </div>
                      <div
                        style={{
                          marginTop: 6,
                          color: "#9fb0da",
                          fontSize: 14,
                          lineHeight: 1.5,
                        }}
                      >
                        {panel.subtitle}
                      </div>
                    </div>
                    <button
                      onClick={() => setDrill(null)}
                      style={{
                        background: "transparent",
                        color: "#eef3ff",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 8,
                        padding: "8px 10px",
                        cursor: "pointer",
                      }}
                    >
                      Close
                    </button>
                  </div>

                  <div
                    style={{
                      marginTop: 18,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1 }}>{panel.value}</div>
                      <div style={{ marginTop: 6, color: panel.badgeColor, fontWeight: 800 }}>
                        {panel.badge}
                      </div>
                    </div>
                    <div
                      style={{
                        textAlign: "right",
                        color: "#c6d2f0",
                        fontSize: 13,
                        lineHeight: 1.45,
                      }}
                    >
                      <div
                        style={{
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                          color: "#8fa3d9",
                        }}
                      >
                        Red Line
                      </div>
                      <div style={{ marginTop: 4, fontWeight: 800, color: "#fff" }}>
                        {panel.redLine}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 18,
                      paddingTop: 18,
                      borderTop: "1px solid rgba(255,255,255,0.12)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          letterSpacing: "0.14em",
                          textTransform: "uppercase",
                          color: "#cdd8f7",
                        }}
                      >
                        Historical / Structural Context
                      </div>
                      <div
                        style={{
                          fontSize: 16,
                          fontWeight: 800,
                          color: panel.badgeColor,
                        }}
                      >
                        {panel.percentile}
                      </div>
                    </div>
                    <div
                      style={{
                        marginTop: 14,
                        color: "#edf3ff",
                        fontSize: 15,
                        lineHeight: 1.7,
                        fontStyle: "italic",
                      }}
                    >
                      {panel.note}
                    </div>
                    <div
                      style={{
                        marginTop: 14,
                        color: "#d7def7",
                        fontSize: 14,
                        lineHeight: 1.6,
                      }}
                    >
                      {panel.summary}
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 24,
                      paddingTop: 18,
                      borderTop: "1px solid rgba(255,255,255,0.12)",
                    }}
                  >
                    <div
                      style={{
                        color: "#6aa9ff",
                        fontSize: 12,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        marginBottom: 10,
                      }}
                    >
                      What It Measures
                    </div>
                    <div style={{ color: "#edf3ff", fontSize: 15, lineHeight: 1.8 }}>{panel.what}</div>
                  </div>

                  <div style={{ marginTop: 24 }}>
                    <div
                      style={{
                        color: "#b780ff",
                        fontSize: 12,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        marginBottom: 10,
                      }}
                    >
                      Why It Matters
                    </div>
                    <div style={{ color: "#edf3ff", fontSize: 15, lineHeight: 1.8 }}>{panel.why}</div>
                  </div>

                  <div style={{ marginTop: 24 }}>
                    <div
                      style={{
                        color: "#f4c84e",
                        fontSize: 12,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        marginBottom: 10,
                      }}
                    >
                      Historical Context
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {panel.history.map(([level, label, note]) => (
                        <div
                          key={`${level}-${label}`}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "72px 120px 1fr",
                            gap: 12,
                            alignItems: "center",
                            padding: "10px 12px",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: 8,
                            background: label === "Today" ? "rgba(255,255,255,0.05)" : "transparent",
                          }}
                        >
                          <div
                            style={{
                              color: label === "Today" ? "#f4c84e" : "#d7def7",
                              fontWeight: 800,
                              textAlign: "right",
                            }}
                          >
                            {level}
                          </div>
                          <div style={{ color: "#edf3ff" }}>{label}</div>
                          <div
                            style={{
                              color: "#9fb0da",
                              fontStyle: "italic",
                              lineHeight: 1.5,
                            }}
                          >
                            {note}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 24,
                      border: "1px solid rgba(33,193,122,0.45)",
                      background: "rgba(0,56,30,0.55)",
                      borderRadius: 10,
                      padding: 16,
                    }}
                  >
                    <div
                      style={{
                        color: "#f4c84e",
                        fontSize: 12,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        marginBottom: 10,
                      }}
                    >
                      Your Action
                    </div>
                    <div style={{ color: "#edfdf4", fontSize: 15, lineHeight: 1.8 }}>
                      {panel.action}
                    </div>
                  </div>
                </aside>
              </>
            ) : null;
          })()
        : null}
    </main>
  );
}
