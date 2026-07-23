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
): Promise<{
  closes: number[];
  meta: Record<string, any>;
  timestamps: number[];
  adjcloses: (number | null)[];
  error?: string;
}> {
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
      return { closes: [], meta: {}, timestamps: [], adjcloses: [], error: `Yahoo ${ticker}: HTTP ${res.status}` };
    }
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return { closes: [], meta: {}, timestamps: [], adjcloses: [], error: `${ticker}: no chart result` };
    const rawTimestamps: number[] = result.timestamp ?? [];
    const rawCloses: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
    // Dividend/split-adjusted close — only reliable input for a total-return
    // calculation. NOT used for DMA/slope math, which needs the raw close
    // a chart actually shows.
    const rawAdjCloses: (number | null)[] = result.indicators?.adjclose?.[0]?.adjclose ?? [];

    const closes: number[] = [];
    const timestamps: number[] = [];
    const adjcloses: (number | null)[] = [];
    for (let i = 0; i < rawCloses.length; i++) {
      const c = rawCloses[i];
      if (c != null && Number.isFinite(c)) {
        closes.push(Math.round(c * 100) / 100);
        timestamps.push(rawTimestamps[i]);
        const ac = rawAdjCloses[i];
        adjcloses.push(ac != null && Number.isFinite(ac) ? Math.round(ac * 100) / 100 : null);
      }
    }
    console.log(`${ticker} closes: ${closes.length} points`);
    return { closes, meta: result.meta ?? {}, timestamps, adjcloses };
  } catch (err: any) {
    const msg = err?.name === "AbortError" ? `${ticker}: request timed out` : `${ticker}: ${err?.message}`;
    console.error(msg);
    return { closes: [], meta: {}, timestamps: [], adjcloses: [], error: msg };
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

// Live intraday quote — the chart endpoint's daily closes only update once a
// session settles, so mid-day they can lag by a full trading day for fast-
// moving futures symbols. This endpoint carries an actual real-time quote.
async function fetchLiveQuote(
  ticker: string
): Promise<{ price: number | null; changePct: number | null; error?: string }> {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(ticker)}&fields=regularMarketPrice,regularMarketChangePercent`;
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
    if (!res.ok) return { price: null, changePct: null, error: `Yahoo v7 quote ${ticker}: HTTP ${res.status}` };
    const data = await res.json();
    const result = data?.quoteResponse?.result?.[0];
    const price = typeof result?.regularMarketPrice === "number" ? result.regularMarketPrice : null;
    const changePct = typeof result?.regularMarketChangePercent === "number" ? result.regularMarketChangePercent : null;
    console.log(`${ticker} live quote: $${price} (${changePct?.toFixed(2)}%)`);
    return { price, changePct };
  } catch (err: any) {
    const msg = err?.name === "AbortError" ? `${ticker} live quote: timed out` : `${ticker} live quote: ${err?.message}`;
    return { price: null, changePct: null, error: msg };
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

function computeMonthEndSma(
  closes: number[],
  timestamps: number[],
  months: number = 10
): { sma: number | null; monthEndCloses: number[] } {
  if (closes.length < months || timestamps.length !== closes.length) {
    return { sma: null, monthEndCloses: [] };
  }
  const monthMap: Record<string, number> = {};
  for (let i = 0; i < closes.length; i++) {
    const d = new Date(timestamps[i] * 1000);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    monthMap[key] = closes[i];
  }
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

    const variancePct = Math.round(((price - sma) / sma) * 1000) / 10;
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

// ═══════════════════════════════════════════════════════════════════
// PORTFOLIO POSITION HEALTH — price vs 200-DMA, slope, daily change
// Reuses the exact same avg/slope math already proven on the SPX tiles.
// ═══════════════════════════════════════════════════════════════════

type PositionMetrics = {
  ticker: string;
  price: number | null;
  dailyChangePct: number | null;
  dma200: number | null;
  slope200: number | null;
  pctVs200: number | null;
  ytdReturnPct: number | null;
  error?: string;
};

async function fetchPositionMetrics(ticker: string): Promise<PositionMetrics> {
  // 380 calendar days covers 200 trading days for the DMA itself, plus the
  // extra ~20 trading days of lookback the slope calc needs beyond that.
  // It also comfortably reaches back before Jan 1 of the current year, so
  // the same fetch covers the YTD return calc with no second network call.
  const chart = await fetchChart(ticker, 380);

  if (chart.error || chart.closes.length < 220) {
    return {
      ticker,
      price: null,
      dailyChangePct: null,
      dma200: null,
      slope200: null,
      pctVs200: null,
      ytdReturnPct: null,
      error: chart.error ?? `${ticker}: insufficient price history for 200-DMA`,
    };
  }

  const closes = chart.closes;
  const price: number | null = chart.meta.regularMarketPrice ?? closes[closes.length - 1] ?? null;
  const prevClose: number | null =
    closes.length >= 2 ? closes[closes.length - 2] : chart.meta.chartPreviousClose ?? null;
  const dailyChangePct: number | null =
    price != null && prevClose != null ? ((price - prevClose) / prevClose) * 100 : null;

  const dma200: number = avg(closes.slice(-200));
  const dma200_prev: number | null = closes.length >= 220 ? avg(closes.slice(-220, -20)) : null;
  const slope200: number | null =
    dma200_prev != null ? ((dma200 - dma200_prev) / dma200_prev) * 100 : null;
  const pctVs200: number | null = price != null ? ((price - dma200) / dma200) * 100 : null;

  // YTD total return — dividend-adjusted close at the first trading day of
  // the current calendar year, vs today's live price. Using adjclose at the
  // start and live price at the end is the standard total-return method:
  // the most recent adjclose already equals the most recent raw close, so
  // pairing live price with it loses nothing and stays maximally current.
  const currentYear = new Date().getUTCFullYear();
  const ytdStartIdx = chart.timestamps.findIndex(
    (t) => new Date(t * 1000).getUTCFullYear() === currentYear
  );
  const startAdjClose = ytdStartIdx >= 0 ? chart.adjcloses[ytdStartIdx] : null;
  const ytdReturnPct: number | null =
    startAdjClose != null && price != null && startAdjClose !== 0
      ? ((price - startAdjClose) / startAdjClose) * 100
      : null;

  console.log(
    `${ticker}: price=${price} 200dma=${dma200.toFixed(2)} slope=${slope200?.toFixed(2)}% vs200=${pctVs200?.toFixed(2)}% ytd=${ytdReturnPct?.toFixed(2)}%`
  );

  return { ticker, price, dailyChangePct, dma200, slope200, pctVs200, ytdReturnPct, error: chart.error };
}

// Update this list when the GLDM → SCHD swap executes.
const POSITION_TICKERS = ["VTI", "SCHD", "VEA", "SGOV", "VTIP", "VGIT", "GLDM"] as const;

export async function GET() {
  const diagnostics: Record<string, string> = {};

  // ═══════════════════════════════════════════════════════════════════
  // SATURDAY MANUAL UPDATE CHECKLIST — update every weekend
  // ═══════════════════════════════════════════════════════════════════
  const MANUAL_CAPE_FALLBACK       = 40.94;    // multpl.com/shiller-pe          · Jul 22 2026
  const MANUAL_BUFFETT_SIGMA       = 2.48;     // currentmarketvaluation.com     · Jul 17 2026
  const MANUAL_HY_FALLBACK         = 2.79;     // FRED BAMLH0A0HYM2 (÷100=%)    · Jun 26 2026
  const MANUAL_FEAR_GREED_FALLBACK = 67;       // CNN Fear & Greed Index         · Jun 26 2026
  const MANUAL_PE_FALLBACK         = 24.2;     // SPX trailing P/E               · May 3 2026
  const MANUAL_BREADTH_FALLBACK    = 57;       // macromicro $SPXA200R (%)       · Jun 26 2026
  const MANUAL_FED_STANCE: "easing" | "holding" | "tightening" = "holding";
  //                                           · Jun 26 2026 · FOMC held 3.50-3.75%, dot plot turned hawkish (median 3.8% vs prior 3.4%)
  const MANUAL_AD = {                          // StockCharts $NYAD              · Jun 26 2026
    signal:      "neutral" as "bullish_divergence" | "neutral" | "confirming_weakness",
    adTrend:     "higher_lows" as "higher_lows" | "flat" | "lower_lows",
    adVsSpx:     "tracking" as "diverging_up" | "tracking" | "diverging_down",
    note:        "A/D line tracking market recovery, all 5 valuation models still overvalued",
    updatedDate: "Jun 26",
  };
  // ═══════════════════════════════════════════════════════════════════

  const [
    [spx, vix, dxy, putCall, fredReal10y, fredNom10y, fredHY, fredYC, fredFedFunds, fredBreakeven, peData, capeData, fearGreedData, ivyVTI, ivyVEU, ivyIEF, ivyVNQ, ivyDBC, fredWALCL, djt, brent, breadthChart],
    positionResults,
    benchmarkBND,
    brentLiveQuote,
  ] = await Promise.all([
    Promise.all([
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
      fetchFred("WALCL", 2),
      fetchChart("^DJT", 420),
      fetchChart("BZ=F", 5),
      fetchChart("^SPXA200R", 5),
    ]),
    Promise.all(POSITION_TICKERS.map((t) => fetchPositionMetrics(t))),
    // Benchmark proxy — 60% VTI / 40% BND, tracking the same two indices
    // (CRSP US Total Market, Bloomberg US Agg Float Adjusted) VBINX itself
    // is built on. VTI is already fetched above as a portfolio holding, so
    // BND is the only new call needed. Both reprice intraday, unlike VBINX's
    // once-daily NAV.
    fetchPositionMetrics("BND"),
    // Live Brent quote — primary source for price/change%. The chart fetch
    // above is kept only as a fallback and for the regime bar's history.
    fetchLiveQuote("BZ=F"),
  ]);

  const positions: Record<string, PositionMetrics> = {};
  for (const p of positionResults) {
    positions[p.ticker] = p;
    if (p.error) diagnostics[`position_${p.ticker.toLowerCase()}`] = p.error;
  }
  if (benchmarkBND.error) diagnostics["benchmark_bnd"] = benchmarkBND.error;

  // Two benchmark proxies, both built from the same VTI + BND YTD figures,
  // just weighted differently. 60/40 is the traditional convention Mike has
  // compared against historically. 40/60 is closer to his actual posture.
  const vtiForBenchmark = positions["VTI"];
  const benchmark6040YtdPct: number | null =
    vtiForBenchmark?.ytdReturnPct != null && benchmarkBND.ytdReturnPct != null
      ? vtiForBenchmark.ytdReturnPct * 0.6 + benchmarkBND.ytdReturnPct * 0.4
      : null;
  const benchmark4060YtdPct: number | null =
    vtiForBenchmark?.ytdReturnPct != null && benchmarkBND.ytdReturnPct != null
      ? vtiForBenchmark.ytdReturnPct * 0.4 + benchmarkBND.ytdReturnPct * 0.6
      : null;

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
  if (djt.error) diagnostics["djt"] = djt.error;
  if (brent.error) diagnostics["brent"] = brent.error;
  if (breadthChart.error) diagnostics["breadth"] = breadthChart.error;

  const breadthPct: number | null = breadthChart.closes.length > 0
    ? breadthChart.closes[breadthChart.closes.length - 1]
    : breadthChart.meta.regularMarketPrice ?? MANUAL_BREADTH_FALLBACK;
  console.log(`Breadth (% above 200-DMA): ${breadthPct}%`);

  const brentPrice: number | null =
    brentLiveQuote.price ?? brent.meta.regularMarketPrice ?? brent.closes[brent.closes.length - 1] ?? null;
  const brentPrev: number | null = brent.closes.length >= 2 ? brent.closes[brent.closes.length - 2] : null;
  const brentChangePct: number | null =
    brentLiveQuote.changePct ??
    (brentPrice != null && brentPrev != null ? ((brentPrice - brentPrev) / brentPrev) * 100 : null);
  if (brentLiveQuote.error) {
    diagnostics["brent_live_quote"] = brentLiveQuote.error;
  }
  if (brentLiveQuote.price == null) {
    diagnostics["brent_stale_fallback"] = "Live quote unavailable — using chart close, may lag intraday moves";
  }
  const brentRegime: "room" | "neutral" | "watch" | "frozen" | null =
    brentPrice == null ? null :
    brentPrice < 80  ? "room" :
    brentPrice < 95  ? "neutral" :
    brentPrice < 110 ? "watch" : "frozen";
  console.log(`Brent: $${brentPrice} (${brentChangePct?.toFixed(2)}%) → ${brentRegime}`);

  const djtCloses = djt.closes;
  const djtPrice: number | null = djt.meta.regularMarketPrice ?? djtCloses[djtCloses.length - 1] ?? null;
  const djtPrev: number | null = djtCloses.length >= 2 ? djtCloses[djtCloses.length - 2] : null;
  const djtChangePct: number | null = djtPrice != null && djtPrev != null
    ? ((djtPrice - djtPrev) / djtPrev) * 100 : null;

  const djt200dma: number | null = djtCloses.length >= 200
    ? avg(djtCloses.slice(-200)) : null;
  const djt200dma_prev: number | null = djtCloses.length >= 220
    ? avg(djtCloses.slice(-220, -20)) : null;
  const djt200slope: number | null = djt200dma != null && djt200dma_prev != null
    ? ((djt200dma - djt200dma_prev) / djt200dma_prev) * 100 : null;

  const djtVs200: number | null = djtPrice != null && djt200dma != null
    ? ((djtPrice - djt200dma) / djt200dma) * 100 : null;
  const djtAbove200 = djtVs200 != null && djtVs200 >= 0;
  console.log(`DJT: ${djtPrice} vs 200-DMA ${djt200dma?.toFixed(2)} (${djtVs200?.toFixed(2)}%)`);

  const walclMil: number | null = fredWALCL.value;
  const walclPrevMil: number | null = fredWALCL.prev;
  const walclBn: number | null  = walclMil  != null ? Math.round(walclMil  / 1000) : null;
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

  const spx20dma = spxCloses.length >= 20 ? avg(spxCloses.slice(-20)) : null;
  const spx50dma = spxCloses.length >= 50 ? avg(spxCloses.slice(-50)) : null;
  const spx100dma = spxCloses.length >= 100 ? avg(spxCloses.slice(-100)) : null;
  const spx200dma = spxCloses.length >= 200 ? avg(spxCloses.slice(-200)) : null;
  const spxTrend14d = spxCloses.slice(-14);

  const spxAbove200 = spxPrice != null && spx200dma != null && spxPrice > spx200dma;
  type SchanenpSignal = "bull" | "bear" | "non_confirmation_bull" | "non_confirmation_bear";
  const schannepSignal: SchanenpSignal =
    spxAbove200  && djtAbove200  ? "bull" :
    !spxAbove200 && !djtAbove200 ? "bear" :
    spxAbove200  && !djtAbove200 ? "non_confirmation_bear" :
                                   "non_confirmation_bull";
  const schannepLabel: Record<SchanenpSignal, string> = {
    bull:                  "Confirmed Bull",
    bear:                  "Confirmed Bear",
    non_confirmation_bear: "Non-Confirmation ⚠",
    non_confirmation_bull: "Recovery Signal",
  };
  const schannepColor: Record<SchanenpSignal, string> = {
    bull:                  "#4ade80",
    bear:                  "#ff6b88",
    non_confirmation_bear: "#fbbf24",
    non_confirmation_bull: "#4ade80",
  };
  console.log(`Schannep: ${schannepSignal} (SPX ${spxAbove200 ? "above" : "below"} 200-DMA, DJT ${djtAbove200 ? "above" : "below"} 200-DMA)`);

  const spx20dma_prev = spxCloses.length >= 30 ? avg(spxCloses.slice(-30, -10)) : null;
  const spx20slope = spx20dma != null && spx20dma_prev != null
    ? ((spx20dma - spx20dma_prev) / spx20dma_prev) * 100 : null;

  const spx50dma_prev = spxCloses.length >= 70 ? avg(spxCloses.slice(-70, -20)) : null;
  const spx50slope = spx50dma != null && spx50dma_prev != null
    ? ((spx50dma - spx50dma_prev) / spx50dma_prev) * 100 : null;

  const spx200dma_prev = spxCloses.length >= 220 ? avg(spxCloses.slice(-220, -20)) : null;
  const spx200slope = spx200dma != null && spx200dma_prev != null
    ? ((spx200dma - spx200dma_prev) / spx200dma_prev) * 100 : null;

  const aboveDma200 = spxPrice != null && spx200dma != null && spxPrice > spx200dma;
  const dma200Rising = spx200slope != null && spx200slope > 0.02;
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

  const hySpread: number = fredHY.value ?? MANUAL_HY_FALLBACK;

  const yieldCurve: number = fredYC.value ?? 0.55;
  const fedFunds: number = fredFedFunds.value ?? 4.33;
  const breakeven5y: number = fredBreakeven.value ?? 2.45;

  const dxyPrice: number | null = dxy.meta.regularMarketPrice ?? dxy.closes[dxy.closes.length - 1] ?? null;
  const dxyPrev: number | null = dxy.closes.length >= 2 ? dxy.closes[dxy.closes.length - 2] : null;
  const dxyChangePct: number | null = dxyPrice != null && dxyPrev != null ? ((dxyPrice - dxyPrev) / dxyPrev) * 100 : null;

  const putCallRatio: number | null = putCall.meta.regularMarketPrice ?? putCall.closes[putCall.closes.length - 1] ?? null;

  const trailingPE: number | null = peData.value ?? spx.meta.trailingPE ?? MANUAL_PE_FALLBACK;
  let erp: number | null = null;
  if (trailingPE != null && trailingPE > 0) {
    const earningsYield = (1 / trailingPE) * 100;
    erp = Math.round((earningsYield - real10y) * 100);
    console.log(`ERP: ${erp} bps`);
  }

  const capeRatio: number = capeData.value ?? MANUAL_CAPE_FALLBACK;

  const spxPctAbove200 = spx200dma != null && spxPrice != null
    ? ((spxPrice - spx200dma) / spx200dma) * 100 : null;
  const isBelow200 = spxPctAbove200 != null && spxPctAbove200 < 0;

  const regimeGate: "trend_broken" | "near_ma" | "trend_intact" | "reclaiming" =
    isBelow200                                    ? "trend_broken" :
    spxPctAbove200 != null && spxPctAbove200 <= 3 ? "near_ma"      : "trend_intact";

  const scoreCAFE    = capeRatio > 30 ? 2 : capeRatio > 20 ? 1 : 0;
  const scoreBuffett = MANUAL_BUFFETT_SIGMA > 1.5 ? 2 : MANUAL_BUFFETT_SIGMA > 0.5 ? 1 : 0;
  const scoreVIX     = vixPrice != null ? (vixPrice < 20 ? 2 : vixPrice < 28 ? 1 : 0) : 1;
  const scoreHY      = hySpread < 3.5 ? 2 : hySpread < 5.5 ? 1 : 0;
  const scoreYC      = yieldCurve < -0.5 ? 2 : yieldCurve < 0.5 ? 1 : 0;
  const scoreBreadth = breadthPct != null ? (breadthPct < 50 ? 2 : breadthPct < 70 ? 1 : 0) : 1;
  const scoreERP     = erp != null ? (erp < 100 ? 2 : erp < 300 ? 1 : 0) : 1;
  const ivyInvestedCount = [ivyVTI, ivyVEU, ivyIEF, ivyVNQ, ivyDBC].filter(p => p.signal === "Invest").length;
  const scoreIvy     = ivyInvestedCount <= 2 ? 2 : ivyInvestedCount <= 4 ? 1 : 0;
  const compositeScore = scoreCAFE + scoreBuffett + scoreVIX + scoreHY + scoreYC + scoreBreadth + scoreERP + scoreIvy;

  const compositeAllocation =
    regimeGate === "trend_broken" ? "35–40%" :
    regimeGate === "near_ma"      ? "42–45%" :
    compositeScore >= 13 ? "42–45%" :
    compositeScore >= 10 ? "45–50%" :
    compositeScore >= 7  ? "50–55%" :
    compositeScore >= 4  ? "55–60%" : "60%+";

  const compositeSignal =
    regimeGate === "trend_broken" ? "RISK OFF — REDUCE" :
    regimeGate === "near_ma"      ? "RISK WATCH — NEAR MA" :
    compositeScore >= 13 ? "RISK ON — HOLD DEFENSIVE" :
    compositeScore >= 10 ? "RISK ON — SLIGHT TILT" :
    compositeScore >= 7  ? "RISK ON — DEPLOY" :
    compositeScore >= 4  ? "RISK ON — LEAN IN" : "RISK ON — FULL POSTURE";

  const compositeColor =
    regimeGate === "trend_broken" ? "#ff6b88" :
    regimeGate === "near_ma"      ? "#fbbf24" :
    compositeScore >= 13 ? "#fbbf24" :
    compositeScore >= 10 ? "#94a3b8" :
    compositeScore >= 7  ? "#4ade80" :
    compositeScore >= 4  ? "#4ade80" : "#22d3ee";

  const fearGreedScore: number = fearGreedData.value ?? MANUAL_FEAR_GREED_FALLBACK;
  const fearGreedRating: string = fearGreedData.rating ?? "Extreme Fear";

  // Total-return YTD, matching the same basis as the portfolio and VBINX
  // tiles. ^GSPC is a price index with no real dividend adjustment, so total
  // return needs ^SP500TR (the S&P 500 Total Return Index) instead — its
  // own series already has dividends reinvested, no adjclose math needed.
  let spxYtdPct: number | null = null;
  let spxYtdIsTotalReturn = false;
  try {
    const now = new Date();
    const daysIntoYear = Math.ceil(
      (now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (1000 * 60 * 60 * 24)
    ) + 10;
    const trYtd = await fetchChart("^SP500TR", daysIntoYear);
    if (trYtd.closes.length > 0) {
      const trStart = trYtd.closes[0];
      const trLatest = trYtd.meta.regularMarketPrice ?? trYtd.closes[trYtd.closes.length - 1];
      spxYtdPct = ((trLatest - trStart) / trStart) * 100;
      spxYtdIsTotalReturn = true;
    } else if (trYtd.error) {
      diagnostics["spx_ytd_total_return"] = trYtd.error;
    }
    // Fallback: price-only YTD if the total-return series is unavailable,
    // so a bad ticker doesn't silently kill the tile.
    if (spxYtdPct == null) {
      const ytd = await fetchChart("^GSPC", daysIntoYear);
      if (ytd.closes.length > 0 && spxPrice != null) {
        spxYtdPct = ((spxPrice - ytd.closes[0]) / ytd.closes[0]) * 100;
      }
      if (ytd.error) diagnostics["ytd"] = ytd.error;
    }
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
      spx_ytd_is_total_return: spxYtdIsTotalReturn,
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
      brent_price: brentPrice,
      brent_change_pct: brentChangePct,
      brent_regime: brentRegime,
      breadth_pct: breadthPct,
      composite_score: compositeScore,
      composite_scores: { cape: scoreCAFE, buffett: scoreBuffett, vix: scoreVIX, hy: scoreHY, yc: scoreYC, breadth: scoreBreadth, erp: scoreERP, ivy: scoreIvy },
      composite_allocation: compositeAllocation,
      composite_signal: compositeSignal,
      composite_color: compositeColor,
      regime_gate: regimeGate,
      buffett_sigma: MANUAL_BUFFETT_SIGMA,
      fed_stance: MANUAL_FED_STANCE,
      djt_price: djtPrice,
      djt_change_pct: djtChangePct,
      djt_trend_14d: djtCloses.slice(-14),
      djt_200dma: djt200dma,
      djt_200slope: djt200slope,
      djt_vs_200_pct: djtVs200,
      djt_above_200: djtAbove200,
      schannep_signal: schannepSignal,
      schannep_label: schannepLabel[schannepSignal],
      schannep_color: schannepColor[schannepSignal],
      ivy: {
        vti: { price: ivyVTI.price, sma: ivyVTI.sma, variance: ivyVTI.variancePct, signal: ivyVTI.signal },
        veu: { price: ivyVEU.price, sma: ivyVEU.sma, variance: ivyVEU.variancePct, signal: ivyVEU.signal },
        ief: { price: ivyIEF.price, sma: ivyIEF.sma, variance: ivyIEF.variancePct, signal: ivyIEF.signal },
        vnq: { price: ivyVNQ.price, sma: ivyVNQ.sma, variance: ivyVNQ.variancePct, signal: ivyVNQ.signal },
        dbc: { price: ivyDBC.price, sma: ivyDBC.sma, variance: ivyDBC.variancePct, signal: ivyDBC.signal },
      },
      positions,
      benchmark_6040: {
        ytd_return_pct: benchmark6040YtdPct,
        vti_ytd_pct: vtiForBenchmark?.ytdReturnPct ?? null,
        bnd_ytd_pct: benchmarkBND.ytdReturnPct,
      },
      benchmark_4060: {
        ytd_return_pct: benchmark4060YtdPct,
        vti_ytd_pct: vtiForBenchmark?.ytdReturnPct ?? null,
        bnd_ytd_pct: benchmarkBND.ytdReturnPct,
      },
    },
  }, { status: 200 });
}
