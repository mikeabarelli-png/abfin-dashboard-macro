export default function Page() {
  const trendTiles = [
    {
      label: "S&P 500",
      value: "6,699",
      subline: "▼ 0.6% today",
      ytd: "-2.13% YTD",
      tone: "danger",
      kind: "spx",
      trend: [
        6946.13, 6908.86, 6878.88, 6881.62, 6816.63, 6869.5, 6830.71, 6740.02,
        6795.99, 6781.48, 6775.8, 6672.62, 6632.19, 6699.38,
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
    {
      label: "VIX",
      value: "23.5",
      subline: "Warning",
      scale: [0, 30, 100],
      pos: 34,
      tone: "warning",
    },
    {
      label: "VIX / VXV",
      value: "—",
      subline: "Awaiting feed",
      scale: [0, 1, 2],
      pos: 50,
      tone: "neutral",
    },
    {
      label: "HY Spread",
      value: "3.28%",
      subline: "Watch",
      scale: [2, 4, 6],
      pos: 38,
      tone: "warning",
    },
    {
      label: "DXY",
      value: "—",
      subline: "Not in v1",
      scale: [90, 105, 115],
      pos: 52,
      tone: "neutral",
    },
    {
      label: "Yield Curve",
      value: "0.55%",
      subline: "Healthy",
      scale: [-1, 0, 1.5],
      pos: 62,
      tone: "healthy",
    },
    {
      label: "Real 10Y",
      value: "1.92%",
      subline: "Firm",
      scale: [0, 2, 3],
      pos: 58,
      tone: "warning",
    },
    {
      label: "Equity Risk Premium",
      value: "—%",
      subline: "Manual / later",
      scale: [0, 1, 5],
      pos: 18,
      tone: "neutral",
    },
  ];

  const damageCount = trendTiles.filter(
    (t) => t.kind === "ma" && t.status === "Broken Below"
  ).length;
  const totalMA = trendTiles.filter((t) => t.kind === "ma").length;

  const sparkline = (points: number[]) => {
    const w = 160;
    const h = 34;
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
      <svg
        viewBox={`0 0 ${w} ${h}`}
        width="160"
        height="34"
        className="sparkline"
        aria-hidden="true"
      >
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={coords}
        />
      </svg>
    );
  };

  const badgeClass = (tone: string) => {
    if (tone === "warning") return "badge badge-warning";
    return "badge badge-danger";
  };

  const statusClass = (tone: string) => {
    if (tone === "warning") return "status status-warning";
    if (tone === "healthy") return "status status-healthy";
    if (tone === "neutral") return "status status-neutral";
    return "status status-danger";
  };

  const meterFillClass = (tone: string) => {
    if (tone === "warning") return "meterFill meterFill-warning";
    if (tone === "healthy") return "meterFill meterFill-healthy";
    return "meterFill meterFill-neutral";
  };

  return (
    <>
      <div className="pageShell">
        <div className="frame">
          <div className="topBar">
            <h1 className="pageTitle">Prospect Market Dashboard</h1>
            <div className="sourceBlock">
              <div>Source: LIVE_YAHOO_FRED</div>
              <div>Mar 16, 6:43 PM</div>
            </div>
          </div>

          <div className="connectedBar">Connected</div>

          <section className="panel">
            <div className="panelHeader">
              <div>
                <div className="panelTitle">Market Structure</div>
                <div className="panelSubtitle">Price vs Key Moving Averages</div>
              </div>
              <div className="damageText">
                {damageCount} / {totalMA} short-term trends broken
              </div>
            </div>

            <div className="trendGrid">
              {trendTiles.map((tile) => (
                <div key={tile.label} className="tile">
                  <div className="tileHeader">
                    <div className="tileLabel">{tile.label}</div>

                    {tile.kind === "spx" && tile.ytd ? (
                      <div className="tileYtd">{tile.ytd}</div>
                    ) : tile.kind === "ma" ? (
                      <div className={badgeClass(tile.tone)}>!</div>
                    ) : null}
                  </div>

                  <div className="tileValue">{tile.value}</div>

                  {tile.kind === "spx" && tile.trend ? (
                    <div className="sparklineWrap">{sparkline(tile.trend)}</div>
                  ) : null}

                  {tile.status ? (
                    <div className={statusClass(tile.tone)}>{tile.status}</div>
                  ) : null}

                  <div
                    className={
                      tile.kind === "spx"
                        ? "tileSubline tileSublineSpx"
                        : statusClass(tile.tone)
                    }
                    style={tile.kind === "spx" ? undefined : { marginTop: 10 }}
                  >
                    {tile.subline}
                  </div>
                </div>
              ))}
            </div>

            <div className="alertBox">
              <div className="alertTitle">
                200-DMA Proximity Alert — Immediate Watch
              </div>
              <div className="alertBody">
                S&amp;P 500 is only 1.4% above its 200-DMA (6,608).
              </div>
            </div>
          </section>

          <section className="panel stressPanel">
            <div className="panelTitle">Market Stress</div>

            <div className="stressGrid">
              {stressTiles.map((tile) => (
                <div key={tile.label} className="tile">
                  <div className="tileLabel">{tile.label}</div>
                  <div className="tileValue stressValue">{tile.value}</div>
                  <div className={statusClass(tile.tone)} style={{ marginTop: 12 }}>
                    {tile.subline}
                  </div>

                  <div className="meterWrap">
                    <div className="meterTrack">
                      <div
                        className={meterFillClass(tile.tone)}
                        style={{ width: `${tile.pos}%` }}
                      />
                      <div className="meterMarker" style={{ left: `${tile.pos}%` }} />
                    </div>
                    <div className="meterScale">
                      <span>{tile.scale[0]}</span>
                      <span>{tile.scale[1]}</span>
                      <span>{tile.scale[2]}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            * {
              box-sizing: border-box;
            }

            html, body {
              margin: 0;
              padding: 0;
              background: #0b0b2a;
              color: #ffffff;
              font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            }

            .pageShell {
              min-height: 100vh;
              background: #0b0b2a;
              color: #fff;
            }

            .frame {
              max-width: 1600px;
              margin: 0 auto;
              padding: 12px 16px 16px;
              border-top: 4px solid rgba(241, 245, 249, 0.9);
              border-left: 4px solid rgba(241, 245, 249, 0.9);
              border-right: 4px solid rgba(241, 245, 249, 0.9);
            }

            .topBar {
              display: flex;
              align-items: flex-start;
              justify-content: space-between;
              gap: 16px;
              padding-bottom: 16px;
            }

            .pageTitle {
              margin: 0;
              font-size: 48px;
              line-height: 1;
              font-weight: 900;
              color: #17a34a;
              letter-spacing: -0.03em;
            }

            .sourceBlock {
              text-align: right;
              font-size: 14px;
              line-height: 1.3;
              font-weight: 700;
              color: #e2e8f0;
            }

            .connectedBar {
              margin-bottom: 12px;
              border-radius: 14px;
              background: #1e1b4f;
              padding: 14px 16px;
              font-size: 14px;
              font-weight: 700;
              color: #f8fafc;
            }

            .panel {
              border-radius: 16px;
              background: #23255a;
              padding: 12px;
              box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
            }

            .stressPanel {
              margin-top: 16px;
              background: #171949;
            }

            .panelHeader {
              display: flex;
              align-items: flex-end;
              justify-content: space-between;
              gap: 12px;
              margin-bottom: 12px;
            }

            .panelTitle {
              font-size: 26px;
              line-height: 1.05;
              font-weight: 900;
              color: #fff;
              letter-spacing: -0.02em;
            }

            .panelSubtitle {
              margin-top: 4px;
              font-size: 12px;
              font-weight: 700;
              letter-spacing: 0.12em;
              color: #cbd5e1;
            }

            .damageText {
              font-size: 13px;
              font-weight: 700;
              color: #cbd5e1;
              white-space: nowrap;
            }

            .trendGrid {
              display: grid;
              grid-template-columns: repeat(5, minmax(0, 1fr));
              gap: 8px;
            }

            .stressGrid {
              display: grid;
              grid-template-columns: repeat(5, minmax(0, 1fr));
              gap: 8px;
            }

            .tile {
              border-radius: 10px;
              background: #050a35;
              padding: 14px 14px 12px;
              box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.02);
              min-width: 0;
            }

            .tileHeader {
              margin-bottom: 12px;
              display: flex;
              align-items: flex-start;
              justify-content: space-between;
              gap: 8px;
            }

            .tileLabel {
              font-size: 15px;
              font-weight: 900;
              color: #fff;
              letter-spacing: -0.01em;
            }

            .tileYtd {
              font-size: 12px;
              font-weight: 700;
              color: #cbd5e1;
              white-space: nowrap;
            }

            .tileValue {
              font-size: 44px;
              line-height: 0.95;
              font-weight: 900;
              letter-spacing: -0.04em;
              color: #fff;
            }

            .stressValue {
              margin-top: 14px;
              font-size: 34px;
            }

            .sparklineWrap {
              margin-top: 8px;
              height: 34px;
              display: flex;
              align-items: center;
            }

            .sparkline {
              display: block;
              color: #cbd5e1;
            }

            .tileSubline {
              margin-top: 10px;
              font-size: 14px;
              font-weight: 700;
            }

            .tileSublineSpx {
              color: #fb7185;
            }

            .badge {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: 20px;
              height: 20px;
              border-radius: 9999px;
              font-size: 11px;
              font-weight: 900;
            }

            .badge-danger {
              background: #f43f5e;
              color: white;
            }

            .badge-warning {
              background: #fbbf24;
              color: #111827;
            }

            .status {
              font-size: 14px;
              font-weight: 900;
              text-transform: uppercase;
              letter-spacing: 0.08em;
            }

            .status-danger {
              color: #fb7185;
            }

            .status-warning {
              color: #fde047;
            }

            .status-healthy {
              color: #4ade80;
            }

            .status-neutral {
              color: #cbd5e1;
            }

            .alertBox {
              margin-top: 16px;
              border-radius: 18px;
              border: 1px solid rgba(245, 158, 11, 0.75);
              background: #514a56;
              padding: 16px 20px;
            }

            .alertTitle {
              font-size: 14px;
              font-weight: 900;
              letter-spacing: 0.18em;
              text-transform: uppercase;
              color: #fde047;
            }

            .alertBody {
              margin-top: 8px;
              font-size: 18px;
              font-weight: 800;
              color: #fefce8;
            }

            .meterWrap {
              margin-top: 14px;
            }

            .meterTrack {
              position: relative;
              height: 4px;
              border-radius: 9999px;
              background: #202a64;
              overflow: visible;
            }

            .meterFill {
              position: absolute;
              left: 0;
              top: 0;
              height: 4px;
              border-radius: 9999px;
            }

            .meterFill-warning {
              background: #fbbf24;
            }

            .meterFill-healthy {
              background: #4ade80;
            }

            .meterFill-neutral {
              background: #cbd5e1;
            }

            .meterMarker {
              position: absolute;
              top: 50%;
              width: 2px;
              height: 18px;
              transform: translateY(-50%);
              background: #f8fafc;
            }

            .meterScale {
              margin-top: 8px;
              display: flex;
              align-items: center;
              justify-content: space-between;
              font-size: 12px;
              font-weight: 500;
              color: #e2e8f0;
            }

            @media (max-width: 1100px) {
              .trendGrid,
              .stressGrid {
                grid-template-columns: repeat(2, minmax(0, 1fr));
              }

              .pageTitle {
                font-size: 36px;
              }

              .tileValue {
                font-size: 36px;
              }
            }

            @media (max-width: 700px) {
              .topBar,
              .panelHeader {
                flex-direction: column;
                align-items: flex-start;
              }

              .damageText {
                white-space: normal;
              }

              .trendGrid,
              .stressGrid {
                grid-template-columns: 1fr;
              }

              .frame {
                padding: 10px;
              }

              .pageTitle {
                font-size: 30px;
              }
            }
          `,
        }}
      />
    </>
  );
}
