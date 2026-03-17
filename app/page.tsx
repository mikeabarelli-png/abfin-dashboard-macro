export default function SmartMoneyDashboardFrontendV2() {
  const trendTiles = [
    {
      label: "S&P 500",
      value: "6,699",
      subline: "▼ 0.6% today",
      ytd: "-2.13% YTD",
      tone: "danger",
      kind: "spx",
      trend: [
        6946.13, 6908.86, 6878.88, 6881.62, 6816.63, 6869.5, 6830.71,
        6740.02, 6795.99, 6781.48, 6775.8, 6672.62, 6632.19, 6699.38,
      ],
    },
    {
      label: "20-DMA",
      value: "6,823",
      status: "Broken Below",
      subline: "SPX -1.8% below",
      tone: "danger",
      kind: "ma",
    },
    {
      label: "50-DMA",
      value: "6,881",
      status: "Broken Below",
      subline: "SPX -2.6% below",
      tone: "danger",
      kind: "ma",
    },
    {
      label: "100-DMA",
      value: "6,842",
      status: "Broken Below",
      subline: "SPX -2.1% below",
      tone: "danger",
      kind: "ma",
    },
    {
      label: "200-DMA",
      value: "6,608",
      status: "Testing Support",
      subline: "SPX +1.4% above",
      tone: "warning",
      kind: "ma",
    },
  ];

  const stressTiles = [
    { label: "VIX", value: "23.5", subline: "Warning", scale: [0, 30, 100], pos: 34, tone: "warning" },
    { label: "VIX / VXV", value: "—", subline: "Awaiting feed", scale: [0, 1, 2], pos: 50, tone: "neutral" },
    { label: "HY Spread", value: "3.28%", subline: "Watch", scale: [2, 4, 6], pos: 38, tone: "warning" },
    { label: "DXY", value: "—", subline: "Not in v1", scale: [90, 105, 115], pos: 52, tone: "neutral" },
    { label: "Yield Curve", value: "0.55%", subline: "Healthy", scale: [-1, 0, 1.5], pos: 62, tone: "healthy" },
    { label: "Real 10Y", value: "1.92%", subline: "Firm", scale: [0, 2, 3], pos: 58, tone: "warning" },
    { label: "Equity Risk Premium", value: "—%", subline: "Manual / later", scale: [0, 1, 5], pos: 18, tone: "neutral" },
  ];

  const damageCount = trendTiles.filter((t) => t.kind === "ma" && t.status === "Broken Below").length;
  const totalMA = trendTiles.filter((t) => t.kind === "ma").length;

  const sparkline = (points) => {
    const w = 120;
    const h = 28;
    const max = Math.max(...points);
    const min = Math.min(...points);
    const range = Math.max(1, max - min);

    const coords = points
      .map((p, i) => {
        const x = (i / (points.length - 1)) * w;
        const y = h - ((p - min) / range) * h;
        return `${x},${y}`;
      })
      .join(" ");

    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 w-full">
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={coords}
          className="text-slate-300"
        />
      </svg>
    );
  };

  const badgeTone = (tone) => {
    if (tone === "warning") return "bg-amber-400 text-slate-950";
    return "bg-rose-500 text-white";
  };

  const textTone = (tone) => {
    if (tone === "warning") return "text-amber-300";
    if (tone === "healthy") return "text-emerald-400";
    if (tone === "neutral") return "text-slate-300";
    return "text-rose-400";
  };

  const barTone = (tone) => {
    if (tone === "warning") return "bg-amber-400";
    if (tone === "healthy") return "bg-emerald-400";
    return "bg-slate-300";
  };

  return (
    <div className="min-h-screen bg-[#0b0b2a] text-white">
      <div className="mx-auto max-w-[1400px] border-x-4 border-t-4 border-slate-100/90 px-4 pb-4 pt-3">

        <div className="flex items-start justify-between gap-4 pb-4">
          <h1 className="text-2xl font-extrabold text-green-600 sm:text-3xl">
            Prospect Market Dashboard
          </h1>
          <div className="text-right text-sm font-semibold text-slate-200">
            <div>Source: LIVE_YAHOO_FRED</div>
            <div>Mar 16, 6:43 PM</div>
          </div>
        </div>

        <div className="mb-3 rounded-xl bg-[#1e1b4f] px-4 py-3 text-sm font-semibold">
          Connected
        </div>

        <section className="rounded-xl bg-[#23255a] p-3">
          <div className="mb-3 flex justify-between">
            <div>
              <div className="text-xl font-extrabold">Market Structure</div>
              <div className="text-xs text-slate-300 mt-1">
                Price vs Key Moving Averages
              </div>
            </div>
            <div className="text-sm text-slate-300">
              {damageCount} / {totalMA} short-term trends broken
            </div>
          </div>

          {/* 🔥 FIXED GRID */}
          <div className="grid grid-cols-5 gap-2">
            {trendTiles.map((tile) => (
              <div key={tile.label} className="rounded-lg bg-[#050a35] p-3">

                <div className="flex justify-between mb-2">
                  <div className="font-bold">{tile.label}</div>

                  {tile.kind === "spx" ? (
                    <div className="text-xs text-slate-300">{tile.ytd}</div>
                  ) : (
                    <div className={`h-5 w-5 flex items-center justify-center rounded-full ${badgeTone(tile.tone)}`}>
                      !
                    </div>
                  )}
                </div>

                <div className="text-2xl font-extrabold">{tile.value}</div>

                {tile.kind === "spx" && sparkline(tile.trend)}

                {tile.status && (
                  <div className={`mt-2 text-xs font-bold uppercase ${textTone(tile.tone)}`}>
                    {tile.status}
                  </div>
                )}

                <div className={`mt-1 text-xs ${textTone(tile.tone)}`}>
                  {tile.subline}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-4 rounded-xl bg-[#171949] p-3">
          <h2 className="mb-3 text-xl font-extrabold">Market Stress</h2>

          {/* 🔥 FIXED GRID */}
          <div className="grid grid-cols-5 gap-2">
            {stressTiles.map((tile) => (
              <div key={tile.label} className="rounded-lg bg-[#050a35] p-3">

                <div className="font-bold">{tile.label}</div>
                <div className="mt-2 text-xl font-extrabold">{tile.value}</div>
                <div className={`mt-2 text-sm ${textTone(tile.tone)}`}>
                  {tile.subline}
                </div>

                <div className="mt-3">
                  <div className="relative h-1 bg-[#202a64] rounded">
                    <div
                      className={`absolute h-1 ${barTone(tile.tone)}`}
                      style={{ width: `${tile.pos}%` }}
                    />
                  </div>
                </div>

              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
