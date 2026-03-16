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

  small_large?: number | null;
  financials_ratio?: number | null;
};

type SnapshotPayload = {
  asOf: string;
  source: string;
  status: string;
  metrics: SnapshotMetrics;
  diagnostics?: string[];
};

const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";
const ALPHA_BASE = "https://www.alphavantage.co/query";

const FRED_SERIES = {
  sp500: "SP500",
  tenYear: "DGS10",
  twoYear: "DGS2",
  realTenYear: "DFII10",
  hySpread: "BAMLH0A0HYM2",
  dollar: "DTWEXBGS",
  fci: "NFCI",
};

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  if (value === "." || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchJson(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

async function fredSeries(series: string, key: string, limit = 250) {
  const url =
    `${FRED_BASE}?series_id=${series}` +
    `&api_key=${key}` +
    `&file_type=json` +
    `&sort_order=desc` +
    `&limit=${limit}`;

  const data = await fetchJson(url);

  return (data.observations ?? [])
    .map((o: any) => toNumber(o.value))
    .filter((v: number | null): v is number => v !== null);
}

async function fredLatest(series: string, key: string) {
  const values = await fredSeries(series, key, 20);
  return values[0] ?? null;
}

async function alphaDaily(symbol: string, key: string) {
  const url =
    `${ALPHA_BASE}?function=TIME_SERIES_DAILY_ADJUSTED` +
    `&symbol=${encodeURIComponent(symbol)}` +
    `&outputsize=full` +
    `&apikey=${encodeURIComponent(key)}`;

  const data = await fetchJson(url);

  if (typeof data.Note === "string") {
    throw new Error(`Alpha throttled: ${data.Note}`);
  }
  if (typeof data["Error Message"] === "string") {
    throw new Error(`Alpha error: ${data["Error Message"]}`);
  }

  const series = data["Time Series (Daily)"];
  if (!series) {
    throw new Error(`Missing daily series for ${symbol}`);
  }

  return Object.entries(series)
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([, row]: any) => toNumber(row["5. adjusted close"] ?? row["4. close"]))
    .filter((v: number | null): v is number => v !== null);
}

async function alphaQuote(symbol: string, key: string) {
  const url =
    `${ALPHA_BASE}?function=GLOBAL_QUOTE` +
    `&symbol=${encodeURIComponent(symbol)}` +
    `&apikey=${encodeURIComponent(key)}`;

  const data = await fetchJson(url);

  if (typeof data.Note === "string") {
    throw new Error(`Alpha throttled: ${data.Note}`);
  }
  if (typeof data["Error Message"] === "string") {
    throw new Error(`Alpha error: ${data["Error Message"]}`);
  }

  return toNumber(data?.["Global Quote"]?.["05. price"]);
}

function movingAverage(values: number[], period: number) {
  if (values.length < period) return null;
  const slice = values.slice(0, period);
  return Number((slice.reduce((a, b) => a + b, 0) / period).toFixed(2));
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
    spxSeriesResult,
    tenYearResult,
    twoYearResult,
    real10Result,
    hyResult,
    dxyResult,
    fciResult,
    vtiDailyResult,
    vtiQuoteResult,
  ] = await Promise.allSettled([
    fredSeries(FRED_SERIES.sp500, fredKey, 250),
    fredLatest(FRED_SERIES.tenYear, fredKey),
    fredLatest(FRED_SERIES.twoYear, fredKey),
    fredLatest(FRED_SERIES.realTenYear, fredKey),
    fredLatest(FRED_SERIES.hySpread, fredKey),
    fredLatest(FRED_SERIES.dollar, fredKey),
    fredLatest(FRED_SERIES.fci, fredKey),
    alphaDaily("VTI", alphaKey),
    alphaQuote("VTI", alphaKey),
  ]);

  const spxSeries =
    spxSeriesResult.status === "fulfilled" ? spxSeriesResult.value : [];
  if (spxSeriesResult.status === "rejected") {
    diagnostics.push(`SP500 series failed: ${String(spxSeriesResult.reason)}`);
  }

  const tenYear =
    tenYearResult.status === "fulfilled" ? tenYearResult.value : null;
  if (tenYearResult.status === "rejected") {
    diagnostics.push(`10Y failed: ${String(tenYearResult.reason)}`);
  }

  const twoYear =
    twoYearResult.status === "fulfilled" ? twoYearResult.value : null;
  if (twoYearResult.status === "rejected") {
    diagnostics.push(`2Y failed: ${String(twoYearResult.reason)}`);
  }

  const real10 =
    real10Result.status === "fulfilled" ? real10Result.value : null;
  if (real10Result.status === "rejected") {
    diagnostics.push(`Real 10Y failed: ${String(real10Result.reason)}`);
  }

  const hy =
    hyResult.status === "fulfilled" ? hyResult.value : null;
  if (hyResult.status === "rejected") {
    diagnostics.push(`HY spread failed: ${String(hyResult.reason)}`);
  }

  const dxy =
    dxyResult.status === "fulfilled" ? dxyResult.value : null;
  if (dxyResult.status === "rejected") {
    diagnostics.push(`DXY failed: ${String(dxyResult.reason)}`);
  }

  const fci =
    fciResult.status === "fulfilled" ? fciResult.value : null;
  if (fciResult.status === "rejected") {
    diagnostics.push(`FCI failed: ${String(fciResult.reason)}`);
  }

  const vtiDaily =
    vtiDailyResult.status === "fulfilled" ? vtiDailyResult.value : [];
  if (vtiDailyResult.status === "rejected") {
    diagnostics.push(`VTI daily failed: ${String(vtiDailyResult.reason)}`);
  }

  const vtiQuote =
    vtiQuoteResult.status === "fulfilled" ? vtiQuoteResult.value : null;
  if (vtiQuoteResult.status === "rejected") {
    diagnostics.push(`VTI quote failed: ${String(vtiQuoteResult.reason)}`);
  }

  if (spxSeries.length > 0) {
    metrics.spx_price = Number(spxSeries[0].toFixed(2));

    const ma20 = movingAverage(spxSeries, 20);
    const ma50 = movingAverage(spxSeries, 50);
    const ma100 = movingAverage(spxSeries, 100);
    const ma200 = movingAverage(spxSeries, 200);

    if (ma20 !== null) metrics.spx_20dma = { level: ma20 };
    if (ma50 !== null) metrics.spx_50dma = { level: ma50 };
    if (ma100 !== null) metrics.spx_100dma = { level: ma100 };
    if (ma200 !== null) metrics.spx_200dma = { level: ma200 };
  }

  if (vtiDaily.length > 0) {
    metrics.vti_price = Number((vtiQuote ?? vtiDaily[0]).toFixed(2));

    const v20 = movingAverage(vtiDaily, 20);
    const v50 = movingAverage(vtiDaily, 50);
    const v100 = movingAverage(vtiDaily, 100);
    const v200 = movingAverage(vtiDaily, 200);

    if (v20 !== null) metrics.vti_20dma = { level: v20 };
    if (v50 !== null) metrics.vti_50dma = { level: v50 };
    if (v100 !== null) metrics.vti_100dma = { level: v100 };
    if (v200 !== null) metrics.vti_200dma = { level: v200 };
  }

  if (tenYear !== null && twoYear !== null) {
    metrics.yield_curve_10y_2y = Number((tenYear - twoYear).toFixed(2));
  }

  if (real10 !== null) {
    metrics.real_10y_yield = Number(real10.toFixed(2));
  }

  if (hy !== null) {
    metrics.hy_spread = Number(hy.toFixed(2));
  }

  if (dxy !== null) {
    metrics.dxy = Number(dxy.toFixed(2));
  }

  if (fci !== null) {
    metrics.fci = Number(fci.toFixed(2));
  }

  if (polygonKey) {
    diagnostics.push(
      "POLYGON_API_KEY is set, but realtime Massive endpoints are temporarily disabled until we swap in the correct snapshot URLs."
    );
  }

  return NextResponse.json({
    asOf: new Date().toISOString(),
    source: "LIVE_DAILY_MIXED",
    status: "Connected",
    metrics,
    diagnostics,
  } satisfies SnapshotPayload);
}
