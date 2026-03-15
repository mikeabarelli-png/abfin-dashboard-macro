async function getFredSeries(seriesId: string, limit = 1) {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${process.env.FRED_API_KEY}&file_type=json&sort_order=desc&limit=${limit}`;
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();

  return (data.observations ?? [])
    .map((o: { value: string }) => Number(o.value))
    .filter((v: number) => Number.isFinite(v));
}

function avg(values: number[], n: number) {
  const slice = values.slice(0, n);
  return slice.reduce((sum, v) => sum + v, 0) / slice.length;
}

export async function GET() {
  try {
    const [sp500Series, vixSeries, hySeries, curveSeries, dxySeries] = await Promise.all([
      getFredSeries("SP500", 250),
      getFredSeries("VIXCLS", 5),
      getFredSeries("BAMLH0A0HYM2", 5),
      getFredSeries("T10Y2Y", 5),
      getFredSeries("DTWEXBGS", 5),
    ]);

    const spx_price = sp500Series[0];
    const spx_20dma = avg(sp500Series, 20);
    const spx_50dma = avg(sp500Series, 50);
    const spx_100dma = avg(sp500Series, 100);
    const spx_200dma = avg(sp500Series, 200);

    return Response.json({
      source: "LIVE",
      status: "Connected",
      asOf: new Date().toISOString(),
      metrics: {
        spx_price,
        spx_20dma: { level: Number(spx_20dma.toFixed(2)) },
        spx_50dma: { level: Number(spx_50dma.toFixed(2)) },
        spx_100dma: { level: Number(spx_100dma.toFixed(2)) },
        spx_200dma: { level: Number(spx_200dma.toFixed(2)) },
        vix: vixSeries[0] ?? null,
        hy_spread: hySeries[0] ?? null,
        yield_curve_10y_2y: curveSeries[0] ?? null,
        dxy: dxySeries[0] ?? null,
      },
    });
  } catch (err) {
    return Response.json({
      source: "FALLBACK",
      status: "Live route failed",
      metrics: {},
    });
  }
}
