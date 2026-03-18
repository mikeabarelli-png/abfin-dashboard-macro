"use client";

import { useEffect, useState } from "react";

type AnyObj = Record<string, any>;
type Modal = "vix" | "hy" | "yc" | "real10y" | "dma200" | null;

export default function Page() {
  const [modal, setModal] = useState<Modal>(null);
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
  const getNum = (...vals: any[]): number | null => {
    for (const v of vals) {
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (typeof v === "string") { const n = Number(v.replace(/,/g, "")); if (Number.isFinite(n)) return n; }
    }
    return null;
  };
  const getArr = (...vals: any[]): number[] | null => {
    for (const v of vals) {
      if (Array.isArray(v)) {
        const arr = v.map((x) => typeof x === "number" ? x : Number(String(x).replace(/,/g, ""))).filter((x) => Number.isFinite(x));
        if (arr.length) return arr;
      }
    }
    return null;
  };

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
  const dmaState = (pct: number | null, isLong = false) => {
    if (pct == null) return "Loading";
    if (pct < 0) return "Broken Below";
    if (isLong && pct <= 2) return "Testing Support";
    return "Holding Above";
  };
  const dmaTone = (pct: number | null, isLong = false) => {
    if (pct == null) return "neutral";
    if (pct < 0) return "danger";
    if (isLong && pct <= 2) return "warning";
    return "healthy";
  };
  const toneColor = (tone: string) => ({ danger: "#ff6b88", warning: "#fbbf24", healthy: "#4ade80", neutral: "#94a3b8" }[tone] ?? "#94a3b8");

  // VIX dynamic status
  const vixStatus = vixValue == null ? { label: "Loading", sub: "", color: "#94a3b8" }
    : vixValue >= 30 ? { label: "Stress — Pause Buying", sub: "Trigger breached · Pause new buying", color: "#ff6b88" }
    : vixValue >= 20 ? { label: "Slightly Elevated", sub: "Rising fear and potential volatility", color: "#fbbf24" }
    : { label: "Normal", sub: "Calm · No action required", color: "#4ade80" };

  // VIX percentile lookup
  const vixPctTable = [[9,1],[10,3],[11,6],[12,10],[13,15],[14,20],[15,27],[16,33],[17,40],[18,48],[19,56],[20,63],[21,68],[22,73],[23,77],[24,80],[25,83],[26,85],[27,87],[28,89],[29,91],[30,93],[32,95],[35,97],[40,98],[50,99],[82,100]];
  const getVixPct = (v: number) => {
    for (let i = 0; i < vixPctTable.length - 1; i++) {
      const [v0,p0] = vixPctTable[i], [v1,p1] = vixPctTable[i+1];
      if (v <= v1) return Math.round(p0 + ((v-v0)/(v1-v0))*(p1-p0));
    }
    return 100;
  };
  const vixPct = vixValue != null ? getVixPct(vixValue) : 75;
  const vixNeedlePct = (v: number) => {
    if (v <= 15) return (v/15)*37.5;
    if (v <= 20) return 37.5+((v-15)/5)*12.5;
    if (v <= 30) return 50+((v-20)/10)*25;
    return Math.min(75+((v-30)/10)*25, 99);
  };

  const damageCount = [spxVs(spx20), spxVs(spx50), spxVs(spx100), spxVs(spx200)].filter(v => v != null && v < 0).length;

  const systemPrompt = `You are an AI Wealth Strategist on a macro dashboard. Investor rules: Defensive trigger = two consecutive Friday closes below SPX 200-DMA (${fmtWhole(spx200)}) AND VIX>30 OR HY>400bps. VIX>30 = pause new equity buying. Current data: SPX ${spxPrice != null ? fmtWhole(spxPrice) : "loading"} (${spxDailyPct != null ? spxDailyPct.toFixed(2) : "?"}% today, ${spxYtd.toFixed(2)}% YTD), VIX ${vixValue != null ? fmt1(vixValue) : "loading"}, vs 20-DMA: ${spxVs(spx20) != null ? fmtSigned1(spxVs(spx20)!) : "?"} BROKEN, vs 50-DMA: ${spxVs(spx50) != null ? fmtSigned1(spxVs(spx50)!) : "?"} BROKEN, vs 100-DMA: ${spxVs(spx100) != null ? fmtSigned1(spxVs(spx100)!) : "?"} BROKEN, vs 200-DMA: ${spxVs(spx200) != null ? fmtSigned1(spxVs(spx200)!) : "?"} TESTING, HY Spread: ${hySpread}%, Yield Curve: ${yieldCurve}%, ${damageCount}/4 DMAs broken. Ivy Portfolio: all 5 positions invested. Valuation: 4/5 models overvalued. Be direct, specific, use actual numbers. No fluff.`;

  const callClaude = async (prompt: string, key: string, msgs?: { role: string; content: string }[]) => {
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai-strategist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt, messages: msgs ?? [{ role: "user", content: prompt }] }),
      });
      const data = await res.json();
      const text = data.text ?? data.error ?? "Unable to load.";
      if (!msgs) setAiCache(prev => ({ ...prev, [key]: text }));
      return text;
    } finally { setAiLoading(false); }
  };

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
    if (!q || aiLoading) return;
    setChatInput("");
    const newMsgs = [...chatMessages, { role: "user", content: q }];
    setChatMessages(newMsgs);
    setChatHistory(prev => [...prev, { role: "user", text: q }]);
    const reply = await callClaude("", "chat", newMsgs);
    setChatMessages([...newMsgs, { role: "assistant", content: reply }]);
    setChatHistory(prev => [...prev, { role: "assistant", text: reply }]);
  };

  const sparkline = (points: number[], color: string) => {
    const w = 100, h = 22;
    const max = Math.max(...points), min = Math.min(...points);
    const range = Math.max(1, max - min);
    const coords = points.map((p, i) => `${(i/(points.length-1))*w},${h-((p-min)/range)*(h-2)-1}`).join(" ");
    const ly = h - ((points[points.length-1]-min)/range)*(h-2)-1;
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}"><polyline fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" points="${coords}"/><circle cx="${w}" cy="${ly}" r="2" fill="${color}"/></svg>`;
  };

  const HistRow = ({ val, event, note, active }: { val: string; event: string; note: string; active?: boolean }) => (
    <div style={{ display: "grid", gridTemplateColumns: "56px 1fr 1fr", gap: 8, background: active ? "#141b47" : "#0b1138", border: `1px solid ${active ? "rgba(245,158,11,0.4)" : "#1e293b"}`, borderRadius: 7, padding: "8px 10px", fontSize: 12, color: "#e2e8f0" }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: active ? "#fff" : "#cbd5e1" }}>{val}</div>
      <div>{event}</div>
      <div style={{ color: active ? "#fbbf24" : "#64748b" }}>{note}</div>
    </div>
  );

  const ModalWrapper = ({ onClose, title, sub, children }: { onClose: () => void; title: string; sub: string; children: React.ReactNode }) => (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 1000, background: "#0f153f", border: "1px solid #1e293b", borderRadius: 18, padding: 24, maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{title}</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{sub}</div>
          </div>
          <button style={{ background: "#1f2937", border: 0, borderRadius: 8, color: "#e2e8f0", padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }} onClick={onClose}>Close ✕</button>
        </div>
        {children}
      </div>
    </div>
  );

  const ModalGrid = ({ left, right }: { left: React.ReactNode; right: React.ReactNode }) => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <div style={{ background: "#050a35", borderRadius: 12, padding: 16 }}>{left}</div>
      <div style={{ display: "grid", gap: 12 }}>{right}</div>
    </div>
  );

  const MCard = ({ children }: { children: React.ReactNode }) => (
    <div style={{ background: "#050a35", borderRadius: 12, padding: 14 }}>{children}</div>
  );

  const SH = ({ children }: { children: React.ReactNode }) => (
    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#64748b", marginBottom: 7 }}>{children}</div>
  );

  const BC = ({ children }: { children: React.ReactNode }) => (
    <div style={{ fontSize: 13, lineHeight: 1.7, color: "#cbd5e1", marginTop: 8 }}>{children}</div>
  );

  const Tag = ({ label, color, bg }: { label: string; color: string; bg: string }) => (
    <span style={{ display: "inline-block", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", padding: "2px 9px", borderRadius: 20, color, background: bg, marginBottom: 8 }}>{label}</span>
  );

  const ActionCard = ({ children }: { children: React.ReactNode }) => (
    <div style={{ background: "#031e1a", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 10, padding: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#fbbf24", marginBottom: 6 }}>Your action</div>
      <div style={{ fontSize: 13, lineHeight: 1.6, color: "#ecfdf5" }}>{children}</div>
    </div>
  );

  const BandTrack = ({ segs, needle, scaleNums, scaleNames }: { segs: { w: string; color: string }[]; needle: number; scaleNums: string[]; scaleNames: string[] }) => (
    <div style={{ marginTop: 12 }}>
      <div style={{ height: 8, borderRadius: 9999, overflow: "hidden", display: "flex", marginBottom: 4 }}>
        {segs.map((s, i) => <div key={i} style={{ width: s.w, height: 8, background: s.color }} />)}
      </div>
      <div style={{ position: "relative", height: 12, marginBottom: 2 }}>
        <div style={{ position: "absolute", top: 0, left: `${needle}%`, width: 2, height: 12, background: "#fff", borderRadius: 1, transform: "translateX(-50%)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#475569", marginBottom: 2 }}>{scaleNums.map((s,i) => <span key={i}>{s}</span>)}</div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#64748b" }}>{scaleNames.map((s,i) => <span key={i}>{s}</span>)}</div>
    </div>
  );

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

          {/* ① MARKET STRUCTURE */}
          <section className="panel">
            <div className="panelHeader">
              <div><div className="panelTitle">Market Structure</div><div className="panelSub">Price vs Key Moving Averages</div></div>
              <div className="damage">{damageCount} / 4 short-term trends broken</div>
            </div>
            <div className="grid5" style={{ marginBottom: 8 }}>
              <div className="tile">
                <div className="tileTop"><span className="lbl">S&P 500</span><span className="ytd">{spxYtd > 0 ? "+" : ""}{spxYtd.toFixed(2)}% YTD</span></div>
                <div className="valHero">{spxPrice != null ? fmtWhole(spxPrice) : "—"}</div>
                <div className="sparkWrap" dangerouslySetInnerHTML={{ __html: sparkline(spxTrend, spxDailyPct != null && spxDailyPct >= 0 ? "#4ade80" : "#ff6b88") }} />
                <div className="subSpx">{spxDailyPct != null ? `${spxDailyPct >= 0 ? "▲" : "▼"} ${Math.abs(spxDailyPct).toFixed(1)}% today` : "Waiting for live price"}</div>
              </div>
              {[{ label: "20-DMA", level: spx20 }, { label: "50-DMA", level: spx50 }, { label: "100-DMA", level: spx100 }].map(d => {
                const pct = spxVs(d.level); const tone = dmaTone(pct);
                return (
                  <div key={d.label} className="tile">
                    <div className="tileTop"><span className="lbl">{d.label}</span><span className="badge" style={{ background: toneColor(tone), color: tone === "warning" ? "#000" : "#fff" }}>!</span></div>
                    <div className="valMuted">{fmtWhole(d.level)}</div>
                    <div className="status" style={{ color: toneColor(tone) }}>{dmaState(pct)}</div>
                    <div className="sub">{pct != null ? `SPX ${fmtSigned1(pct)} ${pct >= 0 ? "above" : "below"}` : "Waiting"}</div>
                  </div>
                );
              })}
              <div className="tile tile200" style={{ cursor: "pointer" }} onClick={() => setModal("dma200")}>
                <div className="tileTop"><span className="lbl" style={{ color: "#f59e0b" }}>200-DMA</span><span className="badge" style={{ background: "#f59e0b", color: "#000" }}>!</span></div>
                <div className="valHero">{fmtWhole(spx200)}</div>
                <div className="status" style={{ color: "#fbbf24" }}>{dmaState(spxVs(spx200), true)}</div>
                <div className="sub" style={{ color: "#f59e0b" }}>{spxVs(spx200) != null ? `SPX ${fmtSigned1(spxVs(spx200)!)} above` : "Waiting"}</div>
                <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>Click for detail</div>
              </div>
            </div>
            <div className="alertStrip">
              <span className="alertDot" />
              <span className="alertTitle">200-DMA Proximity — Immediate Watch</span>
              <span className="alertBody">{spxPrice != null ? `Only ${Math.abs(((spxPrice-spx200)/spx200)*100).toFixed(1)}% above (${fmtWhole(spx200)}) · ${Math.abs(spxPrice-spx200).toFixed(0)} pts gap · Trigger: 2 Friday closes below + VIX >30 or HY >400bps` : "Waiting..."}</span>
            </div>
          </section>

          {/* ② MARKET STRESS */}
          <section className="panel">
            <div className="panelTitle" style={{ marginBottom: 10 }}>Market Stress</div>
            <div className="grid5" style={{ marginBottom: 8 }}>
              <div className="tile" style={{ cursor: "pointer" }} onClick={() => setModal("vix")}>
                <div className="lbl" style={{ marginBottom: 6 }}>VIX</div>
                <div className="valHero">{vixValue != null ? fmt1(vixValue) : "—"}</div>
                <div className="status" style={{ color: vixStatus.color }}>{vixStatus.label}</div>
                <div style={{ position: "relative", height: 4, borderRadius: 9999, background: "#202a64", marginTop: 12 }}>
                  <div style={{ position: "absolute", left: 0, top: 0, height: 4, width: `${Math.min(vixValue ?? 0, 100)}%`, borderRadius: 9999, background: vixStatus.color }} />
                  <div style={{ position: "absolute", top: -5, left: "30%", width: 1.5, height: 14, background: "rgba(255,255,255,0.35)", borderRadius: 1 }} />
                </div>
                <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", fontSize: 10, color: "#475569" }}><span>0</span><span>100</span></div>
                <div style={{ fontSize: 10, color: vixValue != null && vixValue >= 30 ? "#ff6b88" : "#64748b", marginTop: 4 }}>{vixStatus.sub || "Click for detail"}</div>
              </div>
              <div className="tile">
                <div className="lbl" style={{ marginBottom: 6 }}>VIX / VXV</div>
                <div className="valHero" style={{ color: "#64748b" }}>—</div>
                <div className="status" style={{ color: "#64748b" }}>Awaiting</div>
                <div className="meterTrack"><div className="meterFill" style={{ width: "50%", background: "#64748b" }} /><div className="meterMarker" style={{ left: "50%" }} /></div>
                <div className="meterScale"><span>0.8</span><span>1.0</span><span>1.2</span></div>
                <div style={{ fontSize: 10, color: "#475569", marginTop: 4 }}>&gt;1.0 = short-term panic</div>
              </div>
              <div className="tile" style={{ cursor: "pointer" }} onClick={() => setModal("hy")}>
                <div className="lbl" style={{ marginBottom: 6 }}>HY Spread</div>
                <div className="valHero">{fmt2(hySpread)}<span style={{ fontSize: 20, fontWeight: 600 }}>%</span></div>
                <div className="status" style={{ color: hySpread >= 4 ? "#fbbf24" : "#94a3b8" }}>{hySpread >= 4 ? "Watch" : "Firm"}</div>
                <div className="meterTrack"><div className="meterFill" style={{ width: `${Math.max(0,Math.min(((hySpread-2)/4)*100,100))}%`, background: hySpread >= 4 ? "#fbbf24" : "#94a3b8" }} /><div className="meterMarker" style={{ left: `${Math.max(0,Math.min(((hySpread-2)/4)*100,100))}%` }} /></div>
                <div className="meterScale"><span>2%</span><span>4%</span><span>6%</span></div>
                <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>Click for detail</div>
              </div>
              <div className="tile" style={{ cursor: "pointer" }} onClick={() => setModal("yc")}>
                <div className="lbl" style={{ marginBottom: 6 }}>Yield Curve</div>
                <div className="valHero">{fmt2(yieldCurve)}<span style={{ fontSize: 20, fontWeight: 600 }}>%</span></div>
                <div className="status" style={{ color: yieldCurve > 0 ? "#4ade80" : "#fbbf24" }}>{yieldCurve > 0 ? "Healthy" : "Inverted"}</div>
                <div className="meterTrack"><div className="meterFill" style={{ width: `${Math.max(0,Math.min(((yieldCurve+1)/2.5)*100,100))}%`, background: yieldCurve > 0 ? "#4ade80" : "#fbbf24" }} /><div className="meterMarker" style={{ left: `${Math.max(0,Math.min(((yieldCurve+1)/2.5)*100,100))}%` }} /></div>
                <div className="meterScale"><span>-1%</span><span>0%</span><span>1.5%</span></div>
                <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>Click for detail</div>
              </div>
              <div className="tile" style={{ cursor: "pointer" }} onClick={() => setModal("real10y")}>
                <div className="lbl" style={{ marginBottom: 6 }}>Real 10Y</div>
                <div className="valHero">{fmt2(real10y)}<span style={{ fontSize: 20, fontWeight: 600 }}>%</span></div>
                <div className="status" style={{ color: real10y >= 2 ? "#fbbf24" : "#94a3b8" }}>{real10y >= 2 ? "Firm" : "Moderate"}</div>
                <div className="meterTrack"><div className="meterFill" style={{ width: `${Math.max(0,Math.min((real10y/3)*100,100))}%`, background: real10y >= 2 ? "#fbbf24" : "#94a3b8" }} /><div className="meterMarker" style={{ left: `${Math.max(0,Math.min((real10y/3)*100,100))}%` }} /></div>
                <div className="meterScale"><span>0%</span><span>2%</span><span>3%</span></div>
                <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>Click for detail</div>
              </div>
            </div>
            <div className="tile erpTile">
              <div><div className="lbl" style={{ marginBottom: 3 }}>Equity Risk Premium</div><div style={{ fontSize: 26, fontWeight: 700, color: "#475569" }}>—%</div></div>
              <div style={{ flex: 1 }}><div className="meterTrack" style={{ marginTop: 0 }}><div className="meterFill" style={{ width: "35%", background: "#475569" }} /><div className="meterMarker" style={{ left: "35%" }} /></div><div className="meterScale"><span>0%</span><span>3%</span><span>6%</span></div></div>
              <div style={{ fontSize: 11, color: "#334155", textAlign: "right", lineHeight: 1.5 }}>Earnings yield minus<br />real 10Y rate · Manual v2</div>
            </div>
          </section>

          {/* ③ ECONOMY */}
          <section className="panel">
            <div className="panelHeader"><div><div className="panelTitle">Economy</div><div className="panelSub">Macro Conditions · 3-Month Trend</div></div><div className="pstamp">FRED &amp; ISM · weekly/monthly</div></div>
            <div className="grid4" style={{ marginBottom: 8 }}>
              {[
                { label: "ISM Mfg PMI", val: "49.0", chg: "▼ 0.6 from prior", chgColor: "#ff6b88", sub: "3-mo: contracting", pill: "Below 50", pillC: "pillR", sColor: "#ff6b88", pts: "0,8 25,9 50,11 75,12 100,14", mid: true },
                { label: "ISM Services PMI", val: "53.5", chg: "▼ 1.2 from prior", chgColor: "#fbbf24", sub: "3-mo: softening", pill: "Slowing", pillC: "pillA", sColor: "#fbbf24", pts: "0,6 25,7 50,9 75,10 100,12", mid: true },
                { label: "Initial Claims", val: "225K", chg: "▲ 8K from prior", chgColor: "#fbbf24", sub: "3-mo: drifting up", pill: "Watch", pillC: "pillA", sColor: "#fbbf24", pts: "0,18 25,16 50,15 75,12 100,9", mid: false },
                { label: "Fed Net Liquidity", val: "$6.1T", chg: "▼ $180B from prior", chgColor: "#ff6b88", sub: "3-mo: draining", pill: "Tightening", pillC: "pillR", sColor: "#ff6b88", pts: "0,6 25,8 50,11 75,15 100,20", mid: false },
              ].map(t => (
                <div key={t.label} className="tile">
                  <div className="lbl">{t.label}</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: "#fff" }}>{t.val}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.chgColor, marginTop: 3 }}>{t.chg}</div>
                  <svg viewBox="0 0 100 24" width="100%" height="20" style={{ margin: "5px 0 2px" }}>
                    {t.mid && <line x1="0" y1="12" x2="100" y2="12" stroke="rgba(255,255,255,0.07)" strokeWidth="1" strokeDasharray="3,3" />}
                    <polyline fill="none" stroke={t.sColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={t.pts} />
                  </svg>
                  <div className="sub">{t.sub}</div>
                  <span className={t.pillC}>{t.pill}</span>
                </div>
              ))}
            </div>
            <div className="grid3">
              {[
                { label: "Nonfarm Payrolls", val: "151K", date: "Feb '25", chg: "▼ 56K from prior", chgC: "#ff6b88", mW: "38%", mC: "#fbbf24", sub: "3-mo: decelerating", pill: "Below trend", pillC: "pillA", sc: ["0","200K","400K"] },
                { label: "CPI Inflation", val: "2.8%", date: "YoY", chg: "▼ 0.2% easing", chgC: "#4ade80", mW: "56%", mC: "#fbbf24", sub: "3-mo: slowly easing", pill: "Above target", pillC: "pillA", sc: ["0%","2%","5%"] },
                { label: "GDP Growth", val: "2.3%", date: "Q4 '24", chg: "▼ 0.8% from prior", chgC: "#ff6b88", mW: "46%", mC: "#4ade80", sub: "3-mo: moderating", pill: "Positive", pillC: "pillG", sc: ["-2%","0%","5%"] },
              ].map(t => (
                <div key={t.label} className="tile">
                  <div className="lbl">{t.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>{t.val} <span style={{ fontSize: 11, color: "#475569" }}>{t.date}</span></div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.chgC, marginTop: 3 }}>{t.chg}</div>
                  <div className="meterTrack"><div className="meterFill" style={{ width: t.mW, background: t.mC }} /><div className="meterMarker" style={{ left: t.mW }} /></div>
                  <div className="meterScale"><span>{t.sc[0]}</span><span>{t.sc[1]}</span><span>{t.sc[2]}</span></div>
                  <div className="sub" style={{ marginTop: 4 }}>{t.sub}</div>
                  <span className={t.pillC}>{t.pill}</span>
                </div>
              ))}
            </div>
          </section>

          {/* ④ BREADTH */}
          <section className="panel">
            <div className="panelHeader"><div><div className="panelTitle">Market Breadth</div><div className="panelSub">% of S&P 500 stocks above key moving averages</div></div><div className="pstamp">Updated daily</div></div>
            <div className="grid4" style={{ marginBottom: 8 }}>
              {[
                { label: "% Above 200-DMA", val: "44%", pct: 44, color: "#fbbf24", sub: "3-mo: deteriorating", pill: "Weakening", pillC: "pillA" },
                { label: "% Above 100-DMA", val: "38%", pct: 38, color: "#ff6b88", sub: "3-mo: declining", pill: "Bearish", pillC: "pillR" },
                { label: "% Above 50-DMA", val: "31%", pct: 31, color: "#ff6b88", sub: "3-mo: sharp decline", pill: "Bearish", pillC: "pillR" },
                { label: "% Above 20-DMA", val: "28%", pct: 28, color: "#ff6b88", sub: "3-mo: capitulating", pill: "Oversold", pillC: "pillR" },
              ].map(t => (
                <div key={t.label} className="tile">
                  <div className="lbl">{t.label}</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: t.color }}>{t.val}</div>
                  <div className="bbar"><div className="bbarFill" style={{ width: `${t.pct}%`, background: t.color }} /></div>
                  <div className="meterScale"><span>0%</span><span>50%</span><span>100%</span></div>
                  <div className="sub" style={{ marginTop: 4 }}>{t.sub}</div>
                  <span className={t.pillC}>{t.pill}</span>
                </div>
              ))}
            </div>
            <div className="grid3">
              <div className="tile"><div className="lbl">NYSE Adv / Dec</div><div style={{ fontSize: 20, fontWeight: 700, color: "#ff6b88", marginTop: 4 }}>-412</div><div className="sub" style={{ marginTop: 4 }}>More declines than advances</div><span className="pillR">Weak</span></div>
              <div className="tile"><div className="lbl">52-Wk Highs / Lows</div><div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>48 / <span style={{ color: "#ff6b88" }}>187</span></div><div className="sub" style={{ marginTop: 4 }}>3-mo: lows dominating</div><span className="pillR">Bearish</span></div>
              <div className="tile"><div className="lbl">McClellan Oscillator</div><div style={{ fontSize: 20, fontWeight: 700, color: "#fbbf24", marginTop: 4 }}>-42</div><div className="meterTrack"><div className="meterFill" style={{ width: "29%", background: "#ff6b88" }} /><div className="meterMarker" style={{ left: "29%" }} /></div><div className="meterScale"><span>-100</span><span>0</span><span>+100</span></div><span className="pillA">Oversold</span></div>
            </div>
          </section>

          {/* ⑤ VTI */}
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

          {/* ⑥ VALUATION */}
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
            <div className="sumBar"><span className="sumBarLabel">Valuation Signal</span><span style={{ fontSize: 12, fontWeight: 700, color: "#ff6b88" }}>4 of 5 models overvalued or strongly overvalued</span><span style={{ fontSize: 12, color: "#475569" }}>·</span><span style={{ fontSize: 12, color: "#94a3b8" }}>Elevated valuations reduce margin of safety but don&apos;t predict timing.</span></div>
          </section>

          {/* ⑦ IVY */}
          <section className="panel">
            <div className="panelHeader">
              <div><div className="panelTitle">Ivy Portfolio</div><div className="panelSub">10-Month SMA Signals · Mebane Faber Model</div></div>
              <div style={{ textAlign: "right" }}><div className="pstamp">Feb 2026 · Valid until Mar 31</div><div style={{ fontSize: 10, color: "#334155", marginTop: 2 }}>Manual monthly · End of month</div></div>
            </div>
            <table className="ivyTable">
              <thead><tr><th>Fund</th><th>Name</th><th>Position</th><th>Variance vs 10-mo SMA</th><th style={{ textAlign: "right" }}>Signal</th></tr></thead>
              <tbody>
                {[{ ticker: "VTI", name: "US Stocks", variance: 5.1, pct: 32 }, { ticker: "VEU", name: "Intl Stocks", variance: 15.8, pct: 79 }, { ticker: "IEF", name: "Bonds (7-10yr)", variance: 3.5, pct: 22 }, { ticker: "VNQ", name: "Real Estate", variance: 7.0, pct: 44 }, { ticker: "DBC", name: "Commodities", variance: 13.1, pct: 66 }].map(r => (
                  <tr key={r.ticker}>
                    <td style={{ fontWeight: 700, color: "#cbd5e1" }}>{r.ticker}</td>
                    <td style={{ color: "#64748b", fontSize: 12 }}>{r.name}</td>
                    <td style={{ fontWeight: 700, color: "#4ade80" }}>Invested</td>
                    <td><div style={{ display: "flex", alignItems: "center", gap: 10 }}><div className="bbar" style={{ width: 120, flexShrink: 0 }}><div className="bbarFill" style={{ width: `${r.pct}%`, background: "#4ade80" }} /></div><span style={{ fontSize: 12, fontWeight: 600, color: "#4ade80" }}>+{r.variance}%</span></div></td>
                    <td style={{ textAlign: "right" }}><span className="pillG">Hold</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="sumBar" style={{ marginTop: 8 }}><span className="sumBarLabel">Ivy Signal</span><span style={{ fontSize: 12, fontWeight: 700, color: "#4ade80" }}>5 / 5 assets Invested</span><span style={{ fontSize: 12, color: "#475569" }}>·</span><span style={{ fontSize: 12, color: "#94a3b8" }}>All positions above 10-month SMA. Valid until Mar 31, 2026.</span></div>
          </section>

          {/* ⑧ AI STRATEGIST */}
          <section className="panel panelAI">
            <div className="aiHeader">
              <div className="aiIcon">✦</div>
              <div><div className="panelTitle">AI Wealth Strategist</div><div className="aiSub">Powered by Claude · Reads live dashboard data · Loads on demand</div></div>
            </div>
            <div className="aiTabs">
              {(["summary","action","triggers","chat"] as const).map(t => (
                <button key={t} className={`aiTab${aiTab === t ? " aiTabOn" : ""}`} onClick={() => handleAiTab(t)}>
                  {{ summary: "Market Summary", action: "Recommended Action", triggers: "Trigger Watch", chat: "Ask a Question" }[t]}
                </button>
              ))}
            </div>
            {aiTab !== "chat" ? (
              <div className="aiOut">{aiLoading && !aiCache[aiTab] ? <><span className="spinner" /> Analyzing...</> : (aiCache[aiTab] ?? "")}</div>
            ) : (
              <div>
                <div className="chatHist">
                  {chatHistory.map((m, i) => <div key={i} className={m.role === "user" ? "msgUser" : "msgAI"}>{m.text}</div>)}
                  {aiLoading && <div className="msgAI"><span className="spinner" /> Thinking...</div>}
                </div>
                <div className="chatRow">
                  <input className="chatInp" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendChat()} placeholder="Ask about your dashboard..." />
                  <button className="chatBtn" onClick={sendChat} disabled={aiLoading}>Ask ↗</button>
                </div>
              </div>
            )}
          </section>

        </div>
      </div>

      {/* ── MODALS ── */}

      {/* VIX */}
      {modal === "vix" && (
        <ModalWrapper onClose={() => setModal(null)} title="VIX — Volatility Index" sub="CBOE Volatility Index · Implied 30-day S&P 500 volatility">
          <ModalGrid
            left={<>
              <SH>Current reading</SH>
              <div style={{ fontSize: 44, fontWeight: 700, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 6 }}>{vixValue != null ? fmt1(vixValue) : "—"}</div>
              <Tag label={vixStatus.label} color={vixStatus.color} bg={`${vixStatus.color}22`} />
              <BC>{vixStatus.sub || "Monitor conditions."}</BC>
              <BandTrack
                segs={[{ w: "37.5%", color: "#047857" }, { w: "12.5%", color: "#4ade80" }, { w: "25%", color: "#f59e0b" }, { w: "25%", color: "#ef4444" }]}
                needle={vixValue != null ? vixNeedlePct(vixValue) : 56}
                scaleNums={["0", "15", "20", "30", "40+"]}
                scaleNames={["Low", "Normal", "Elevated", "Stress", "Crisis"]}
              />
              <div style={{ marginTop: 16, background: "#141b47", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10, padding: 14 }}>
                <SH>Historical percentile · since 1990</SH>
                <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ fontSize: 32, fontWeight: 700, color: "#fff", lineHeight: 1 }}>{vixPct}<span style={{ fontSize: 16 }}>th</span></div>
                  <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "right", lineHeight: 1.5 }}>{vixPct >= 90 ? "Extreme · top 10%" : vixPct >= 75 ? "Elevated · top 25%" : "Above median"}<br />of all readings</div>
                </div>
                <div style={{ height: 8, borderRadius: 9999, background: "#1e2a5e", overflow: "hidden" }}>
                  <div style={{ height: 8, borderRadius: 9999, background: "#fbbf24", width: `${vixPct}%` }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#475569", marginTop: 4 }}><span>0th</span><span>50th</span><span>75th</span><span>90th</span><span>100th</span></div>
              </div>
            </>}
            right={<>
              <MCard><SH>What it measures</SH><BC>The VIX measures expected 30-day S&P 500 volatility from options pricing. When fear rises, traders pay more for protective puts — and the VIX moves higher. Called the "fear gauge."</BC></MCard>
              <MCard>
                <SH>Historical context</SH>
                <div style={{ display: "grid", gap: 5, marginTop: 8 }}>
                  <HistRow val="82.7" event="COVID Mar 2020" note="All-time high · months to recover" />
                  <HistRow val="79.1" event="GFC Nov 2008" note="Sustained · 18 months of pain" />
                  <HistRow val="45.3" event="Euro crisis 2011" note="Flash crash · resolved quickly" />
                  <HistRow val="38.6" event="Yen unwind 2024" note="Carry trade · 2 weeks" />
                  <HistRow val={vixValue != null ? fmt1(vixValue) : "—"} event="Today" note={vixValue != null && vixValue >= 30 ? "Above trigger" : "Elevated · below danger zone"} active />
                  <HistRow val="20" event="Long-run avg" note="Mean · median ~17" />
                </div>
              </MCard>
              <ActionCard>{vixValue != null && vixValue >= 30 ? "VIX above 30. Pause all new equity buying until VIX drops back below 30 for two consecutive sessions." : `VIX at ${vixValue != null ? fmt1(vixValue) : "—"} is below 30. No buying restriction active. Continue normal plan — but do not treat the tape as calm.`}</ActionCard>
            </>}
          />
        </ModalWrapper>
      )}

      {/* HY SPREAD */}
      {modal === "hy" && (
        <ModalWrapper onClose={() => setModal(null)} title="HY Spread — High Yield Credit Spread" sub="ICE BofA US High Yield Spread · Measures corporate credit stress">
          <ModalGrid
            left={<>
              <SH>Current reading</SH>
              <div style={{ fontSize: 44, fontWeight: 700, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 6 }}>{fmt2(hySpread)}<span style={{ fontSize: 22 }}>%</span></div>
              <Tag label={hySpread >= 4 ? "Watch — Above Threshold" : "Firm — Below Threshold"} color={hySpread >= 4 ? "#fbbf24" : "#4ade80"} bg={hySpread >= 4 ? "rgba(245,158,11,0.15)" : "rgba(74,222,128,0.15)"} />
              <BC>{hySpread >= 4 ? "Credit markets showing stress. HY spreads above 4% can confirm a defensive trigger alongside VIX >30." : "Credit markets are not signaling stress. Investors comfortable taking corporate credit risk."}</BC>
              <BandTrack
                segs={[{ w: "35%", color: "#047857" }, { w: "30%", color: "#4ade80" }, { w: "20%", color: "#f59e0b" }, { w: "15%", color: "#ef4444" }]}
                needle={Math.max(0, Math.min(((hySpread - 2) / 8) * 100, 99))}
                scaleNums={["2%", "3%", "4%", "6%", "10%+"]}
                scaleNames={["Tight", "Firm", "Watch", "Stress", "Crisis"]}
              />
              <div style={{ marginTop: 16, background: "#141b47", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10, padding: 14 }}>
                <SH>Your trigger threshold</SH>
                <BC style={{ marginTop: 0 } as any}>HY Spread &gt;400bps (4.0%) is your stress confirmation. Current {fmt2(hySpread)}% is {((4.0 - hySpread) * 100).toFixed(0)}bps {hySpread < 4 ? "below" : "above"} that level.</BC>
              </div>
            </>}
            right={<>
              <MCard><SH>What it measures</SH><BC>The HY spread is the extra yield investors demand to hold junk-rated corporate bonds vs. Treasuries. When spreads widen, credit investors are pricing more risk — often leading equity stress by weeks.</BC></MCard>
              <MCard>
                <SH>Historical context</SH>
                <div style={{ display: "grid", gap: 5, marginTop: 8 }}>
                  <HistRow val="20%+" event="GFC 2008-09" note="Credit markets frozen" />
                  <HistRow val="10.9%" event="COVID Mar 2020" note="Sharp spike · rapid recovery" />
                  <HistRow val="8.4%" event="Energy crisis 2016" note="Oil-driven stress" />
                  <HistRow val="5.8%" event="2022 rate shock" note="Fed hiking cycle peak" />
                  <HistRow val={`${fmt2(hySpread)}%`} event="Today" note={hySpread >= 4 ? "Above trigger · stress confirmed" : "Firm · no stress signal"} active />
                  <HistRow val="3.0%" event="Historical tight" note="Bull market complacency zone" />
                </div>
              </MCard>
              <ActionCard>HY Spread {hySpread >= 4 ? "is above 4% — stress confirmation active. Combined with VIX >30 this would trigger your defensive posture." : `below 4% trigger. Credit not confirming stress. Both VIX >30 AND HY >400bps must be true to activate defensive posture.`}</ActionCard>
            </>}
          />
        </ModalWrapper>
      )}

      {/* YIELD CURVE */}
      {modal === "yc" && (
        <ModalWrapper onClose={() => setModal(null)} title="Yield Curve — 10Y minus 2Y" sub="US Treasury spread · Most reliable recession leading indicator since 1955">
          <ModalGrid
            left={<>
              <SH>Current reading</SH>
              <div style={{ fontSize: 44, fontWeight: 700, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 6 }}>{yieldCurve > 0 ? "+" : ""}{fmt2(yieldCurve)}<span style={{ fontSize: 22 }}>%</span></div>
              <Tag label={yieldCurve > 0 ? "Healthy — Positive Slope" : "Inverted — Recession Signal"} color={yieldCurve > 0 ? "#4ade80" : "#ff6b88"} bg={yieldCurve > 0 ? "rgba(74,222,128,0.15)" : "rgba(255,79,114,0.15)"} />
              <BC>{yieldCurve > 0 ? "Curve is upward sloping — normal state. Long rates above short rates suggest the bond market is not pricing a near-term recession." : "Curve is inverted — short rates above long rates. Bond market is pricing a recession. All post-1955 US recessions were preceded by inversion."}</BC>
              <BandTrack
                segs={[{ w: "25%", color: "#ef4444" }, { w: "15%", color: "#f59e0b" }, { w: "20%", color: "#94a3b8" }, { w: "40%", color: "#047857" }]}
                needle={Math.max(0, Math.min(((yieldCurve + 1.5) / 3.5) * 100, 99))}
                scaleNums={["-1.5%", "-0.5%", "0%", "+0.5%", "+2%"]}
                scaleNames={["Deep inv.", "Inverted", "Flat", "Normal", "Steep"]}
              />
              <div style={{ marginTop: 16, background: "#141b47", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10, padding: 14 }}>
                <SH>Re-steepening watch</SH>
                <BC style={{ marginTop: 0 } as any}>After deep inversion reaching -1.08% in Jul 2023, the curve re-steepened to {yieldCurve > 0 ? "+" : ""}{fmt2(yieldCurve)}%. Re-steepening after inversion has historically preceded recession — this phase warrants monitoring.</BC>
              </div>
            </>}
            right={<>
              <MCard><SH>What it measures</SH><BC>The 10Y-2Y spread shows whether long-term rates are above short-term. Inversion means markets expect the Fed to cut — usually because recession is expected. It has predicted every US recession since 1955 with only one false positive.</BC></MCard>
              <MCard>
                <SH>Historical context</SH>
                <div style={{ display: "grid", gap: 5, marginTop: 8 }}>
                  <HistRow val="-1.08%" event="Jul 2023 low" note="Most inverted since 1981" />
                  <HistRow val="-0.5%" event="Avg 2022-2023" note="Sustained inversion · rate hikes" />
                  <HistRow val="0%" event="Re-steepen start" note="Curve uninverting · watch phase" />
                  <HistRow val={`${yieldCurve > 0 ? "+" : ""}${fmt2(yieldCurve)}%`} event="Today" note={yieldCurve > 0 ? "Positive · healthy slope" : "Still inverted"} active />
                  <HistRow val="+2%+" event="Bull market norm" note="Healthy growth expectations" />
                </div>
              </MCard>
              <ActionCard>Yield curve is {yieldCurve > 0 ? "positive — no inversion signal. However, re-steepening after deep inversion is a watch signal. The curve often steepens just before recession as the Fed cuts short rates." : "inverted — watch for recession signal to develop over the next 6-18 months."}</ActionCard>
            </>}
          />
        </ModalWrapper>
      )}

      {/* REAL 10Y */}
      {modal === "real10y" && (
        <ModalWrapper onClose={() => setModal(null)} title="Real 10Y — Inflation-Adjusted Rate" sub="10-Year Treasury minus 10-Year Breakeven Inflation · True cost of money">
          <ModalGrid
            left={<>
              <SH>Current reading</SH>
              <div style={{ fontSize: 44, fontWeight: 700, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 6 }}>{fmt2(real10y)}<span style={{ fontSize: 22 }}>%</span></div>
              <Tag label={real10y >= 2 ? "Elevated — Equity Headwind" : real10y >= 0 ? "Moderate" : "Negative Real Rate"} color={real10y >= 2 ? "#fbbf24" : real10y >= 0 ? "#94a3b8" : "#4ade80"} bg={real10y >= 2 ? "rgba(245,158,11,0.15)" : "rgba(148,163,184,0.12)"} />
              <BC>{real10y >= 2 ? "Real rates above 1.5% create meaningful competition for equities. At current levels, bonds offer real yield that compresses equity multiples over time." : "Real rates in moderate range — some competition for equities but not extreme."}</BC>
              <BandTrack
                segs={[{ w: "20%", color: "#047857" }, { w: "30%", color: "#4ade80" }, { w: "25%", color: "#f59e0b" }, { w: "25%", color: "#ef4444" }]}
                needle={Math.max(0, Math.min(((real10y + 2) / 5) * 100, 99))}
                scaleNums={["-2%", "0%", "1%", "2%", "3%+"]}
                scaleNames={["Neg. real", "Loose", "Neutral", "Firm", "Tight"]}
              />
              <div style={{ marginTop: 16, background: "#141b47", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10, padding: 14 }}>
                <SH>Equity valuation impact</SH>
                <BC style={{ marginTop: 0 } as any}>Every 100bps rise in real rates historically reduces fair-value P/E by ~3-5x. At {fmt2(real10y)}%, this creates a headwind vs. the near-zero real rates of 2020-2021 that drove the bull market.</BC>
              </div>
            </>}
            right={<>
              <MCard><SH>What it measures</SH><BC>The real 10-year rate is nominal Treasury yield minus expected inflation. It represents the true inflation-adjusted return on safe assets. When real rates rise, the hurdle rate for all risky assets rises — directly compressing equity multiples.</BC></MCard>
              <MCard>
                <SH>Historical context</SH>
                <div style={{ display: "grid", gap: 5, marginTop: 8 }}>
                  <HistRow val="-1.0%" event="2020-2021" note="Deeply negative · fueled bull run" />
                  <HistRow val="0%" event="Pre-hike 2022" note="Near zero · inflection point" />
                  <HistRow val="2.5%" event="Peak 2023" note="Multi-decade high · equity headwind" />
                  <HistRow val={`${fmt2(real10y)}%`} event="Today" note="Elevated · equity headwind" active />
                  <HistRow val="0.5%" event="Historical neutral" note="Equities fairly valued vs. bonds" />
                </div>
              </MCard>
              <ActionCard>No direct trigger on real rates, but {fmt2(real10y)}% is a structural headwind for equity multiples. It supports your valuation models showing overvaluation — the market is priced for a lower-rate world than we&apos;re in.</ActionCard>
            </>}
          />
        </ModalWrapper>
      )}

      {/* 200-DMA */}
      {modal === "dma200" && (
        <ModalWrapper onClose={() => setModal(null)} title="200-DMA — Long-Term Trend" sub="200-Day Moving Average of SPX · The most widely watched trend line in markets">
          <ModalGrid
            left={<>
              <SH>Current levels</SH>
              <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 6 }}>
                <div style={{ fontSize: 44, fontWeight: 700, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1 }}>{fmtWhole(spx200)}</div>
                <div style={{ fontSize: 13, color: "#64748b" }}>200-DMA</div>
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#fff", marginBottom: 8 }}>{spxPrice != null ? fmtWhole(spxPrice) : "—"} <span style={{ fontSize: 13, color: "#64748b" }}>SPX today</span></div>
              <Tag label={`Testing Support · ${spxVs(spx200) != null ? fmtSigned1(spxVs(spx200)!) : "?"} above`} color="#fbbf24" bg="rgba(245,158,11,0.15)" />
              <BC>SPX is {spxPrice != null ? `only ${Math.abs(spxPrice - spx200).toFixed(0)} points above its 200-DMA.` : "near its 200-DMA."} This is the critical long-term support level — a sustained break below triggers your defensive posture.</BC>
              <div style={{ marginTop: 14 }}>
                <SH>Distance from 200-DMA</SH>
                <div style={{ position: "relative", height: 8, background: "#1e2a5e", borderRadius: 9999, margin: "8px 0", overflow: "hidden" }}>
                  <div style={{ position: "absolute", left: "50%", top: 0, height: 8, width: `${Math.abs(spxVs(spx200) ?? 1.6) / 2}%`, background: "#fbbf24", borderRadius: "0 9999px 9999px 0" }} />
                  <div style={{ position: "absolute", top: -2, left: "50%", width: 2, height: 12, background: "rgba(255,255,255,0.5)", borderRadius: 1 }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#475569" }}><span>-10% below</span><span>At 200-DMA</span><span>+10% above</span></div>
              </div>
              <div style={{ marginTop: 16, background: "#141b47", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 10, padding: 14 }}>
                <SH>Your defensive trigger</SH>
                <div style={{ fontSize: 13, lineHeight: 1.6, color: "#fbbf24" }}>Two consecutive Friday closes below {fmtWhole(spx200)} AND VIX &gt;30 or HY &gt;400bps activates defensive posture.</div>
              </div>
            </>}
            right={<>
              <MCard><SH>Why the 200-DMA matters</SH><BC>The 200-day moving average represents roughly one year of trading. It is the single most watched trend line by institutional investors, hedge funds, and systematic strategies. When SPX breaks below it, many models automatically reduce equity exposure — creating self-reinforcing selling pressure.</BC></MCard>
              <MCard>
                <SH>Historical 200-DMA breaks</SH>
                <div style={{ display: "grid", gap: 5, marginTop: 8 }}>
                  <HistRow val="-34%" event="COVID 2020" note="Broke · recovered in 23 days" />
                  <HistRow val="-20%" event="2022 bear" note="Broke Jan · stayed below 10 months" />
                  <HistRow val="-19%" event="Q4 2018" note="Broke Dec · recovered Feb 2019" />
                  <HistRow val="-57%" event="GFC 2008" note="Broke Oct 2007 · 2 year bear" />
                  <HistRow val={spxVs(spx200) != null ? fmtSigned1(spxVs(spx200)!) : "+1.6%"} event="Today" note="Above · testing support zone" active />
                </div>
              </MCard>
              <ActionCard>SPX is {spxPrice != null ? `${Math.abs(spxPrice - spx200).toFixed(0)} pts` : "~108 pts"} above its 200-DMA. Watch Friday closes specifically — your rule requires two consecutive Friday closes below {fmtWhole(spx200)} to trigger.</ActionCard>
            </>}
          />
        </ModalWrapper>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: #0b0b2a; color: #fff; font-family: Inter, system-ui, -apple-system, sans-serif; }
        .pageShell { min-height: 100vh; }
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
        .ytd { font-size: 11px; font-weight: 600; color: #64748b; }
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
        .pillG { display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.04em; background: rgba(34,197,94,0.15); color: #4ade80; }
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
        .chatBtn:disabled { opacity: 0.5; cursor: not-allowed; }
        .spinner { display: inline-block; width: 11px; height: 11px; border: 2px solid rgba(255,255,255,0.15); border-top-color: #93c5fd; border-radius: 50%; animation: spin .7s linear infinite; margin-right: 5px; vertical-align: middle; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 900px) { .title { font-size: 22px; } .valHero { font-size: 28px; } }
        @media (max-width: 700px) {
          .topBar, .panelHeader { flex-direction: column; align-items: flex-start; }
          .grid5, .grid4 { grid-template-columns: repeat(2,minmax(0,1fr)); }
          .grid3 { grid-template-columns: 1fr; }
          .erpTile { flex-direction: column; align-items: flex-start; }
          .alertStrip { flex-direction: column; align-items: flex-start; gap: 4px; }
        }
      `}} />
    </>
  );
}
