import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET() {
  return NextResponse.json({
    ok: true,
    source: "ROUTE_TEST",
    asOf: new Date().toISOString(),

    spx_price: 6735.26,
    spx_change_pct: 0.54,
    spx_ytd_pct: -1.62,
    spx_trend_14d: [
      6946.13, 6908.86, 6878.88, 6881.62, 6816.63, 6869.5, 6830.71,
      6740.02, 6795.99, 6781.48, 6775.8, 6672.62, 6632.19, 6735.26,
    ],

    vix: 23.5,

    metrics: {
      spx_price: 6735.26,
      spx_change_pct: 0.54,
      spx_ytd_pct: -1.62,
      spx_trend_14d: [
        6946.13, 6908.86, 6878.88, 6881.62, 6816.63, 6869.5, 6830.71,
        6740.02, 6795.99, 6781.48, 6775.8, 6672.62, 6632.19, 6735.26,
      ],
      vix: 23.5,

      spx_20dma: { level: 6822.68 },
      spx_50dma: { level: 6881.21 },
      spx_100dma: { level: 6841.88 },
      spx_200dma: { level: 6608.12 },

      hy_spread: 3.28,
      yield_curve_10y_2y: 0.55,
      real_10y: 1.92,
    },
  });
}
