"use client";

import { useEffect, useMemo, useState } from "react";

type AnyObj = Record<string, any>;

export default function Page() {
  const [showVixModal, setShowVixModal] = useState(false);
  const [marketData, setMarketData] = useState<AnyObj | null>(null);
  const [lastUpdated, setLastUpdated] = useState("");
  const [feedError, setFeedError] = useState("");

  useEffect(() => {
    let mounted = true;

    const fetchMarket = async () => {
      try {
        const res = await fetch(`/api/market?ts=${Date.now()}`, {
          cache: "no-store",
        });

        const text = await res.text();

        let json: AnyObj;
        try {
          json = JSON.parse(text);
        } catch {
          throw new Error(`API returned non-JSON: ${text.slice(0, 120)}`);
        }

        if (!mounted) return;

        if (!res.ok || json?.ok === false) {
          setFeedError(json?.detail || json?.error || `HTTP ${res.status}`);
          return;
        }

        setMarketData(json);
        setFeedError("");
        setLastUpdated(new Date().toLocaleTimeString());
      } catch (err: any) {
        if (!mounted) return;
        setFeedError(err?.message || "Unknown fetch error");
      }
    };

    fetchMarket();
    const id = setInterval(fetchMarket, 60000);

    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  const metrics = marketData?.metrics ?? marketData ?? {};

  const getNum = (...vals: any[]): number | null => {
    for (const v of vals) {
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (typeof v === "string") {
        const n = Number(v.replace(/,/g, ""));
        if (Number.isFinite(n)) return n;
      }
    }
    return null;
  };

  const getArr = (...vals: any[]): number[] | null => {
    for (const v of vals) {
      if (Array.isArray(v)) {
        const arr = v
          .map((x) => (typeof x === "number" ? x : Number(String(x).replace(/,/g, ""))))
          .filter((x) => Number.isFinite(x));
        if (arr.length) return arr;
      }
    }
    return null;
  };

  const spxPrice = getNum(
    metrics.spx_price,
    metrics.spx,
    marketData?.spx_price,
    marketData?.spx
  );

  const vixValue = getNum(metrics.vix, marketData?.vix);

  const spx20 =
    getNum(
      metrics?.spx_20dma?.level,
      metrics?.spx_20dma,
      metrics?.dma20,
      marketData?.spx_20dma?.level,
      marketData?.spx_20dma
    ) ?? 6822.68;

  const spx50 =
    getNum(
      metrics?.spx_50dma?.level,
      metrics?.spx_50dma,
      metrics?.dma50,
      marketData?.spx_50dma?.level,
      marketData?.spx_50dma
    ) ?? 6881.21;

  const spx100 =
    getNum(
      metrics?.spx_100dma?.level,
      metrics?.spx_100dma,
      metrics?.dma100,
      marketData?.spx_100dma?.level,
      marketData?.spx_100dma
    ) ?? 6841.88;

  const spx200 =
    getNum(
      metrics?.spx_200dma?.level,
      metrics?.spx_200dma,
      metrics?.dma200,
      marketData?.spx_200dma?.level,
      marketData?.spx_200dma
    ) ?? 6608.12;

  const spxDailyPct = getNum(
    metrics?.spx_change_pct,
    metrics?.spx_daily_change_pct,
    metrics?.spx_day_pct,
    marketData?.spx_change_pct
  );

  const spxYtd =
    getNum(
      metrics?.spx_ytd_pct,
      metrics?.spx_ytd,
      marketData?.spx_ytd_pct
    ) ?? -2.13;

  const spxTrend =
    getArr(
      metrics?.spx_trend_14d,
      metrics?.spx_14d,
      metrics?.spx_history_14d,
      marketData?.spx_trend_14d,
      marketData?.spx_14d
    ) ?? [
      6946.13, 6908.86, 6878.88, 6881.62, 6816.63, 6869.5, 6830.71, 6740.02,
      6795.99, 6781.48, 6775.8, 6672.62, 6632.19, 6699.38,
    ];

  const hySpread =
    getNum(
      metrics?.hy_spread,
      metrics?.high_yield_spread,
      marketData?.hy_spread
    ) ?? 3.28;

  const yieldCurve =
    getNum(
      metrics?.yield_curve_10y_2y,
      metrics?.yield_curve,
      marketData?.yield_curve_10y_2y
    ) ?? 0.55;

  const real10y =
    getNum(
      metrics?.real_10y,
      metrics?.real_10yr,
      marketData?.real_10y
    ) ?? 1.92;

  const fmtWhole = (n: number) => Math.round(n).toLocaleString();
  const fmt1 = (n: number) => n.toFixed(1);
  const fmt2 = (n: number) => n.toFixed(2);
  const fmtSigned1 = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;

  const spxVs = (level: number) =>
    spxPrice == null ? null : ((spxPrice - level) / level) * 100;

  const dmaState = (pct: number | null, isLong = false) => {
    if (pct == null) return "Loading";
    if (pct < 0) return "Broken Below";
    if (isLong && pct <= 2) return "Testing Support";
    return "Holding Above";
  };

  const dmaTone = (pct: number | null, isLong = false) => {
    if (pct == null) return "neutral";
    if (pct < 0) return "danger";
    if (isLong && pct <= 2) return "warning";
    return "healthy";
  };

  const trendTiles = useMemo(
    () => [
      {
        label: "S&P 500",
        value: spxPrice != null ? fmtWhole(spxPrice) : "—",
        subline:
          spxDailyPct != null
            ? `${spxDailyPct >= 0 ? "▲" : "▼"} ${Math.abs(spxDailyPct).toFixed(1)}% today`
            : "Waiting for live price",
        ytd: `${spxYtd > 0 ? "+" : ""}${spxYtd.toFixed(2)}% YTD`,
        tone: spxDailyPct != null ? (spxDailyPct >= 0 ? "healthy" : "danger") : "neutral",
        kind: "spx",
        trend: spxTrend,
      },
      {
        label: "20-DMA",
        value: fmtWhole(spx20),
        status: dmaState(spxVs(spx20)),
        subline:
          spxVs(spx20) != null
            ? `SPX ${fmtSigned1(spxVs(spx20)!)} ${spxVs(spx20)! >= 0 ? "above" : "below"}`
            : "Waiting for live price",
        tone: dmaTone(spxVs(spx20)),
        kind: "ma",
      },
      {
        label: "50-DMA",
        value: fmtWhole(spx50),
        status: dmaState(spxVs(spx50)),
        subline:
          spxVs(spx50) != null
            ? `SPX ${fmtSigned1(spxVs(spx50)!)} ${spxVs(spx50)! >= 0 ? "above" : "below"}`
            : "Waiting for live price",
        tone: dmaTone(spxVs(spx50)),
        kind: "ma",
      },
      {
        label: "100-DMA",
        value: fmtWhole(spx100),
        status: dmaState(spxVs(spx100)),
        subline:
          spxVs(spx100) != null
            ? `SPX ${fmtSigned1(spxVs(spx100)!)} ${spxVs(spx100)! >= 0 ? "above" : "below"}`
            : "Waiting for live price",
        tone: dmaTone(spxVs(spx100)),
        kind: "ma",
      },
      {
        label: "200-DMA",
        value: fmtWhole(spx200),
        status: dmaState(spxVs(spx200), true),
        subline:
          spxVs(spx200) != null
            ? `SPX ${fmtSigned1(spxVs(spx200)!)} ${spxVs(spx200)! >= 0 ? "above" : "below"}`
            : "Waiting for live price",
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
        value: vixValue != null ? fmt1(vixValue) : "—",
        subline:
          vixValue == null ? "Awaiting feed" : vixValue >= 30 ? "Stress" : vixValue >= 20 ? "Warning" : "Normal",
        scale: [0, 30, 100],
        pos: vixValue != null ? Math.min((vixValue / 100) * 100, 100) : 0,
        tone: vixValue == null ? "neutral" : vixValue >= 30 ? "danger" : vixValue >= 20 ? "warning" : "healthy",
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
        pos: Math.max(0, Math.min(((hySpread - 2) / 4) * 100, 100)),
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
        pos: Math.max(0, Math.min((real10y / 3) * 100, 100)),
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

  const damageCount = trendTiles.filter((t) => t.kind === "ma" && t.status === "Broken Below").length;
  const totalMA = trendTiles.filter((t) => t.kind === "ma").length;

  const vixPercentile = 90;
  const vixContextMax = 40;
  const vixBarPos = Math.min(((vixValue ?? 0) / vixContextMax) * 100, 100);

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

    return `
      <svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
        <polyline
          fill="none"
          stroke="#cbd5e1"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          points="${coords}"
        />
      </svg>
    `;
  };

  const badgeClass = (tone: string) => {
    if (tone === "warning") return "badge badge-warning";
    if (tone === "healthy") return "badge badge-healthy";
    if (tone === "neutral") return "badge badge-neutral";
    return "badge badge-danger";
  };

  const statusClass = (tone: string) => {
    if (tone === "warning") return "status status-warning";
    if (tone === "healthy") return "status status-healthy";
    if (tone === "neutral") return "status status-neutral";
    return "status status-danger";
  };

  const meterFillClass = (tone: string) => {
    if (tone === "warning") return "meterFill meterFill-warning";
    if (tone === "healthy") return "meterFill meterFill-healthy";
    if (tone === "danger") return "meterFill meterFill-danger";
    return "meterFill meterFill-neutral";
  };

  return (
    <>
      <div className="pageShell">
        <div className="frame">
          <div className="topBar">
            <h1 className="title">Prospect Market Dashboard</h1>
            <div className="meta">
              <div>Source: LIVE_YAHOO_FRED</div>
              <div>
                {feedError
                  ? "Live feed error"
                  : lastUpdated
                  ? `Refreshed ${lastUpdated}`
                  : "Loading live feed..."}
              </div>
            </div>
          </div>

          {feedError ? <div className="errorBar">Live feed error: {feedError}</div> : null}

          <div className="connected">Connected</div>

          <section className="panel">
            <div className="panelHeader">
              <div>
                <div className="panelTitle">Market Structure</div>
                <div className="panelSub">Price vs Key Moving Averages</div>
              </div>
              <div className="damage">
                {damageCount} / {totalMA} short-term trends broken
              </div>
            </div>

            <div className="trendGrid">
              {trendTiles.map((tile) => (
                <div key={tile.label} className="tile">
                  <div className="tileTop">
                    <div className="label">{tile.label}</div>
                    {tile.kind === "spx" ? (
                      <div className="ytd">{tile.ytd}</div>
                    ) : (
                      <div className={badgeClass(tile.tone)}>!</div>
                    )}
                  </div>

                  <div className="value">{tile.value}</div>

                  {tile.kind === "spx" ? (
                    <div
                      className="sparkWrap"
                      dangerouslySetInnerHTML={{ __html: sparkline(tile.trend) }}
                    />
                  ) : null}

                  {tile.status ? <div className={statusClass(tile.tone)}>{tile.status}</div> : null}

                  <div className={tile.kind === "spx" ? "sub subSpx" : "sub"}>
                    {tile.subline}
                  </div>
                </div>
              ))}
            </div>

            <div className="alertBox">
              <div className="alertTitle">200-DMA Proximity Alert — Immediate Watch</div>
              <div className="alertBody">
                {spxPrice == null
                  ? "Waiting for live S&P 500 price..."
                  : `S&P 500 is only ${Math.abs(((spxPrice - spx200) / spx200) * 100).toFixed(1)}% ${
                      spxPrice >= spx200 ? "above" : "below"
                    } its 200-DMA (${fmtWhole(spx200)}).`}
              </div>
            </div>
          </section>

          <section className="panel panelStress">
            <div className="panelTitle">Market Stress</div>

            <div className="stressGrid">
              {stressTiles.map((tile) => (
                <button
                  key={tile.label}
                  type="button"
                  onDoubleClick={() => {
                    if (tile.label === "VIX") setShowVixModal(true);
                  }}
                  className="tile tileButton"
                >
                  <div className="label">{tile.label}</div>
                  <div className="value stressValue">{tile.value}</div>
                  <div className={statusClass(tile.tone)} style={{ marginTop: 10 }}>
                    {tile.subline}
                  </div>

                  <div className="meterWrap">
                    <div className="meterTrack">
                      <div className={meterFillClass(tile.tone)} style={{ width: `${tile.pos}%` }} />
                      <div className="meterMarker" style={{ left: `${tile.pos}%` }} />
                    </div>
                    <div className="meterScale">
                      <span>{tile.scale[0]}</span>
                      <span>{tile.scale[1]}</span>
                      <span>{tile.scale[2]}</span>
                    </div>
                  </div>

                  {tile.label === "VIX" ? <div className="hint">Double-click for detail</div> : null}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>

      {showVixModal ? (
        <div className="modalBackdrop">
          <div className="modal">
            <div className="modalTop">
              <div>
                <div className="modalTitle">VIX Drill-Down</div>
                <div className="modalSub">CBOE Volatility Index — implied 30-day S&amp;P 500 volatility</div>
              </div>
              <button className="closeBtn" onClick={() => setShowVixModal(false)}>
                Close
              </button>
            </div>

            <div className="modalGrid">
              <div className="modalCard">
                <div className="smallHead">Current Read</div>
                <div className="bigValue">{vixValue != null ? fmt1(vixValue) : "—"}</div>
                <div className="status status-warning">
                  {vixValue == null ? "Awaiting feed" : vixValue >= 30 ? "Stress" : vixValue >= 20 ? "Elevated" : "Normal"}
                </div>
                <div className="bodyCopy">
                  {vixValue == null
                    ? "No live VIX value available."
                    : vixValue >= 30
                    ? "High stress regime"
                    : vixValue >= 20
                    ? "Elevated but not panic"
                    : "Calm to normal"}
                </div>

                <div className="vixBandWrap">
                  <div className="vixBandTrack">
                    <div className="seg seg1" />
                    <div className="seg seg2" />
                    <div className="seg seg3" />
                    <div className="seg seg4" />
                    <div className="vixMarker" style={{ left: `${vixBarPos}%` }} />
                  </div>
                  <div className="vixScale">
                    <span>0</span>
                    <span>15</span>
                    <span>20</span>
                    <span>30</span>
                    <span>40+</span>
                  </div>
                  <div className="vixBands">
                    <span>Low</span>
                    <span>Normal</span>
                    <span>Elevated</span>
                    <span>Stress</span>
                    <span>Crisis</span>
                  </div>
                </div>

                <div className="percentileBox">
                  <div className="smallHead">Historical Percentile</div>
                  <div className="percentileRow">
                    <div className="percentileValue">
                      {vixPercentile}
                      <span>th</span>
                    </div>
                    <div className="bodyCopy bodyCopyRight">since 1990<br />anxious, not panic</div>
                  </div>
                  <div className="percentileTrack">
                    <div className="pseg p1" />
                    <div className="pseg p2" />
                    <div className="pseg p3" />
                    <div className="pMarker" style={{ left: `${vixPercentile}%` }} />
                  </div>
                  <div className="percentileBands">
                    <span>Calm</span>
                    <span>Elevated</span>
                    <span>Fear</span>
                  </div>
                </div>
              </div>

              <div className="modalStack">
                <div className="modalCard">
                  <div className="smallHead">What It Measures</div>
                  <div className="bodyCopy">
                    The VIX measures the market&apos;s expectation of 30-day S&amp;P 500 volatility,
                    derived from option pricing. When fear rises, traders pay up for protection
                    and the VIX moves higher.
                  </div>
                </div>

                <div className="modalCard">
                  <div className="smallHead">Why It Matters</div>
                  <div className="bodyCopy">
                    Above 30 is where volatility starts to become the enemy of compounding.
                    Drawdowns get sharper, recoveries slower, and sequence risk rises.
                    Below 30 is caution; above 30 is where you pause all-new-equity-buying.
                  </div>
                </div>

                <div className="modalCard">
                  <div className="smallHead">Historical Context</div>
                  <div className="historyList">
                    <div className="historyRow">
                      <div className="historyNum">82.7</div>
                      <div>COVID (Mar 2020)</div>
                      <div className="historyNote">All-time high — flash crash, recovered in months</div>
                    </div>
                    <div className="historyRow">
                      <div className="historyNum">79.1</div>
                      <div>GFC (Nov 2008)</div>
                      <div className="historyNote">Sustained fear regime — 18 months of pain</div>
                    </div>
                    <div className="historyRow">
                      <div className="historyNum">38.6</div>
                      <div>Aug 2024 spike</div>
                      <div className="historyNote">Yen carry unwind — resolved in 2 weeks</div>
                    </div>
                    <div className="historyRow historyRowActive">
                      <div className="historyNum historyNumActive">{vixValue != null ? fmt1(vixValue) : "—"}</div>
                      <div>Today</div>
                      <div className="historyNote">
                        {vixValue != null && vixValue >= 30 ? "High stress / danger zone" : "Elevated but below danger zone"}
                      </div>
                    </div>
                    <div className="historyRow">
                      <div className="historyNum">20</div>
                      <div>Long-run avg</div>
                      <div className="historyNote">Mean — but median is closer to ~17</div>
                    </div>
                  </div>
                </div>

                <div className="actionCard">
                  <div className="smallHead actionHead">Your Action</div>
                  <div className="bodyCopy actionCopy">
                    {vixValue != null && vixValue < 30
                      ? "VIX is below 30. No dividend reinvestment restriction. Continue normal plan, but do not treat the tape as calm."
                      : "VIX is above 30. Pause all-new-equity-buying and treat volatility as a real portfolio constraint."}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <style
        dangerouslySetInnerHTML={{
          __html: `
            * { box-sizing: border-box; }
            html, body {
              margin: 0;
              padding: 0;
              background: #0b0b2a;
              color: #fff;
              font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            }

            .pageShell { min-height: 100vh; background: #0b0b2a; }
            .frame { max-width: 1500px; margin: 0 auto; padding: 16px; }

            .topBar {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 16px;
              margin-bottom: 12px;
            }

            .title {
              margin: 0;
              font-size: 34px;
              font-weight: 700;
              line-height: 1;
              color: #16c75c;
              letter-spacing: -0.03em;
            }

            .meta {
              text-align: right;
              font-size: 12px;
              font-weight: 600;
              line-height: 1.35;
              color: #e2e8f0;
            }

            .errorBar {
              margin-bottom: 12px;
              border: 1px solid rgba(255, 79, 114, 0.5);
              background: rgba(127, 29, 29, 0.45);
              color: #fecdd3;
              border-radius: 12px;
              padding: 10px 14px;
              font-size: 12px;
              font-weight: 600;
            }

            .connected {
              background: #1e1b4f;
              padding: 10px 14px;
              border-radius: 14px;
              font-size: 13px;
              font-weight: 600;
              color: #f8fafc;
              margin-bottom: 12px;
            }

            .panel {
              background: #23255a;
              border-radius: 16px;
              padding: 12px;
            }

            .panelStress {
              margin-top: 16px;
              background: #171949;
            }

            .panelHeader {
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              gap: 12px;
              margin-bottom: 10px;
            }

            .panelTitle {
              font-size: 18px;
              font-weight: 700;
              line-height: 1.1;
            }

            .panelSub {
              margin-top: 2px;
              font-size: 11px;
              font-weight: 600;
              color: #cbd5e1;
              letter-spacing: 0.03em;
            }

            .damage {
              font-size: 12px;
              font-weight: 600;
              color: #cbd5e1;
              white-space: nowrap;
            }

            .trendGrid,
            .stressGrid {
              display: grid;
              grid-template-columns: repeat(5, minmax(0, 1fr));
              gap: 8px;
            }

            .stressGrid { margin-top: 10px; }

            .tile {
              background: #050a35;
              border-radius: 10px;
              padding: 12px;
              min-width: 0;
              border: 0;
            }

            .tileButton {
              cursor: default;
              color: inherit;
              font: inherit;
            }

            .tileTop {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 8px;
              margin-bottom: 8px;
            }

            .label {
              font-size: 13px;
              font-weight: 700;
              line-height: 1.1;
              color: #fff;
            }

            .ytd {
              font-size: 11px;
              font-weight: 600;
              color: #94a3b8;
              white-space: nowrap;
            }

            .value {
              font-size: 28px;
              font-weight: 700;
              line-height: 0.95;
              letter-spacing: -0.03em;
              color: #fff;
            }

            .stressValue { margin-top: 10px; }

            .sparkWrap {
              margin-top: 6px;
              height: 30px;
              width: 120px;
              display: flex;
              align-items: center;
            }

            .sub {
              margin-top: 4px;
              font-size: 11px;
              font-weight: 500;
              color: #dbe4f0;
            }

            .subSpx {
              color: #f8d7df;
              font-weight: 600;
            }

            .status {
              margin-top: 8px;
              font-size: 11px;
              font-weight: 700;
              letter-spacing: 0.04em;
              text-transform: uppercase;
            }

            .status-danger { color: #ff6b88; }
            .status-warning { color: #f7df5e; }
            .status-healthy { color: #37e184; }
            .status-neutral { color: #cbd5e1; }

            .badge {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: 20px;
              height: 20px;
              border-radius: 9999px;
              font-size: 11px;
              font-weight: 700;
              line-height: 1;
              flex-shrink: 0;
            }

            .badge-danger { background: #ff4f72; color: #fff; }
            .badge-warning { background: #f6bf34; color: #111827; }
            .badge-healthy { background: #22c55e; color: #fff; }
            .badge-neutral { background: #64748b; color: #fff; }

            .alertBox {
              margin-top: 14px;
              border-radius: 18px;
              border: 1px solid rgba(245, 158, 11, 0.8);
              background: #5a5260;
              padding: 14px 18px;
            }

            .alertTitle {
              font-size: 11px;
              font-weight: 700;
              letter-spacing: 0.16em;
              text-transform: uppercase;
              color: #f7df5e;
            }

            .alertBody {
              margin-top: 8px;
              font-size: 17px;
              font-weight: 700;
              color: #fff8dc;
            }

            .meterWrap { margin-top: 12px; }

            .meterTrack {
              position: relative;
              height: 4px;
              border-radius: 9999px;
              background: #202a64;
            }

            .meterFill {
              position: absolute;
              left: 0;
              top: 0;
              height: 4px;
              border-radius: 9999px;
            }

            .meterFill-warning { background: #f6bf34; }
            .meterFill-healthy { background: #37e184; }
            .meterFill-danger { background: #ff4f72; }
            .meterFill-neutral { background: #cbd5e1; }

            .meterMarker {
              position: absolute;
              top: 50%;
              width: 2px;
              height: 18px;
              transform: translateY(-50%);
              background: #f8fafc;
            }

            .meterScale {
              margin-top: 8px;
              display: flex;
              justify-content: space-between;
              font-size: 11px;
              font-weight: 500;
              color: #dbe4f0;
            }

            .hint {
              margin-top: 8px;
              font-size: 10px;
              color: #94a3b8;
            }

            .modalBackdrop {
              position: fixed;
              inset: 0;
              z-index: 50;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 16px;
              background: rgba(0,0,0,0.6);
            }

            .modal {
              width: 100%;
              max-width: 1100px;
              border-radius: 18px;
              border: 1px solid #334155;
              background: #0f153f;
              padding: 24px;
              box-shadow: 0 25px 80px rgba(0,0,0,0.4);
            }

            .modalTop {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 16px;
            }

            .modalTitle {
              font-size: 24px;
              font-weight: 700;
              color: #fff;
            }

            .modalSub {
              margin-top: 4px;
              font-size: 12px;
              font-weight: 600;
              color: #cbd5e1;
            }

            .closeBtn {
              border: 0;
              border-radius: 10px;
              background: #1f2937;
              color: #e2e8f0;
              padding: 10px 14px;
              font-size: 14px;
              font-weight: 600;
              cursor: pointer;
            }

            .modalGrid {
              display: grid;
              grid-template-columns: 0.95fr 1.05fr;
              gap: 16px;
              margin-top: 24px;
            }

            .modalStack {
              display: grid;
              gap: 16px;
            }

            .modalCard {
              background: #050a35;
              border-radius: 14px;
              padding: 16px;
            }

            .smallHead {
              font-size: 12px;
              font-weight: 600;
              letter-spacing: 0.12em;
              text-transform: uppercase;
              color: #94a3b8;
            }

            .bigValue {
              margin-top: 12px;
              font-size: 42px;
              font-weight: 700;
              line-height: 1;
              color: #fff;
            }

            .bodyCopy {
              margin-top: 8px;
              font-size: 13px;
              line-height: 1.7;
              color: #e2e8f0;
            }

            .bodyCopyRight { text-align: right; }

            .vixBandWrap { margin-top: 20px; }

            .vixBandTrack {
              position: relative;
              height: 8px;
              border-radius: 9999px;
              overflow: hidden;
              background: #202a64;
            }

            .seg {
              position: absolute;
              top: 0;
              height: 8px;
            }

            .seg1 { left: 0; width: 37.5%; background: #047857; }
            .seg2 { left: 37.5%; width: 12.5%; background: #4ade80; }
            .seg3 { left: 50%; width: 25%; background: #f59e0b; }
            .seg4 { left: 75%; width: 25%; background: #ef4444; }

            .vixMarker {
              position: absolute;
              top: 50%;
              width: 2px;
              height: 30px;
              transform: translateY(-50%);
              background: #fff;
            }

            .vixScale,
            .vixBands,
            .percentileBands {
              margin-top: 10px;
              display: flex;
              justify-content: space-between;
              font-size: 10px;
              color: #94a3b8;
            }

            .vixScale {
              font-size: 11px;
              color: #cbd5e1;
            }

            .vixBands {
              text-transform: uppercase;
              font-weight: 600;
              letter-spacing: 0.06em;
            }

            .percentileBox {
              margin-top: 20px;
              border-radius: 14px;
              border: 1px solid rgba(245, 158, 11, 0.3);
              background: #141b47;
              padding: 16px;
            }

            .percentileRow {
              margin-top: 8px;
              display: flex;
              align-items: flex-end;
              justify-content: space-between;
              gap: 12px;
            }

            .percentileValue {
              font-size: 32px;
              font-weight: 700;
              line-height: 1;
              color: #fbbf24;
            }

            .percentileValue span {
              font-size: 16px;
              vertical-align: top;
            }

            .percentileTrack {
              position: relative;
              height: 12px;
              margin-top: 12px;
              border-radius: 9999px;
              overflow: hidden;
              background: #202a64;
            }

            .pseg {
              position: absolute;
              top: 0;
              height: 12px;
            }

            .p1 { left: 0; width: 50%; background: #166534; }
            .p2 { left: 50%; width: 35%; background: #a16207; }
            .p3 { left: 85%; width: 15%; background: #7f1d1d; }

            .pMarker {
              position: absolute;
              top: 50%;
              width: 2px;
              height: 20px;
              transform: translateY(-50%);
              background: #fff;
            }

            .historyList {
              display: grid;
              gap: 8px;
              margin-top: 12px;
            }

            .historyRow {
              display: grid;
              grid-template-columns: 70px 1fr 1fr;
              gap: 12px;
              align-items: start;
              border: 1px solid #1e293b;
              border-radius: 10px;
              background: #0b1138;
              padding: 10px 12px;
              font-size: 13px;
              color: #e2e8f0;
            }

            .historyRowActive {
              border-color: rgba(245, 158, 11, 0.4);
              background: #141b47;
            }

            .historyNum {
              font-weight: 700;
              color: #cbd5e1;
            }

            .historyNumActive {
              color: #fbbf24;
            }

            .historyNote {
              color: #94a3b8;
            }

            .actionCard {
              border: 1px solid rgba(34, 197, 94, 0.35);
              border-radius: 14px;
              background: #031e1a;
              padding: 16px;
            }

            .actionHead { color: #fbbf24; }
            .actionCopy { color: #ecfdf5; }

            @media (max-width: 1100px) {
              .modalGrid { grid-template-columns: 1fr; }
            }

            @media (max-width: 900px) {
              .title { font-size: 30px; }
              .value { font-size: 24px; }
              .stressValue { font-size: 24px; }
            }

            @media (max-width: 700px) {
              .topBar,
              .panelHeader,
              .modalTop {
                flex-direction: column;
                align-items: flex-start;
              }

              .damage { white-space: normal; }

              .trendGrid,
              .stressGrid {
                grid-template-columns: 1fr;
              }

              .historyRow {
                grid-template-columns: 1fr;
              }
            }
          `,
        }}
      />
    </>
  );
}
