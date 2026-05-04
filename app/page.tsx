"use client";

import { useEffect, useState, useRef } from "react";

type AnyObj = Record<string, any>;
type Modal = "vix" | "hy" | "yc" | "real10y" | "dma200" | "erp" | "nom10y" | "cape" | "dxy" | "ad" | null;

export default function Page() {
  const [modal, setModal] = useState<Modal>(null);
  const [marketData, setMarketData] = useState<AnyObj | null>(null);
  const [lastUpdated, setLastUpdated] = useState("");
  const [feedError, setFeedError] = useState("");
  const [aiTab, setAiTab] = useState("summary");
  const [aiCache, setAiCache] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: string; text: string }[]>([]);
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

  // DMA slopes (% change over last 20 trading days)
  const slope20 = getNum(metrics?.spx_20dma?.slope, marketData?.spx_20dma?.slope);
  const slope50 = getNum(metrics?.spx_50dma?.slope, marketData?.spx_50dma?.slope);
  const slope200 = getNum(metrics?.spx_200dma?.slope, marketData?.spx_200dma?.slope);

  // Market regime
  const regime = metrics?.regime ?? marketData?.regime ?? null;
  const regimeLabel = metrics?.regime_label ?? marketData?.regime_label ?? null;
  const regimeDesc = metrics?.regime_desc ?? marketData?.regime_desc ?? null;
  const regimeColor = metrics?.regime_color ?? marketData?.regime_color ?? "#fbbf24";
  const regimeEmoji = metrics?.regime_emoji ?? marketData?.regime_emoji ?? "🟡";
  const spxDailyPct = getNum(metrics?.spx_change_pct, marketData?.spx_change_pct);
  const spxYtd = getNum(metrics?.spx_ytd_pct, marketData?.spx_ytd_pct) ?? -2.13;
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
  const capeRatio = getNum(metrics?.cape_ratio, marketData?.cape_ratio) ?? 40.2;
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
  const compositeScore10 = Math.round((compositeScore / 15) * 10);
  const compositeScores = metrics?.composite_scores ?? marketData?.composite_scores ?? { cape:2, buffett:2, vix:1, hy:2, yc:1, breadth:1, erp:1, ivy:1 };
  const compositeAllocation: string = metrics?.composite_allocation ?? marketData?.composite_allocation ?? "42–45%";
  const compositeSignal: string = metrics?.composite_signal ?? marketData?.composite_signal ?? "SLIGHT TILT";
  const compositeColor: string = metrics?.composite_color ?? marketData?.composite_color ?? "#fbbf24";
  const valuationFloor: boolean = metrics?.valuation_floor_active ?? marketData?.valuation_floor_active ?? false;
  const buffettSigma  = getNum(metrics?.buffett_sigma,    marketData?.buffett_sigma) ?? 2.49;
  const fedStance: string = metrics?.fed_stance ?? marketData?.fed_stance ?? "holding";
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

  // Official last month-end signals — update each month when Advisor Perspectives publishes
  // Source: advisorperspectives.com/dshort · Last updated: Apr 30, 2026
  // VTI: Invest · VEU: Invest · IEF: Invest · VNQ: Invest · DBC: Invest (all 5 flipped from Mar)
  const ivyOfficialSignals: Record<string, "Invest" | "Cash"> = {
    vti: "Invest", veu: "Invest", ief: "Invest", vnq: "Invest", dbc: "Invest"
  };
  const ivyOfficialDate = "Apr 30";
  const ivyEOMDate = "May 31";

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
    const forecastLabel = variance == null ? "Loading"
      : variance <= -2   ? "Exit Risk High"
      : variance <= 0    ? "Flip Risk"
      : variance <= 2    ? "Watch"
      : "On Track";
    const forecastColor = variance == null ? "#475569"
      : variance <= 0    ? "#ff6b88"
      : variance <= 2    ? "#fbbf24"
      : "#4ade80";
    const forecastPill = variance == null ? ""
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

  // 5-state DMA label engine — factors in both position AND direction of travel
  // slope: positive = DMA rising (bullish context), negative = falling
  // spxDailyPct: positive = SPX moving up today (recovering), negative = moving down
  const dmaState = (pct: number | null, slope?: number | null, isLong = false) => {
    if (pct == null) return "Loading";
    if (pct < 0) {
      // Below DMA — is SPX recovering toward it or moving away?
      return (spxDailyPct != null && spxDailyPct > 0) ? "Recovering" : "Bearish";
    }
    if (isLong && pct <= 2) return "Testing Support";
    // Above DMA — is slope rising (bullish) or flattening/falling?
    if (slope != null && slope > 0.02) return "Bullish";
    return "Holding Above";
  };
  const dmaTone = (pct: number | null, slope?: number | null, isLong = false) => {
    if (pct == null) return "neutral";
    if (pct < 0) return (spxDailyPct != null && spxDailyPct > 0) ? "warning" : "danger";
    if (isLong && pct <= 2) return "warning";
    if (slope != null && slope > 0.02) return "healthy";
    return "healthy"; // above DMA is always at minimum healthy
  };
  const toneColor = (tone: string) => ({ danger: "#ff6b88", warning: "#fbbf24", healthy: "#4ade80", neutral: "#94a3b8" }[tone] ?? "#94a3b8");

  const vixStatus = vixValue == null ? { label: "Loading", sub: "", color: "#94a3b8" }
    : vixValue >= 30 ? { label: "Stress — Pause Buying", sub: "Trigger breached · Pause new buying", color: "#ff6b88" }
    : vixValue >= 20 ? { label: "Slightly Elevated", sub: "Rising fear and potential volatility", color: "#fbbf24" }
    : { label: "Normal", sub: "Calm · No action required", color: "#4ade80" };

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
  // ─────────────────────────────────────────────────────────────────────────

  const investorProfile = `
INVESTOR PROFILE — Filter ALL recommendations through this context:
- Age: 54 years old. Target retirement: ~5 years (age ~59).
- Priority: Sequence-of-returns risk management. Protecting 30 years of accumulated wealth in the final mile is the #1 objective. A catastrophic drawdown in the next 5 years cannot be recovered from on the retirement timeline.
- Psychological profile: Resilient — would not panic-sell a 30% drawdown, might buy more. But intellectually understands that discipline at this stage means NOT needing to test that resolve.
- Income: Strong external income still coming in. Portfolio does not need to generate income yet — it needs to survive and grow moderately.
- Current positioning: Already defensively positioned at 40/60 equity/bond — an intentional, valuation-driven decision given CAPE at 40x. This is not fear — it is discipline.
- Cash view: Treats SGOV (5% T-bills) as a legitimate asset class at current rates, not dead money. Aligned with Buffett's current $373B T-bill positioning.
- Inflation awareness: VTIP position reflects explicit concern about inflation eroding purchasing power — a real risk at 5 years from retirement.
- Future intent: Wants to shift more aggressive when valuations normalize — not a permanent bear, a disciplined opportunist waiting for better prices.
- Key fear: Sequence-of-returns risk event (2008-style) in the 2–5 year window before retirement. A 40–50% drawdown at age 56–58 with no time to recover is the nightmare scenario.

CURRENT PORTFOLIO (7 positions, 100%):
EQUITY (40% total):
  - VTI  10% — Vanguard Total Market (US broad exposure)
  - SCHD 15% — Schwab Dividend Equity (quality/value tilt, lower vol)
  - VEA  15% — Vanguard Developed Markets Intl (cheap on valuation, Grantham-approved)
FIXED INCOME (55% total):
  - SGOV 20% — iShares 0-3M T-Bills (~5% yield, zero duration risk, Buffett positioning)
  - VTIP 20% — Vanguard Short-Term TIPS (inflation hedge, real return protection)
  - VGIT 15% — Vanguard Intermediate Treasury (some duration, quality fixed income)
REAL ASSETS (5%):
  - GLDM 5% — SPDR Gold (Dalio all-weather tail risk hedge)

PORTFOLIO INTERPRETATION FOR AI:
- The 60% fixed income/cash is not timid — it is appropriate and sophisticated for a 54-year-old at CAPE 40x with a 5-year retirement horizon
- SGOV + VTIP = 40% explicitly protecting against the two biggest retirement risks: market crash and inflation
- SCHD and VEA represent quality equity exposure with lower drawdown profiles than pure growth
- No long-duration bonds — avoided the 2022 bond massacre. Intermediate only (VGIT)
- Gold at 5% provides uncorrelated tail hedge without being a speculative position
- When triggers fire or conditions deteriorate further, defensive posture = reduce VTI first, hold SCHD and VEA, increase SGOV
- When valuations normalize (CAPE toward 20–25x, ERP above 5%), the playbook shifts: gradually increase VTI, add domestic quality growth, reduce SGOV as T-bill rates fall

FRAMING RULE: Every recommendation must answer "given that this investor is 5 years from retirement with a 40/60 portfolio already positioned defensively, does this change anything — and if so, specifically what and why?"`;

  const systemPrompt = `You are a Personal Wealth Strategist — a single synthesized voice drawing from the frameworks of twelve of the world's most respected market thinkers: Lance Roberts (technical discipline, trend analysis), Howard Marks (risk-first, probabilistic thinking), Stanley Druckenmiller (asymmetric macro positioning), Warren Buffett (patience, valuation, burden of proof), Ray Dalio (debt cycle awareness, structural risk), John Hussman (valuation math, internals as timing filter), James Stack (capital preservation, checklist discipline), Rick Rieder (credit markets, dispersion regime), Jeremy Grantham (bubble anatomy, mean reversion gravity), Peter Leyden (secular bull case, productivity supercycle), Doug Noland (credit plumbing, leverage unwind risk), Pieter Slegers (quality framework, moat durability), and Henrik Zeberg (Elliott Wave structure, sentiment cycles, contrarian rally thesis).

${investorProfile}

YOUR VOICE AND APPROACH:
You are not a data summarizer. The investor can read the dashboard numbers themselves. Your job is to tell them what those numbers mean — what's hiding beneath the surface, what the historical analogs suggest, what the market is pricing in that it probably shouldn't be, and where the real risk is coming from that isn't obvious. Think like Roberts writing his weekly Bull Bear Report or Noland writing his Credit Bubble Bulletin — you're connecting dots across credit, technicals, sentiment, and macro that most investors don't see until it's too late.

You speak with calm authority, like a trusted advisor who has seen many cycles. You present the bull and bear case honestly but you don't hide behind false balance — when the weight of evidence leans one way, you say so directly. You anchor every insight to specific numbers but you go beyond the numbers to explain the mechanism: why does this level matter, what happens next when it breaks, what are market participants not pricing in. You never pretend to know what markets will do — but you define the probabilities and name the levels that would change your view.

Most importantly: you write about what's really going on underneath, not what's on the surface. If breadth is deteriorating while the index holds — say what that means and why it matters. If credit spreads are widening while stocks rally — explain the tension and which market is right. If sentiment is at extremes — explain the mechanism by which that resolves. The investor already has the data. Give them the insight.

CORE FRAMEWORKS YOU APPLY:
1. VALUATION FIRST (Buffett/Hussman/Grantham): CAPE at ${capeRatio.toFixed(1)}x is in the top 5% of all historical readings. ERP at ${erpBps != null ? (erpBps/100).toFixed(2) : "~2.2"}% is below the 5% healthy threshold. 4/5 valuation models signal overvalued. The burden of proof is on the bull case. High CAPE does not predict timing — but it means the margin of safety is thin and 10-year forward returns are historically poor from this level. Grantham's warning: the Internet was real and still produced a 78% Nasdaq crash. Leyden's counterpoint: we may be early in a genuine productivity supercycle. Hold this tension — don't resolve it prematurely.
2. TREND DISCIPLINE (Roberts/Stack): The 200-DMA is the line between a correction and a bear market. The 100-DMA is the short-term bull/bear line. The trend is your friend until it bends — but "resilience is not the same as safety." Defensive trigger = two consecutive Friday closes below SPX 200-DMA (${fmtWhole(spx200)}) AND VIX >30 OR HY >400bps. Rules exist so emotion doesn't override discipline.
3. SUSTAINED vs BRIEF 200-DMA BREAK (Roberts — Mar 23 2026): The 200-DMA break is not a verdict. It is a question. Since 2000, there have been 12 breaks. Seven were sustained (avg 12-month return: -4.0%, zero positive first months). Five were brief whipsaws (avg 12-month return: +19.8%, 100% positive at 3/6/9/12 months). The difference is determined by a 6-indicator scorecard — when 3+ fire simultaneously, sustained decline follows; 0-1 firing = almost always a whipsaw. The six indicators: (1) 200-DMA slope direction — flat/falling = sustained, rising = whipsaw; (2) Weekly MACD — negative before price confirms = sustained; (3) RSI below 32 at break = fear capitulated = bullish contrarian signal; (4) AAII Bears above 45% = too much pessimism = contrarian buy; (5) Breadth below 40% of SPX members above their 200-DMA before the break = sustained; (6) 50-DMA converging toward 200-DMA (death cross forming) = sustained. CURRENT SCORECARD (Mar 23 2026): 200-DMA slope still rising ✅ bullish; Weekly MACD turned negative ❌ bearish; RSI in low 30s ✅ bullish; AAII Bears at 52% (above 45% threshold) ✅ bullish; Breadth at 46% ❌ bearish; No death cross forming ✅ bullish. Score: 2/6 sustained break indicators firing. Roberts' verdict: "CAUTION zone" — more like 2015 or Q4 2018 than 2008. A lower low is possible before recovery, but a reflexive rally is likely first. The goal is NOT to go to cash — it is to reduce the cost of being wrong while staying positioned for recovery. For this investor: trim VTI modestly if a second Friday close below ${fmtWhole(spx200)} confirms, hold SCHD/VEA/GLDM, keep SGOV/VTIP full. Watch the 200-DMA SLOPE — if it begins declining over the next 4-6 weeks while price stays below, the scorecard upgrades to 3-4 and the playbook shifts to full defense.
3. MOVING AVERAGE HIERARCHY (Roberts): 20/50-DMA = short-term momentum. 100-DMA = intermediate trend support, if lost confirms topping process. 200-DMA = corrective process signal, sustained break = bear market likely. 52-week MA = cyclical bear confirmation. 208-week MA = if this fails, bears have full control.
4. ROTATION VS DETERIORATION TEST (Roberts): Defensive sector outperformance is only truly bearish when BOTH earnings estimates are falling AND jobless claims are rising. Without both, defensive rotation may simply be healthy broadening, not distribution.
5. CREDIT LEADS EQUITIES (Noland/Rieder): HY spreads, bank CDS, and swap spreads moving together signals systemic risk, not just technical weakness. Credit stress compounds non-linearly. Small spread moves are warnings. Spread moves accompanied by bank CDS widening are a different animal entirely. Watch the pipes before the flood.
6. RISK PRICING (Marks): Always ask — what am I being paid to accept this risk? At current ERP of ${erpBps != null ? (erpBps/100).toFixed(2) : "~2.2"}%, T-bills at ~5% offer meaningful competition with zero equity risk. The asymmetry must favor the investor, not the market.
7. CAPITAL PRESERVATION MATH (Stack/Buffett): A 50% loss requires a 100% gain to recover. Avoiding the big loss is mathematically more important than capturing the next 20% gain. Patience is a competitive advantage — "Often, nothing looks compelling; very infrequently, we find ourselves knee-deep in opportunities."
8. DEBT CYCLE AWARENESS (Dalio): The most dangerous period for equities is 12-18 months AFTER the yield curve un-inverts, not during inversion. The lagged effects of prior tightening are still working through the economy. Foreign confidence in US assets (watch DXY) is a structural risk.
9. DISPERSION REGIME (Rieder): The easy money from generic index investing is over. Labor softening is the key pothole to watch. Balance sheet quality — free cash flow, low debt — matters more in a higher-for-longer rate environment. Idiosyncratic risk is rising.
10. LEVERAGE UNWIND RISK (Noland): When crowded levered trades break, correlations go to 1. Diversification fails exactly when needed. External shocks don't create vulnerabilities — they reveal ones already there.
11. SENTIMENT & WAVE STRUCTURE (Zeberg): Markets move on expectations and positioning, not just fundamentals. When sentiment is extremely bearish and positioning is defensively crowded, the path of least resistance is often a sharp counter-trend rally — the "most hated rally" — before the fundamental thesis ultimately plays out. The 2007 analog: Nasdaq rallied 25% August–October while recession was already inevitable. Wave 5 structures in long-term bull markets are characterized by acceleration, narrative dominance, and overconfidence — then severe structural correction. Current tech bull market (2002–2026) shows Wave 5 exhaustion characteristics. The contrarian read: extreme fear and defensive positioning can fuel violent short-term rallies that feel like confirmation the system is holding — but are actually the final phase. Do not panic-sell into maximum fear, but do not interpret the resulting rally as an all-clear. Use Zeberg's framework to AVOID reactive decisions at emotional extremes in either direction.
12. CDX / CREDIT LEADING INDICATOR (Roberts — Mar 21 2026): The CDX Index (credit default swaps) is the bond market's real stress gauge — harder to manipulate than equities, not susceptible to retail momentum. KEY SIGNAL: When CDX hits a 9-month high while SPX is within 5% of its all-time high, a bear market has followed every single time over 20 years (2007 → GFC, 2015 → correction, 2022 → -25% bear). This signal is currently ACTIVE in 2026. Direction of travel matters more than absolute level — don't wait for the spike, act on the trend. Current backdrop per Roberts (Mar 21 2026): S&P closed at 6,506, down 7.1% from January ATH of 7,002. Fourth consecutive weekly loss. 200-DMA (~6,620) decisively broken and failed every attempt to reclaim. Failed mid-week bull trap (Monday/Tuesday relief rally reversed violently on Fed Wednesday). PPI +0.7% MoM hottest since July 2025, pipeline inflation building. Fed hawkish hold at 3.5-3.75%, dot plot pointing to just 1 cut in 2026, 7 participants signaling zero cuts. Powell: "not as much progress as we had hoped." Private credit deteriorating quietly — Blackstone, Blue Owl, BlackRock redemption requests approaching 5% threshold. Iraq force majeure on oil fields broadening Hormuz disruption. Brent above $108. Technical composite at 23.98 — very oversold, reflexive rally odds increasing. Roberts' framework: "This is a shopping list market, not a buy-everything market. Accumulate quality at pre-defined levels (6,400 then 6,300). Treat every bounce as suspect until VIX sustains below 20 and oil finds a ceiling. Defense over offense." Oil is the master switch — Brent below $95 gives Fed breathing room; above $110 keeps Fed frozen and deepens the landing.

OUTPUT FORMAT — CRITICAL INSTRUCTION:
Write in Lance Roberts' voice — direct, confident, data-anchored prose. NOT bullet points. Think of his weekly Bull Bear Report style: short punchy paragraphs, every claim backed by a specific number, clear narrative arc from tape → credit → valuation → action. 

Structure your response as 3-4 short paragraphs maximum. Each paragraph should open with the key point, support it with specific data from the dashboard, and connect it to what it means for this investor. No filler. No hedging. No "it depends." Name the specific price level or indicator that would change your view. End with one clear sentence — the single most important thing to watch or do right now.

Forbidden phrases: "it's important to note," "investors should consider," "in conclusion," "on the other hand." 
Required elements: at least 3 specific numbers from the dashboard, the 200-DMA level by name, and one named position from the portfolio.

CURRENT DASHBOARD DATA (live):
- SPX: ${spxPrice != null ? fmtWhole(spxPrice) : "loading"} | Today: ${spxDailyPct != null ? spxDailyPct.toFixed(2) + "%" : "?"} | YTD: ${spxYtd.toFixed(2)}%
- vs 20-DMA (${fmtWhole(spx20)}): ${spxVs(spx20) != null ? fmtSigned1(spxVs(spx20)!) : "?"}
- vs 50-DMA (${fmtWhole(spx50)}): ${spxVs(spx50) != null ? fmtSigned1(spxVs(spx50)!) : "?"}
- vs 100-DMA (${fmtWhole(spx100)}): ${spxVs(spx100) != null ? fmtSigned1(spxVs(spx100)!) : "?"}
- vs 200-DMA (${fmtWhole(spx200)}): ${spxVs(spx200) != null ? fmtSigned1(spxVs(spx200)!) : "?"} ${is200Broken ? "⚠ BREACHED" : ""}
- DMAs broken: ${damageCount}/4
- VIX: ${vixValue != null ? fmt1(vixValue) : "loading"} ${vixValue != null && vixValue >= 30 ? "⚠ ABOVE TRIGGER" : ""}
- HY Spread: ${hySpread.toFixed(2)}% ${hySpread >= 4 ? "⚠ ABOVE TRIGGER" : `(${Math.round((4-hySpread)*100)}bps to trigger)`}
- Yield Curve (10Y-2Y): ${yieldCurve.toFixed(2)}%
- Real 10Y: ${real10y.toFixed(2)}% | Nominal 10Y: ${nom10y.toFixed(2)}%
- Fed Funds: ${fedFunds.toFixed(2)}% | 5Y Breakeven: ${breakeven5y.toFixed(2)}%
- ERP: ${erpBps != null ? (erpBps/100).toFixed(2) + "%" : "unavailable"}
- CAPE: ${capeRatio.toFixed(1)}x
- Fear & Greed: ${Math.round(fearGreedScore)} — ${fearGreedRating} ${fearGreedScore <= 20 ? "⚠ EXTREME FEAR (contrarian rally setup — Zeberg)" : fearGreedScore >= 80 ? "⚠ EXTREME GREED (Grantham bubble warning)" : ""}
- DXY: ${dxy != null ? dxy.toFixed(2) : "loading"}
- Brent Crude: ${brentPrice != null ? `$${brentPrice.toFixed(2)}` : "loading"}${brentChangePct != null ? ` (${brentChangePct >= 0 ? "+" : ""}${brentChangePct.toFixed(1)}% today)` : ""} · ${brentRegime === "frozen" ? "⚠ Above $110 — Fed frozen, deepens landing risk" : brentRegime === "watch" ? "Watch zone $95-110 — Fed limited" : brentRegime === "neutral" ? "Neutral $80-95" : brentRegime === "room" ? "Below $80 — Fed has room to cut" : "loading"}
- Fed Balance Sheet (WALCL): ${walclBn != null ? `$${(walclBn/1000).toFixed(2)}T` : "loading"}${walclChgBn != null ? ` · ${walclChgBn > 0 ? "▲" : "▼"} $${Math.abs(walclChgBn)}B WoW · ${walclDirection}` : ""}
- Dow Transports (DJT): ${djtPrice != null ? fmtWhole(djtPrice) : "loading"} vs 200-DMA ${djt200dma != null ? fmtWhole(djt200dma) : "—"} (${djtVs200 != null ? `${djtVs200 >= 0 ? "+" : ""}${djtVs200.toFixed(1)}%` : "?"}) · Slope: ${djt200slope != null ? `${djt200slope > 0 ? "↗" : "↘"} ${djt200slope.toFixed(1)}%` : "—"}
- Schannep 2-of-3 Signal: ${schannepLabel} — ${schannepSignal === "non_confirmation_bear" ? "SPX broken but DJT not confirming — watch closely" : schannepSignal === "bear" ? "Both indices below 200-DMA — strongest bear signal" : schannepSignal === "non_confirmation_bull" ? "DJT holding, potential recovery setup" : "Both confirming bull"}
- Ivy Portfolio: ${ivyInvestedCount}/5 assets Invested · VTI and VNQ flipped to Cash at Mar 31 close · ${ivyPositions.filter(p => p.variance != null && Math.abs(p.variance) < 2).map(p => p.ticker + " NEAR SIGNAL").join(", ") || "No positions near signal line"}
- Valuation models: 4/5 overvalued

RESPONSE RULES:
- Always use actual numbers from the dashboard — never speak in generalities
- Lead with what the data says, then what the frameworks say, then what to do
- Present the bull and bear case when the evidence supports both
- Name the specific price level or indicator that would change your view
- Never predict — assess probabilities and define the levels that resolve uncertainty
- Be direct and concise — this investor is sophisticated, not a beginner
- End every response with a clear action or watch item
- The trend is your friend until it bends. The rules exist for a reason. Don't fight the tape, but don't ignore the price being paid for risk.`;

  const callClaude = async (prompt: string, key: string, msgs?: { role: string; content: string }[]) => {
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai-strategist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt, messages: msgs ?? [{ role: "user", content: prompt }] }),
      });
      const data = await res.json();
      const text = data.text ?? data.error ?? "Unable to load.";
      if (!msgs) setAiCache(prev => ({ ...prev, [key]: text }));
      return text;
    } catch (err: any) {
      const text = `Error: ${err?.message ?? "Request failed"}`;
      if (!msgs) setAiCache(prev => ({ ...prev, [key]: text }));
      return text;
    } finally { setAiLoading(false); }
  };

  useEffect(() => {
    callClaude(`Using the live dashboard data as context, write a market insight piece in the style of Lance Roberts' Bull Bear Report. Don't summarize the data — interpret it. What is the market really telling us right now that isn't obvious from the headline numbers? What is the tension between what equities are pricing and what credit markets are saying? What historical analog best fits the current setup and what does that analog predict about the path forward? What are most investors getting wrong about this moment? Write 3-4 paragraphs of genuine insight. End with the single most important thing to understand about this market right now.`, "summary");
  }, []);

  const handleAiTab = (tab: string) => {
    setAiTab(tab);
    const prompts: Record<string, string> = {
      summary: `Using the live dashboard data as context, write a market insight piece in the style of Lance Roberts' Bull Bear Report. Don't summarize the data — interpret it. What is the market really telling us right now that isn't obvious from the headline numbers? What is the tension between what equities are pricing and what credit markets are saying? What historical analog best fits the current setup and what does that analog predict about the path forward? What are most investors getting wrong about this moment? Write 3-4 paragraphs of genuine insight. End with the single most important thing to understand about this market right now.`,
      action: `Using the live dashboard data, write a portfolio strategy note in the style of Lance Roberts — not a to-do list, but a genuine strategic assessment of where this investor stands and what the framework is saying. This investor is 54 years old, 5 years from retirement, 40/60 equity/bond, holding VTI/SCHD/VEA/SGOV/VTIP/VGIT/GLDM. What is the current regime telling you about their positioning? What are the hidden risks in their portfolio that the headline allocation doesn't reveal? What would the framework need to see to change the posture — and what specifically would that look like in practice? Don't just list actions — explain the reasoning behind the framework and why discipline matters more than reaction at this stage of the market cycle.`,
      triggers: `Using the live dashboard data, write a trigger and risk assessment in the style of Doug Noland's Credit Bubble Bulletin — focused on what's happening beneath the surface of the market that most investors aren't watching. Where is the stress building that hasn't shown up in equity prices yet? What does the credit market know that equities don't? Walk through the Roberts 6-indicator scorecard for sustained vs brief 200-DMA breaks — but go beyond listing the indicators to explain what each one is actually measuring and why it matters. What is the mechanism by which this correction either resolves or deepens? Name the specific tripwire that separates a 2015-style whipsaw recovery from a 2022-style sustained bear.`,
    };
    if (tab !== "chat" && !aiCache[tab]) callClaude(prompts[tab], tab);
  };

  const refreshAiTab = () => {
    const prompts: Record<string, string> = {
      summary: `Using the live dashboard data as context, write a market insight piece in the style of Lance Roberts' Bull Bear Report. Don't summarize the data — interpret it. What is the market really telling us right now that isn't obvious from the headline numbers? What is the tension between what equities are pricing and what credit markets are saying? What historical analog best fits the current setup and what does that analog predict about the path forward? What are most investors getting wrong about this moment? Write 3-4 paragraphs of genuine insight. End with the single most important thing to understand about this market right now.`,
      action: `Using the live dashboard data, write a portfolio strategy note in the style of Lance Roberts — not a to-do list, but a genuine strategic assessment of where this investor stands and what the framework is saying. This investor is 54 years old, 5 years from retirement, 40/60 equity/bond, holding VTI/SCHD/VEA/SGOV/VTIP/VGIT/GLDM. What is the current regime telling you about their positioning? What are the hidden risks in their portfolio that the headline allocation doesn't reveal? What would the framework need to see to change the posture — and what specifically would that look like in practice? Don't just list actions — explain the reasoning behind the framework and why discipline matters more than reaction at this stage of the market cycle.`,
      triggers: `Using the live dashboard data, write a trigger and risk assessment in the style of Doug Noland's Credit Bubble Bulletin — focused on what's happening beneath the surface of the market that most investors aren't watching. Where is the stress building that hasn't shown up in equity prices yet? What does the credit market know that equities don't? Walk through the Roberts 6-indicator scorecard for sustained vs brief 200-DMA breaks — but go beyond listing the indicators to explain what each one is actually measuring and why it matters. What is the mechanism by which this correction either resolves or deepens? Name the specific tripwire that separates a 2015-style whipsaw recovery from a 2022-style sustained bear.`,
    };
    if (aiTab !== "chat") {
      setAiCache(prev => { const n = {...prev}; delete n[aiTab]; return n; });
      callClaude(prompts[aiTab], aiTab);
    }
  };

  const sendChat = async () => {
    const q = chatInput.trim();
    if (!q || aiLoading) return;
    setChatInput("");
    const newMsgs = [...chatMessages, { role: "user", content: q }];
    setChatMessages(newMsgs);
    setChatHistory(prev => [...prev, { role: "user", text: q }]);
    const reply = await callClaude("", "chat", newMsgs);
    setChatMessages([...newMsgs, { role: "assistant", content: reply }]);
    setChatHistory(prev => [...prev, { role: "assistant", text: reply }]);
  };

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
            <h1 className="title">Prospect Market Dashboard</h1>
            <div className="topRight">
              <div className="liveDot">
                <span className={feedError ? "dot dotError" : "dot dotLive"} />
                <span className="dotLabel">{feedError ? "Feed error" : "Live · 60s refresh"}</span>
              </div>
              <div className="meta">
                <div>LIVE_YAHOO_FRED</div>
                <div>{feedError ? "Feed error" : lastUpdated ? `Refreshed ${lastUpdated}` : "Loading..."}</div>
              </div>
            </div>
          </div>

          {feedError && <div className="errorBar">Feed error: {feedError}</div>}

          {/* ⓪-A COMPOSITE SCORE HERO — slim strategic banner */}
          {(() => {
            // Gradient color at exact score position (0=green → 14=red)
            const pct = compositeScore / 15;
            const gradColor = pct <= 0.21 ? "#4ade80" : pct <= 0.43 ? "#86efac" : pct <= 0.57 ? "#94a3b8" : pct <= 0.79 ? "#fbbf24" : "#ff6b88";
            return (
              <section className="panel" style={{ background:"linear-gradient(135deg,rgba(15,23,42,0.97) 0%,rgba(20,27,71,0.97) 100%)", border:`1px solid ${gradColor}35`, marginBottom:8, padding:"16px 20px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:24, flexWrap:"wrap" }}>

                  {/* Score number */}
                  <div style={{ flex:"0 0 auto", textAlign:"center", minWidth:80 }}>
                    <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.12em", color:"#475569", textTransform:"uppercase", marginBottom:4 }}>Composite Score</div>
                    <div style={{ fontSize:64, fontWeight:900, color:gradColor, lineHeight:1, letterSpacing:"-0.04em" }}>{compositeScore10}</div>
                    <div style={{ fontSize:12, color:"#334155", fontWeight:600 }}>/10</div>
                  </div>

                  {/* Gradient gauge bar */}
                  <div style={{ flex:"1 1 200px", minWidth:160 }}>
                    <div style={{ position:"relative", height:10, borderRadius:9999, background:"linear-gradient(to right,#4ade80,#86efac,#fbbf24,#f97316,#ff6b88)", overflow:"visible" }}>
                      {/* Position marker */}
                      <div style={{ position:"absolute", top:-5, left:`calc(${(compositeScore10/10)*100}% - 2px)`, width:4, height:20, background:"#fff", borderRadius:2, boxShadow:"0 0 6px rgba(255,255,255,0.6)", zIndex:2 }} />
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, color:"#334155", marginTop:5 }}>
                      <span style={{ color:"#4ade80" }}>DEPLOY (0)</span>
                      <span>3</span><span>4</span><span>6</span><span>8</span>
                      <span style={{ color:"#ff6b88" }}>HOLD (10)</span>
                    </div>
                    {/* Signal pill */}
                    <div style={{ marginTop:8, display:"inline-flex", padding:"3px 12px", borderRadius:9999, background:`${gradColor}18`, border:`1px solid ${gradColor}55` }}>
                      <span style={{ fontSize:11, fontWeight:800, color:gradColor, letterSpacing:"0.1em" }}>{compositeSignal}</span>
                    </div>
                  </div>

                  <div style={{ flex:"0 0 auto", borderLeft:"1px solid rgba(255,255,255,0.07)", paddingLeft:24, minWidth:140 }}>
                    <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.12em", color:"#475569", textTransform:"uppercase", marginBottom:4 }}>Equity Target</div>
                    <div style={{ fontSize:40, fontWeight:900, color:"#fff", letterSpacing:"-0.03em", lineHeight:1 }}>{compositeAllocation}</div>
                    <div style={{ fontSize:11, color:"#64748b", marginTop:6, lineHeight:1.5, maxWidth:220 }}>
                      {compositeScore >= 12 ? "Extreme valuations + tight credit. Stay defensive. No deployment." :
                       compositeScore >= 9  ? "Elevated valuations, mixed signals. Hold near defensive posture." :
                       compositeScore >= 6  ? "Conditions moderating. Gradual deployment as signals confirm." :
                       compositeScore >= 3  ? "Stress reversing. Lean into equity as fundamentals improve." :
                       "Maximum deployment signal. Deep value, oversold breadth, peak distress."}
                    </div>
                    {valuationFloor && (
                      <div style={{ marginTop:6, display:"inline-flex", padding:"2px 8px", borderRadius:9999, background:"rgba(251,191,36,0.1)", border:"1px solid rgba(251,191,36,0.35)" }}>
                        <span style={{ fontSize:9, fontWeight:700, color:"#fbbf24", letterSpacing:"0.04em" }}>⚑ Valuation floor active — CAPE or Buffett extreme</span>
                      </div>
                    )}
                  </div>

                  {/* Fed stance */}
                  <div style={{ flex:"0 0 auto", borderLeft:"1px solid rgba(255,255,255,0.07)", paddingLeft:20, minWidth:110 }}>
                    <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.1em", color:"#475569", textTransform:"uppercase", marginBottom:4 }}>Fed Stance</div>
                    <div style={{ fontSize:16, fontWeight:800, color: fedStance==="tightening"?"#ff6b88":fedStance==="easing"?"#4ade80":"#fbbf24" }}>
                      {fedStance.toUpperCase()}
                    </div>
                    <div style={{ fontSize:10, color:"#475569", marginTop:4, lineHeight:1.5 }}>
                      {fedStance==="tightening"?"Amplifies CAPE — rate pressure compounds valuation headwind." :
                       fedStance==="easing"?"Offsets valuation risk. Liquidity supports equities." :
                       "Neutral. Watch for pivot."}
                    </div>
                  </div>

                </div>
              </section>
            );
          })()}

          {/* ⓪-B SIGNAL TILES — 7 scored variables */}
          <section className="panel" style={{ marginBottom:16 }}>
            <div className="panelHeader">
              <div>
                <div className="panelTitle">Signal Inputs</div>
                <div className="panelSub">8 scored variables · weighted · max 15pts raw · drives composite score above</div>
              </div>
              <div style={{ fontSize:11, color:"#475569" }}>pts vary by variable · 0 = deploy · see each tile</div>
            </div>
            {(() => {
              // Score badge helper — overlaid top-right on each tile
              const Badge = ({ score, max = 2 }: { score: number; max?: number }) => {
                const c = score === 0 ? "#4ade80" : score >= max ? "#ff6b88" : "#fbbf24";
                const display = score % 1 === 0 ? String(score) : score.toFixed(1);
                return (
                  <div style={{ position:"absolute", top:8, right:8, width:22, height:22, borderRadius:"50%", background:`${c}20`, border:`1.5px solid ${c}`, display:"flex", alignItems:"center", justifyContent:"center", zIndex:3 }}>
                    <span style={{ fontSize:display.length > 2 ? 9 : 11, fontWeight:900, color:c }}>{display}</span>
                  </div>
                );
              };
              return (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8 }}>

                  {/* ── Row 1: 3pts (CAPE, Buffett) + 2pts (HY, ERP, YC) ── */}

                  {/* 1. CAPE — 3pts max */}
                  <div className="tile" style={{ position:"relative", cursor:"pointer" }} onClick={() => setModal("cape")}>
                    <Badge score={compositeScores.cape} max={3} />
                    <div className="lbl" style={{ marginBottom:6, paddingRight:28 }}>CAPE Ratio (Shiller P/E)</div>
                    <div className="valHero" style={{ color:"#fff" }}>{capeRatio.toFixed(1)}<span style={{ fontSize:20, fontWeight:600 }}>x</span></div>
                    <div className="status" style={{ color:capeRatio>35?"#ff6b88":capeRatio>25?"#fbbf24":"#4ade80" }}>
                      {capeRatio>35?"Extreme":capeRatio>25?"Overvalued":capeRatio>20?"Elevated":"Fairly Valued"}
                    </div>
                    <div style={{ position:"relative", height:6, borderRadius:9999, background:"#202a64", marginTop:12, overflow:"visible" }}>
                      {(() => {
                        const toPos = (x: number) => Math.max(0,Math.min((x-5)/45*100,100));
                        const pos=toPos(capeRatio), p25=toPos(25), p35=toPos(35);
                        return <>
                          <div style={{ position:"absolute", left:0, top:0, height:6, width:`${Math.min(pos,p25)}%`, background:"#4ade80", borderRadius:"9999px 0 0 9999px" }} />
                          {capeRatio>25 && <div style={{ position:"absolute", left:`${p25}%`, top:0, height:6, width:`${Math.min(pos,p35)-p25}%`, background:"#fbbf24" }} />}
                          {capeRatio>35 && <div style={{ position:"absolute", left:`${p35}%`, top:0, height:6, width:`${pos-p35}%`, background:"#ff6b88", borderRadius:"0 9999px 9999px 0" }} />}
                          <div style={{ position:"absolute", top:-4, left:`${(25-5)/45*100}%`, width:2, height:14, background:"rgba(255,255,255,0.4)", borderRadius:2, zIndex:2 }} />
                          <div style={{ position:"absolute", top:-6, left:`${(35-5)/45*100}%`, width:2.5, height:18, background:"rgba(255,255,255,0.8)", borderRadius:2, zIndex:2 }} />
                        </>;
                      })()}
                    </div>
                    <div style={{ marginTop:6, display:"flex", justifyContent:"space-between", fontSize:10, color:"#475569" }}><span>5x</span><span>25x</span><span>35x↑</span><span>50x</span></div>
                    <div style={{ fontSize:11, marginTop:6, fontWeight:600, color:"#64748b" }}>
                      {capeRatio>35?`▲ ${(capeRatio-16).toFixed(1)}x above hist. avg (16x)`:"Hist. avg ~16x · Dot-com peak 44x"}
                    </div>
                    <div style={{ marginTop:6, fontSize:9, color:"#334155" }}>{">"} 30 = 3pts · 20–30 = 1.5pts · {"<"} 20 = 0pts · max 3</div>
                  </div>

                  {/* 2. Buffett Indicator — 3pts max */}
                  {(() => {
                    const c = compositeScores.buffett===0?"#4ade80":compositeScores.buffett>=3?"#ff6b88":"#fbbf24";
                    const status = buffettSigma>1.5?"Strongly OV":buffettSigma>0.5?"Overvalued":"Fair Value";
                    return (
                      <div className="tile" style={{ position:"relative" }}>
                        <Badge score={compositeScores.buffett} max={3} />
                        <div className="lbl" style={{ marginBottom:6, paddingRight:28 }}>Buffett Indicator</div>
                        <div className="valHero" style={{ color:"#fff" }}>{buffettSigma.toFixed(2)}<span style={{ fontSize:20, fontWeight:600 }}>σ</span></div>
                        <div className="status" style={{ color:c }}>{status}</div>
                        <div className="sub" style={{ marginTop:4 }}>vs. long-run trend · {buffettSigma>1.5?"Extreme deviation":buffettSigma>0.5?"Above trend":"Near trend"}</div>
                        <div style={{ fontSize:9, color:"#334155", marginTop:6 }}>{">"} 1.5σ = 3pts · 0.5–1.5σ = 1.5pts · {"<"} 0.5σ = 0pts · max 3</div>
                        <div style={{ fontSize:9, color:"#334155", marginTop:3 }}>Manual · RIA model · Sat update</div>
                      </div>
                    );
                  })()}

                  {/* 3. HY Spread — 2pts max */}
                  <div className="tile" style={{ position:"relative", cursor:"pointer" }} onClick={() => setModal("hy")}>
                    <Badge score={compositeScores.hy} max={2} />
                    <div className="lbl" style={{ marginBottom:6, paddingRight:28 }}>HY Spread</div>
                    <div className="valHero" style={{ color:"#fff" }}>{Math.round(hySpread*100)}<span style={{ fontSize:20, fontWeight:600 }}>bps</span></div>
                    <div className="status" style={{ color:hySpread>=5?"#ff6b88":hySpread>=4?"#fbbf24":hySpread>=3.5?"#fbbf24":hySpread>=3?"#94a3b8":"#4ade80" }}>
                      {hySpread>=5?"Stress":hySpread>=4?"⚠ Trigger":hySpread>=3.5?"Caution":hySpread>=3?"Firm":"Tight"}
                    </div>
                    <div style={{ position:"relative", height:6, borderRadius:9999, background:"#202a64", marginTop:12, overflow:"visible" }}>
                      {(() => {
                        const toPos = (v: number) => v<=3.5?Math.max(0,(v-2)/1.5*30):v<=4.5?30+(v-3.5)*20:v<=5?50+(v-4.5)*20:v<=7?60+(v-5)/2*25:Math.min(100,85+(v-7)/3*15);
                        const pos=toPos(hySpread), p400=toPos(4), p500=toPos(5);
                        return <>
                          <div style={{ position:"absolute", left:0, top:0, height:6, width:`${Math.min(pos,p400)}%`, background:"#4ade80", borderRadius:"9999px 0 0 9999px" }} />
                          {hySpread>4 && <div style={{ position:"absolute", left:`${p400}%`, top:0, height:6, width:`${Math.min(pos,p500)-p400}%`, background:"#fbbf24" }} />}
                          {hySpread>5 && <div style={{ position:"absolute", left:`${p500}%`, top:0, height:6, width:`${pos-p500}%`, background:"#ff6b88", borderRadius:"0 9999px 9999px 0" }} />}
                          <div style={{ position:"absolute", top:-4, left:`${p400}%`, width:2, height:14, background:"rgba(255,255,255,0.6)", borderRadius:2, zIndex:2 }} />
                          <div style={{ position:"absolute", top:-6, left:`${p500}%`, width:3, height:18, background:"rgba(255,255,255,0.9)", borderRadius:2, zIndex:2 }} />
                        </>;
                      })()}
                    </div>
                    <div style={{ marginTop:6, display:"flex", justifyContent:"space-between", fontSize:10, color:"#475569" }}><span>200</span><span style={{ color:"#fbbf24", fontWeight:700 }}>400</span><span style={{ color:"#ff6b88", fontWeight:700 }}>500</span><span>700</span><span>1000+</span></div>
                    <div style={{ fontSize:11, marginTop:6, fontWeight:600, color:"#64748b" }}>
                      {hySpread>=4?`▲ Trigger active · ${Math.round((5-hySpread)*100)}bps to red line`:`▲ ${Math.round((4-hySpread)*100)}bps to trigger · ${Math.round((5-hySpread)*100)}bps to red line`}
                    </div>
                    <div style={{ marginTop:6, fontSize:9, color:"#334155" }}>{"<"} 350bps = 2pts · 350–550 = 1pt · {">"} 550 = 0pts · max 2</div>
                  </div>

                  {/* 4. ERP — 2pts max */}
                  <div className="tile" style={{ position:"relative", cursor:"pointer" }} onClick={() => setModal("erp")}>
                    <Badge score={compositeScores.erp??1} max={2} />
                    <div className="lbl" style={{ marginBottom:6, paddingRight:28 }}>Equity Risk Premium</div>
                    <div className="valHero" style={{ color:"#fff" }}>
                      {erpBps!=null?(erpBps/100).toFixed(2):"—"}<span style={{ fontSize:18, fontWeight:600 }}>{erpBps!=null?"%":""}</span>
                    </div>
                    <div className="status" style={{ color:erpBps==null?"#475569":erpBps<100?"#ff6b88":erpBps<300?"#fbbf24":"#4ade80" }}>
                      {erpBps==null?"Loading":erpBps<100?"Thin":erpBps<300?"Moderate":"Healthy"}
                    </div>
                    <div style={{ position:"relative", height:6, borderRadius:9999, background:"#202a64", marginTop:12, overflow:"visible" }}>
                      <div style={{ position:"absolute", left:0, top:0, height:6, width:"25%", background:"#ef4444", borderRadius:"9999px 0 0 9999px" }} />
                      {erpBps!=null && erpBps>200 && <div style={{ position:"absolute", left:"25%", top:0, height:6, width:`${Math.max(0,Math.min(((erpBps-200)/800)*100,75))}%`, background:"#fbbf24" }} />}
                      <div style={{ position:"absolute", top:-6, left:"25%", width:2.5, height:18, background:"rgba(255,255,255,0.7)", borderRadius:2, zIndex:2 }} />
                      <div style={{ position:"absolute", top:-4, left:"62.5%", width:2, height:14, background:"rgba(255,255,255,0.3)", borderRadius:2, zIndex:2 }} />
                    </div>
                    <div style={{ fontSize:11, marginTop:8, fontWeight:600, color:erpBps!=null&&erpBps<100?"#ff6b88":erpBps!=null&&erpBps<230?"#fbbf24":"#64748b" }}>
                      {erpBps!=null&&erpBps<100?"▼ Stocks barely beating T-bills":erpBps!=null&&erpBps<300?`▼ ${((erpBps)/100).toFixed(2)}% — moderate compensation`:"Above healthy threshold"}
                    </div>
                    <div style={{ marginTop:6, fontSize:9, color:"#334155" }}>{"<"} 1% = 2pts · 1–3% = 1pt · {">"} 3% = 0pts · max 2</div>
                  </div>

                  {/* 5. Yield Curve — 2pts max */}
                  {(() => {
                    const c = compositeScores.yc===0?"#4ade80":compositeScores.yc>=2?"#ff6b88":"#fbbf24";
                    const status = yieldCurve<-0.5?"Inverted":yieldCurve<0.5?"Flat":"Normal";
                    return (
                      <div className="tile" style={{ position:"relative" }}>
                        <Badge score={compositeScores.yc} max={2} />
                        <div className="lbl" style={{ marginBottom:6, paddingRight:28 }}>Yield Curve</div>
                        <div className="valHero" style={{ color:"#fff" }}>{yieldCurve>=0?"+":""}{yieldCurve.toFixed(2)}<span style={{ fontSize:20, fontWeight:600 }}>%</span></div>
                        <div className="status" style={{ color:c }}>{status}</div>
                        <div className="sub" style={{ marginTop:4 }}>10Y–2Y · {yieldCurve<-0.5?"Recession signal historically":yieldCurve<0.5?"Uncertain — watch closely":"Healthy term premium"}</div>
                        <div style={{ fontSize:9, color:"#334155", marginTop:6 }}>{"<"} –50bps = 2pts · –50 to +50 = 1pt · {">"} +50 = 0pts · max 2</div>
                      </div>
                    );
                  })()}

                  {/* ── Row 2: 1pt supporting signals + display ── */}

                  {/* 6. VIX — 1pt max */}
                  <div className="tile" style={{ position:"relative", cursor:"pointer" }} onClick={() => setModal("vix")}>
                    <Badge score={compositeScores.vix} max={1} />
                    <div className="lbl" style={{ marginBottom:6, paddingRight:28 }}>VIX</div>
                    <div className="valHero">{vixValue!=null?fmt1(vixValue):"—"}</div>
                    <div className="status" style={{ color:vixStatus.color }}>{vixValue==null?"Loading":vixValue>=30?"Stress":vixValue>=20?"Watch":"Normal"}</div>
                    <div style={{ position:"relative", height:6, borderRadius:9999, background:"#202a64", marginTop:12, overflow:"visible" }}>
                      {(() => {
                        const v=vixValue??0, pos=Math.min(v/50*100,100);
                        return <>
                          <div style={{ position:"absolute", left:0, top:0, height:6, width:`${Math.min(pos,40)}%`, background:"#4ade80", borderRadius:"9999px 0 0 9999px" }} />
                          {v>20 && <div style={{ position:"absolute", left:"40%", top:0, height:6, width:`${Math.min(pos,60)-40}%`, background:"#fbbf24" }} />}
                          {v>30 && <div style={{ position:"absolute", left:"60%", top:0, height:6, width:`${pos-60}%`, background:"#ff6b88", borderRadius:"0 9999px 9999px 0" }} />}
                          <div style={{ position:"absolute", top:-4, left:"40%", width:2, height:14, background:"rgba(255,255,255,0.4)", borderRadius:2, zIndex:2 }} />
                          <div style={{ position:"absolute", top:-6, left:"60%", width:2.5, height:18, background:"rgba(255,255,255,0.8)", borderRadius:2, zIndex:2 }} />
                        </>;
                      })()}
                    </div>
                    <div style={{ marginTop:6, display:"flex", justifyContent:"space-between", fontSize:10, color:"#475569" }}><span>0</span><span>20</span><span>30↑</span><span>50</span></div>
                    <div style={{ fontSize:11, marginTop:6, fontWeight:600, color:"#64748b" }}>
                      {vixValue!=null&&vixValue>=30?"▲ Stress — pause buying":vixValue!=null?`▲ ${(30-vixValue).toFixed(1)} pts from Stress`:""}
                    </div>
                    <div style={{ marginTop:6, fontSize:9, color:"#334155" }}>{"<"} 20 = 1pt · 20–28 = 0.5pts · {">"} 28 = 0pts · max 1</div>
                  </div>

                  {/* 7. Breadth — 1pt max */}
                  {(() => {
                    const c = compositeScores.breadth===0?"#4ade80":compositeScores.breadth>=1?"#ff6b88":"#fbbf24";
                    const status = breadthPct!=null?(breadthPct<50?"Weak":breadthPct<70?"Mixed":"Strong"):"Loading";
                    return (
                      <div className="tile" style={{ position:"relative" }}>
                        <Badge score={compositeScores.breadth} max={1} />
                        <div className="lbl" style={{ marginBottom:6, paddingRight:28 }}>Breadth</div>
                        <div className="valHero" style={{ color:"#fff" }}>{breadthPct!=null?breadthPct.toFixed(0):"—"}<span style={{ fontSize:20, fontWeight:600 }}>%</span></div>
                        <div className="status" style={{ color:c }}>{status}</div>
                        <div className="sub" style={{ marginTop:4 }}>% S&P 500 above 200-DMA · {breadthPct!=null?(breadthPct<50?"Broad selling underway":breadthPct<70?"Mixed internals":"Broad participation"):"Live $SPXA200R"}</div>
                        <div style={{ fontSize:9, color:"#334155", marginTop:6 }}>{"<"} 50% = 1pt · 50–70% = 0.5pts · {">"} 70% = 0pts · max 1</div>
                      </div>
                    );
                  })()}

                  {/* 8. Ivy Portfolio — 1pt max */}
                  {(() => {
                    const c = compositeScores.ivy===0?"#4ade80":compositeScores.ivy>=1?"#ff6b88":"#fbbf24";
                    const status = ivyInvestedCount<=2?"Defensive":ivyInvestedCount<=4?"Mixed":"Invested";
                    return (
                      <div className="tile" style={{ position:"relative" }}>
                        <Badge score={compositeScores.ivy} max={1} />
                        <div className="lbl" style={{ marginBottom:6, paddingRight:28 }}>Ivy Portfolio</div>
                        <div className="valHero" style={{ color:"#fff" }}>{ivyInvestedCount}<span style={{ fontSize:20, fontWeight:600 }}>/5</span></div>
                        <div className="status" style={{ color:c }}>{status}</div>
                        <div className="sub" style={{ marginTop:4 }}>10-mo SMA signals · {ivyInvestedCount<=2?"Trend breakdown across asset classes":ivyInvestedCount<=4?"Partial cash signal active":"Full trend confirmation"}</div>
                        <div style={{ fontSize:9, color:"#334155", marginTop:6 }}>0–2 invested = 1pt · 3–4 = 0.5pts · 5/5 = 0pts · max 1</div>
                      </div>
                    );
                  })()}

                  {/* 9. 200-DMA — display only */}
                  {(() => {
                    const isNear = spx200Pct != null && spx200Pct >= 0 && spx200Pct <= 3;
                    const tileClass = is200Broken ? "tile tile200Red" : isNear ? "tile tile200" : "tile";
                    const lblColor = is200Broken ? "#ff6b88" : isNear ? "#f59e0b" : "#4ade80";
                    const badgeBg = is200Broken ? "#ef4444" : "#f59e0b";
                    const statusColor = is200Broken ? "#ff6b88" : isNear ? "#fbbf24" : "#4ade80";
                    const subColor = is200Broken ? "#ff6b88" : isNear ? "#f59e0b" : "#4ade80";
                    return (
                      <div className={tileClass} style={{ position:"relative", cursor:"pointer" }} onClick={() => setModal("dma200")}>
                        <div style={{ position:"absolute", top:8, right:8, fontSize:9, color:"#334155", fontWeight:600 }}>display</div>
                        <div className="tileTop">
                          <span className="lbl" style={{ color: lblColor, paddingRight:36 }}>200-DMA</span>
                          {(is200Broken || isNear) && <span className="badge" style={{ background: badgeBg, color:"#000" }}>!</span>}
                        </div>
                        <div className="valHero">{fmtWhole(spx200)}</div>
                        <div className="status" style={{ color: statusColor }}>
                          {dmaState(spx200Pct, slope200, true)}
                        </div>
                        <div className="sub" style={{ color: subColor }}>
                          {spx200Pct != null ? `SPX ${fmtSigned1(spx200Pct)} ${spx200Pct >= 0 ? "above" : "below"}` : "Waiting"}
                        </div>
                        <div style={{ fontSize:10, color:"#64748b", marginTop:4 }}>Click for detail</div>
                        {slope200 != null && (
                          <div style={{ fontSize:10, marginTop:3, fontWeight:700, color: slope200 > 0.02 ? "#4ade80" : slope200 < -0.02 ? "#ff6b88" : "#fbbf24" }}>
                            Slope {slope200 > 0 ? "↗ +" : slope200 < 0 ? "↘ " : "→ "}{slope200.toFixed(1)}% · {slope200 > 0.02 ? "Bullish" : slope200 < -0.02 ? "Bearish" : "Neutral"}
                          </div>
                        )}
                        <div style={{ fontSize:9, color:"#334155", marginTop:6 }}>Display only · not scored · Roberts&apos; primary trigger</div>
                      </div>
                    );
                  })()}

                  {/* 10. CNN Fear & Greed — display only · inverted color logic: Greed=red, Fear=green */}
                  {(() => {
                    const score = fearGreedScore;
                    const tileColor = score <= 25 ? "#4ade80" : score >= 75 ? "#ff6b88" : "#fbbf24";
                    const statusLabel = score <= 25 ? "Extreme Fear" : score <= 45 ? "Fear" : score <= 55 ? "Neutral" : score <= 74 ? "Greed" : "Extreme Greed";
                    return (
                      <div className="tile" style={{ position:"relative" }}>
                        <div style={{ position:"absolute", top:8, right:8, fontSize:9, color:"#334155", fontWeight:600 }}>display</div>
                        <div className="lbl" style={{ marginBottom:6, paddingRight:36 }}>CNN Fear &amp; Greed</div>
                        <div className="valHero" style={{ color:"#fff" }}>{Math.round(score)}</div>
                        <div className="status" style={{ color:tileColor }}>{statusLabel}</div>
                        <div style={{ position:"relative", height:6, borderRadius:9999, overflow:"hidden", background:"linear-gradient(to right,#4ade80 0%,#86efac 20%,#fbbf24 45%,#f97316 65%,#ff6b88 100%)", marginTop:10 }}>
                          <div style={{ position:"absolute", top:0, left:`${Math.min(Math.max(score,0),100)}%`, width:3, height:6, background:"#fff", borderRadius:1, transform:"translateX(-50%)" }} />
                        </div>
                        <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, color:"#475569", marginTop:3 }}>
                          <span style={{ color:"#4ade80" }}>Fear</span><span>Neutral</span><span style={{ color:"#ff6b88" }}>Greed</span>
                        </div>
                        <div style={{ fontSize:11, marginTop:5, fontWeight:600, color:tileColor }}>
                          {score <= 25 ? "▲ Contrarian deploy signal" : score >= 75 ? "▼ Extreme greed — defensive" : `${Math.round(score)} — watch zone`}
                        </div>
                        <div style={{ fontSize:9, color:"#334155", marginTop:4 }}>Display only · not scored · Zeberg contrarian</div>
                      </div>
                    );
                  })()}

                </div>
              );
            })()}
          </section>

          {/* ① MARKET STRUCTURE */}
          <section className="panel">
            <div className="panelHeader">
              <div><div className="panelTitle">Market Structure</div><div className="panelSub">Price vs Key Moving Averages</div></div>
              <div className="damage">{damageCount} / 4 short-term trends broken</div>
            </div>

            {/* ── Regime Banner ── */}
            <div style={{
              display:"flex", alignItems:"center", gap:12,
              background: regime==="bull" ? "rgba(74,222,128,0.07)" : regime==="bear" ? "rgba(239,68,68,0.07)" : "rgba(245,158,11,0.07)",
              border: `1px solid ${regime==="bull" ? "rgba(74,222,128,0.3)" : regime==="bear" ? "rgba(239,68,68,0.35)" : "rgba(245,158,11,0.3)"}`,
              borderRadius:10, padding:"10px 14px", marginBottom:10
            }}>
              {/* Regime pill */}
              <div style={{ flexShrink:0, display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:16 }}>{regimeEmoji ?? "🟡"}</span>
                <div>
                  <div style={{ fontSize:10, fontWeight:700, color:"#475569", textTransform:"uppercase", letterSpacing:"0.07em" }}>Market Regime</div>
                  <div style={{ fontSize:14, fontWeight:700, color: regimeColor }}>{regimeLabel ?? "Calculating…"}</div>
                </div>
              </div>
              <div style={{ width:1, height:32, background:"rgba(255,255,255,0.08)", flexShrink:0 }} />
              {/* Description */}
              <div style={{ fontSize:12, color:"#94a3b8", lineHeight:1.5 }}>{regimeDesc ?? "Computing 200-DMA slope from price history…"}</div>
              <div style={{ width:1, height:32, background:"rgba(255,255,255,0.08)", flexShrink:0, marginLeft:"auto" }} />
              {/* 200-DMA slope readout */}
              <div style={{ flexShrink:0, textAlign:"right" }}>
                <div style={{ fontSize:10, fontWeight:700, color:"#475569", textTransform:"uppercase", letterSpacing:"0.07em" }}>200-DMA Slope</div>
                <div style={{ fontSize:14, fontWeight:700, color: slope200 == null ? "#475569" : slope200 > 0.02 ? "#4ade80" : slope200 < -0.02 ? "#ff6b88" : "#fbbf24" }}>
                  {slope200 == null ? "—" : `${slope200 > 0 ? "↗" : slope200 < 0 ? "↘" : "→"} ${slope200 > 0 ? "+" : ""}${slope200.toFixed(1)}%`}
                </div>
              </div>
            </div>

            <div className="grid5" style={{ marginBottom:8 }}>
              {/* Tile 1: SPX Price — no change */}
              <div className="tile">
                <div className="tileTop"><span className="lbl">S&P 500</span><span className="ytd">{spxYtd > 0 ? "+" : ""}{spxYtd.toFixed(2)}% YTD</span></div>
                <div className="valHero">{spxPrice != null ? fmtWhole(spxPrice) : "—"}</div>
                <div className="sparkWrap" dangerouslySetInnerHTML={{ __html: sparkline(spxTrend, spxDailyPct != null && spxDailyPct >= 0 ? "#4ade80" : "#ff6b88") }} />
                <div className="subSpx">{spxDailyPct != null ? `${spxDailyPct >= 0 ? "▲" : "▼"} ${Math.abs(spxDailyPct).toFixed(1)}% today` : "Waiting for live price"}</div>
              </div>

              {/* Tile 2: 200-DMA — color reflects actual position: green=bullish, amber=near/testing, red=broken */}
              {(() => {
                const isNear = spx200Pct != null && spx200Pct >= 0 && spx200Pct <= 3;
                const tileClass = is200Broken ? "tile tile200Red" : isNear ? "tile tile200" : "tile";
                const lblColor = is200Broken ? "#ff6b88" : isNear ? "#f59e0b" : "#4ade80";
                const badgeBg = is200Broken ? "#ef4444" : "#f59e0b";
                const statusColor = is200Broken ? "#ff6b88" : isNear ? "#fbbf24" : "#4ade80";
                const subColor = is200Broken ? "#ff6b88" : isNear ? "#f59e0b" : "#4ade80";
                return (
                  <div className={tileClass} style={{ cursor:"pointer" }} onClick={() => setModal("dma200")}>
                    <div className="tileTop">
                      <span className="lbl" style={{ color: lblColor }}>200-DMA</span>
                      {(is200Broken || isNear) && <span className="badge" style={{ background: badgeBg, color:"#000" }}>!</span>}
                    </div>
                    <div className="valHero">{fmtWhole(spx200)}</div>
                    <div className="status" style={{ color: statusColor }}>
                      {dmaState(spx200Pct, slope200, true)}
                    </div>
                    <div className="sub" style={{ color: subColor }}>
                      {spx200Pct != null ? `SPX ${fmtSigned1(spx200Pct)} ${spx200Pct >= 0 ? "above" : "below"}` : "Waiting"}
                    </div>
                    <div style={{ fontSize:10, color:"#64748b", marginTop:4 }}>Click for detail</div>
                    {slope200 != null && (
                      <div style={{ fontSize:10, marginTop:3, fontWeight:700, color: slope200 > 0.02 ? "#4ade80" : slope200 < -0.02 ? "#ff6b88" : "#fbbf24" }}>
                        Slope {slope200 > 0 ? "↗ +" : slope200 < 0 ? "↘ " : "→ "}{slope200.toFixed(1)}% · {slope200 > 0.02 ? "Bullish" : slope200 < -0.02 ? "Bearish" : "Neutral"}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Tiles 3-5: 100 / 50 / 20-DMA — descending importance */}
              {[
                { label:"100-DMA", level:spx100, slope:null     },
                { label:"50-DMA",  level:spx50,  slope:slope50  },
                { label:"20-DMA",  level:spx20,  slope:slope20  },
              ].map(d => {
                const pct = spxVs(d.level); const tone = dmaTone(pct, d.slope);
                const slopeArrow = d.slope == null ? "" : d.slope > 0.02 ? " ↗" : d.slope < -0.02 ? " ↘" : " →";
                const slopeColor = d.slope == null ? "#475569" : d.slope > 0.02 ? "#4ade80" : d.slope < -0.02 ? "#ff6b88" : "#fbbf24";
                return (
                  <div key={d.label} className="tile">
                    <div className="tileTop"><span className="lbl">{d.label}</span><span className="badge" style={{ background:toneColor(tone), color:tone==="warning"?"#000":"#fff" }}>!</span></div>
                    <div className="valMuted">{fmtWhole(d.level)}</div>
                    <div className="status" style={{ color:toneColor(tone) }}>{dmaState(pct, d.slope)}</div>
                    <div className="sub">{pct != null ? `SPX ${fmtSigned1(pct)} ${pct >= 0 ? "above" : "below"}` : "Waiting"}</div>
                    {d.slope != null && (
                      <div style={{ fontSize:10, marginTop:4, fontWeight:600, color:slopeColor }}>Slope{slopeArrow} {d.slope > 0 ? "+" : ""}{d.slope.toFixed(1)}%</div>
                    )}
                  </div>
                );
              })}
            </div>

            {is200Broken ? (
              <div className="alertStripCritical">
                <span className="alertDotRed" />
                <span className="alertTitleRed">⚠ 200-DMA Breached — Critical</span>
                <span className="alertBodyRed">
                  {spxPrice != null
                    ? `SPX ${fmtSigned1(spx200Pct!)} below 200-DMA (${fmtWhole(spx200)}) · ${Math.abs(spxPrice - spx200).toFixed(0)} pts below · Watch: 2 Friday closes below + VIX >30 or HY >400bps triggers defensive posture`
                    : "Waiting..."}
                </span>
              </div>
            ) : spx200Pct != null && spx200Pct <= 3 ? (
              <div className="alertStrip">
                <span className="alertDot" />
                <span className="alertTitle">200-DMA Proximity — Immediate Watch</span>
                <span className="alertBody">
                  {spxPrice != null
                    ? `Only ${spx200Pct.toFixed(1)}% above (${fmtWhole(spx200)}) · ${Math.abs(spxPrice-spx200).toFixed(0)} pts gap · Trigger: 2 Friday closes below + VIX >30 or HY >400bps`
                    : "Waiting..."}
                </span>
              </div>
            ) : null}
          </section>

          {/* ② STRESS CONFIRMATION */}
          <section className="panel">
            <div className="panelHeader">
              <div><div className="panelTitle">Stress Confirmation</div><div className="panelSub">Layer 2: Stress signals — is the 200-DMA break real or a head-fake? · Layer 3: Dow Theory — economic confirmation</div></div>
            </div>

            <div className="grid5" style={{ marginBottom:8 }}>
              {/* 1. HY Spread */}
              <div className="tile" style={{ cursor:"pointer" }} onClick={() => setModal("hy")}>
                <div className="lbl" style={{ marginBottom:6 }}>HY Spread</div>
                <div className="valHero" style={{ color:"#fff" }}>{Math.round(hySpread*100)}<span style={{ fontSize:20, fontWeight:600 }}>bps</span></div>
                <div className="status" style={{ color:hySpread>=5?"#ff6b88":hySpread>=4?"#fbbf24":hySpread>=3.5?"#fbbf24":hySpread>=3?"#94a3b8":"#4ade80" }}>
                  {hySpread>=5?"Stress":hySpread>=4?"⚠ Trigger":hySpread>=3.5?"Caution":hySpread>=3?"Firm":"Tight"}
                </div>
                <div style={{ position:"relative", height:6, borderRadius:9999, background:"#202a64", marginTop:12, overflow:"visible" }}>
                  {(() => {
                    const toPos = (v: number) =>
                      v <= 3.5 ? Math.max(0,(v-2)/1.5*30)
                      : v <= 4.5 ? 30+(v-3.5)*20
                      : v <= 5   ? 50+(v-4.5)*20
                      : v <= 7   ? 60+(v-5)/2*25
                      : Math.min(100, 85+(v-7)/3*15);
                    const pos = toPos(hySpread);
                    const p400 = toPos(4); const p500 = toPos(5);
                    return <>
                      <div style={{ position:"absolute", left:0, top:0, height:6, width:`${Math.min(pos,p400)}%`, background:"#4ade80", borderRadius:"9999px 0 0 9999px" }} />
                      {hySpread>4 && <div style={{ position:"absolute", left:`${p400}%`, top:0, height:6, width:`${Math.min(pos,p500)-p400}%`, background:"#fbbf24" }} />}
                      {hySpread>5 && <div style={{ position:"absolute", left:`${p500}%`, top:0, height:6, width:`${pos-p500}%`, background:"#ff6b88", borderRadius:"0 9999px 9999px 0" }} />}
                      {/* 400bps tick — your trigger (thin) */}
                      <div style={{ position:"absolute", top:-4, left:`${p400}%`, width:2, height:14, background:"rgba(255,255,255,0.6)", borderRadius:2, zIndex:2 }} />
                      {/* 500bps tick — industry red line (heavy) */}
                      <div style={{ position:"absolute", top:-6, left:`${p500}%`, width:3, height:18, background:"rgba(255,255,255,0.9)", borderRadius:2, zIndex:2 }} />
                    </>;
                  })()}
                </div>
                {/* Scale labels — positioned using same toPos function so they align with ticks */}
                {(() => {
                  const toPos = (v: number) =>
                    v <= 3.5 ? Math.max(0,(v-2)/1.5*30)
                    : v <= 4.5 ? 30+(v-3.5)*20
                    : v <= 5   ? 50+(v-4.5)*20
                    : v <= 7   ? 60+(v-5)/2*25
                    : Math.min(100, 85+(v-7)/3*15);
                  const labels: [number, string][] = [[2,"200"],[4,"400"],[5,"500"],[7,"700"],[10,"1000+"]];
                  return (
                    <div style={{ position:"relative", height:14, marginTop:4 }}>
                      {labels.map(([v, lbl]) => (
                        <span key={lbl} style={{
                          position:"absolute",
                          left:`${toPos(v)}%`,
                          transform:"translateX(-50%)",
                          fontSize:10, color: v===4?"#fbbf24": v===5?"#ff6b88":"#475569",
                          fontWeight: v===4||v===5 ? 700 : 400,
                        }}>{lbl}</span>
                      ))}
                    </div>
                  );
                })()}
                <div style={{ fontSize:11, marginTop:6, fontWeight:600, color:"#64748b" }}>
                  {hySpread>=4 ? `▲ Trigger active · ${Math.round((5-hySpread)*100)}bps to red line`
                  : `▲ ${Math.round((4-hySpread)*100)}bps to trigger · ${Math.round((5-hySpread)*100)}bps to red line`}
                </div>
              </div>
              {/* 2. VIX */}
              <div className="tile" style={{ cursor:"pointer" }} onClick={() => setModal("vix")}>
                <div className="lbl" style={{ marginBottom:6 }}>VIX</div>
                <div className="valHero">{vixValue != null ? fmt1(vixValue) : "—"}</div>
                <div className="status" style={{ color:vixStatus.color }}>{vixValue==null?"Loading":vixValue>=30?"Stress":vixValue>=20?"Watch":"Normal"}</div>
                <div style={{ position:"relative", height:6, borderRadius:9999, background:"#202a64", marginTop:12, overflow:"visible" }}>
                  {(() => {
                    const v = vixValue ?? 0;
                    const pos = Math.min(v/50*100,100);
                    const p20 = 40; const p30 = 60;
                    return <>
                      <div style={{ position:"absolute", left:0, top:0, height:6, width:`${Math.min(pos,p20)}%`, background:"#4ade80", borderRadius:"9999px 0 0 9999px" }} />
                      {v>20 && <div style={{ position:"absolute", left:`${p20}%`, top:0, height:6, width:`${Math.min(pos,p30)-p20}%`, background:"#fbbf24" }} />}
                      {v>30 && <div style={{ position:"absolute", left:`${p30}%`, top:0, height:6, width:`${pos-p30}%`, background:"#ff6b88", borderRadius:"0 9999px 9999px 0" }} />}
                    </>;
                  })()}
                  <div style={{ position:"absolute", top:-4, left:"40%", width:2, height:14, background:"rgba(255,255,255,0.4)", borderRadius:2, zIndex:2 }} />
                  <div style={{ position:"absolute", top:-6, left:"60%", width:2.5, height:18, background:"rgba(255,255,255,0.8)", borderRadius:2, zIndex:2 }} />
                </div>
                <div style={{ marginTop:6, display:"flex", justifyContent:"space-between", fontSize:10, color:"#475569" }}><span>0</span><span>20</span><span>30↑</span><span>50</span></div>
                <div style={{ fontSize:11, marginTop:6, fontWeight:600, color:"#64748b" }}>
                  {vixValue!=null&&vixValue>=30?"▲ Stress — pause buying":vixValue!=null?`▲ ${(30-vixValue).toFixed(1)} pts from Stress`:""}
                </div>
              </div>
              {/* 3. ERP */}
              <div className="tile" style={{ cursor:"pointer" }} onClick={() => setModal("erp")}>
                <div className="lbl" style={{ marginBottom:6 }}>Equity Risk Premium</div>
                <div className="valHero" style={{ color:"#fff" }}>
                  {erpBps!=null?(erpBps/100).toFixed(2):"—"}<span style={{ fontSize:18, fontWeight:600 }}>{erpBps!=null?"%":""}</span>
                </div>
                <div className="status" style={{ color:erpBps==null?"#475569":erpBps<200?"#ff6b88":erpBps<500?"#fbbf24":"#4ade80" }}>
                  {erpBps==null?"Loading":erpBps<200?"Danger":erpBps<500?"Watch":"Healthy"}
                </div>
                <div style={{ position:"relative", height:6, borderRadius:9999, background:"#202a64", marginTop:12, overflow:"visible" }}>
                  <div style={{ position:"absolute", left:0, top:0, height:6, width:"25%", background:"#ef4444", borderRadius:"9999px 0 0 9999px" }} />
                  {erpBps!=null && erpBps>200 && (
                    <div style={{ position:"absolute", left:"25%", top:0, height:6, width:`${Math.max(0,Math.min(((erpBps-200)/800)*100,75))}%`, background:"#fbbf24" }} />
                  )}
                  <div style={{ position:"absolute", top:-6, left:"25%", width:2.5, height:18, background:"rgba(255,255,255,0.7)", borderRadius:2, zIndex:2 }} />
                  <div style={{ position:"absolute", top:-4, left:"62.5%", width:2, height:14, background:"rgba(255,255,255,0.3)", borderRadius:2, zIndex:2 }} />
                </div>
                <div style={{ fontSize:11, marginTop:8, fontWeight:600, color:erpBps!=null&&erpBps<200?"#ff6b88":erpBps!=null&&erpBps<230?"#fbbf24":"#64748b" }}>
                  {erpBps!=null&&erpBps<200?"▼ In danger zone":erpBps!=null&&erpBps<500?`▼ ${((erpBps-200)/100).toFixed(2)}% from danger`:"Above healthy threshold"}
                </div>
              </div>
              {/* 4. DXY */}
              <div className="tile" style={{ cursor:"pointer" }} onClick={() => setModal("dxy")}>
                <div className="lbl" style={{ marginBottom:6 }}>US Dollar (DXY)</div>
                <div className="valHero" style={{ color:"#fff" }}>{dxy!=null?dxy.toFixed(2):"—"}</div>
                <div className="status" style={{ color:dxy==null?"#475569":dxy>104?"#ff6b88":dxy>100?"#fbbf24":"#4ade80" }}>
                  {dxy==null?"Loading":dxy>104?"Strong":dxy>100?"Elevated":"Neutral"}
                </div>
                <div style={{ position:"relative", height:6, borderRadius:9999, background:"#202a64", marginTop:12, overflow:"visible" }}>
                  <div style={{ position:"absolute", left:0, top:0, height:6, width:`${Math.max(0,Math.min(((dxy??100)-88)/32*100,100))}%`, borderRadius:9999, background:dxy==null?"#475569":dxy>104?"#ff6b88":dxy>100?"#fbbf24":"#4ade80" }} />
                  <div style={{ position:"absolute", top:-6, left:`${((100-88)/32)*100}%`, width:2.5, height:18, background:"rgba(255,255,255,0.5)", borderRadius:2, zIndex:2 }} />
                  <div style={{ position:"absolute", top:-4, left:`${((104-88)/32)*100}%`, width:2, height:14, background:"rgba(255,255,255,0.3)", borderRadius:2, zIndex:2 }} />
                </div>
                <div style={{ marginTop:6, display:"flex", justifyContent:"space-between", fontSize:10, color:"#475569" }}><span>88</span><span>100</span><span>104</span><span>120</span></div>
                <div style={{ fontSize:11, marginTop:6, fontWeight:600, color:"#64748b" }}>
                  {dxyChangePct!=null?`${dxyChangePct>0?"▲":"▼"} ${Math.abs(dxyChangePct).toFixed(2)}% today`:"↑ Dollar = tighter liquidity"}
                </div>
              </div>
              {/* 5. Advance/Decline Line */}
              <div className="tile" style={{ cursor:"pointer" }} onClick={() => setModal("ad")}>
                <div className="lbl" style={{ marginBottom:8 }}>Advance / Decline</div>

                {/* ── Divergence Arrow Display ── */}
                {(() => {
                  const adDir = adLine?.adTrend === "higher_lows" ? "up"
                    : adLine?.adTrend === "lower_lows" ? "down" : "flat";
                  const spxDir = adLine?.adVsSpx === "diverging_up" ? "up"
                    : adLine?.adVsSpx === "diverging_down" ? "down" : "flat";
                  const isDiverging = adDir !== spxDir;
                  const adColor = adDir === "up" ? "#4ade80" : adDir === "down" ? "#ff6b88" : "#fbbf24";
                  const spxColor = spxDir === "up" ? "#4ade80" : spxDir === "down" ? "#ff6b88" : "#fbbf24";
                  const adArrow = adDir === "up" ? "↗" : adDir === "down" ? "↘" : "→";
                  const spxArrow = spxDir === "up" ? "↗" : spxDir === "down" ? "↘" : "→";
                  return (
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10 }}>
                      {/* A/D arrow */}
                      <div style={{ flex:1, background:"#141b47", borderRadius:8, padding:"7px 8px", textAlign:"center" }}>
                        <div style={{ fontSize:9, color:"#475569", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:3 }}>A/D Line</div>
                        <div style={{ fontSize:22, fontWeight:800, color:adColor, lineHeight:1 }}>{adArrow}</div>
                        <div style={{ fontSize:10, fontWeight:600, color:adColor, marginTop:2 }}>
                          {adDir === "up" ? "Higher Lows" : adDir === "down" ? "Lower Lows" : "Flat"}
                        </div>
                      </div>
                      {/* Divergence indicator */}
                      <div style={{ display:"flex", flexDirection:"column" as const, alignItems:"center", gap:2 }}>
                        <div style={{ width:18, height:18, borderRadius:"50%", background: isDiverging ? "rgba(251,191,36,0.2)" : "rgba(148,163,184,0.1)", border:`1px solid ${isDiverging?"#fbbf24":"#334155"}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9 }}>
                          {isDiverging ? "≠" : "="}
                        </div>
                        <div style={{ fontSize:8, color: isDiverging ? "#fbbf24" : "#334155", fontWeight:700, textTransform:"uppercase" as const }}>
                          {isDiverging ? "DIV" : "CON"}
                        </div>
                      </div>
                      {/* SPX arrow */}
                      <div style={{ flex:1, background:"#141b47", borderRadius:8, padding:"7px 8px", textAlign:"center" }}>
                        <div style={{ fontSize:9, color:"#475569", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:3 }}>SPX</div>
                        <div style={{ fontSize:22, fontWeight:800, color:spxColor, lineHeight:1 }}>{spxArrow}</div>
                        <div style={{ fontSize:10, fontWeight:600, color:spxColor, marginTop:2 }}>
                          {spxDir === "up" ? "Rising" : spxDir === "down" ? "Falling" : "Flat"}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* ── Signal Strength Bar ── */}
                {(() => {
                  // Map signal to position: bullish_divergence=10, neutral=50, confirming_weakness=90
                  const barPos = adLine?.signal === "bullish_divergence" ? 10
                    : adLine?.signal === "confirming_weakness" ? 90 : 50;
                  const sigColor = adLine?.signal === "bullish_divergence" ? "#4ade80"
                    : adLine?.signal === "confirming_weakness" ? "#ff6b88" : "#fbbf24";
                  return (
                    <div style={{ marginBottom:8 }}>
                      <div style={{ position:"relative", height:6, borderRadius:9999, background:"#202a64", overflow:"visible" }}>
                        {/* Green left zone */}
                        <div style={{ position:"absolute", left:0, top:0, height:6, width:"33%", background:"rgba(74,222,128,0.25)", borderRadius:"9999px 0 0 9999px" }} />
                        {/* Amber center zone */}
                        <div style={{ position:"absolute", left:"33%", top:0, height:6, width:"34%", background:"rgba(251,191,36,0.2)" }} />
                        {/* Red right zone */}
                        <div style={{ position:"absolute", left:"67%", top:0, height:6, width:"33%", background:"rgba(239,68,68,0.25)", borderRadius:"0 9999px 9999px 0" }} />
                        {/* Needle */}
                        <div style={{ position:"absolute", top:-5, left:`calc(${barPos}% - 5px)`, width:10, height:16, borderRadius:3, background:sigColor, zIndex:2, boxShadow:`0 0 6px ${sigColor}` }} />
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, color:"#334155", marginTop:4 }}>
                        <span style={{ color:"#4ade80" }}>Hidden Strength</span>
                        <span style={{ color:"#fbbf24" }}>Neutral</span>
                        <span style={{ color:"#ff6b88" }}>Broad Selling</span>
                      </div>
                    </div>
                  );
                })()}

                <div style={{ fontSize:9, color:"#334155", marginTop:2 }}>Updated {adLine?.updatedDate ?? "—"} · Manual</div>
              </div>
            </div>

            {/* ── Confluence banner — action-oriented state machine ── */}
            {(() => {
              const signals = [
                hySpread < 4,
                vixValue != null && vixValue < 30,
                erpBps != null && erpBps >= 300,
                dxy != null && dxy < 104,
                adLine?.signal === "bullish_divergence" || adLine?.signal === "neutral",
                schannepSignal === "bull" || schannepSignal === "non_confirmation_bull",
              ];
              const greenCount = signals.filter(Boolean).length;
              const redCount = 6 - greenCount;
              const labels = ["HY","VIX","ERP","DXY","A/D","DowTh"];

              // ── State machine: 4 states based on 200-DMA + confirmation count ──
              type ConfluenceState = "intact" | "headfake" | "mixed" | "confirmed";
              const state: ConfluenceState =
                !is200Broken                      ? "intact"
                : greenCount >= 5                 ? "headfake"
                : greenCount >= 3                 ? "mixed"
                :                                   "confirmed";

              // Action sentences — keyed to your specific portfolio and levels
              const spx200Str  = fmtWhole(spx200);
              const spxStr     = spxPrice != null ? fmtWhole(spxPrice) : "—";
              const hyTrigStr  = `HY ${hySpread.toFixed(2)}% (trigger: 4.00%)`;
              const vixStr     = vixValue != null ? `VIX ${fmt1(vixValue)}` : "VIX —";

              const stateConfig: Record<ConfluenceState, {
                badge: string; badgeColor: string; borderColor: string;
                title: string; titleColor: string;
                action: string; actionColor: string;
              }> = {
                intact: {
                  badge: "HOLD",
                  badgeColor: "#475569",
                  borderColor: "rgba(71,85,105,0.3)",
                  title: `200-DMA intact · ${spxStr} vs ${spx200Str} · No defensive action`,
                  titleColor: "#64748b",
                  action: `Signals are for context only. 200-DMA is holding — no rule-based trigger is active. Continue current 40/60 positioning. Next watch: two consecutive Friday closes below ${spx200Str}.`,
                  actionColor: "#64748b",
                },
                headfake: {
                  badge: "HOLD",
                  badgeColor: "#4ade80",
                  borderColor: "rgba(74,222,128,0.35)",
                  title: `Head-Fake Signal · ${greenCount}/6 healthy · Credit & Transports NOT confirming break`,
                  titleColor: "#4ade80",
                  action: `${greenCount} of 6 signals remain healthy (${hyTrigStr}, ${vixStr} below 30). Roberts' scorecard: 200-DMA slope still rising, RSI oversold, AAII bears elevated — matches 2015/Q4 2018 brief breaks, not 2008. Schannep signal: ${schannepLabel} — Dow Theory not confirming a bear. Brief breaks without credit+transport confirmation produced +19.8% avg 12-month returns. Hold VTI, SCHD, VEA. Do NOT trim equity into this flush. Watch the 200-DMA slope weekly — if it begins declining, the thesis shifts. Two Friday closes below ${spx200Str} with credit confirmation remains the only rule-based trigger.`,
                  actionColor: "#4ade80",
                },
                mixed: {
                  badge: "WATCH",
                  badgeColor: "#fbbf24",
                  borderColor: "rgba(245,158,11,0.4)",
                  title: `Mixed Confirmation · ${greenCount}/6 healthy · Elevated caution`,
                  titleColor: "#fbbf24",
                  action: `${redCount} of 6 signals are flashing (${signals.map((g,i) => !g ? labels[i] : null).filter(Boolean).join(", ")}). Downside risk is real but not yet rule-based. Raise mental stops on VTI at ${spx200Str} SPX. Ensure SGOV + VTIP are at full allocation. Do not add new equity risk. If one more signal breaks — move to Confirmed state and trim VTI.`,
                  actionColor: "#fbbf24",
                },
                confirmed: {
                  badge: "ACT",
                  badgeColor: "#ff6b88",
                  borderColor: "rgba(239,68,68,0.55)",
                  title: `Confirmed Stress · ${greenCount}/6 healthy · Defense trigger active`,
                  titleColor: "#ff6b88",
                  action: `${redCount} of 6 signals confirmed (${signals.map((g,i) => !g ? labels[i] : null).filter(Boolean).join(", ")}). Rule-based defensive action: trim VTI from 10% → 5%, move proceeds to SGOV. Hold SCHD and VEA — quality equity with lower drawdown profiles. Do not touch SGOV, VTIP, VGIT, or GLDM. Reset trigger: two weekly closes back above ${spx200Str} with VIX sustainably below 20.`,
                  actionColor: "#ff6b88",
                },
              };

              const v = stateConfig[state];

              return (
                <div style={{ background:"#0f172a", border:`1px solid ${v.borderColor}`, borderRadius:10, padding:"12px 14px", marginTop:0 }}>
                  {/* Row 1: badge + title + signal pills */}
                  <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" as const, marginBottom:8 }}>
                    <span style={{ fontSize:10, fontWeight:800, letterSpacing:"0.08em", padding:"2px 8px", borderRadius:4, background:`${v.badgeColor}22`, color:v.badgeColor, border:`1px solid ${v.badgeColor}55`, flexShrink:0 }}>{v.badge}</span>
                    <span style={{ fontSize:12, fontWeight:700, color:v.titleColor }}>{v.title}</span>
                    <span style={{ marginLeft:"auto", display:"flex", gap:6, flexWrap:"wrap" as const }}>
                      {signals.map((g, i) => (
                        <span key={i} style={{ fontSize:10, fontWeight:700, color: g ? "#4ade80" : "#ff6b88", background: g ? "rgba(74,222,128,0.08)" : "rgba(239,68,68,0.08)", padding:"1px 7px", borderRadius:4, border:`1px solid ${g ? "rgba(74,222,128,0.2)" : "rgba(239,68,68,0.2)"}` }}>
                          {g ? "✓" : "✗"} {labels[i]}
                        </span>
                      ))}
                    </span>
                  </div>
                  {/* Row 2: action sentence */}
                  <div style={{ fontSize:12, color:v.actionColor === "#64748b" ? "#475569" : "#94a3b8", lineHeight:1.6, borderTop:"1px solid rgba(255,255,255,0.04)", paddingTop:8 }}>
                    <span style={{ fontWeight:700, color:v.actionColor, marginRight:6 }}>→</span>{v.action}
                  </div>
                </div>
              );
            })()}

            {/* ── Layer 3: Dow Theory Confirmation ── */}
            <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", color:"#334155", margin:"10px 0 6px" }}>
              Dow Theory — Market Confirmation
            </div>
            <div className="grid5">

              {/* DJT Price tile */}
              <div className="tile">
                <div className="tileTop">
                  <span className="lbl">Transports</span>
                  <span className="ytd">DJT</span>
                </div>
                <div className="valHero">{djtPrice != null ? fmtWhole(djtPrice) : "—"}</div>
                {djtTrend14d.length > 0 && (
                  <div className="sparkWrap" dangerouslySetInnerHTML={{ __html: sparkline(djtTrend14d, djtChangePct != null && djtChangePct >= 0 ? "#4ade80" : "#ff6b88") }} />
                )}
                <div className="subSpx">
                  {djtChangePct != null
                    ? `${djtChangePct >= 0 ? "▲" : "▼"} ${Math.abs(djtChangePct).toFixed(1)}% today`
                    : "Dow Jones Transports"}
                </div>
              </div>

              {/* DJT 200-DMA tile */}
              <div className={!djtAbove200 ? "tile tile200Red" : "tile tile200"}>
                <div className="tileTop">
                  <span className="lbl" style={{ color: !djtAbove200 ? "#ff6b88" : "#f59e0b" }}>DJT 200-DMA</span>
                  <span className="badge" style={{ background: !djtAbove200 ? "#ef4444" : "#f59e0b", color: !djtAbove200 ? "#fff" : "#000" }}>!</span>
                </div>
                <div className="valHero">{djt200dma != null ? fmtWhole(djt200dma) : "—"}</div>
                <div className="status" style={{ color: djtVs200 == null ? "#94a3b8" : !djtAbove200 ? "#ff6b88" : djtVs200 <= 2 ? "#fbbf24" : "#4ade80" }}>
                  {djtVs200 == null ? "Loading" : !djtAbove200 ? "Bearish" : djtVs200 <= 2 ? "Testing Support" : "Holding Above"}
                </div>
                <div className="sub" style={{ color: !djtAbove200 ? "#ff6b88" : "#f59e0b" }}>
                  {djtVs200 != null ? `DJT ${djtVs200 >= 0 ? "+" : ""}${djtVs200.toFixed(1)}% ${djtVs200 >= 0 ? "above" : "below"}` : "Waiting"}
                </div>
                {djt200slope != null && (
                  <div style={{ fontSize:10, marginTop:3, fontWeight:700, color: djt200slope > 0.02 ? "#4ade80" : djt200slope < -0.02 ? "#ff6b88" : "#fbbf24" }}>
                    Slope {djt200slope > 0 ? "↗ +" : djt200slope < 0 ? "↘ " : "→ "}{djt200slope.toFixed(1)}% · {djt200slope > 0.02 ? "Bullish" : djt200slope < -0.02 ? "Bearish" : "Neutral"}
                  </div>
                )}
              </div>

              {/* Market Confirmation (Dow Theory) — spans 3 */}
              {(() => {
                // ── Slope-aware state machine ─────────────────────────────────
                // Uses both position (above/below 200-DMA) AND slope direction
                // to avoid false positives where price is barely above but trend rolling over
                const spxRising = slope200 != null && slope200 > 0.02;
                const spxFalling = slope200 != null && slope200 < -0.02;
                const djtRising = djt200slope != null && djt200slope > 0.02;
                const djtFalling = djt200slope != null && djt200slope < -0.02;

                // 5-state machine: confirmed up/down + 3 shades of non-confirmation
                type ConfState = "confirmed_bull" | "confirmed_bear" | "non_conf_transition" | "non_conf_bear_warn" | "non_conf_bull_recovery";
                const confState: ConfState =
                  // Both above AND both rising = clean bull
                  (!is200Broken && djtAbove200 && spxRising && djtRising)   ? "confirmed_bull" :
                  // Both below AND both falling = confirmed bear
                  (is200Broken && !djtAbove200 && spxFalling && djtFalling)  ? "confirmed_bear" :
                  // SPX below, DJT above = classic non-confirmation (most common transition state)
                  (is200Broken && djtAbove200)                               ? "non_conf_bull_recovery" :
                  // SPX above, DJT below = leading warning (economy rolling before equities)
                  (!is200Broken && !djtAbove200)                             ? "non_conf_bear_warn" :
                  // Everything else = transition (above/below but slopes not aligned)
                                                                               "non_conf_transition";

                const stateLabel: Record<ConfState, string> = {
                  confirmed_bull:        "✅ Confirmed Uptrend",
                  confirmed_bear:        "🔴 Confirmed Downtrend",
                  non_conf_transition:   "⚠️ Non-Confirmation — Transition",
                  non_conf_bear_warn:    "⚠️ Early Warning — Transports Leading Down",
                  non_conf_bull_recovery:"⚠️ Non-Confirmation — Potential Recovery",
                };
                const stateColor: Record<ConfState, string> = {
                  confirmed_bull:        "#4ade80",
                  confirmed_bear:        "#ff6b88",
                  non_conf_transition:   "#fbbf24",
                  non_conf_bear_warn:    "#ff6b88",
                  non_conf_bull_recovery:"#fbbf24",
                };
                const stateInterpretation: Record<ConfState, string> = {
                  confirmed_bull:        "Structural agreement: both equity and economic trend rising above long-term averages. High-probability bull environment. Pullbacks are buyable.",
                  confirmed_bear:        "Structural confirmation: equity weakness and economic deterioration aligned. Both indices below falling 200-DMAs. Rallies are suspect — this is the highest-conviction bear signal in this framework.",
                  non_conf_transition:   "Mixed signals: one or both indices above/below 200-DMA but slopes not aligned. Early-stage regime shift. Monitor weekly — slope convergence will resolve direction.",
                  non_conf_bear_warn:    "Early warning: Transports breaking down while equities still elevated — historically a leading indicator of economic weakness before it shows in large-caps. Watch for SPX confirmation.",
                  non_conf_bull_recovery:"Structural disagreement: equity trend weakening while economic activity remains firm. Historically resolves with either SPX reclaim OR DJT breakdown.",
                };
                const stateResolution: Record<ConfState, string> = {
                  confirmed_bull:        `Watch: SPX 200-DMA slope turning flat or negative is the first warning of regime change.`,
                  confirmed_bear:        `Watch: SPX reclaim of ${fmtWhole(spx200)} with rising slope → regime upgrade. DJT reclaim of its 200-DMA → secondary confirmation.`,
                  non_conf_transition:   `Resolution: slope alignment in same direction over 2–3 weeks will confirm the next regime.`,
                  non_conf_bear_warn:    `Resolution trigger: SPX breaks below ${fmtWhole(spx200)} → bear confirmed. DJT reclaims 200-DMA → false alarm.`,
                  non_conf_bull_recovery:`Resolution trigger: SPX reclaims ${fmtWhole(spx200)} → bull confirmed. DJT breaks below its 200-DMA (${djt200dma != null ? fmtWhole(djt200dma) : "—"}) → bear confirmed.`,
                };

                const sc = stateColor[confState];

                return (
                  <div className="tile" style={{ gridColumn:"span 3" }}>
                    <div className="tileTop">
                      <span className="lbl">Market Confirmation</span>
                      <span style={{ fontSize:10, fontWeight:700, color:"#475569" }}>Dow Theory · SPX + DJT</span>
                    </div>
                    <div style={{ fontSize:20, fontWeight:700, color: sc, marginBottom:6 }}>
                      {stateLabel[confState]}
                    </div>

                    {/* SPX vs DJT position + slope boxes */}
                    <div style={{ display:"flex", gap:8, marginTop:4 }}>
                      <div style={{ flex:1, background:"#141b47", borderRadius:6, padding:"6px 10px" }}>
                        <div style={{ fontSize:9, color:"#475569", textTransform:"uppercase", letterSpacing:"0.06em" }}>SPX vs 200-DMA</div>
                        <div style={{ fontSize:13, fontWeight:700, color: is200Broken ? "#ff6b88" : "#4ade80", marginTop:2 }}>
                          {is200Broken ? "↘ Below" : "↗ Above"}{spx200Pct != null ? ` ${fmtSigned1(spx200Pct)}` : ""}
                        </div>
                        {slope200 != null && (
                          <div style={{ fontSize:10, color: spxRising ? "#4ade80" : spxFalling ? "#ff6b88" : "#fbbf24", marginTop:2 }}>
                            Slope {spxRising ? "↗" : spxFalling ? "↘" : "→"} {slope200 > 0 ? "+" : ""}{slope200.toFixed(1)}%
                          </div>
                        )}
                      </div>
                      <div style={{ display:"flex", alignItems:"center", fontSize:18, fontWeight:700, color: confState === "confirmed_bull" || confState === "confirmed_bear" ? "#334155" : "#fbbf24" }}>
                        {confState === "confirmed_bull" || confState === "confirmed_bear" ? "=" : "≠"}
                      </div>
                      <div style={{ flex:1, background:"#141b47", borderRadius:6, padding:"6px 10px" }}>
                        <div style={{ fontSize:9, color:"#475569", textTransform:"uppercase", letterSpacing:"0.06em" }}>DJT vs 200-DMA</div>
                        <div style={{ fontSize:13, fontWeight:700, color: djtAbove200 ? "#4ade80" : "#ff6b88", marginTop:2 }}>
                          {djtAbove200 ? "↗ Above" : "↘ Below"}{djtVs200 != null ? ` ${djtVs200 >= 0 ? "+" : ""}${djtVs200.toFixed(1)}%` : ""}
                        </div>
                        {djt200slope != null && (
                          <div style={{ fontSize:10, color: djtRising ? "#4ade80" : djtFalling ? "#ff6b88" : "#fbbf24", marginTop:2 }}>
                            Slope {djtRising ? "↗" : djtFalling ? "↘" : "→"} {djt200slope > 0 ? "+" : ""}{djt200slope.toFixed(1)}%
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Interpretation */}
                    <div style={{ fontSize:11, color:"#94a3b8", marginTop:8, lineHeight:1.55 }}>
                      {stateInterpretation[confState]}
                    </div>

                    {/* Resolution trigger */}
                    <div style={{ fontSize:11, color:"#475569", marginTop:5, lineHeight:1.5, borderTop:"1px solid rgba(255,255,255,0.04)", paddingTop:5 }}>
                      <span style={{ fontWeight:700, color:"#334155" }}>Resolution → </span>
                      {stateResolution[confState]}
                    </div>
                  </div>
                );
              })()}
            </div>

          </section>

          {/* ③ SPX TECHNICAL CHART */}
          <section className="panel">
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <div>
                <div className="panelTitle">S&P 500 — Technical Chart</div>
                <div className="panelSub">Price · Moving Averages · Bollinger Bands · RSI · MACD</div>
              </div>
              <div style={{ display:"flex", gap:6 }}>
                {rangeBtn("1M",21)}{rangeBtn("3M",63)}{rangeBtn("6M",126)}{rangeBtn("1Y",252)}
              </div>
            </div>
            <div style={{ display:"flex", gap:16, marginBottom:10, flexWrap:"wrap" }}>
              {[["SPX","#60a5fa"],["20-DMA","#fbbf24"],["50-DMA","#a78bfa"],["100-DMA","#f97316"],["200-DMA","#ef4444"]].map(([l,c])=>(
                <span key={l} style={{ fontSize:11, color:"#94a3b8", display:"flex", alignItems:"center", gap:5 }}>
                  <span style={{ width:18, height:2, background:c, display:"inline-block" }} />{l}
                </span>
              ))}
              <span style={{ fontSize:11, color:"#94a3b8", display:"flex", alignItems:"center", gap:5 }}>
                <span style={{ width:18, height:4, background:"rgba(148,163,184,0.2)", display:"inline-block", borderRadius:1 }} />Bollinger
              </span>
            </div>
            <div style={{ position:"relative", width:"100%", height:320 }}><canvas id="spxPriceChart" /></div>
            <div style={{ marginTop:4 }}>
              <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", color:"#475569", margin:"8px 0 3px" }}>RSI (14)</div>
              <div style={{ position:"relative", width:"100%", height:80 }}><canvas id="spxRsiChart" /></div>
            </div>
            <div style={{ marginTop:4 }}>
              <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", color:"#475569", margin:"8px 0 3px" }}>MACD (12, 26, 9)</div>
              <div style={{ position:"relative", width:"100%", height:90 }}><canvas id="spxMacdChart" /></div>
            </div>
          </section>

          {/* ④ MARKET STRESS — CONTEXT */}
          <section className="panel">
            <div className="panelTitle" style={{ marginBottom:10 }}>Market Stress — Context</div>
            {/* ── ROW 2: Policy & Rates ── */}
            <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", color:"#334155", marginBottom:6, marginTop:10 }}>Policy &amp; Rates</div>
            <div className="grid5" style={{ marginBottom:8 }}>
              {/* 10Y Nominal */}
              <div className="tile" style={{ cursor:"pointer" }} onClick={() => setModal("nom10y")}>
                <div className="lbl" style={{ marginBottom:6 }}>10Y Yield (Nominal)</div>
                <div className="valHero" style={{ color:"#fff" }}>{nom10y.toFixed(2)}<span style={{ fontSize:20, fontWeight:600 }}>%</span></div>
                <div className="status" style={{ color:nom10y>4.5?"#ff6b88":nom10y>4?"#fbbf24":"#4ade80" }}>
                  {nom10y>4.5?"Restrictive":nom10y>4?"Watch":"Neutral"}
                </div>
                <div style={{ position:"relative", height:6, borderRadius:9999, background:"#202a64", marginTop:12, overflow:"visible" }}>
                  <div style={{ position:"absolute", left:0, top:0, height:6, width:`${Math.max(0,Math.min((nom10y/6)*100,100))}%`, borderRadius:9999, background:nom10y>4.5?"#ff6b88":nom10y>4?"#fbbf24":"#4ade80" }} />
                  <div style={{ position:"absolute", top:-6, left:`${(4/6)*100}%`, width:2.5, height:18, background:"rgba(255,255,255,0.7)", borderRadius:2, zIndex:2 }} />
                  <div style={{ position:"absolute", top:-4, left:`${(4.5/6)*100}%`, width:2, height:14, background:"rgba(255,255,255,0.3)", borderRadius:2, zIndex:2 }} />
                </div>
                <div style={{ marginTop:6, display:"flex", justifyContent:"space-between", fontSize:10, color:"#475569" }}><span>2%</span><span>4%</span><span>4.5%</span><span>6%</span></div>
                <div style={{ fontSize:11, marginTop:6, fontWeight:600, color:"#64748b" }}>Real: {real10y.toFixed(2)}% · Premium: {(nom10y-real10y).toFixed(2)}%</div>
              </div>
              {/* Real 10Y */}
              <div className="tile" style={{ cursor:"pointer" }} onClick={() => setModal("real10y")}>
                <div className="lbl" style={{ marginBottom:6 }}>Real 10Y</div>
                <div className="valHero" style={{ color:"#fff" }}>{fmt2(real10y)}<span style={{ fontSize:20, fontWeight:600 }}>%</span></div>
                <div className="status" style={{ color:real10y>=2.5?"#ff6b88":real10y>=1.5?"#fbbf24":"#4ade80" }}>
                  {real10y>=2.5?"Restrictive":real10y>=1.5?"Watch":"Neutral"}
                </div>
                <div style={{ position:"relative", height:6, borderRadius:9999, background:"#202a64", marginTop:12, overflow:"visible" }}>
                  <div style={{ position:"absolute", left:0, top:0, height:6, width:`${Math.max(0,Math.min((real10y/3)*100,100))}%`, borderRadius:9999, background:real10y>=2.5?"#ff6b88":real10y>=1.5?"#fbbf24":"#4ade80" }} />
                  <div style={{ position:"absolute", top:-6, left:`${(1.5/3)*100}%`, width:2.5, height:18, background:"rgba(255,255,255,0.5)", borderRadius:2, zIndex:2 }} />
                  <div style={{ position:"absolute", top:-4, left:`${(2.5/3)*100}%`, width:2, height:14, background:"rgba(255,255,255,0.3)", borderRadius:2, zIndex:2 }} />
                </div>
                <div style={{ marginTop:6, display:"flex", justifyContent:"space-between", fontSize:10, color:"#475569" }}><span>0%</span><span>1.5%</span><span>2.5%</span><span>3%</span></div>
                <div style={{ fontSize:11, marginTop:6, fontWeight:600, color:"#64748b" }}>Equity headwind above 1.5%</div>
              </div>
              {/* Fed Funds */}
              <div className="tile">
                <div className="lbl" style={{ marginBottom:6 }}>Fed Funds Rate</div>
                <div className="valHero" style={{ color:"#fff" }}>{fedFunds.toFixed(2)}<span style={{ fontSize:20, fontWeight:600 }}>%</span></div>
                <div className="status" style={{ color:fedFunds>4.5?"#ff6b88":fedFunds>3?"#fbbf24":"#4ade80" }}>
                  {fedFunds>4.5?"Restrictive":fedFunds>3?"Elevated":"Accommodative"}
                </div>
                <div style={{ position:"relative", height:6, borderRadius:9999, background:"#202a64", marginTop:12, overflow:"visible" }}>
                  <div style={{ position:"absolute", left:0, top:0, height:6, width:`${Math.max(0,Math.min((fedFunds/6)*100,100))}%`, borderRadius:9999, background:fedFunds>4.5?"#ff6b88":fedFunds>3?"#fbbf24":"#4ade80" }} />
                  <div style={{ position:"absolute", top:-6, left:`${(4.5/6)*100}%`, width:2.5, height:18, background:"rgba(255,255,255,0.7)", borderRadius:2, zIndex:2 }} />
                </div>
                <div style={{ marginTop:6, display:"flex", justifyContent:"space-between", fontSize:10, color:"#475569" }}><span>0%</span><span>3%</span><span>4.5%</span><span>6%</span></div>
                <div style={{ fontSize:11, marginTop:6, fontWeight:600, color:"#64748b" }}>Real rate: {(fedFunds-breakeven5y).toFixed(2)}%</div>
              </div>
              {/* 5Y Breakeven */}
              <div className="tile">
                <div className="lbl" style={{ marginBottom:6 }}>5Y Breakeven Infl.</div>
                <div className="valHero" style={{ color:"#fff" }}>{breakeven5y.toFixed(2)}<span style={{ fontSize:20, fontWeight:600 }}>%</span></div>
                <div className="status" style={{ color:breakeven5y>3?"#ff6b88":breakeven5y>2.5?"#fbbf24":breakeven5y>2?"#4ade80":"#94a3b8" }}>
                  {breakeven5y>3?"Danger":breakeven5y>2.5?"Watch":breakeven5y>2?"On Target":"Low"}
                </div>
                <div style={{ position:"relative", height:6, borderRadius:9999, background:"#202a64", marginTop:12, overflow:"visible" }}>
                  <div style={{ position:"absolute", left:0, top:0, height:6, width:`${Math.max(0,Math.min((breakeven5y/4)*100,100))}%`, borderRadius:9999, background:breakeven5y>3?"#ff6b88":breakeven5y>2.5?"#fbbf24":breakeven5y>2?"#4ade80":"#94a3b8" }} />
                  <div style={{ position:"absolute", top:-6, left:"62.5%", width:2.5, height:18, background:"rgba(255,255,255,0.7)", borderRadius:2, zIndex:2 }} />
                  <div style={{ position:"absolute", top:-4, left:"50%", width:2, height:14, background:"rgba(255,255,255,0.3)", borderRadius:2, zIndex:2 }} />
                </div>
                <div style={{ marginTop:6, display:"flex", justifyContent:"space-between", fontSize:10, color:"#475569" }}><span>0%</span><span>2%</span><span>2.5%</span><span>4%</span></div>
                <div style={{ fontSize:11, marginTop:6, fontWeight:600, color:"#64748b" }}>Market-implied inflation · Fed target: 2%</div>
              </div>
              {/* Yield Curve */}
              <div className="tile" style={{ cursor:"pointer" }} onClick={() => setModal("yc")}>
                <div className="lbl" style={{ marginBottom:6 }}>Yield Curve</div>
                <div className="valHero" style={{ color:"#fff" }}>{yieldCurve>0?"+":""}{fmt2(yieldCurve)}<span style={{ fontSize:20, fontWeight:600 }}>%</span></div>
                <div className="status" style={{ color:yieldCurve<-0.5?"#ff6b88":yieldCurve<0?"#fbbf24":"#4ade80" }}>
                  {yieldCurve<-0.5?"Inverted":yieldCurve<0?"Flattening":"Healthy"}
                </div>
                <div style={{ position:"relative", height:6, borderRadius:9999, background:"#202a64", marginTop:12, overflow:"visible" }}>
                  <div style={{ position:"absolute", left:0, top:0, height:6, width:`${Math.max(0,Math.min(((yieldCurve+1.5)/3)*100,100))}%`, borderRadius:9999, background:yieldCurve<-0.5?"#ff6b88":yieldCurve<0?"#fbbf24":"#4ade80" }} />
                  <div style={{ position:"absolute", top:-6, left:`${(1.5/3)*100}%`, width:2.5, height:18, background:"rgba(255,255,255,0.7)", borderRadius:2, zIndex:2 }} />
                </div>
                <div style={{ marginTop:6, display:"flex", justifyContent:"space-between", fontSize:10, color:"#475569" }}><span>-1.5%</span><span>0%</span><span>+1.5%</span></div>
                <div style={{ fontSize:11, marginTop:6, fontWeight:600, color:"#64748b" }}>
                  {yieldCurve>=0?`Re-steepened ${fmt2(yieldCurve)}% from inversion`:`Inverted ${fmt2(Math.abs(yieldCurve))}%`}
                </div>
              </div>
              {/* Put/Call Ratio */}
              <div className="tile">
                <div className="lbl" style={{ marginBottom:6 }}>Put / Call Ratio</div>
                <div className="valHero" style={{ color:"#fff" }}>{putCallRatio!=null?putCallRatio.toFixed(2):"—"}</div>
                <div className="status" style={{ color:putCallRatio==null?"#475569":putCallRatio>1.2?"#4ade80":putCallRatio>0.9?"#94a3b8":putCallRatio>0.7?"#fbbf24":"#ff6b88" }}>
                  {putCallRatio==null?"Loading":putCallRatio>1.2?"Fearful":putCallRatio>0.9?"Neutral":putCallRatio>0.7?"Complacency":"Extreme"}
                </div>
                <div style={{ position:"relative", height:6, borderRadius:9999, background:"#202a64", marginTop:12, overflow:"visible" }}>
                  <div style={{ position:"absolute", left:0, top:0, height:6, width:`${Math.max(0,Math.min(((putCallRatio??0.9)-0.4)/1.2*100,100))}%`, borderRadius:9999, background:putCallRatio==null?"#475569":putCallRatio>1.2?"#4ade80":putCallRatio>0.9?"#94a3b8":putCallRatio>0.7?"#fbbf24":"#ff6b88" }} />
                  <div style={{ position:"absolute", top:-6, left:`${((0.7-0.4)/1.2)*100}%`, width:2, height:14, background:"rgba(255,255,255,0.3)", borderRadius:2, zIndex:2 }} />
                  <div style={{ position:"absolute", top:-6, left:`${((1.0-0.4)/1.2)*100}%`, width:2.5, height:18, background:"rgba(255,255,255,0.7)", borderRadius:2, zIndex:2 }} />
                </div>
                <div style={{ marginTop:6, display:"flex", justifyContent:"space-between", fontSize:10, color:"#475569" }}><span>0.4</span><span>0.7</span><span>1.0</span><span>1.6</span></div>
                <div style={{ fontSize:11, marginTop:6, fontWeight:600, color:"#64748b" }}>&gt;1.0 contrarian buy · &lt;0.7 complacency</div>
              </div>
            </div>

            {/* ── ROW 3: Valuation Risk ── */}
            <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", color:"#334155", marginBottom:6, marginTop:10 }}>Valuation Risk</div>
            <div className="grid5" style={{ marginBottom:8 }}>
              <div className="tile" style={{ cursor:"pointer" }} onClick={() => setModal("cape")}>
                <div className="lbl" style={{ marginBottom:6 }}>CAPE Ratio (Shiller P/E)</div>
                <div className="valHero" style={{ color:"#fff" }}>{capeRatio.toFixed(1)}<span style={{ fontSize:20, fontWeight:600 }}>x</span></div>
                <div className="status" style={{ color:capeRatio>35?"#ff6b88":capeRatio>25?"#fbbf24":"#4ade80" }}>
                  {capeRatio>35?"Extreme":capeRatio>25?"Overvalued":capeRatio>20?"Elevated":"Fairly Valued"}
                </div>
                <div style={{ position:"relative", height:6, borderRadius:9999, background:"#202a64", marginTop:12, overflow:"visible" }}>
                  {(() => {
                    const toPos = (x: number) => Math.max(0,Math.min((x-5)/45*100,100));
                    const pos=toPos(capeRatio), p25=toPos(25), p35=toPos(35);
                    return <>
                      <div style={{ position:"absolute", left:0, top:0, height:6, width:`${Math.min(pos,p25)}%`, background:"#4ade80", borderRadius:"9999px 0 0 9999px" }} />
                      {capeRatio>25 && <div style={{ position:"absolute", left:`${p25}%`, top:0, height:6, width:`${Math.min(pos,p35)-p25}%`, background:"#fbbf24" }} />}
                      {capeRatio>35 && <div style={{ position:"absolute", left:`${p35}%`, top:0, height:6, width:`${pos-p35}%`, background:"#ff6b88", borderRadius:"0 9999px 9999px 0" }} />}
                    </>;
                  })()}
                  <div style={{ position:"absolute", top:-4, left:`${(25-5)/45*100}%`, width:2, height:14, background:"rgba(255,255,255,0.4)", borderRadius:2, zIndex:2 }} />
                  <div style={{ position:"absolute", top:-6, left:`${(35-5)/45*100}%`, width:2.5, height:18, background:"rgba(255,255,255,0.8)", borderRadius:2, zIndex:2 }} />
                </div>
                <div style={{ marginTop:6, display:"flex", justifyContent:"space-between", fontSize:10, color:"#475569" }}><span>5x</span><span>25x</span><span>35x↑</span><span>50x</span></div>
                <div style={{ fontSize:11, marginTop:6, fontWeight:600, color:"#64748b" }}>
                  {capeRatio>35?`▲ ${(capeRatio-16).toFixed(1)}x above hist. avg (16x)`:"Hist. avg ~16x · Dot-com peak 44x"}
                </div>
              </div>
            </div>
          </section>

          {/* ⑤ ECONOMY */}
          <section className="panel">
            <div className="panelHeader"><div><div className="panelTitle">Economy</div><div className="panelSub">Macro Conditions · 3-Month Trend</div></div><div className="pstamp">FRED &amp; ISM · weekly/monthly</div></div>
            <div className="grid5" style={{ marginBottom:8 }}>
              {[
                { label:"CPI Inflation",    val:"2.8%",  date:"YoY",     chg:"▼ 0.2% easing",    chgColor:"#4ade80", sub:"3-mo: slowly easing",  pill:"Above Target",  pillC:"pillA", sColor:"#fbbf24", pts:"0,16 25,15 50,14 75,13 100,12", mid:false, isMeter:true, mW:"56%", mC:"#fbbf24", sc:["0%","2%","5%"] },
                { label:"GDP Growth",       val:"2.3%",  date:"Q4 '24",  chg:"▼ 0.8% from prior", chgColor:"#ff6b88", sub:"3-mo: moderating",      pill:"Positive",      pillC:"pillG", sColor:"#4ade80", pts:"0,14 25,13 50,11 75,10 100,12", mid:false, isMeter:true, mW:"46%", mC:"#4ade80", sc:["-2%","0%","5%"] },
                { label:"Nonfarm Payrolls", val:"151K",  date:"Feb '25", chg:"▼ 56K from prior",  chgColor:"#ff6b88", sub:"3-mo: decelerating",    pill:"Below Trend",   pillC:"pillA", sColor:"#fbbf24", pts:"0,8 25,9 50,11 75,13 100,15",  mid:false, isMeter:true, mW:"38%", mC:"#fbbf24", sc:["0","200K","400K"] },
                { label:"ISM Mfg PMI",      val:"49.0",  date:"",        chg:"▼ 0.6 from prior",  chgColor:"#ff6b88", sub:"3-mo: contracting",     pill:"Below 50",      pillC:"pillR", sColor:"#ff6b88", pts:"0,8 25,9 50,11 75,12 100,14",  mid:true,  isMeter:false },
              ].map(t => (
                <div key={t.label} className="tile">
                  <div className="lbl">{t.label}</div>
                  <div style={{ fontSize:26, fontWeight:700, color:"#fff" }}>{t.val}{t.date && <span style={{ fontSize:11, color:"#475569", marginLeft:4 }}>{t.date}</span>}</div>
                  <div style={{ fontSize:12, fontWeight:600, color:t.chgColor, marginTop:3 }}>{t.chg}</div>
                  {t.isMeter ? (
                    <><div className="meterTrack"><div className="meterFill" style={{ width:t.mW!, background:t.mC! }} /><div className="meterMarker" style={{ left:t.mW! }} /></div>
                    <div className="meterScale"><span>{t.sc![0]}</span><span>{t.sc![1]}</span><span>{t.sc![2]}</span></div></>
                  ) : (
                    <svg viewBox="0 0 100 24" width="100%" height="18" style={{ margin:"5px 0 2px" }}>
                      {t.mid && <line x1="0" y1="12" x2="100" y2="12" stroke="rgba(255,255,255,0.07)" strokeWidth="1" strokeDasharray="3,3" />}
                      <polyline fill="none" stroke={t.sColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={t.pts} />
                    </svg>
                  )}
                  <div className="sub">{t.sub}</div>
                  <span className={t.pillC}>{t.pill}</span>
                </div>
              ))}

              {/* ── Fed Balance Sheet (WALCL) — LIVE from FRED ── */}
              {(() => {
                const trillions = walclBn != null ? walclBn / 1000 : null;
                const dir = walclDirection || (walclChgBn == null ? "" : walclChgBn > 10 ? "expanding" : walclChgBn < -10 ? "contracting" : "flat");
                const chgLabel = walclChgBn != null
                  ? `${walclChgBn > 0 ? "▲" : "▼"} $${Math.abs(walclChgBn)}B WoW`
                  : "▼ $180B from prior";
                const chgColor = walclChgBn != null ? (walclChgBn > 0 ? "#4ade80" : "#ff6b88") : "#ff6b88";
                const pill = dir === "expanding" ? "Expanding" : dir === "flat" ? "Stable" : "Tightening";
                const pillC = dir === "expanding" ? "pillG" : dir === "flat" ? "pillA" : "pillR";
                const barColor = dir === "expanding" ? "#4ade80" : dir === "flat" ? "#fbbf24" : "#ff6b88";
                const barW = trillions != null ? Math.max(5, Math.min((trillions / 10) * 100, 100)) : 61;
                const subText = dir === "expanding" ? "3-mo: expanding" : dir === "flat" ? "3-mo: stable" : "3-mo: draining";
                return (
                  <div className="tile">
                    <div className="lbl">Fed Balance Sheet</div>
                    <div style={{ fontSize:26, fontWeight:700, color:"#fff" }}>
                      {trillions != null ? `$${trillions.toFixed(2)}T` : "$—"}
                      <span style={{ fontSize:10, color:"#475569", marginLeft:5 }}>WALCL</span>
                    </div>
                    <div style={{ fontSize:12, fontWeight:600, color:chgColor, marginTop:3 }}>{chgLabel}</div>
                    <div className="meterTrack"><div className="meterFill" style={{ width:`${barW}%`, background:barColor }} /><div className="meterMarker" style={{ left:`${barW}%` }} /></div>
                    <div className="meterScale"><span>$5T</span><span>$7.5T</span><span>$10T</span></div>
                    <div className="sub" style={{ marginTop:4 }}>{subText}</div>
                    <span className={pillC}>{pill}</span>
                  </div>
                );
              })()}
            </div>
            <div className="grid5">
              {[
                { label:"ISM Services PMI", val:"53.5", date:"",     chg:"▼ 1.2 from prior", chgColor:"#fbbf24", sub:"3-mo: softening",   pill:"Slowing",  pillC:"pillA", sColor:"#fbbf24", pts:"0,6 25,7 50,9 75,10 100,12", mid:true },
                { label:"Initial Claims",   val:"225K", date:"",     chg:"▲ 8K from prior",  chgColor:"#fbbf24", sub:"3-mo: drifting up", pill:"Watch",    pillC:"pillA", sColor:"#fbbf24", pts:"0,18 25,16 50,15 75,12 100,9", mid:false },
              ].map(t => (
                <div key={t.label} className="tile">
                  <div className="lbl">{t.label}</div>
                  <div style={{ fontSize:26, fontWeight:700, color:"#fff" }}>{t.val}</div>
                  <div style={{ fontSize:12, fontWeight:600, color:t.chgColor, marginTop:3 }}>{t.chg}</div>
                  <svg viewBox="0 0 100 24" width="100%" height="18" style={{ margin:"5px 0 2px" }}>
                    {t.mid && <line x1="0" y1="12" x2="100" y2="12" stroke="rgba(255,255,255,0.07)" strokeWidth="1" strokeDasharray="3,3" />}
                    <polyline fill="none" stroke={t.sColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={t.pts} />
                  </svg>
                  <div className="sub">{t.sub}</div>
                  <span className={t.pillC}>{t.pill}</span>
                </div>
              ))}

              {/* ── Brent Crude Oil — LIVE · Roberts' "master switch" for Fed policy ── */}
              {(() => {
                const price = brentPrice;
                const chgPct = brentChangePct;
                const regime = brentRegime;
                const statusLabel = regime === "frozen" ? "Fed Frozen" : regime === "watch" ? "Watch Zone" : regime === "neutral" ? "Neutral" : regime === "room" ? "Fed Has Room" : "Loading";
                const statusColor = regime === "frozen" ? "#ff6b88" : regime === "watch" ? "#fbbf24" : regime === "neutral" ? "#94a3b8" : "#4ade80";
                const pillC = regime === "frozen" ? "pillR" : regime === "watch" ? "pillA" : regime === "neutral" ? "" : "pillG";
                // Bar: $60=0%, $80=25%, $95=50%, $110=75%, $130=100%
                const barW = price != null ? Math.max(2, Math.min(((price - 60) / 70) * 100, 100)) : 50;
                const p80 = ((80-60)/70)*100;
                const p95 = ((95-60)/70)*100;
                const p110 = ((110-60)/70)*100;
                return (
                  <div className="tile" style={{ gridColumn:"span 3" }}>
                    <div className="tileTop">
                      <span className="lbl">Brent Crude</span>
                      <span style={{ fontSize:10, fontWeight:700, color:"#475569" }}>LIVE · BZ=F</span>
                    </div>
                    <div style={{ display:"flex", alignItems:"baseline", gap:10 }}>
                      <div style={{ fontSize:32, fontWeight:700, color:"#fff" }}>
                        {price != null ? `$${price.toFixed(2)}` : "—"}
                      </div>
                      {chgPct != null && (
                        <div style={{ fontSize:13, fontWeight:600, color: chgPct >= 0 ? "#ff6b88" : "#4ade80" }}>
                          {chgPct >= 0 ? "▲" : "▼"} {Math.abs(chgPct).toFixed(1)}%
                        </div>
                      )}
                    </div>
                    <div className="status" style={{ color: statusColor }}>{statusLabel}</div>
                    {/* Threshold bar */}
                    <div style={{ position:"relative", height:6, borderRadius:9999, background:"#202a64", marginTop:10, overflow:"visible" }}>
                      <div style={{ position:"absolute", left:0, top:0, height:6, width:`${Math.min(barW, p80)}%`, background:"#4ade80", borderRadius:"9999px 0 0 9999px" }} />
                      {price != null && price > 80 && <div style={{ position:"absolute", left:`${p80}%`, top:0, height:6, width:`${Math.min(barW,p95)-p80}%`, background:"#94a3b8" }} />}
                      {price != null && price > 95 && <div style={{ position:"absolute", left:`${p95}%`, top:0, height:6, width:`${Math.min(barW,p110)-p95}%`, background:"#fbbf24" }} />}
                      {price != null && price > 110 && <div style={{ position:"absolute", left:`${p110}%`, top:0, height:6, width:`${barW-p110}%`, background:"#ff6b88", borderRadius:"0 9999px 9999px 0" }} />}
                      {/* Threshold ticks */}
                      <div style={{ position:"absolute", top:-4, left:`${p80}%`, width:2, height:14, background:"rgba(255,255,255,0.4)", borderRadius:2, zIndex:2 }} />
                      <div style={{ position:"absolute", top:-4, left:`${p95}%`, width:2, height:14, background:"rgba(255,255,255,0.6)", borderRadius:2, zIndex:2 }} />
                      <div style={{ position:"absolute", top:-6, left:`${p110}%`, width:3, height:18, background:"rgba(255,255,255,0.9)", borderRadius:2, zIndex:2 }} />
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"#475569", marginTop:4 }}>
                      <span>$60</span><span>$80</span><span>$95</span><span style={{ color:"#ff6b88", fontWeight:700 }}>$110↑</span><span>$130</span>
                    </div>
                    <div style={{ fontSize:11, marginTop:5, color:"#64748b", lineHeight:1.5 }}>
                      {regime === "frozen" ? `▲ Above $110 — Fed frozen. Oil keeping inflation elevated, cuts off the table. Deepens economic landing risk.`
                      : regime === "watch" ? `⚠ $95–110 watch zone — Fed limited. Every dollar above $95 tightens financial conditions without a rate hike.`
                      : regime === "neutral" ? `→ $80–95 neutral range — manageable for Fed. Cuts remain possible if other conditions allow.`
                      : `▼ Below $80 — Fed has room. Oil not a constraint on rate policy.`}
                    </div>
                  </div>
                );
              })()}
            </div>
          </section>

          {/* ⑥ BREADTH */}
          <section className="panel">
            <div className="panelHeader"><div><div className="panelTitle">Market Breadth</div><div className="panelSub">% of S&P 500 stocks above key moving averages</div></div><div className="pstamp">Updated daily</div></div>
            <div className="grid5" style={{ marginBottom:8 }}>
              <div className="tile">
                <div className="lbl">% Above 200-DMA</div>
                <div style={{ fontSize:26, fontWeight:700, color:"#fff" }}>44%</div>
                <div className="bbar"><div className="bbarFill" style={{ width:"44%", background:"#fbbf24" }} /></div>
                <div className="meterScale"><span>0%</span><span>50%</span><span>100%</span></div>
                <div className="sub" style={{ marginTop:4 }}>3-mo: deteriorating</div>
                <span className="pillA">Weakening</span>
              </div>
              <div className="tile">
                <div className="lbl">% Above 50-DMA</div>
                <div style={{ fontSize:26, fontWeight:700, color:"#fff" }}>31%</div>
                <div className="bbar"><div className="bbarFill" style={{ width:"31%", background:"#ff6b88" }} /></div>
                <div className="meterScale"><span>0%</span><span>50%</span><span>100%</span></div>
                <div className="sub" style={{ marginTop:4 }}>3-mo: sharp decline</div>
                <span className="pillR">Bearish</span>
              </div>
              <div className="tile">
                <div className="lbl">NYSE Adv / Dec</div>
                <div style={{ fontSize:26, fontWeight:700, color:"#fff", marginTop:4 }}>-412</div>
                <div className="sub" style={{ marginTop:6 }}>More declines than advances</div>
                <span className="pillR">Weak</span>
              </div>
              <div className="tile">
                <div className="lbl">52-Wk Highs / Lows</div>
                <div style={{ fontSize:26, fontWeight:700, color:"#fff", marginTop:4 }}>48 / <span style={{ color:"#fff" }}>187</span></div>
                <div className="sub" style={{ marginTop:4 }}>3-mo: lows dominating</div>
                <span className="pillR">Bearish</span>
              </div>
              <div className="tile">
                <div className="lbl">McClellan Oscillator</div>
                <div style={{ fontSize:26, fontWeight:700, color:"#fff", marginTop:4 }}>-42</div>
                <div className="meterTrack"><div className="meterFill" style={{ width:"29%", background:"#ff6b88" }} /><div className="meterMarker" style={{ left:"29%" }} /></div>
                <div className="meterScale"><span>-100</span><span>0</span><span>+100</span></div>
                <span className="pillA">Oversold</span>
              </div>
            </div>
            <div className="grid5">
              <div className="tile">
                <div className="lbl">% Above 100-DMA</div>
                <div style={{ fontSize:26, fontWeight:700, color:"#fff" }}>38%</div>
                <div className="bbar"><div className="bbarFill" style={{ width:"38%", background:"#ff6b88" }} /></div>
                <div className="meterScale"><span>0%</span><span>50%</span><span>100%</span></div>
                <div className="sub" style={{ marginTop:4 }}>3-mo: declining</div>
                <span className="pillR">Bearish</span>
              </div>
              <div className="tile">
                <div className="lbl">% Above 20-DMA</div>
                <div style={{ fontSize:26, fontWeight:700, color:"#fff" }}>28%</div>
                <div className="bbar"><div className="bbarFill" style={{ width:"28%", background:"#ff6b88" }} /></div>
                <div className="meterScale"><span>0%</span><span>50%</span><span>100%</span></div>
                <div className="sub" style={{ marginTop:4 }}>3-mo: capitulating</div>
                <span className="pillR">Oversold</span>
              </div>
            </div>
          </section>

          {/* ⑦ VTI */}
          <section className="panel">
            <div className="panelHeader"><div><div className="panelTitle">VTI — Total Market Trend</div><div className="panelSub">Vanguard Total Market ETF · Key Moving Averages</div></div><div className="pstamp">LIVE · Yahoo Finance</div></div>
            <div className="grid5">
              <div className="tile">
                <div className="tileTop"><span className="lbl">VTI</span><span className="ytd">-2.4% YTD</span></div>
                <div className="valHero">238.14</div>
                <div className="sparkWrap" dangerouslySetInnerHTML={{ __html: sparkline([248,245,244,244,241,242,240,237,238,238,237,235,234,238],"#ff6b88") }} />
                <div className="subSpx">▲ 0.3% today</div>
              </div>
              {[{ label:"20-DMA", val:"242.80", sub:"VTI -1.9% below" }, { label:"50-DMA", val:"244.60", sub:"VTI -2.7% below" }, { label:"100-DMA", val:"241.10", sub:"VTI -1.2% below" }].map(d => (
                <div key={d.label} className="tile">
                  <div className="tileTop"><span className="lbl">{d.label}</span><span className="badge" style={{ background:"#ff4f72", color:"#fff" }}>!</span></div>
                  <div className="valMuted">{d.val}</div>
                  <div className="status" style={{ color:"#ff6b88" }}>Bearish</div>
                  <div className="sub">{d.sub}</div>
                </div>
              ))}
              <div className="tile tile200">
                <div className="tileTop"><span className="lbl" style={{ color:"#f59e0b" }}>200-DMA</span><span className="badge" style={{ background:"#f59e0b", color:"#000" }}>!</span></div>
                <div className="valHero">231.40</div>
                <div className="status" style={{ color:"#fbbf24" }}>Testing Support</div>
                <div className="sub" style={{ color:"#f59e0b" }}>VTI +2.9% above</div>
              </div>
            </div>
          </section>

          {/* ⑧ VALUATION */}
          <section className="panel">
            <div className="panelHeader">
              <div><div className="panelTitle">Valuation, Recession &amp; Sentiment Models</div><div className="panelSub">Sigma scores vs historical norm · Standard deviation from mean</div></div>
              <div style={{ textAlign:"right" }}><div className="pstamp">Updated Apr 30 · Next: May 8</div><div style={{ fontSize:10, color:"#334155", marginTop:2 }}>Manual weekly · Saturday</div></div>
            </div>

            {/* Valuation Models */}
            <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", color:"#334155", marginBottom:6 }}>Valuation Models</div>
            <table className="valTable" style={{ marginBottom:8 }}>
              <thead><tr><th style={{ width:"45%", textAlign:"left" }}>Model</th><th style={{ textAlign:"left" }}>Rating</th><th style={{ textAlign:"right" }}>Score (σ)</th></tr></thead>
              <tbody>
                {[
                  { name:"Buffett Indicator",      rating:"Strongly Overvalued", score:"2.49", color:"#ff6b88" },
                  { name:"Price/Earnings (CAPE)",  rating:"Strongly Overvalued", score:"2.24", color:"#ff6b88" },
                  { name:"Price/Sales",            rating:"Strongly Overvalued", score:"2.30", color:"#ff6b88" },
                  { name:"Interest Rate Model",    rating:"Overvalued",          score:"1.88", color:"#fbbf24" },
                  { name:"S&P 500 Mean Reversion", rating:"Strongly Overvalued", score:"2.36", color:"#ff6b88" },
                  { name:"Earnings Yield Gap",     rating:"Fairly Valued",       score:"0.38", color:"#94a3b8", muted:true },
                ].map(r => (
                  <tr key={r.name} style={{ opacity:(r as any).muted?0.4:1 }}>
                    <td style={{ fontWeight:600, color:"#cbd5e1", fontSize:13, fontStyle:(r as any).muted?"italic":"normal" }}>{r.name}</td>
                    <td style={{ fontWeight:700, color:r.color, fontSize:13 }}>{r.rating}</td>
                    <td style={{ fontWeight:700, color:r.color, fontSize:15, textAlign:"right" }}>{r.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="sumBar" style={{ marginBottom:16 }}>
              <span className="sumBarLabel">Valuation Signal</span>
              <span style={{ fontSize:12, fontWeight:700, color:"#ff6b88" }}>5 of 5 models overvalued · Apr 30</span>
              <span style={{ fontSize:12, color:"#475569" }}>·</span>
              <span style={{ fontSize:12, color:"#94a3b8" }}>Buffett Indicator and Mean Reversion re-elevated to Strongly Overvalued despite the March selloff. Margin of safety remains thin.</span>
            </div>

            {/* Recession Models */}
            <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", color:"#334155", marginBottom:6 }}>Recession Models</div>
            <table className="valTable" style={{ marginBottom:8 }}>
              <thead><tr><th style={{ width:"45%", textAlign:"left" }}>Model</th><th style={{ textAlign:"left" }}>Rating</th><th style={{ textAlign:"right" }}>Score (σ)</th></tr></thead>
              <tbody>
                {[
                  { name:"Yield Curve",       rating:"Very High Risk",  score:"2.56", color:"#ff6b88",  updated:"Apr 30" },
                  { name:"Sahm Rule",         rating:"Normal",          score:"N/A",  color:"#4ade80",  updated:"Mar 31" },
                  { name:"State Coincidence", rating:"Normal",          score:"0.64", color:"#4ade80",  updated:"Feb 28" },
                ].map(r => (
                  <tr key={r.name}>
                    <td style={{ fontWeight:600, color:"#cbd5e1", fontSize:13 }}>
                      {r.name}
                      <span style={{ fontSize:10, color:"#475569", marginLeft:8 }}>{r.updated}</span>
                    </td>
                    <td style={{ fontWeight:700, color:r.color, fontSize:13 }}>{r.rating}</td>
                    <td style={{ fontWeight:700, color:r.color, fontSize:15, textAlign:"right" }}>{r.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="sumBar" style={{ marginBottom:16 }}>
              <span className="sumBarLabel">Recession Signal</span>
              <span style={{ fontSize:12, fontWeight:700, color:"#fbbf24" }}>Mixed — Yield Curve elevated</span>
              <span style={{ fontSize:12, color:"#475569" }}>·</span>
              <span style={{ fontSize:12, color:"#94a3b8" }}>Yield Curve at 2.56σ — re-steepening after inversion historically precedes recession 12–18 months out. Sahm Rule and State Coincidence not yet confirming.</span>
            </div>

            {/* Sentiment Models */}
            <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", color:"#334155", marginBottom:6 }}>Sentiment Models</div>

            <table className="valTable" style={{ marginBottom:8 }}>
              <thead><tr><th style={{ width:"45%", textAlign:"left" }}>Model</th><th style={{ textAlign:"left" }}>Rating</th><th style={{ textAlign:"right" }}>Score (σ)</th></tr></thead>
              <tbody>
                {[
                  { name:"Economic Uncertainty Index", rating:"Very Pessimistic", score:"3.43",  color:"#4ade80", updated:"Apr 30", note:"contrarian bullish" },
                  { name:"Consumer Confidence",        rating:"Very Pessimistic", score:"-2.80", color:"#4ade80", updated:"Apr 24", note:"contrarian bullish" },
                  { name:"Margin Debt",                rating:"Optimistic",       score:"1.18",  color:"#fbbf24", updated:"Mar 31", note:"still elevated" },
                  { name:"Junk Bond Spreads",          rating:"Neutral",          score:"0.95",  color:"#94a3b8", updated:"Apr 30", note:"CDX warning active" },
                  { name:"VIX Index",                  rating:"Neutral",          score:"-0.32", color:"#94a3b8", updated:"Apr 30", note:"below 30 trigger" },
                ].map(r => (
                  <tr key={r.name}>
                    <td style={{ fontWeight:600, color:"#cbd5e1", fontSize:13 }}>
                      {r.name}
                      <span style={{ fontSize:10, color:"#475569", marginLeft:8 }}>{r.updated}</span>
                    </td>
                    <td>
                      <span style={{ fontWeight:700, color:r.color, fontSize:13 }}>{r.rating}</span>
                      <span style={{ fontSize:10, color:"#475569", marginLeft:8, fontStyle:"italic" }}>{r.note}</span>
                    </td>
                    <td style={{ fontWeight:700, color:r.color, fontSize:15, textAlign:"right" }}>{r.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="sumBar">
              <span className="sumBarLabel">Sentiment Signal</span>
              <span style={{ fontSize:12, fontWeight:700, color:"#4ade80" }}>Extreme Pessimism — Contrarian Bullish · Apr 30</span>
              <span style={{ fontSize:12, color:"#475569" }}>·</span>
              <span style={{ fontSize:12, color:"#94a3b8" }}>Economic Uncertainty spiked to 5.37σ — historically extreme fear reading. Consumer Confidence deeply negative. Both are contrarian bullish signals. VIX and Junk Bond Spreads eased back to Neutral.</span>
            </div>
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
                        {confirmedCash.length} position{confirmedCash.length > 1 ? "s" : ""} flipped to Cash — Mar 31 official signal
                      </div>
                      <div style={{ fontSize:12, color:"#fca5a5", lineHeight:1.6 }}>
                        <strong>{confirmedCash.join(", ")}</strong> closed below their 10-month SMA at Mar 31 month-end. Ivy rule now signals <strong>Cash</strong> for these positions. Signal valid until Apr 30 close. Next action: monitor {ivyEOMDate} for potential re-entry if price reclaims SMA.
                      </div>
                    </div>
                  </div>
                )}
                {pendingRisk.length > 0 && (
                  <div style={{ background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.3)", borderRadius:10, padding:"10px 14px", marginTop:8, display:"flex", alignItems:"flex-start", gap:10 }}>
                    <span style={{ fontSize:15, flexShrink:0 }}>⚠️</span>
                    <div>
                      <div style={{ fontSize:12, fontWeight:700, color:"#fbbf24", marginBottom:3 }}>Apr 30 flip risk</div>
                      <div style={{ fontSize:12, color:"#94a3b8", lineHeight:1.6 }}>
                        <strong>{pendingRisk.map(p => p.ticker).join(", ")}</strong> currently trading below SMA but officially still Invested. If below at Apr 30 close, signal flips to Cash.
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

          {/* ⑨ AI STRATEGIST */}
          <section className="panel panelAI">
            <div className="aiHeader">
              <div className="aiIcon">✦</div>
              <div><div className="panelTitle">AI Wealth Strategist</div><div className="aiSub">Roberts · Marks · Druckenmiller · Buffett · Dalio · Hussman · Stack · Rieder · Grantham · Leyden · Noland · Slegers · Zeberg</div></div>
            </div>
            <div className="aiTabs">
              {(["summary","action","triggers","chat"] as const).map(t => (
                <button key={t} className={`aiTab${aiTab===t?" aiTabOn":""}`} onClick={() => handleAiTab(t)}>
                  {{ summary:"Market Summary", action:"Recommended Action", triggers:"Trigger Watch", chat:"Ask a Question" }[t]}
                </button>
              ))}
              {aiTab !== "chat" && <button className="aiTab" onClick={refreshAiTab} style={{ marginLeft:"auto", opacity:aiLoading?0.4:1 }} disabled={aiLoading}>↺ Refresh</button>}
            </div>
            {aiTab !== "chat" ? (
              <div className="aiOut">{aiLoading && !aiCache[aiTab] ? <><span className="spinner" /> Analyzing...</> : (aiCache[aiTab] ?? "")}</div>
            ) : (
              <div>
                <div className="chatHist">
                  {chatHistory.map((m,i) => <div key={i} className={m.role==="user"?"msgUser":"msgAI"}>{m.text}</div>)}
                  {aiLoading && <div className="msgAI"><span className="spinner" /> Thinking...</div>}
                </div>
                <div className="chatRow">
                  <input className="chatInp" value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendChat()} placeholder="Ask about your dashboard..." />
                  <button className="chatBtn" onClick={sendChat} disabled={aiLoading}>Ask ↗</button>
                </div>
              </div>
            )}
          </section>

        </div>
      </div>

      {/* MODALS */}
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
              <Tag label={erpBps==null?"Loading":erpBps<200?"Danger — Near Zero":erpBps<500?"Watch — Below 5%":"Healthy Premium"} color={erpBps==null?"#475569":erpBps<200?"#ff6b88":erpBps<500?"#fbbf24":"#4ade80"} bg={erpBps==null?"rgba(148,163,184,0.12)":erpBps<200?"rgba(255,79,114,0.15)":erpBps<500?"rgba(245,158,11,0.15)":"rgba(74,222,128,0.15)"} />
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
              <BC>At {capeRatio.toFixed(1)}x, CAPE is {(capeRatio/16).toFixed(1)}x the historical average of ~16x. Only the 2000 dot-com peak ({">"}44x) and late 2021 (~38x) have been higher. This level has historically preceded below-average 10-year forward returns.</BC>
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
                adLine?.signal==="bullish_divergence"?"#4ade80":adLine?.signal==="confirming_weakness"?"#ff6b88":"#fbbf24" }}>
                {adLine?.signal==="bullish_divergence"?"Bullish Divergence ↑":adLine?.signal==="confirming_weakness"?"Confirming Weakness ↓":"Neutral — Tracking"}
              </div>
              <Tag
                label={adLine?.signal==="bullish_divergence"?"Hidden Strength — Buy the Dip Setup":adLine?.signal==="confirming_weakness"?"Broad Selling — Defense Mode":"Neutral — Moving With SPX"}
                color={adLine?.signal==="bullish_divergence"?"#4ade80":adLine?.signal==="confirming_weakness"?"#ff6b88":"#fbbf24"}
                bg={adLine?.signal==="bullish_divergence"?"rgba(74,222,128,0.15)":adLine?.signal==="confirming_weakness"?"rgba(255,79,114,0.15)":"rgba(245,158,11,0.15)"}
              />
              <BC>{adLine?.note ?? "NYSE Advance/Decline line shows whether breadth is confirming or diverging from price."}</BC>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:14 }}>
                <div style={{ background:"#141b47", borderRadius:10, padding:14 }}>
                  <SH>A/D Trend (4 weeks)</SH>
                  <div style={{ fontSize:20, fontWeight:700, marginTop:6, color:
                    adLine?.adTrend==="higher_lows"?"#4ade80":adLine?.adTrend==="lower_lows"?"#ff6b88":"#fbbf24" }}>
                    {adLine?.adTrend==="higher_lows"?"↗ Higher Lows":adLine?.adTrend==="lower_lows"?"↘ Lower Lows":"→ Flat"}
                  </div>
                  <div style={{ fontSize:11, color:"#64748b", marginTop:4, lineHeight:1.5 }}>
                    {adLine?.adTrend==="higher_lows"?"Breadth improving — broad participation":"Breadth deteriorating — narrow market"}
                  </div>
                </div>
                <div style={{ background:"#141b47", borderRadius:10, padding:14 }}>
                  <SH>vs SPX</SH>
                  <div style={{ fontSize:20, fontWeight:700, marginTop:6, color:
                    adLine?.adVsSpx==="diverging_up"?"#4ade80":adLine?.adVsSpx==="diverging_down"?"#ff6b88":"#94a3b8" }}>
                    {adLine?.adVsSpx==="diverging_up"?"↑ Diverging Up":adLine?.adVsSpx==="diverging_down"?"↓ Confirming Down":"→ Tracking"}
                  </div>
                  <div style={{ fontSize:11, color:"#64748b", marginTop:4, lineHeight:1.5 }}>
                    {adLine?.adVsSpx==="diverging_up"?"A/D strong while SPX weak — dip opportunity":adLine?.adVsSpx==="diverging_down"?"Broad selling confirms move — not a dip":"Breadth and price aligned"}
                  </div>
                </div>
              </div>
              <div style={{ marginTop:12, background:"#141b47", border:"1px solid rgba(148,163,184,0.2)", borderRadius:10, padding:12 }}>
                <div style={{ fontSize:10, color:"#475569", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em" }}>Data source</div>
                <div style={{ fontSize:12, color:"#94a3b8", marginTop:4, lineHeight:1.6 }}>
                  Manual weekly update · NYSE $NYAD via StockCharts · Updated {adLine?.updatedDate ?? "—"}
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
                  <HistRow val="Today" event={`Mar ${adLine?.updatedDate ?? "21"} 2026`} note={adLine?.note ?? "Manual reading"} active />
                </div>
              </MCard>
              <ActionCard>
                {adLine?.signal==="bullish_divergence"
                  ?"A/D line diverging bullishly — the broad market is holding up even as SPX tests the 200-DMA. This is a classic head-fake signal. The large-cap weakness may not reflect what most stocks are doing. Treat as a potential dip opportunity, not a defensive trigger."
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
        .panelAI{background:#0a1628;border:1px solid rgba(99,179,237,0.2);}
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
        .aiHeader{display:flex;align-items:center;gap:10px;margin-bottom:12px;}
        .aiIcon{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;}
        .aiSub{font-size:11px;color:#475569;margin-top:1px;}
        .aiTabs{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;}
        .aiTab{padding:5px 12px;border-radius:20px;font-size:12px;font-weight:600;border:1px solid rgba(255,255,255,0.1);background:transparent;color:#94a3b8;cursor:pointer;}
        .aiTabOn{background:rgba(59,130,246,0.2)!important;border-color:rgba(59,130,246,0.4)!important;color:#93c5fd!important;}
        .aiOut{background:#060e1c;border-radius:10px;padding:14px;font-size:13px;line-height:1.7;color:#cbd5e1;min-height:80px;white-space:pre-wrap;}
        .chatHist{display:flex;flex-direction:column;gap:7px;margin-bottom:8px;max-height:220px;overflow-y:auto;}
        .msgUser{align-self:flex-end;background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.2);border-radius:10px;padding:7px 11px;font-size:13px;color:#bfdbfe;max-width:80%;}
        .msgAI{align-self:flex-start;background:#060e1c;border-radius:10px;padding:7px 11px;font-size:13px;color:#cbd5e1;max-width:90%;white-space:pre-wrap;line-height:1.6;}
        .chatRow{display:flex;gap:8px;margin-top:10px;}
        .chatInp{flex:1;background:#060e1c;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:9px 12px;color:#fff;font-size:13px;font-family:inherit;outline:none;}
        .chatBtn{background:rgba(59,130,246,0.2);border:1px solid rgba(59,130,246,0.4);border-radius:8px;color:#93c5fd;padding:9px 16px;font-size:13px;font-weight:600;cursor:pointer;}
        .chatBtn:disabled{opacity:0.5;cursor:not-allowed;}
        .spinner{display:inline-block;width:11px;height:11px;border:2px solid rgba(255,255,255,0.15);border-top-color:#93c5fd;border-radius:50%;animation:spin .7s linear infinite;margin-right:5px;vertical-align:middle;}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:900px){.title{font-size:22px;}.valHero{font-size:28px;}}
        @media(max-width:700px){.topBar,.panelHeader{flex-direction:column;align-items:flex-start;}.grid5,.grid4{grid-template-columns:repeat(2,minmax(0,1fr));}.grid3{grid-template-columns:1fr;}.alertStrip,.alertStripCritical{flex-direction:column;align-items:flex-start;gap:4px;}}
      `}} />
    </>
  );
}
