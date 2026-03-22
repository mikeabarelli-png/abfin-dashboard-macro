import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

const BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const FRED = "https://api.stlouisfed.org/fred/series/observations";
const TIMEOUT_MS = 9000;

function avg(arr: number[]): number {
  const clean = arr.filter((n) => Number.isFinite(n));
  return clean.reduce((s, n) => s + n, 0) / clean.length;
}

async function fetchChart(
  ticker: string,
  days: number
): Promise<{ closes: number[]; meta: Record<string, any>; error?: string }> {
  const end = Math.floor(Date.now() / 1000);
  const start = end - days * 24 * 60 * 60;
  const url = `${BASE}/${encodeURIComponent(ticker)}?period1=${start}&period2=${end}&interval=1d&includePrePost=false`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    console.log(`Fetching ${ticker} chart...`);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json",
      },
    });
    console.log(`${ticker} status: ${res.status}`);
    if (!res.ok) {
      const preview = await res.text().catch(() => "");
      console.error(`${ticker} error body: ${preview.slice(0, 200)}`);
      return { closes: [], meta: {}, error: `Yahoo ${ticker}: HTTP ${res.status}` };
    }
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return { closes: [], meta: {}, error: `${ticker}: no chart result` };
    const rawCloses: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
    const closes = rawCloses
      .filter((c): c is number => c != null && Number.isFinite(c))
      .map((c) => Math.round(c * 100) / 100);
    console.log(`${ticker} closes: ${closes.length} points`);
    return { closes, meta: result.meta ?? {} };
  } catch (err: any) {
    const msg = err?.name === "AbortError" ? `${ticker}: request timed out` : `${ticker}: ${err?.message}`;
    console.error(msg);
    return { closes: [], meta: {}, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFred(seriesId: string, limit = 1): Promise<{ value: number | null; prev: number | null; error?: string }> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) return { value: null, prev: null, error: "FRED_API_KEY not set" };
  const url = `${FRED}?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=${limit}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return { value: null, prev: null, error: `FRED ${seriesId}: HTTP ${res.status}` };
    const data = await res.json();
    const obs = data?.observations ?? [];
    const val  = obs[0]?.value && obs[0].value !== "." ? parseFloat(obs[0].value) : null;
    const prev = limit >= 2 && obs[1]?.value && obs[1].value !== "." ? parseFloat(obs[1].value) : null;
    console.log(`FRED ${seriesId}: ${val}${prev != null ? ` (prev: ${prev})` : ""}`);
    return { value: val, prev };
  } catch (err: any) {
    return { value: null, prev: null, error: `FRED ${seriesId}: ${err?.message}` };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPE(): Promise<{ value: number | null; error?: string }> {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=%5EGSPC&fields=trailingPE,forwardPE`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json",
      },
    });
    if (!res.ok) return { value: null, error: `Yahoo v7 PE: HTTP ${res.status}` };
    const data = await res.json();
    const result = data?.quoteResponse?.result?.[0];
    const pe = result?.trailingPE ?? result?.forwardPE ?? null;
    console.log(`PE ratio: ${pe}`);
    return { value: pe };
  } catch (err: any) {
    return { value: null, error: `PE fetch: ${err?.message}` };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchCape(): Promise<{ value: number | null; error?: string }> {
  const apiKey = process.env.NASDAQ_API_KEY;
  if (!apiKey) return { value: null, error: "NASDAQ_API_KEY not set" };
  const url = `https://data.nasdaq.com/api/v3/datasets/MULTPL/SP500_SHILLER_PE_RATIO_MONTH.json?rows=1&api_key=${apiKey}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return { value: null, error: `Nasdaq CAPE: HTTP ${res.status}` };
    const data = await res.json();
    // Response shape: { dataset: { data: [["2026-03-01", 40.2], ...] } }
    const latest = data?.dataset?.data?.[0]?.[1];
    const val = latest != null ? parseFloat(latest) : null;
    console.log(`CAPE: ${val}`);
    return { value: val };
  } catch (err: any) {
    return { value: null, error: `CAPE fetch: ${err?.message}` };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFearGreed(): Promise<{ value: number | null; rating: string | null; error?: string }> {
  // CNN Fear & Greed Index — undocumented endpoint, may break without notice
  // Falls back to MANUAL_FEAR_GREED_FALLBACK if unavailable
  const url = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json",
        "Referer": "https://www.cnn.com/",
        "Origin": "https://www.cnn.com",
      },
    });
    if (!res.ok) return { value: null, rating: null, error: `CNN F&G: HTTP ${res.status}` };
    const data = await res.json();
    const score = data?.fear_and_greed?.score;
    const rating = data?.fear_and_greed?.rating;
    const value = score != null ? Math.round(parseFloat(score)) : null;
    console.log(`Fear & Greed: ${value} (${rating})`);
    return { value, rating: rating ?? null };
  } catch (err: any) {
    return { value: null, rating: null, error: `Fear & Greed: ${err?.message}` };
  } finally {
    clearTimeout(timer);
  }
}

// ── Ivy Portfolio — 10-month SMA computation ─────────────────────────────────
// Fetches ~220 calendar days of daily closes, identifies the last trading day
// of each of the past 10 calendar months, averages those 10 month-end closes.
// The Ivy rule: if month-end close > 10-mo SMA → Invest; otherwise → Cash.

function computeMonthEndSma(
  closes: number[],
  timestamps: number[],  // Unix seconds, one per close
  months: number = 10
): { sma: number | null; monthEndCloses: number[] } {
  if (closes.length < months || timestamps.length !== closes.length) {
    return { sma: null, monthEndCloses: [] };
  }

  // Build map: "YYYY-MM" → last close in that month
  const monthMap: Record<string, number> = {};
  for (let i = 0; i < closes.length; i++) {
    const d = new Date(timestamps[i] * 1000);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    monthMap[key] = closes[i]; // later entries overwrite earlier → last trading day wins
  }

  // Sort keys descending, take the most recent `months` months
  const sortedKeys = Object.keys(monthMap).sort().reverse();
  const recentKeys = sortedKeys.slice(0, months);
  if (recentKeys.length < months) return { sma: null, monthEndCloses: [] };

  const monthEndCloses = recentKeys.map(k => monthMap[k]);
  const sma = monthEndCloses.reduce((s, v) => s + v, 0) / months;
  return { sma: Math.round(sma * 100) / 100, monthEndCloses };
}

async function fetchIvyPosition(ticker: string): Promise<{
  price: number | null;
  sma: number | null;
  variancePct: number | null;
  signal: "Invest" | "Cash" | null;
  error?: string;
}> {
  // 320 calendar days ≈ 220 trading days ≈ 10.5 months — enough for 10 full month-ends
  const end = Math.floor(Date.now() / 1000);
  const start = end - 320 * 24 * 60 * 60;
  const url = `${BASE}/${encodeURIComponent(ticker)}?period1=${start}&period2=${end}&interval=1d&includePrePost=false`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json",
      },
    });
    if (!res.ok) return { price: null, sma: null, variancePct: null, signal: null, error: `Yahoo ${ticker}: HTTP ${res.status}` };
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return { price: null, sma: null, variancePct: null, signal: null, error: `${ticker}: no result` };

    const timestamps: number[] = result.timestamp ?? [];
    const rawCloses: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
    const closes = rawCloses.map((c, i) => ({ c, t: timestamps[i] }))
      .filter(x => x.c != null && Number.isFinite(x.c!))
      .map(x => ({ c: Math.round(x.c! * 100) / 100, t: x.t }));

    if (closes.length < 20) return { price: null, sma: null, variancePct: null, signal: null, error: `${ticker}: insufficient data` };

    const price = result.meta.regularMarketPrice ?? closes[closes.length - 1].c;
    const { sma } = computeMonthEndSma(closes.map(x => x.c), closes.map(x => x.t));

    if (sma == null || price == null) return { price, sma: null, variancePct: null, signal: null };

    const variancePct = Math.round(((price - sma) / sma) * 1000) / 10; // 1 decimal
    const signal: "Invest" | "Cash" = price >= sma ? "Invest" : "Cash";
    console.log(`Ivy ${ticker}: price=${price} sma=${sma} variance=${variancePct}% → ${signal}`);
    return { price, sma, variancePct, signal };
  } catch (err: any) {
    const msg = err?.name === "AbortError" ? `${ticker}: timeout` : `${ticker}: ${err?.message}`;
    return { price: null, sma: null, variancePct: null, signal: null, error: msg };
  } finally {
    clearTimeout(timer);
  }
}
// ─────────────────────────────────────────────────────────────────────────────

export async function GET() {
  const diagnostics: Record<string, string> = {};

  // 420 calendar days = ~290 trading days — enough for full 200-DMA on 1Y chart
  const [spx, vix, dxy, putCall, fredReal10y, fredNom10y, fredHY, fredYC, fredFedFunds, fredBreakeven, peData, capeData, fearGreedData, ivyVTI, ivyVEU, ivyIEF, ivyVNQ, ivyDBC, fredWALCL] = await Promise.all([
    fetchChart("^GSPC", 420),
    fetchChart("^VIX", 5),
    fetchChart("DX-Y.NYB", 5),
    fetchChart("^CPCE", 5),
    fetchFred("DFII10"),
    fetchFred("DGS10"),
    fetchFred("BAMLH0A0HYM2"),
    fetchFred("T10Y2Y"),
    fetchFred("FEDFUNDS"),
    fetchFred("T5YIE"),
    fetchPE(),
    fetchCape(),
    fetchFearGreed(),
    fetchIvyPosition("VTI"),
    fetchIvyPosition("VEU"),
    fetchIvyPosition("IEF"),
    fetchIvyPosition("VNQ"),
    fetchIvyPosition("DBC"),
    fetchFred("WALCL", 2),  // Fed balance sheet: millions USD, weekly; limit=2 for direction
  ]);

  if (spx.error) diagnostics["spx"] = spx.error;
  if (vix.error) diagnostics["vix"] = vix.error;
  if (dxy.error) diagnostics["dxy"] = dxy.error;
  if (putCall.error) diagnostics["putcall"] = putCall.error;
  if (fredReal10y.error) diagnostics["real10y"] = fredReal10y.error;
  if (fredNom10y.error) diagnostics["nom10y"] = fredNom10y.error;
  if (fredHY.error) diagnostics["hy"] = fredHY.error;
  if (fredYC.error) diagnostics["yc"] = fredYC.error;
  if (fredFedFunds.error) diagnostics["fedfunds"] = fredFedFunds.error;
  if (fredBreakeven.error) diagnostics["breakeven"] = fredBreakeven.error;
  if (peData.error) diagnostics["pe"] = peData.error;
  if (capeData.error) diagnostics["cape"] = capeData.error;
  if (fearGreedData.error) diagnostics["feargreed"] = fearGreedData.error;
  if (ivyVTI.error) diagnostics["ivy_vti"] = ivyVTI.error;
  if (ivyVEU.error) diagnostics["ivy_veu"] = ivyVEU.error;
  if (ivyIEF.error) diagnostics["ivy_ief"] = ivyIEF.error;
  if (ivyVNQ.error) diagnostics["ivy_vnq"] = ivyVNQ.error;
  if (ivyDBC.error) diagnostics["ivy_dbc"] = ivyDBC.error;
  if (fredWALCL.error) diagnostics["walcl"] = fredWALCL.error;

  // Fed Balance Sheet (WALCL) — in millions USD from FRED
  // Convert to billions for display; compute WoW change
  const walclMil: number | null = fredWALCL.value;          // e.g. 6,800,000 (millions)
  const walclPrevMil: number | null = fredWALCL.prev;
  const walclBn: number | null  = walclMil  != null ? Math.round(walclMil  / 1000) : null;  // billions
  const walclPrevBn: number | null = walclPrevMil != null ? Math.round(walclPrevMil / 1000) : null;
  const walclChgBn: number | null  = walclBn != null && walclPrevBn != null ? walclBn - walclPrevBn : null;
  const walclDirection: "expanding" | "contracting" | "flat" | null =
    walclChgBn == null ? null :
    walclChgBn >  10 ? "expanding" :
    walclChgBn < -10 ? "contracting" : "flat";
  console.log(`WALCL: $${walclBn}B (chg: ${walclChgBn}B → ${walclDirection})`);

  const spxCloses = spx.closes;
  const spxPrice: number | null = spx.meta.regularMarketPrice ?? spxCloses[spxCloses.length - 1] ?? null;
  const spxPrevClose: number | null =
    spxCloses.length >= 2 ? spxCloses[spxCloses.length - 2] : spx.meta.chartPreviousClose ?? null;
  const spxChangePct: number | null =
    spxPrice != null && spxPrevClose != null
      ? ((spxPrice - spxPrevClose) / spxPrevClose) * 100
      : null;

  function avg(arr: number[]) {
    const clean = arr.filter((n) => Number.isFinite(n));
    return clean.reduce((s, n) => s + n, 0) / clean.length;
  }

  const spx20dma = spxCloses.length >= 20 ? avg(spxCloses.slice(-20)) : null;
  const spx50dma = spxCloses.length >= 50 ? avg(spxCloses.slice(-50)) : null;
  const spx100dma = spxCloses.length >= 100 ? avg(spxCloses.slice(-100)) : null;
  const spx200dma = spxCloses.length >= 200 ? avg(spxCloses.slice(-200)) : null;
  const spxTrend14d = spxCloses.slice(-14);

  // ── DMA Slopes: compare current DMA to same DMA from N days ago ──
  // 20-DMA slope: compare to 10 trading days ago
  const spx20dma_prev = spxCloses.length >= 30 ? avg(spxCloses.slice(-30, -10)) : null;
  const spx20slope = spx20dma != null && spx20dma_prev != null
    ? ((spx20dma - spx20dma_prev) / spx20dma_prev) * 100 : null;

  // 50-DMA slope: compare to 20 trading days ago
  const spx50dma_prev = spxCloses.length >= 70 ? avg(spxCloses.slice(-70, -20)) : null;
  const spx50slope = spx50dma != null && spx50dma_prev != null
    ? ((spx50dma - spx50dma_prev) / spx50dma_prev) * 100 : null;

  // 200-DMA slope: compare to 20 trading days ago (most important)
  const spx200dma_prev = spxCloses.length >= 220 ? avg(spxCloses.slice(-220, -20)) : null;
  const spx200slope = spx200dma != null && spx200dma_prev != null
    ? ((spx200dma - spx200dma_prev) / spx200dma_prev) * 100 : null;

  // ── Market Regime Classification ──
  // Uses price vs 200-DMA AND slope of 200-DMA
  const aboveDma200 = spxPrice != null && spx200dma != null && spxPrice > spx200dma;
  const dma200Rising = spx200slope != null && spx200slope > 0.02; // >0.02% in 20 days = rising
  const dma200Falling = spx200slope != null && spx200slope < -0.02;

  type Regime = "bull" | "transition_above" | "transition_below" | "bear";
  const regime: Regime =
    aboveDma200 && dma200Rising  ? "bull"
    : aboveDma200 && !dma200Rising ? "transition_above"
    : !aboveDma200 && dma200Rising ? "transition_below"
    : "bear";

  const regimeLabel: Record<Regime, string> = {
    bull:               "Bull Trend",
    transition_above:   "Transition — Weakening",
    transition_below:   "Transition — Pullback",
    bear:               "Bear Trend",
  };
  const regimeDesc: Record<Regime, string> = {
    bull:             "SPX above rising 200-DMA. Trend intact. Dips are buyable.",
    transition_above: "SPX above 200-DMA but slope flattening or falling. Bull trend losing momentum — watch closely.",
    transition_below: "SPX below 200-DMA but DMA still rising. Pullback within a bull structure — not yet a structural break. Classic head-fake zone.",
    bear:             "SPX below a falling 200-DMA. Structural bear trend confirmed. Rallies are suspect.",
  };
  const regimeColor: Record<Regime, string> = {
    bull: "#4ade80", transition_above: "#fbbf24", transition_below: "#fbbf24", bear: "#ff6b88"
  };
  const regimeEmoji: Record<Regime, string> = {
    bull: "🟢", transition_above: "🟡", transition_below: "🟡", bear: "🔴"
  };

  const vixPrice: number | null = vix.meta.regularMarketPrice ?? vix.closes[vix.closes.length - 1] ?? null;

  const real10y: number = fredReal10y.value ?? 1.92;
  const nom10y: number = fredNom10y.value ?? 4.30;
  const hySpread: number = fredHY.value ?? 3.28;
  const yieldCurve: number = fredYC.value ?? 0.55;
  const fedFunds: number = fredFedFunds.value ?? 4.33;
  const breakeven5y: number = fredBreakeven.value ?? 2.45;

  // DXY — Dollar Index current price
  const dxyPrice: number | null = dxy.meta.regularMarketPrice ?? dxy.closes[dxy.closes.length - 1] ?? null;
  const dxyPrev: number | null = dxy.closes.length >= 2 ? dxy.closes[dxy.closes.length - 2] : null;
  const dxyChangePct: number | null = dxyPrice != null && dxyPrev != null ? ((dxyPrice - dxyPrev) / dxyPrev) * 100 : null;

  // Put/Call Ratio
  const putCallRatio: number | null = putCall.meta.regularMarketPrice ?? putCall.closes[putCall.closes.length - 1] ?? null;

  const MANUAL_PE_FALLBACK = 24.2; // SPX trailing P/E — update manually each Saturday
  const trailingPE: number | null = peData.value ?? spx.meta.trailingPE ?? MANUAL_PE_FALLBACK;
  let erp: number | null = null;
  if (trailingPE != null && trailingPE > 0) {
    const earningsYield = (1 / trailingPE) * 100;
    erp = Math.round((earningsYield - real10y) * 100);
    console.log(`ERP: ${erp} bps`);
  }

  // CAPE (Shiller P/E) — Nasdaq Data Link, updated monthly
  // Falls back to manual constant if API key missing or fetch fails
  const MANUAL_CAPE_FALLBACK = 40.2; // Last manually verified: Mar 19 2026
  const capeRatio: number = capeData.value ?? MANUAL_CAPE_FALLBACK;

  // NYSE Advance/Decline Line — manually updated weekly (Saturday)
  // Source: stockcharts.com $NYAD or barchart.com — cumulative breadth line
  // signal: "bullish_divergence" | "neutral" | "confirming_weakness"
  // adTrend: direction over last 4 weeks: "higher_lows" | "flat" | "lower_lows"
  // adVsSpx: how A/D is behaving relative to SPX: "diverging_up" | "tracking" | "diverging_down"
  const MANUAL_AD = {
    signal: "confirming_weakness" as "bullish_divergence" | "neutral" | "confirming_weakness",
    adTrend: "lower_lows" as "higher_lows" | "flat" | "lower_lows",
    adVsSpx: "diverging_down" as "diverging_up" | "tracking" | "diverging_down",
    note: "A/D line declining with SPX — broad-based selling",
    updatedDate: "Mar 21",
  };

  // CNN Fear & Greed Index — live fetch with manual fallback
  // Update MANUAL_FEAR_GREED_FALLBACK each Saturday if live fetch fails
  const MANUAL_FEAR_GREED_FALLBACK = 15; // Last manually verified: Mar 20 2026 — Extreme Fear
  const fearGreedScore: number = fearGreedData.value ?? MANUAL_FEAR_GREED_FALLBACK;
  const fearGreedRating: string = fearGreedData.rating ?? "Extreme Fear";

  let spxYtdPct: number | null = null;
  try {
    const now = new Date();
    const daysIntoYear = Math.ceil(
      (now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (1000 * 60 * 60 * 24)
    ) + 10;
    const ytd = await fetchChart("^GSPC", daysIntoYear);
    if (ytd.closes.length > 0 && spxPrice != null) {
      spxYtdPct = ((spxPrice - ytd.closes[0]) / ytd.closes[0]) * 100;
    }
    if (ytd.error) diagnostics["ytd"] = ytd.error;
  } catch (err: any) {
    diagnostics["ytd"] = err?.message ?? "YTD fetch failed";
  }

  const hasPartialData = spxPrice != null;
  const status = Object.keys(diagnostics).length === 0 ? "ok" : hasPartialData ? "partial" : "error";

  return NextResponse.json({
    ok: hasPartialData,
    status,
    source: "LIVE_YAHOO_FRED",
    asOf: new Date().toISOString(),
    diagnostics: Object.keys(diagnostics).length > 0 ? diagnostics : undefined,
    spx_price: spxPrice,
    spx_change_pct: spxChangePct,
    spx_ytd_pct: spxYtdPct,
    spx_trend_14d: spxTrend14d,
    spx_history: spxCloses,
    vix: vixPrice,
    metrics: {
      spx_price: spxPrice,
      spx_change_pct: spxChangePct,
      spx_ytd_pct: spxYtdPct,
      spx_trend_14d: spxTrend14d,
      spx_history: spxCloses,
      vix: vixPrice,
      spx_20dma: { level: spx20dma, slope: spx20slope },
      spx_50dma: { level: spx50dma, slope: spx50slope },
      spx_100dma: { level: spx100dma },
      spx_200dma: { level: spx200dma, slope: spx200slope },
      regime,
      regime_label: regimeLabel[regime],
      regime_desc: regimeDesc[regime],
      regime_color: regimeColor[regime],
      regime_emoji: regimeEmoji[regime],
      hy_spread: hySpread,
      yield_curve_10y_2y: yieldCurve,
      real_10y: real10y,
      nom_10y: nom10y,
      fed_funds: fedFunds,
      breakeven_5y: breakeven5y,
      dxy: dxyPrice,
      dxy_change_pct: dxyChangePct,
      put_call_ratio: putCallRatio,
      erp_bps: erp,
      trailing_pe: trailingPE,
      cape_ratio: capeRatio,
      fear_greed_score: fearGreedScore,
      fear_greed_rating: fearGreedRating,
      ad_line: MANUAL_AD,
      walcl_bn: walclBn,
      walcl_prev_bn: walclPrevBn,
      walcl_chg_bn: walclChgBn,
      walcl_direction: walclDirection,
      ivy: {
        vti: { price: ivyVTI.price, sma: ivyVTI.sma, variance: ivyVTI.variancePct, signal: ivyVTI.signal },
        veu: { price: ivyVEU.price, sma: ivyVEU.sma, variance: ivyVEU.variancePct, signal: ivyVEU.signal },
        ief: { price: ivyIEF.price, sma: ivyIEF.sma, variance: ivyIEF.variancePct, signal: ivyIEF.signal },
        vnq: { price: ivyVNQ.price, sma: ivyVNQ.sma, variance: ivyVNQ.variancePct, signal: ivyVNQ.signal },
        dbc: { price: ivyDBC.price, sma: ivyDBC.sma, variance: ivyDBC.variancePct, signal: ivyDBC.signal },
      },
    },
  }, { status: 200 });
}
