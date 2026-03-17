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

  const damageCount = 3;
  const totalMA = 4;

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
      <svg viewBox={`0 0 ${w} ${h}`} width="150" height="30">
        <polyline
          fill="none"
          stroke="#cbd5e1"
          strokeWidth="1.8"
          strokeLinecap="round"
          points={coords}
        />
      </svg>
    );
  };

  return (
    <>
      <div className="frame">

        <div className="topBar">
          <h1 className="title">Prospect Market Dashboard</h1>
          <div className="meta">
            <div>Source: LIVE_YAHOO_FRED</div>
            <div>Mar 16, 6:43 PM</div>
          </div>
        </div>

        <div className="connected">Connected</div>

        <div className="panel">

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
                  {t.kind === "spx" && <div className="ytd">{t.ytd}</div>}
                </div>

                <div className="value">{t.value}</div>

                {t.kind === "spx" && sparkline(t.trend)}

                {t.status && <div className="status">{t.status}</div>}

                <div className="sub">{t.subline}</div>
              </div>
            ))}
          </div>

        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `

        body {
          margin: 0;
          background: #0b0b2a;
          font-family: Inter, system-ui;
          color: white;
        }

        .frame {
          max-width: 1400px;
          margin: auto;
          padding: 16px;
        }

        .title {
          font-size: 34px;
          font-weight: 700;
          color: #22c55e;
          margin: 0;
        }

        .topBar {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 12px;
        }

        .meta {
          font-size: 12px;
          color: #cbd5e1;
          text-align: right;
        }

        .connected {
          background: #1e1b4f;
          padding: 10px;
          border-radius: 10px;
          font-size: 13px;
          margin-bottom: 12px;
        }

        .panel {
          background: #23255a;
          padding: 12px;
          border-radius: 12px;
        }

        .panelTitle {
          font-size: 18px;
          font-weight: 700;
        }

        .panelSub {
          font-size: 11px;
          color: #cbd5e1;
        }

        .damage {
          font-size: 12px;
          color: #cbd5e1;
        }

        .panelHeader {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 8px;
        }

        .tile {
          background: #050a35;
          padding: 12px;
          border-radius: 10px;
        }

        .tileTop {
          display: flex;
          justify-content: space-between;
          margin-bottom: 6px;
        }

        .label {
          font-size: 13px;
          font-weight: 600;
        }

        .ytd {
          font-size: 11px;
          color: #94a3b8;
        }

        .value {
          font-size: 28px;
          font-weight: 700;
        }

        .status {
          font-size: 11px;
          margin-top: 6px;
          color: #fb7185;
          text-transform: uppercase;
        }

        .sub {
          font-size: 11px;
          margin-top: 4px;
          color: #cbd5e1;
        }

      `}} />
    </>
  );
}
