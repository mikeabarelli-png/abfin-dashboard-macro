"use client";

import { useEffect, useMemo, useState } from "react";

type MarketPayload = Record<string, any> | null;

export default function Page() {
  const [showVixModal, setShowVixModal] = useState(false);
  const [marketData, setMarketData] = useState<MarketPayload>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  useEffect(() => {
    let isMounted = true;

    const fetchMarketData = async () => {
      try {
        const res = await fetch("/api/market", {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const json = await res.json();

        if (!isMounted) return;
        setMarketData(json);
        setLastUpdated(new Date().toLocaleTimeString());
      } catch (err) {
        console.error("Failed to fetch live market data:", err);
      }
    };

    fetchMarketData();
    const interval = setInterval(fetchMarketData, 60000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const getNum = (...values: any[]): number | null => {
    for (const v of values) {
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (typeof v === "string") {
        const parsed = Number(String(v).replace(/,/g, ""));
        if (Number.isFinite(parsed)) return parsed;
      }
    }
    return null;
  };

  const getArr = (...values: any[]): number[] | null => {
    for (const v of values) {
      if (Array.isArray(v)) {
        const nums = v
          .map((x) => (typeof x === "number" ? x : Number(String(x).replace(/,/g, ""))))
          .filter((x) => Number.isFinite(x));
        if (nums.length > 0) return nums;
      }
    }
    return null;
  };

  const metrics = marketData?.metrics ?? marketData ?? {};

  const spxPrice = getNum(
    metrics.spx_price,
    metrics.spx,
    marketData?.spx_price,
    marketData?.spx
  ) ?? 6699.38;

  const vixValue = getNum(
    metrics.vix,
    marketData?.vix
  ) ?? 23.5;

  const spx20 = getNum(
    metrics?.spx_20dma?.level,
    metrics?.spx_20dma,
    metrics?.spx20dma,
    metrics?.dma20,
    marketData?.spx_20dma?.level,
    marketData?.spx_20dma
  ) ?? 6822.68;

  const spx50 = getNum(
    metrics?.spx_50dma?.level,
    metrics?.spx_50dma,
    metrics?.spx50dma,
    metrics?.dma50,
    marketData?.spx_50dma?.level,
    marketData?.spx_50dma
  ) ?? 6881.21;

  const spx100 = getNum(
    metrics?.spx_100dma?.level,
    metrics?.spx_100dma,
    metrics?.spx100dma,
    metrics?.dma100,
    marketData?.spx_100dma?.level,
    marketData?.spx_100dma
  ) ?? 6841.88;

  const spx200 = getNum(
    metrics?.spx_200dma?.level,
    metrics?.spx_200dma,
    metrics?.spx200dma,
    metrics?.dma200,
    marketData?.spx_200dma?.level,
    marketData?.spx_200dma
  ) ?? 6608.12;

  const spxTrend = getArr(
    metrics?.spx_trend_14d,
    metrics?.spx_14d,
    metrics?.spx_history_14d,
    marketData?.spx_trend_14d,
    marketData?.spx_14d,
    [
      6946.13, 6908.86, 6878.88, 6881.62, 6816.63, 6869.5, 6830.71, 6740.02,
      6795.99, 6781.48, 6775.8, 6672.62, 6632.19, 6699.38,
    ]
  )!;

  const spxYtd = getNum(
    metrics?.spx_ytd_pct,
    metrics?.spx_ytd,
    marketData?.spx_ytd_pct,
    marketData?.spx_ytd
  ) ?? -2.13;

  const spxDailyPct = getNum(
    metrics?.spx_change_pct,
    metrics?.spx_daily_change_pct,
    metrics?.spx_day_pct,
    marketData?.spx_change_pct,
    marketData?.spx_daily_change_pct
  ) ?? -0.6;

  const hySpread = getNum(
    metrics?.hy_spread,
    metrics?.high_yield_spread,
    marketData?.hy_spread
  ) ?? 3.28;

  const yieldCurve = getNum(
    metrics?.yield_curve_10y_2y,
    metrics?.yield_curve,
    marketData?.yield_curve_10y_2y,
    marketData?.yield_curve
  ) ?? 0.55;

  const real10y = getNum(
    metrics?.real_10y,
    metrics?.real_10yr,
    marketData?.real_10y
  ) ?? 1.92;

  const spxVs = (level: number) => ((spxPrice - level) / level) * 100;

  const fmtWhole = (n: number) => Math.round(n).toLocaleString();
  const fmt1 = (n: number) => n.toFixed(1);
  const fmt2 = (n: number) => n.toFixed(2);
  const fmtSigned1 = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
  const fmtSigned2 = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;

  const vixPercentile = 90;
  const vixContextMax = 40;
  const vixBarPos = Math.min((vixValue / vixContextMax) * 100, 100);

  const dmaState = (pct: number, isLongTerm = false) => {
    if (pct < 0) return "Broken Below";
    if (isLongTerm && pct >= 0 && pct <= 2) return "Testing Support";
    return "Holding Above";
  };

  const dmaTone = (pct: number, isLongTerm = false) => {
    if (pct < 0) return "danger";
    if (isLongTerm && pct >= 0 && pct <= 2) return "warning";
    return "healthy";
  };

  const trendTiles = useMemo(
    () => [
      {
        label: "S&P 500",
        value: fmtWhole(spxPrice),
        subline: `${spxDailyPct >= 0 ? "▲" : "▼"} ${Math.abs(spxDailyPct).toFixed(1)}% today`,
        ytd: `${spxYtd > 0 ? "+" : ""}${spxYtd.toFixed(2)}% YTD`,
        tone: spxDailyPct >= 0 ? "healthy" : "danger",
        kind: "spx",
        trend: spxTrend,
      },
      {
        label: "20-DMA",
        value: fmtWhole(spx20),
        status: dmaState(spxVs(spx20)),
        subline: `SPX ${fmtSigned1(spxVs(spx20))} ${spxVs(spx20) >= 0 ? "above" : "below"}`,
        tone: dmaTone(spxVs(spx20)),
        kind: "ma",
      },
      {
        label: "50-DMA",
        value: fmtWhole(spx50),
        status: dmaState(spxVs(spx50)),
        subline: `SPX ${fmtSigned1(spxVs(spx50))} ${spxVs(spx50) >= 0 ? "above" : "below"}`,
        tone: dmaTone(spxVs(spx50)),
        kind: "ma",
      },
      {
        label: "100-DMA",
        value: fmtWhole(spx100),
        status: dmaState(spxVs(spx100)),
        subline: `SPX ${fmtSigned1(spxVs(spx100))} ${spxVs(spx100) >= 0 ? "above" : "below"}`,
        tone: dmaTone(spxVs(spx100)),
        kind: "ma",
      },
      {
        label: "200-DMA",
        value: fmtWhole(spx200),
        status: dmaState(spxVs(spx200), true),
        subline: `SPX ${fmtSigned1(spxVs(spx200))} ${spxVs(spx200) >= 0 ? "above" : "below"}`,
        tone: dmaTone(spxVs(spx200), true),
        kind: "ma",
      },
    ],
    [spxPrice, spxDailyPct, spxYtd, spxTrend, spx20, spx50, spx100, spx200]
  );

  const stressTiles = useMemo(
    () => [
      {
        label: "VIX",
        value: fmt1(vixValue),
        subline: vixValue >= 30 ? "Stress" : vixValue >= 20 ? "Warning" : "Normal",
        scale: [0, 30, 100],
        pos: Math.min((vixValue / 100) * 100, 100),
        tone: vixValue >= 30 ? "danger" : vixValue >= 20 ? "warning" : "healthy",
      },
      {
        label: "VIX / VXV",
        value: "—",
        subline: "Awaiting feed",
        scale: [0, 1, 2],
        pos: 50,
        tone: "neutral",
      },
      {
        label: "HY Spread",
        value: `${fmt2(hySpread)}%`,
        subline: hySpread >= 4 ? "Watch" : "Firm",
        scale: [2, 4, 6],
        pos: Math.min(((hySpread - 2) / 4) * 100, 100),
        tone: hySpread >= 4 ? "warning" : "neutral",
      },
      {
        label: "DXY",
        value: "—",
        subline: "Not in v1",
        scale: [90, 105, 115],
        pos: 52,
        tone: "neutral",
      },
      {
        label: "Yield Curve",
        value: `${fmt2(yieldCurve)}%`,
        subline: yieldCurve > 0 ? "Healthy" : "Inverted",
        scale: [-1, 0, 1.5],
        pos: Math.max(0, Math.min(((yieldCurve + 1) / 2.5) * 100, 100)),
        tone: yieldCurve > 0 ? "healthy" : "warning",
      },
      {
        label: "Real 10Y",
        value: `${fmt2(real10y)}%`,
        subline: real10y >= 2 ? "Firm" : "Moderate",
        scale: [0, 2, 3],
        pos: Math.min((real10y / 3) * 100, 100),
        tone: real10y >= 2 ? "warning" : "neutral",
      },
      {
        label: "Equity Risk Premium",
        value: "—%",
        subline: "Manual / later",
        scale: [0, 1, 5],
        pos: 18,
        tone: "neutral",
      },
    ],
    [vixValue, hySpread, yieldCurve, real10y]
  );

  const damageCount = trendTiles.filter(
    (t) => t.kind === "ma" && t.status === "Broken Below"
  ).length;
  const totalMA = trendTiles.filter((t) => t.kind === "ma").length;

  const sparkline = (points: number[]) => {
    const w = 120;
    const h = 28;
    const max = Math.max(...points);
    const min = Math.min(...points);
    const range = Math.max(1, max - min);

    const coords = points
      .map((p, i) => {
        const x = (i / (points.length - 1)) * w;
        const y = h - ((p - min) / range) * h;
        return `${x},${y}`;
      })
      .join(" ");

    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 w-full">
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={coords}
          className="text-slate-300"
        />
      </svg>
    );
  };

  const badgeTone = (tone: string) => {
    if (tone === "warning") return "bg-amber-400 text-slate-950";
    if (tone === "healthy") return "bg-emerald-500 text-white";
    return "bg-rose-500 text-white";
  };

  const textTone = (tone: string) => {
    if (tone === "warning") return "text-amber-300";
    if (tone === "healthy") return "text-emerald-400";
    if (tone === "neutral") return "text-slate-300";
    return "text-rose-400";
  };

  const barTone = (tone: string) => {
    if (tone === "warning") return "bg-amber-400";
    if (tone === "healthy") return "bg-emerald-400";
    if (tone === "danger") return "bg-rose-500";
    return "bg-slate-300";
  };

  return (
    <div className="min-h-screen bg-[#0b0b2a] text-white">
      <div className="mx-auto max-w-[1500px] px-4 pb-6 pt-4">
        <div className="flex items-start justify-between gap-4 pb-4">
          <div>
            <h1 className="text-[34px] font-bold tracking-tight text-green-600">
              Prospect Market Dashboard
            </h1>
          </div>
          <div className="text-right text-xs font-semibold leading-5 text-slate-200">
            <div>Source: LIVE_YAHOO_FRED</div>
            <div>{lastUpdated ? `Refreshed ${lastUpdated}` : "Loading live feed..."}</div>
          </div>
        </div>

        <div className="mb-3 rounded-xl bg-[#1e1b4f] px-4 py-3 text-sm font-semibold text-slate-100">
          Connected
        </div>

        <section className="rounded-xl bg-[#23255a] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <div className="text-[18px] font-bold tracking-tight text-white">Market Structure</div>
              <div className="mt-1 text-[11px] font-semibold tracking-[0.03em] text-slate-300">
                Price vs Key Moving Averages
              </div>
            </div>

            <div className="text-[12px] font-semibold text-slate-300">
              {damageCount} / {totalMA} short-term trends broken
            </div>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {trendTiles.map((tile) => (
              <div key={tile.label} className="rounded-lg bg-[#050a35] p-3 shadow-inner">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="text-[13px] font-bold tracking-tight text-white">{tile.label}</div>

                  {tile.kind === "spx" && tile.ytd ? (
                    <div className="text-[11px] font-semibold text-slate-300">{tile.ytd}</div>
                  ) : tile.kind === "ma" ? (
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${badgeTone(
                        tile.tone
                      )}`}
                    >
                      !
                    </div>
                  ) : null}
                </div>

                <div className="text-[28px] font-bold leading-none tracking-tight text-white">
                  {tile.value}
                </div>

                {tile.kind === "spx" && tile.trend ? sparkline(tile.trend) : null}

                {tile.status ? (
                  <div className={`mt-2 text-[11px] font-bold uppercase tracking-[0.04em] ${textTone(tile.tone)}`}>
                    {tile.status}
                  </div>
                ) : null}

                <div
                  className={`mt-1 text-[11px] font-medium ${
                    tile.kind === "spx" ? "text-rose-200" : "text-slate-200"
                  }`}
                >
                  {tile.subline}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-amber-500/70 bg-[#5a5260] px-5 py-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-300">
              200-DMA Proximity Alert — Immediate Watch
            </div>
            <div className="mt-2 text-[17px] font-bold text-amber-50">
              S&amp;P 500 is only {fmtSigned1(spxVs(spx200)).replace("+", "")}{" "}
              {spxVs(spx200) >= 0 ? "above" : "below"} its 200-DMA ({fmtWhole(spx200)}).
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-xl bg-[#171949] p-3">
          <h2 className="mb-3 text-[18px] font-bold tracking-tight text-white">Market Stress</h2>
          <div className="grid grid-cols-5 gap-2">
            {stressTiles.map((tile) => (
              <button
                key={tile.label}
                type="button"
                onDoubleClick={() => {
                  if (tile.label === "VIX") setShowVixModal(true);
                }}
                className="rounded-lg bg-[#050a35] p-3 text-left transition hover:bg-[#09114a] focus:outline-none"
              >
                <div className="text-[13px] font-bold text-white">{tile.label}</div>
                <div className="mt-3 text-[28px] font-bold leading-none tracking-tight text-white">
                  {tile.value}
                </div>
                <div className={`mt-2 text-[11px] font-semibold ${textTone(tile.tone)}`}>
                  {tile.subline}
                </div>

                <div className="mt-3">
                  <div className="relative h-1 rounded-full bg-[#202a64]">
                    <div
                      className={`absolute left-0 top-0 h-1 rounded-full ${barTone(tile.tone)}`}
                      style={{ width: `${tile.pos}%` }}
                    />
                    <div
                      className="absolute top-1/2 h-5 w-[2px] -translate-y-1/2 bg-slate-100"
                      style={{ left: `${tile.pos}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] font-medium text-slate-200">
                    <span>{tile.scale[0]}</span>
                    <span>{tile.scale[1]}</span>
                    <span>{tile.scale[2]}</span>
                  </div>
                </div>

                {tile.label === "VIX" ? (
                  <div className="mt-2 text-[10px] font-medium text-slate-400">
                    Double-click for detail
                  </div>
                ) : null}
              </button>
            ))}
          </div>
        </section>

        {showVixModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-4xl rounded-2xl border border-slate-700 bg-[#0f153f] p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[24px] font-bold text-white">VIX Drill-Down</div>
                  <div className="mt-1 text-[12px] font-semibold text-slate-300">
                    CBOE Volatility Index — implied 30-day S&amp;P 500 volatility
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowVixModal(false)}
                  className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700"
                >
                  Close
                </button>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-[0.95fr_1.05fr]">
                <div className="rounded-xl bg-[#050a35] p-4">
                  <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Current Read
                  </div>
                  <div className="mt-3 text-[42px] font-bold leading-none text-white">{fmt1(vixValue)}</div>
                  <div className="mt-3 text-[14px] font-bold text-amber-300">
                    {vixValue >= 30 ? "Stress" : vixValue >= 20 ? "Elevated" : "Normal"}
                  </div>
                  <div className="mt-1 text-[12px] text-slate-300">
                    {vixValue >= 30 ? "High stress regime" : vixValue >= 20 ? "Elevated but not panic" : "Calm to normal"}
                  </div>

                  <div className="mt-5">
                    <div className="relative h-2 overflow-hidden rounded-full bg-[#202a64]">
                      <div className="absolute left-0 top-0 h-2 w-[37.5%] bg-emerald-600" />
                      <div className="absolute left-[37.5%] top-0 h-2 w-[12.5%] bg-emerald-400" />
                      <div className="absolute left-[50%] top-0 h-2 w-[25%] bg-amber-500" />
                      <div className="absolute left-[75%] top-0 h-2 w-[25%] bg-rose-500" />
                      <div
                        className="absolute top-1/2 h-8 w-[2px] -translate-y-1/2 bg-white"
                        style={{ left: `${vixBarPos}%` }}
                      />
                    </div>
                    <div className="mt-3 flex justify-between text-[11px] text-slate-300">
                      <span>0</span>
                      <span>15</span>
                      <span>20</span>
                      <span>30</span>
                      <span>40+</span>
                    </div>
                    <div className="mt-2 flex justify-between text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                      <span>Low</span>
                      <span>Normal</span>
                      <span>Elevated</span>
                      <span>Stress</span>
                      <span>Crisis</span>
                    </div>
                  </div>

                  <div className="mt-5 rounded-xl border border-amber-500/30 bg-[#141b47] p-4">
                    <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                      Historical Percentile
                    </div>
                    <div className="mt-2 flex items-end justify-between gap-3">
                      <div className="text-[32px] font-bold leading-none text-amber-300">
                        {vixPercentile}
                        <span className="text-[16px] align-top">th</span>
                      </div>
                      <div className="text-right text-[12px] text-slate-300">
                        since 1990
                        <br />
                        anxious, not panic
                      </div>
                    </div>
                    <div className="mt-3 relative h-3 overflow-hidden rounded-full bg-[#202a64]">
                      <div className="absolute left-0 top-0 h-3 w-[50%] bg-emerald-700" />
                      <div className="absolute left-[50%] top-0 h-3 w-[35%] bg-amber-700" />
                      <div className="absolute left-[85%] top-0 h-3 w-[15%] bg-rose-700" />
                      <div
                        className="absolute top-1/2 h-5 w-[2px] -translate-y-1/2 bg-white"
                        style={{ left: `${vixPercentile}%` }}
                      />
                    </div>
                    <div className="mt-2 flex justify-between text-[10px] font-medium text-slate-400">
                      <span>Calm</span>
                      <span>Elevated</span>
                      <span>Fear</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl bg-[#050a35] p-4">
                    <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                      What It Measures
                    </div>
                    <div className="mt-2 text-[13px] leading-6 text-slate-200">
                      The VIX (CBOE Volatility Index) measures the market&apos;s expectation of
                      30-day S&amp;P 500 volatility, derived from option pricing. When fear rises,
                      traders pay up for put protection and the VIX moves higher.
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#050a35] p-4">
                    <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                      Why It Matters
                    </div>
                    <div className="mt-2 text-[13px] leading-6 text-slate-200">
                      VIX doesn&apos;t kill a bull market, but above 30 it tells you that volatility
                      is the enemy of compounding. Drawdowns become sharper, recoveries slower, and
                      sequence risk rises sharply.
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#050a35] p-4">
                    <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                      Historical Context
                    </div>
                    <div className="mt-3 grid gap-2 text-[13px] text-slate-200">
                      <div className="grid grid-cols-[70px_1fr_1fr] gap-3 rounded-lg border border-slate-800 bg-[#0b1138] px-3 py-2">
                        <div className="font-bold text-slate-300">82.7</div>
                        <div>COVID (Mar 2020)</div>
                        <div className="text-slate-400">All-time high — flash crash, recovered in months</div>
                      </div>
                      <div className="grid grid-cols-[70px_1fr_1fr] gap-3 rounded-lg border border-slate-800 bg-[#0b1138] px-3 py-2">
                        <div className="font-bold text-slate-300">79.1</div>
                        <div>GFC (Nov 2008)</div>
                        <div className="text-slate-400">Sustained fear regime — 18 months of pain</div>
                      </div>
                      <div className="grid grid-cols-[70px_1fr_1fr] gap-3 rounded-lg border border-slate-800 bg-[#0b1138] px-3 py-2">
                        <div className="font-bold text-slate-300">38.6</div>
                        <div>Aug 2024 spike</div>
                        <div className="text-slate-400">Yen carry unwind — resolved in 2 weeks</div>
                      </div>
                      <div className="grid grid-cols-[70px_1fr_1fr] gap-3 rounded-lg border border-amber-500/40 bg-[#141b47] px-3 py-2">
                        <div className="font-bold text-amber-300">{fmt1(vixValue)}</div>
                        <div>Today</div>
                        <div className="text-slate-400">
                          {vixValue >= 30 ? "High stress / danger zone" : "Elevated but below danger zone"}
                        </div>
                      </div>
                      <div className="grid grid-cols-[70px_1fr_1fr] gap-3 rounded-lg border border-slate-800 bg-[#0b1138] px-3 py-2">
                        <div className="font-bold text-slate-300">20</div>
                        <div>Long-run avg</div>
                        <div className="text-slate-400">Mean — but median is closer to ~17</div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-500/40 bg-[#031e1a] p-4">
                    <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-amber-300">
                      Your Action
                    </div>
                    <div className="mt-2 text-[13px] leading-7 text-emerald-50">
                      {vixValue < 30
                        ? "VIX is below 30. No dividend reinvestment restriction. Continue normal plan, but do not treat the tape as calm."
                        : "VIX is above 30. Pause all-new-equity-buying and treat volatility as a real portfolio constraint."}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
