import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type LevelMetric = { level: number };

type SnapshotMetrics = {
  spx_price?: number;
  spx_20dma?: LevelMetric;
  spx_50dma?: LevelMetric;
  spx_100dma?: LevelMetric;
  spx_200dma?: LevelMetric;
  vti_price?: number;
  vti_20dma?: LevelMetric;
  vti_50dma?: LevelMetric;
  vti_100dma?: LevelMetric;
  vti_200dma?: LevelMetric;
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
  asOf: string;
  source: string;
  status: string;
  metrics: SnapshotMetrics;
  diagnostics?: string[];
};

type FredObservation = {
  date: string;
  value: string;
};

type AlphaDailyAdjusted = {
  [date: string]: {
    "4. close"?: string;
    "5. adjusted close"?: string;
  };
};

const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";
const ALPHA_BASE = "https://www.alphavantage.co/query";
const POLYGON_BASE = "https://api.polygon.io";

const FRED_SERIES = {
  sp500: "SP500",
  tenYear: "DGS10",
  twoYear: "DGS2",
  realTenYear: "DFII10",
  hySpread: "BAMLH0A0HYM2",
  fedBalanceSheet: "WALCL",
  reverseRepo: "RRPONTSYD",
  tga: "WTREGEN",
  financialConditions: "NFCI",
  broadDollar: "DTWEXBGS",
};

const ALPHA_SYMBOLS = {
  vti: "VTI",
  rsp: "RSP",
  xlf: "XLF",
};

