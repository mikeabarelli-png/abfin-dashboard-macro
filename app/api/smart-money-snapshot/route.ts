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

const FRED_BASE =
  "https://api.stlouisfed.org/fred/series/observations";

const ALPHA_BASE =
  "https://www.alphavantage.co/query";

const POLYGON_BASE =
  "https://api.polygon.io";

const FRED_SERIES = {
  sp500: "SP500",
  tenYear: "DGS10",
  twoYear: "DGS2",
  realTenYear: "DFII10",
  hySpread: "BAMLH0A0HYM2",
  dollar: "DTWEXBGS",
  fci: "NFCI"
};

function movingAverage(
  data: number[],
  period: number
) {
  if (data.length < period) return null;

  const slice = data.slice(0, period);

  return Number(
    (
      slice.reduce((a, b) => a + b, 0) / period
    ).toFixed(2)
  );
}

async function fetchJson(url: string) {
  const res = await fetch(url, {
    cache: "no-store",
  });

  if (!res.ok)
    throw new Error(`HTTP ${res.status}`);

  return res.json();
}

async function fredLatest(
  series: string,
  key: string
) {
  const url =
    `${FRED_BASE}?series_id=${series}` +
    `&api_key=${key}&file_type=json` +
    `&sort_order=desc&limit=10`;

  const data = await fetchJson(url);

  for (const o of data.observations) {
    const v = Number(o.value);
    if (!isNaN(v)) return v;
  }

  return null;
}

async function fredSeries(
  series: string,
  key: string
) {
  const url =
    `${FRED_BASE}?series_id=${series}` +
    `&api_key=${key}&file_type=json` +
    `&sort_order=desc&limit=250`;

  const data = await fetchJson(url);

  return data.observations
    .map((o: any) => Number(o.value))
    .filter((v: number) => !isNaN(v));
}

async function alphaDaily(
  symbol: string,
  key: string
) {
  const url =
    `${ALPHA_BASE}?function=TIME_SERIES_DAILY_ADJUSTED` +
    `&symbol=${symbol}&outputsize=full&apikey=${key}`;

  const data = await fetchJson(url);

  const series =
    data["Time Series (Daily)"];

  const closes = Object.entries(series)
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(
      ([, v]: any) =>
        Number(v["5. adjusted close"])
    )
    .filter((v) => !isNaN(v));

  return closes;
}

async function alphaQuote(
  symbol: string,
  key: string
) {
  const url =
    `${ALPHA_BASE}?function=GLOBAL_QUOTE` +
    `&symbol=${symbol}&apikey=${key}`;

  const data = await fetchJson(url);

  const quote =
    data["Global Quote"];

  return Number(quote?.["05. price"]);
}

async function polygonIndex(
  key: string,
  ticker: string
) {
  const url =
    `${POLYGON_BASE}/v3/snapshot/indices/${ticker}` +
    `?apiKey=${key}`;

  const data = await fetchJson(url);

  return (
    data?.results?.value ??
    data?.results?.session?.close ??
    null
  );
}

async function polygonTicker(
  key: string,
  ticker: string
) {
  const url =
    `${POLYGON_BASE}/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}` +
    `?apiKey=${key}`;

  const data = await fetchJson(url);

  return (
    data?.ticker?.lastTrade?.p ??
    data?.ticker?.day?.c ??
    null
  );
}

export async function GET() {
  const fred = process.env.FRED_API_KEY;
  const alpha =
    process.env.ALPHA_VANTAGE_API_KEY;
  const polygon =
    process.env.POLYGON_API_KEY;

  const diagnostics: string[] = [];
  const metrics: SnapshotMetrics = {};

  const [
    spxSeries,
    tenYear,
    twoYear,
    real10,
    hy,
    dxy,
    fci,
    vtiDaily,
    vtiQuote,
    spxRT,
    vixRT,
    vtiRT
  ] = await Promise.all([
    fredSeries(FRED_SERIES.sp500, fred!),
    fredLatest(FRED_SERIES.tenYear, fred!),
    fredLatest(FRED_SERIES.twoYear, fred!),
    fredLatest(FRED_SERIES.realTenYear, fred!),
    fredLatest(FRED_SERIES.hySpread, fred!),
    fredLatest(FRED_SERIES.dollar, fred!),
    fredLatest(FRED_SERIES.fci, fred!),
    alphaDaily("VTI", alpha!),
    alphaQuote("VTI", alpha!),
    polygon
      ? polygonIndex(polygon, "I:SPX")
      : null,
    polygon
      ? polygonIndex(polygon, "I:VIX")
      : null,
    polygon
      ? polygonTicker(polygon, "VTI")
      : null
  ]);

  const spxCurrent =
    spxRT ?? spxSeries[0];

  metrics.spx_price = spxCurrent;

  const ma20 = movingAverage(spxSeries, 20);
  const ma50 = movingAverage(spxSeries, 50);
  const ma100 = movingAverage(spxSeries, 100);
  const ma200 = movingAverage(spxSeries, 200);

  if (ma20)
    metrics.spx_20dma = { level: ma20 };
  if (ma50)
    metrics.spx_50dma = { level: ma50 };
  if (ma100)
    metrics.spx_100dma = { level: ma100 };
  if (ma200)
    metrics.spx_200dma = { level: ma200 };

  const vtiCurrent =
    vtiRT ?? vtiQuote ?? vtiDaily[0];

  metrics.vti_price = vtiCurrent;

  const vti20 = movingAverage(vtiDaily, 20);
  const vti50 = movingAverage(vtiDaily, 50);
  const vti100 = movingAverage(vtiDaily, 100);
  const vti200 = movingAverage(vtiDaily, 200);

  if (vti20)
    metrics.vti_20dma = { level: vti20 };
  if (vti50)
    metrics.vti_50dma = { level: vti50 };
  if (vti100)
    metrics.vti_100dma = { level: vti100 };
  if (vti200)
    metrics.vti_200dma = { level: vti200 };

  if (vixRT)
    metrics.vix = Number(vixRT.toFixed(2));

  if (tenYear && twoYear)
    metrics.yield_curve_10y_2y =
      Number((tenYear - twoYear).toFixed(2));

  if (real10)
    metrics.real_10y_yield =
      Number(real10.toFixed(2));

  if (hy)
    metrics.hy_spread =
      Number(hy.toFixed(2));

  if (dxy)
    metrics.dxy =
      Number(dxy.toFixed(2));

  if (fci)
    metrics.fci =
      Number(fci.toFixed(2));

  return NextResponse.json({
    asOf: new Date().toISOString(),
    source: polygon
      ? "LIVE_RT"
      : "LIVE_DAILY_MIXED",
    status: "Connected",
    metrics,
    diagnostics
  });
}
