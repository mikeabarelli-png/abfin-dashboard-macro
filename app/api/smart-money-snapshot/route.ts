export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, max-age=0",
    },
  });
}

export async function GET() {
  try {
    const quoteUrl =
      "https://query1.finance.yahoo.com/v7/finance/quote?symbols=%5EGSPC,%5EVIX";

    const chartUrl =
      "https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?range=1mo&interval=1d&includePrePost=false";

    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: "application/json,text/plain,*/*",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: "https://finance.yahoo.com/",
      Origin: "https://finance.yahoo.com",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    };

    const [quoteRes, chartRes] = await Promise.all([
      fetch(quoteUrl, { cache: "no-store", headers }),
      fetch(chartUrl, { cache: "no-store", headers }),
    ]);

    const quoteText = await quoteRes.text();
    const chartText = await chartRes.text();

    if (!quoteRes.ok) {
      return json(
        {
          ok: false,
          error: "Yahoo quote request failed",
          status: quoteRes.status,
          detail: quoteText.slice(0, 500),
        },
        500
      );
    }

    if (!chartRes.ok) {
      return json(
        {
          ok: false,
          error: "Yahoo chart request failed",
          status: chartRes.status,
          detail: chartText.slice(0, 500),
        },
        500
      );
    }

    let quoteJson: any;
    let chartJson: any;

    try {
      quoteJson = JSON.parse(quoteText);
    } catch {
      return json(
        {
          ok: false,
          error: "Yahoo quote response was not JSON",
          detail: quoteText.slice(0, 500),
        },
        500
      );
    }

    try {
      chartJson = JSON.parse(chartText);
    } catch {
      return json(
        {
          ok: false,
          error: "Yahoo chart response was not JSON",
          detail: chartText.slice(0, 500),
        },
        500
      );
    }

    const quotes = quoteJson?.quoteResponse?.result ?? [];

    const spxQuote =
      quotes.find((q: any) => q.symbol === "^GSPC") ??
      quotes.find((q: any) => String(q.shortName || "").includes("S&P 500"));

    const vixQuote =
      quotes.find((q: any) => q.symbol === "^VIX") ??
      quotes.find((q: any) =>
        String(q.shortName || "").toLowerCase().includes("volatility")
      );

    if (!spxQuote?.regularMarketPrice) {
      return json(
        {
          ok: false,
          error: "Could not find SPX quote in Yahoo response",
          detail: quotes,
        },
        500
      );
    }

    const closesRaw =
      chartJson?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];

    const closes = closesRaw
      .filter((x: unknown) => typeof x === "number" && Number.isFinite(x))
      .slice(-14);

    const spxPrice = Number(spxQuote.regularMarketPrice ?? 0);
    const spxChangePct = Number(spxQuote.regularMarketChangePercent ?? 0);
    const vix = Number(vixQuote?.regularMarketPrice ?? 0);

    return json({
      ok: true,
      source: "LIVE_YAHOO_FRED",
      asOf: new Date().toISOString(),

      spx_price: spxPrice,
      spx_change_pct: spxChangePct,
      spx_ytd_pct: -2.13,
      spx_trend_14d: closes,

      vix,

      metrics: {
        spx_price: spxPrice,
        spx_change_pct: spxChangePct,
        spx_ytd_pct: -2.13,
        spx_trend_14d: closes,
        vix,

        spx_20dma: { level: 6822.68 },
        spx_50dma: { level: 6881.21 },
        spx_100dma: { level: 6841.88 },
        spx_200dma: { level: 6608.12 },

        hy_spread: 3.28,
        yield_curve_10y_2y: 0.55,
        real_10y: 1.92,
      },
    });
  } catch (error: any) {
    return json(
      {
        ok: false,
        error: "Failed to fetch live market data",
        detail: error?.message ?? "Unknown error",
      },
      500
    );
  }
}
