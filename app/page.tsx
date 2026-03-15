"use client";

import React, { useEffect, useMemo, useState } from "react";

type SnapshotMetrics = {
  spx_price?: number;
  spx_20dma?: { level: number };
  spx_50dma?: { level: number };
  spx_100dma?: { level: number };
  spx_200dma?: { level: number };
  vix?: number;
  hy_spread?: number;
  yield_curve_10y_2y?: number;
  real_10y_yield?: number;
  dxy?: number;
  fci?: number;
  breadth_pct_above_50dma?: number;
  small_large?: number;
  financials_ratio?: number;
  copper_gold?: number;
  btc_proxy?: number;
};

type SnapshotPayload = {
  asOf?: string;
  source?: string;
  status?: string;
  metrics?: SnapshotMetrics;
};

const fallback: SnapshotPayload = {
  asOf: "Fallback snapshot",
  source: "FALLBACK",
  status: "Live route not connected",
  metrics: {
    spx_price: 6795.99,
    spx_20dma: { level: 6882.79 },
    spx_50dma: { level: 6905.3 },
    spx_100dma: { level: 6835.46 },
    spx_200dma: { level: 6574.28 },
    vix: 27.2,
    hy_spread: 310,
    yield_curve_10y_2y: 0.59,
    real_10y_yield: 1.78,
    dxy: 99.7,
    fci: -0.32,
    breadth_pct_above_50dma: 48,
    small_large: -1.2,
    financials_ratio: -0.8,
    copper_gold: 0.91,
    btc_proxy: 1.38,
  },
};

function pctFromLevel(price?: number, level?: number) {
  if (typeof price !== "number" || typeof level !== "number" || level === 0) return undefined;
  return Number((((price / level) - 1) * 100).toFixed(2));
}

function cardStyle(border = "#1e293b") {
  return {
    background: "rgba(2,6,23,0.85)",
    border: `1px solid ${border}`,
    borderRadius: 16,
    padding: 20,
  } as React.CSSProperties;
}

function toneStyle(tone: "green" | "yellow" | "red" | "blue") {
  const map = {
    green: "#10b981",
    yellow: "#f59e0b",
    red: "#ef4444",
    blue: "#06b6d4",
  };
  return map[tone];
}

