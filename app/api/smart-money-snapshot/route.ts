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
  fci?: number | null;

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

const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";
const YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";

const FRED_SERIES = {
  tenYear: "DGS10",
  twoYear: "DGS2",
  realTenYear: "DFII10",
  hySpread: "BAMLH0A0HYM2",
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
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0",
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  return res.json();
}

async function fredSeries(series: string, key: string, limit = 20) {
  const url =
    `${FRED_BASE}?series_id=${encodeURIComponent(series)}` +
    `&api_key=${encodeURIComponent(key)}` +
    `&file_type=json&sort_order=desc&limit=${limit}`;

  const data = await fetchJson(url);

  return (data.observations ?? [])
    .map((o: any) => toNumber(o.value))
    .filter((v: number | null): v is number => v !== null);
}

async function fredLatest(series: string, key: string) {
  const values = await fredSeries(series, key, 20);
  return values[0] ?? null;
}

async function yahooChart(symbol: string, range = "1y", interval = "1d") {
  const url =
    `${YAHOO_CHART_URL}/${encodeURIComponent(symbol)}` +
    `?range=${encodeURIComponent(range)}` +
    `&interval=${encodeURIComponent(interval)}` +
    `&includePrePost=false`;

  const data = await fetchJson(url);
  const result = data?.chart?.result?.[0];

  if (!result) {
    throw new Error(`Missing chart result for ${symbol}`);
  }

  const metaPrice =
    toNumber(result?.meta?.regularMarketPrice) ??
    toNumber(result?.meta?.previousClose);

  const closes = (result?.indicators?.quote?.[0]?.close ?? [])
    .map((v: unknown) => toNumber(v))
    .filter((v: number | null): v is number => v !== null);

  return {
    price: metaPrice,
    closes,
  };
}

function movingAverage(values: number[], period: number) {
  if (values.length < period) return null;
  const slice = values.slice(values.length - period);
  return Number((slice.reduce((a, b) => a + b, 0) / period).toFixed(2));
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

  if (!fredKey) {
    return NextResponse.json(
      {
        asOf: new Date().toISOString(),
        source: "CONFIG_ERROR",
        status: "Missing FRED_API_KEY",
        metrics: {},
      } satisfies SnapshotPayload,
      { status: 500 },
    );
  }

  const diagnostics: string[] = [];
  const metrics: SnapshotMetrics = {};

  const [
    spxChartResult,
    vixChartResult,
    vtiChartResult,
    tenYearResult,
    twoYearResult,
    real10Result,
    hyResult,
    fciResult,
  ] = await Promise.allSettled([
    yahooChart("^GSPC", "1y", "1d"),
    yahooChart("^VIX", "5d", "1d"),
    yahooChart("VTI", "1y", "1d"),
    fredLatest(FRED_SERIES.tenYear, fredKey),
    fredLatest(FRED_SERIES.twoYear, fredKey),
    fredLatest(FRED_SERIES.realTenYear, fredKey),
    fredLatest(FRED_SERIES.hySpread, fredKey),
    fredLatest(FRED_SERIES.fci, fredKey),
  ]);

  const spxChart =
    spxChartResult.status === "fulfilled" ? spxChartResult.value : null;
  if (spxChartResult.status === "rejected") {
    diagnostics.push(`Yahoo SPX chart failed: ${String(spxChartResult.reason)}`);
  }

  const vixChart =
    vixChartResult.status === "fulfilled" ? vixChartResult.value : null;
  if (vixChartResult.status === "rejected") {
    diagnostics.push(`Yahoo VIX chart failed: ${String(vixChartResult.reason)}`);
  }

  const vtiChart =
    vtiChartResult.status === "fulfilled" ? vtiChartResult.value : null;
  if (vtiChartResult.status === "rejected") {
    diagnostics.push(`Yahoo VTI chart failed: ${String(vtiChartResult.reason)}`);
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

  const fci =
    fciResult.status === "fulfilled" ? fciResult.value : null;
  if (fciResult.status === "rejected") {
    diagnostics.push(`FCI failed: ${String(fciResult.reason)}`);
  }

  if (spxChart?.price != null) {
    metrics.spx_price = Number(spxChart.price.toFixed(2));
  }
  if (spxChart?.closes?.length) {
    const ma20 = movingAverage(spxChart.closes, 20);
    const ma50 = movingAverage(spxChart.closes, 50);
    const ma100 = movingAverage(spxChart.closes, 100);
    const ma200 = movingAverage(spxChart.closes, 200);

    if (ma20 !== null) metrics.spx_20dma = { level: ma20 };
    if (ma50 !== null) metrics.spx_50dma = { level: ma50 };
    if (ma100 !== null) metrics.spx_100dma = { level: ma100 };
    if (ma200 !== null) metrics.spx_200dma = { level: ma200 };
  }

  if (vixChart?.price != null) {
    metrics.vix = Number(vixChart.price.toFixed(2));
  }

  if (vtiChart?.price != null) {
    metrics.vti_price = Number(vtiChart.price.toFixed(2));
  }
  if (vtiChart?.closes?.length) {
    const ma20 = movingAverage(vtiChart.closes, 20);
    const ma50 = movingAverage(vtiChart.closes, 50);
    const ma100 = movingAverage(vtiChart.closes, 100);
    const ma200 = movingAverage(vtiChart.closes, 200);

    if (ma20 !== null) metrics.vti_20dma = { level: ma20 };
    if (ma50 !== null) metrics.vti_50dma = { level: ma50 };
    if (ma100 !== null) metrics.vti_100dma = { level: ma100 };
    if (ma200 !== null) metrics.vti_200dma = { level: ma200 };
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

  if (fci !== null) {
    metrics.fci = Number(fci.toFixed(2));
  }

  Object.assign(metrics, parseValuationSnapshot());

  return NextResponse.json({
    asOf: new Date().toISOString(),
    source: "LIVE_YAHOO_FRED",
    status: "Connected",
    metrics,
    diagnostics,
  } satisfies SnapshotPayload);
}