function toNumber(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  if (value === "." || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchJson<T>(url: string, timeoutMs = 15000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFredSeries(
  seriesId: string,
  apiKey: string,
  limit = 20,
): Promise<number[]> {
  const url =
    `${FRED_BASE}?series_id=${encodeURIComponent(seriesId)}` +
    `&api_key=${encodeURIComponent(apiKey)}` +
    `&file_type=json&sort_order=desc&limit=${limit}`;

  const data = await fetchJson<{ observations?: FredObservation[] }>(url);
  const observations = data.observations ?? [];

  return observations
    .map((obs) => toNumber(obs.value))
    .filter((v): v is number => v !== null);
}

async function fetchFredLatest(
  seriesId: string,
  apiKey: string,
): Promise<number | null> {
  const values = await fetchFredSeries(seriesId, apiKey, 20);
  return values[0] ?? null;
}

async function fetchAlphaDailyAdjusted(
  symbol: string,
  apiKey: string,
): Promise<{ latestClose: number | null; closes: number[] }> {
  const url =
    `${ALPHA_BASE}?function=TIME_SERIES_DAILY_ADJUSTED` +
    `&symbol=${encodeURIComponent(symbol)}` +
    `&outputsize=full&apikey=${encodeURIComponent(apiKey)}`;

  const data = await fetchJson<Record<string, unknown>>(url);

  if (typeof data.Note === "string") {
    throw new Error(`Alpha Vantage throttled for ${symbol}: ${data.Note}`);
  }
  if (typeof data["Error Message"] === "string") {
    throw new Error(`Alpha Vantage error for ${symbol}: ${data["Error Message"]}`);
  }

  const series = data["Time Series (Daily)"] as AlphaDailyAdjusted | undefined;
  if (!series) {
    throw new Error(`Missing daily time series for ${symbol}`);
  }

  const closes = Object.entries(series)
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([, point]) => toNumber(point["5. adjusted close"] ?? point["4. close"]))
    .filter((v): v is number => v !== null);

  return {
    latestClose: closes[0] ?? null,
    closes,
  };
}

async function fetchAlphaGlobalQuote(
  symbol: string,
  apiKey: string,
): Promise<number | null> {
  const url =
    `${ALPHA_BASE}?function=GLOBAL_QUOTE` +
    `&symbol=${encodeURIComponent(symbol)}` +
    `&apikey=${encodeURIComponent(apiKey)}`;

  const data = await fetchJson<Record<string, unknown>>(url);

  if (typeof data.Note === "string") {
    throw new Error(`Alpha Vantage throttled for ${symbol}: ${data.Note}`);
  }
  if (typeof data["Error Message"] === "string") {
    throw new Error(`Alpha Vantage error for ${symbol}: ${data["Error Message"]}`);
  }

  const quote = data["Global Quote"] as Record<string, string> | undefined;
  if (!quote) return null;

  return toNumber(quote["05. price"]);
}

async function fetchPolygonIndexQuote(
  polygonKey: string,
  ticker: string,
): Promise<number | null> {
  const url =
    `${POLYGON_BASE}/v3/snapshot/indices/${encodeURIComponent(ticker)}` +
    `?apiKey=${encodeURIComponent(polygonKey)}`;

  const data = await fetchJson<{
    results?: {
      value?: number;
      session?: { value?: number; close?: number };
    };
  }>(url);

  return (
    toNumber(data.results?.value) ??
    toNumber(data.results?.session?.value) ??
    toNumber(data.results?.session?.close)
  );
}

async function fetchPolygonTickerQuote(
  polygonKey: string,
  ticker: string,
): Promise<number | null> {
  const url =
    `${POLYGON_BASE}/v2/snapshot/locale/us/markets/stocks/tickers/${encodeURIComponent(
      ticker,
    )}?apiKey=${encodeURIComponent(polygonKey)}`;

  const data = await fetchJson<{
    ticker?: {
      day?: { c?: number };
      lastTrade?: { p?: number };
      min?: { c?: number };
      prevDay?: { c?: number };
    };
  }>(url);

  return (
    toNumber(data.ticker?.lastTrade?.p) ??
    toNumber(data.ticker?.day?.c) ??
    toNumber(data.ticker?.min?.c) ??
    toNumber(data.ticker?.prevDay?.c)
  );
}

function movingAverage(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const slice = closes.slice(0, period);
  return Number(
    (slice.reduce((sum, value) => sum + value, 0) / period).toFixed(2),
  );
}

function ratioPercent(a: number | null, b: number | null): number | null {
  if (a === null || b === null || b === 0) return null;
  return Number((((a / b) - 1) * 100).toFixed(2));
}

function parseValuationSnapshot(): Partial<SnapshotMetrics> {
  const raw = process.env.VALUATION_SNAPSHOT_JSON;
  if (!raw) return {};

  try {
    return JSON.parse(raw) as Partial<SnapshotMetrics>;
  } catch {
    return {};
  }
}

export async function GET() {
  const fredKey = process.env.FRED_API_KEY;
  const alphaKey = process.env.ALPHA_VANTAGE_API_KEY;
  const polygonKey = process.env.POLYGON_API_KEY;

  if (!fredKey || !alphaKey) {
    return NextResponse.json(
      {
        asOf: new Date().toISOString(),
        source: "CONFIG_ERROR",
        status: "Missing FRED_API_KEY or ALPHA_VANTAGE_API_KEY",
        metrics: {},
      } satisfies SnapshotPayload,
      { status: 500 },
    );
  }

  const diagnostics: string[] = [];
  const metrics: SnapshotMetrics = {};

  const [
    sp500SeriesResult,
    tenYearResult,
    twoYearResult,
    realTenYearResult,
    hySpreadResult,
    walclResult,
    rrpResult,
    tgaResult,
    fciResult,
    dxyResult,
    vtiDailyResult,
    vtiQuoteResult,
    rspDailyResult,
    xlfDailyResult,
    polygonSpxResult,
    polygonVixResult,
    polygonVtiResult,
  ] = await Promise.allSettled([
    fetchFredSeries(FRED_SERIES.sp500, fredKey, 250),
    fetchFredLatest(FRED_SERIES.tenYear, fredKey),
    fetchFredLatest(FRED_SERIES.twoYear, fredKey),
    fetchFredLatest(FRED_SERIES.realTenYear, fredKey),
    fetchFredLatest(FRED_SERIES.hySpread, fredKey),
    fetchFredLatest(FRED_SERIES.fedBalanceSheet, fredKey),
    fetchFredLatest(FRED_SERIES.reverseRepo, fredKey),
    fetchFredLatest(FRED_SERIES.tga, fredKey),
    fetchFredLatest(FRED_SERIES.financialConditions, fredKey),
    fetchFredLatest(FRED_SERIES.broadDollar, fredKey),
    fetchAlphaDailyAdjusted(ALPHA_SYMBOLS.vti, alphaKey),
    fetchAlphaGlobalQuote(ALPHA_SYMBOLS.vti, alphaKey),
    fetchAlphaDailyAdjusted(ALPHA_SYMBOLS.rsp, alphaKey),
    fetchAlphaDailyAdjusted(ALPHA_SYMBOLS.xlf, alphaKey),
    polygonKey ? fetchPolygonIndexQuote(polygonKey, "I:SPX") : Promise.resolve(null),
    polygonKey ? fetchPolygonIndexQuote(polygonKey, "I:VIX") : Promise.resolve(null),
    polygonKey ? fetchPolygonTickerQuote(polygonKey, "VTI") : Promise.resolve(null),
  ]);

  const sp500Series =
    sp500SeriesResult.status === "fulfilled" ? sp500SeriesResult.value : [];
  if (sp500SeriesResult.status === "rejected") {
    diagnostics.push(`SP500 series: ${String(sp500SeriesResult.reason)}`);
  }

  const tenYear = tenYearResult.status === "fulfilled" ? tenYearResult.value : null;
  if (tenYearResult.status === "rejected") {
    diagnostics.push(`10Y: ${String(tenYearResult.reason)}`);
  }

  const twoYear = twoYearResult.status === "fulfilled" ? twoYearResult.value : null;
  if (twoYearResult.status === "rejected") {
    diagnostics.push(`2Y: ${String(twoYearResult.reason)}`);
  }

  const realTenYear =
    realTenYearResult.status === "fulfilled" ? realTenYearResult.value : null;
  if (realTenYearResult.status === "rejected") {
    diagnostics.push(`Real10Y: ${String(realTenYearResult.reason)}`);
  }

  const hySpread =
    hySpreadResult.status === "fulfilled" ? hySpreadResult.value : null;
  if (hySpreadResult.status === "rejected") {
    diagnostics.push(`HY Spread: ${String(hySpreadResult.reason)}`);
  }

  const walcl = walclResult.status === "fulfilled" ? walclResult.value : null;
  if (walclResult.status === "rejected") {
    diagnostics.push(`WALCL: ${String(walclResult.reason)}`);
  }

  const rrp = rrpResult.status === "fulfilled" ? rrpResult.value : null;
  if (rrpResult.status === "rejected") {
    diagnostics.push(`RRP: ${String(rrpResult.reason)}`);
  }

  const tga = tgaResult.status === "fulfilled" ? tgaResult.value : null;
  if (tgaResult.status === "rejected") {
    diagnostics.push(`TGA: ${String(tgaResult.reason)}`);
  }

  const fci = fciResult.status === "fulfilled" ? fciResult.value : null;
  if (fciResult.status === "rejected") {
    diagnostics.push(`FCI: ${String(fciResult.reason)}`);
  }

  const dxy = dxyResult.status === "fulfilled" ? dxyResult.value : null;
  if (dxyResult.status === "rejected") {
    diagnostics.push(`DXY: ${String(dxyResult.reason)}`);
  }

  const vtiDaily =
    vtiDailyResult.status === "fulfilled" ? vtiDailyResult.value : null;
  if (vtiDailyResult.status === "rejected") {
    diagnostics.push(`VTI daily: ${String(vtiDailyResult.reason)}`);
  }

  const vtiQuote =
    vtiQuoteResult.status === "fulfilled" ? vtiQuoteResult.value : null;
  if (vtiQuoteResult.status === "rejected") {
    diagnostics.push(`VTI quote: ${String(vtiQuoteResult.reason)}`);
  }

  const rspDaily =
    rspDailyResult.status === "fulfilled" ? rspDailyResult.value : null;
  if (rspDailyResult.status === "rejected") {
    diagnostics.push(`RSP daily: ${String(rspDailyResult.reason)}`);
  }

  const xlfDaily =
    xlfDailyResult.status === "fulfilled" ? xlfDailyResult.value : null;
  if (xlfDailyResult.status === "rejected") {
    diagnostics.push(`XLF daily: ${String(xlfDailyResult.reason)}`);
  }

  const polygonSpx =
    polygonSpxResult.status === "fulfilled" ? polygonSpxResult.value : null;
  if (polygonSpxResult.status === "rejected") {
    diagnostics.push(`Polygon SPX: ${String(polygonSpxResult.reason)}`);
  }

  const polygonVix =
    polygonVixResult.status === "fulfilled" ? polygonVixResult.value : null;
  if (polygonVixResult.status === "rejected") {
    diagnostics.push(`Polygon VIX: ${String(polygonVixResult.reason)}`);
  }

  const polygonVti =
    polygonVtiResult.status === "fulfilled" ? polygonVtiResult.value : null;
  if (polygonVtiResult.status === "rejected") {
    diagnostics.push(`Polygon VTI: ${String(polygonVtiResult.reason)}`);
  }

  // --- SPX current + DMA ---
  if (sp500Series.length > 0) {
    const spx20 = movingAverage(sp500Series, 20);
    const spx50 = movingAverage(sp500Series, 50);
    const spx100 = movingAverage(sp500Series, 100);
    const spx200 = movingAverage(sp500Series, 200);

    const spxCurrent = polygonSpx ?? sp500Series[0];
    metrics.spx_price = Number(spxCurrent.toFixed(2));

    if (spx20 !== null) metrics.spx_20dma = { level: spx20 };
    if (spx50 !== null) metrics.spx_50dma = { level: spx50 };
    if (spx100 !== null) metrics.spx_100dma = { level: spx100 };
    if (spx200 !== null) metrics.spx_200dma = { level: spx200 };

    if (!polygonKey) {
      diagnostics.push(
        "SPX current price is using latest daily FRED value. Add POLYGON_API_KEY for near-real-time SPX.",
      );
    }
  }

  // --- VTI current + DMA ---
  if (vtiDaily) {
    const vti20 = movingAverage(vtiDaily.closes, 20);
    const vti50 = movingAverage(vtiDaily.closes, 50);
    const vti100 = movingAverage(vtiDaily.closes, 100);
    const vti200 = movingAverage(vtiDaily.closes, 200);

    const vtiCurrent =
      polygonVti ?? vtiQuote ?? vtiDaily.latestClose ?? null;

    if (vtiCurrent !== null) {
      metrics.vti_price = Number(vtiCurrent.toFixed(2));
    }
    if (vti20 !== null) metrics.vti_20dma = { level: vti20 };
    if (vti50 !== null) metrics.vti_50dma = { level: vti50 };
    if (vti100 !== null) metrics.vti_100dma = { level: vti100 };
    if (vti200 !== null) metrics.vti_200dma = { level: vti200 };
  }

  // --- VIX current ---
  if (polygonVix !== null) {
    metrics.vix = Number(polygonVix.toFixed(2));
  } else {
    diagnostics.push(
      "VIX current price requires POLYGON_API_KEY for near-real-time index quote.",
    );
  }

  // --- Macro / rates / credit ---
  if (tenYear !== null && twoYear !== null) {
    metrics.yield_curve_10y_2y = Number((tenYear - twoYear).toFixed(2));
  }
  if (realTenYear !== null) {
    metrics.real_10y_yield = Number(realTenYear.toFixed(2));
  }
  if (hySpread !== null) {
    metrics.hy_spread = Number(hySpread.toFixed(2));
  }
  if (fci !== null) {
    metrics.fci = Number(fci.toFixed(2));
  }
  if (dxy !== null) {
    metrics.dxy = Number(dxy.toFixed(2));
  }

  // --- Net liquidity diagnostic ---
  if (walcl !== null && rrp !== null && tga !== null) {
    const netLiquidity = Number((walcl - rrp - tga).toFixed(2));
    diagnostics.push(`Net Liquidity: ${netLiquidity}`);
  }

  // --- Relative / proxy internals ---
  if (rspDaily?.latestClose !== null && sp500Series[0] !== undefined) {
    // This is still a rough proxy until we wire proper SPY/RSP breadth internals.
    metrics.small_large = ratioPercent(rspDaily.latestClose, sp500Series[0]);
  }

  if (xlfDaily?.latestClose !== null && sp500Series[0] !== undefined) {
    metrics.financials_ratio = ratioPercent(xlfDaily.latestClose, sp500Series[0]);
  }

  // --- Weekly manual valuation overlay ---
  Object.assign(metrics, parseValuationSnapshot());

  const payload: SnapshotPayload = {
    asOf: new Date().toISOString(),
    source: polygonKey ? "LIVE_RT" : "LIVE_DAILY_MIXED",
    status: "Connected",
    metrics,
    diagnostics,
  };

  return NextResponse.json(payload, { status: 200 });
}
