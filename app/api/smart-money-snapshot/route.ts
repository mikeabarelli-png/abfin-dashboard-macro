import { NextResponse } from "next/server"

const FRED_KEY = process.env.FRED_API_KEY
const ALPHA_KEY = process.env.ALPHA_VANTAGE_API_KEY

async function fred(series: string, limit = 1) {
  const url =
    `https://api.stlouisfed.org/fred/series/observations` +
    `?series_id=${series}&api_key=${FRED_KEY}&file_type=json&sort_order=desc&limit=${limit}`

  const res = await fetch(url, { cache: "no-store" })
  const data = await res.json()

  return (data.observations ?? [])
    .map((o: any) => Number(o.value))
    .filter((v: number) => Number.isFinite(v))
}

async function alpha(symbol: string) {
  const url =
    `https://www.alphavantage.co/query` +
    `?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${symbol}&apikey=${ALPHA_KEY}`

  const res = await fetch(url, { cache: "no-store" })
  const data = await res.json()

  const series = data["Time Series (Daily)"] ?? {}

  const closes = Object.values(series)
    .map((d: any) => Number(d["5. adjusted close"]))
    .filter((v: number) => Number.isFinite(v))

  return closes
}

function avg(arr: number[], n: number) {
  const slice = arr.slice(0, n)
  return slice.reduce((a, b) => a + b, 0) / slice.length
}

export async function GET() {

  const [
    spx,
    vti,
    tenY,
    twoY,
    realY,
    hy,
    vix
  ] = await Promise.all([

    fred("SP500", 250),
    alpha("VTI"),

    fred("DGS10"),
    fred("DGS2"),
    fred("DFII10"),
    fred("BAMLH0A0HYM2"),

    alpha("VIX")

  ])

  const spx_price = spx[0]

  const metrics = {

    spx_price,

    spx_20dma: { level: avg(spx,20) },
    spx_50dma: { level: avg(spx,50) },
    spx_100dma:{ level: avg(spx,100) },
    spx_200dma:{ level: avg(spx,200) },

    vti_price: vti[0],

    vti_20dma:{ level: avg(vti,20) },
    vti_50dma:{ level: avg(vti,50) },
    vti_100dma:{ level: avg(vti,100) },
    vti_200dma:{ level: avg(vti,200) },

    vix: vix[0],

    hy_spread: hy[0],

    yield_curve_10y_2y:
      (tenY[0] ?? 0) - (twoY[0] ?? 0),

    real_10y_yield: realY[0]

  }

  return NextResponse.json({
    asOf: new Date().toISOString(),
    source: "LIVE",
    status: "Connected",
    metrics
  })
}
