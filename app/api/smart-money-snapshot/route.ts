import { NextResponse } from "next/server";

// Using require to bypass strict yahoo-finance2 TypeScript types
// eslint-disable-next-line @typescript-eslint/no-var-requires
const yahooFinance = require("yahoo-finance2").default;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET() {
  try {
    const [spxQuote, vixQuote, spxChart] = await Promise.all([
      yahooFinance.quote("^GSPC"),
      yahooFinance.quote("^VIX"),
      yahooFinance.chart("^GSPC", {
        period1: (() => {
          const d = new Date();
          d.setDate(d.getDate() - 120);
          return d;
        })(),
        interval: "1d",
      }),
    ]);

    const spxPrice: number | null = spxQuote?.regularMarketPrice ?? null;
    const spxChangePct: number | null = spxQuote?.regularMarketChangePercent ?? null;
    const vix: number | null = vixQuote?.regularMarketPrice ?? null;

    const allCloses: number[] = (spxChart?.quotes ?? [])
      .filter((q: any) => q.close != null)
      .map((q: any) => Number(q.close));

    const spxTrend14d = allCloses.slice(-14);

    const avg = (arr: number[]) =>
      arr.reduce((sum, n) => sum + n, 0) / arr.length;

    const spx20dma = allCloses.length >= 20 ? avg(allCloses.slice(-20)) : null;
    const spx100dma = allCloses.length >= 100 ? avg(allCloses.slice(-100)) : null;
    const spx50dma: number | null = spxQuote?.fiftyDayAverage ?? null;
    const spx200dma: number | null = spxQuote?.twoHundredDayAverage ?? null;

    const ytdChart = await yahooFinance.chart("^GSPC", {
      period1: new Date(new Date().getFullYear(), 0, 1),
      interval: "1d",
    });

    const ytdCloses: number[] = (ytdChart?.quotes ?? [])
      .filter((q: any) => q.close != null)
      .map((q: any) => Number(q.close));

    const yearOpenPrice = ytdCloses[0] ?? null;
    const spxYtdPct: number | null =
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
