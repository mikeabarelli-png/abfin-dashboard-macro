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
    const w = 150;
    const h = 30;
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
      <svg viewBox={`0 0 ${w} ${h}`} width="150" height="30" className="sparkline">
        <polyline
          fill="none"
          stroke="#cbd5e1"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={coords}
        />
      </svg>
    );
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

  const badgeClass = (tone: string) => {
    if (tone === "warning") return "badge badge-warning";
    return "badge badge-danger";
  };

  return (
    <>
      <div className="pageShell">
        <div className="frame">
          <div className="topBar">
            <h1 className="title">Prospect Market Dashboard</h1>
            <div className="meta">
              <div>Source: LIVE_YAHOO_FRED</div>
              <div>Mar 16, 6:43 PM</div>
            </div>
          </div>

          <div className="connected">Connected</div>

          <section className="panel">
            <div className="panelHeader">
              <div>
                <div className="panelTitle">Market Structure</div>
                <div className="panelSub">Price vs Key Moving Averages</div>
              </div>
              <div className="damage">
                {damageCount} / {totalMA} short-term trends broken
              </div>
            </div>

            <div className="grid">
              {trendTiles.map((t) => (
                <div key={t.label} className="tile">
                  <div className="tileTop">
                    <div className="label">{t.label}</div>

                    {t.kind === "spx" ? (
                      <div className="ytd">{t.ytd}</div>
                    ) : (
                      <div className={badgeClass(t.tone)}>!</div>
                    )}
                  </div>

                  <div className="value">{t.value}</div>

                  {t.kind === "spx" && (
                    <div className="sparkWrap">{sparkline(t.trend)}</div>
                  )}

                  {t.status && <div className={statusClass(t.tone)}>{t.status}</div>}

                  <div className={t.kind === "spx" ? "sub subSpx" : "sub"}>
                    {t.subline}
                  </div>
                </div>
              ))}
            </div>

            <div className="alertBox">
              <div className="alertTitle">200-DMA Proximity Alert — Immediate Watch</div>
              <div className="alertBody">
                S&amp;P 500 is only 1.4% above its 200-DMA (6,608).
              </div>
            </div>
          </section>

          <section className="panel panelStress">
            <div className="panelTitle">Market Stress</div>

            <div className="stressGrid">
              {stressTiles.map((tile) => (
                <div key={tile.label} className="tile">
                  <div className="label">{tile.label}</div>
                  <div className="value stressValue">{tile.value}</div>
                  <div className={statusClass(tile.tone)} style={{ marginTop: 10 }}>
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
              font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            }

            .pageShell {
              min-height: 100vh;
              background: #0b0b2a;
              color: #fff;
            }

            .frame {
              max-width: 1500px;
              margin: 0 auto;
              padding: 16px;
            }

            .topBar {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 16px;
              margin-bottom: 12px;
            }

            .title {
              margin: 0;
              font-size: 34px;
              font-weight: 700;
              line-height: 1;
              color: #16c75c;
              letter-spacing: -0.03em;
            }

            .meta {
              text-align: right;
              font-size: 12px;
              font-weight: 600;
              line-height: 1.3;
              color: #e2e8f0;
            }

            .connected {
              background: #1e1b4f;
              padding: 10px 14px;
              border-radius: 14px;
              font-size: 13px;
              font-weight: 600;
              color: #f8fafc;
              margin-bottom: 12px;
            }

            .panel {
              background: #23255a;
              border-radius: 16px;
              padding: 12px;
            }

            .panelStress {
              margin-top: 16px;
              background: #171949;
            }

            .panelHeader {
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              gap: 12px;
              margin-bottom: 10px;
            }

            .panelTitle {
              font-size: 18px;
              font-weight: 700;
              line-height: 1.1;
            }

            .panelSub {
              margin-top: 2px;
              font-size: 11px;
              font-weight: 600;
              color: #cbd5e1;
              letter-spacing: 0.03em;
            }

            .damage {
              font-size: 12px;
              font-weight: 600;
              color: #cbd5e1;
              white-space: nowrap;
            }

            .grid {
              display: grid;
              grid-template-columns: repeat(5, minmax(0, 1fr));
              gap: 8px;
            }

            .stressGrid {
              display: grid;
              grid-template-columns: repeat(5, minmax(0, 1fr));
              gap: 8px;
              margin-top: 10px;
            }

            .tile {
              background: #050a35;
              border-radius: 10px;
              padding: 12px;
              min-width: 0;
            }

            .tileTop {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 8px;
              margin-bottom: 8px;
            }

            .label {
              font-size: 13px;
              font-weight: 700;
              line-height: 1.1;
              color: #ffffff;
            }

            .ytd {
              font-size: 11px;
              font-weight: 600;
              color: #94a3b8;
              white-space: nowrap;
            }

            .value {
              font-size: 28px;
              font-weight: 700;
              line-height: 0.95;
              letter-spacing: -0.03em;
              color: #ffffff;
            }

            .stressValue {
              margin-top: 10px;
            }

            .sparkWrap {
              margin-top: 6px;
              height: 30px;
              display: flex;
              align-items: center;
            }

            .sparkline {
              display: block;
              width: 150px;
              height: 30px;
              overflow: hidden;
            }

            .sub {
              margin-top: 4px;
              font-size: 11px;
              font-weight: 500;
              color: #dbe4f0;
            }

            .subSpx {
              color: #f8d7df;
              font-weight: 600;
            }

            .status {
              margin-top: 8px;
              font-size: 11px;
              font-weight: 700;
              letter-spacing: 0.04em;
              text-transform: uppercase;
            }

            .status-danger {
              color: #ff6b88;
            }

            .status-warning {
              color: #f7df5e;
            }

            .status-healthy {
              color: #37e184;
            }

            .status-neutral {
              color: #cbd5e1;
            }

            .badge {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: 20px;
              height: 20px;
              border-radius: 9999px;
              font-size: 11px;
              font-weight: 700;
              line-height: 1;
              flex-shrink: 0;
            }

            .badge-danger {
              background: #ff4f72;
              color: #ffffff;
            }

            .badge-warning {
              background: #f6bf34;
              color: #111827;
            }

            .alertBox {
              margin-top: 14px;
              border-radius: 18px;
              border: 1px solid rgba(245, 158, 11, 0.8);
              background: #5a5260;
              padding: 14px 18px;
            }

            .alertTitle {
              font-size: 11px;
              font-weight: 700;
              letter-spacing: 0.16em;
              text-transform: uppercase;
              color: #f7df5e;
            }

            .alertBody {
              margin-top: 8px;
              font-size: 17px;
              font-weight: 700;
              color: #fff8dc;
            }

            .meterWrap {
              margin-top: 12px;
            }

            .meterTrack {
              position: relative;
              height: 4px;
              border-radius: 9999px;
              background: #202a64;
            }

            .meterFill {
              position: absolute;
              left: 0;
              top: 0;
              height: 4px;
              border-radius: 9999px;
            }

            .meterFill-warning {
              background: #f6bf34;
            }

            .meterFill-healthy {
              background: #37e184;
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
              justify-content: space-between;
              font-size: 11px;
              font-weight: 500;
              color: #dbe4f0;
            }

            @media (max-width: 900px) {
              .title {
                font-size: 30px;
              }

              .value {
                font-size: 24px;
              }
            }

            @media (max-width: 700px) {
              .topBar,
              .panelHeader {
                flex-direction: column;
                align-items: flex-start;
              }

              .damage {
                white-space: normal;
              }

              .grid,
              .stressGrid {
                grid-template-columns: 1fr;
              }
            }
          `,
        }}
      />
    </>
  );
}
