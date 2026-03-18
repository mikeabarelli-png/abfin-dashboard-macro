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

async function fetchFred(seriesId: string): Promise<{ value: number | null; error?: string }> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) return { value: null, error: "FRED_API_KEY not set" };
  const url = `${FRED}?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=1`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return { value: null, error: `FRED ${seriesId}: HTTP ${res.status}` };
    const data = await res.json();
    const obs = data?.observations?.[0];
    const val = obs?.value && obs.value !== "." ? parseFloat(obs.value) : null;
    console.log(`FRED ${seriesId}: ${val}`);
    return { value: val };
  } catch (err: any) {
    return { value: null, error: `FRED ${seriesId}: ${err?.message}` };
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

export async function GET() {
  const diagnostics: Record<string, string> = {};

  // 420 calendar days = ~290 trading days — enough for full 200-DMA on 1Y chart
  const [spx, vix, fredReal10y, fredHY, fredYC, peData] = await Promise.all([
    fetchChart("^GSPC", 420),
    fetchChart("^VIX", 5),
    fetchFred("DFII10"),
    fetchFred("BAMLH0A0HYM2"),
    fetchFred("T10Y2Y"),
    fetchPE(),
  ]);

  if (spx.error) diagnostics["spx"] = spx.error;
  if (vix.error) diagnostics["vix"] = vix.error;
  if (fredReal10y.error) diagnostics["real10y"] = fredReal10y.error;
  if (fredHY.error) diagnostics["hy"] = fredHY.error;
  if (fredYC.error) diagnostics["yc"] = fredYC.error;
  if (peData.error) diagnostics["pe"] = peData.error;

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

  const vixPrice: number | null = vix.meta.regularMarketPrice ?? vix.closes[vix.closes.length - 1] ?? null;

  const real10y: number = fredReal10y.value ?? 1.92;
  const hySpread: number = fredHY.value != null ? fredHY.value / 100 : 3.28;
  const yieldCurve: number = fredYC.value ?? 0.55;

  const trailingPE: number | null = peData.value ?? spx.meta.trailingPE ?? null;
  let erp: number | null = null;
  if (trailingPE != null && trailingPE > 0) {
    const earningsYield = (1 / trailingPE) * 100;
    erp = Math.round((earningsYield - real10y) * 100);
    console.log(`ERP: ${erp} bps`);
  }

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
      spx_20dma: { level: spx20dma },
      spx_50dma: { level: spx50dma },
      spx_100dma: { level: spx100dma },
      spx_200dma: { level: spx200dma },
      hy_spread: hySpread,
      yield_curve_10y_2y: yieldCurve,
      real_10y: real10y,
      erp_bps: erp,
      trailing_pe: trailingPE,
    },
  }, { status: 200 });
}
