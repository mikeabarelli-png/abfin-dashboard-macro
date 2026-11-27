"use client";

import { Fragment, useEffect, useState, useRef } from "react";

type AnyObj = Record<string, any>;
type Modal = "vix" | "hy" | "yc" | "real10y" | "dma200" | "erp" | "nom10y" | "cape" | "dxy" | "ad" | "roberts40w" | "portfolioDetail" | null;

// Single source of truth for Equity Risk Premium thresholds. Every ERP
// tile/modal on the dashboard should read from this instead of carrying
// its own inline cutoffs — that drift is what caused the composite-grid
// tile and the secondary tile to disagree at the same erpBps value.
// Thresholds: <200bps Danger, 200-499bps Watch, 500bps+ Healthy.
function erpStatus(bps: number | null): {
  label: string;
  shortLabel: string;
  color: string;
  bg: string;
  tier: "loading" | "danger" | "watch" | "healthy";
} {
  if (bps == null) {
    return { label: "Loading", shortLabel: "Loading", color: "#475569", bg: "rgba(148,163,184,0.12)", tier: "loading" };
  }
  if (bps < 200) {
    return { label: "Danger — Near Zero", shortLabel: "Danger", color: "#ff6b88", bg: "rgba(255,79,114,0.15)", tier: "danger" };
  }
  if (bps < 500) {
    return { label: "Watch — Below 5%", shortLabel: "Watch", color: "#fbbf24", bg: "rgba(245,158,11,0.15)", tier: "watch" };
  }
  return { label: "Healthy Premium", shortLabel: "Healthy", color: "#4ade80", bg: "rgba(74,222,128,0.15)", tier: "healthy" };
}

