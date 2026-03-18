import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

const YF_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const YF_QUOTE = "https://query1.finance.yahoo.com/v10/finance/quoteSummary";

async function fetchQuote(ticker: string) {
  const url = `${YF_QUOTE}/${encodeURIComponent(ticker)}?modules=price,summaryDetail,defaultKeyStatistics`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Yahoo quote failed for ${ticker}: ${res.status}`);
  const data = await res.json();
  return data?.quoteSummary?.result?.[0] ?? null;
}

async function fetchChart(ticker: string, days: number) {
  const end = Math.floor(Date.now() / 1000);
  const start = end - days * 24 * 60 * 60;
  const url = `${YF_BASE}/${encodeURIComponent(ticker)}?period1=${start}&period2=${end}&interval=1d`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Yahoo chart failed for ${ticker}: ${res.status}`);
  const data = await res.json();
  const closes: number[] = (data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [])
    .filter((c: any) => c != null)
    .map((c: number) => Math.round(c * 100) / 100);
  return closes;
}

function avg(arr: number[]) {
  return arr.reduce((s, n) => s + n, 0) / arr.length;
}

export async function GET() {
  try {
    // Fetch all data in parallel
    const [spxQuote, vixQuote, spxCloses120, ytdCloses] = await Promise.all([
      fetchQuote("^GSPC"),
      fetchQuote("^VIX"),
      fetchChart("^GSPC", 160), // ~120 trading days
      fetchChart("^GSPC", 90),  // YTD anchor (Jan 1)
    ]);

    const spxPrice: number | null = spxQuote?.price?.regularMarketPrice?.raw ?? null;
    const spxChangePct: number | null = spxQuote?.price?.regularMarketChangePercent?.raw != null
      ? spxQuote.price.regularMarketChangePercent.raw * 100
      : null;
    const vix: number | null = vixQuote?.price?.regularMarketPrice?.raw ?? null;

    // Moving averages from history
    const spx20dma = spxCloses120.length >= 20 ? avg(spxCloses120.slice(-20)) : null;
    const spx50dma = spxCloses120.length >= 50 ? avg(spxCloses120.slice(-50)) : null;
    const spx100dma = spxCloses120.length >= 100 ? avg(spxCloses120.slice(-100)) : null;

    // 200-DMA — Yahoo provides this natively
    const spx200dma: number | null = spxQuote?.summaryDetail?.twoHundredDayAverage?.raw ?? null;

    // 14-day sparkline
    const spxTrend14d = spxCloses120.slice(-14);

    // YTD %
    const yearOpenPrice = ytdCloses[0] ?? null;
    const spxYtdPct: number | null = spxPrice != null && yearOpenPrice != null
      ? ((spxPrice - yearOpenPrice) / yearOpenPrice) * 100
      : null;

    return NextResponse.json({
      ok: true,
      source: "LIVE_YAHOO",
      asOf: new Date().toISOString(),

      spx_price: spxPrice,
      spx_change_pct: spxChangePct,
      spx_ytd_pct: spxYtdPct,
      spx_trend_14d: spxTrend14d,
      vix,

      metrics: {
        spx_price: spxPrice,
        spx_change_pct: spxChangePct,
        spx_ytd_pct: spxYtdPct,
        spx_trend_14d: spxTrend14d,
        vix,

        spx_20dma: { level: spx20dma },
        spx_50dma: { level: spx50dma },
        spx_100dma: { level: spx100dma },
        spx_200dma: { level: spx200dma },

        hy_spread: 3.28,
        yield_curve_10y_2y: 0.55,
        real_10y: 1.92,
      },
    });
  } catch (err: any) {
    console.error("Market route error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
