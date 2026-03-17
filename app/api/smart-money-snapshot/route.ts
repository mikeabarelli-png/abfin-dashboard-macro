export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [quoteRes, chartRes] = await Promise.all([
      fetch(
        "https://query1.finance.yahoo.com/v7/finance/quote?symbols=%5EGSPC,%5EVIX",
        {
          cache: "no-store",
          headers: {
            "User-Agent": "Mozilla/5.0",
            Accept: "application/json",
          },
        }
      ),
      fetch(
        "https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?range=1mo&interval=1d",
        {
          cache: "no-store",
          headers: {
            "User-Agent": "Mozilla/5.0",
            Accept: "application/json",
          },
        }
      ),
    ]);

    if (!quoteRes.ok) {
      throw new Error(`Quote request failed: ${quoteRes.status}`);
    }

    if (!chartRes.ok) {
      throw new Error(`Chart request failed: ${chartRes.status}`);
    }

    const quoteJson = await quoteRes.json();
    const chartJson = await chartRes.json();

    const quotes = quoteJson?.quoteResponse?.result ?? [];

    const spxQuote =
      quotes.find((q: any) => q.symbol === "^GSPC") ??
      quotes.find((q: any) => q.shortName?.includes("S&P 500"));

    const vixQuote =
      quotes.find((q: any) => q.symbol === "^VIX") ??
      quotes.find((q: any) => q.shortName?.includes("Volatility"));

    if (!spxQuote) {
      throw new Error("Could not find ^GSPC quote in Yahoo response");
    }

    const closesRaw =
      chartJson?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];

    const closes = closesRaw
      .filter((x: unknown) => typeof x === "number" && Number.isFinite(x))
      .slice(-14);

    const spxPrice = Number(spxQuote.regularMarketPrice ?? 0);
    const spxChangePct = Number(spxQuote.regularMarketChangePercent ?? 0);
    const vix = Number(vixQuote?.regularMarketPrice ?? 0);

    return Response.json(
      {
        source: "LIVE_YAHOO",
        asOf: new Date().toISOString(),

        spx_price: spxPrice,
        spx_change_pct: spxChangePct,
        spx_ytd_pct: -2.13, // placeholder until you wire true YTD calc
        spx_trend_14d: closes,

        vix,

        metrics: {
          spx_price: spxPrice,
          spx_change_pct: spxChangePct,
          spx_ytd_pct: -2.13,
          spx_trend_14d: closes,
          vix,

          // keep your current dashboard values alive until fully wired
          spx_20dma: { level: 6822.68 },
          spx_50dma: { level: 6881.21 },
          spx_100dma: { level: 6841.88 },
          spx_200dma: { level: 6608.12 },

          hy_spread: 3.28,
          yield_curve_10y_2y: 0.55,
          real_10y: 1.92,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error: any) {
    return Response.json(
      {
        error: "Failed to fetch live market data",
        detail: error?.message ?? "Unknown error",
      },
      { status: 500 }
    );
  }
}