export default function Page() {
  // Compact 1-2 word asset-class label per ticker, for the portfolio
  // drill-down modal — a quick "what is this fund" reference, since not
  // every hypothetical portfolio's holdings are as familiar as the real one.
  const TICKER_LABELS: Record<string, string> = {
    VTIP: "US TIPS",
    SGOV: "T-Bills",
    VEA:  "Intl Equity",
    VGIT: "US Treasuries",
    SCHD: "US Value",
    VTI:  "US Broad",
    GLDM: "Gold",
    BND:  "US Bonds",
    PDBC: "Commodities",
    DBMF: "Managed Futures",
    VUG:  "US Growth",
    VTV:  "US Value",
    VWO:  "Emerging Mkts",
    VCIT: "US Credit",
    VMBS: "US MBS",
    IGF:  "Infrastructure",
    BNDX: "Intl Bonds",
    SPX:  "US Index",
    VTWO: "Small Cap",
    VIGI: "Intl Dividend",
    VXUS: "Total Intl",
    VTEB: "Muni Bonds",
  };

  const [modal, setModal] = useState<Modal>(null);
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [marketData, setMarketData] = useState<AnyObj | null>(null);
  const [lastUpdated, setLastUpdated] = useState("");
  const [feedError, setFeedError] = useState("");
  const chartRef = useRef<any>(null);
  const rsiRef = useRef<any>(null);
  const macdRef = useRef<any>(null);
  const [activeRange, setActiveRange] = useState(126);

  useEffect(() => {
    let mounted = true;
    const fetchMarket = async () => {
      try {
        const res = await fetch(`/api/smart-money-snapshot?ts=${Date.now()}`, { cache: "no-store" });
        const text = await res.text();
        let json: AnyObj;
        try { json = JSON.parse(text); } catch { throw new Error(`Non-JSON: ${text.slice(0, 120)}`); }
        if (!mounted) return;
        if (!res.ok || json?.ok === false) { setFeedError(json?.detail || json?.error || `HTTP ${res.status}`); return; }
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
    return () => { mounted = false; clearInterval(id); };
  }, []);

  const metrics = marketData?.metrics ?? marketData ?? {};
  const getNum = (...vals: any[]): number | null => {
    for (const v of vals) {
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (typeof v === "string") { const n = Number(v.replace(/,/g, "")); if (Number.isFinite(n)) return n; }
    }
    return null;
  };
  const getArr = (...vals: any[]): number[] | null => {
    for (const v of vals) {
      if (Array.isArray(v)) {
        const arr = v.map((x: any) => typeof x === "number" ? x : Number(String(x).replace(/,/g, ""))).filter((x: number) => Number.isFinite(x));
        if (arr.length) return arr;
      }
    }
    return null;
  };

  const spxPrice = getNum(metrics.spx_price, metrics.spx, marketData?.spx_price);
  const vixValue = getNum(metrics.vix, marketData?.vix);
  const spx20 = getNum(metrics?.spx_20dma?.level, marketData?.spx_20dma?.level) ?? 6822.68;
  const spx50 = getNum(metrics?.spx_50dma?.level, marketData?.spx_50dma?.level) ?? 6881.21;
  const spx100 = getNum(metrics?.spx_100dma?.level, marketData?.spx_100dma?.level) ?? 6841.88;
  const spx200 = getNum(metrics?.spx_200dma?.level, marketData?.spx_200dma?.level) ?? 6608.12;

  // QQQ (Nasdaq-100) — mirrors the SPX extraction, added specifically to
  // watch tech/momentum leadership separately from the broad index, per
  // Roberts' own instrument choice in the momentum-crash report.
  const qqqPrice = getNum(metrics?.qqq?.price, marketData?.qqq?.price);
  const qqqChangePct = getNum(metrics?.qqq?.change_pct, marketData?.qqq?.change_pct);
  const qqqYtd = getNum(metrics?.qqq?.ytd_pct, marketData?.qqq?.ytd_pct);
  const qqqTrend = getArr(metrics?.qqq?.trend_14d, marketData?.qqq?.trend_14d) ?? [];
  const qqq20 = getNum(metrics?.qqq?.dma_20?.level, marketData?.qqq?.dma_20?.level);
  const qqq50 = getNum(metrics?.qqq?.dma_50?.level, marketData?.qqq?.dma_50?.level);
  const qqq100 = getNum(metrics?.qqq?.dma_100?.level, marketData?.qqq?.dma_100?.level);
  const qqq200 = getNum(metrics?.qqq?.dma_200?.level, marketData?.qqq?.dma_200?.level);
  const qqqSlope20 = getNum(metrics?.qqq?.dma_20?.slope, marketData?.qqq?.dma_20?.slope);
  const qqqSlope50 = getNum(metrics?.qqq?.dma_50?.slope, marketData?.qqq?.dma_50?.slope);
  const qqqSlope100 = getNum(metrics?.qqq?.dma_100?.slope, marketData?.qqq?.dma_100?.slope);
  const qqqSlope200 = getNum(metrics?.qqq?.dma_200?.slope, marketData?.qqq?.dma_200?.slope);
  const qqqRegimeLabel = metrics?.qqq?.regime_label ?? marketData?.qqq?.regime_label ?? null;
  const qqqRegimeDesc = metrics?.qqq?.regime_desc ?? marketData?.qqq?.regime_desc ?? null;
  const qqqRegimeColor = metrics?.qqq?.regime_color ?? marketData?.qqq?.regime_color ?? "#fbbf24";
  const qqqRegimeEmoji = metrics?.qqq?.regime_emoji ?? marketData?.qqq?.regime_emoji ?? "🟡";
  const qqqVs = (level: number | null) => qqqPrice == null || level == null ? null : ((qqqPrice - level) / level) * 100;
  const qqq200Pct = qqqVs(qqq200);

  // DMA slopes (% change over last 20 trading days)
  const slope20 = getNum(metrics?.spx_20dma?.slope, marketData?.spx_20dma?.slope);
  const slope50 = getNum(metrics?.spx_50dma?.slope, marketData?.spx_50dma?.slope);
  const slope100 = getNum(metrics?.spx_100dma?.slope, marketData?.spx_100dma?.slope);
  const slope200 = getNum(metrics?.spx_200dma?.slope, marketData?.spx_200dma?.slope);

  // Market regime
  const regime = metrics?.regime ?? marketData?.regime ?? null;
  const regimeLabel = metrics?.regime_label ?? marketData?.regime_label ?? null;
  const regimeDesc = metrics?.regime_desc ?? marketData?.regime_desc ?? null;
  const regimeColor = metrics?.regime_color ?? marketData?.regime_color ?? "#fbbf24";
  const regimeEmoji = metrics?.regime_emoji ?? marketData?.regime_emoji ?? "🟡";
  const spxDailyPct = getNum(metrics?.spx_change_pct, marketData?.spx_change_pct);
  const spxYtd = getNum(metrics?.spx_ytd_pct, marketData?.spx_ytd_pct) ?? -2.13;
  const spxOneYearPct = getNum(metrics?.spx_one_year_pct, marketData?.spx_one_year_pct);
  const spxFiveYearPct = getNum(metrics?.spx_five_year_pct, marketData?.spx_five_year_pct);
  const spxYtdIsTotalReturn: boolean = metrics?.spx_ytd_is_total_return ?? marketData?.spx_ytd_is_total_return ?? false;
  const spxTrend = getArr(metrics?.spx_trend_14d, marketData?.spx_trend_14d) ?? [6946,6908,6878,6881,6816,6869,6830,6740,6795,6781,6775,6672,6632,6699];
  const spxHistory = getArr(metrics?.spx_history, marketData?.spx_history) ?? [];
  const hySpread = getNum(metrics?.hy_spread, marketData?.hy_spread) ?? 3.28;
  const yieldCurve = getNum(metrics?.yield_curve_10y_2y, marketData?.yield_curve_10y_2y) ?? 0.55;
  const real10y = getNum(metrics?.real_10y, marketData?.real_10y) ?? 1.92;
  const nom10y = getNum(metrics?.nom_10y, marketData?.nom_10y) ?? 4.30;
  const fedFunds = getNum(metrics?.fed_funds, marketData?.fed_funds) ?? 4.33;
  const breakeven5y = getNum(metrics?.breakeven_5y, marketData?.breakeven_5y) ?? 2.45;
  const dxy = getNum(metrics?.dxy, marketData?.dxy);
  const dxyChangePct = getNum(metrics?.dxy_change_pct, marketData?.dxy_change_pct);
  const putCallRatio = getNum(metrics?.put_call_ratio, marketData?.put_call_ratio);
  const adLine = metrics?.ad_line ?? marketData?.ad_line ?? null;
  const erpBps = getNum(metrics?.erp_bps, marketData?.erp_bps);
  const trailingPE = getNum(metrics?.trailing_pe, marketData?.trailing_pe);
  const capeRatio = getNum(metrics?.cape_ratio, marketData?.cape_ratio) ?? 40.13;
  const fearGreedScore = getNum(metrics?.fear_greed_score, marketData?.fear_greed_score) ?? 15;
  const fearGreedRating: string = metrics?.fear_greed_rating ?? marketData?.fear_greed_rating ?? "Extreme Fear";

  // Fed Balance Sheet (WALCL)
  const walclBn    = getNum(metrics?.walcl_bn,    marketData?.walcl_bn);
  const walclChgBn = getNum(metrics?.walcl_chg_bn, marketData?.walcl_chg_bn);
  const walclDirection: string = metrics?.walcl_direction ?? marketData?.walcl_direction ?? "";

  // Brent Crude Oil — Roberts' "master switch"
  const brentPrice    = getNum(metrics?.brent_price,      marketData?.brent_price);
  const brentChangePct = getNum(metrics?.brent_change_pct, marketData?.brent_change_pct);
  const brentRegime: string = metrics?.brent_regime ?? marketData?.brent_regime ?? "";

  // Composite Signal Score
  const breadthPct    = getNum(metrics?.breadth_pct,      marketData?.breadth_pct);
  const compositeScore: number = metrics?.composite_score ?? marketData?.composite_score ?? 10;
  const compositeScores = metrics?.composite_scores ?? marketData?.composite_scores ?? { cape:2, buffett:2, vix:1, hy:2, yc:1, breadth:1, erp:1, ivy:1 };
  const compositeAllocation: string = metrics?.composite_allocation ?? marketData?.composite_allocation ?? "45–50%";
  const compositeSignal: string = metrics?.composite_signal ?? marketData?.composite_signal ?? "SLIGHT TILT";
  const compositeColor: string = metrics?.composite_color ?? marketData?.composite_color ?? "#fbbf24";
  const regimeGate: string = metrics?.regime_gate ?? marketData?.regime_gate ?? "hold";
  const buffettSigma  = getNum(metrics?.buffett_sigma,    marketData?.buffett_sigma) ?? 2.33;
  const fedStance: string = metrics?.fed_stance ?? marketData?.fed_stance ?? "holding";
  const fedFundsRate  = getNum(metrics?.fed_funds,          marketData?.fed_funds) ?? 4.33;
  const fedFundsYearAgo = getNum(metrics?.fed_funds_year_ago, marketData?.fed_funds_year_ago);
  const fedTrendDirection: string = metrics?.fed_trend_direction ?? marketData?.fed_trend_direction ?? "flat";
  const fedNextMove = metrics?.fed_next_move ?? marketData?.fed_next_move ?? { lean: "neutral", hikeOdds: 50, meeting: "next FOMC" };
  const aaiiBears = getNum(metrics?.aaii_bears, marketData?.aaii_bears) ?? 53.3;
  const djtPrice      = getNum(metrics?.djt_price,      marketData?.djt_price);
  const djtChangePct  = getNum(metrics?.djt_change_pct, marketData?.djt_change_pct);
  const djt200dma     = getNum(metrics?.djt_200dma,     marketData?.djt_200dma);
  const djt200slope   = getNum(metrics?.djt_200slope,   marketData?.djt_200slope);
  const djtVs200      = getNum(metrics?.djt_vs_200_pct, marketData?.djt_vs_200_pct);
  const djtAbove200: boolean = metrics?.djt_above_200 ?? marketData?.djt_above_200 ?? true;
  const djtTrend14d   = getArr(metrics?.djt_trend_14d,  marketData?.djt_trend_14d) ?? [];
  const schannepSignal: string = metrics?.schannep_signal ?? marketData?.schannep_signal ?? "";
  const schannepLabel: string  = metrics?.schannep_label  ?? marketData?.schannep_label  ?? "Loading";
  const schannepColor: string  = metrics?.schannep_color  ?? marketData?.schannep_color  ?? "#94a3b8";

  // Live Ivy Portfolio data from route.ts
  const ivyData = metrics?.ivy ?? marketData?.ivy ?? null;

  // Live per-position 200-DMA data from route.ts
  const positionsData: AnyObj = metrics?.positions ?? marketData?.positions ?? {};

  // Official month-end Ivy signals now come from route.ts (MANUAL_IVY), the
  // same source the composite score uses, so the score, the Top 10 tile and
  // the Signal Inputs badge can never disagree. Update them there, not here.
  // The fallback below only shows for the moment before the first fetch
  // lands and does not need monthly upkeep.
  const ivyOfficialFromApi = metrics?.ivy_official ?? marketData?.ivy_official ?? null;
  const ivyOfficialSignals: Record<string, "Invest" | "Cash"> =
    ivyOfficialFromApi?.signals ?? { vti: "Invest", veu: "Invest", ief: "Invest", vnq: "Invest", dbc: "Invest" };
  const ivyOfficialDate: string = ivyOfficialFromApi?.asOf ?? "—";
  const ivyEOMDate: string = ivyOfficialFromApi?.validUntil ?? "—";

  const ivyPositions = [
    { ticker:"VTI", name:"US Stocks",     key:"vti" },
    { ticker:"VEU", name:"Intl Stocks",   key:"veu" },
    { ticker:"IEF", name:"Bonds (7-10yr)",key:"ief" },
    { ticker:"VNQ", name:"Real Estate",   key:"vnq" },
    { ticker:"DBC", name:"Commodities",   key:"dbc" },
  ].map(p => {
    const d = ivyData?.[p.key];
    const variance: number | null = d?.variance ?? null;
    const sma: number | null = d?.sma ?? null;
    const price: number | null = d?.price ?? null;
    const officialSignal = ivyOfficialSignals[p.key];
    // Forecast: what is the risk of March 31 flipping?
    // A fund already in Cash can't "exit". For those, the forecast is about
    // re-entry: does it close back above its SMA at month-end?
    const forecastLabel = variance == null ? "Loading"
      : officialSignal === "Cash" ? (variance > 0 ? "Re-entry Likely" : "Stays in Cash")
      : variance <= -2   ? "Exit Risk High"
      : variance <= 0    ? "Flip Risk"
      : variance <= 2    ? "Watch"
      : "On Track";
    const forecastColor = variance == null ? "#475569"
      : officialSignal === "Cash" ? (variance > 0 ? "#4ade80" : "#94a3b8")
      : variance <= 0    ? "#ff6b88"
      : variance <= 2    ? "#fbbf24"
      : "#4ade80";
    const forecastPill = variance == null ? ""
      : officialSignal === "Cash" ? (variance > 0 ? "pillG" : "pillA")
      : variance <= 0    ? "pillR"
      : variance <= 2    ? "pillA"
      : "pillG";
    const pct = variance != null ? Math.max(0, Math.min(Math.abs(variance) / 30 * 100, 100)) : 32;
    return { ...p, variance, sma, price, officialSignal, forecastLabel, forecastColor, forecastPill, pct };
  });
  const ivyInvestedCount = Object.values(ivyOfficialSignals).filter(s => s === "Invest").length;
  const ivyAtRiskCount = ivyPositions.filter(p => p.variance != null && p.variance <= 0).length;
  const ivyLive = ivyData != null;

  const fmtWhole = (n: number) => Math.round(n).toLocaleString();
  const fmt1 = (n: number) => n.toFixed(1);
  const fmt2 = (n: number) => n.toFixed(2);
  const fmtSigned1 = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
  const spxVs = (level: number) => spxPrice == null ? null : ((spxPrice - level) / level) * 100;

  // 4-state DMA label engine — position-only wording. Direction (rising/
  // flattening/falling) is now conveyed by the arrow next to Today, so the
  // label itself no longer needs a separate "Bullish" vs "Holding Above"
  // split for the same above-average state; both used the same color
  // already (dmaTone always returned "healthy" above the average
  // regardless of slope), so the wording was implying a distinction the
  // color never actually made.
  const dmaState = (pct: number | null, slope?: number | null, isLong = false) => {
    if (pct == null) return "Loading";
    if (pct < 0) {
      // Below the DMA is a broken trend, full stop. One up day doesn't
      // change that, so the label no longer flips on today's move.
      return "Below";
    }
    if (isLong && pct <= 2) return "Testing Support";
    return "Holding Above";
  };
  const dmaTone = (pct: number | null, slope?: number | null, isLong = false) => {
    if (pct == null) return "neutral";
    if (pct < 0) return "danger";
    if (isLong && pct <= 2) return "warning";
    if (slope != null && slope > 0.02) return "healthy";
    return "healthy"; // above DMA is always at minimum healthy
  };

  // Position-level version of the same 5-state engine above — takes the
  // POSITION's own daily change instead of closing over spxDailyPct, since
  // each holding's Recovering-vs-Bearish call must be based on its own tape,
  // not what the S&P did today. Same thresholds, same logic, own inputs.
  const positionDmaState = (pct: number | null, slope: number | null, dailyPct: number | null, isLong = false) => {
    if (pct == null) return "Loading";
    if (pct < 0) {
      return "Below";
    }
    if (isLong && pct <= 2) return "Testing Support";
    return "Holding Above";
  };
  const positionDmaTone = (pct: number | null, slope: number | null, dailyPct: number | null, isLong = false) => {
    if (pct == null) return "neutral";
    if (pct < 0) return "danger";
    if (isLong && pct <= 2) return "warning";
    if (slope != null && slope > 0.02) return "healthy";
    return "healthy";
  };
  const toneColor = (tone: string) => ({ danger: "#ff6b88", warning: "#fbbf24", healthy: "#4ade80", neutral: "#94a3b8" }[tone] ?? "#94a3b8");

  // Portfolio holdings at M2 weights (Mike's IRAs, 50/40/10). Sums to 100.
  // "trend" sleeve is judged against the 200-DMA, same as SPX.
  // "defensive" sleeve (capital preservation / cash-like) isn't supposed to
  // trend, so it skips the Bullish/Bearish verdict entirely and just shows
  // the numbers: price, YTD total return, and 200-DMA gap for reference.
  const PORTFOLIO_POSITIONS = [
    { ticker: "SCHD", weight: 15, job: "Quality equity, lower vol",        sleeve: "trend" as const,     acct: "M2" },
    { ticker: "VEA",  weight: 15, job: "International equity",             sleeve: "trend" as const,     acct: "M2" },
    { ticker: "VTI",  weight: 10, job: "Broad US market exposure",         sleeve: "trend" as const,     acct: "M2" },
    { ticker: "VTWO", weight: 5,  job: "Small cap, Russell 2000",          sleeve: "trend" as const,     acct: "M2" },
    { ticker: "VIGI", weight: 5,  job: "Int'l dividend growth",            sleeve: "trend" as const,     acct: "M2" },
    { ticker: "VTIP", weight: 15, job: "Inflation protection",             sleeve: "defensive" as const, acct: "M2" },
    { ticker: "SGOV", weight: 15, job: "Capital preservation, yield",      sleeve: "defensive" as const, acct: "M2" },
    { ticker: "BND",  weight: 10, job: "Core US bond, replaced VGIT",      sleeve: "defensive" as const, acct: "M2" },
    { ticker: "GLDM", weight: 5,  job: "Hard asset hedge",                 sleeve: "trend" as const,     acct: "M2" },
    { ticker: "DBMF", weight: 5,  job: "Managed futures, trend-following", sleeve: "defensive" as const, acct: "M2" },
  ];

  // CUR 40/55/5 is meant to be a FROZEN snapshot of Mike's actual holdings
  // through early September, before the M2 rebalance, kept solely so the
  // "CUR vs M2" comparison tile has a stable "before" to compare against.
  // Deliberately a separate array from PORTFOLIO_POSITIONS (the live
  // Holdings list): that one gets edited as real positions actually
  // change (VGIT -> BND, etc.), and CUR must never inherit those edits or
  // it stops being a valid historical baseline. VGIT's price data is
  // still fetched server-side even though it's no longer a live holding,
  // so this can still compute real returns.
  const CUR_PORTFOLIO_POSITIONS = [
    { ticker: "SGOV", weight: 20 },
    { ticker: "VGIT", weight: 20 },
    { ticker: "VEA",  weight: 15 },
    { ticker: "SCHD", weight: 15 },
    { ticker: "VTIP", weight: 15 },
    { ticker: "VTI",  weight: 10 },
    { ticker: "GLDM", weight: 5  },
  ];
  const curPositionCards = CUR_PORTFOLIO_POSITIONS.map(p => {
    const d = positionsData?.[p.ticker] ?? null;
    return {
      ...p,
      dailyPct: d?.dailyChangePct ?? null,
      ytdReturnPct: d?.ytdReturnPct ?? null,
      oneYearReturnPct: d?.oneYearReturnPct ?? null,
      fiveYearReturnPct: d?.fiveYearReturnPct ?? null,
    };
  });

  const positionCards = PORTFOLIO_POSITIONS.map(p => {
    const d = positionsData?.[p.ticker] ?? null;
    const price: number | null = d?.price ?? null;
    const dailyPct: number | null = d?.dailyChangePct ?? null;
    const dma200: number | null = d?.dma200 ?? null;
    const slope200: number | null = d?.slope200 ?? null;
    const pctVs200: number | null = d?.pctVs200 ?? null;
    const ytdReturnPct: number | null = d?.ytdReturnPct ?? null;
    const oneYearReturnPct: number | null = d?.oneYearReturnPct ?? null;
    const fiveYearReturnPct: number | null = d?.fiveYearReturnPct ?? null;
    const state = positionDmaState(pctVs200, slope200, dailyPct, true);
    const tone = positionDmaTone(pctVs200, slope200, dailyPct, true);
    const color = toneColor(tone);
    // Marker position on the bar: 0% gap = center (50%), clamp at ±15% so
    // an outsized move never pushes the dot off the track.
    const clampedPct = pctVs200 == null ? 0 : Math.max(-15, Math.min(15, pctVs200));
    const barPos = 50 + (clampedPct / 15) * 50;
    return { ...p, price, dailyPct, dma200, slope200, pctVs200, ytdReturnPct, oneYearReturnPct, fiveYearReturnPct, state, tone, color, barPos };
  });

  // TOD-only holdings (Noelle's taxable account). Shown at their CURRENT
  // TOD weights (40 VTI / 15 VXUS / 45 VTEB), not M2 weights. The tile label
  // reads "TOD" so they aren't confused with the M2 percentages. Target is
  // Chris's C1 TAX 25/15/60. Update VTEB as the Dec/Jan tranches complete.
  const CANDIDATE_POSITIONS = [
    { ticker: "VXUS", weight: 15, job: "Total intl (dev + EM), TOD",       sleeve: "trend" as const,     acct: "TOD" },
    { ticker: "VTEB", weight: 45, job: "Muni bonds, tax-exempt, TOD",      sleeve: "defensive" as const, acct: "TOD" },
  ];
  const candidateCards = CANDIDATE_POSITIONS.map(p => {
    const d = positionsData?.[p.ticker] ?? null;
    const price: number | null = d?.price ?? null;
    const dailyPct: number | null = d?.dailyChangePct ?? null;
    const dma200: number | null = d?.dma200 ?? null;
    const slope200: number | null = d?.slope200 ?? null;
    const pctVs200: number | null = d?.pctVs200 ?? null;
    const ytdReturnPct: number | null = d?.ytdReturnPct ?? null;
    const oneYearReturnPct: number | null = d?.oneYearReturnPct ?? null;
    const fiveYearReturnPct: number | null = d?.fiveYearReturnPct ?? null;
    const state = positionDmaState(pctVs200, slope200, dailyPct, true);
    const tone = positionDmaTone(pctVs200, slope200, dailyPct, true);
    const color = toneColor(tone);
    const clampedPct = pctVs200 == null ? 0 : Math.max(-15, Math.min(15, pctVs200));
    const barPos = 50 + (clampedPct / 15) * 50;
    return { ...p, price, dailyPct, dma200, slope200, pctVs200, ytdReturnPct, oneYearReturnPct, fiveYearReturnPct, state, tone, color, barPos };
  });

  // Blended portfolio YTD return — weight × each position's own YTD total
  // return. This is an ESTIMATE: it assumes today's weights were held
  // constant since Jan 1 with no rebalancing and no cash flows, so it will
  // drift from the actual brokerage-reported return over time.
  const portfolioHasAllYtd = curPositionCards.every(p => p.ytdReturnPct != null);
  const portfolioYtdPct: number | null = portfolioHasAllYtd
    ? curPositionCards.reduce((sum, p) => sum + (p.ytdReturnPct as number) * (p.weight / 100), 0)
    : null;

  // Same blend, but for today's change — mirrors the "Today" column already
  // shown on each position tile, so the benchmark row speaks the same
  // language as the cards below it.
  const portfolioHasAllToday = curPositionCards.every(p => p.dailyPct != null);
  const portfolioTodayPct: number | null = portfolioHasAllToday
    ? curPositionCards.reduce((sum, p) => sum + (p.dailyPct as number) * (p.weight / 100), 0)
    : null;
  const portfolioHasAllOneYear = curPositionCards.every(p => p.oneYearReturnPct != null);
  const portfolioOneYearPct: number | null = portfolioHasAllOneYear
    ? curPositionCards.reduce((sum, p) => sum + (p.oneYearReturnPct as number) * (p.weight / 100), 0)
    : null;
  const portfolioHasAllFiveYear = curPositionCards.every(p => p.fiveYearReturnPct != null);
  const portfolioFiveYearPct: number | null = portfolioHasAllFiveYear
    ? curPositionCards.reduce((sum, p) => sum + (p.fiveYearReturnPct as number) * (p.weight / 100), 0)
    : null;

  // Benchmarks — SPX already computed elsewhere as spxYtd/spxDailyPct;
  // the two index proxies come from route.ts using the same VTI/BND blend.
  const benchmark6040YtdPct = getNum(metrics?.benchmark_6040?.ytd_return_pct, marketData?.benchmark_6040?.ytd_return_pct);
  const benchmark4060YtdPct = getNum(metrics?.benchmark_4060?.ytd_return_pct, marketData?.benchmark_4060?.ytd_return_pct);
  const benchmark6040TodayPct = getNum(metrics?.benchmark_6040?.today_change_pct, marketData?.benchmark_6040?.today_change_pct);
  const benchmark6040OneYearPct = getNum(metrics?.benchmark_6040?.one_year_return_pct, marketData?.benchmark_6040?.one_year_return_pct);
  const benchmark6040FiveYearPct = getNum(metrics?.benchmark_6040?.five_year_return_pct, marketData?.benchmark_6040?.five_year_return_pct);
  const benchmark4060TodayPct = getNum(metrics?.benchmark_4060?.today_change_pct, marketData?.benchmark_4060?.today_change_pct);
  const benchmark4060OneYearPct = getNum(metrics?.benchmark_4060?.one_year_return_pct, marketData?.benchmark_4060?.one_year_return_pct);
  const benchmark4060FiveYearPct = getNum(metrics?.benchmark_4060?.five_year_return_pct, marketData?.benchmark_4060?.five_year_return_pct);
  // Simple 50/50 VTI/BND — added as a plainer benchmark closer to where Mike
  // expects the household to actually land once Chris's proposal settles.
  const benchmark5050YtdPct = getNum(metrics?.benchmark_5050?.ytd_return_pct, marketData?.benchmark_5050?.ytd_return_pct);
  const benchmark5050TodayPct = getNum(metrics?.benchmark_5050?.today_change_pct, marketData?.benchmark_5050?.today_change_pct);
  const benchmark5050OneYearPct = getNum(metrics?.benchmark_5050?.one_year_return_pct, marketData?.benchmark_5050?.one_year_return_pct);
  const benchmark5050FiveYearPct = getNum(metrics?.benchmark_5050?.five_year_return_pct, marketData?.benchmark_5050?.five_year_return_pct);
  // Clean Slate — hypothetical from-scratch panel build (SCHD/SGOV/VEA/VTIP/VTI/VGIT/DBMF/PDBC)
  const cleanSlateYtdPct = getNum(metrics?.clean_slate?.ytd_return_pct, marketData?.clean_slate?.ytd_return_pct);
  const cleanSlateTodayPct = getNum(metrics?.clean_slate?.today_change_pct, marketData?.clean_slate?.today_change_pct);
  const cleanSlateOneYearPct = getNum(metrics?.clean_slate?.one_year_return_pct, marketData?.clean_slate?.one_year_return_pct);
  const cleanSlateFiveYearPct = getNum(metrics?.clean_slate?.five_year_return_pct, marketData?.clean_slate?.five_year_return_pct);
  // LPL "Income with Moderate Growth" proxy — 39% equity model, mapped to ETFs
  const lpl4060YtdPct = getNum(metrics?.lpl_4060?.ytd_return_pct, marketData?.lpl_4060?.ytd_return_pct);
  const lpl4060TodayPct = getNum(metrics?.lpl_4060?.today_change_pct, marketData?.lpl_4060?.today_change_pct);
  const lpl4060OneYearPct = getNum(metrics?.lpl_4060?.one_year_return_pct, marketData?.lpl_4060?.one_year_return_pct);
  const lpl4060FiveYearPct = getNum(metrics?.lpl_4060?.five_year_return_pct, marketData?.lpl_4060?.five_year_return_pct);
  const lpl5050YtdPct = getNum(metrics?.lpl_5050?.ytd_return_pct, marketData?.lpl_5050?.ytd_return_pct);
  const lpl5050TodayPct = getNum(metrics?.lpl_5050?.today_change_pct, marketData?.lpl_5050?.today_change_pct);
  const lpl5050OneYearPct = getNum(metrics?.lpl_5050?.one_year_return_pct, marketData?.lpl_5050?.one_year_return_pct);
  const lpl5050FiveYearPct = getNum(metrics?.lpl_5050?.five_year_return_pct, marketData?.lpl_5050?.five_year_return_pct);
  const vg4060YtdPct = getNum(metrics?.vg_4060?.ytd_return_pct, marketData?.vg_4060?.ytd_return_pct);
  const vg4060TodayPct = getNum(metrics?.vg_4060?.today_change_pct, marketData?.vg_4060?.today_change_pct);
  const vg4060OneYearPct = getNum(metrics?.vg_4060?.one_year_return_pct, marketData?.vg_4060?.one_year_return_pct);
  const vg4060FiveYearPct = getNum(metrics?.vg_4060?.five_year_return_pct, marketData?.vg_4060?.five_year_return_pct);
  // Noelle Mockup — Mike's what-if replacing GLDM with DBMF + BTAL (a
  // placeholder for the still-unnamed Long/Short fund Chris is researching),
  // equity held at Chris's original 55%. Tracks Noelle's Rollover IRA only,
  // not the household. BTAL is illustrative — swap once Chris names a real
  // long/short fund from his Nitrogen screen.
  const noelleMockupYtdPct = getNum(metrics?.noelle_mockup?.ytd_return_pct, marketData?.noelle_mockup?.ytd_return_pct);
  const noelleMockupTodayPct = getNum(metrics?.noelle_mockup?.today_change_pct, marketData?.noelle_mockup?.today_change_pct);
  const noelleMockupOneYearPct = getNum(metrics?.noelle_mockup?.one_year_return_pct, marketData?.noelle_mockup?.one_year_return_pct);
  const noelleMockupFiveYearPct = getNum(metrics?.noelle_mockup?.five_year_return_pct, marketData?.noelle_mockup?.five_year_return_pct);
  // C1 TAX 40/60 — Chris's actual proposal for Noelle's TOD (taxable)
  // accounts: 25% VTI / 15% VXUS / 60% VTEB. Distinct from C0 (his
  // retirement-account proposal) — this one is taxable-specific.
  const c1TaxYtdPct = getNum(metrics?.c1_tax?.ytd_return_pct, marketData?.c1_tax?.ytd_return_pct);
  const c1TaxTodayPct = getNum(metrics?.c1_tax?.today_change_pct, marketData?.c1_tax?.today_change_pct);
  const c1TaxOneYearPct = getNum(metrics?.c1_tax?.one_year_return_pct, marketData?.c1_tax?.one_year_return_pct);
  const c1TaxFiveYearPct = getNum(metrics?.c1_tax?.five_year_return_pct, marketData?.c1_tax?.five_year_return_pct);
  // C1 IRA — Chris's proposed uniform model for the six standard-structure
  // retirement accounts (excludes Alpine 401k pending rollover, excludes
  // TOD accounts which use C1 TAX). Drops VGIT in favor of BND.
  const c1IraYtdPct = getNum(metrics?.c1_ira?.ytd_return_pct, marketData?.c1_ira?.ytd_return_pct);
  const c1IraTodayPct = getNum(metrics?.c1_ira?.today_change_pct, marketData?.c1_ira?.today_change_pct);
  const c1IraOneYearPct = getNum(metrics?.c1_ira?.one_year_return_pct, marketData?.c1_ira?.one_year_return_pct);
  const c1IraFiveYearPct = getNum(metrics?.c1_ira?.five_year_return_pct, marketData?.c1_ira?.five_year_return_pct);
  // M2 — Mike's dial-back of C1 IRA toward a clean 50/40/10 (VTWO cut to
  // 5%, GLDM/DBMF each doubled to 5%). M3 — same base but VTWO back to
  // 10% and GLDM/DBMF at 2.5% each (nets to 55/40/5, not 50/40/10).
  const m2YtdPct = getNum(metrics?.m2?.ytd_return_pct, marketData?.m2?.ytd_return_pct);
  const m2TodayPct = getNum(metrics?.m2?.today_change_pct, marketData?.m2?.today_change_pct);
  const m2OneYearPct = getNum(metrics?.m2?.one_year_return_pct, marketData?.m2?.one_year_return_pct);
  const m2FiveYearPct = getNum(metrics?.m2?.five_year_return_pct, marketData?.m2?.five_year_return_pct);
  const m27YtdPct = getNum(metrics?.m27?.ytd_return_pct, marketData?.m27?.ytd_return_pct);
  const m27TodayPct = getNum(metrics?.m27?.today_change_pct, marketData?.m27?.today_change_pct);
  const m27OneYearPct = getNum(metrics?.m27?.one_year_return_pct, marketData?.m27?.one_year_return_pct);
  const m27FiveYearPct = getNum(metrics?.m27?.five_year_return_pct, marketData?.m27?.five_year_return_pct);
  const m3YtdPct = getNum(metrics?.m3?.ytd_return_pct, marketData?.m3?.ytd_return_pct);
  const m3TodayPct = getNum(metrics?.m3?.today_change_pct, marketData?.m3?.today_change_pct);
  const m3OneYearPct = getNum(metrics?.m3?.one_year_return_pct, marketData?.m3?.one_year_return_pct);
  const m3FiveYearPct = getNum(metrics?.m3?.five_year_return_pct, marketData?.m3?.five_year_return_pct);
  // Panel Consensus — the 12-voice panel's debate over C1, 50% equity cap
  // held fixed, cut concentrated in VTWO, BND raised more than Chris's
  // original, gold weighted above DBMF. Other AI — a second AI's take on
  // the same question, close to M2 but BND at 11% and GLDM/DBMF split
  // evenly, kept separate to compare philosophies side by side.
  const panelYtdPct = getNum(metrics?.panel_consensus?.ytd_return_pct, marketData?.panel_consensus?.ytd_return_pct);
  const panelTodayPct = getNum(metrics?.panel_consensus?.today_change_pct, marketData?.panel_consensus?.today_change_pct);
  const panelOneYearPct = getNum(metrics?.panel_consensus?.one_year_return_pct, marketData?.panel_consensus?.one_year_return_pct);
  const panelFiveYearPct = getNum(metrics?.panel_consensus?.five_year_return_pct, marketData?.panel_consensus?.five_year_return_pct);
  const otherAiYtdPct = getNum(metrics?.other_ai?.ytd_return_pct, marketData?.other_ai?.ytd_return_pct);
  const otherAiTodayPct = getNum(metrics?.other_ai?.today_change_pct, marketData?.other_ai?.today_change_pct);
  const otherAiOneYearPct = getNum(metrics?.other_ai?.one_year_return_pct, marketData?.other_ai?.one_year_return_pct);
  const otherAiFiveYearPct = getNum(metrics?.other_ai?.five_year_return_pct, marketData?.other_ai?.five_year_return_pct);
  // Hybrid 8 — Mike's curated blend of ALT 45/40/15 and the Noelle Mockup.
  // SCHD foundational, VTWO carried over for Chris's small-cap input, VIGI
  // and PDBC cut for overlap with VEA/DBMF, BTAL cut to consolidate alts
  // into a single DBMF line. 8 holdings by design, not a straight average.
  const hybrid8YtdPct = getNum(metrics?.hybrid_8?.ytd_return_pct, marketData?.hybrid_8?.ytd_return_pct);
  const hybrid8TodayPct = getNum(metrics?.hybrid_8?.today_change_pct, marketData?.hybrid_8?.today_change_pct);
  const hybrid8OneYearPct = getNum(metrics?.hybrid_8?.one_year_return_pct, marketData?.hybrid_8?.one_year_return_pct);
  const hybrid8FiveYearPct = getNum(metrics?.hybrid_8?.five_year_return_pct, marketData?.hybrid_8?.five_year_return_pct);

  // Raw component breakdowns for the drill-down modal — ticker/weight/YTD/today
  // for each hypothetical portfolio, sourced straight from route.ts. 1-YR/5-YR
  // per ticker aren't in the components array route.ts returns (that only
  // carries what each blend needs), but every ticker's own 1-YR/5-YR already
  // lives in the shared positions dict from the "Your Holdings" tiles, so
  // this just looks each one up there instead of needing a backend change.
  type DetailComponent = { ticker: string; weight: number; ytd: number | null; today: number | null; oneYear: number | null; fiveYear: number | null };
  const apiComponents = (obj: any): DetailComponent[] =>
    (obj?.components ?? []).map((c: any) => ({
      ticker: c.ticker, weight: c.weight_pct, ytd: c.ytd_pct, today: c.today_pct,
      oneYear: positionsData?.[c.ticker]?.oneYearReturnPct ?? null,
      fiveYear: positionsData?.[c.ticker]?.fiveYearReturnPct ?? null,
    }));

  const portfolioDetailData: Record<string, { title: string; subtitle: string; ytd: number | null; today: number | null; oneYear: number | null; fiveYear: number | null; components: DetailComponent[] }> = {
    cur: {
      title: "M25 40/55/5 · allocation through early Sept 2026",
      subtitle: "Weighted by actual allocation · estimate, not brokerage-reported return",
      ytd: portfolioYtdPct, today: portfolioTodayPct, oneYear: portfolioOneYearPct, fiveYear: portfolioFiveYearPct,
      components: curPositionCards.map(p => ({ ticker: p.ticker, weight: p.weight, ytd: p.ytdReturnPct, today: p.dailyPct, oneYear: p.oneYearReturnPct, fiveYear: p.fiveYearReturnPct })),
    },
    idx4060: {
      title: "40/60 Index Proxy",
      subtitle: "40% VTI / 60% BND",
      ytd: benchmark4060YtdPct, today: benchmark4060TodayPct, oneYear: benchmark4060OneYearPct, fiveYear: benchmark4060FiveYearPct,
      components: apiComponents(metrics?.benchmark_4060 ?? marketData?.benchmark_4060),
    },
    idx5050: {
      title: "50/50 Index Proxy",
      subtitle: "50% VTI / 50% BND · Mike's rough read on where the household lands",
      ytd: benchmark5050YtdPct, today: benchmark5050TodayPct, oneYear: benchmark5050OneYearPct, fiveYear: benchmark5050FiveYearPct,
      components: apiComponents(metrics?.benchmark_5050 ?? marketData?.benchmark_5050),
    },
    idx6040: {
      title: "60/40 Index Proxy",
      subtitle: "60% VTI / 40% BND · same indices as VBINX",
      ytd: benchmark6040YtdPct, today: benchmark6040TodayPct, oneYear: benchmark6040OneYearPct, fiveYear: benchmark6040FiveYearPct,
      components: apiComponents(metrics?.benchmark_6040 ?? marketData?.benchmark_6040),
    },
    spx: {
      title: "S&P 500",
      subtitle: "Total return, dividends included",
      ytd: spxYtd, today: spxDailyPct, oneYear: spxOneYearPct, fiveYear: spxFiveYearPct,
      components: [{ ticker: "SPX", weight: 100, ytd: spxYtd, today: spxDailyPct, oneYear: spxOneYearPct, fiveYear: spxFiveYearPct }],
    },
    alt: {
      title: "M0 45/40/15",
      subtitle: "Panel's from-scratch build — 45% equity / 40% fixed income / 15% alternatives",
      ytd: cleanSlateYtdPct, today: cleanSlateTodayPct, oneYear: cleanSlateOneYearPct, fiveYear: cleanSlateFiveYearPct,
      components: apiComponents(metrics?.clean_slate ?? marketData?.clean_slate),
    },
    lpl4060: {
      title: "LPL 40/60",
      subtitle: "LPL STAAC \"Income with Moderate Growth\" proxy, mapped to ETFs",
      ytd: lpl4060YtdPct, today: lpl4060TodayPct, oneYear: lpl4060OneYearPct, fiveYear: lpl4060FiveYearPct,
      components: apiComponents(metrics?.lpl_4060 ?? marketData?.lpl_4060),
    },
    lpl5050: {
      title: "LPL 50/50",
      subtitle: "Interpolated between LPL's IMG and Growth-with-Income models",
      ytd: lpl5050YtdPct, today: lpl5050TodayPct, oneYear: lpl5050OneYearPct, fiveYear: lpl5050FiveYearPct,
      components: apiComponents(metrics?.lpl_5050 ?? marketData?.lpl_5050),
    },
    vg4060: {
      title: "VG 40/60",
      subtitle: "Vanguard's unconstrained VAAM/VCMM model, mapped to ETFs",
      ytd: vg4060YtdPct, today: vg4060TodayPct, oneYear: vg4060OneYearPct, fiveYear: vg4060FiveYearPct,
      components: apiComponents(metrics?.vg_4060 ?? marketData?.vg_4060),
    },
    noelleMockup: {
      title: "C0 55/35/10",
      subtitle: "Chris's rough draft for Noelle's Rollover IRA — 55% equity / 35% fixed income / 10% alts (DBMF + BTAL placeholder for TBD Long/Short). IRA-level, not household.",
      ytd: noelleMockupYtdPct, today: noelleMockupTodayPct, oneYear: noelleMockupOneYearPct, fiveYear: noelleMockupFiveYearPct,
      components: apiComponents(metrics?.noelle_mockup ?? marketData?.noelle_mockup),
    },
    c1Tax: {
      title: "C1 TAX 40/60",
      subtitle: "Chris's actual proposal for Noelle's TOD (taxable) accounts — 25% VTI / 15% VXUS / 60% VTEB. Tax-exempt income via munis, sized for the household's early-retirement funding bucket.",
      ytd: c1TaxYtdPct, today: c1TaxTodayPct, oneYear: c1TaxOneYearPct, fiveYear: c1TaxFiveYearPct,
      components: apiComponents(metrics?.c1_tax ?? marketData?.c1_tax),
    },
    c1Ira: {
      title: "C26 · Chris's C1 IRA proposal",
      subtitle: "Chris's proposed uniform model across the six standard retirement accounts — 16% SCHD / 15% VEA / 15% VTIP / 14% SGOV / 10% VTI / 10% VTWO / 9% BND / 5% VIGI / 3% GLDM / 3% DBMF. Drops VGIT for BND (the anchor bond fund in Vanguard's own target-date funds). Excludes the Alpine 401k (pending rollover) and TOD accounts (see C1 TAX).",
      ytd: c1IraYtdPct, today: c1IraTodayPct, oneYear: c1IraOneYearPct, fiveYear: c1IraFiveYearPct,
      components: apiComponents(metrics?.c1_ira ?? marketData?.c1_ira),
    },
    m2: {
      title: "M26 50/40/10 · current allocation",
      subtitle: "Mike's dial-back of C1 IRA — same fund selection, VTWO cut from 10% to 5%, GLDM/DBMF each doubled to 5%. 50% equity / 40% fixed income / 10% alts.",
      ytd: m2YtdPct, today: m2TodayPct, oneYear: m2OneYearPct, fiveYear: m2FiveYearPct,
      components: apiComponents(metrics?.m2 ?? marketData?.m2),
    },
    m27: {
      title: "M27 50/42/8 · draft",
      subtitle: "Early tracker for the January conversation with Chris. Same equity sleeve as M26. Gold trimmed to 3% (Chris's original size) and 10 points of short ballast (SGOV, VTIP) moved into BND and VGIT to lock in today's yields. 50% equity / 42% fixed income / 8% alts.",
      ytd: m27YtdPct, today: m27TodayPct, oneYear: m27OneYearPct, fiveYear: m27FiveYearPct,
      components: apiComponents(metrics?.m27 ?? marketData?.m27),
    },
    m3: {
      title: "M3 55/40/5",
      subtitle: "Same as M2 but VTWO restored to Chris's original 10% and GLDM/DBMF each at 2.5%. 55% equity / 40% fixed income / 5% alts.",
      ytd: m3YtdPct, today: m3TodayPct, oneYear: m3OneYearPct, fiveYear: m3FiveYearPct,
      components: apiComponents(metrics?.m3 ?? marketData?.m3),
    },
    panelConsensus: {
      title: "Panel Consensus",
      subtitle: "The 12-voice panel's debate over C1 IRA with the 50% equity cap held fixed — cut concentrated in VTWO (its true CAPE runs higher than the S&P's own), BND raised above Chris's original 9%, gold weighted above DBMF since they hedge different risks. 50% equity / 42% fixed income / 8% alts.",
      ytd: panelYtdPct, today: panelTodayPct, oneYear: panelOneYearPct, fiveYear: panelFiveYearPct,
      components: apiComponents(metrics?.panel_consensus ?? marketData?.panel_consensus),
    },
    otherAi: {
      title: "Other AI",
      subtitle: "A second AI's independent take on C1 with the same 50% equity cap — same equity lines as M2/Panel, BND at 11%, GLDM/DBMF split evenly at 5/5 rather than weighted toward gold. Stated rationale: round numbers are easier to hold to when markets get volatile. 50% equity / 40% fixed income / 10% alts.",
      ytd: otherAiYtdPct, today: otherAiTodayPct, oneYear: otherAiOneYearPct, fiveYear: otherAiFiveYearPct,
      components: apiComponents(metrics?.other_ai ?? marketData?.other_ai),
    },
    hybrid8: {
      title: "M1 50/35/15",
      subtitle: "Mike's curated blend of ALT 45/40/15 and the Noelle Mockup — SCHD foundational, VTWO for Chris's small-cap input, VIGI/PDBC/BTAL cut for overlap. 50% equity / 35% fixed income / 15% alts, 8 holdings.",
      ytd: hybrid8YtdPct, today: hybrid8TodayPct, oneYear: hybrid8OneYearPct, fiveYear: hybrid8FiveYearPct,
      components: apiComponents(metrics?.hybrid_8 ?? marketData?.hybrid_8),
    },
  };

  const vixStatus = vixValue == null ? { label: "Loading", sub: "", color: "#94a3b8" }
    : vixValue >= 30 ? { label: "Stress — Pause Buying", sub: "Trigger breached · Pause new buying", color: "#ff6b88" }
    : vixValue >= 20 ? { label: "Slightly Elevated", sub: "Rising fear and potential volatility", color: "#fbbf24" }
    : { label: "Calm", sub: "Low volatility, market conditions steady", color: "#4ade80" };

  const vixPctTable: number[][] = [[9,1],[10,3],[11,6],[12,10],[13,15],[14,20],[15,27],[16,33],[17,40],[18,48],[19,56],[20,63],[21,68],[22,73],[23,77],[24,80],[25,83],[26,85],[27,87],[28,89],[29,91],[30,93],[32,95],[35,97],[40,98],[50,99],[82,100]];
  const getVixPct = (v: number) => {
    for (let i = 0; i < vixPctTable.length - 1; i++) {
      const [v0,p0] = vixPctTable[i], [v1,p1] = vixPctTable[i+1];
      if (v <= v1) return Math.round(p0 + ((v-v0)/(v1-v0))*(p1-p0));
    }
    return 100;
  };
  const vixPct = vixValue != null ? getVixPct(vixValue) : 75;
  const vixNeedlePct = (v: number) => {
    if (v <= 15) return (v/15)*37.5;
    if (v <= 20) return 37.5+((v-15)/5)*12.5;
    if (v <= 30) return 50+((v-20)/10)*25;
    return Math.min(75+((v-30)/10)*25, 99);
  };

  const damageCount = [spxVs(spx20), spxVs(spx50), spxVs(spx100), spxVs(spx200)].filter(v => v != null && v < 0).length;

  // ── 200-DMA breach state ──────────────────────────────────────────────────
  const spx200Pct = spxVs(spx200);
  const is200Broken = spx200Pct != null && spx200Pct < 0;
  // The lowest average still above the S&P is the next one it can reclaim.
  const nextReclaim = spxPrice == null ? null : [
    { label: "20-DMA", level: spx20 }, { label: "50-DMA", level: spx50 },
    { label: "100-DMA", level: spx100 }, { label: "200-DMA", level: spx200 },
  ].filter(d => d.level != null && d.level > spxPrice).sort((a, b) => a.level - b.level)[0] ?? null;
  const offHigh: number | null = marketData?.weekly_view?.spxOffHigh ?? null;
  // ─────────────────────────────────────────────────────────────────────────

  const sparkline = (points: number[], color: string) => {
    const w = 100, h = 22;
    const max = Math.max(...points), min = Math.min(...points);
    const range = Math.max(1, max - min);
    const coords = points.map((p, i) => `${(i/(points.length-1))*w},${h-((p-min)/range)*(h-2)-1}`).join(" ");
    const ly = h - ((points[points.length-1]-min)/range)*(h-2)-1;
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}"><polyline fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" points="${coords}"/><circle cx="${w}" cy="${ly}" r="2" fill="${color}"/></svg>`;
  };

  // Chart helpers
  const sma = (arr: number[], n: number): (number | null)[] =>
    arr.map((_, i) => i < n - 1 ? null : arr.slice(i - n + 1, i + 1).reduce((s, v) => s + v, 0) / n);

  const bollinger = (arr: number[], n = 20, k = 2) => {
    const mid = sma(arr, n);
    return {
      upper: arr.map((_, i) => { if (i < n - 1) return null; const sl = arr.slice(i-n+1,i+1), m = mid[i]!, std = Math.sqrt(sl.reduce((a,v)=>a+(v-m)**2,0)/n); return m+k*std; }),
      lower: arr.map((_, i) => { if (i < n - 1) return null; const sl = arr.slice(i-n+1,i+1), m = mid[i]!, std = Math.sqrt(sl.reduce((a,v)=>a+(v-m)**2,0)/n); return m-k*std; }),
    };
  };

  const calcRsi = (arr: number[], n = 14): (number | null)[] =>
    arr.map((_, i) => {
      if (i < n) return null;
      let g = 0, l = 0;
      for (let j = i - n + 1; j <= i; j++) { const d = arr[j] - arr[j-1]; if (d > 0) g += d; else l -= d; }
      const rs = g / (l || 0.001);
      return Math.round((100 - 100/(1+rs)) * 10) / 10;
    });

  const calcMacd = (arr: number[], fast = 12, slow = 26, sig = 9) => {
    const ema = (a: number[], n: number): (number | null)[] => {
      const k = 2/(n+1), r: (number|null)[] = Array(a.length).fill(null);
      r[n-1] = a.slice(0,n).reduce((s,v)=>s+v,0)/n;
      for (let i = n; i < a.length; i++) r[i] = a[i]*k + (r[i-1] as number)*(1-k);
      return r;
    };
    const fe = ema(arr,fast), se = ema(arr,slow);
    const ml = arr.map((_,i) => fe[i]!=null&&se[i]!=null ? (fe[i] as number)-(se[i] as number) : null);
    const valid = ml.filter((v): v is number => v!=null);
    const se2 = ema(valid, sig);
    let si = 0;
    const sl = ml.map(v => v!=null ? (se2[si++] ?? null) : null);
    const hist = ml.map((v,i) => v!=null&&sl[i]!=null ? v-(sl[i] as number) : null);
    return { ml, sl, hist };
  };

  // Build chart labels from trading day count
  const buildChartLabels = (count: number): string[] => {
    const labels: string[] = [], now = new Date();
    let added = 0, day = 0;
    while (added < count) {
      const d = new Date(now); d.setDate(d.getDate() - day);
      if (d.getDay() !== 0 && d.getDay() !== 6) { labels.unshift(d.toLocaleDateString("en-US",{month:"short",day:"numeric"})); added++; }
      day++;
    }
    return labels;
  };

  // Initialize/update charts when data or range changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    const prices = spxHistory.length >= 50 ? spxHistory : (() => {
      const pts: number[] = []; let p = (spxPrice ?? 6637) * 0.9;
      for (let i = 290; i >= 0; i--) { p *= (1+(Math.random()-0.484)*0.013); pts.push(Math.round(p*100)/100); }
      const scale = (spxPrice ?? 6637) / pts[pts.length-1];
      return pts.map(p => Math.round(p*scale*100)/100);
    })();

    const N = prices.length;
    const labels = buildChartLabels(N);
    const MA20 = sma(prices,20), MA50 = sma(prices,50), MA100 = sma(prices,100), MA200 = sma(prices,200);
    const BB = bollinger(prices,20,2);
    const RSI = calcRsi(prices,14);
    const MACD = calcMacd(prices,12,26,9);
    const current200 = MA200.filter((v): v is number => v!=null).slice(-1)[0] ?? (spxPrice ?? 6637)*0.97;
    const gridColor = "rgba(255,255,255,0.06)", tickColor = "#475569";

    const minIdx = Math.max(0, N - activeRange);

    const getYBounds = (mi: number) => {
      const vis = prices.slice(mi).filter((v): v is number => v!=null);
      const visUp = BB.upper.slice(mi).filter((v): v is number => v!=null);
      const yMax = Math.max(...vis.concat(visUp.length?[Math.max(...visUp)]:[])) * 1.003;
      const yMin = Math.min(Math.min(...vis)*0.997, current200*0.992);
      return { yMin, yMax };
    };

    const { yMin, yMax } = getYBounds(minIdx);

    const script = document.getElementById("chartjs-script");
    const initCharts = () => {
      const Chart = (window as any).Chart;
      if (!Chart) return;

      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
      if (rsiRef.current) { rsiRef.current.destroy(); rsiRef.current = null; }
      if (macdRef.current) { macdRef.current.destroy(); macdRef.current = null; }

      const xAxis = (showTicks: boolean) => ({
        min: labels[minIdx], max: labels[N-1],
        ticks: { display: showTicks, color: tickColor, font: { size: 10 }, maxTicksLimit: 8, maxRotation: 0 },
        grid: { color: gridColor }, border: { color: "rgba(255,255,255,0.1)" }
      });

      const priceEl = document.getElementById("spxPriceChart") as HTMLCanvasElement;
      const rsiEl = document.getElementById("spxRsiChart") as HTMLCanvasElement;
      const macdEl = document.getElementById("spxMacdChart") as HTMLCanvasElement;
      if (!priceEl || !rsiEl || !macdEl) return;

      chartRef.current = new Chart(priceEl, {
        type: "line",
        data: { labels, datasets: [
          { label:"BB Upper", data:BB.upper, borderColor:"rgba(0,0,0,0)", backgroundColor:"rgba(148,163,184,0.1)", fill:"+1", pointRadius:0, borderWidth:0, tension:0.3 },
          { label:"BB Lower", data:BB.lower, borderColor:"rgba(0,0,0,0)", fill:false, pointRadius:0, borderWidth:0, tension:0.3 },
          { label:"SPX",     data:prices, borderColor:"#60a5fa", backgroundColor:"transparent", pointRadius:0, borderWidth:2, tension:0.2 },
          { label:"20-DMA",  data:MA20,   borderColor:"#fbbf24", backgroundColor:"transparent", pointRadius:0, borderWidth:1.5, tension:0.3 },
          { label:"50-DMA",  data:MA50,   borderColor:"#a78bfa", backgroundColor:"transparent", pointRadius:0, borderWidth:1.5, tension:0.3 },
          { label:"100-DMA", data:MA100,  borderColor:"#f97316", backgroundColor:"transparent", pointRadius:0, borderWidth:1.5, tension:0.3 },
          { label:"200-DMA", data:MA200,  borderColor:"#ef4444", backgroundColor:"transparent", pointRadius:0, borderWidth:2,   tension:0.3 },
        ]},
        options: {
          responsive:true, maintainAspectRatio:false, interaction:{mode:"index",intersect:false},
          plugins:{ legend:{display:false}, tooltip:{backgroundColor:"#0f153f",borderColor:"#1e293b",borderWidth:1,titleColor:"#cbd5e1",bodyColor:"#94a3b8",titleFont:{size:11},bodyFont:{size:11}, callbacks:{label:(ctx:any)=>ctx.dataset.label.startsWith("BB")?null:`${ctx.dataset.label}: ${ctx.parsed.y!=null?Math.round(ctx.parsed.y).toLocaleString():"—"}`}}},
          scales:{ x:xAxis(true), y:{min:yMin,max:yMax,ticks:{color:tickColor,font:{size:10},callback:(v:any)=>v>=1000?(v/1000).toFixed(1)+"k":v},grid:{color:gridColor},border:{color:"rgba(255,255,255,0.1)"}}}
        }
      });

      rsiRef.current = new Chart(rsiEl, {
        type:"line",
        data:{labels,datasets:[
          {data:Array(N).fill(70),borderColor:"rgba(255,107,136,0.25)",pointRadius:0,borderWidth:1,borderDash:[4,4],fill:false},
          {data:Array(N).fill(30),borderColor:"rgba(74,222,128,0.25)",pointRadius:0,borderWidth:1,borderDash:[4,4],fill:false},
          {label:"RSI",data:RSI,borderColor:"#c084fc",backgroundColor:"transparent",pointRadius:0,borderWidth:1.5,tension:0.3}
        ]},
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:"#0f153f",borderColor:"#1e293b",borderWidth:1,titleColor:"#cbd5e1",bodyColor:"#94a3b8",titleFont:{size:11},bodyFont:{size:11}}},
          scales:{x:xAxis(false),y:{min:0,max:100,ticks:{color:tickColor,font:{size:10},stepSize:25},grid:{color:gridColor},border:{color:"rgba(255,255,255,0.1)"}}}}
      });

      macdRef.current = new Chart(macdEl, {
        type:"bar",
        data:{labels,datasets:[
          {type:"bar",  label:"Hist",   data:MACD.hist, backgroundColor:MACD.hist.map((v:any)=>v==null?"transparent":v>=0?"rgba(74,222,128,0.5)":"rgba(255,107,136,0.5)"),borderWidth:0},
          {type:"line", label:"MACD",   data:MACD.ml,   borderColor:"#60a5fa",pointRadius:0,borderWidth:1.5,tension:0.3},
          {type:"line", label:"Signal", data:MACD.sl,   borderColor:"#f97316",pointRadius:0,borderWidth:1.5,tension:0.3}
        ]},
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:"#0f153f",borderColor:"#1e293b",borderWidth:1,titleColor:"#cbd5e1",bodyColor:"#94a3b8",titleFont:{size:11},bodyFont:{size:11}}},
          scales:{x:xAxis(false),y:{ticks:{color:tickColor,font:{size:10},maxTicksLimit:4},grid:{color:gridColor},border:{color:"rgba(255,255,255,0.1)"}}}}
      });
    };

    if (!(window as any).Chart) {
      if (!document.getElementById("chartjs-script")) {
        const s = document.createElement("script");
        s.id = "chartjs-script";
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
        s.onload = initCharts;
        document.head.appendChild(s);
      } else {
        const wait = setInterval(() => { if ((window as any).Chart) { clearInterval(wait); initCharts(); } }, 100);
      }
    } else {
      initCharts();
    }
  }, [spxHistory, spxPrice, activeRange]);

  const HistRow = ({ val, event, note, active }: { val: string; event: string; note: string; active?: boolean }) => (
    <div style={{ display:"grid", gridTemplateColumns:"56px 1fr 1fr", gap:8, background:active?"#141b47":"#0b1138", border:`1px solid ${active?"rgba(245,158,11,0.4)":"#1e293b"}`, borderRadius:7, padding:"8px 10px", fontSize:12, color:"#e2e8f0" }}>
      <div style={{ fontWeight:700, fontSize:13, color:active?"#fff":"#cbd5e1" }}>{val}</div>
      <div>{event}</div>
      <div style={{ color:active?"#fbbf24":"#64748b" }}>{note}</div>
    </div>
  );

  const ModalWrapper = ({ onClose, title, sub, children }: { onClose:()=>void; title:string; sub:string; children:React.ReactNode }) => (
    <div style={{ position:"fixed", inset:0, zIndex:50, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={onClose}>
      <div style={{ width:"100%", maxWidth:1000, background:"#0f153f", border:"1px solid #1e293b", borderRadius:18, padding:24, maxHeight:"90vh", overflowY:"auto" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
          <div><div style={{ fontSize:22, fontWeight:700 }}>{title}</div><div style={{ fontSize:12, color:"#64748b", marginTop:4 }}>{sub}</div></div>
          <button style={{ background:"#1f2937", border:0, borderRadius:8, color:"#e2e8f0", padding:"8px 14px", fontSize:13, fontWeight:600, cursor:"pointer" }} onClick={onClose}>Close ✕</button>
        </div>
        {children}
      </div>
    </div>
  );

  const ModalGrid = ({ left, right }: { left:React.ReactNode; right:React.ReactNode }) => (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
      <div style={{ background:"#050a35", borderRadius:12, padding:16 }}>{left}</div>
      <div style={{ display:"grid", gap:12 }}>{right}</div>
    </div>
  );

  const MCard = ({ children }: { children:React.ReactNode }) => <div style={{ background:"#050a35", borderRadius:12, padding:14 }}>{children}</div>;
  const SH = ({ children }: { children:React.ReactNode }) => <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em", color:"#64748b", marginBottom:7 }}>{children}</div>;
  const BC = ({ children }: { children:React.ReactNode }) => <div style={{ fontSize:13, lineHeight:1.7, color:"#cbd5e1", marginTop:8 }}>{children}</div>;
  const Tag = ({ label, color, bg }: { label:string; color:string; bg:string }) => <span style={{ display:"inline-block", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em", padding:"2px 9px", borderRadius:20, color, background:bg, marginBottom:8 }}>{label}</span>;
  const ActionCard = ({ children }: { children:React.ReactNode }) => (
    <div style={{ background:"#031e1a", border:"1px solid rgba(34,197,94,0.25)", borderRadius:10, padding:12 }}>
      <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em", color:"#fbbf24", marginBottom:6 }}>Your action</div>
      <div style={{ fontSize:13, lineHeight:1.6, color:"#ecfdf5" }}>{children}</div>
    </div>
  );
  const BandTrack = ({ segs, needle, scaleNums, scaleNames }: { segs:{w:string;color:string}[]; needle:number; scaleNums:string[]; scaleNames:string[] }) => (
    <div style={{ marginTop:12 }}>
      <div style={{ height:8, borderRadius:9999, overflow:"hidden", display:"flex", marginBottom:4 }}>{segs.map((s,i)=><div key={i} style={{ width:s.w, height:8, background:s.color }} />)}</div>
      <div style={{ position:"relative", height:12, marginBottom:2 }}><div style={{ position:"absolute", top:0, left:`${needle}%`, width:2, height:12, background:"#fff", borderRadius:1, transform:"translateX(-50%)" }} /></div>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"#475569", marginBottom:2 }}>{scaleNums.map((s,i)=><span key={i}>{s}</span>)}</div>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, fontWeight:700, textTransform:"uppercase", color:"#64748b" }}>{scaleNames.map((s,i)=><span key={i}>{s}</span>)}</div>
    </div>
  );

  const rangeBtn = (label: string, days: number) => (
    <button key={days} onClick={() => setActiveRange(days)} style={{ padding:"4px 10px", borderRadius:6, fontSize:11, fontWeight:600, border:`1px solid ${activeRange===days?"rgba(99,179,237,0.5)":"rgba(255,255,255,0.15)"}`, background:activeRange===days?"rgba(99,179,237,0.15)":"transparent", color:activeRange===days?"#93c5fd":"#94a3b8", cursor:"pointer" }}>{label}</button>
  );

  return (
    <>
      <div className="pageShell">
        <div className="frame">

          {/* TOP BAR */}
          <div className="topBar">
            <h1 className="title">Prospect Market Dashboard <a href="/research" style={{ fontSize:13, fontWeight:600, color:"#93c5fd", marginLeft:12, textDecoration:"none" }}>Research →</a></h1>
            <div className="topRight">
              <div className="liveDot">
                <span className={feedError ? "dot dotError" : "dot dotLive"} />
                <span className="dotLabel">
                  {feedError ? "Feed error" : <>Live<span className="hideMobile"> · 60s refresh</span></>}
                </span>
              </div>
              <div className="meta">
                <div className="sourceLabel">{feedError ? "Data unavailable" : "Live data"}</div>
                <div>{feedError ? "Feed error" : lastUpdated ? `Refreshed ${lastUpdated}` : "Loading..."}</div>
              </div>
            </div>
          </div>

          {feedError && <div className="errorBar">Feed error: {feedError}</div>}

          {/* Stale-data notice: a live fetch failed and a manual fallback is
              standing in. Shows the value and its as-of date so an old number
              is never read as live. Hidden when everything is live. */}
          {(() => {
            const fb: { name: string; value: number; asOf: string }[] = marketData?.fallbacks_in_use ?? [];
            if (!fb.length) return null;
            return (
              <div style={{ margin:"0 0 12px", padding:"8px 12px", borderRadius:8, border:"1px solid rgba(251,191,36,0.35)", background:"rgba(251,191,36,0.08)", color:"#fbbf24", fontSize:12, lineHeight:1.5 }}>
                <strong>Live fetch failed:</strong> using estimates or manual values for{" "}
                {fb.map((f, i) => (
                  <span key={f.name}>{i > 0 ? ", " : ""}{f.name} ({f.value}, {f.asOf.startsWith("est.") ? f.asOf : `as of ${f.asOf}`})</span>
                ))}
              </div>
            );
          })()}


          {/* WEEKLY VIEW · STORY LINE. Plan: hold M26 and rebalance. A call to
              Chris is worth it only when trend, credit and economy turn
              together. All logic lives in route.ts (weekly_view). */}
          {(() => {
            const wv = marketData?.weekly_view;
            if (!wv) return null;
            const lvl = wv.call?.level;
            const callColor = lvl === "call_worse" ? "#ff6b88" : lvl === "call_better" ? "#4ade80" : lvl === "watch" ? "#fbbf24" : "#94a3b8";
            const callBadge = lvl === "call_worse" || lvl === "call_better" ? "CALL CHRIS" : lvl === "watch" ? "WATCH" : "HOLD";
            return (
              <section className="panel" style={{ marginBottom:16, borderLeft:`4px solid ${callColor}` }}>
                <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap", marginBottom:8 }}>
                  <span style={{ fontSize:11, fontWeight:800, letterSpacing:"0.1em", padding:"3px 10px", borderRadius:20, color:"#0b1020", background:callColor }}>{callBadge}</span>
                  <span style={{ fontSize:11, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700 }}>This week&apos;s read · {new Date().toLocaleDateString("en-US", { month:"short", day:"numeric" })}</span>
                </div>
                <div style={{ fontSize:20, fontWeight:700, color:"#f1f5f9", lineHeight:1.4 }}>{wv.story}</div>

                {/* Signal dots: the five signals at a glance */}
                <div style={{ display:"flex", flexWrap:"wrap", gap:"6px 16px", marginTop:12 }}>
                  {(wv.signals ?? []).map((sg: any) => (
                    <span key={sg.key} style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:13, color:"#cbd5e1", fontWeight:600 }}>
                      <span style={{ width:9, height:9, borderRadius:"50%", background: sg.tone === "red" ? "#ff6b88" : sg.tone === "yellow" ? "#fbbf24" : "#4ade80" }} />
                      {sg.title}
                    </span>
                  ))}
                </div>

                {/* What would change the call */}
                {(wv.tripwires ?? []).length > 0 && (
                  <div style={{ marginTop:12, display:"grid", gridTemplateColumns:"auto 1fr", columnGap:10, rowGap:4, fontSize:13, lineHeight:1.45 }}>
                    {(wv.tripwires ?? []).map((t: any) => (
                      <Fragment key={t.level}>
                        <span style={{ fontWeight:800, fontSize:11, letterSpacing:"0.06em", color: t.level === "WATCH" ? "#fbbf24" : "#ff6b88", paddingTop:2 }}>{t.level}</span>
                        <span style={{ color:"#94a3b8" }}>{t.text}</span>
                      </Fragment>
                    ))}
                  </div>
                )}

                <div style={{ marginTop:12, paddingTop:10, borderTop:"1px solid rgba(255,255,255,0.06)", display:"flex", flexWrap:"wrap", gap:"4px 20px", fontSize:12, color:"#94a3b8" }}>
                  {(wv.keyDates ?? []).length > 0 && (
                    <span><b style={{ color:"#cbd5e1" }}>Key dates:</b> {(wv.keyDates ?? []).map((k: any) => `${new Date(k.date + "T12:00:00").toLocaleDateString("en-US", { month:"short", day:"numeric" })} ${k.item.replace(/\s*\(.*\)/, "")}`).join(" · ")}</span>
                  )}
                  <span style={{ color:callColor, fontWeight:600 }}>{wv.call?.text}</span>
                </div>
              </section>
            );
          })()}

          {/* ① MARKET STRUCTURE */}
          <section className="panel">
            <div className="panelHeader">
              <div><div className="panelTitle">Market Structure</div><div className="panelSub">Price vs Key Moving Averages</div></div>
              <div className="damage" style={{ color: nextReclaim ? "#fbbf24" : "#4ade80" }}>
                {spxPrice == null ? "" : nextReclaim
                  ? `Next level to reclaim: ${nextReclaim.label} ${fmtWhole(nextReclaim.level)} (+${(((nextReclaim.level - spxPrice) / spxPrice) * 100).toFixed(1)}%)`
                  : "Above all 4 averages"}
              </div>
            </div>

            <div className="grid5" style={{ marginBottom:8 }}>
              {/* Tile 1: SPX Price — stacked rows (Today, YTD) matching the
                  portfolio tiles' layout. No arrow/Gap here — those apply
                  to the DMA tiles below, not to the raw index itself. */}
              <div className="tile">
                <div className="tileTop"><span className="lbl">S&P 500</span></div>
                <div className="valHero">{spxPrice != null ? fmtWhole(spxPrice) : "—"}</div>
                <div className="sparkWrap" dangerouslySetInnerHTML={{ __html: sparkline(spxTrend, spxDailyPct != null && spxDailyPct >= 0 ? "#4ade80" : "#ff6b88") }} />
                <div style={{ display:"grid", gridTemplateColumns:"auto 1fr", columnGap:8, rowGap:3, marginTop:8 }}>
                  <div style={{ fontSize:9, color:"#475569", fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase" }}>Today</div>
                  <div style={{ fontSize:15, fontWeight:700, textAlign:"right", color: spxDailyPct == null ? "#cbd5e1" : spxDailyPct >= 0 ? "#4ade80" : "#ff6b88" }}>
                    {spxDailyPct != null ? `${spxDailyPct >= 0 ? "+" : ""}${spxDailyPct.toFixed(1)}%` : "—"}
                  </div>
                  <div style={{ fontSize:9, color:"#475569", fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase" }}>YTD</div>
                  <div style={{ fontSize:15, fontWeight:700, textAlign:"right", color: spxYtd >= 0 ? "#4ade80" : "#ff6b88" }}>
                    {spxYtd >= 0 ? "+" : ""}{spxYtd.toFixed(1)}%
                  </div>
                  <div style={{ fontSize:9, color:"#475569", fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase" }}>From high</div>
                  <div style={{ fontSize:15, fontWeight:700, textAlign:"right", color: offHigh == null ? "#cbd5e1" : offHigh > -5 ? "#cbd5e1" : offHigh > -10 ? "#fbbf24" : "#ff6b88" }}>
                    {offHigh != null ? `${offHigh.toFixed(1)}%` : "—"}
                  </div>
                </div>
              </div>

              {/* Tile 2: 200-DMA — stacked rows with a slope arrow to the
                  left of Today, then Gap (this tile's own differentiator).
                  YTD dropped — it repeated the same index-level number
                  across every DMA tile without adding anything unique.
                  Arrow direction only, not scaled by magnitude. */}
              {(() => {
                const isNear = spx200Pct != null && spx200Pct >= 0 && spx200Pct <= 3;
                const tileClass = is200Broken ? "tile tile200Red" : isNear ? "tile tile200" : "tile";
                const badgeBg = is200Broken ? "#ef4444" : "#f59e0b";
                const statusColor = is200Broken ? "#ff6b88" : isNear ? "#fbbf24" : "#4ade80";
                const subColor = is200Broken ? "#ff6b88" : isNear ? "#f59e0b" : "#4ade80";
                const arrow = slope200 == null ? null : slope200 > 0.02 ? "↗" : slope200 < -0.02 ? "↘" : "→";
                const arrowColor = slope200 == null ? "#475569" : slope200 > 0.02 ? "#4ade80" : slope200 < -0.02 ? "#ff6b88" : "#fbbf24";
                return (
                  <div className={tileClass} style={{ cursor:"pointer" }} onClick={() => setModal("dma200")}>
                    <div className="tileTop">
                      <span className="lbl">200-DMA</span>
                      {(is200Broken || isNear) && <span className="badge" style={{ background: badgeBg, color:"#000" }}>!</span>}
                    </div>
                    <div className="valHero">{fmtWhole(spx200)}</div>
                    <div className="status" style={{ color: statusColor }}>
                      {dmaState(spx200Pct, slope200, true)}
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"14px auto 1fr", columnGap:6, rowGap:3, marginTop:8, alignItems:"center" }}>
                      <span style={{ fontSize:12, fontWeight:700, color: arrowColor }}>{arrow ?? ""}</span>
                      <div style={{ fontSize:9, color:"#475569", fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase" }}>Gap</div>
                      <div style={{ fontSize:15, fontWeight:700, textAlign:"right", color: subColor }}>{spx200Pct != null ? fmtSigned1(spx200Pct) : "—"}</div>
                    </div>
                    {spxPrice != null && <div style={{ fontSize:11, color:"#94a3b8", marginTop:6 }}>{is200Broken ? `Needs +${Math.round(spx200 - spxPrice)} pts` : `${Math.round(spxPrice - spx200)} pts cushion`}</div>}
                    <div style={{ fontSize:11, color: arrowColor, marginTop:2 }}>Slope {slope200 == null ? "—" : `${slope200 > 0 ? "+" : ""}${slope200.toFixed(1)}%`} {slope200 != null && slope200 > 0.02 ? "· still rising" : slope200 != null && slope200 < -0.02 ? "· falling" : ""}</div>
                  </div>
                );
              })()}

              {/* Tiles 3-5: 100 / 50 / 20-DMA — same stacked layout as
                  tile 2, YTD dropped for the same reason. */}
              {[
                { label:"100-DMA", level:spx100, slope:slope100 },
                { label:"50-DMA",  level:spx50,  slope:slope50  },
                { label:"20-DMA",  level:spx20,  slope:slope20  },
              ].map(d => {
                const pct = spxVs(d.level); const tone = dmaTone(pct, d.slope);
                const arrow = d.slope == null ? null : d.slope > 0.02 ? "↗" : d.slope < -0.02 ? "↘" : "→";
                const arrowColor = d.slope == null ? "#475569" : d.slope > 0.02 ? "#4ade80" : d.slope < -0.02 ? "#ff6b88" : "#fbbf24";
                return (
                  <div key={d.label} className="tile">
                    <div className="tileTop"><span className="lbl">{d.label}</span><span className="badge" style={{ background:toneColor(tone), color:tone==="warning"?"#000":"#fff" }}>!</span></div>
                    <div className="valHero">{fmtWhole(d.level)}</div>
                    <div className="status" style={{ color:toneColor(tone) }}>{dmaState(pct, d.slope)}</div>
                    <div style={{ display:"grid", gridTemplateColumns:"14px auto 1fr", columnGap:6, rowGap:3, marginTop:8, alignItems:"center" }}>
                      <span style={{ fontSize:12, fontWeight:700, color: arrowColor }}>{arrow ?? ""}</span>
                      <div style={{ fontSize:9, color:"#475569", fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase" }}>Gap</div>
                      <div style={{ fontSize:15, fontWeight:700, textAlign:"right", color: toneColor(tone) }}>{pct != null ? fmtSigned1(pct) : "—"}</div>
                    </div>
                    {spxPrice != null && d.level != null && <div style={{ fontSize:11, color:"#94a3b8", marginTop:6 }}>{pct != null && pct < 0 ? `Needs +${Math.round(d.level - spxPrice)} pts` : `${Math.round(spxPrice - d.level)} pts cushion`}</div>}
                  </div>
                );
              })}
            </div>

            {/* 200-DMA clock (Roberts): 4-week window after the first break.
                Replaces the old red "Critical" strip. */}
            {(() => {
              const ck = marketData?.weekly_view?.clock;
              if (!ck || spxPrice == null || spx200 == null) return null;
              const reclaimed = !is200Broken;
              const pctNeeded = ((spx200 - spxPrice) / spxPrice) * 100;
              const color = reclaimed ? "#4ade80" : ck.expired ? "#ff6b88" : "#fbbf24";
              const deadline = new Date(ck.deadline + "T12:00:00").toLocaleDateString("en-US", { month:"short", day:"numeric" });
              return (
                <div style={{ border:`1px solid ${color}55`, background:`${color}0f`, borderRadius:10, padding:"10px 14px" }}>
                  <div style={{ display:"flex", flexWrap:"wrap", alignItems:"baseline", gap:"4px 14px" }}>
                    <span style={{ fontSize:11, fontWeight:800, letterSpacing:"0.08em", color }}>200-DMA CLOCK</span>
                    <span style={{ fontSize:13, color:"#cbd5e1", fontWeight:600 }}>Day {ck.day} of {ck.total} trading days · deadline {deadline}</span>
                    <span style={{ fontSize:13, color, fontWeight:700, marginLeft:"auto" }}>
                      {reclaimed ? `Reclaimed · ${Math.round(spxPrice - spx200)} pts above` : `Needs +${Math.round(spx200 - spxPrice)} pts (+${pctNeeded.toFixed(1)}%)`}
                    </span>
                  </div>
                  <div style={{ display:"flex", gap:3, margin:"8px 0 6px" }}>
                    {Array.from({ length: ck.total }).map((_, i) => (
                      <div key={i} style={{ flex:1, height:6, borderRadius:2, background: i < ck.day ? color : "rgba(255,255,255,0.08)" }} />
                    ))}
                  </div>
                  <div style={{ fontSize:12, color:"#94a3b8", lineHeight:1.45 }}>
                    {ck.expired
                      ? (reclaimed ? "Clock closed with the 200-DMA reclaimed. The first break healed." : "Clock expired below the 200-DMA. Historically a deeper correction becomes more likely (Roberts).")
                      : "Reclaim by the deadline and the first break likely heals. Miss it and a deeper correction becomes more likely (Roberts)."}
                  </div>
                </div>
              );
            })()}
          </section>


          {/* WEEKLY VIEW · FIVE SIGNALS + CONTEXT. The first three (trend,
              credit, economy) decide whether a call is worth it. Earnings and
              the Fed explain why. The context row never triggers anything. */}
          {(() => {
            const wv = marketData?.weekly_view;
            if (!wv) return null;
            const TONE: Record<string, string> = { green:"#4ade80", yellow:"#fbbf24", red:"#ff6b88" };
            const dirColor = (d: string) => d === "better" ? "#4ade80" : d === "worse" ? "#ff6b88" : "#94a3b8";
            const dirArrow = (d: string) => d === "better" ? "▲" : d === "worse" ? "▼" : "•";
            const Tile = ({ s, core }: { s: AnyObj; core: boolean }) => (
              <div style={{ background:"#050a35", borderRadius:12, padding:14, borderTop:`3px solid ${TONE[s.tone] ?? "#94a3b8"}`, display:"flex", flexDirection:"column", gap:4 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em", color:"#64748b" }}>{s.title}{core ? " · core" : ""}</span>
                  <span style={{ width:9, height:9, borderRadius:9999, background:TONE[s.tone] ?? "#94a3b8" }} />
                </div>
                {s.question && <div style={{ fontSize:11, color:"#475569" }}>{s.question}</div>}
                <div style={{ display:"flex", alignItems:"baseline", gap:6, marginTop:2 }}>
                  <span style={{ fontSize:26, fontWeight:800, color:"#fff" }}>{s.value}</span>
                  <span style={{ fontSize:11, color:"#64748b" }}>{s.unit}</span>
                </div>
                <div style={{ fontSize:13, fontWeight:700, color:TONE[s.tone] ?? "#94a3b8" }}>{s.label}</div>
                {s.weekChange && <div style={{ fontSize:11, fontWeight:600, color:dirColor(s.direction) }}>{dirArrow(s.direction)} {s.weekChange}</div>}
                <div style={{ fontSize:11, color:"#94a3b8", lineHeight:1.5, marginTop:2 }}>{s.detail}</div>
              </div>
            );
            return (
              <section className="panel" style={{ marginBottom:16 }}>
                <div className="panelHeader">
                  <div><div className="panelTitle">The Five Signals</div><div className="panelSub">Trend, credit and economy are the core. All three turning together is worth a call to Chris.</div></div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(190px, 1fr))", gap:10 }}>
                  {wv.signals.map((s: AnyObj, i: number) => <Tile key={s.key} s={s} core={i < 3} />)}
                </div>
                <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em", color:"#475569", margin:"16px 0 8px" }}>Context · explains the story, never triggers a call</div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(190px, 1fr))", gap:10 }}>
                  {wv.context.map((s: AnyObj) => <Tile key={s.key} s={s} core={false} />)}
                </div>
              </section>
            );
          })()}

          {/* ①-B PORTFOLIO POSITION HEALTH — live per-holding 200-DMA status */}
          <section className="panel">
            <div className="panelHeader">
              <div>
                <div className="panelTitle">Portfolio Position Health</div>
              </div>
              <div className="pstamp">LIVE · Yahoo Finance</div>
            </div>

            {/* Row group label — small, uppercase, matches the style already
                used elsewhere on the dashboard for row/section labels. */}
            <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", color:"#475569", marginBottom:6 }}>
              My Current Allocation
            </div>

            {/* Portfolio YTD is an ESTIMATE: weight × each position's own YTD
                return, held constant since Jan 1. Will drift from actual
                brokerage-reported return if rebalanced. Grid5 matches the
                tile width of the position cards below. Today's change below
                the hero number uses the same red/green convention as the
                position tiles' Today column. CUR now sits alone in its own
                row — index benchmarks and candidate portfolios moved to
                their own rows below, so the read is "my current alloc,
                then the index comparisons, then what I'm considering". */}
            <div className="grid5" style={{ marginBottom:16 }}>
              <div className="tile" style={{ cursor:"pointer" }} onClick={() => { setModal("portfolioDetail"); setDetailKey("cur"); }}>
                <div className="lbl">M25 40/55/5 YTD</div>
                <div className="valHero">
                  {portfolioYtdPct != null ? `${portfolioYtdPct >= 0 ? "+" : ""}${portfolioYtdPct.toFixed(1)}%` : "—"}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"auto 1fr", columnGap:8, rowGap:3, marginTop:8 }}>
                  <div style={{ fontSize:9, color:"#475569", fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase" }}>Today</div>
                  <div style={{ fontSize:15, fontWeight:700, textAlign:"right", color: portfolioTodayPct == null ? "#cbd5e1" : portfolioTodayPct >= 0 ? "#4ade80" : "#ff6b88" }}>
                    {portfolioTodayPct != null ? `${portfolioTodayPct >= 0 ? "+" : ""}${portfolioTodayPct.toFixed(1)}%` : "—"}
                  </div>
                  <div style={{ fontSize:9, color:"#475569", fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase" }}>1-YR</div>
                  <div style={{ fontSize:15, fontWeight:700, textAlign:"right", color: portfolioOneYearPct == null ? "#cbd5e1" : portfolioOneYearPct >= 0 ? "#4ade80" : "#ff6b88" }}>
                    {portfolioOneYearPct != null ? `${portfolioOneYearPct >= 0 ? "+" : ""}${portfolioOneYearPct.toFixed(1)}%` : "—"}
                  </div>
                  <div style={{ fontSize:9, color:"#475569", fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase" }}>5-YR</div>
                  <div style={{ fontSize:15, fontWeight:700, textAlign:"right", color: portfolioFiveYearPct == null ? "#cbd5e1" : portfolioFiveYearPct >= 0 ? "#4ade80" : "#ff6b88" }}>
                    {portfolioFiveYearPct != null ? `${portfolioFiveYearPct >= 0 ? "+" : ""}${portfolioFiveYearPct.toFixed(1)}%` : "—"}
                  </div>
                </div>
              </div>
              {/* M2 50/40/10 added here as tile #2 — this is the allocation
                  for the remainder of the year, sitting alongside CUR
                  40/55/5 (the allocation through early Sept) so the two are
                  directly comparable as "before" and "after". */}
              <div className="tile" style={{ cursor:"pointer" }} onClick={() => { setModal("portfolioDetail"); setDetailKey("m2"); }}>
                <div className="lbl">M26 50/40/10 YTD</div>
                <div className="valHero">
                  {m2YtdPct != null ? `${m2YtdPct >= 0 ? "+" : ""}${m2YtdPct.toFixed(1)}%` : "—"}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"auto 1fr", columnGap:8, rowGap:3, marginTop:8 }}>
                  <div style={{ fontSize:9, color:"#475569", fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase" }}>Today</div>
                  <div style={{ fontSize:15, fontWeight:700, textAlign:"right", color: m2TodayPct == null ? "#cbd5e1" : m2TodayPct >= 0 ? "#4ade80" : "#ff6b88" }}>
                    {m2TodayPct != null ? `${m2TodayPct >= 0 ? "+" : ""}${m2TodayPct.toFixed(1)}%` : "—"}
                  </div>
                  <div style={{ fontSize:9, color:"#475569", fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase" }}>1-YR</div>
                  <div style={{ fontSize:15, fontWeight:700, textAlign:"right", color: m2OneYearPct == null ? "#cbd5e1" : m2OneYearPct >= 0 ? "#4ade80" : "#ff6b88" }}>
                    {m2OneYearPct != null ? `${m2OneYearPct >= 0 ? "+" : ""}${m2OneYearPct.toFixed(1)}%` : "—"}
                  </div>
                  <div style={{ fontSize:9, color:"#475569", fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase" }}>5-YR</div>
                  <div style={{ fontSize:15, fontWeight:700, textAlign:"right", color: m2FiveYearPct == null ? "#cbd5e1" : m2FiveYearPct >= 0 ? "#4ade80" : "#ff6b88" }}>
                    {m2FiveYearPct != null ? `${m2FiveYearPct >= 0 ? "+" : ""}${m2FiveYearPct.toFixed(1)}%` : "—"}
                  </div>
                </div>
              </div>
              {/* M27: draft for the January conversation with Chris, tracked early. */}
              <div className="tile" style={{ cursor:"pointer" }} onClick={() => { setModal("portfolioDetail"); setDetailKey("m27"); }}>
                <div className="lbl">M27 50/42/8 YTD <span style={{ color:"#93c5fd", fontWeight:700 }}>· draft</span></div>
                <div className="valHero">
                  {m27YtdPct != null ? `${m27YtdPct >= 0 ? "+" : ""}${m27YtdPct.toFixed(1)}%` : "—"}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"auto 1fr", columnGap:8, rowGap:3, marginTop:8 }}>
                  <div style={{ fontSize:9, color:"#475569", fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase" }}>Today</div>
                  <div style={{ fontSize:15, fontWeight:700, textAlign:"right", color: m27TodayPct == null ? "#cbd5e1" : m27TodayPct >= 0 ? "#4ade80" : "#ff6b88" }}>
                    {m27TodayPct != null ? `${m27TodayPct >= 0 ? "+" : ""}${m27TodayPct.toFixed(1)}%` : "—"}
                  </div>
                  <div style={{ fontSize:9, color:"#475569", fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase" }}>1-YR</div>
                  <div style={{ fontSize:15, fontWeight:700, textAlign:"right", color: m27OneYearPct == null ? "#cbd5e1" : m27OneYearPct >= 0 ? "#4ade80" : "#ff6b88" }}>
                    {m27OneYearPct != null ? `${m27OneYearPct >= 0 ? "+" : ""}${m27OneYearPct.toFixed(1)}%` : "—"}
                  </div>
                  <div style={{ fontSize:9, color:"#475569", fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase" }}>5-YR</div>
                  <div style={{ fontSize:15, fontWeight:700, textAlign:"right", color: m27FiveYearPct == null ? "#cbd5e1" : m27FiveYearPct >= 0 ? "#4ade80" : "#ff6b88" }}>
                    {m27FiveYearPct != null ? `${m27FiveYearPct >= 0 ? "+" : ""}${m27FiveYearPct.toFixed(1)}%` : "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* Row 2 — the four passive index benchmarks, on their own row
                now that CUR has row 1 to itself. */}
            <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", color:"#475569", marginBottom:6 }}>
              Index Benchmarks
            </div>
            <div className="grid5" style={{ marginBottom:16 }}>
              <div className="tile" style={{ cursor:"pointer" }} onClick={() => { setModal("portfolioDetail"); setDetailKey("idx4060"); }}>
                <div className="lbl">40/60 Index YTD</div>
                <div className="valHero">
                  {benchmark4060YtdPct != null ? `${benchmark4060YtdPct >= 0 ? "+" : ""}${benchmark4060YtdPct.toFixed(1)}%` : "—"}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"auto 1fr", columnGap:8, rowGap:3, marginTop:8 }}>
                  <div style={{ fontSize:9, color:"#475569", fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase" }}>Today</div>
                  <div style={{ fontSize:15, fontWeight:700, textAlign:"right", color: benchmark4060TodayPct == null ? "#cbd5e1" : benchmark4060TodayPct >= 0 ? "#4ade80" : "#ff6b88" }}>
                    {benchmark4060TodayPct != null ? `${benchmark4060TodayPct >= 0 ? "+" : ""}${benchmark4060TodayPct.toFixed(1)}%` : "—"}
                  </div>
                  <div style={{ fontSize:9, color:"#475569", fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase" }}>1-YR</div>
                  <div style={{ fontSize:15, fontWeight:700, textAlign:"right", color: benchmark4060OneYearPct == null ? "#cbd5e1" : benchmark4060OneYearPct >= 0 ? "#4ade80" : "#ff6b88" }}>
                    {benchmark4060OneYearPct != null ? `${benchmark4060OneYearPct >= 0 ? "+" : ""}${benchmark4060OneYearPct.toFixed(1)}%` : "—"}
                  </div>
                  <div style={{ fontSize:9, color:"#475569", fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase" }}>5-YR</div>
                  <div style={{ fontSize:15, fontWeight:700, textAlign:"right", color: benchmark4060FiveYearPct == null ? "#cbd5e1" : benchmark4060FiveYearPct >= 0 ? "#4ade80" : "#ff6b88" }}>
                    {benchmark4060FiveYearPct != null ? `${benchmark4060FiveYearPct >= 0 ? "+" : ""}${benchmark4060FiveYearPct.toFixed(1)}%` : "—"}
                  </div>
                </div>
              </div>
              <div className="tile" style={{ cursor:"pointer" }} onClick={() => { setModal("portfolioDetail"); setDetailKey("idx5050"); }}>
                <div className="lbl">50/50 Index YTD</div>
                <div className="valHero">
                  {benchmark5050YtdPct != null ? `${benchmark5050YtdPct >= 0 ? "+" : ""}${benchmark5050YtdPct.toFixed(1)}%` : "—"}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"auto 1fr", columnGap:8, rowGap:3, marginTop:8 }}>
                  <div style={{ fontSize:9, color:"#475569", fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase" }}>Today</div>
                  <div style={{ fontSize:15, fontWeight:700, textAlign:"right", color: benchmark5050TodayPct == null ? "#cbd5e1" : benchmark5050TodayPct >= 0 ? "#4ade80" : "#ff6b88" }}>
                    {benchmark5050TodayPct != null ? `${benchmark5050TodayPct >= 0 ? "+" : ""}${benchmark5050TodayPct.toFixed(1)}%` : "—"}
                  </div>
                  <div style={{ fontSize:9, color:"#475569", fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase" }}>1-YR</div>
                  <div style={{ fontSize:15, fontWeight:700, textAlign:"right", color: benchmark5050OneYearPct == null ? "#cbd5e1" : benchmark5050OneYearPct >= 0 ? "#4ade80" : "#ff6b88" }}>
                    {benchmark5050OneYearPct != null ? `${benchmark5050OneYearPct >= 0 ? "+" : ""}${benchmark5050OneYearPct.toFixed(1)}%` : "—"}
                  </div>
                  <div style={{ fontSize:9, color:"#475569", fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase" }}>5-YR</div>
                  <div style={{ fontSize:15, fontWeight:700, textAlign:"right", color: benchmark5050FiveYearPct == null ? "#cbd5e1" : benchmark5050FiveYearPct >= 0 ? "#4ade80" : "#ff6b88" }}>
                    {benchmark5050FiveYearPct != null ? `${benchmark5050FiveYearPct >= 0 ? "+" : ""}${benchmark5050FiveYearPct.toFixed(1)}%` : "—"}
                  </div>
                </div>
              </div>
              <div className="tile" style={{ cursor:"pointer" }} onClick={() => { setModal("portfolioDetail"); setDetailKey("idx6040"); }}>
                <div className="lbl">60/40 Index YTD</div>
                <div className="valHero">
                  {benchmark6040YtdPct != null ? `${benchmark6040YtdPct >= 0 ? "+" : ""}${benchmark6040YtdPct.toFixed(1)}%` : "—"}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"auto 1fr", columnGap:8, rowGap:3, marginTop:8 }}>
                  <div style={{ fontSize:9, color:"#475569", fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase" }}>Today</div>
                  <div style={{ fontSize:15, fontWeight:700, textAlign:"right", color: benchmark6040TodayPct == null ? "#cbd5e1" : benchmark6040TodayPct >= 0 ? "#4ade80" : "#ff6b88" }}>
                    {benchmark6040TodayPct != null ? `${benchmark6040TodayPct >= 0 ? "+" : ""}${benchmark6040TodayPct.toFixed(1)}%` : "—"}
                  </div>
                  <div style={{ fontSize:9, color:"#475569", fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase" }}>1-YR</div>
                  <div style={{ fontSize:15, fontWeight:700, textAlign:"right", color: benchmark6040OneYearPct == null ? "#cbd5e1" : benchmark6040OneYearPct >= 0 ? "#4ade80" : "#ff6b88" }}>
                    {benchmark6040OneYearPct != null ? `${benchmark6040OneYearPct >= 0 ? "+" : ""}${benchmark6040OneYearPct.toFixed(1)}%` : "—"}
                  </div>
                  <div style={{ fontSize:9, color:"#475569", fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase" }}>5-YR</div>
                  <div style={{ fontSize:15, fontWeight:700, textAlign:"right", color: benchmark6040FiveYearPct == null ? "#cbd5e1" : benchmark6040FiveYearPct >= 0 ? "#4ade80" : "#ff6b88" }}>
                    {benchmark6040FiveYearPct != null ? `${benchmark6040FiveYearPct >= 0 ? "+" : ""}${benchmark6040FiveYearPct.toFixed(1)}%` : "—"}
                  </div>
                </div>
              </div>
              <div className="tile" style={{ cursor:"pointer" }} onClick={() => { setModal("portfolioDetail"); setDetailKey("spx"); }}>
                <div className="lbl">SPX 100/0 YTD</div>
                <div className="valHero">
                  {spxYtd >= 0 ? "+" : ""}{spxYtd.toFixed(1)}%
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"auto 1fr", columnGap:8, rowGap:3, marginTop:8 }}>
                  <div style={{ fontSize:9, color:"#475569", fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase" }}>Today</div>
                  <div style={{ fontSize:15, fontWeight:700, textAlign:"right", color: spxDailyPct == null ? "#cbd5e1" : spxDailyPct >= 0 ? "#4ade80" : "#ff6b88" }}>
                    {spxDailyPct != null ? `${spxDailyPct >= 0 ? "+" : ""}${spxDailyPct.toFixed(1)}%` : "—"}
                  </div>
                  <div style={{ fontSize:9, color:"#475569", fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase" }}>1-YR</div>
                  <div style={{ fontSize:15, fontWeight:700, textAlign:"right", color: spxOneYearPct == null ? "#cbd5e1" : spxOneYearPct >= 0 ? "#4ade80" : "#ff6b88" }}>
                    {spxOneYearPct != null ? `${spxOneYearPct >= 0 ? "+" : ""}${spxOneYearPct.toFixed(1)}%` : "—"}
                  </div>
                  <div style={{ fontSize:9, color:"#475569", fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase" }}>5-YR</div>
                  <div style={{ fontSize:15, fontWeight:700, textAlign:"right", color: spxFiveYearPct == null ? "#cbd5e1" : spxFiveYearPct >= 0 ? "#4ade80" : "#ff6b88" }}>
                    {spxFiveYearPct != null ? `${spxFiveYearPct >= 0 ? "+" : ""}${spxFiveYearPct.toFixed(1)}%` : "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* Row 3 — Chris's rough-draft proposal, Mike's own curated
                blend, and ALT, all grouped as "portfolios I'm considering".
                ALT used to sit alone in its own row with two stray extra
                closing divs left over from an earlier edit that removed
                the LPL/VG tiles — confirmed via a clean bounded div-count
                across the whole <section>...</section> boundary (116 opens
                vs 118 closes) that those two tags were genuinely orphaned,
                not matched to anything. Removed here rather than carried
                forward. Modeled on Noelle's Rollover IRA dollar figures for
                the Proposed tile, but Mike confirmed the same 55/35/10
                model is intended across all retirement accounts, so it's
                directly comparable to CUR 40/55/5 above, not IRA-only. Swap
                BTAL for Chris's real Long/Short pick once his weekend
                proposal lands. */}
            <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", color:"#475569", marginBottom:6 }}>
              LPL Recommendations
            </div>
            <div className="grid5">
              <div className="tile" style={{ cursor:"pointer" }} onClick={() => { setModal("portfolioDetail"); setDetailKey("c1Tax"); }}>
                <div className="lbl">C1 TAX 40/60 YTD</div>
                <div className="valHero">
                  {c1TaxYtdPct != null ? `${c1TaxYtdPct >= 0 ? "+" : ""}${c1TaxYtdPct.toFixed(1)}%` : "—"}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"auto 1fr", columnGap:8, rowGap:3, marginTop:8 }}>
                  <div style={{ fontSize:9, color:"#475569", fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase" }}>Today</div>
                  <div style={{ fontSize:15, fontWeight:700, textAlign:"right", color: c1TaxTodayPct == null ? "#cbd5e1" : c1TaxTodayPct >= 0 ? "#4ade80" : "#ff6b88" }}>
                    {c1TaxTodayPct != null ? `${c1TaxTodayPct >= 0 ? "+" : ""}${c1TaxTodayPct.toFixed(1)}%` : "—"}
                  </div>
                  <div style={{ fontSize:9, color:"#475569", fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase" }}>1-YR</div>
                  <div style={{ fontSize:15, fontWeight:700, textAlign:"right", color: c1TaxOneYearPct == null ? "#cbd5e1" : c1TaxOneYearPct >= 0 ? "#4ade80" : "#ff6b88" }}>
                    {c1TaxOneYearPct != null ? `${c1TaxOneYearPct >= 0 ? "+" : ""}${c1TaxOneYearPct.toFixed(1)}%` : "—"}
                  </div>
                  <div style={{ fontSize:9, color:"#475569", fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase" }}>5-YR</div>
                  <div style={{ fontSize:15, fontWeight:700, textAlign:"right", color: c1TaxFiveYearPct == null ? "#cbd5e1" : c1TaxFiveYearPct >= 0 ? "#4ade80" : "#ff6b88" }}>
                    {c1TaxFiveYearPct != null ? `${c1TaxFiveYearPct >= 0 ? "+" : ""}${c1TaxFiveYearPct.toFixed(1)}%` : "—"}
                  </div>
              </div>
            </div>
              <div className="tile" style={{ cursor:"pointer" }} onClick={() => { setModal("portfolioDetail"); setDetailKey("c1Ira"); }}>
                <div className="lbl">C26 56/38/6 YTD</div>
                <div className="valHero">
                  {c1IraYtdPct != null ? `${c1IraYtdPct >= 0 ? "+" : ""}${c1IraYtdPct.toFixed(1)}%` : "—"}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"auto 1fr", columnGap:8, rowGap:3, marginTop:8 }}>
                  <div style={{ fontSize:9, color:"#475569", fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase" }}>Today</div>
                  <div style={{ fontSize:15, fontWeight:700, textAlign:"right", color: c1IraTodayPct == null ? "#cbd5e1" : c1IraTodayPct >= 0 ? "#4ade80" : "#ff6b88" }}>
                    {c1IraTodayPct != null ? `${c1IraTodayPct >= 0 ? "+" : ""}${c1IraTodayPct.toFixed(1)}%` : "—"}
                  </div>
                  <div style={{ fontSize:9, color:"#475569", fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase" }}>1-YR</div>
                  <div style={{ fontSize:15, fontWeight:700, textAlign:"right", color: c1IraOneYearPct == null ? "#cbd5e1" : c1IraOneYearPct >= 0 ? "#4ade80" : "#ff6b88" }}>
                    {c1IraOneYearPct != null ? `${c1IraOneYearPct >= 0 ? "+" : ""}${c1IraOneYearPct.toFixed(1)}%` : "—"}
                  </div>
                  <div style={{ fontSize:9, color:"#475569", fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase" }}>5-YR</div>
                  <div style={{ fontSize:15, fontWeight:700, textAlign:"right", color: c1IraFiveYearPct == null ? "#cbd5e1" : c1IraFiveYearPct >= 0 ? "#4ade80" : "#ff6b88" }}>
                    {c1IraFiveYearPct != null ? `${c1IraFiveYearPct >= 0 ? "+" : ""}${c1IraFiveYearPct.toFixed(1)}%` : "—"}
                  </div>
              </div>
            </div>
            </div>

          </section>

          {/* ①-C YOUR HOLDINGS — the actual position tiles, split into their
              own section since the combined panel had grown to ~15 tiles. */}
          <section className="panel">
            <div className="panelHeader">
              <div>
                <div className="panelTitle">Your Holdings</div>
                <div className="panelSub">Trend sleeve judged vs 200-DMA · fixed income shown by YTD return only</div>
              </div>
              <div className="pstamp">LIVE · Yahoo Finance</div>
            </div>

            {(() => {
              // Shared tile renderer — same trend/defensive branch logic as
              // before, just extracted so both row groups below can call it
              // without duplicating the card markup.
              const renderPositionTile = (p: typeof positionCards[number]) => {
                const ytdLabel = p.ytdReturnPct != null ? `${p.ytdReturnPct >= 0 ? "+" : ""}${p.ytdReturnPct.toFixed(1)}%` : "—";
                const todayLabel = p.dailyPct != null ? `${p.dailyPct >= 0 ? "+" : ""}${p.dailyPct.toFixed(1)}%` : "—";
                const todayColor = p.dailyPct == null ? "#cbd5e1" : p.dailyPct >= 0 ? "#4ade80" : "#ff6b88";
                const oneYearLabel = p.oneYearReturnPct != null ? `${p.oneYearReturnPct >= 0 ? "+" : ""}${p.oneYearReturnPct.toFixed(1)}%` : "—";
                const fiveYearLabel = p.fiveYearReturnPct != null ? `${p.fiveYearReturnPct >= 0 ? "+" : ""}${p.fiveYearReturnPct.toFixed(1)}%` : "—";
                // Shared stats grid — same 2-col (label / value) x 3-row shape
                // as the Portfolio Position Health tiles, for visual
                // consistency across the dashboard. Price and job
                // description dropped per Mike's cleanup — ticker + weight
                // in the header already carries what's needed at a glance.
                const statsGrid = (
                  <div style={{ display:"grid", gridTemplateColumns:"auto 1fr", columnGap:8, rowGap:3, marginTop:8 }}>
                    <div style={{ fontSize:9, color:"#475569", fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase" }}>Today</div>
                    <div style={{ fontSize:15, fontWeight:700, textAlign:"right", color:todayColor }}>{todayLabel}</div>
                    <div style={{ fontSize:9, color:"#475569", fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase" }}>1-YR</div>
                    <div style={{ fontSize:15, fontWeight:700, textAlign:"right", color:p.oneYearReturnPct == null ? "#cbd5e1" : p.oneYearReturnPct >= 0 ? "#4ade80" : "#ff6b88" }}>{oneYearLabel}</div>
                    <div style={{ fontSize:9, color:"#475569", fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase" }}>5-YR</div>
                    <div style={{ fontSize:15, fontWeight:700, textAlign:"right", color:p.fiveYearReturnPct == null ? "#cbd5e1" : p.fiveYearReturnPct >= 0 ? "#4ade80" : "#ff6b88" }}>{fiveYearLabel}</div>
                  </div>
                );

                if (p.sleeve === "defensive") {
                  const neutralBarPos = Math.max(2, Math.min(p.barPos, 98));
                  return (
                    <div key={p.ticker} className="tile" style={{ position:"relative", borderTop:"2px solid rgba(148,163,184,0.35)" }}>
                      <div className="tileTop">
                        <span className="lbl">{p.ticker} · {p.acct === "TOD" ? `TOD ${p.weight}%` : `${p.weight}%`}</span>
                      </div>
                      <div className="valHero" style={{ fontSize:24, color:"#fff" }}>{ytdLabel}</div>
                      {statsGrid}

                      {/* Position-only gauge, deliberately flat gray rather
                          than the equity tiles' red-yellow-green gradient.
                          Strategies like DBMF/BTAL are built to move opposite
                          equities on purpose, so a green "bullish" bar here
                          would misread the strategy doing its job as a
                          warning sign. This shows where price sits vs its
                          200-DMA with no directional verdict attached. */}
                      <div style={{ position:"relative", height:5, borderRadius:9999, background:"#26315f", marginTop:10, marginBottom:4 }}>
                        <div style={{ position:"absolute", left:"50%", top:-3, width:2, height:11, background:"#fff" }} />
                        {p.pctVs200 != null && (
                          <div style={{ position:"absolute", left:`${neutralBarPos}%`, top:-2.5, width:8, height:8, borderRadius:"50%", background:"#94a3b8", border:"2px solid #050a35", transform:"translateX(-50%)" }} />
                        )}
                      </div>
                      <div className="sub" style={{ marginTop:4 }}>
                        {p.pctVs200 != null ? `${p.pctVs200 >= 0 ? "+" : ""}${p.pctVs200.toFixed(1)}% vs 200-DMA` : "Loading"}
                      </div>
                    </div>
                  );
                }

                const barPos = Math.max(2, Math.min(p.barPos, 98));
                return (
                  <div
                    key={p.ticker}
                    className="tile"
                    style={{ position:"relative", borderTop:`2px solid ${p.color}` }}
                  >
                    <div style={{ position:"absolute", top:11, right:11, width:9, height:9, borderRadius:"50%", background:p.color, boxShadow:`0 0 6px ${p.color}99` }} />
                    <div className="tileTop" style={{ paddingRight:20 }}>
                      <span className="lbl">{p.ticker} · {p.acct === "TOD" ? `TOD ${p.weight}%` : `${p.weight}%`}</span>
                    </div>
                    <div className="valHero" style={{ fontSize:24, color:"#fff" }}>{ytdLabel}</div>
                    {statsGrid}

                    <div style={{ fontSize:10, color:p.color, fontWeight:600, marginTop:8 }}>{p.state}</div>

                    <div style={{ position:"relative", height:5, borderRadius:9999, background:"linear-gradient(to right,#ff6b88,#fbbf24,#4ade80)", marginTop:6, marginBottom:4 }}>
                      <div style={{ position:"absolute", left:"50%", top:-3, width:2, height:11, background:"#fff" }} />
                      {p.pctVs200 != null && (
                        <div style={{ position:"absolute", left:`${barPos}%`, top:-2.5, width:8, height:8, borderRadius:"50%", background:p.color, border:"2px solid #050a35", transform:"translateX(-50%)" }} />
                      )}
                    </div>
                    <div className="sub">
                      {p.pctVs200 != null ? `${p.pctVs200 >= 0 ? "+" : ""}${p.pctVs200.toFixed(1)}% vs 200-DMA` : "Loading"}
                    </div>
                  </div>
                );
              };

              // Three sleeves at M2 weights (Mike's IRAs). VXUS and VTEB are
              // TOD-only holdings, shown at their TOD weights and labeled
              // "TOD" on the tile so the two sets of percentages don't mix.
              const byTicker = (t: string) =>
                positionCards.find(p => p.ticker === t) ?? candidateCards.find(p => p.ticker === t);
              const equityCards = ["VEA", "SCHD", "VTI", "VTWO", "VIGI", "VXUS"].map(byTicker).filter((p): p is NonNullable<typeof p> => !!p);
              const incomeCards = ["VTIP", "SGOV", "BND", "VTEB"].map(byTicker).filter((p): p is NonNullable<typeof p> => !!p);
              const altCards = ["GLDM", "DBMF"].map(byTicker).filter((p): p is NonNullable<typeof p> => !!p);

              return (
                <>
                  <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", color:"#475569", marginBottom:2 }}>
                    Equity Sleeve
                  </div>
                  <div style={{ fontSize:10, color:"#475569", marginBottom:6 }}>M2 weights (Mike's IRAs) · VXUS shown at its TOD weight</div>
                  <div className="grid5" style={{ marginBottom:16 }}>
                    {equityCards.map(renderPositionTile)}
                  </div>

                  <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", color:"#475569", marginBottom:2 }}>
                    Fixed Income
                  </div>
                  <div style={{ fontSize:10, color:"#475569", marginBottom:6 }}>M2 weights · VTEB shown at its TOD weight (target 60%)</div>
                  <div className="grid5" style={{ marginBottom:16 }}>
                    {incomeCards.map(renderPositionTile)}
                  </div>

                  <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", color:"#475569", marginBottom:2 }}>
                    Alternatives Sleeve
                  </div>
                  <div style={{ fontSize:10, color:"#475569", marginBottom:6 }}>M2 weights · both held</div>
                  <div className="grid5">
                    {altCards.map(renderPositionTile)}
                  </div>
                </>
              );
            })()}
          </section>


          {/* ⑨ IVY */}
          <section className="panel">
            <div className="panelHeader">
              <div><div className="panelTitle">Ivy Portfolio</div><div className="panelSub">10-Month SMA Signals · Mebane Faber Model · End-of-month rule</div></div>
              <div style={{ textAlign:"right" }}>
                <div className="pstamp">{ivyLive ? "LIVE · Yahoo Finance" : "Fallback data"}</div>
                <div style={{ fontSize:10, color:"#334155", marginTop:2 }}>Signal fires at month-end close only</div>
              </div>
            </div>
            <table className="ivyTable">
              <thead>
                <tr>
                  <th style={{ width:"8%" }}>Fund</th>
                  <th style={{ width:"16%" }}>Name</th>
                  <th style={{ width:"16%", textAlign:"center" }}>
                    Current Position
                    <div style={{ fontSize:9, fontWeight:400, color:"#475569", textTransform:"none", letterSpacing:0 }}>as of {ivyOfficialDate}</div>
                  </th>
                  <th style={{ width:"22%", textAlign:"center" }}>
                    {ivyEOMDate} Forecast
                    <div style={{ fontSize:9, fontWeight:400, color:"#475569", textTransform:"none", letterSpacing:0 }}>live price vs 10-mo SMA</div>
                  </th>
                  <th style={{ width:"14%", textAlign:"right" }}>
                    Price
                    <div style={{ fontSize:9, fontWeight:400, color:"#475569", textTransform:"none", letterSpacing:0 }}>live</div>
                  </th>
                  <th style={{ width:"14%", textAlign:"right" }}>
                    10-mo SMA
                    <div style={{ fontSize:9, fontWeight:400, color:"#475569", textTransform:"none", letterSpacing:0 }}>month-end avg</div>
                  </th>
                  <th style={{ width:"10%", textAlign:"right" }}>Variance</th>
                </tr>
              </thead>
              <tbody>
                {ivyPositions.map(r => {
                  const isAtRisk = r.variance != null && r.variance <= 0;
                  const isWatch = r.variance != null && r.variance > 0 && r.variance <= 2;
                  return (
                    <tr key={r.ticker} style={{ background: isAtRisk ? "rgba(239,68,68,0.03)" : isWatch ? "rgba(245,158,11,0.03)" : "transparent" }}>
                      {/* Fund */}
                      <td style={{ fontWeight:700, color:"#cbd5e1" }}>{r.ticker}</td>
                      {/* Name */}
                      <td style={{ color:"#64748b", fontSize:12 }}>{r.name}</td>
                      {/* Current Official Position */}
                      <td style={{ textAlign:"center" }}>
                        <span style={{ fontWeight:700, color: r.officialSignal === "Cash" ? "#ff6b88" : "#4ade80", fontSize:13 }}>
                          {r.officialSignal === "Cash" ? "✕" : "✓"} {r.officialSignal}
                        </span>
                      </td>
                      {/* EOM Forecast */}
                      <td style={{ textAlign:"center" }}>
                        <span className={r.forecastPill || "pillG"} style={{ fontSize:11 }}>
                          {r.forecastLabel}
                        </span>
                        {r.variance != null && r.variance <= 0 && (
                          <div style={{ fontSize:10, color:"#ff6b88", marginTop:3 }}>
                            {Math.abs(r.variance).toFixed(1)}% below SMA now
                          </div>
                        )}
                        {r.variance != null && r.variance > 0 && r.variance <= 2 && (
                          <div style={{ fontSize:10, color:"#fbbf24", marginTop:3 }}>
                            only {r.variance.toFixed(1)}% above SMA
                          </div>
                        )}
                      </td>
                      {/* Price */}
                      <td style={{ textAlign:"right", fontWeight:600, color:"#e2e8f0", fontSize:13 }}>
                        {r.price != null ? r.price.toFixed(2) : "—"}
                      </td>
                      {/* 10-mo SMA */}
                      <td style={{ textAlign:"right", fontWeight:600, color:"#94a3b8", fontSize:13 }}>
                        {r.sma != null ? r.sma.toFixed(2) : "—"}
                      </td>
                      {/* Variance % — number only, no bar */}
                      <td style={{ textAlign:"right", fontWeight:700, fontSize:13, color: r.forecastColor }}>
                        {r.variance != null ? `${r.variance >= 0 ? "+" : ""}${r.variance.toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* EOM Risk Summary — shows confirmed flips vs pending risks */}
            {(() => {
              // Positions that officially flipped to Cash this month-end
              const confirmedCash = Object.entries(ivyOfficialSignals)
                .filter(([,v]) => v === "Cash")
                .map(([k]) => k.toUpperCase());
              // Positions that are live-below-SMA but still officially Invested (next month risk)
              const pendingRisk = ivyPositions.filter(p =>
                p.variance != null && p.variance <= 0 && ivyOfficialSignals[p.key] === "Invest"
              );
              return (<>
                {confirmedCash.length > 0 && (
                  <div style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.35)", borderRadius:10, padding:"10px 14px", marginTop:8, display:"flex", alignItems:"flex-start", gap:10 }}>
                    <span style={{ fontSize:15, flexShrink:0 }}>🔴</span>
                    <div>
                      <div style={{ fontSize:12, fontWeight:700, color:"#ff6b88", marginBottom:3 }}>
                        {confirmedCash.length} position{confirmedCash.length > 1 ? "s" : ""} flipped to Cash — {ivyOfficialDate} official signal
                      </div>
                      <div style={{ fontSize:12, color:"#fca5a5", lineHeight:1.6 }}>
                        <strong>{confirmedCash.join(", ")}</strong> closed below their 10-month SMA at {ivyOfficialDate} month-end. Ivy rule now signals <strong>Cash</strong> for these positions. Signal valid until {ivyEOMDate} close. Next action: monitor {ivyEOMDate} for potential re-entry if price reclaims SMA.
                      </div>
                    </div>
                  </div>
                )}
                {pendingRisk.length > 0 && (
                  <div style={{ background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.3)", borderRadius:10, padding:"10px 14px", marginTop:8, display:"flex", alignItems:"flex-start", gap:10 }}>
                    <span style={{ fontSize:15, flexShrink:0 }}>⚠️</span>
                    <div>
                      <div style={{ fontSize:12, fontWeight:700, color:"#fbbf24", marginBottom:3 }}>{ivyEOMDate} flip risk</div>
                      <div style={{ fontSize:12, color:"#94a3b8", lineHeight:1.6 }}>
                        <strong>{pendingRisk.map(p => p.ticker).join(", ")}</strong> currently trading below SMA but officially still Invested. If below at {ivyEOMDate} close, signal flips to Cash.
                      </div>
                    </div>
                  </div>
                )}
                {ivyLive && confirmedCash.length === 0 && pendingRisk.length === 0 && ivyPositions.some(p => p.variance != null && p.variance > 0 && p.variance <= 2) && (
                  <div style={{ background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.3)", borderRadius:10, padding:"10px 14px", marginTop:8, display:"flex", alignItems:"flex-start", gap:10 }}>
                    <span style={{ fontSize:15, flexShrink:0 }}>⚠️</span>
                    <div>
                      <div style={{ fontSize:12, fontWeight:700, color:"#fbbf24", marginBottom:3 }}>Near-Signal Watch</div>
                      <div style={{ fontSize:12, color:"#94a3b8", lineHeight:1.6 }}>
                        {ivyPositions.filter(p => p.variance != null && p.variance > 0 && p.variance <= 2).map(p => `${p.ticker} (+${p.variance?.toFixed(1)}%)`).join(", ")} within 2% of signal line. Monitor into {ivyEOMDate} close.
                      </div>
                    </div>
                  </div>
                )}
              </>);
            })()}

            <div className="sumBar" style={{ marginTop:8 }}>
              <span className="sumBarLabel">Ivy Signal</span>
              <span style={{ fontSize:12, fontWeight:700, color: ivyAtRiskCount === 0 ? "#4ade80" : "#fbbf24" }}>
                {ivyInvestedCount} / 5 Invested
              </span>
              <span style={{ fontSize:12, color:"#475569" }}>·</span>
              <span style={{ fontSize:12, color: ivyAtRiskCount > 0 ? "#fbbf24" : "#94a3b8" }}>
                {ivyLive && ivyAtRiskCount > 0
                  ? `⚠ ${ivyAtRiskCount} position${ivyAtRiskCount > 1 ? "s" : ""} at risk of flipping on ${ivyEOMDate} — official signal fires at month-end close only`
                  : `Official positions as of ${ivyOfficialDate} · Next reading: ${ivyEOMDate}`}
              </span>
            </div>
          </section>

          {/* WEEKLY VIEW · CALENDAR + ACTION ITEMS. Both lists live in
              route.ts (MANUAL_CALENDAR, MANUAL_ACTIONS). */}
          {(() => {
            const wv = marketData?.weekly_view;
            if (!wv) return null;
            const today = new Date(); today.setHours(0,0,0,0);
            const horizon = new Date(today); horizon.setDate(horizon.getDate() + 21);
            const parse = (d: string) => { const [y,m,dd] = d.split("-").map(Number); return new Date(y, m-1, dd); };
            const fmtDay = (d: string) => parse(d).toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric" });
            const upcoming = (wv.calendar ?? []).filter((c: AnyObj) => { const d = parse(c.date); return d >= today && d <= horizon; });
            const actions = [...(wv.actions ?? [])].sort((a: AnyObj, b: AnyObj) => a.due.localeCompare(b.due));
            const openCount = actions.filter((a: AnyObj) => a.status !== "done").length;
            const statusStyle = (a: AnyObj) => {
              const overdue = a.status !== "done" && parse(a.due) < today;
              if (a.status === "done") return { label:"Done", color:"#4ade80" };
              if (overdue) return { label:"Overdue", color:"#ff6b88" };
              if (a.status === "doing") return { label:"In progress", color:"#fbbf24" };
              return { label:"Open", color:"#94a3b8" };
            };
            return (
              <div style={{ display:"flex", flexDirection:"column", gap:16, marginTop:16 }}>
                <section className="panel">
                  <div className="panelHeader"><div><div className="panelTitle">Next 3 Weeks</div><div className="panelSub">Market events and plan dates</div></div></div>
                  {upcoming.length === 0 && <div style={{ fontSize:13, color:"#64748b" }}>Nothing scheduled. Add dates in MANUAL_CALENDAR.</div>}
                  {upcoming.map((c: AnyObj) => (
                    <div key={c.date + c.item} style={{ display:"flex", gap:12, padding:"8px 0", borderBottom:"1px solid rgba(255,255,255,0.06)", alignItems:"baseline" }}>
                      <span style={{ fontSize:12, fontWeight:700, color:"#cbd5e1", minWidth:92 }}>{fmtDay(c.date)}</span>
                      <span style={{ fontSize:13, color:"#e2e8f0", flex:1 }}>{c.item}</span>
                      <span style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", color: c.kind === "plan" ? "#93c5fd" : "#64748b" }}>{c.kind === "plan" ? "Your plan" : "Market"}</span>
                    </div>
                  ))}
                </section>
                <section className="panel">
                  <div className="panelHeader"><div><div className="panelTitle">Action Items</div><div className="panelSub">{openCount} open · update status in MANUAL_ACTIONS</div></div></div>
                  {actions.map((a: AnyObj, i: number) => {
                    const st = statusStyle(a);
                    return (
                      <div key={a.item} style={{ display:"flex", gap:10, padding:"8px 0", borderBottom:"1px solid rgba(255,255,255,0.06)", alignItems:"baseline", opacity: a.status === "done" ? 0.5 : 1 }}>
                        <span style={{ fontSize:12, fontWeight:700, color:"#475569", minWidth:18 }}>{i + 1}</span>
                        <span style={{ fontSize:13, color:"#e2e8f0", flex:1, textDecoration: a.status === "done" ? "line-through" : "none" }}>{a.item}</span>
                        <span style={{ fontSize:11, color:"#64748b", minWidth:52, textAlign:"right" }}>{parse(a.due).toLocaleDateString("en-US", { month:"short", day:"numeric" })}</span>
                        <span style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", color:st.color, minWidth:74, textAlign:"right" }}>{st.label}</span>
                      </div>
                    );
                  })}
                </section>
              </div>
            );
          })()}


        </div>
      </div>

      {/* MODALS */}
      {modal==="portfolioDetail" && detailKey && portfolioDetailData[detailKey] && (() => {
        const d = portfolioDetailData[detailKey];
        const hasAllYtd = d.components.every(c => c.ytd != null);
        return (
          <ModalWrapper onClose={()=>{ setModal(null); setDetailKey(null); }} title={d.title} sub={d.subtitle}>
            <div style={{ display:"flex", gap:24, marginBottom:16 }}>
              <div>
                <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", color:"#64748b" }}>YTD</div>
                <div style={{ fontSize:26, fontWeight:700, color: d.ytd == null ? "#fff" : d.ytd >= 0 ? "#4ade80" : "#ff6b88" }}>
                  {d.ytd != null ? `${d.ytd >= 0 ? "+" : ""}${d.ytd.toFixed(1)}%` : "—"}
                </div>
              </div>
              <div>
                <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", color:"#64748b" }}>1-YR</div>
                <div style={{ fontSize:26, fontWeight:700, color: d.oneYear == null ? "#fff" : d.oneYear >= 0 ? "#4ade80" : "#ff6b88" }}>
                  {d.oneYear != null ? `${d.oneYear >= 0 ? "+" : ""}${d.oneYear.toFixed(1)}%` : "—"}
                </div>
              </div>
              <div>
                <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", color:"#64748b" }}>5-YR</div>
                <div style={{ fontSize:26, fontWeight:700, color: d.fiveYear == null ? "#fff" : d.fiveYear >= 0 ? "#4ade80" : "#ff6b88" }}>
                  {d.fiveYear != null ? `${d.fiveYear >= 0 ? "+" : ""}${d.fiveYear.toFixed(1)}%` : "—"}
                </div>
              </div>
            </div>
            <table className="valTable">
              <thead>
                <tr>
                  <th style={{ textAlign:"left" }}>Ticker</th>
                  <th style={{ textAlign:"left" }}>Description</th>
                  <th style={{ textAlign:"right" }}>Weight</th>
                  <th style={{ textAlign:"right" }}>YTD</th>
                  <th style={{ textAlign:"right" }}>1-YR</th>
                  <th style={{ textAlign:"right" }}>5-YR</th>
                </tr>
              </thead>
              <tbody>
                {[...d.components].sort((a, b) => b.weight - a.weight).map(c => {
                  return (
                    <tr key={c.ticker}>
                      <td style={{ fontWeight:700, color:"#cbd5e1" }}>{c.ticker}</td>
                      <td style={{ color:"#94a3b8" }}>{TICKER_LABELS[c.ticker] ?? "—"}</td>
                      <td style={{ textAlign:"right", color:"#94a3b8" }}>{c.weight}%</td>
                      <td style={{ textAlign:"right", fontWeight:600, color: c.ytd == null ? "#64748b" : c.ytd >= 0 ? "#4ade80" : "#ff6b88" }}>
                        {c.ytd != null ? `${c.ytd >= 0 ? "+" : ""}${c.ytd.toFixed(1)}%` : "—"}
                      </td>
                      <td style={{ textAlign:"right", fontWeight:600, color: c.oneYear == null ? "#64748b" : c.oneYear >= 0 ? "#4ade80" : "#ff6b88" }}>
                        {c.oneYear != null ? `${c.oneYear >= 0 ? "+" : ""}${c.oneYear.toFixed(1)}%` : "—"}
                      </td>
                      <td style={{ textAlign:"right", fontWeight:600, color: c.fiveYear == null ? "#64748b" : c.fiveYear >= 0 ? "#4ade80" : "#ff6b88" }}>
                        {c.fiveYear != null ? `${c.fiveYear >= 0 ? "+" : ""}${c.fiveYear.toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!hasAllYtd && (
              <div style={{ fontSize:11, color:"#64748b", marginTop:10 }}>
                One or more components are still loading — the total above will resolve once all figures are in.
              </div>
            )}
          </ModalWrapper>
        );
      })()}

      {modal==="roberts40w" && (
        <ModalWrapper onClose={()=>setModal(null)} title="Roberts 40-Week Signal" sub="Lance Roberts · RIA Advisors · The primary trend gate for all allocation decisions">
          <ModalGrid
            left={<>
              <SH>Current state</SH>
              {(() => {
                const stateColor = is200Broken?(spxDailyPct!=null&&spxDailyPct>0?"#60a5fa":"#ff6b88"):spx200Pct!=null&&spx200Pct<=3?"#fbbf24":"#4ade80";
                const stateLabel = is200Broken&&spxDailyPct!=null&&spxDailyPct>0?"RECLAIMING":is200Broken?"RISK OFF":spx200Pct!=null&&spx200Pct<=3?"RISK WATCH":"RISK ON";
                const t1 = !is200Broken && spx200Pct != null && spx200Pct > 0;
                const t2 = t1 && spx200Pct != null && spx200Pct > 3;
                const t3 = t2 && breadthPct != null && breadthPct > 55;
                return <>
                  <div style={{ fontSize:36, fontWeight:900, color:stateColor, letterSpacing:"-0.02em", lineHeight:1, marginBottom:4 }}>{stateLabel}</div>
                  <div style={{ display:"flex", gap:16, marginBottom:12 }}>
                    <div><div style={{ fontSize:9, color:"#475569", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em" }}>SPX</div><div style={{ fontSize:18, fontWeight:800, color:"#fff" }}>{spxPrice!=null?fmtWhole(spxPrice):"—"}</div></div>
                    <div><div style={{ fontSize:9, color:"#475569", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em" }}>40-Wk MA</div><div style={{ fontSize:18, fontWeight:800, color:"#64748b" }}>{fmtWhole(spx200)}</div></div>
                    <div><div style={{ fontSize:9, color:"#475569", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em" }}>Gap</div><div style={{ fontSize:18, fontWeight:800, color:stateColor }}>{spx200Pct!=null?`${spx200Pct>=0?"+":""}${spx200Pct.toFixed(1)}%`:"—"}</div></div>
                    <div><div style={{ fontSize:9, color:"#475569", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em" }}>MA Slope</div><div style={{ fontSize:18, fontWeight:800, color:slope200!=null&&slope200>0?"#4ade80":"#ff6b88" }}>{slope200!=null?`${slope200>0?"↗":"↘"} ${slope200.toFixed(1)}%`:"—"}</div></div>
                  </div>
                  {/* Proximity bar */}
                  <div style={{ position:"relative", height:4, borderRadius:9999, background:"linear-gradient(to right,#ff6b88,#fbbf24,#4ade80,#fbbf24,#ff6b88)", marginBottom:10 }}>
                    <div style={{ position:"absolute", top:"50%", left:`${Math.max(2,Math.min(spx200Pct!=null?50+spx200Pct*2:50,98))}%`, transform:"translate(-50%,-50%)", width:10, height:10, borderRadius:"50%", background:"#fff", border:`2px solid ${stateColor}` }} />
                  </div>
                  {/* Re-entry tranche tracker */}
                  <div style={{ background:"#0d1240", borderRadius:8, padding:"10px 12px", marginBottom:12 }}>
                    <div style={{ fontSize:9, fontWeight:700, color:"#475569", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Re-Entry Tranche Tracker</div>
                    {[
                      { label:"① MA Reclaimed — SPX above 40-wk MA", active:t1 },
                      { label:"② Retest Holds — held above MA (+3% buffer)", active:t2 },
                      { label:"③ Breadth >55% — broad market confirms", active:t3 },
                    ].map(r => (
                      <div key={r.label} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                        <div style={{ width:8, height:8, borderRadius:"50%", background:r.active?"#4ade80":"#202a64", border:`1.5px solid ${r.active?"#4ade80":"#334155"}`, flexShrink:0 }} />
                        <div style={{ fontSize:11, color:r.active?"#4ade80":"#475569" }}>{r.label}</div>
                      </div>
                    ))}
                    <div style={{ fontSize:10, color:t3?"#4ade80":"#fbbf24", marginTop:4, fontWeight:600 }}>
                      {t3?"All tranches confirmed — full re-entry":t2?"Awaiting breadth confirmation":t1?"Awaiting retest to hold":"Awaiting MA reclaim"}
                    </div>
                  </div>
                  {/* The core rule */}
                  <MCard>
                    <SH>The core rule</SH>
                    <div style={{ display:"grid", gap:6, marginTop:8 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 10px", background:"rgba(74,222,128,0.08)", borderRadius:8, border:"0.5px solid rgba(74,222,128,0.2)" }}>
                        <div style={{ width:8, height:8, borderRadius:"50%", background:"#4ade80", flexShrink:0 }} />
                        <div style={{ fontSize:11, color:"#cbd5e1", lineHeight:1.5 }}><span style={{ color:"#4ade80", fontWeight:700 }}>Above 40-wk MA</span> — portfolio allocated 100% to equity risk</div>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 10px", background:"rgba(255,107,136,0.08)", borderRadius:8, border:"0.5px solid rgba(255,107,136,0.2)" }}>
                        <div style={{ width:8, height:8, borderRadius:"50%", background:"#ff6b88", flexShrink:0 }} />
                        <div style={{ fontSize:11, color:"#cbd5e1", lineHeight:1.5 }}><span style={{ color:"#ff6b88", fontWeight:700 }}>Below 40-wk MA</span> — reduce to 50% equity allocation</div>
                      </div>
                    </div>
                  </MCard>
                </>;
              })()}
            </>}
            right={<>
              {/* 6-indicator scorecard */}
              <MCard>
                <SH>Sustained vs brief break — 6-indicator scorecard</SH>
                <BC>When the 40-wk MA breaks, these 6 indicators determine whether the break is a whipsaw (buy the dip) or a sustained bear. 3+ firing = sustained decline. 0–1 firing = whipsaw recovery.</BC>
                <div style={{ display:"grid", gap:5, marginTop:10 }}>
                  {[
                    { label:"200-DMA slope direction", bearish: slope200!=null&&slope200<0, bearNote:"Flat/falling = sustained", bullNote:"Rising = whipsaw likely", live: slope200!=null?`${slope200>0?"↗":"↘"} ${slope200.toFixed(1)}%`:"—" },
                    { label:"Weekly MACD", bearish: false, bearNote:"Negative before price confirms = sustained", bullNote:"Positive = corrective", live:"Manual — check chart" },
                    { label:"RSI at break", bearish: false, bearNote:"Above 40 at break = no capitulation", bullNote:"Below 32 = fear capitulated = contrarian buy", live:"Manual — check chart" },
                    { label:"AAII Bears", bearish: false, bearNote:"Below 45% = not enough pessimism", bullNote:"Above 45% = too bearish = contrarian buy", live:"Manual — check weekly" },
                    { label:"Breadth at break", bearish: breadthPct!=null&&breadthPct<40, bearNote:"<40% above 200-DMA = broad selling", bullNote:">40% = large-cap only = whipsaw", live: breadthPct!=null?`${breadthPct.toFixed(0)}%`:"—" },
                    { label:"Death cross forming", bearish: false, bearNote:"50-DMA converging toward 200-DMA = sustained", bullNote:"No convergence = whipsaw", live:"Display only" },
                  ].map((ind, i) => (
                    <div key={i} style={{ background:"#0d1240", borderRadius:7, padding:"8px 10px", border:`0.5px solid ${ind.bearish?"rgba(255,107,136,0.2)":"rgba(74,222,128,0.1)"}` }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
                        <div style={{ fontSize:11, fontWeight:700, color:"#e2e8f0" }}>{ind.label}</div>
                        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                          <div style={{ fontSize:10, color:"#64748b" }}>{ind.live}</div>
                          <div style={{ width:7, height:7, borderRadius:"50%", background:ind.bearish?"#ff6b88":"#4ade80", flexShrink:0 }} />
                        </div>
                      </div>
                      <div style={{ fontSize:9, color:"#475569", lineHeight:1.4 }}>
                        <span style={{ color:"#ff6b88" }}>Bear: </span>{ind.bearNote} · <span style={{ color:"#4ade80" }}>Bull: </span>{ind.bullNote}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop:10, padding:"8px 10px", background:"rgba(251,191,36,0.08)", borderRadius:8, border:"0.5px solid rgba(251,191,36,0.2)" }}>
                  <div style={{ fontSize:10, fontWeight:700, color:"#fbbf24", marginBottom:2 }}>Base rates since 2000 — 12 breaks total</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, fontSize:10, color:"#94a3b8" }}>
                    <div><span style={{ color:"#ff6b88", fontWeight:700 }}>7 sustained</span> — avg 12-mo return: –4.0% · zero positive first months</div>
                    <div><span style={{ color:"#4ade80", fontWeight:700 }}>5 whipsaws</span> — avg 12-mo return: +19.8% · 100% positive at 3/6/9/12 mo</div>
                  </div>
                </div>
              </MCard>
              {/* Historical breaks table */}
              <MCard>
                <SH>Every 40-wk break since 2008</SH>
                <BC>All resolved above the 200-week MA. None became a structural bear while above it.</BC>
                <div style={{ display:"grid", gap:4, marginTop:8 }}>
                  {[
                    { year:"2012", event:"Euro crisis", outcome:"Corrective · Fed QE2 reversed it", result:"whipsaw" },
                    { year:"2015", event:"Brexit / China", outcome:"Corrective · central bank response", result:"whipsaw" },
                    { year:"2018", event:"Fed taper tantrum", outcome:"Corrective · Powell pivot", result:"whipsaw" },
                    { year:"2020", event:"COVID crash", outcome:"Corrective · largest stimulus in history", result:"whipsaw" },
                    { year:"2022", event:"Russia/Ukraine + inflation", outcome:"Sustained · 9 months · held 200-wk", result:"sustained" },
                    { year:"2025", event:"Tariff shock", outcome:"Corrective · resolved, back above MA", result:"whipsaw" },
                    { year:"Now", event:`SPX ${spx200Pct!=null?`+${spx200Pct.toFixed(1)}%`:"+8%"} above`, outcome:"RISK ON · trend intact · slope rising", result:"on" },
                  ].map((r, i) => (
                    <div key={i} style={{ display:"flex", gap:8, alignItems:"flex-start", padding:"6px 8px", borderRadius:6, background: r.year==="Now"?"rgba(74,222,128,0.06)":"rgba(255,255,255,0.02)", border:`0.5px solid ${r.year==="Now"?"rgba(74,222,128,0.2)":"rgba(255,255,255,0.04)"}` }}>
                      <div style={{ fontSize:11, fontWeight:700, color: r.result==="sustained"?"#ff6b88":r.result==="on"?"#4ade80":"#94a3b8", minWidth:32, flexShrink:0 }}>{r.year}</div>
                      <div style={{ fontSize:11, fontWeight:600, color:"#cbd5e1", minWidth:80, flexShrink:0 }}>{r.event}</div>
                      <div style={{ fontSize:10, color:"#475569", lineHeight:1.4 }}>{r.outcome}</div>
                    </div>
                  ))}
                </div>
              </MCard>
              {/* Roberts quote */}
              <ActionCard>
                {is200Broken
                  ? "40-wk MA breached. Roberts rule: reduce to 50% equity immediately. Do not wait for confirmation — the rule exists so emotion doesn't override discipline at exactly this moment."
                  : `SPX is ${spx200Pct!=null?`+${spx200Pct.toFixed(1)}%`:"well"} above the 40-wk MA with slope rising. Roberts rule: remain fully allocated to equity risk. "It may not be possible to time the market, but it is possible to reach intelligent conclusions about whether the market offers good value." The trend says yes. Valuation says be selective.`}
              </ActionCard>
            </>}
          />
        </ModalWrapper>
      )}
      {modal==="vix" && (
        <ModalWrapper onClose={()=>setModal(null)} title="VIX — Volatility Index" sub="CBOE Volatility Index · Implied 30-day S&P 500 volatility">
          <ModalGrid
            left={<><SH>Current reading</SH><div style={{ fontSize:44, fontWeight:700, color:"#fff", letterSpacing:"-0.03em", lineHeight:1, marginBottom:6 }}>{vixValue!=null?fmt1(vixValue):"—"}</div><Tag label={vixStatus.label} color={vixStatus.color} bg={`${vixStatus.color}22`} /><BC>{vixStatus.sub||"Monitor conditions."}</BC>
              <BandTrack segs={[{w:"37.5%",color:"#047857"},{w:"12.5%",color:"#4ade80"},{w:"25%",color:"#f59e0b"},{w:"25%",color:"#ef4444"}]} needle={vixValue!=null?vixNeedlePct(vixValue):56} scaleNums={["0","15","20","30","40+"]} scaleNames={["Low","Normal","Elevated","Stress","Crisis"]} />
              <div style={{ marginTop:16, background:"#141b47", border:"1px solid rgba(245,158,11,0.2)", borderRadius:10, padding:14 }}>
                <SH>Historical percentile · since 1990</SH>
                <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", marginBottom:8 }}>
                  <div style={{ fontSize:32, fontWeight:700, color:"#fff", lineHeight:1 }}>{vixPct}<span style={{ fontSize:16 }}>th</span></div>
                  <div style={{ fontSize:11, color:"#94a3b8", textAlign:"right", lineHeight:1.5 }}>{vixPct>=75?"Elevated · top 25%":"Above median"}<br/>of all readings</div>
                </div>
                <div style={{ height:8, borderRadius:9999, background:"#1e2a5e", overflow:"hidden" }}><div style={{ height:8, borderRadius:9999, background:"#fbbf24", width:`${vixPct}%` }} /></div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"#475569", marginTop:4 }}><span>0th</span><span>50th</span><span>75th</span><span>90th</span><span>100th</span></div>
              </div></>}
            right={<><MCard><SH>What it measures</SH><BC>The VIX measures expected 30-day S&P 500 volatility from options pricing. When fear rises, traders pay more for protective puts — and the VIX moves higher. Called the "fear gauge."</BC></MCard>
              <MCard><SH>Historical context</SH><div style={{ display:"grid", gap:5, marginTop:8 }}><HistRow val="82.7" event="COVID Mar 2020" note="All-time high · months to recover" /><HistRow val="79.1" event="GFC Nov 2008" note="Sustained · 18 months of pain" /><HistRow val="45.3" event="Euro crisis 2011" note="Flash crash · resolved quickly" /><HistRow val="38.6" event="Yen unwind 2024" note="Carry trade · 2 weeks" /><HistRow val={vixValue!=null?fmt1(vixValue):"—"} event="Today" note={vixValue!=null&&vixValue>=30?"Above trigger":"Elevated · below danger zone"} active /><HistRow val="20" event="Long-run avg" note="Mean · median ~17" /></div></MCard>
              <ActionCard>{vixValue!=null&&vixValue>=30?"VIX above 30. Pause all new equity buying until VIX drops back below 30 for two consecutive sessions.":`VIX at ${vixValue!=null?fmt1(vixValue):"—"} is below 30. No buying restriction active. Continue normal plan — but do not treat the tape as calm.`}</ActionCard></>}
          />
        </ModalWrapper>
      )}
      {modal==="hy" && (
        <ModalWrapper onClose={()=>setModal(null)} title="HY Spread — High Yield Credit Spread" sub="ICE BofA US High Yield Spread · The bond market's early warning system">
          <ModalGrid
            left={<>
              <SH>Current reading</SH>
              <div style={{ fontSize:44, fontWeight:700, color:"#fff", letterSpacing:"-0.03em", lineHeight:1, marginBottom:6 }}>{Math.round(hySpread*100)}<span style={{ fontSize:22 }}>bps</span></div>
              <Tag
                label={hySpread>=5?"Stress — Above Industry Red Line":hySpread>=4?"⚠ Above Your Trigger":hySpread>=3.5?"Caution — Widening":hySpread>=3?"Firm — Watch Direction":"Tight — Historically Risk-On"}
                color={hySpread>=4?"#ff6b88":hySpread>=3.5?"#fbbf24":hySpread>=3?"#94a3b8":"#4ade80"}
                bg={hySpread>=4?"rgba(255,79,114,0.15)":hySpread>=3.5?"rgba(245,158,11,0.15)":hySpread>=3?"rgba(148,163,184,0.15)":"rgba(74,222,128,0.15)"}
              />
              <BC>{hySpread>=5?"Credit stress confirmed above industry red line. Serious default risk being priced. Both your trigger and the industry 500bps threshold are breached."
                :hySpread>=4?"Above your 400bps trigger. Credit markets signaling stress. Combined with VIX >30 this activates your defensive posture."
                :hySpread>=3.5?"Spreads widening toward caution zone. Direction of travel matters more than absolute level. Watch for continued widening toward 400bps."
                :hySpread>=3?`At ${Math.round(hySpread*100)}bps, spreads are firm but not yet in caution territory. Still ${Math.round((4-hySpread)*100)}bps from your trigger. Watch direction of travel weekly.`
                :`At ${Math.round(hySpread*100)}bps, spreads are historically tight — credit markets are in risk-on mode, priced for perfection. A move toward 400bps would be a ~${Math.round((4-hySpread)/hySpread*100)}% widening from here.`}
              </BC>
              <BandTrack
                segs={[{w:"30%",color:"#047857"},{w:"20%",color:"#4ade80"},{w:"10%",color:"#f59e0b"},{w:"25%",color:"#ef4444"},{w:"15%",color:"#7f1d1d"}]}
                needle={
                  hySpread <= 3.5 ? Math.max(0,(hySpread-2)/1.5*30)
                  : hySpread <= 4.5 ? 30+(hySpread-3.5)*20
                  : hySpread <= 5   ? 50+(hySpread-4.5)*20
                  : hySpread <= 7   ? 60+(hySpread-5)/2*25
                  : Math.min(99, 85+(hySpread-7)/3*15)
                }
                scaleNums={["200","350","450","500","700","1000+"]}
                scaleNames={["Tight","Firm","Caution","Red Line","Stress","Crisis"]}
              />
              {/* Dual threshold boxes */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:12 }}>
                <div style={{ background:"#141b47", border:`1px solid ${hySpread>=4?"rgba(255,107,136,0.5)":"rgba(245,158,11,0.3)"}`, borderRadius:10, padding:12 }}>
                  <SH>Your trigger</SH>
                  <div style={{ fontSize:18, fontWeight:700, color: hySpread>=4?"#ff6b88":"#fbbf24" }}>400bps</div>
                  <div style={{ fontSize:11, color:"#94a3b8", marginTop:3, lineHeight:1.5 }}>Conservative early warning. Combined with VIX &gt;30 fires defensive posture.</div>
                  <div style={{ fontSize:11, fontWeight:700, color: hySpread>=4?"#ff6b88":"#64748b", marginTop:4 }}>
                    {hySpread>=4 ? "⚠ ACTIVE" : `${Math.round((4-hySpread)*100)}bps away`}
                  </div>
                </div>
                <div style={{ background:"#141b47", border:`1px solid ${hySpread>=5?"rgba(255,107,136,0.5)":"rgba(148,163,184,0.2)"}`, borderRadius:10, padding:12 }}>
                  <SH>Industry red line</SH>
                  <div style={{ fontSize:18, fontWeight:700, color: hySpread>=5?"#ff6b88":"#94a3b8" }}>500bps</div>
                  <div style={{ fontSize:11, color:"#94a3b8", marginTop:3, lineHeight:1.5 }}>Historical pivot — credit cycle turning. Long-term avg is ~540bps.</div>
                  <div style={{ fontSize:11, fontWeight:700, color: hySpread>=5?"#ff6b88":"#64748b", marginTop:4 }}>
                    {hySpread>=5 ? "⚠ BREACHED" : `${Math.round((5-hySpread)*100)}bps away`}
                  </div>
                </div>
              </div>
            </>}
            right={<>
              <MCard>
                <SH>What it measures — and why it leads equities</SH>
                <BC>HY spread is the extra yield investors demand to hold junk-rated corporate bonds vs. Treasuries. Credit is the lifeblood of the economy — businesses borrow to operate, consumers borrow to spend. When lenders get nervous, credit conditions tighten weeks before equities reprice. The bond market is harder to talk up than stocks and is not susceptible to retail momentum. When credit speaks, listen.</BC>
              </MCard>
              <MCard>
                <SH>The threshold framework</SH>
                <div style={{ fontSize:12, lineHeight:1.9, color:"#cbd5e1", marginTop:6 }}>
                  <div style={{ display:"flex", justifyContent:"space-between" }}><span style={{ color:"#4ade80" }}>{"<"}350bps</span><span>Tight · Risk-on · Priced for perfection</span></div>
                  <div style={{ display:"flex", justifyContent:"space-between" }}><span style={{ color:"#fbbf24" }}>350–400bps</span><span>Caution · Widening trend to watch</span></div>
                  <div style={{ display:"flex", justifyContent:"space-between" }}><span style={{ color:"#fbbf24", fontWeight:700 }}>400bps ←</span><span style={{ fontWeight:700 }}>Your defensive trigger</span></div>
                  <div style={{ display:"flex", justifyContent:"space-between" }}><span style={{ color:"#f97316" }}>450–500bps</span><span>Watch zone · Default risk rising</span></div>
                  <div style={{ display:"flex", justifyContent:"space-between" }}><span style={{ color:"#ff6b88", fontWeight:700 }}>500bps ←</span><span style={{ fontWeight:700 }}>Industry red line</span></div>
                  <div style={{ display:"flex", justifyContent:"space-between" }}><span style={{ color:"#ff6b88" }}>700bps+</span><span>Stress · Recession territory</span></div>
                  <div style={{ display:"flex", justifyContent:"space-between" }}><span style={{ color:"#7f1d1d" }}>1000bps+</span><span>Crisis · GFC / COVID level</span></div>
                </div>
              </MCard>
              <MCard>
                <SH>Historical CDX warning instances</SH>
                <div style={{ display:"grid", gap:5, marginTop:8 }}>
                  <HistRow val="1000bps+" event="GFC 2008-09" note="Credit markets frozen" />
                  <HistRow val="800bps" event="COVID Mar 2020" note="Sharp spike · rapid recovery" />
                  <HistRow val="700bps" event="Energy crisis 2016" note="Oil-driven stress" />
                  <HistRow val="580bps" event="2022 rate shock" note="Fed hiking cycle · peak" />
                  <HistRow val={`${Math.round(hySpread*100)}bps`} event="Today" note={hySpread>=4?"Above your trigger · stress building":hySpread>=3.5?"Caution zone · watch direction":hySpread>=3?"Firm · below caution threshold":"Tight · historically risk-on"} active />
                  <HistRow val="540bps" event="Long-run average" note="Historical mean" />
                </div>
              </MCard>
              <ActionCard>
                {hySpread>=5
                  ? `HY at ${Math.round(hySpread*100)}bps — above both your trigger AND the 500bps industry red line. Full defensive posture warranted if VIX >30 confirms.`
                  : hySpread>=4
                  ? `HY at ${Math.round(hySpread*100)}bps — your trigger is active. ${Math.round((5-hySpread)*100)}bps from the industry red line. Combined with VIX >30 this fires your defensive posture.`
                  : `HY at ${Math.round(hySpread*100)}bps — ${Math.round((4-hySpread)*100)}bps below your 400bps trigger, ${Math.round((5-hySpread)*100)}bps below the 500bps industry red line. CDX warning signal is active — direction of travel matters. Monitor weekly. Both VIX >30 AND HY >400bps must confirm to activate defensive posture.`}
              </ActionCard>
            </>}
          />
        </ModalWrapper>
      )}
      {modal==="yc" && (
        <ModalWrapper onClose={()=>setModal(null)} title="Yield Curve — 10Y minus 2Y" sub="US Treasury spread · Most reliable recession leading indicator since 1955">
          <ModalGrid
            left={<><SH>Current reading</SH><div style={{ fontSize:44, fontWeight:700, color:"#fff", letterSpacing:"-0.03em", lineHeight:1, marginBottom:6 }}>{yieldCurve>0?"+":""}{fmt2(yieldCurve)}<span style={{ fontSize:22 }}>%</span></div><Tag label={yieldCurve>0?"Healthy — Positive Slope":"Inverted — Recession Signal"} color={yieldCurve>0?"#4ade80":"#ff6b88"} bg={yieldCurve>0?"rgba(74,222,128,0.15)":"rgba(255,79,114,0.15)"} /><BC>{yieldCurve>0?"Curve is upward sloping — normal state. Long rates above short rates suggest the bond market is not pricing a near-term recession.":"Curve is inverted — short rates above long rates. Bond market is pricing a recession."}</BC>
              <BandTrack segs={[{w:"25%",color:"#ef4444"},{w:"15%",color:"#f59e0b"},{w:"20%",color:"#94a3b8"},{w:"40%",color:"#047857"}]} needle={Math.max(0,Math.min(((yieldCurve+1.5)/3.5)*100,99))} scaleNums={["-1.5%","-0.5%","0%","+0.5%","+2%"]} scaleNames={["Deep inv.","Inverted","Flat","Normal","Steep"]} />
              <div style={{ marginTop:16, background:"#141b47", border:"1px solid rgba(245,158,11,0.2)", borderRadius:10, padding:14 }}>
                <SH>Re-steepening watch</SH>
                <div style={{ fontSize:13, lineHeight:1.7, color:"#cbd5e1" }}>After deep inversion reaching -1.08% in Jul 2023, the curve re-steepened to {yieldCurve>0?"+":""}{fmt2(yieldCurve)}%. Re-steepening after inversion has historically preceded recession — this phase warrants monitoring.</div>
              </div></>}
            right={<><MCard><SH>What it measures</SH><BC>The 10Y-2Y spread shows whether long-term rates are above short-term. Inversion means markets expect the Fed to cut — usually because recession is expected. It has predicted every US recession since 1955 with only one false positive.</BC></MCard>
              <MCard><SH>Historical context</SH><div style={{ display:"grid", gap:5, marginTop:8 }}><HistRow val="-1.08%" event="Jul 2023 low" note="Most inverted since 1981" /><HistRow val="-0.5%" event="Avg 2022-2023" note="Sustained inversion · rate hikes" /><HistRow val="0%" event="Re-steepen start" note="Curve uninverting · watch phase" /><HistRow val={`${yieldCurve>0?"+":""}${fmt2(yieldCurve)}%`} event="Today" note={yieldCurve>0?"Positive · healthy slope":"Still inverted"} active /><HistRow val="+2%+" event="Bull market norm" note="Healthy growth expectations" /></div></MCard>
              <ActionCard>Yield curve is {yieldCurve>0?"positive — no inversion signal. However, re-steepening after deep inversion is a watch signal. The curve often steepens just before recession as the Fed cuts short rates.":"inverted — watch for recession signal to develop over the next 6-18 months."}</ActionCard></>}
          />
        </ModalWrapper>
      )}
      {modal==="real10y" && (
        <ModalWrapper onClose={()=>setModal(null)} title="Real 10Y — Inflation-Adjusted Rate" sub="10-Year Treasury minus 10-Year Breakeven Inflation · True cost of money">
          <ModalGrid
            left={<><SH>Current reading</SH><div style={{ fontSize:44, fontWeight:700, color:"#fff", letterSpacing:"-0.03em", lineHeight:1, marginBottom:6 }}>{fmt2(real10y)}<span style={{ fontSize:22 }}>%</span></div><Tag label={real10y>=2?"Elevated — Equity Headwind":"Moderate"} color={real10y>=2?"#fbbf24":"#94a3b8"} bg={real10y>=2?"rgba(245,158,11,0.15)":"rgba(148,163,184,0.12)"} /><BC>{real10y>=2?"Real rates above 1.5% create meaningful competition for equities. At current levels, bonds offer real yield that compresses equity multiples over time.":"Real rates in moderate range — some competition for equities but not extreme."}</BC>
              <BandTrack segs={[{w:"20%",color:"#047857"},{w:"30%",color:"#4ade80"},{w:"25%",color:"#f59e0b"},{w:"25%",color:"#ef4444"}]} needle={Math.max(0,Math.min(((real10y+2)/5)*100,99))} scaleNums={["-2%","0%","1%","2%","3%+"]} scaleNames={["Neg. real","Loose","Neutral","Firm","Tight"]} />
              <div style={{ marginTop:16, background:"#141b47", border:"1px solid rgba(245,158,11,0.2)", borderRadius:10, padding:14 }}>
                <SH>Equity valuation impact</SH>
                <div style={{ fontSize:13, lineHeight:1.7, color:"#cbd5e1" }}>Every 100bps rise in real rates historically reduces fair-value P/E by ~3-5x. At {fmt2(real10y)}%, this creates a headwind vs. the near-zero real rates of 2020-2021 that drove the bull market.</div>
              </div></>}
            right={<><MCard><SH>What it measures</SH><BC>The real 10-year rate is nominal Treasury yield minus expected inflation. It represents the true inflation-adjusted return on safe assets. When real rates rise, the hurdle rate for all risky assets rises — directly compressing equity multiples.</BC></MCard>
              <MCard><SH>Historical context</SH><div style={{ display:"grid", gap:5, marginTop:8 }}><HistRow val="-1.0%" event="2020-2021" note="Deeply negative · fueled bull run" /><HistRow val="0%" event="Pre-hike 2022" note="Near zero · inflection point" /><HistRow val="2.5%" event="Peak 2023" note="Multi-decade high · equity headwind" /><HistRow val={`${fmt2(real10y)}%`} event="Today" note="Elevated · equity headwind" active /><HistRow val="0.5%" event="Historical neutral" note="Equities fairly valued vs. bonds" /></div></MCard>
              <ActionCard>No direct trigger on real rates, but {fmt2(real10y)}% is a structural headwind for equity multiples. It supports your valuation models showing overvaluation — the market is priced for a lower-rate world than we&apos;re in.</ActionCard></>}
          />
        </ModalWrapper>
      )}
      {modal==="dma200" && (
        <ModalWrapper onClose={()=>setModal(null)} title="200-DMA — Long-Term Trend" sub="200-Day Moving Average of SPX · The most widely watched trend line in markets">
          <ModalGrid
            left={<><SH>Current levels</SH>
              <div style={{ display:"flex", alignItems:"baseline", gap:16, marginBottom:6 }}><div style={{ fontSize:44, fontWeight:700, color:"#fff", letterSpacing:"-0.03em", lineHeight:1 }}>{fmtWhole(spx200)}</div><div style={{ fontSize:13, color:"#64748b" }}>200-DMA</div></div>
              <div style={{ fontSize:24, fontWeight:700, color:"#fff", marginBottom:8 }}>{spxPrice!=null?fmtWhole(spxPrice):"—"} <span style={{ fontSize:13, color:"#64748b" }}>SPX today</span></div>
              {(() => {
                const pct200 = spxVs(spx200);
                const isBelow = pct200 != null && pct200 < 0;
                const isTesting = pct200 != null && pct200 >= 0 && pct200 <= 2;
                const tagLabel = pct200 == null ? "Loading"
                  : isBelow ? `Bearish · ${fmtSigned1(pct200)}`
                  : isTesting ? `Testing Support · ${fmtSigned1(pct200)} above`
                  : `Holding Above · ${fmtSigned1(pct200)}`;
                const tagColor = isBelow ? "#ff6b88" : isTesting ? "#fbbf24" : "#4ade80";
                const tagBg = isBelow ? "rgba(255,79,114,0.15)" : isTesting ? "rgba(245,158,11,0.15)" : "rgba(74,222,128,0.15)";
                const pts = spxPrice != null ? Math.abs(spxPrice - spx200).toFixed(0) : "—";
                const direction = isBelow ? "below" : "above";
                const barPct = Math.min(Math.abs(pct200 ?? 1.6) / 2, 10);
                return (<>
                  <Tag label={tagLabel} color={tagColor} bg={tagBg} />
                  <BC>SPX is {spxPrice != null ? `${pts} points ${direction} its 200-DMA.` : "near its 200-DMA."} {isBelow ? "The 200-DMA has been broken — this is the level that separates corrections from bear markets. Watch for two consecutive Friday closes below to confirm." : "This is the critical long-term support level — a sustained break below triggers your defensive posture."}</BC>
                  <div style={{ marginTop:14 }}>
                    <SH>Distance from 200-DMA</SH>
                    <div style={{ position:"relative", height:8, background:"#1e2a5e", borderRadius:9999, margin:"8px 0", overflow:"hidden" }}>
                      {isBelow
                        ? <div style={{ position:"absolute", right:"50%", top:0, height:8, width:`${barPct * 5}%`, background:"#ff6b88", borderRadius:"9999px 0 0 9999px" }} />
                        : <div style={{ position:"absolute", left:"50%", top:0, height:8, width:`${barPct * 5}%`, background: isTesting ? "#fbbf24" : "#4ade80", borderRadius:"0 9999px 9999px 0" }} />
                      }
                      <div style={{ position:"absolute", top:-2, left:"50%", width:2, height:12, background:"rgba(255,255,255,0.5)", borderRadius:1 }} />
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"#475569" }}><span>-10% below</span><span>At 200-DMA</span><span>+10% above</span></div>
                  </div>
                  <div style={{ marginTop:16, background:"#141b47", border:`1px solid ${isBelow ? "rgba(239,68,68,0.35)" : "rgba(245,158,11,0.3)"}`, borderRadius:10, padding:14 }}>
                    <SH>Your defensive trigger</SH>
                    <div style={{ fontSize:13, lineHeight:1.6, color: isBelow ? "#ff6b88" : "#fbbf24" }}>Two consecutive Friday closes below {fmtWhole(spx200)} AND VIX &gt;30 or HY &gt;400bps activates defensive posture.</div>
                  </div>
                </>);
              })()}
            </>}
            right={<><MCard><SH>Why the 200-DMA matters</SH><BC>The 200-day moving average represents roughly one year of trading. It is the single most watched trend line by institutional investors, hedge funds, and systematic strategies. When SPX breaks below it, many models automatically reduce equity exposure — creating self-reinforcing selling pressure.</BC></MCard>
              <MCard><SH>Historical 200-DMA breaks</SH><div style={{ display:"grid", gap:5, marginTop:8 }}>
                <HistRow val="-34%" event="COVID 2020" note="Broke · recovered in 23 days" />
                <HistRow val="-20%" event="2022 bear" note="Broke Jan · stayed below 10 months" />
                <HistRow val="-19%" event="Q4 2018" note="Broke Dec · recovered Feb 2019" />
                <HistRow val="-57%" event="GFC 2008" note="Broke Oct 2007 · 2 year bear" />
                <HistRow
                  val={spxVs(spx200)!=null?fmtSigned1(spxVs(spx200)!):"—"}
                  event="Today"
                  note={spxVs(spx200)==null?"Loading" : spxVs(spx200)! < 0 ? "Bearish · watch for confirmation" : spxVs(spx200)! <= 2 ? "Testing support zone" : "Holding above · trend intact"}
                  active
                />
              </div></MCard>
              {(() => {
                const pct200 = spxVs(spx200);
                const isBelow = pct200 != null && pct200 < 0;
                const pts = spxPrice != null ? Math.abs(spxPrice - spx200).toFixed(0) : "—";
                return (
                  <ActionCard>
                    {isBelow
                      ? `SPX is ${pts} pts below its 200-DMA (${fmtWhole(spx200)}). Roberts' scorecard currently shows 2/6 sustained-break indicators firing — CAUTION zone, not confirmed bear. The 200-DMA slope is still rising (bullish), RSI is deeply oversold (bullish), and AAII bears are above 45% (contrarian bullish). Weekly MACD and breadth are the two bearish confirms. This pattern matches 2015 and Q4 2018 — both found a lower low before recovering. Do NOT go to cash. Wait for a second consecutive Friday close below ${fmtWhole(spx200)} plus VIX >30 or HY >400bps before trimming VTI. Watch the 200-DMA slope weekly — if it starts declining, the scorecard upgrades and the playbook shifts.`
                      : `SPX is ${pts} pts above its 200-DMA. No break to evaluate. Watch for two consecutive Friday closes below ${fmtWhole(spx200)} — that is the trigger. If a break occurs, immediately run the Roberts 6-indicator scorecard: slope direction, weekly MACD, RSI level, AAII bears, breadth %, and death cross proximity. 0-2 bearish indicators = likely whipsaw, hold. 3+ = reduce risk.`
                    }
                  </ActionCard>
                );
              })()}
            </>}
          />
        </ModalWrapper>
      )}

      {modal==="nom10y" && (
        <ModalWrapper onClose={()=>setModal(null)} title="10Y Treasury Yield — Nominal" sub="US 10-Year Treasury Yield · The gravity of all asset valuations">
          <ModalGrid
            left={<>
              <SH>Current reading</SH>
              <div style={{ fontSize:44, fontWeight:700, color:"#fff", letterSpacing:"-0.03em", lineHeight:1, marginBottom:6 }}>{nom10y.toFixed(2)}<span style={{ fontSize:22 }}>%</span></div>
              <Tag label={nom10y>4.5?"Restrictive — Equity Headwind":nom10y>4?"Elevated — Watch":"Neutral"} color={nom10y>4.5?"#ff6b88":nom10y>4?"#fbbf24":"#4ade80"} bg={nom10y>4.5?"rgba(255,79,114,0.15)":nom10y>4?"rgba(245,158,11,0.15)":"rgba(74,222,128,0.15)"} />
              <BC>{nom10y>4?"At "+nom10y.toFixed(2)+"%, the 10Y yield is creating real competition for equities. Every dollar in bonds earns more than at any point in the 2010s — raising the bar for equity returns.":"Nominal yield is in a relatively neutral range — limited pressure on equity valuations."}</BC>
              <BandTrack
                segs={[{w:"33%",color:"#047857"},{w:"34%",color:"#f59e0b"},{w:"33%",color:"#ef4444"}]}
                needle={Math.max(0,Math.min(nom10y/6*100,99))}
                scaleNums={["0%","2%","4%","5%","6%"]}
                scaleNames={["Low","Neutral","Elevated","Restrictive",""]}
              />
              <div style={{ marginTop:16, background:"#141b47", border:"1px solid rgba(245,158,11,0.2)", borderRadius:10, padding:14 }}>
                <SH>Rate decomposition</SH>
                <div style={{ display:"grid", gap:6, marginTop:8, fontSize:13, color:"#cbd5e1", lineHeight:1.7 }}>
                  <div style={{ display:"flex", justifyContent:"space-between" }}><span>Nominal 10Y yield</span><span style={{ color:"#fff", fontWeight:600 }}>{nom10y.toFixed(2)}%</span></div>
                  <div style={{ display:"flex", justifyContent:"space-between" }}><span>5Y Breakeven inflation</span><span style={{ color:"#fff", fontWeight:600 }}>{breakeven5y.toFixed(2)}%</span></div>
                  <div style={{ display:"flex", justifyContent:"space-between" }}><span>Real 10Y (TIPS)</span><span style={{ color:"#fff", fontWeight:600 }}>{real10y.toFixed(2)}%</span></div>
                  <div style={{ height:1, background:"rgba(255,255,255,0.08)", margin:"4px 0" }} />
                  <div style={{ display:"flex", justifyContent:"space-between" }}><span style={{ fontWeight:600 }}>Inflation premium</span><span style={{ color:"#fbbf24", fontWeight:700 }}>{(nom10y-real10y).toFixed(2)}%</span></div>
                </div>
              </div>
            </>}
            right={<>
              <MCard>
                <SH>Why it matters</SH>
                <BC>The 10Y yield is the "gravity" of all financial markets. When it rises, it discounts future corporate earnings more heavily — compressing P/E multiples. Growth stocks, long-duration assets, and high-multiple equities are most sensitive. Every 100bps rise historically reduces fair-value P/E by 3-5x.</BC>
              </MCard>
              <MCard>
                <SH>Historical context</SH>
                <div style={{ display:"grid", gap:5, marginTop:8 }}>
                  <HistRow val="0.5%" event="2020 COVID low" note="Emergency levels · bull market fuel" />
                  <HistRow val="1.5%" event="2021 avg" note="Still accommodative · P/E expansion" />
                  <HistRow val="4.0%" event="Late 2022" note="First 4% breach since 2008" />
                  <HistRow val="5.0%" event="Oct 2023 peak" note="Multi-decade high · equity selloff" />
                  <HistRow val={nom10y.toFixed(2)+"%"} event="Today" note={nom10y>4.5?"Restrictive — headwind for multiples":"Elevated — still above neutral"} active />
                  <HistRow val="3.0%" event="Neutral estimate" note="Fed long-run rate estimate" />
                </div>
              </MCard>
              <ActionCard>{nom10y>4.5?`At ${nom10y.toFixed(2)}%, yields are restrictive. This is a structural headwind for equity P/E multiples. Combined with thin ERP, it supports a cautious posture on equity valuations.`:`At ${nom10y.toFixed(2)}%, the 10Y is elevated but below the 4.5% restrictive threshold. Monitor for a move above 4.5% — that would increase pressure on equity multiples significantly.`}</ActionCard>
            </>}
          />
        </ModalWrapper>
      )}

      {modal==="erp" && (
        <ModalWrapper onClose={()=>setModal(null)} title="Equity Risk Premium" sub="Earnings Yield minus Real 10Y Rate · The core math of equity vs bond valuation">
          <ModalGrid
            left={<>
              <SH>Current reading</SH>
              <div style={{ fontSize:44, fontWeight:700, color:"#fff", letterSpacing:"-0.03em", lineHeight:1, marginBottom:6 }}>
                {erpBps!=null?(erpBps/100).toFixed(2):"—"}<span style={{ fontSize:22 }}>%</span>
              </div>
              <Tag label={erpStatus(erpBps).label} color={erpStatus(erpBps).color} bg={erpStatus(erpBps).bg} />
              <BC>Stocks currently offer {erpBps!=null?(erpBps/100).toFixed(2):"—"}% extra return over risk-free bonds. Below 5% means equities are not compensating adequately for the risk of owning them.</BC>
              <div style={{ marginTop:14 }}>
                <SH>How it&apos;s calculated</SH>
                <div style={{ background:"#050a35", borderRadius:10, padding:12, marginTop:6, fontSize:12, lineHeight:1.8, color:"#94a3b8" }}>
                  <div>Trailing P/E: <span style={{ color:"#fff", fontWeight:600 }}>{trailingPE!=null?trailingPE.toFixed(1)+"x":"~24.2x"}</span></div>
                  <div>Earnings Yield (1÷PE): <span style={{ color:"#fff", fontWeight:600 }}>{trailingPE!=null?(100/trailingPE).toFixed(2)+"%":"~4.13%"}</span></div>
                  <div>Real 10Y Rate: <span style={{ color:"#fff", fontWeight:600 }}>{real10y.toFixed(2)}%</span></div>
                  <div style={{ borderTop:"0.5px solid rgba(255,255,255,0.08)", marginTop:6, paddingTop:6 }}>ERP = {trailingPE!=null?(100/trailingPE).toFixed(2):"4.13"}% − {real10y.toFixed(2)}% = <span style={{ color:erpBps!=null&&erpBps<500?"#fbbf24":"#4ade80", fontWeight:700 }}>{erpBps!=null?(erpBps/100).toFixed(2):"—"}%</span></div>
                </div>
              </div>
              <BandTrack
                segs={[{w:"25%",color:"#ef4444"},{w:"37.5%",color:"#f59e0b"},{w:"37.5%",color:"#047857"}]}
                needle={Math.max(0,Math.min((erpBps??0)/8,99))}
                scaleNums={["0%","2%","5%","8%+"]}
                scaleNames={["Danger","Watch","Healthy",""]}
              />
            </>}
            right={<>
              <MCard>
                <SH>Why it matters</SH>
                <BC>ERP is the "smart money math check." When it collapses below 2%, a rational institutional investor has almost no incentive to own equities over Treasuries. Why accept a 30-40% drawdown risk for less than 2% extra yield? Short-term government bonds yield ~5% with zero equity risk.</BC>
              </MCard>
              <MCard>
                <SH>Historical context</SH>
                <div style={{ display:"grid", gap:5, marginTop:8 }}>
                  <HistRow val="7.2%" event="2009 bottom" note="Stocks screaming cheap vs bonds" />
                  <HistRow val="3.5%" event="2012-2019 avg" note="Healthy bull market premium" />
                  <HistRow val="-2.1%" event="2000 Dot-Com" note="Bonds yielded more · 50% crash followed" />
                  <HistRow val="0.5%" event="2021 peak" note="Near-zero — fueled by ZIRP" />
                  <HistRow val={erpBps!=null?(erpBps/100).toFixed(2)+"%":"—"} event="Today" note={erpBps!=null&&erpBps<500?"Watch — below healthy threshold":"Healthy premium"} active />
                  <HistRow val="5%+" event="Healthy threshold" note="Adequate compensation for equity risk" />
                </div>
              </MCard>
              <ActionCard>ERP at {erpBps!=null?(erpBps/100).toFixed(2):"—"}% is {erpBps!=null&&erpBps<500?"below the 5% watch threshold. Equities are not offering a compelling premium over bonds at current rates. This supports a cautious stance on adding new equity exposure.":"above 5% — equities are offering adequate risk compensation."}</ActionCard>
            </>}
          />
        </ModalWrapper>
      )}

      {modal==="cape" && (
        <ModalWrapper onClose={()=>setModal(null)} title="CAPE Ratio — Cyclically Adjusted P/E" sub="Shiller P/E · 10-year inflation-adjusted earnings · Long-run valuation benchmark">
          <ModalGrid
            left={<>
              <SH>Current reading</SH>
              <div style={{ fontSize:44, fontWeight:700, color:"#fff", letterSpacing:"-0.03em", lineHeight:1, marginBottom:6 }}>
                {capeRatio.toFixed(1)}<span style={{ fontSize:22 }}>x</span>
              </div>
              <Tag label={capeRatio>35?"Extreme — Historically Dangerous":capeRatio>25?"Overvalued — Watch":"Elevated"} color={capeRatio>35?"#ff6b88":capeRatio>25?"#fbbf24":"#4ade80"} bg={capeRatio>35?"rgba(255,79,114,0.15)":capeRatio>25?"rgba(245,158,11,0.15)":"rgba(74,222,128,0.15)"} />
              <BC>At {capeRatio.toFixed(1)}x, CAPE is {(capeRatio/16).toFixed(1)}x the historical average of ~16x. Only the 2000 dot-com peak (~44x) has been higher. Late 2021 peaked near 38x. This level has historically preceded below-average 10-year forward returns.</BC>
              <BandTrack
                segs={[{w:"33%",color:"#047857"},{w:"22%",color:"#4ade80"},{w:"22%",color:"#f59e0b"},{w:"23%",color:"#ef4444"}]}
                needle={Math.max(0,Math.min(((capeRatio-5)/45)*100,99))}
                scaleNums={["5x","15x","25x","35x","50x"]}
                scaleNames={["Cheap","Fair","Elevated","Expensive","Extreme"]}
              />
              <div style={{ marginTop:16, background:"#141b47", border:"1px solid rgba(245,158,11,0.2)", borderRadius:10, padding:14 }}>
                <SH>10-year forward return implication</SH>
                <div style={{ fontSize:13, lineHeight:1.7, color:"#cbd5e1" }}>
                  At CAPE {">"} 30x, historical median 10-year annualized real returns have been ~0–2%. At current {capeRatio.toFixed(1)}x, the market is pricing in near-perfection — any mean reversion compresses returns significantly.
                </div>
              </div>
            </>}
            right={<>
              <MCard>
                <SH>What it measures</SH>
                <BC>CAPE divides the S&P 500 price by 10 years of inflation-adjusted earnings, smoothing out business cycle noise. Created by Robert Shiller (Nobel laureate), it is the most cited long-run valuation metric. High CAPE does not predict the timing of a crash — but it reliably predicts below-average long-run returns from that level.</BC>
              </MCard>
              <MCard>
                <SH>Historical context</SH>
                <div style={{ display:"grid", gap:5, marginTop:8 }}>
                  <HistRow val="27x" event="Black Tuesday 1929" note="Great Depression followed" />
                  <HistRow val="44x" event="Dot-com peak 2000" note="S&P fell ~50% over 2 years" />
                  <HistRow val="32x" event="Pre-GFC 2007" note="Financial crisis · -57% followed" />
                  <HistRow val="38x" event="Late 2021 peak" note="2022 bear market followed · -25%" />
                  <HistRow val={capeRatio.toFixed(1)+"x"} event="Today" note={capeRatio>35?"Extreme — near dot-com territory":"Overvalued — elevated risk"} active />
                  <HistRow val="16x" event="Historical average" note="Long-run mean since 1871" />
                </div>
              </MCard>
              <ActionCard>CAPE at {capeRatio.toFixed(1)}x is in the top 5% of all historical readings. This is not a timing signal — markets stayed expensive for years in the late 1990s. But it means the margin of safety is thin and the probability of below-average 10-year returns is elevated. Weight new equity purchases accordingly.</ActionCard>
            </>}
          />
        </ModalWrapper>
      )}

      {modal==="dxy" && (
        <ModalWrapper onClose={()=>setModal(null)} title="US Dollar Index (DXY)" sub="Trade-weighted basket of 6 major currencies · Global liquidity barometer">
          <ModalGrid
            left={<>
              <SH>Current reading</SH>
              <div style={{ fontSize:44, fontWeight:700, color:"#fff", letterSpacing:"-0.03em", lineHeight:1, marginBottom:6 }}>
                {dxy!=null?dxy.toFixed(2):"—"}
              </div>
              <Tag
                label={dxy==null?"Loading":dxy>104?"Strong Dollar — Liquidity Drain":dxy>100?"Elevated — Watch":dxy>96?"Neutral":"Weak — Liquidity Positive"}
                color={dxy==null?"#475569":dxy>104?"#ff6b88":dxy>100?"#fbbf24":"#4ade80"}
                bg={dxy==null?"rgba(71,85,105,0.15)":dxy>104?"rgba(255,79,114,0.15)":dxy>100?"rgba(245,158,11,0.15)":"rgba(74,222,128,0.15)"}
              />
              <BC>{dxy==null?"Loading current data."
                :dxy>104?"A strong dollar tightens global liquidity. Countries with dollar-denominated debt face higher repayment costs. Commodities priced in dollars fall. Emerging markets under pressure. This often precedes risk-off selling in equities."
                :dxy>100?"Dollar elevated but not extreme. Worth monitoring — a continued move above 104 would signal tightening liquidity conditions globally."
                :"Dollar in neutral range. This is generally supportive of global risk assets and emerging markets. Commodities tend to benefit from dollar weakness."}</BC>
              <BandTrack
                segs={[{w:"25%",color:"#047857"},{w:"30%",color:"#4ade80"},{w:"20%",color:"#f59e0b"},{w:"25%",color:"#ef4444"}]}
                needle={Math.max(0,Math.min(((dxy??100)-88)/32*100,99))}
                scaleNums={["88","96","100","104","120+"]}
                scaleNames={["Weak","Neutral","Elevated","Strong","Crisis"]}
              />
              <div style={{ marginTop:16, background:"#141b47", border:"1px solid rgba(245,158,11,0.25)", borderRadius:10, padding:14 }}>
                <SH>Confluence signal</SH>
                <div style={{ fontSize:13, lineHeight:1.7, color:"#cbd5e1" }}>
                  A DXY spike above 104 alongside a 200-DMA break is a warning sign — it suggests the selloff is systemic (global de-risking), not just a US equity correction. When DXY is below 100 during an equity dip, liquidity is flowing normally and the dip is more likely technical.
                </div>
              </div>
            </>}
            right={<>
              <MCard>
                <SH>What the DXY measures</SH>
                <BC>The Dollar Index tracks the USD against a basket of 6 currencies (EUR 57.6%, JPY 13.6%, GBP 11.9%, CAD 9.1%, SEK 4.2%, CHF 3.6%). A rising dollar means US assets attract capital, but it also drains liquidity from the rest of the world — particularly emerging markets and commodity exporters that borrow in dollars.</BC>
              </MCard>
              <MCard>
                <SH>Why it matters for your portfolio</SH>
                <BC>Your VEA position (developed international) is directly affected — a rising dollar erodes returns for US investors in foreign assets. Your GLDM position typically moves inversely to the dollar. A strong dollar also compresses earnings for US multinationals in the SPX. The dollar is the plumbing of global markets — when it moves sharply, everything else feels it.</BC>
              </MCard>
              <MCard>
                <SH>Historical context</SH>
                <div style={{ display:"grid", gap:5, marginTop:8 }}>
                  <HistRow val="114" event="Oct 2022 peak" note="20-year high · global EM stress" />
                  <HistRow val="89" event="Jan 2021 low" note="Weak dollar · bull market fuel" />
                  <HistRow val="103" event="Pre-COVID 2020" note="Typical strong-ish range" />
                  <HistRow val={dxy!=null?dxy.toFixed(2):"—"} event="Today" note={dxy!=null&&dxy>104?"Above stress threshold":dxy!=null&&dxy>100?"Elevated but manageable":"Neutral — supportive of risk assets"} active />
                  <HistRow val="100" event="Neutral zone" note="Below = dollar tailwind for global stocks" />
                </div>
              </MCard>
              <ActionCard>
                {dxy==null?"DXY data loading."
                :dxy>104?`DXY at ${dxy.toFixed(2)} — above stress threshold. This is tightening global liquidity. Your VEA international position faces currency headwind. Watch for continued dollar strength alongside equity weakness — that combination signals systemic risk, not a technical dip.`
                :dxy>100?`DXY at ${dxy.toFixed(2)} — elevated but below the critical 104 level. Dollar strength is a mild headwind for your VEA and GLDM positions. Not a standalone concern — monitor in context of other stress signals.`
                :`DXY at ${dxy.toFixed(2)} — neutral and supportive. Dollar weakness is generally positive for global risk assets and your international holdings. No dollar-driven liquidity concern at this level.`}
              </ActionCard>
            </>}
          />
        </ModalWrapper>
      )}

      {modal==="ad" && (
        <ModalWrapper onClose={()=>setModal(null)} title="NYSE Advance / Decline Line" sub="Cumulative breadth of the NYSE · Hidden strength or broad-based weakness">
          <ModalGrid
            left={<>
              <SH>Current signal</SH>
              <div style={{ fontSize:32, fontWeight:700, lineHeight:1.1, marginBottom:8, color:
                adLine?.signal==="bullish_divergence"?"#4ade80":(adLine?.signal==="confirming_weakness"||adLine?.signal==="bearish_divergence")?"#ff6b88":"#fbbf24" }}>
                {adLine?.signal==="bullish_divergence"?"Bullish Divergence ↑":adLine?.signal==="bearish_divergence"?"Bearish Divergence ↓":adLine?.signal==="confirming_weakness"?"Confirming Weakness ↓":"Neutral, Tracking"}
              </div>
              <Tag
                label={adLine?.signal==="bullish_divergence"?"Hidden Strength, Buy the Dip Setup":adLine?.signal==="bearish_divergence"?"Narrow Market, Index Masking Weakness":adLine?.signal==="confirming_weakness"?"Broad Selling, Defense Mode":"Neutral, Moving With SPX"}
                color={adLine?.signal==="bullish_divergence"?"#4ade80":(adLine?.signal==="confirming_weakness"||adLine?.signal==="bearish_divergence")?"#ff6b88":"#fbbf24"}
                bg={adLine?.signal==="bullish_divergence"?"rgba(74,222,128,0.15)":(adLine?.signal==="confirming_weakness"||adLine?.signal==="bearish_divergence")?"rgba(255,79,114,0.15)":"rgba(245,158,11,0.15)"}
              />
              <BC>{adLine?.note ?? "NYSE Advance/Decline line shows whether breadth is confirming or diverging from price."}</BC>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:14 }}>
                <div style={{ background:"#141b47", borderRadius:10, padding:14 }}>
                  <SH>A/D Trend (3 months)</SH>
                  <div style={{ fontSize:20, fontWeight:700, marginTop:6, color:
                    adLine?.adTrend==="higher_lows"?"#4ade80":adLine?.adTrend==="lower_lows"?"#ff6b88":"#fbbf24" }}>
                    {adLine?.adTrend==="higher_lows"?"↗ Higher Lows":adLine?.adTrend==="lower_lows"?"↘ Lower Lows":"→ Flat"}
                  </div>
                  <div style={{ fontSize:11, color:"#64748b", marginTop:4, lineHeight:1.5 }}>
                    {adLine?.adTrend==="higher_lows"?"Breadth improving, broad participation":adLine?.adTrend==="lower_lows"?"Breadth deteriorating, narrow market":"Breadth stalling"}
                  </div>
                </div>
                <div style={{ background:"#141b47", borderRadius:10, padding:14 }}>
                  <SH>vs SPX</SH>
                  <div style={{ fontSize:20, fontWeight:700, marginTop:6, color:
                    adLine?.adVsSpx==="diverging_up"?"#4ade80":adLine?.adVsSpx==="diverging_down"?"#ff6b88":"#94a3b8" }}>
                    {adLine?.adVsSpx==="diverging_up"?"↑ Diverging Up":adLine?.adVsSpx==="diverging_down"?"↓ Diverging Down":"→ Tracking"}
                  </div>
                  <div style={{ fontSize:11, color:"#64748b", marginTop:4, lineHeight:1.5 }}>
                    {adLine?.adVsSpx==="diverging_up"?"A/D strong while SPX weak, dip opportunity":adLine?.adVsSpx==="diverging_down"?"A/D weak while SPX holds up, few stocks carrying the index":"Breadth and price aligned"}
                  </div>
                </div>
              </div>
              <div style={{ marginTop:12, background:"#141b47", border:"1px solid rgba(148,163,184,0.2)", borderRadius:10, padding:12 }}>
                <div style={{ fontSize:10, color:"#475569", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em" }}>Data source</div>
                <div style={{ fontSize:12, color:"#94a3b8", marginTop:4, lineHeight:1.6 }}>
                  Manual monthly update · NYSE $NYAD cumulative via StockCharts · Updated {adLine?.updatedDate ?? "—"}
                </div>
              </div>
            </>}
            right={<>
              <MCard>
                <SH>What the A/D line measures</SH>
                <BC>Every day, the NYSE counts how many stocks advanced (closed higher) vs. declined (closed lower). The Advance/Decline line is a running cumulative total of that difference. It tells you whether the market move is broad-based — driven by most stocks — or narrow, driven by just a handful of large-cap names.</BC>
              </MCard>
              <MCard>
                <SH>Why it matters for the 200-DMA confirmation</SH>
                <BC>The S&P 500 is cap-weighted — a few mega-cap tech stocks can move the index while hundreds of smaller companies are already declining. When SPX breaks its 200-DMA but the A/D line is making higher lows, it means the broad market is holding up. The large-caps dragging SPX down are masking underlying strength. That&apos;s a classic buy-the-dip setup. When the A/D line confirms the break — declining alongside SPX — the selling is truly broad-based and more dangerous.</BC>
              </MCard>
              <MCard>
                <SH>Historical examples</SH>
                <div style={{ display:"grid", gap:5, marginTop:8 }}>
                  <HistRow val="2023" event="Bull market breakout" note="A/D made new highs — confirmed broad rally" />
                  <HistRow val="2021" event="Late bull warning" note="A/D diverged lower while SPX at highs — signal" />
                  <HistRow val="2022" event="Bear market" note="A/D confirmed — broad selling top to bottom" />
                  <HistRow val="2020" event="COVID recovery" note="A/D diverged up quickly — predicted recovery" />
                  <HistRow val="Today" event={`${adLine?.updatedDate ?? "—"} 2026`} note={adLine?.signal==="bearish_divergence"?"A/D falling while SPX near highs, similar setup to 2021":"Manual reading"} active />
                </div>
              </MCard>
              <ActionCard>
                {adLine?.signal==="bullish_divergence"
                  ?"A/D line diverging bullishly — the broad market is holding up even as SPX tests the 200-DMA. This is a classic head-fake signal. The large-cap weakness may not reflect what most stocks are doing. Treat as a potential dip opportunity, not a defensive trigger."
                  :adLine?.signal==="bearish_divergence"
                  ?"A/D line diverging bearishly. The S&P is holding near its highs, but most NYSE stocks have been falling since mid-August. A few large names are carrying the index. This isn't a sell signal by itself, since divergences can run for months, but it's a classic late-cycle warning. Watch for the S&P to break its 40-week average, which would turn the divergence into confirmed weakness."
                  :adLine?.signal==="confirming_weakness"
                  ?"A/D line confirming the selloff — broad-based selling across the NYSE. This is not a head-fake. The weakness extends beyond large-caps into the broad market. This supports a defensive posture alongside the other stress signals."
                  :"A/D line neutral and tracking SPX. No divergence signal currently. Monitor weekly for any change in direction relative to price."}
              </ActionCard>
            </>}
          />
        </ModalWrapper>
      )}

      <style dangerouslySetInnerHTML={{ __html:`
        *{box-sizing:border-box;}
        html,body{margin:0;padding:0;background:#0b0b2a;color:#fff;font-family:Inter,system-ui,-apple-system,sans-serif;}
        .pageShell{min-height:100vh;}
        .frame{max-width:1500px;margin:0 auto;padding:16px;}
        .topBar{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;}
        .title{margin:0;font-size:28px;font-weight:700;color:#16c75c;letter-spacing:-0.03em;}
        .topRight{display:flex;align-items:center;gap:14px;}
        .liveDot{display:flex;align-items:center;gap:6px;}
        .dot{display:inline-block;width:8px;height:8px;border-radius:50%;}
        .dotLive{background:#16c75c;box-shadow:0 0 6px #16c75c;animation:pulse 2s infinite;}
        .dotError{background:#ff4f72;}
        .dotLabel{font-size:12px;font-weight:600;color:#94a3b8;}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        .meta{text-align:right;font-size:12px;font-weight:600;line-height:1.35;color:#e2e8f0;}
        .errorBar{margin-bottom:12px;border:1px solid rgba(255,79,114,0.5);background:rgba(127,29,29,0.45);color:#fecdd3;border-radius:12px;padding:10px 14px;font-size:12px;font-weight:600;}
        .panel{background:#23255a;border-radius:16px;padding:14px;margin-bottom:14px;}
        .panelHeader{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:12px;}
        .panelTitle{font-size:17px;font-weight:700;}
        .panelSub{font-size:11px;font-weight:600;color:#cbd5e1;margin-top:2px;}
        .pstamp{font-size:11px;color:#475569;}
        .damage{font-size:12px;font-weight:600;color:#cbd5e1;white-space:nowrap;}
        .grid5{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;}
        .grid4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;}
        .grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;}
        .tile{background:#050a35;border-radius:10px;padding:12px;border:0.5px solid rgba(255,255,255,0.04);}
        .tile200{background:rgba(245,158,11,0.07)!important;border:1.5px solid rgba(245,158,11,0.4)!important;}
        .tile200Red{background:#1a0a0a!important;border:1.5px solid rgba(239,68,68,0.6)!important;}
        .tileTop{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;}
        .lbl{font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.04em;}
        .ytd{font-size:11px;font-weight:600;color:#64748b;}
        .badge{width:18px;height:18px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;}
        .valHero{font-size:38px;font-weight:700;letter-spacing:-0.03em;line-height:1;color:#fff;}
        .valMuted{font-size:26px;font-weight:700;letter-spacing:-0.02em;color:#94a3b8;}
        .sparkWrap{margin:6px 0 4px;}
        .status{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;margin-top:6px;}
        .sub{font-size:11px;color:#64748b;margin-top:3px;}
        .subSpx{font-size:11px;font-weight:600;color:#f8d7df;margin-top:3px;}
        .alertStrip{background:#0f172a;border:1px solid rgba(245,158,11,0.35);border-radius:10px;padding:10px 14px;margin-top:8px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
        .alertDot{width:7px;height:7px;border-radius:50%;background:#f59e0b;flex-shrink:0;box-shadow:0 0 5px #f59e0b;display:inline-block;}
        .alertTitle{font-size:12px;font-weight:700;color:#f59e0b;white-space:nowrap;}
        .alertBody{font-size:12px;color:#94a3b8;}
        .alertStripCritical{background:#0f172a;border:1px solid rgba(239,68,68,0.5);border-radius:10px;padding:10px 14px;margin-top:8px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
        .alertDotRed{width:7px;height:7px;border-radius:50%;background:#ef4444;flex-shrink:0;box-shadow:0 0 6px #ef4444;display:inline-block;animation:pulse 1.5s infinite;}
        .alertTitleRed{font-size:12px;font-weight:700;color:#ff6b88;white-space:nowrap;}
        .alertBodyRed{font-size:12px;color:#fca5a5;}
        .meterTrack{position:relative;height:4px;border-radius:9999px;background:#202a64;margin-top:10px;}
        .meterFill{position:absolute;left:0;top:0;height:4px;border-radius:9999px;}
        .meterMarker{position:absolute;top:50%;width:2px;height:16px;transform:translateY(-50%);background:#f8fafc;}
        .meterScale{margin-top:5px;display:flex;justify-content:space-between;font-size:10px;color:#475569;}
        .bbar{height:7px;border-radius:9999px;background:#202a64;overflow:hidden;margin:8px 0 4px;}
        .bbarFill{height:7px;border-radius:9999px;}
        .pillR{display:inline-block;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;text-transform:uppercase;letter-spacing:0.04em;margin-top:6px;background:rgba(255,79,114,0.15);color:#ff6b88;}
        .pillA{display:inline-block;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;text-transform:uppercase;letter-spacing:0.04em;margin-top:6px;background:rgba(245,158,11,0.15);color:#fbbf24;}
        .pillG{display:inline-block;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;text-transform:uppercase;letter-spacing:0.04em;background:rgba(34,197,94,0.15);color:#4ade80;}
        .valTable{width:100%;border-collapse:collapse;font-size:13px;}
        .valTable th{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#475569;padding:0 12px 8px;}
        .valTable td{padding:9px 12px;border-top:0.5px solid rgba(255,255,255,0.05);}
        .ivyTable{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:8px;}
        .ivyTable th{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#475569;padding:6px 12px;text-align:left;border-bottom:0.5px solid rgba(255,255,255,0.08);}
        .ivyTable td{padding:9px 12px;border-bottom:0.5px solid rgba(255,255,255,0.05);}
        .sumBar{background:#030720;border-radius:10px;padding:10px 14px;margin-top:8px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
        .sumBarLabel{font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.06em;flex-shrink:0;}
        @media(max-width:900px){.title{font-size:22px;}.valHero{font-size:28px;}}
        @media(max-width:700px){
          .topBar,.panelHeader{flex-direction:column;align-items:flex-start;}
          .grid5,.grid4{grid-template-columns:repeat(2,minmax(0,1fr));}
          .allocGrid{grid-template-columns:repeat(2,minmax(0,1fr)) !important;}
          .grid3{grid-template-columns:1fr;}
          .alertStrip,.alertStripCritical{flex-direction:column;align-items:flex-start;gap:4px;}
          .title{font-size:20px;}
          .hideMobile{display:none;}
          .sourceLabel{display:none;}
          .topRight{display:flex;flex-direction:row;align-items:center;gap:8px;margin-top:4px;}
          .meta{text-align:left;line-height:1.35;}
        }
      `}} />
    </>
  );
}
