export async function GET() {
  try {
    const spy = await fetch(
      `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=SPY&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`
    ).then((r) => r.json());

    const spx_price = Number(spy["Global Quote"]?.["05. price"]);

    const vix = await fetch(
      `https://api.stlouisfed.org/fred/series/observations?series_id=VIXCLS&api_key=${process.env.FRED_API_KEY}&file_type=json`
    ).then((r) => r.json());

    const hy = await fetch(
      `https://api.stlouisfed.org/fred/series/observations?series_id=BAMLH0A0HYM2&api_key=${process.env.FRED_API_KEY}&file_type=json`
    ).then((r) => r.json());

    const curve = await fetch(
      `https://api.stlouisfed.org/fred/series/observations?series_id=T10Y2Y&api_key=${process.env.FRED_API_KEY}&file_type=json`
    ).then((r) => r.json());

    const dxy = await fetch(
      `https://api.stlouisfed.org/fred/series/observations?series_id=DTWEXBGS&api_key=${process.env.FRED_API_KEY}&file_type=json`
    ).then((r) => r.json());

    return Response.json({
      source: "LIVE",
      status: "Connected",
      asOf: new Date().toISOString(),
      metrics: {
        spx_price,
        vix: Number(vix.observations?.slice(-1)[0]?.value),
        hy_spread: Number(hy.observations?.slice(-1)[0]?.value),
        yield_curve_10y_2y: Number(curve.observations?.slice(-1)[0]?.value),
        dxy: Number(dxy.observations?.slice(-1)[0]?.value),
      },
    });
  } catch (err) {
    return Response.json({
      status: "Live route failed",
      source: "fallback",
    });
  }
}
