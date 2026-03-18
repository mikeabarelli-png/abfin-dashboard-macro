"use client";

import { useEffect, useMemo, useState } from "react";

type AnyObj = Record<string, any>;

export default function Page() {
  const [showVixModal, setShowVixModal] = useState(false);
  const [marketData, setMarketData] = useState<AnyObj | null>(null);
  const [lastUpdated, setLastUpdated] = useState("");
  const [feedError, setFeedError] = useState("");
  const [aiTab, setAiTab] = useState("summary");
  const [aiCache, setAiCache] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: string; text: string }[]>([]);

  useEffect(() => {
    let mounted = true;
    const fetchMarket = async () => {
      try {
        const res = await fetch(`/api/smart-money-snapshot?ts=${Date.now()}`, { cache: "no-store" });
        const text = await res.text();
        let json: AnyObj;
        try { json = JSON.parse(text); } catch { throw new Error(`Non-JSON: ${text.slice(0, 120)}`); }
        if (!mounted) return;
        if (!res.ok || json?.ok === false) { setFeedError(json?.detail || json?.error || `HTTP ${res.status}`); return; }
        setMarketData(json);
        setFeedError("");
        setLastUpdated(new Date().toLocaleTimeString());
      } catch (err: any) {
        if (!mounted) return;
        setFeedError(err?.message || "Unknown fetch error");
      }
    };
    fetchMarket();
    const id = setInterval(fetchMarket, 60000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  const metrics = marketData?.metrics ?? marketData ?? {};
  const getNum = (...vals: any[]): number | null => { for (const v of vals) { if (typeof v === "number" && Number.isFinite(v)) return v; if (typeof v === "string") { const n = Number(v.replace(/,/g, "")); if (Number.isFinite(n)) return n; } } return null; };
  const getArr = (...vals: any[]): number[] | null => { for (const v of vals) { if (Array.isArray(v)) { const arr = v.map((x) => typeof x === "number" ? x : Number(String(x).replace(/,/g, ""))).filter((x) => Number.isFinite(x)); if (arr.length) return arr; } } return null; };

  const spxPrice = getNum(metrics.spx_price, metrics.spx, marketData?.spx_price);
  const vixValue = getNum(metrics.vix, marketData?.vix);
  const spx20 = getNum(metrics?.spx_20dma?.level, metrics?.spx_20dma, marketData?.spx_20dma?.level) ?? 6822.68;
  const spx50 = getNum(metrics?.spx_50dma?.level, metrics?.spx_50dma, marketData?.spx_50dma?.level) ?? 6881.21;
  const spx100 = getNum(metrics?.spx_100dma?.level, metrics?.spx_100dma, marketData?.spx_100dma?.level) ?? 6841.88;
  const spx200 = getNum(metrics?.spx_200dma?.level, metrics?.spx_200dma, marketData?.spx_200dma?.level) ?? 6608.12;
  const spxDailyPct = getNum(metrics?.spx_change_pct, marketData?.spx_change_pct);
  const spxYtd = getNum(metrics?.spx_ytd_pct, marketData?.spx_ytd_pct) ?? -2.13;
  const spxTrend = getArr(metrics?.spx_trend_14d, marketData?.spx_trend_14d) ?? [6946,6908,6878,6881,6816,6869,6830,6740,6795,6781,6775,6672,6632,6699];
  const hySpread = getNum(metrics?.hy_spread, marketData?.hy_spread) ?? 3.28;
  const yieldCurve = getNum(metrics?.yield_curve_10y_2y, marketData?.yield_curve_10y_2y) ?? 0.55;
  const real10y = getNum(metrics?.real_10y, marketData?.real_10y) ?? 1.92;

  const fmtWhole = (n: number) => Math.round(n).toLocaleString();
  const fmt1 = (n: number) => n.toFixed(1);
  const fmt2 = (n: number) => n.toFixed(2);
  const fmtSigned1 = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
  const spxVs = (level: number) => spxPrice == null ? null : ((spxPrice - level) / level) * 100;
  const dmaState = (pct: number | null, isLong = false) => { if (pct == null) return "Loading"; if (pct < 0) return "Broken Below"; if (isLong && pct <= 2) return "Testing Support"; return "Holding Above"; };
  const dmaTone = (pct: number | null, isLong = false) => { if (pct == null) return "neutral"; if (pct < 0) return "danger"; if (isLong && pct <= 2) return "warning"; return "healthy"; };

  const vixStatus = vixValue == null ? { label: "Loading", sub: "", color: "#94a3b8" } : vixValue >= 30 ? { label: "Stress — Pause Buying", sub: "Trigger breached · Pause new buying", color: "#ff6b88" } : vixValue >= 20 ? { label: "Slightly Elevated", sub: "Rising fear and potential volatility", color: "#fbbf24" } : { label: "Normal", sub: "Calm · No action required", color: "#4ade80" };

  const damageCount = [spxVs(spx20), spxVs(spx50), spxVs(spx100), spxVs(spx200)].filter(v => v != null && v < 0).length;

  const systemPrompt = `You are an AI Wealth Strategist on a macro dashboard. Investor rules: Defensive trigger = two consecutive Friday closes below SPX 200-DMA (${fmtWhole(spx200)}) AND VIX>30 OR HY>400bps. VIX>30 = pause new equity buying. Current data: SPX ${spxPrice != null ? fmtWhole(spxPrice) : "loading"} (${spxDailyPct != null ? spxDailyPct.toFixed(2) : "?"}% today, ${spxYtd.toFixed(2)}% YTD), VIX ${vixValue != null ? fmt1(vixValue) : "loading"}, vs 20-DMA: ${spxVs(spx20) != null ? fmtSigned1(spxVs(spx20)!) : "?"} BROKEN, vs 50-DMA: ${spxVs(spx50) != null ? fmtSigned1(spxVs(spx50)!) : "?"} BROKEN, vs 100-DMA: ${spxVs(spx100) != null ? fmtSigned1(spxVs(spx100)!) : "?"} BROKEN, vs 200-DMA: ${spxVs(spx200) != null ? fmtSigned1(spxVs(spx200)!) : "?"} TESTING, HY Spread: ${hySpread}%, Yield Curve: ${yieldCurve}%, ${damageCount}/4 DMAs broken. Ivy Portfolio: all 5 positions invested. Valuation: 4/5 models overvalued or strongly overvalued. Be direct, specific, use actual numbers. No fluff.`;

  const callClaude = async (prompt: string, key: string) => {
    if (aiCache[key]) return aiCache[key];
    setAiLoading(true);
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system: systemPrompt, messages: [{ role: "user", content: prompt }] }),
    });
    const data = await res.json();
    const text = data.content?.[0]?.text ?? "Unable to load.";
    setAiCache(prev => ({ ...prev, [key]: text }));
    setAiLoading(false);
    return text;
  };

  useEffect(() => {
    if (!aiCache["summary"]) {
      callClaude("3-4 sentence market summary: SPX vs key MAs, VIX and HY spread signal, single most important thing to watch. Direct.", "summary");
    }
  }, [spxPrice]);

  const handleAiTab = (tab: string) => {
    setAiTab(tab);
    const prompts: Record<string, string> = {
      summary: "3-4 sentence market summary: SPX vs key MAs, VIX and HY spread signal, single most important thing to watch. Direct.",
      action: "Based on my rules: (1) current mode, (2) what to do or not do, (3) what level changes that. Direct and specific.",
      triggers: "Which triggers closest to firing? How many SPX points to 200-DMA breach? What activates defensive posture? Specific numbers.",
    };
    if (tab !== "chat" && !aiCache[tab]) callClaude(prompts[tab], tab);
  };

  const sendChat = async () => {
    const q = chatInput.trim();
    if (!q) return;
    setChatInput("");
    const newHistory = [...chatHistory, { role: "user", text: q }];
    setChatHistory(newHistory);
    const newMessages = [...chatMessages, { role: "user", content: q }];
    setChatMessages(newMessages);
    setAiLoading(true);
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system: systemPrompt, messages: newMessages }),
    });
    const data = await res.json();
    const reply = data.content?.[0]?.text ?? "Unable to respond.";
    setChatMessages([...newMessages, { role: "assistant", content: reply }]);
    setChatHistory([...newHistory, { role: "assistant", text: reply }]);
    setAiLoading(false);
  };

  const sparkline = (points: number[], color: string) => {
    const w = 100, h = 22;
    const max = Math.max(...points), min = Math.min(...points);
    const range = Math.max(1, max - min);
    const coords = points.map((p, i) => `${(i / (points.length - 1)) * w},${h - ((p - min) / range) * (h - 2) - 1}`).join(" ");
    const lx = w, ly = h - ((points[points.length - 1] - min) / range) * (h - 2) - 1;
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" aria-hidden="true"><polyline fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" points="${coords}"/><circle cx="${lx}" cy="${ly}" r="2" fill="${color}"/></svg>`;
  };

  const toneColor = (tone: string) => ({ danger: "#ff6b88", warning: "#fbbf24", healthy: "#4ade80", neutral: "#94a3b8" }[tone] ?? "#94a3b8");

  return (
    <>
      <div className="pageShell">
        <div className="frame">

          {/* TOP BAR */}
          <div className="topBar">
            <h1 className="title">Prospect Market Dashboard</h1>
            <div className="topRight">
              <div className="liveDot">
                <span className={feedError ? "dot dotError" : "dot dotLive"} />
                <span className="dotLabel">{feedError ? "Feed error" : "Live · 60s refresh"}</span>
              </div>
              <div className="meta">
                <div>LIVE_YAHOO_FRED</div>
                <div>{feedError ? "Feed error" : lastUpdated ? `Refreshed ${lastUpdated}` : "Loading..."}</div>
              </div>
            </div>
          </div>

          {feedError && <div className="errorBar">Feed error: {feedError}</div>}

          {/* ① AI WEALTH STRATEGIST */}
          <div className="panel panelAI">
            <div className="aiHeader">
              <div className="aiIcon">✦</div>
              <div>
                <div className="panelTitle">AI Wealth Strategist</div>
                <div className="aiSub">Powered by Claude · Loads on demand · No auto-refresh</div>
              </div>
            </div>
            <div className="aiTabs">
              {["summary", "action", "triggers", "chat"].map(t => (
                <button key={t} className={`aiTab${aiTab === t ? " aiTabOn" : ""}`} onClick={() => handleAiTab(t)}>
                  {{ summary: "Market Summary", action: "Recommended Action", triggers: "Trigger Watch", chat: "Ask a Question" }[t]}
                </button>
              ))}
            </div>
            {aiTab !== "chat" ? (
              <div className="aiOut">
                {aiLoading && !aiCache[aiTab] ? <span className="spinner" /> : null}
                {aiCache[aiTab] ?? ""}
              </div>
            ) : (
              <div>
                <div className="chatHist">
                  {chatHistory.map((m, i) => (
                    <div key={i} className={m.role === "user" ? "msgUser" : "msgAI"}>{m.text}</div>
                  ))}
                  {aiLoading && <div className="msgAI"><span className="spinner" /> Thinking...</div>}
                </div>
                <div className="chatRow">
                  <input className="chatInp" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendChat()} placeholder="Ask about your dashboard..." />
                  <button className="chatBtn" onClick={sendChat}>Ask ↗</button>
                </div>
              </div>
            )}
          </div>

          {/* ② MARKET STRUCTURE */}
          <section className="panel">
            <div className="panelHeader">
              <div><div className="panelTitle">Market Structure</div><div className="panelSub">Price vs Key Moving Averages</div></div>
              <div className="damage">{damageCount} / 4 short-term trends broken</div>
            </div>
            <div className="grid5" style={{ marginBottom: 8 }}>
              {/* SPX */}
              <div className="tile">
                <div className="tileTop"><span className="lbl">S&P 500</span><span className="ytd">{spxYtd > 0 ? "+" : ""}{spxYtd.toFixed(2)}% YTD</span></div>
                <div className="valHero">{spxPrice != null ? fmtWhole(spxPrice) : "—"}</div>
                <div className="sparkWrap" dangerouslySetInnerHTML={{ __html: sparkline(spxTrend, spxDailyPct != null && spxDailyPct >= 0 ? "#4ade80" : "#ff6b88") }} />
                <div className="subSpx">{spxDailyPct != null ? `${spxDailyPct >= 0 ? "▲" : "▼"} ${Math.abs(spxDailyPct).toFixed(1)}% today` : "Waiting for live price"}</div>
              </div>
              {/* 20/50/100 DMA */}
              {[{ label: "20-DMA", level: spx20 }, { label: "50-DMA", level: spx50 }, { label: "100-DMA", level: spx100 }].map(d => {
                const pct = spxVs(d.level);
                const tone = dmaTone(pct);
                return (
                  <div key={d.label} className="tile">
                    <div className="tileTop"><span className="lbl">{d.label}</span><span className="badge" style={{ background: toneColor(tone), color: tone === "warning" ? "#000" : "#fff" }}>!</span></div>
                    <div className="valMuted">{fmtWhole(d.level)}</div>
                    <div className="status" style={{ color: toneColor(tone) }}>{dmaState(pct)}</div>
                    <div className="sub">{pct != null ? `SPX ${fmtSigned1(pct)} ${pct >= 0 ? "above" : "below"}` : "Waiting for live price"}</div>
                  </div>
                );
              })}
              {/* 200-DMA amber hero */}
              <div className="tile tile200">
                <div className="tileTop"><span className="lbl" style={{ color: "#f59e0b" }}>200-DMA</span><span className="badge" style={{ background: "#f59e0b", color: "#000" }}>!</span></div>
                <div className="valHero">{fmtWhole(spx200)}</div>
                <div className="status" style={{ color: "#fbbf24" }}>{dmaState(spxVs(spx200), true)}</div>
                <div className="sub" style={{ color: "#f59e0b" }}>{spxVs(spx200) != null ? `SPX ${fmtSigned1(spxVs(spx200)!)} above` : "Waiting"}</div>
              </div>
            </div>
            <div className="alertStrip">
              <span className="alertDot" />
              <span className="alertTitle">200-DMA Proximity — Immediate Watch</span>
              <span className="alertBody">
                {spxPrice != null ? `Only ${Math.abs(((spxPrice - spx200) / spx200) * 100).toFixed(1)}% above (${fmtWhole(spx200)}) · ${Math.abs(spxPrice - spx200).toFixed(0)} pts gap · Trigger: 2 Friday closes below + VIX >30 or HY >400bps` : "Waiting for live price..."}
              </span>
            </div>
          </section>

          {/* ③ MARKET STRESS */}
          <section className="panel">
            <div className="panelTitle" style={{ marginBottom: 10 }}>Market Stress</div>
            <div className="grid5" style={{ marginBottom: 8 }}>
              {/* VIX */}
              <div className="tile" onDoubleClick={() => setShowVixModal(true)} style={{ cursor: "default" }}>
                <div className="lbl" style={{ marginBottom: 6 }}>VIX</div>
                <div className="valHero" style={{ color: vixStatus.color }}>{vixValue != null ? fmt1(vixValue) : "—"}</div>
                <div className="status" style={{ color: vixStatus.color }}>{vixStatus.label}</div>
                <div style={{ position: "relative", height: 4, borderRadius: 9999, background: "#202a64", marginTop: 12 }}>
                  <div style={{ position: "absolute", left: 0, top: 0, height: 4, width: `${Math.min(vixValue ?? 0, 100)}%`, borderRadius: 9999, background: vixStatus.color }} />
                  <div style={{ position: "absolute", top: -5, left: "30%", width: 1.5, height: 14, background: "rgba(255,255,255,0.35)", borderRadius: 1 }} />
                </div>
                <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", fontSize: 10, color: "#475569" }}><span>0</span><span>100</span></div>
                <div style={{ fontSize: 10, color: vixValue != null && vixValue >= 30 ? "#ff6b88" : "#475569", marginTop: 5 }}>{vixStatus.sub}</div>
              </div>
              {/* VIX/VXV */}
              <div className="tile">
                <div className="lbl" style={{ marginBottom: 6 }}>VIX / VXV</div>
                <div className="valHero" style={{ color: "#64748b" }}>—</div>
                <div className="status" style={{ color: "#64748b" }}>Awaiting</div>
                <div className="meterTrack"><div className="meterFill" style={{ width: "50%", background: "#64748b" }} /><div className="meterMarker" style={{ left: "50%" }} /></div>
                <div className="meterScale"><span>0.8</span><span>1.0</span><span>1.2</span></div>
                <div style={{ fontSize: 10, color: "#475569", marginTop: 5 }}>&gt;1.0 = short-term panic</div>
              </div>
              {/* HY Spread */}
              <div className="tile">
                <div className="lbl" style={{ marginBottom: 6 }}>HY Spread</div>
                <div className="valHero" style={{ color: hySpread >= 4 ? "#fbbf24" : "#94a3b8" }}>{fmt2(hySpread)}<span style={{ fontSize: 20, fontWeight: 600 }}>%</span></div>
                <div className="status" style={{ color: hySpread >= 4 ? "#fbbf24" : "#94a3b8" }}>{hySpread >= 4 ? "Watch" : "Firm"}</div>
                <div className="meterTrack"><div className="meterFill" style={{ width: `${Math.max(0, Math.min(((hySpread - 2) / 4) * 100, 100))}%`, background: hySpread >= 4 ? "#fbbf24" : "#94a3b8" }} /><div className="meterMarker" style={{ left: `${Math.max(0, Math.min(((hySpread - 2) / 4) * 100, 100))}%` }} /></div>
                <div className="meterScale"><span>2%</span><span>4%</span><span>6%</span></div>
              </div>
              {/* Yield Curve */}
              <div className="tile">
                <div className="lbl" style={{ marginBottom: 6 }}>Yield Curve</div>
                <div className="valHero" style={{ color: yieldCurve > 0 ? "#4ade80" : "#fbbf24" }}>{fmt2(yieldCurve)}<span style={{ fontSize: 20, fontWeight: 600 }}>%</span></div>
                <div className="status" style={{ color: yieldCurve > 0 ? "#4ade80" : "#fbbf24" }}>{yieldCurve > 0 ? "Healthy" : "Inverted"}</div>
                <div className="meterTrack"><div className="meterFill" style={{ width: `${Math.max(0, Math.min(((yieldCurve + 1) / 2.5) * 100, 100))}%`, background: yieldCurve > 0 ? "#4ade80" : "#fbbf24" }} /><div className="meterMarker" style={{ left: `${Math.max(0, Math.min(((yieldCurve + 1) / 2.5) * 100, 100))}%` }} /></div>
                <div className="meterScale"><span>-1%</span><span>0%</span><span>1.5%</span></div>
              </div>
              {/* Real 10Y */}
              <div className="tile">
                <div className="lbl" style={{ marginBottom: 6 }}>Real 10Y</div>
                <div className="valHero" style={{ color: real10y >= 2 ? "#fbbf24" : "#94a3b8" }}>{fmt2(real10y)}<span style={{ fontSize: 20, fontWeight: 600 }}>%</span></div>
                <div className="status" style={{ color: real10y >= 2 ? "#fbbf24" : "#94a3b8" }}>{real10y >= 2 ? "Firm" : "Moderate"}</div>
                <div className="meterTrack"><div className="meterFill" style={{ width: `${Math.max(0, Math.min((real10y / 3) * 100, 100))}%`, background: real10y >= 2 ? "#fbbf24" : "#94a3b8" }} /><div className="meterMarker" style={{ left: `${Math.max(0, Math.min((real10y / 3) * 100, 100))}%` }} /></div>
                <div className="meterScale"><span>0%</span><span>2%</span><span>3%</span></div>
              </div>
            </div>
            {/* ERP */}
            <div className="tile erpTile">
              <div><div className="lbl" style={{ marginBottom: 3 }}>Equity Risk Premium</div><div style={{ fontSize: 26, fontWeight: 700, color: "#475569" }}>—%</div></div>
              <div style={{ flex: 1 }}><div className="meterTrack" style={{ marginTop: 0 }}><div className="meterFill" style={{ width: "35%", background: "#475569" }} /><div className="meterMarker" style={{ left: "35%" }} /></div><div className="meterScale"><span>0%</span><span>3%</span><span>6%</span></div></div>
              <div style={{ fontSize: 11, color: "#334155", textAlign: "right", lineHeight: 1.5 }}>Earnings yield minus<br />real 10Y rate · Manual v2</div>
            </div>
          </section>

          {/* ④ ECONOMY */}
          <section className="panel">
            <div className="panelHeader"><div><div className="panelTitle">Economy</div><div className="panelSub">Macro Conditions · 3-Month Trend</div></div><div className="pstamp">FRED &amp; ISM · weekly/monthly</div></div>
            <div className="grid4" style={{ marginBottom: 8 }}>
              {[
                { label: "ISM Mfg PMI", val: "49.0", chg: "▼ 0.6 from prior", chgColor: "#ff6b88", sub: "3-mo: contracting", pill: "Below 50", pillClass: "pillR", sparkColor: "#ff6b88", pts: "0,8 25,9 50,11 75,12 100,14", hasMidline: true },
                { label: "ISM Services PMI", val: "53.5", chg: "▼ 1.2 from prior", chgColor: "#fbbf24", sub: "3-mo: softening", pill: "Slowing", pillClass: "pillA", sparkColor: "#fbbf24", pts: "0,6 25,7 50,9 75,10 100,12", hasMidline: true },
                { label: "Initial Claims", val: "225K", chg: "▲ 8K from prior", chgColor: "#fbbf24", sub: "3-mo: drifting up", pill: "Watch", pillClass: "pillA", sparkColor: "#fbbf24", pts: "0,18 25,16 50,15 75,12 100,9", hasMidline: false },
                { label: "Fed Net Liquidity", val: "$6.1T", chg: "▼ $180B from prior", chgColor: "#ff6b88", sub: "3-mo: draining", pill: "Tightening", pillClass: "pillR", sparkColor: "#ff6b88", pts: "0,6 25,8 50,11 75,15 100,20", hasMidline: false },
              ].map(t => (
                <div key={t.label} className="tile">
                  <div className="lbl">{t.label}</div>
                  <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: "#fff" }}>{t.val}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.chgColor, marginTop: 3 }}>{t.chg}</div>
                  <div style={{ margin: "5px 0 2px" }}>
                    <svg viewBox="0 0 100 24" width="100%" height="20">
                      {t.hasMidline && <line x1="0" y1="12" x2="100" y2="12" stroke="rgba(255,255,255,0.07)" strokeWidth="1" strokeDasharray="3,3" />}
                      <polyline fill="none" stroke={t.sparkColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={t.pts} />
                      <circle cx={t.pts.split(" ").slice(-1)[0].split(",")[0]} cy={t.pts.split(" ").slice(-1)[0].split(",")[1]} r="2" fill={t.sparkColor} />
                    </svg>
                  </div>
                  <div className="sub">{t.sub}</div>
                  <span className={t.pillClass}>{t.pill}</span>
                </div>
              ))}
            </div>
            <div className="grid3">
              {[
                { label: "Nonfarm Payrolls", val: "151K", date: "Feb '25", chg: "▼ 56K from prior", chgColor: "#ff6b88", meterW: "38%", meterC: "#fbbf24", sub: "3-mo: decelerating", pill: "Below trend", pillClass: "pillA", s: ["0", "200K", "400K"] },
                { label: "CPI Inflation", val: "2.8%", date: "YoY", chg: "▼ 0.2% easing", chgColor: "#4ade80", meterW: "56%", meterC: "#fbbf24", sub: "3-mo: slowly easing", pill: "Above target", pillClass: "pillA", s: ["0%", "2%", "5%"] },
                { label: "GDP Growth", val: "2.3%", date: "Q4 '24", chg: "▼ 0.8% from prior", chgColor: "#ff6b88", meterW: "46%", meterC: "#4ade80", sub: "3-mo: moderating", pill: "Positive", pillClass: "pillG", s: ["-2%", "0%", "5%"] },
              ].map(t => (
                <div key={t.label} className="tile">
                  <div className="lbl">{t.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>{t.val} <span style={{ fontSize: 11, color: "#475569" }}>{t.date}</span></div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.chgColor, marginTop: 3 }}>{t.chg}</div>
                  <div className="meterTrack"><div className="meterFill" style={{ width: t.meterW, background: t.meterC }} /><div className="meterMarker" style={{ left: t.meterW }} /></div>
                  <div className="meterScale"><span>{t.s[0]}</span><span>{t.s[1]}</span><span>{t.s[2]}</span></div>
                  <div className="sub" style={{ marginTop: 4 }}>{t.sub}</div>
                  <span className={t.pillClass}>{t.pill}</span>
                </div>
              ))}
            </div>
          </section>

          {/* ⑤ BREADTH */}
          <section className="panel">
            <div className="panelHeader"><div><div className="panelTitle">Market Breadth</div><div className="panelSub">% of S&P 500 stocks above key moving averages</div></div><div className="pstamp">Updated daily</div></div>
            <div className="grid4" style={{ marginBottom: 8 }}>
              {[
                { label: "% Above 200-DMA", val: "44%", pct: 44, color: "#fbbf24", sub: "3-mo: deteriorating", pill: "Weakening", pillClass: "pillA" },
                { label: "% Above 100-DMA", val: "38%", pct: 38, color: "#ff6b88", sub: "3-mo: declining", pill: "Bearish", pillClass: "pillR" },
                { label: "% Above 50-DMA", val: "31%", pct: 31, color: "#ff6b88", sub: "3-mo: sharp decline", pill: "Bearish", pillClass: "pillR" },
                { label: "% Above 20-DMA", val: "28%", pct: 28, color: "#ff6b88", sub: "3-mo: capitulating", pill: "Oversold", pillClass: "pillR" },
              ].map(t => (
                <div key={t.label} className="tile">
                  <div className="lbl">{t.label}</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: t.color }}>{t.val}</div>
                  <div className="bbar"><div className="bbarFill" style={{ width: `${t.pct}%`, background: t.color }} /></div>
                  <div className="meterScale"><span>0%</span><span>50%</span><span>100%</span></div>
                  <div className="sub" style={{ marginTop: 4 }}>{t.sub}</div>
                  <span className={t.pillClass}>{t.pill}</span>
                </div>
              ))}
            </div>
            <div className="grid3">
              <div className="tile"><div className="lbl">NYSE Adv / Dec</div><div style={{ fontSize: 20, fontWeight: 700, color: "#ff6b88", marginTop: 4 }}>-412</div><div className="sub" style={{ marginTop: 4 }}>More declines than advances</div><span className="pillR">Weak</span></div>
              <div className="tile"><div className="lbl">52-Wk Highs / Lows</div><div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>48 / <span style={{ color: "#ff6b88" }}>187</span></div><div className="sub" style={{ marginTop: 4 }}>3-mo: lows dominating</div><span className="pillR">Bearish</span></div>
              <div className="tile"><div className="lbl">McClellan Oscillator</div><div style={{ fontSize: 20, fontWeight: 700, color: "#fbbf24", marginTop: 4 }}>-42</div><div className="meterTrack"><div className="meterFill" style={{ width: "29%", background: "#ff6b88" }} /><div className="meterMarker" style={{ left: "29%" }} /></div><div className="meterScale"><span>-100</span><span>0</span><span>+100</span></div><span className="pillA">Oversold</span></div>
            </div>
          </section>

          {/* ⑥ VTI */}
          <section className="panel">
            <div className="panelHeader"><div><div className="panelTitle">VTI — Total Market Trend</div><div className="panelSub">Vanguard Total Market ETF · Key Moving Averages</div></div><div className="pstamp">LIVE · Yahoo Finance</div></div>
            <div className="grid5">
              <div className="tile">
                <div className="tileTop"><span className="lbl">VTI</span><span className="ytd">-2.4% YTD</span></div>
                <div className="valHero">238.14</div>
                <div className="sparkWrap" dangerouslySetInnerHTML={{ __html: sparkline([248,245,244,244,241,242,240,237,238,238,237,235,234,238], "#ff6b88") }} />
                <div className="subSpx">▲ 0.3% today</div>
              </div>
              {[{ label: "20-DMA", val: "242.80", sub: "VTI -1.9% below" }, { label: "50-DMA", val: "244.60", sub: "VTI -2.7% below" }, { label: "100-DMA", val: "241.10", sub: "VTI -1.2% below" }].map(d => (
                <div key={d.label} className="tile">
                  <div className="tileTop"><span className="lbl">{d.label}</span><span className="badge" style={{ background: "#ff4f72", color: "#fff" }}>!</span></div>
                  <div className="valMuted">{d.val}</div>
                  <div className="status" style={{ color: "#ff6b88" }}>Broken Below</div>
                  <div className="sub">{d.sub}</div>
                </div>
              ))}
              <div className="tile tile200">
                <div className="tileTop"><span className="lbl" style={{ color: "#f59e0b" }}>200-DMA</span><span className="badge" style={{ background: "#f59e0b", color: "#000" }}>!</span></div>
                <div className="valHero">231.40</div>
                <div className="status" style={{ color: "#fbbf24" }}>Testing Support</div>
                <div className="sub" style={{ color: "#f59e0b" }}>VTI +2.9% above</div>
              </div>
            </div>
          </section>

          {/* ⑦ VALUATION */}
          <section className="panel">
            <div className="panelHeader">
              <div><div className="panelTitle">Valuation</div><div className="panelSub">Long-term market valuation · Sigma scores vs historical norm</div></div>
              <div style={{ textAlign: "right" }}><div className="pstamp">Updated Mar 13 · Next: Mar 21</div><div style={{ fontSize: 10, color: "#334155", marginTop: 2 }}>Manual weekly · Saturday</div></div>
            </div>
            <table className="valTable">
              <thead><tr><th style={{ width: "45%", textAlign: "left" }}>Model</th><th style={{ textAlign: "left" }}>Rating</th><th style={{ textAlign: "right" }}>Score (σ)</th></tr></thead>
              <tbody>
                {[
                  { name: "Buffett Indicator", rating: "Strongly Overvalued", score: "2.12", color: "#ff6b88" },
                  { name: "Price/Earnings (CAPE)", rating: "Overvalued", score: "1.96", color: "#fbbf24" },
                  { name: "Price/Sales", rating: "Strongly Overvalued", score: "2.20", color: "#ff6b88" },
                  { name: "Interest Rate Model", rating: "Overvalued", score: "1.51", color: "#fbbf24" },
                  { name: "S&P 500 Mean Reversion", rating: "Strongly Overvalued", score: "2.03", color: "#ff6b88" },
                  { name: "Earnings Yield Gap", rating: "Fairly Valued", score: "0.31", color: "#94a3b8", muted: true },
                ].map(r => (
                  <tr key={r.name} style={{ opacity: r.muted ? 0.4 : 1 }}>
                    <td style={{ fontWeight: 600, color: "#cbd5e1", fontSize: 13, fontStyle: r.muted ? "italic" : "normal" }}>{r.name}</td>
                    <td style={{ fontWeight: 700, color: r.color, fontSize: 13 }}>{r.rating}</td>
                    <td style={{ fontWeight: 700, color: r.color, fontSize: 15, textAlign: "right" }}>{r.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="sumBar">
              <span className="sumBarLabel">Valuation Signal</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#ff6b88" }}>4 of 5 models overvalued or strongly overvalued</span>
              <span style={{ fontSize: 12, color: "#475569" }}>·</span>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>Elevated valuations reduce margin of safety but don&apos;t predict timing.</span>
            </div>
          </section>

          {/* ⑧ IVY PORTFOLIO */}
          <section className="panel">
            <div className="panelHeader">
              <div><div className="panelTitle">Ivy Portfolio</div><div className="panelSub">10-Month SMA Signals · Mebane Faber Model</div></div>
              <div style={{ textAlign: "right" }}><div className="pstamp">Feb 2026 · Valid until Mar 31</div><div style={{ fontSize: 10, color: "#334155", marginTop: 2 }}>Manual monthly · End of month</div></div>
            </div>
            <table className="ivyTable">
              <thead><tr><th>Fund</th><th>Name</th><th>Position</th><th>Variance vs 10-mo SMA</th><th style={{ textAlign: "right" }}>Signal</th></tr></thead>
              <tbody>
                {[
                  { ticker: "VTI", name: "US Stocks", variance: 5.1, pct: 32 },
                  { ticker: "VEU", name: "Intl Stocks", variance: 15.8, pct: 79 },
                  { ticker: "IEF", name: "Bonds (7-10yr)", variance: 3.5, pct: 22 },
                  { ticker: "VNQ", name: "Real Estate", variance: 7.0, pct: 44 },
                  { ticker: "DBC", name: "Commodities", variance: 13.1, pct: 66 },
                ].map(r => (
                  <tr key={r.ticker}>
                    <td style={{ fontWeight: 700, color: "#cbd5e1" }}>{r.ticker}</td>
                    <td style={{ color: "#64748b", fontSize: 12 }}>{r.name}</td>
                    <td style={{ fontWeight: 700, color: "#4ade80" }}>Invested</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div className="bbar" style={{ width: 120, flexShrink: 0 }}><div className="bbarFill" style={{ width: `${r.pct}%`, background: "#4ade80" }} /></div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#4ade80" }}>+{r.variance}%</span>
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}><span className="pillG">Hold</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="sumBar" style={{ marginTop: 8 }}>
              <span className="sumBarLabel">Ivy Signal</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#4ade80" }}>5 / 5 assets Invested</span>
              <span style={{ fontSize: 12, color: "#475569" }}>·</span>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>All positions above 10-month SMA. Valid until Mar 31, 2026.</span>
            </div>
          </section>

        </div>
      </div>

      {/* VIX MODAL */}
      {showVixModal && (
        <div className="modalBackdrop">
          <div className="modal">
            <div className="modalTop">
              <div><div className="modalTitle">VIX Drill-Down</div><div className="modalSub">CBOE Volatility Index — implied 30-day S&P 500 volatility</div></div>
              <button className="closeBtn" onClick={() => setShowVixModal(false)}>Close</button>
            </div>
            <div className="modalGrid">
              <div className="modalCard">
                <div className="smallHead">Current Read</div>
                <div className="bigValue">{vixValue != null ? fmt1(vixValue) : "—"}</div>
                <div className="status" style={{ color: vixStatus.color }}>{vixStatus.label}</div>
                <div className="bodyCopy">{vixValue == null ? "No live VIX value." : vixValue >= 30 ? "High stress regime — pause all new equity buying." : vixValue >= 20 ? "Elevated but not panic. Monitor closely." : "Calm to normal volatility environment."}</div>
                <div style={{ marginTop: 20 }}>
                  <div style={{ position: "relative", height: 8, borderRadius: 9999, overflow: "hidden", background: "#202a64" }}>
                    <div style={{ position: "absolute", left: 0, top: 0, height: 8, width: "37.5%", background: "#047857" }} />
                    <div style={{ position: "absolute", left: "37.5%", top: 0, height: 8, width: "12.5%", background: "#4ade80" }} />
                    <div style={{ position: "absolute", left: "50%", top: 0, height: 8, width: "25%", background: "#f59e0b" }} />
                    <div style={{ position: "absolute", left: "75%", top: 0, height: 8, width: "25%", background: "#ef4444" }} />
                    <div style={{ position: "absolute", top: "50%", left: `${Math.min(((vixValue ?? 0) / 40) * 100, 100)}%`, width: 2, height: 30, transform: "translateY(-50%)", background: "#fff" }} />
                  </div>
                  <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94a3b8" }}><span>0</span><span>15</span><span>20</span><span>30</span><span>40+</span></div>
                  <div style={{ marginTop: 4, display: "flex", justifyContent: "space-between", fontSize: 10, textTransform: "uppercase", fontWeight: 600, color: "#64748b" }}><span>Low</span><span>Normal</span><span>Elevated</span><span>Stress</span><span>Crisis</span></div>
                </div>
              </div>
              <div className="modalStack">
                <div className="modalCard"><div className="smallHead">What It Measures</div><div className="bodyCopy">The VIX measures expected 30-day S&P 500 volatility from option pricing. When fear rises, traders pay up for protection and the VIX moves higher.</div></div>
                <div className="modalCard"><div className="smallHead">Why It Matters</div><div className="bodyCopy">Above 30 is where volatility becomes the enemy of compounding. Below 30 is caution; above 30 is where you pause all new equity buying.</div></div>
                <div className="modalCard">
                  <div className="smallHead">Historical Context</div>
                  <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
                    {[{ val: "82.7", event: "COVID (Mar 2020)", note: "All-time high — recovered in months" }, { val: "79.1", event: "GFC (Nov 2008)", note: "Sustained fear regime — 18 months" }, { val: "38.6", event: "Aug 2024 spike", note: "Yen carry unwind — resolved in 2 weeks" }, { val: vixValue != null ? fmt1(vixValue) : "—", event: "Today", note: vixValue != null && vixValue >= 30 ? "High stress / danger zone" : "Elevated but below danger zone", active: true }, { val: "20", event: "Long-run avg", note: "Mean — median closer to ~17" }].map((h, i) => (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: "60px 1fr 1fr", gap: 10, background: h.active ? "#141b47" : "#0b1138", border: `1px solid ${h.active ? "rgba(245,158,11,0.4)" : "#1e293b"}`, borderRadius: 8, padding: "8px 10px", fontSize: 12 }}>
                        <div style={{ fontWeight: 700, color: h.active ? "#fbbf24" : "#cbd5e1" }}>{h.val}</div>
                        <div style={{ color: "#e2e8f0" }}>{h.event}</div>
                        <div style={{ color: "#94a3b8" }}>{h.note}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ border: "1px solid rgba(34,197,94,0.35)", borderRadius: 14, background: "#031e1a", padding: 16 }}>
                  <div className="smallHead" style={{ color: "#fbbf24" }}>Your Action</div>
                  <div className="bodyCopy" style={{ color: "#ecfdf5" }}>{vixValue != null && vixValue < 30 ? "VIX below 30. No buying restriction. Continue normal plan but do not treat the tape as calm." : "VIX above 30. Pause all new equity buying and treat volatility as a real portfolio constraint."}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: #0b0b2a; color: #fff; font-family: Inter, system-ui, -apple-system, sans-serif; }
        .pageShell { min-height: 100vh; background: #0b0b2a; }
        .frame { max-width: 1500px; margin: 0 auto; padding: 16px; }
        .topBar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
        .title { margin: 0; font-size: 28px; font-weight: 700; color: #16c75c; letter-spacing: -0.03em; }
        .topRight { display: flex; align-items: center; gap: 14px; }
        .liveDot { display: flex; align-items: center; gap: 6px; }
        .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; }
        .dotLive { background: #16c75c; box-shadow: 0 0 6px #16c75c; animation: pulse 2s infinite; }
        .dotError { background: #ff4f72; }
        .dotLabel { font-size: 12px; font-weight: 600; color: #94a3b8; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .meta { text-align: right; font-size: 12px; font-weight: 600; line-height: 1.35; color: #e2e8f0; }
        .errorBar { margin-bottom: 12px; border: 1px solid rgba(255,79,114,0.5); background: rgba(127,29,29,0.45); color: #fecdd3; border-radius: 12px; padding: 10px 14px; font-size: 12px; font-weight: 600; }
        .panel { background: #23255a; border-radius: 16px; padding: 14px; margin-bottom: 14px; }
        .panelAI { background: #0a1628; border: 1px solid rgba(99,179,237,0.2); }
        .panelHeader { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 12px; }
        .panelTitle { font-size: 17px; font-weight: 700; }
        .panelSub { font-size: 11px; font-weight: 600; color: #cbd5e1; margin-top: 2px; }
        .pstamp { font-size: 11px; color: #475569; }
        .damage { font-size: 12px; font-weight: 600; color: #cbd5e1; white-space: nowrap; }
        .grid5 { display: grid; grid-template-columns: repeat(5,minmax(0,1fr)); gap: 8px; }
        .grid4 { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 8px; }
        .grid3 { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 8px; }
        .tile { background: #050a35; border-radius: 10px; padding: 12px; border: 0.5px solid rgba(255,255,255,0.04); }
        .tile200 { background: rgba(245,158,11,0.07) !important; border: 1.5px solid rgba(245,158,11,0.4) !important; }
        .erpTile { display: flex; align-items: center; gap: 20px; padding: 10px 14px; margin-top: 8px; }
        .tileTop { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
        .lbl { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em; }
        .ytd { font-size: 11px; font-weight: 600; color: #64748b; white-space: nowrap; }
        .badge { width: 18px; height: 18px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; flex-shrink: 0; }
        .valHero { font-size: 38px; font-weight: 700; letter-spacing: -0.03em; line-height: 1; color: #fff; }
        .valMuted { font-size: 26px; font-weight: 700; letter-spacing: -0.02em; color: #94a3b8; }
        .sparkWrap { margin: 6px 0 4px; }
        .status { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; margin-top: 6px; }
        .sub { font-size: 11px; color: #64748b; margin-top: 3px; }
        .subSpx { font-size: 11px; font-weight: 600; color: #f8d7df; margin-top: 3px; }
        .alertStrip { background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3); border-radius: 10px; padding: 10px 14px; margin-top: 8px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .alertDot { width: 7px; height: 7px; border-radius: 50%; background: #f59e0b; flex-shrink: 0; box-shadow: 0 0 5px #f59e0b; display: inline-block; }
        .alertTitle { font-size: 12px; font-weight: 700; color: #f59e0b; white-space: nowrap; }
        .alertBody { font-size: 12px; color: #94a3b8; }
        .meterTrack { position: relative; height: 4px; border-radius: 9999px; background: #202a64; margin-top: 10px; }
        .meterFill { position: absolute; left: 0; top: 0; height: 4px; border-radius: 9999px; }
        .meterMarker { position: absolute; top: 50%; width: 2px; height: 16px; transform: translateY(-50%); background: #f8fafc; }
        .meterScale { margin-top: 5px; display: flex; justify-content: space-between; font-size: 10px; color: #475569; }
        .bbar { height: 7px; border-radius: 9999px; background: #202a64; overflow: hidden; margin: 8px 0 4px; }
        .bbarFill { height: 7px; border-radius: 9999px; }
        .pillR { display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.04em; margin-top: 6px; background: rgba(255,79,114,0.15); color: #ff6b88; }
        .pillA { display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.04em; margin-top: 6px; background: rgba(245,158,11,0.15); color: #fbbf24; }
        .pillG { display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.04em; margin-top: 0; background: rgba(34,197,94,0.15); color: #4ade80; }
        .valTable { width: 100%; border-collapse: collapse; font-size: 13px; }
        .valTable th { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; padding: 0 12px 8px; }
        .valTable td { padding: 9px 12px; border-top: 0.5px solid rgba(255,255,255,0.05); }
        .ivyTable { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 8px; }
        .ivyTable th { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; padding: 6px 12px; text-align: left; border-bottom: 0.5px solid rgba(255,255,255,0.08); }
        .ivyTable td { padding: 9px 12px; border-bottom: 0.5px solid rgba(255,255,255,0.05); }
        .sumBar { background: #030720; border-radius: 10px; padding: 10px 14px; margin-top: 8px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .sumBarLabel { font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.06em; flex-shrink: 0; }
        .aiHeader { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
        .aiIcon { width: 30px; height: 30px; border-radius: 50%; background: linear-gradient(135deg,#3b82f6,#8b5cf6); display: flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0; }
        .aiSub { font-size: 11px; color: #475569; margin-top: 1px; }
        .aiTabs { display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap; }
        .aiTab { padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: #94a3b8; cursor: pointer; }
        .aiTabOn { background: rgba(59,130,246,0.2) !important; border-color: rgba(59,130,246,0.4) !important; color: #93c5fd !important; }
        .aiOut { background: #060e1c; border-radius: 10px; padding: 14px; font-size: 13px; line-height: 1.7; color: #cbd5e1; min-height: 80px; white-space: pre-wrap; }
        .chatHist { display: flex; flex-direction: column; gap: 7px; margin-bottom: 8px; max-height: 220px; overflow-y: auto; }
        .msgUser { align-self: flex-end; background: rgba(59,130,246,0.15); border: 1px solid rgba(59,130,246,0.2); border-radius: 10px; padding: 7px 11px; font-size: 13px; color: #bfdbfe; max-width: 80%; }
        .msgAI { align-self: flex-start; background: #060e1c; border-radius: 10px; padding: 7px 11px; font-size: 13px; color: #cbd5e1; max-width: 90%; white-space: pre-wrap; line-height: 1.6; }
        .chatRow { display: flex; gap: 8px; margin-top: 10px; }
        .chatInp { flex: 1; background: #060e1c; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 9px 12px; color: #fff; font-size: 13px; font-family: inherit; outline: none; }
        .chatBtn { background: rgba(59,130,246,0.2); border: 1px solid rgba(59,130,246,0.4); border-radius: 8px; color: #93c5fd; padding: 9px 16px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .spinner { display: inline-block; width: 11px; height: 11px; border: 2px solid rgba(255,255,255,0.15); border-top-color: #93c5fd; border-radius: 50%; animation: spin .7s linear infinite; margin-right: 5px; vertical-align: middle; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .modalBackdrop { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(0,0,0,0.6); }
        .modal { width: 100%; max-width: 1100px; border-radius: 18px; border: 1px solid #334155; background: #0f153f; padding: 24px; box-shadow: 0 25px 80px rgba(0,0,0,0.4); max-height: 90vh; overflow-y: auto; }
        .modalTop { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 20px; }
        .modalTitle { font-size: 22px; font-weight: 700; }
        .modalSub { font-size: 12px; font-weight: 600; color: #cbd5e1; margin-top: 4px; }
        .closeBtn { border: 0; border-radius: 10px; background: #1f2937; color: #e2e8f0; padding: 10px 14px; font-size: 14px; font-weight: 600; cursor: pointer; }
        .modalGrid { display: grid; grid-template-columns: 0.95fr 1.05fr; gap: 16px; }
        .modalStack { display: grid; gap: 16px; }
        .modalCard { background: #050a35; border-radius: 14px; padding: 16px; }
        .smallHead { font-size: 12px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #94a3b8; }
        .bigValue { margin-top: 12px; font-size: 42px; font-weight: 700; line-height: 1; }
        .bodyCopy { margin-top: 8px; font-size: 13px; line-height: 1.7; color: #e2e8f0; }
        @media (max-width: 1100px) { .modalGrid { grid-template-columns: 1fr; } }
        @media (max-width: 900px) { .title { font-size: 22px; } .valHero { font-size: 30px; } }
        @media (max-width: 700px) {
          .topBar, .panelHeader, .modalTop { flex-direction: column; align-items: flex-start; }
          .grid5, .grid4 { grid-template-columns: repeat(2,minmax(0,1fr)); }
          .grid3 { grid-template-columns: 1fr; }
          .erpTile { flex-direction: column; align-items: flex-start; }
          .alertStrip { flex-direction: column; align-items: flex-start; gap: 4px; }
        }
      `}} />
    </>
  );
}