export default function Page() {
  const [payload, setPayload] = useState<SnapshotPayload>(fallback);
  const [loading, setLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/smart-money-snapshot", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as SnapshotPayload;
      setPayload({
        asOf: data.asOf ?? fallback.asOf,
        source: data.source ?? "LIVE",
        status: data.status ?? "Connected",
        metrics: { ...fallback.metrics, ...(data.metrics ?? {}) },
      });
      setIsLive(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Refresh failed";
      setIsLive(false);
      setPayload({ ...fallback, status: `Using fallback snapshot (${message})` });
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

  const trendScore = [p20, p50, p100, p200].reduce(
    (sum, value) => sum + ((value ?? -999) > 0 ? 25 : 0),
    0
  );

  const liquidityScore = useMemo(() => {
    let score = 50;
    if ((m.dxy ?? 999) < 100) score += 10;
    else if ((m.dxy ?? 0) > 103) score -= 10;
    if ((m.real_10y_yield ?? 99) < 1.5) score += 12;
    else if ((m.real_10y_yield ?? 0) > 2.0) score -= 12;
    if ((m.yield_curve_10y_2y ?? -99) > 0.3) score += 12;
    else if ((m.yield_curve_10y_2y ?? 0) < 0) score -= 12;
    if ((m.fci ?? 99) < -0.25) score += 16;
    else if ((m.fci ?? -99) > 0.1) score -= 16;
    return Math.max(0, Math.min(100, score));
  }, [m.dxy, m.real_10y_yield, m.yield_curve_10y_2y, m.fci]);

  const regimeScore = Math.round(
    trendScore * 0.3 +
      (m.hy_spread !== undefined ? (m.hy_spread < 350 ? 100 : m.hy_spread < 450 ? 65 : m.hy_spread < 550 ? 35 : 10) : 50) * 0.15 +
      (m.vix !== undefined ? (m.vix < 18 ? 100 : m.vix < 25 ? 70 : m.vix < 30 ? 40 : 10) : 50) * 0.1 +
      liquidityScore * 0.25 +
      ((m.breadth_pct_above_50dma ?? 50) >= 55 ? 100 : (m.breadth_pct_above_50dma ?? 50) >= 45 ? 65 : (m.breadth_pct_above_50dma ?? 50) >= 35 ? 35 : 10) * 0.1 +
      ((m.small_large ?? 0) > 0 ? 75 : 35) * 0.05 +
      ((m.financials_ratio ?? 0) > 0 ? 75 : 35) * 0.05
  );

  const regimeLabel =
    regimeScore >= 75 ? "Risk On" : regimeScore >= 55 ? "Neutral / Mixed" : regimeScore >= 35 ? "Caution" : "Risk Off";

  const crashProbability = Math.max(4, Math.min(72, Math.round((100 - regimeScore) * 0.45)));

  const commentary = [
    regimeScore >= 55 ? "Market regime is mixed to constructive." : "Market regime is cautious and requires tighter risk control.",
    trendScore >= 50 ? "Trend is partially intact." : "Multiple moving-average breaks show weakening trend structure.",
    (p200 ?? -999) >= 0
      ? "The S&P remains above the 200-day average, still the key institutional support line."
      : "The S&P is below the 200-day average, a major risk-management warning.",
    liquidityScore >= 60 ? "Liquidity conditions are generally supportive." : "Liquidity conditions are not especially supportive right now.",
  ].join(" ");

  const watchItems = [
    (p200 ?? 999) < 5 && (p200 ?? -999) > 0 ? "S&P is approaching the 200-DMA support zone." : null,
    (m.breadth_pct_above_50dma ?? 100) < 50 ? "Breadth is below 50%, so rally participation is thinning." : null,
    trendScore < 50 ? "Multiple moving-average breaks suggest weak momentum." : null,
    crashProbability > 30 ? "Cross-asset stress has risen enough to keep an eye on weekly." : null,
  ].filter(Boolean) as string[];

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #020617 0%, #000000 100%)",
        color: "white",
        padding: 24,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gap: 20 }}>
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1.2fr 0.8fr" }}>
          <div style={cardStyle()}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-end" }}>
              <div>
                <div style={{ fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", color: "#64748b" }}>
                  Smart Money Terminal
                </div>
                <h1 style={{ marginTop: 8, fontSize: 36 }}>Bloomberg-Style Macro Regime Dashboard</h1>
                <p style={{ marginTop: 8, color: "#94a3b8" }}>Weekly market dashboard with live-feed refresh.</p>
                <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span
                    style={{
                      padding: "6px 12px",
                      borderRadius: 999,
                      border: `1px solid ${isLive ? "#166534" : "#991b1b"}`,
                      background: isLive ? "#052e16" : "#450a0a",
                      color: isLive ? "#bbf7d0" : "#fecaca",
                      fontSize: 12,
                    }}
                  >
                    {isLive ? "LIVE DATA" : "FALLBACK DATA"}
                  </span>
                  <span style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid #1e293b", background: "#0f172a", fontSize: 12 }}>
                    As of: {payload.asOf}
                  </span>
                  <span style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid #1e293b", background: "#0f172a", fontSize: 12 }}>
                    Source: {payload.source}
                  </span>
                  <span style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid #1e293b", background: "#0f172a", fontSize: 12 }}>
                    Status: {payload.status}
                  </span>
                </div>
              </div>
              <button
                onClick={() => void refresh()}
                disabled={loading}
                style={{
                  borderRadius: 12,
                  border: "1px solid #334155",
                  background: "#0f172a",
                  color: "white",
                  padding: "10px 16px",
                  cursor: "pointer",
                }}
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          <div style={cardStyle()}>
            <div style={{ fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", color: "#64748b" }}>
              Composite Regime
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 12 }}>
              <div>
                <div style={{ fontSize: 56, fontWeight: 700 }}>{regimeScore}</div>
                <div style={{ color: "#94a3b8" }}>0 = defensive extreme, 100 = broad risk confirmation</div>
              </div>
              <span
                style={{
                  padding: "8px 12px",
                  borderRadius: 999,
                  border: `1px solid ${toneStyle(regimeScore >= 75 ? "green" : regimeScore >= 35 ? "yellow" : "red")}`,
                }}
              >
                {regimeLabel}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(4, 1fr)" }}>
          {[
            { title: "S&P 500", value: spot?.toLocaleString(undefined, { maximumFractionDigits: 2 }), subtitle: "Current index level", tone: "blue" as const },
            { title: "Trend Score", value: `${trendScore}/100`, subtitle: "20 / 50 / 100 / 200-day stack", tone: trendScore >= 75 ? "green" as const : trendScore >= 25 ? "yellow" as const : "red" as const },
            { title: "S&P vs 200-DMA", value: p200 !== undefined ? `${p200 > 0 ? "+" : ""}${p200}%` : "—", subtitle: "Weekly watch line in the sand", tone: (p200 ?? -999) >= 3 ? "green" as const : (p200 ?? -999) >= 0 ? "yellow" as const : "red" as const },
            { title: "Crash Probability", value: `${crashProbability}%`, subtitle: "Heuristic dashboard stress model", tone: crashProbability < 30 ? "green" as const : crashProbability < 45 ? "yellow" as const : "red" as const },
          ].map((item) => (
            <div key={item.title} style={cardStyle(toneStyle(item.tone))}>
              <div style={{ fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: "#cbd5e1" }}>{item.title}</div>
              <div style={{ marginTop: 8, fontSize: 42, fontWeight: 700 }}>{item.value}</div>
              <div style={{ marginTop: 6, color: "#cbd5e1" }}>{item.subtitle}</div>
            </div>
          ))}
        </div>

        <div style={cardStyle()}>
          <h2 style={{ marginBottom: 12 }}>CIO Market Commentary</h2>
          <div style={{ color: "#cbd5e1", lineHeight: 1.7 }}>{commentary}</div>
        </div>

        <div style={cardStyle()}>
          <h2 style={{ marginBottom: 12 }}>Key Watch Signals</h2>
          <div style={{ display: "grid", gap: 8, color: "#cbd5e1" }}>
            {watchItems.length ? watchItems.map((item) => <div key={item}>• {item}</div>) : <div>No major structural warnings detected across core market indicators.</div>}
          </div>
        </div>
      </div>
    </main>
  );
}
