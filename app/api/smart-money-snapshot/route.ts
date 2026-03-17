import { NextResponse } from "next/server";
import yahooFinance from "yahoo-finance2";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET() {
  try {
    // Fetch SPX quote, VIX quote, and 60 days of SPX history all at once
    const [spxQuote, vixQuote, spxChart] = await Promise.all([
      yahooFinance.quote("^GSPC"),
      yahooFinance.quote("^VIX"),
      yahooFinance.chart("^GSPC", {
        period1: (() => {
          const d = new Date();
          d.setDate(d.getDate() - 120); // 120 calendar days to get ~100 trading days
          return d;
        })(),
        interval: "1d",
      }),
    ]);

    const spxPrice = spxQuote.regularMarketPrice ?? null;
    const spxChangePct = spxQuote.regularMarketChangePercent ?? null;
    const vix = vixQuote.regularMarketPrice ?? null;

    // Pull all closing prices from chart history
    const allCloses = (spxChart.quotes ?? [])
      .filter((q) => q.close != null)
      .map((q) => q.close as number);

    // Last 14 trading days for the sparkline
    const spxTrend14d = allCloses.slice(-14);

    // Compute moving averages from history
    const avg = (arr: number[]) =>
      arr.reduce((sum, n) => sum + n, 0) / arr.length;

    const spx20dma = allCloses.length >= 20 ? avg(allCloses.slice(-20)) : null;
    const spx100dma = allCloses.length >= 100 ? avg(allCloses.slice(-100)) : null;

    // Yahoo provides these natively
    const spx50dma = spxQuote.fiftyDayAverage ?? null;
    const spx200dma = spxQuote.twoHundredDayAverage ?? null;

    // YTD: fetch Jan 1 as anchor
    const ytdChart = await yahooFinance.chart("^GSPC", {
      period1: new Date(new Date().getFullYear(), 0, 1), // Jan 1 this year
      interval: "1d",
    });
    const ytdCloses = (ytdChart.quotes ?? [])
      .filter((q) => q.close != null)
      .map((q) => q.close as number);
    const yearOpenPrice = ytdCloses[0] ?? null;
    const spxYtdPct =
      spxPrice != null && yearOpenPrice != null
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

        // These remain hardcoded for now — need a separate data source
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
