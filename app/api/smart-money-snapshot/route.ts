import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

const BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const FRED = "https://api.stlouisfed.org/fred/series/observations";
const TIMEOUT_MS = 9000;

function avg(arr: number[]): number {
  const clean = arr.filter((n) => Number.isFinite(n));
  return clean.reduce((s, n) => s + n, 0) / clean.length;
}

// Converts an internal { ticker, weight (decimal), ytd, today } component
// list into the clean shape the drill-down modal on the dashboard reads,
// weight expressed as a whole percentage instead of a 0-1 decimal.
function serializeComponents(
  comps: { ticker: string; weight: number; ytd: number | null; today: number | null }[]
) {
  return comps.map((c) => ({
    ticker: c.ticker,
    weight_pct: Math.round(c.weight * 1000) / 10,
    ytd_pct: c.ytd,
    today_pct: c.today,
  }));
}

async function fetchChart(
  ticker: string,
  days: number,
  interval: "1d" | "1wk" | "1mo" = "1d"
): Promise<{
  closes: number[];
  meta: Record<string, any>;
  timestamps: number[];
  adjcloses: (number | null)[];
  error?: string;
}> {
  const end = Math.floor(Date.now() / 1000);
  const start = end - days * 24 * 60 * 60;
  const url = `${BASE}/${encodeURIComponent(ticker)}?period1=${start}&period2=${end}&interval=${interval}&includePrePost=false`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    console.log(`Fetching ${ticker} chart (${interval})...`);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json",
      },
    });
    console.log(`${ticker} status: ${res.status}`);
    if (!res.ok) {
      const preview = await res.text().catch(() => "");
      console.error(`${ticker} error body: ${preview.slice(0, 200)}`);
      return { closes: [], meta: {}, timestamps: [], adjcloses: [], error: `Yahoo ${ticker}: HTTP ${res.status}` };
    }
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return { closes: [], meta: {}, timestamps: [], adjcloses: [], error: `${ticker}: no chart result` };
    const rawTimestamps: number[] = result.timestamp ?? [];
    const rawCloses: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
    // Dividend/split-adjusted close — only reliable input for a total-return
    // calculation. NOT used for DMA/slope math, which needs the raw close
    // a chart actually shows.
    const rawAdjCloses: (number | null)[] = result.indicators?.adjclose?.[0]?.adjclose ?? [];

    const closes: number[] = [];
    const timestamps: number[] = [];
    const adjcloses: (number | null)[] = [];
    for (let i = 0; i < rawCloses.length; i++) {
      const c = rawCloses[i];
      if (c != null && Number.isFinite(c)) {
        closes.push(Math.round(c * 100) / 100);
        timestamps.push(rawTimestamps[i]);
        const ac = rawAdjCloses[i];
        adjcloses.push(ac != null && Number.isFinite(ac) ? Math.round(ac * 100) / 100 : null);
      }
    }
    console.log(`${ticker} closes: ${closes.length} points`);
    return { closes, meta: result.meta ?? {}, timestamps, adjcloses };
  } catch (err: any) {
    const msg = err?.name === "AbortError" ? `${ticker}: request timed out` : `${ticker}: ${err?.message}`;
    console.error(msg);
    return { closes: [], meta: {}, timestamps: [], adjcloses: [], error: msg };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFred(seriesId: string, limit = 1, compareIndex = 1): Promise<{ value: number | null; prev: number | null; error?: string }> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) return { value: null, prev: null, error: "FRED_API_KEY not set" };
  const url = `${FRED}?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=${limit}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return { value: null, prev: null, error: `FRED ${seriesId}: HTTP ${res.status}` };
    const data = await res.json();
    const obs = data?.observations ?? [];
    const val  = obs[0]?.value && obs[0].value !== "." ? parseFloat(obs[0].value) : null;
    const prev = limit > compareIndex && obs[compareIndex]?.value && obs[compareIndex].value !== "." ? parseFloat(obs[compareIndex].value) : null;
    console.log(`FRED ${seriesId}: ${val}${prev != null ? ` (prev @-${compareIndex}: ${prev})` : ""}`);
    return { value: val, prev };
  } catch (err: any) {
    return { value: null, prev: null, error: `FRED ${seriesId}: ${err?.message}` };
  } finally {
    clearTimeout(timer);
  }
}

// S&P 500 breadth (% of constituents above their 200-DMA). The ticker
// this dashboard used to rely on, ^SPXA200R, is a ThinkorSwim symbol,
// not a Yahoo Finance one, and has never actually resolved there. This
// hits a real, free, no-key JSON endpoint instead. Attribution required
// per their license: "History of Market · 美股编年史 (historyofmarket.com)".
async function fetchBreadth(): Promise<{ value: number | null; error?: string }> {
  const url = "https://historyofmarket.com/api/sp500/breadth.json";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return { value: null, error: `Breadth (historyofmarket.com): HTTP ${res.status}` };
    const data = await res.json();
    const val = typeof data?.latest?.pct200 === "number" ? data.latest.pct200 : null;
    console.log(`Breadth (% above 200-DMA, historyofmarket.com): ${val} as of ${data?.latest?.date}`);
    return { value: val };
  } catch (err: any) {
    return { value: null, error: `Breadth (historyofmarket.com): ${err?.message}` };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPE(): Promise<{ value: number | null; error?: string }> {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=%5EGSPC&fields=trailingPE,forwardPE`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json",
      },
    });
    if (!res.ok) return { value: null, error: `Yahoo v7 PE: HTTP ${res.status}` };
    const data = await res.json();
    const result = data?.quoteResponse?.result?.[0];
    const pe = result?.trailingPE ?? result?.forwardPE ?? null;
    console.log(`PE ratio: ${pe}`);
    return { value: pe };
  } catch (err: any) {
    return { value: null, error: `PE fetch: ${err?.message}` };
  } finally {
    clearTimeout(timer);
  }
}

// Live intraday quote — the chart endpoint's daily closes only update once a
// session settles, so mid-day they can lag by a full trading day for fast-
// moving futures symbols. This endpoint carries an actual real-time quote.
async function fetchLiveQuote(
  ticker: string
): Promise<{ price: number | null; changePct: number | null; error?: string }> {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(ticker)}&fields=regularMarketPrice,regularMarketChangePercent`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json",
      },
    });
    if (!res.ok) return { price: null, changePct: null, error: `Yahoo v7 quote ${ticker}: HTTP ${res.status}` };
    const data = await res.json();
    const result = data?.quoteResponse?.result?.[0];
    const price = typeof result?.regularMarketPrice === "number" ? result.regularMarketPrice : null;
    const changePct = typeof result?.regularMarketChangePercent === "number" ? result.regularMarketChangePercent : null;
    console.log(`${ticker} live quote: $${price} (${changePct?.toFixed(2)}%)`);
    return { price, changePct };
  } catch (err: any) {
    const msg = err?.name === "AbortError" ? `${ticker} live quote: timed out` : `${ticker} live quote: ${err?.message}`;
    return { price: null, changePct: null, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchCape(): Promise<{ value: number | null; error?: string }> {
  const apiKey = process.env.NASDAQ_API_KEY;
  if (!apiKey) return { value: null, error: "NASDAQ_API_KEY not set" };
  const url = `https://data.nasdaq.com/api/v3/datasets/MULTPL/SP500_SHILLER_PE_RATIO_MONTH.json?rows=1&api_key=${apiKey}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return { value: null, error: `Nasdaq CAPE: HTTP ${res.status}` };
    const data = await res.json();
    const latest = data?.dataset?.data?.[0]?.[1];
    const val = latest != null ? parseFloat(latest) : null;
    console.log(`CAPE: ${val}`);
    return { value: val };
  } catch (err: any) {
    return { value: null, error: `CAPE fetch: ${err?.message}` };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFearGreed(): Promise<{ value: number | null; rating: string | null; error?: string }> {
  const url = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json",
        "Referer": "https://www.cnn.com/",
        "Origin": "https://www.cnn.com",
      },
    });
    if (!res.ok) return { value: null, rating: null, error: `CNN F&G: HTTP ${res.status}` };
    const data = await res.json();
    const score = data?.fear_and_greed?.score;
    const rating = data?.fear_and_greed?.rating;
    const value = score != null ? Math.round(parseFloat(score)) : null;
    console.log(`Fear & Greed: ${value} (${rating})`);
    return { value, rating: rating ?? null };
  } catch (err: any) {
    return { value: null, rating: null, error: `Fear & Greed: ${err?.message}` };
  } finally {
    clearTimeout(timer);
  }
}

function computeMonthEndSma(
  closes: number[],
  timestamps: number[],
  months: number = 10
): { sma: number | null; monthEndCloses: number[] } {
  if (closes.length < months || timestamps.length !== closes.length) {
    return { sma: null, monthEndCloses: [] };
  }
  const monthMap: Record<string, number> = {};
  for (let i = 0; i < closes.length; i++) {
    const d = new Date(timestamps[i] * 1000);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    monthMap[key] = closes[i];
  }
  const sortedKeys = Object.keys(monthMap).sort().reverse();
  const recentKeys = sortedKeys.slice(0, months);
  if (recentKeys.length < months) return { sma: null, monthEndCloses: [] };
  const monthEndCloses = recentKeys.map(k => monthMap[k]);
  const sma = monthEndCloses.reduce((s, v) => s + v, 0) / months;
  return { sma: Math.round(sma * 100) / 100, monthEndCloses };
}

// ─── Graded Ivy (S&P trend) → target equity % ───────────────────────────
// Ivy's 10-month rule graded across five lookbacks instead of one yes/no.
// Score = weighted share of month-end SMAs the S&P sits above (10m and 12m
// count double, since they are the core of the Ivy rule). The score is then
// placed inside the personal allocation band (MANUAL_ALLOC_BAND):
//   equity % = floor + score × (ceiling − floor)
// Backtest 2002-2026, 30/60 band: 6.7%/yr est. total return, -21% max
// drawdown, ~3 allocation changes a year (vs -31% for a static mix at the
// same average equity). Official = last completed month-end (act on this).
// Live = current price vs SMAs that include this month's latest close
// (forecast only, same convention as the Ivy table).
const GRADED_IVY_WEIGHTS = [
  { months: 3, weight: 1 },
  { months: 6, weight: 1 },
  { months: 8, weight: 1 },
  { months: 10, weight: 2 },
  { months: 12, weight: 2 },
];

type GradedIvyReading = {
  asOf: string;
  price: number;
  score: number;
  equityPct: number;
  mas: { months: number; weight: number; sma: number; above: boolean; gapPct: number }[];
};

function gradedIvyReading(
  monthEnds: { key: string; close: number; ts: number }[],
  price: number,
  asOfTs: number,
  floor: number,
  ceiling: number
): GradedIvyReading | null {
  const maxMonths = Math.max(...GRADED_IVY_WEIGHTS.map(w => w.months));
  if (monthEnds.length < maxMonths || !Number.isFinite(price)) return null;
  const totalWeight = GRADED_IVY_WEIGHTS.reduce((s, w) => s + w.weight, 0);
  let bullWeight = 0;
  const mas = GRADED_IVY_WEIGHTS.map(({ months, weight }) => {
    const window = monthEnds.slice(-months);
    const sma = window.reduce((s, m) => s + m.close, 0) / months;
    const above = price > sma;
    if (above) bullWeight += weight;
    return { months, weight, sma: Math.round(sma * 100) / 100, above, gapPct: Math.round(((price - sma) / sma) * 1000) / 10 };
  });
  const score = bullWeight / totalWeight;
  const equityPct = Math.round((floor + score * (ceiling - floor)) * 10) / 10;
  const asOf = new Date(asOfTs * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return { asOf, price: Math.round(price * 100) / 100, score: Math.round(score * 1000) / 1000, equityPct, mas };
}

function computeGradedIvy(
  closes: number[],
  timestamps: number[],
  livePrice: number | null,
  floor: number,
  ceiling: number
): { official: GradedIvyReading | null; live: GradedIvyReading | null; floor: number; ceiling: number } {
  const empty = { official: null, live: null, floor, ceiling };
  if (closes.length === 0 || timestamps.length !== closes.length) return empty;
  // Last close of each calendar month, oldest first.
  const byMonth = new Map<string, { key: string; close: number; ts: number }>();
  for (let i = 0; i < closes.length; i++) {
    const d = new Date(timestamps[i] * 1000);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    byMonth.set(key, { key, close: closes[i], ts: timestamps[i] });
  }
  const months = Array.from(byMonth.values()).sort((a, b) => a.key.localeCompare(b.key));
  // The month of the latest close is still in progress. Everything before
  // it is a completed month-end.
  const completed = months.slice(0, -1);
  const lastDone = completed[completed.length - 1];
  const official = lastDone ? gradedIvyReading(completed, lastDone.close, lastDone.ts, floor, ceiling) : null;
  const current = months[months.length - 1];
  const live = gradedIvyReading(months, livePrice ?? current.close, timestamps[timestamps.length - 1], floor, ceiling);
  return { official, live, floor, ceiling };
}

// ─── Roberts Risk Signals (Lance Roberts' weekly/monthly framework) ──────
// Four yes/no checks on the S&P, graded and placed in the allocation band:
//   weekly MACD 12/26/9 buy (x1), slower weekly MACD 26/52/18 buy (x2),
//   close above the 40-week SMA (x2), monthly MACD 12/26/9 buy (x2).
// Inspired by his published process, not his exact model (he doesn't
// publish the slower MACD settings). Backtest 2002-2026, 30/60 band:
// 6.6%/yr, -22% max drawdown, -8.7% in 2022 (best of the models tested),
// ~6 allocation changes a year. Needs 10y of weekly and 15y of monthly
// bars so the slow EMAs are fully warmed up.
function ema(values: number[], span: number): number[] {
  const alpha = 2 / (span + 1);
  const out: number[] = [];
  values.forEach((v, i) => out.push(i === 0 ? v : alpha * v + (1 - alpha) * out[i - 1]));
  return out;
}
function macdBuy(closes: number[], fast: number, slow: number, signal: number): boolean {
  const f = ema(closes, fast), s = ema(closes, slow);
  const line = closes.map((_, i) => f[i] - s[i]);
  const sig = ema(line, signal);
  return line[line.length - 1] > sig[sig.length - 1];
}
// One close per period (Yahoo can append an extra intraday row to the
// current weekly/monthly bar), oldest first.
function lastClosePerPeriod(closes: number[], timestamps: number[], period: "week" | "month"): number[] {
  const byKey = new Map<string, number>();
  for (let i = 0; i < closes.length; i++) {
    const d = new Date(timestamps[i] * 1000);
    let key: string;
    if (period === "month") {
      key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    } else {
      const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7)));
      key = monday.toISOString().slice(0, 10);
    }
    byKey.set(key, closes[i]);
  }
  return Array.from(byKey.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(e => e[1]);
}
function computeRobertsRisk(
  weekly: { closes: number[]; timestamps: number[] },
  monthly: { closes: number[]; timestamps: number[] },
  floor: number,
  ceiling: number
): { equityPct: number; score: number; signals: { key: string; label: string; weight: number; buy: boolean }[] } | null {
  const w = lastClosePerPeriod(weekly.closes, weekly.timestamps, "week");
  const m = lastClosePerPeriod(monthly.closes, monthly.timestamps, "month");
  if (w.length < 150 || m.length < 60) return null;
  const sma40 = w.slice(-40).reduce((s, v) => s + v, 0) / 40;
  const signals = [
    { key: "wMacd",     label: "Weekly MACD",      weight: 1, buy: macdBuy(w, 12, 26, 9) },
    { key: "wMacdSlow", label: "Slow weekly MACD", weight: 2, buy: macdBuy(w, 26, 52, 18) },
    { key: "wk40",      label: "40-week SMA",      weight: 2, buy: w[w.length - 1] > sma40 },
    { key: "mMacd",     label: "Monthly MACD",     weight: 2, buy: macdBuy(m, 12, 26, 9) },
  ];
  const total = signals.reduce((s, x) => s + x.weight, 0);
  const score = signals.reduce((s, x) => s + (x.buy ? x.weight : 0), 0) / total;
  return { equityPct: Math.round((floor + score * (ceiling - floor)) * 10) / 10, score: Math.round(score * 1000) / 1000, signals };
}

// ─── Credit (HY spread) → target equity % ───────────────────────────────
// Ceiling at 300 bps or tighter, straight line down to the floor at 500 bps
// (the industry red line). No smoothing and no automated capitulation
// re-entry: deploying into fear stays a human call. Long-history test on
// BAA10Y (2002-2026): exits early (floor by Jan 2008), re-enters late,
// correlation with the trend models only 0.35, so it earns its own vote.
const CREDIT_CEILING_BPS = 300;
const CREDIT_FLOOR_BPS = 500;
function computeCredit(hyBps: number, floor: number, ceiling: number) {
  const score = Math.max(0, Math.min(1, 1 - (hyBps - CREDIT_CEILING_BPS) / (CREDIT_FLOOR_BPS - CREDIT_CEILING_BPS)));
  return { equityPct: Math.round((floor + score * (ceiling - floor)) * 10) / 10, score: Math.round(score * 1000) / 1000, hyBps: Math.round(hyBps), ceilingBps: CREDIT_CEILING_BPS, floorBps: CREDIT_FLOOR_BPS };
}

async function fetchIvyPosition(ticker: string): Promise<{
  price: number | null;
  sma: number | null;
  variancePct: number | null;
  signal: "Invest" | "Cash" | null;
  error?: string;
}> {
  const end = Math.floor(Date.now() / 1000);
  const start = end - 320 * 24 * 60 * 60;
  const url = `${BASE}/${encodeURIComponent(ticker)}?period1=${start}&period2=${end}&interval=1d&includePrePost=false`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json",
      },
    });
    if (!res.ok) return { price: null, sma: null, variancePct: null, signal: null, error: `Yahoo ${ticker}: HTTP ${res.status}` };
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return { price: null, sma: null, variancePct: null, signal: null, error: `${ticker}: no result` };

    const timestamps: number[] = result.timestamp ?? [];
    const rawCloses: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
    const closes = rawCloses.map((c, i) => ({ c, t: timestamps[i] }))
      .filter(x => x.c != null && Number.isFinite(x.c!))
      .map(x => ({ c: Math.round(x.c! * 100) / 100, t: x.t }));

    if (closes.length < 20) return { price: null, sma: null, variancePct: null, signal: null, error: `${ticker}: insufficient data` };

    const price = result.meta.regularMarketPrice ?? closes[closes.length - 1].c;
    const { sma } = computeMonthEndSma(closes.map(x => x.c), closes.map(x => x.t));

    if (sma == null || price == null) return { price, sma: null, variancePct: null, signal: null };

    const variancePct = Math.round(((price - sma) / sma) * 1000) / 10;
    const signal: "Invest" | "Cash" = price >= sma ? "Invest" : "Cash";
    console.log(`Ivy ${ticker}: price=${price} sma=${sma} variance=${variancePct}% → ${signal}`);
    return { price, sma, variancePct, signal };
  } catch (err: any) {
    const msg = err?.name === "AbortError" ? `${ticker}: timeout` : `${ticker}: ${err?.message}`;
    return { price: null, sma: null, variancePct: null, signal: null, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

// ═══════════════════════════════════════════════════════════════════
// PORTFOLIO POSITION HEALTH — price vs 200-DMA, slope, daily change
// Reuses the exact same avg/slope math already proven on the SPX tiles.
// ═══════════════════════════════════════════════════════════════════

type PositionMetrics = {
  ticker: string;
  price: number | null;
  dailyChangePct: number | null;
  dma200: number | null;
  slope200: number | null;
  pctVs200: number | null;
  ytdReturnPct: number | null;
  oneYearReturnPct: number | null;
  fiveYearReturnPct: number | null; // live, same technique as YTD/1-YR — see fetchPositionMetrics
  error?: string;
};


async function fetchPositionMetrics(ticker: string): Promise<PositionMetrics> {
  // 1830 calendar days (~5 years) covers the 200-DMA (needs ~380 days),
  // YTD (needs back to Jan 1), 1-YR (needs back 365 days), AND 5-YR (needs
  // back ~1825 days) from one single fetch. Tickers with less than 5 years
  // of actual trading history (e.g. BTAL's current strategy only dates to
  // Feb 2022) simply won't have a timestamp that far back — the 5-YR calc
  // below handles that by returning null rather than guessing.
  const chart = await fetchChart(ticker, 1830);

  if (chart.error || chart.closes.length < 220) {
    return {
      ticker,
      price: null,
      dailyChangePct: null,
      dma200: null,
      slope200: null,
      pctVs200: null,
      ytdReturnPct: null,
      oneYearReturnPct: null,
      fiveYearReturnPct: null,
      error: chart.error ?? `${ticker}: insufficient price history for 200-DMA`,
    };
  }

  const closes = chart.closes;
  const price: number | null = chart.meta.regularMarketPrice ?? closes[closes.length - 1] ?? null;
  const prevClose: number | null =
    closes.length >= 2 ? closes[closes.length - 2] : chart.meta.chartPreviousClose ?? null;
  const dailyChangePct: number | null =
    price != null && prevClose != null ? ((price - prevClose) / prevClose) * 100 : null;

  const dma200: number = avg(closes.slice(-200));
  const dma200_prev: number | null = closes.length >= 220 ? avg(closes.slice(-220, -20)) : null;
  const slope200: number | null =
    dma200_prev != null ? ((dma200 - dma200_prev) / dma200_prev) * 100 : null;
  const pctVs200: number | null = price != null ? ((price - dma200) / dma200) * 100 : null;

  // YTD total return — dividend-adjusted close at the first trading day of
  // the current calendar year, vs today's live price. Using adjclose at the
  // start and live price at the end is the standard total-return method:
  // the most recent adjclose already equals the most recent raw close, so
  // pairing live price with it loses nothing and stays maximally current.
  const currentYear = new Date().getUTCFullYear();
  const ytdStartIdx = chart.timestamps.findIndex(
    (t) => new Date(t * 1000).getUTCFullYear() === currentYear
  );
  const startAdjClose = ytdStartIdx >= 0 ? chart.adjcloses[ytdStartIdx] : null;
  const ytdReturnPct: number | null =
    startAdjClose != null && price != null && startAdjClose !== 0
      ? ((price - startAdjClose) / startAdjClose) * 100
      : null;

  // 1-YR total return — same technique as YTD above, just anchored 365
  // calendar days back instead of Jan 1. The 380-day fetch window already
  // covers this with no second network call, unlike the 5-YR figure below.
  const oneYearAgoMs = Date.now() - 365 * 24 * 60 * 60 * 1000;
  let oneYearStartIdx = -1;
  for (let i = 0; i < chart.timestamps.length; i++) {
    if (chart.timestamps[i] * 1000 >= oneYearAgoMs) { oneYearStartIdx = i; break; }
  }
  const oneYearStartAdjClose = oneYearStartIdx >= 0 ? chart.adjcloses[oneYearStartIdx] : null;
  const oneYearReturnPct: number | null =
    oneYearStartAdjClose != null && price != null && oneYearStartAdjClose !== 0
      ? ((price - oneYearStartAdjClose) / oneYearStartAdjClose) * 100
      : null;

  // 5-YR total return — same technique again, anchored 5*365 days back.
  // Now possible with zero extra network calls since the fetch window
  // above was widened to 1830 days specifically for this. Tickers with
  // under 5 years of actual trading history (BTAL's current strategy only
  // dates to Feb 2022) simply have no timestamp that old — the loop below
  // never finds a match, fiveYearStartIdx stays -1, and this correctly
  // returns null rather than guessing at a return the fund never had.
  const fiveYearAgoMs = Date.now() - 5 * 365 * 24 * 60 * 60 * 1000;
  let fiveYearStartIdx = -1;
  for (let i = 0; i < chart.timestamps.length; i++) {
    if (chart.timestamps[i] * 1000 >= fiveYearAgoMs) { fiveYearStartIdx = i; break; }
  }
  const fiveYearStartAdjClose = fiveYearStartIdx >= 0 ? chart.adjcloses[fiveYearStartIdx] : null;
  const fiveYearReturnPct: number | null =
    fiveYearStartAdjClose != null && price != null && fiveYearStartAdjClose !== 0
      ? ((price - fiveYearStartAdjClose) / fiveYearStartAdjClose) * 100
      : null;

  console.log(
    `${ticker}: price=${price} 200dma=${dma200.toFixed(2)} slope=${slope200?.toFixed(2)}% vs200=${pctVs200?.toFixed(2)}% ytd=${ytdReturnPct?.toFixed(2)}% 1yr=${oneYearReturnPct?.toFixed(2)}% 5yr=${fiveYearReturnPct?.toFixed(2)}%`
  );

  return {
    ticker, price, dailyChangePct, dma200, slope200, pctVs200, ytdReturnPct,
    oneYearReturnPct,
    fiveYearReturnPct,
    error: chart.error,
  };
}

// Update this list when the GLDM → SCHD swap executes.
const POSITION_TICKERS = ["VTI", "SCHD", "VEA", "SGOV", "VTIP", "VGIT", "GLDM"] as const;

export async function GET() {
  const diagnostics: Record<string, string> = {};

  // ═══════════════════════════════════════════════════════════════════
  // SATURDAY MANUAL UPDATE CHECKLIST — update every weekend
  // ═══════════════════════════════════════════════════════════════════
  const MANUAL_CAPE_FALLBACK       = 36.44;    // multpl.com/shiller-pe          · Nov 20 2026
  const MANUAL_BUFFETT_SIGMA       = 1.83;     // currentmarketvaluation.com     · Nov 20 2026 (Overvalued, down from 2.33 Strongly Overvalued on Oct 31)
  const MANUAL_HY_FALLBACK         = 3.52;     // FRED BAMLH0A0HYM2 (÷100=%)    · Nov 19 2026 (up from 3.14 on Oct 28)
  const MANUAL_FEAR_GREED_FALLBACK = 25;       // CNN Fear & Greed Index         · Nov 18 2026 (Extreme Fear)
  const MANUAL_PE_FALLBACK         = 23.1;     // est. = Nov 20 close 6,910 ÷ MANUAL_SPX_TTM_EPS · Nov 20 2026
  // Earnings denominators. Both live fetches (Nasdaq Data Link CAPE, Yahoo v7
  // P/E) are failing, so when they fail the route now ESTIMATES CAPE and P/E
  // from today's S&P price ÷ these denominators instead of freezing a stale
  // ratio. The denominators move slowly: refresh E10 monthly, TTM EPS after
  // each earnings season.
  const MANUAL_CAPE_E10    = 189.64; // 10-yr avg real EPS implied by CAPE 36.44 at the Nov 20 close 6,910.39 · Nov 20 2026
  const MANUAL_SPX_TTM_EPS = 298.9;  // FactSet trailing P/E 25.4 at the Nov 12 close 7,592.40 (operating basis) · Nov 13 2026
  // As-of dates for the fallbacks above. When a live fetch fails and a
  // fallback is used, the page shows the value WITH this date so a stale
  // number is never mistaken for a live one. Update the date whenever you
  // update the value.
  const FALLBACK_ASOF = {
    cape:       "est. from price, E10 as of Nov 20 2026",
    hy:         "Nov 19 2026",
    fear_greed: "Nov 18 2026",
    pe:         "est. from price, TTM EPS as of Nov 13 2026",
  };
  const MANUAL_BREADTH_FALLBACK    = 0;        // Deliberately impossible. 0% means the live historyofmarket.com fetch failed, not a real reading
  const MANUAL_FED_STANCE: "easing" | "holding" | "tightening" = "tightening"; // Nov 21, 2026: still tightening. Oct 28 hawkish hold at 3.75-4.00% (Cook, Hammack dissented for a hike). Nov 18 minutes divided. Waller wants 50 bp in Dec after a third straight 0.3% core CPI, Williams pushed back on 50, Cook warns of falling behind the curve.
  // Market-implied lean for the NEXT meeting — this is a genuine proxy,
  // not a live feed. True meeting-by-meeting odds (CME FedWatch-style)
  // come from Fed funds futures pricing, which isn't in this pipeline.
  // Update this by hand, weekly, from Fed funds futures pricing or
  // financial press coverage of the next FOMC meeting.
  const MANUAL_FED_NEXT_MOVE = {
    lean: "hawkish" as "hawkish" | "neutral" | "dovish",
    hikeOdds: 95,                              // CME FedWatch, Dec hike odds ~95% (mostly 25 bp, small 50 bp tail) · Nov 17 2026 close. Recheck Monday after Friday's selloff
    meeting: "Dec 8-9",
  };
  // Ivy Portfolio OFFICIAL month-end signals (Faber 10-mo SMA rule).
  // Single source of truth: drives the composite score here AND the Top 10,
  // Signal Inputs and Ivy table on the page. Update monthly after Advisor
  // Perspectives publishes (advisorperspectives.com/dshort). The live
  // price-vs-SMA reading from fetchIvyPosition() is a forecast only and
  // no longer feeds the score.
  const MANUAL_IVY = {
    signals: { vti: "Invest", veu: "Cash", ief: "Cash", vnq: "Invest", dbc: "Invest" } as Record<"vti" | "veu" | "ief" | "vnq" | "dbc", "Invest" | "Cash">,
    asOf:       "Oct 31",                       // month-end close the signals come from
    validUntil: "Nov 30",                       // next month-end reading
  };                                           // Oct 31 2026 · VEU (-0.7%) + IEF (-0.9%) in Cash, VNQ back to Invest (+1.0%)
  // Personal equity allocation band. Every allocation model tile resolves to
  // a % inside floor-ceiling. Baseline 50% with a wide 30-70% band so the
  // models can show when they want to go past the 40-60% comfort range
  // instead of being capped. "actual" is the blended equity across Mike's
  // and Noelle's accounts, update when the real allocation changes.
  // Backtest 2002-2026, Consensus in 30/70: 7.1%/yr, -22% max drawdown,
  // ~5 allocation changes a year.
  const MANUAL_ALLOC_BAND = { floor: 30, ceiling: 70, baseline: 50, comfortLow: 40, comfortHigh: 60, actual: 45 };
  // US vs international share of the equity sleeve (M2: SCHD/VTI/VTWO 30
  // vs VEA/VIGI 20; Noelle TOD: VTI 25 vs VXUS 15). Blends the two Graded
  // Ivy tiles into ONE trend vote in Consensus, so trend never outweighs
  // momentum and credit. Update if the equity mix changes.
  const MANUAL_EQUITY_MIX = { us: 60, intl: 40 };
  // PiTrade ROAR Score (Rob Isbitts), market level, shown as published
  // (40 = 40% equity).
  // OUTSIDE VIEW ONLY: not a tested model, keep it out of any composite.
  // Add a new row each time he publishes (newest last, never edit old rows).
  // Review in Nov 2027: compare each call with Graded Ivy and what the S&P
  // did next, then promote the tile or drop it.
  const MANUAL_ROAR_LOG: { date: string; score: number }[] = [
    { date: "2026-11-14", score: 40 },
    { date: "2026-11-21", score: 20 },          // "Higher risk zone" after the 8.6% weekly drop
  ];
  const MANUAL_AAII_BEARS = 42.2;             // AAII Sentiment Survey · week ending Nov 18 2026 · -9.2pts w/w (51.4% prior week), bullish 33.3%, neutral 24.4%
  const MANUAL_AD = {                          // StockCharts $NYAD cumulative, daily, 1Y · Nov 20 2026 · update MONTHLY
    // signal: bearish_divergence = A/D falling while SPX holds near highs (narrow market)
    //         confirming_weakness = A/D and SPX falling together (broad selling)
    signal:      "confirming_weakness" as "bullish_divergence" | "neutral" | "bearish_divergence" | "confirming_weakness",
    adTrend:     "lower_lows" as "higher_lows" | "flat" | "lower_lows",        // A/D line's own swing lows, last ~3 months
    spxTrend:    "falling" as "rising" | "flat" | "falling",                    // S&P 500 over the same window
    adVsSpx:     "diverging_down" as "diverging_up" | "tracking" | "diverging_down",
    note:        "A/D line fell to 104,811 on Nov 20, about 15% below its mid-August peak near 122,800, and broke below the October base (111-113K) and its March low (about 108K) to the lowest level in a year. The S&P is falling with it but is still above its March low, so breadth is weaker than the index. A/D is below its 20-day (110,411), 50-day (112,139) and 200-day (116,195) averages, and the 50-day has been under the 200-day since early October.",
    updatedDate: "Nov 20",
  };

  // ─── WEEKLY VIEW inputs (main page) ─────────────────────────────────
  // Earnings: FactSet "Earnings Insight" (free PDF every Friday). Record the
  // forward 12-month EPS and whether estimates are rising, flat or falling.
  // This is the signal that separates a valuation reset from an earnings
  // recession, and the one Lance asks first ("have the fundamentals changed?").
  const MANUAL_EARNINGS = {
    fwdEps: 415.82,                            // FactSet forward 12-month EPS · Nov 5 2026
    trend: "rising" as "rising" | "flat" | "falling",
    note: "Q4 EPS estimates up 1.1% since Sep 30, Q3 growth about 31% (FactSet)",
    asOf: "Nov 13",
  };
  const MANUAL_SAHM = { value: 0.00, asOf: "Oct" };   // FRED SAHMREALTIME · next release with the Dec 4 jobs report
  const MANUAL_CORE_PCE = { value: 3.3, label: "Oct actual (BEA, Nov 25)" }; // next release with Nov data in Dec
  // Calendar: shown on the main page for the next 3 weeks. Add, never edit history.
  const MANUAL_CALENDAR: { date: string; item: string; kind: "market" | "plan" }[] = [
    { date: "2026-11-23", item: "Fed's Williams speaks · flash PMIs", kind: "market" },
    { date: "2026-11-24", item: "Consumer confidence", kind: "market" },
    { date: "2026-11-25", item: "Core PCE, Q3 GDP (2nd est.), claims, Beige Book", kind: "market" },
    { date: "2026-11-26", item: "Markets closed (Thanksgiving)", kind: "market" },
    { date: "2026-11-27", item: "Half day, 1 p.m. ET close", kind: "market" },
    { date: "2026-11-30", item: "Month-end: Ivy signals and 10-month trend check", kind: "plan" },

    { date: "2026-12-04", item: "November jobs report · Sahm update", kind: "market" },
    { date: "2026-12-09", item: "FOMC decision (Dec 8-9)", kind: "market" },
    { date: "2026-12-16", item: "200-DMA clock deadline (Roberts)", kind: "market" },
    { date: "2026-12-31", item: "Last trading day for TOD sales to count in 2026", kind: "plan" },
    { date: "2027-01-02", item: "Quarterly rebalance", kind: "plan" },
    { date: "2027-01-15", item: "Q4 estimated tax check", kind: "plan" },
  ];
  // Action items: the household to-do list. Set status as you go
  // ("open" | "doing" | "done"). Overdue open items show in red.
  const MANUAL_ACTIONS: { item: string; due: string; status: "open" | "doing" | "done" }[] = [
    { item: "TOD sales: work with the accountant on what to sell and when (lot export, 2026 vs 2027 split, VTEB loss harvest, Q4 estimated tax)", due: "2026-12-15", status: "open" },
    { item: "Estate plan with Nicole M: mid-Dec meeting requested to finalize the docs, then update beneficiaries", due: "2026-12-15", status: "doing" },
    { item: "Consolidate Noelle's accounts: SEP IRA and Rollover IRA into her 401k", due: "2026-12-31", status: "open" },
    { item: "Roll the Alpine 401k and Traditional IRA into the Rollover IRA", due: "2026-12-31", status: "open" },
    { item: "Set up the dedicated financial email, move accounts to it, freeze credit", due: "2026-12-31", status: "open" },
    { item: "Gather plan inputs for Chris: spending estimate, Social Security statements, college costs, health insurance costs", due: "2027-01-15", status: "open" },
    { item: "Chris meeting: retirement-window plan (retiring 2028 to 2031, send the brief ahead), M27 draft, Spinnaker 401k", due: "2027-02-28", status: "open" },
  ];
  // ═══════════════════════════════════════════════════════════════════

  // Started before the main batch so they run in parallel with it.
  const spxWeeklyP = fetchChart("^GSPC", 3660, "1wk");
  const veaDailyP = fetchChart("VEA", 420);   // Graded Ivy · Intl
  const spxMonthlyP = fetchChart("^GSPC", 5480, "1mo");
  const claimsP = fetchFred("ICSA", 14, 13);          // weekly jobless claims, latest vs 13 weeks back
  const tenYrMonthP = fetchFred("DGS10", 23, 21);     // 10-year yield, latest vs ~1 month back (stocks vs bonds)
  const [
    [spx, qqq, vix, dxy, putCall, fredReal10y, fredNom10y, fredHY, fredYC, fredFedFunds, fredBreakeven, peData, capeData, fearGreedData, ivyVTI, ivyVEU, ivyIEF, ivyVNQ, ivyDBC, fredWALCL, djt, brent, breadthResult],
    positionResults,
    benchmarkBND,
    brentLiveQuote,
    cleanSlateExtras,
    lplImgExtras,
    vgBNDX,
    noelleExtras,
    c1TaxExtras,
  ] = await Promise.all([
    Promise.all([
      fetchChart("^GSPC", 420),
      fetchChart("QQQ", 420),
      fetchChart("^VIX", 14),                  // 14 calendar days so a 5-trading-day-ago close is always available
      fetchChart("DX-Y.NYB", 5),
      fetchChart("^CPCE", 5),
      fetchFred("DFII10"),
      fetchFred("DGS10"),
      fetchFred("BAMLH0A0HYM2", 6, 5),        // latest + the reading 5 business days back (week-over-week)
      fetchFred("T10Y2Y"),
      fetchFred("FEDFUNDS", 13, 12),
      fetchFred("T5YIE"),
      fetchPE(),
      fetchCape(),
      fetchFearGreed(),
      fetchIvyPosition("VTI"),
      fetchIvyPosition("VEU"),
      fetchIvyPosition("IEF"),
      fetchIvyPosition("VNQ"),
      fetchIvyPosition("DBC"),
      fetchFred("WALCL", 2),
      fetchChart("^DJT", 420),
      fetchChart("BZ=F", 5),
      fetchBreadth(),
    ]),
    Promise.all(POSITION_TICKERS.map((t) => fetchPositionMetrics(t))),
    // Benchmark proxy — 60% VTI / 40% BND, tracking the same two indices
    // (CRSP US Total Market, Bloomberg US Agg Float Adjusted) VBINX itself
    // is built on. VTI is already fetched above as a portfolio holding, so
    // BND is the only new call needed. Both reprice intraday, unlike VBINX's
    // once-daily NAV.
    fetchPositionMetrics("BND"),
    // Live Brent quote — primary source for price/change%. The chart fetch
    // above is kept only as a fallback and for the regime bar's history.
    fetchLiveQuote("BZ=F"),
    // "Clean Slate" hypothetical portfolio — the panel's from-scratch build
    // (SCHD 20 / SGOV 20 / VEA 15 / VTIP 10 / VTI 10 / VGIT 10 / DBMF 10 /
    // PDBC 5). Six of those eight are already fetched as real holdings; only
    // PDBC and DBMF are new tickers.
    Promise.all([fetchPositionMetrics("PDBC"), fetchPositionMetrics("DBMF")]),
    // LPL "Income with Moderate Growth" (IMG) proxy — LPL STAAC's 39% equity
    // model, mapped to tradable ETFs. VEA/VGIT/VTIP/SGOV already fetched as
    // real holdings, PDBC/DBMF already fetched above for Clean Slate. Only
    // VUG/VTV/VWO/VCIT/VMBS/IGF are new here.
    Promise.all([
      fetchPositionMetrics("VUG"),
      fetchPositionMetrics("VTV"),
      fetchPositionMetrics("VWO"),
      fetchPositionMetrics("VCIT"),
      fetchPositionMetrics("VMBS"),
      fetchPositionMetrics("IGF"),
    ]),
    // Vanguard "unconstrained" 40/60 model — VAAM/VCMM output. Reuses VTV,
    // VUG, VWO, VCIT (all already fetched above for the LPL model), VEA,
    // SGOV, VGIT (real holdings), and BND (already fetched for the 60/40
    // proxy). BNDX (international bonds) is the only new ticker needed.
    fetchPositionMetrics("BNDX"),
    // "Noelle Mockup" hypothetical — Mike's what-if for Noelle's Rollover
    // IRA per Chris's rough draft (VEA/SCHD/VGIT/SGOV/VTIP/VTI real holdings,
    // DBMF already fetched above for Clean Slate). VTWO/VIGI/BTAL are the new
    // tickers here. BTAL (AGF US Market Neutral Anti-Beta) is an explicit
    // placeholder for the 5% Long/Short sleeve — Chris hasn't named a real
    // fund yet and has said he won't use ETFs for this category, so treat
    // this tile's return as illustrative, not predictive of his final pick.
    Promise.all([fetchPositionMetrics("VTWO"), fetchPositionMetrics("VIGI"), fetchPositionMetrics("BTAL")]),
    // "C1 TAX 40/60" — Chris's actual proposal for Noelle's TOD (taxable)
    // accounts: 25% VTI / 15% VXUS / 60% VTEB. VTI is already a real
    // holding; VXUS and VTEB are the two new tickers here. Chris flagged
    // FMUB as a suitable Fidelity-platform substitute for VTEB if Mike
    // ever needs it — not modeled separately since it's the same strategy.
    Promise.all([fetchPositionMetrics("VXUS"), fetchPositionMetrics("VTEB")]),
  ]);
  const [cleanSlatePDBC, cleanSlateDBMF] = cleanSlateExtras;
  const [lplVUG, lplVTV, lplVWO, lplVCIT, lplVMBS, lplIGF] = lplImgExtras;

  const positions: Record<string, PositionMetrics> = {};
  for (const p of positionResults) {
    positions[p.ticker] = p;
    if (p.error) diagnostics[`position_${p.ticker.toLowerCase()}`] = p.error;
  }
  if (benchmarkBND.error) diagnostics["benchmark_bnd"] = benchmarkBND.error;
  positions["BND"] = benchmarkBND;
  // DBMF/PDBC merged in early (rather than down by the Clean Slate block
  // where they're fetched) so every blended portfolio below, including
  // Clean Slate itself, can rely on one consistent `positions[ticker]`
  // lookup path for the 1-YR/5-YR helpers right below.
  positions["DBMF"] = cleanSlateDBMF;
  positions["PDBC"] = cleanSlatePDBC;
  positions["VUG"] = lplVUG;
  positions["VTV"] = lplVTV;
  positions["VWO"] = lplVWO;
  positions["VCIT"] = lplVCIT;
  positions["VMBS"] = lplVMBS;
  positions["IGF"] = lplIGF;
  positions["BNDX"] = vgBNDX;

  // Shared helpers for every blended portfolio below. Both compute a
  // weighted return live from the same `positions` dict everything else on
  // this file already reads — 1-YR and 5-YR are no longer treated
  // differently; both are just a different anchor date on the same
  // fetchPositionMetrics call every ticker already makes. Both take just
  // the {ticker, weight} pairs every portfolio's components array already
  // has, and both use the same defensive null-if-any-missing pattern as
  // the YTD blends below — a partial average would be silently wrong.
  function blendFiveYear(components: { ticker: string; weight: number }[]): number | null {
    const values = components.map((c) => ({ weight: c.weight, val: positions[c.ticker]?.fiveYearReturnPct ?? null }));
    if (values.some((v) => v.val == null)) return null;
    return values.reduce((sum, v) => sum + (v.val as number) * v.weight, 0);
  }
  function blendOneYear(components: { ticker: string; weight: number }[]): number | null {
    const values = components.map((c) => ({ weight: c.weight, val: positions[c.ticker]?.oneYearReturnPct ?? null }));
    if (values.some((v) => v.val == null)) return null;
    return values.reduce((sum, v) => sum + (v.val as number) * v.weight, 0);
  }

  // Three benchmark proxies, all built from the same VTI + BND YTD figures,
  // just weighted differently. 60/40 is the traditional convention Mike has
  // compared against historically. 40/60 is closer to his actual posture.
  // 50/50 was added later — Mike's rough read on where the household is
  // likely to land once Chris's proposal settles.
  const vtiForBenchmark = positions["VTI"];
  const benchmark6040YtdPct: number | null =
    vtiForBenchmark?.ytdReturnPct != null && benchmarkBND.ytdReturnPct != null
      ? vtiForBenchmark.ytdReturnPct * 0.6 + benchmarkBND.ytdReturnPct * 0.4
      : null;
  const benchmark4060YtdPct: number | null =
    vtiForBenchmark?.ytdReturnPct != null && benchmarkBND.ytdReturnPct != null
      ? vtiForBenchmark.ytdReturnPct * 0.4 + benchmarkBND.ytdReturnPct * 0.6
      : null;
  const benchmark5050YtdPct: number | null =
    vtiForBenchmark?.ytdReturnPct != null && benchmarkBND.ytdReturnPct != null
      ? vtiForBenchmark.ytdReturnPct * 0.5 + benchmarkBND.ytdReturnPct * 0.5
      : null;
  // Same-day change for each proxy, same weights, so the benchmark tiles can
  // show a "Today" figure alongside the position tiles below.
  const benchmark6040TodayPct: number | null =
    vtiForBenchmark?.dailyChangePct != null && benchmarkBND.dailyChangePct != null
      ? vtiForBenchmark.dailyChangePct * 0.6 + benchmarkBND.dailyChangePct * 0.4
      : null;
  const benchmark4060TodayPct: number | null =
    vtiForBenchmark?.dailyChangePct != null && benchmarkBND.dailyChangePct != null
      ? vtiForBenchmark.dailyChangePct * 0.4 + benchmarkBND.dailyChangePct * 0.6
      : null;
  const benchmark5050TodayPct: number | null =
    vtiForBenchmark?.dailyChangePct != null && benchmarkBND.dailyChangePct != null
      ? vtiForBenchmark.dailyChangePct * 0.5 + benchmarkBND.dailyChangePct * 0.5
      : null;
  // 1-YR (live) and 5-YR (manual table) for the same three proxies.
  const benchmark6040OneYearPct = blendOneYear([{ ticker: "VTI", weight: 0.6 }, { ticker: "BND", weight: 0.4 }]);
  const benchmark4060OneYearPct = blendOneYear([{ ticker: "VTI", weight: 0.4 }, { ticker: "BND", weight: 0.6 }]);
  const benchmark5050OneYearPct = blendOneYear([{ ticker: "VTI", weight: 0.5 }, { ticker: "BND", weight: 0.5 }]);
  const benchmark6040FiveYearPct = blendFiveYear([{ ticker: "VTI", weight: 0.6 }, { ticker: "BND", weight: 0.4 }]);
  const benchmark4060FiveYearPct = blendFiveYear([{ ticker: "VTI", weight: 0.4 }, { ticker: "BND", weight: 0.6 }]);
  const benchmark5050FiveYearPct = blendFiveYear([{ ticker: "VTI", weight: 0.5 }, { ticker: "BND", weight: 0.5 }]);


  // "Clean Slate" hypothetical portfolio blend — SCHD 20 / SGOV 20 / VEA 15 /
  // VTIP 10 / VTI 10 / VGIT 10 / DBMF 10 / PDBC 5. Six weights pull from real
  // holdings already in `positions`; PDBC and DBMF come from the extra fetch.
  const cleanSlateWeights: Record<string, number> = {
    SCHD: 0.20, SGOV: 0.20, VEA: 0.15, VTIP: 0.10, VTI: 0.10, VGIT: 0.10,
  };
  const cleanSlateComponents: { ticker: string; weight: number; ytd: number | null; today: number | null }[] = [
    ...Object.entries(cleanSlateWeights).map(([ticker, weight]) => ({
      ticker, weight,
      ytd: positions[ticker]?.ytdReturnPct ?? null,
      today: positions[ticker]?.dailyChangePct ?? null,
    })),
    { ticker: "DBMF", weight: 0.10, ytd: cleanSlateDBMF.ytdReturnPct, today: cleanSlateDBMF.dailyChangePct },
    { ticker: "PDBC", weight: 0.05, ytd: cleanSlatePDBC.ytdReturnPct, today: cleanSlatePDBC.dailyChangePct },
  ];
  const cleanSlateHasAllYtd = cleanSlateComponents.every((c) => c.ytd != null);
  const cleanSlateYtdPct: number | null = cleanSlateHasAllYtd
    ? cleanSlateComponents.reduce((sum, c) => sum + (c.ytd as number) * c.weight, 0)
    : null;
  const cleanSlateHasAllToday = cleanSlateComponents.every((c) => c.today != null);
  const cleanSlateTodayPct: number | null = cleanSlateHasAllToday
    ? cleanSlateComponents.reduce((sum, c) => sum + (c.today as number) * c.weight, 0)
    : null;
  const cleanSlateOneYearPct = blendOneYear(cleanSlateComponents);
  const cleanSlateFiveYearPct = blendFiveYear(cleanSlateComponents);
  if (cleanSlatePDBC.error) diagnostics["clean_slate_pdbc"] = cleanSlatePDBC.error;
  if (cleanSlateDBMF.error) diagnostics["clean_slate_dbmf"] = cleanSlateDBMF.error;

  // "Noelle Mockup" — Mike's what-if replacing GLDM with DBMF + BTAL (a
  // placeholder for the still-unnamed Long/Short fund Chris is researching)
  // per his conversation with Chris. Equity sleeve held at Chris's original
  // 55% weights; VGIT/SGOV/VTIP trimmed from 41% to 35% to fund the alts
  // sleeve growing from 4% (GLDM only) to 10% (DBMF 5% + BTAL 5%). BTAL is an
  // explicit stand-in — Chris has said he won't use ETFs for Long/Short and
  // is screening real managers via Nitrogen, so swap this out the moment he
  // names an actual fund. This tile tracks Noelle's Rollover IRA only, not
  // the household — label accordingly in the UI.
  const [noelleVTWO, noelleVIGI, noelleBTAL] = noelleExtras;
  const [c1VXUS, c1VTEB] = c1TaxExtras;

  // Expose VTWO/VIGI/BTAL/VXUS/VTEB through the same `positions` dict real
  // holdings use, so the "Your Holdings" UI can render full tiles for these
  // candidate positions with zero new frontend fetch logic, and so
  // blendOneYear/blendFiveYear below can find them via positions[ticker]
  // the same way they find every other ticker. MUST happen before
  // noelleMockupComponents/c1TaxComponents are built — blendOneYear/
  // blendFiveYear read straight from `positions`, not from a component
  // array's own ytd/today fields, so merging these in late (as this block
  // used to sit, right before the JSON return) silently zeroed out the
  // Proposed tile's 1-YR/5-YR: it was reading positions["VTWO"] etc.
  // before they existed. They're candidates under consideration, not real
  // holdings — PORTFOLIO_POSITIONS in page.tsx stays untouched.
  positions["VTWO"] = noelleVTWO;
  positions["VIGI"] = noelleVIGI;
  positions["BTAL"] = noelleBTAL;
  positions["VXUS"] = c1VXUS;
  positions["VTEB"] = c1VTEB;

  const noelleMockupWeights: Record<string, number> = {
    VEA: 0.15, SCHD: 0.15, VTI: 0.10, VGIT: 0.13, SGOV: 0.12, VTIP: 0.10,
  };
  const noelleMockupComponents: { ticker: string; weight: number; ytd: number | null; today: number | null }[] = [
    ...Object.entries(noelleMockupWeights).map(([ticker, weight]) => ({
      ticker, weight,
      ytd: positions[ticker]?.ytdReturnPct ?? null,
      today: positions[ticker]?.dailyChangePct ?? null,
    })),
    { ticker: "VTWO", weight: 0.10, ytd: noelleVTWO.ytdReturnPct, today: noelleVTWO.dailyChangePct },
    { ticker: "VIGI", weight: 0.05, ytd: noelleVIGI.ytdReturnPct, today: noelleVIGI.dailyChangePct },
    { ticker: "DBMF", weight: 0.05, ytd: cleanSlateDBMF.ytdReturnPct, today: cleanSlateDBMF.dailyChangePct },
    { ticker: "BTAL", weight: 0.05, ytd: noelleBTAL.ytdReturnPct, today: noelleBTAL.dailyChangePct },
  ];
  const noelleMockupHasAllYtd = noelleMockupComponents.every((c) => c.ytd != null);
  const noelleMockupYtdPct: number | null = noelleMockupHasAllYtd
    ? noelleMockupComponents.reduce((sum, c) => sum + (c.ytd as number) * c.weight, 0)
    : null;
  const noelleMockupHasAllToday = noelleMockupComponents.every((c) => c.today != null);
  const noelleMockupTodayPct: number | null = noelleMockupHasAllToday
    ? noelleMockupComponents.reduce((sum, c) => sum + (c.today as number) * c.weight, 0)
    : null;
  const noelleMockupOneYearPct = blendOneYear(noelleMockupComponents);
  const noelleMockupFiveYearPct = blendFiveYear(noelleMockupComponents);
  if (noelleVTWO.error) diagnostics["noelle_vtwo"] = noelleVTWO.error;
  if (noelleVIGI.error) diagnostics["noelle_vigi"] = noelleVIGI.error;
  if (noelleBTAL.error) diagnostics["noelle_btal"] = noelleBTAL.error;

  // "C1 TAX 40/60" — Chris's actual proposal for Noelle's TOD (taxable)
  // accounts, from his note: 25% VTI / 15% VXUS / 60% VTEB. Distinct from
  // C0 (55/35/10), which is his retirement-account proposal — this one is
  // taxable-specific, built around tax-exempt income (VTEB) rather than
  // taxable bonds, which is why it looks nothing like the IRA-side models.
  const c1TaxWeights: Record<string, number> = { VTI: 0.25, VXUS: 0.15, VTEB: 0.60 };
  const c1TaxComponents: { ticker: string; weight: number; ytd: number | null; today: number | null }[] =
    Object.entries(c1TaxWeights).map(([ticker, weight]) => ({
      ticker, weight,
      ytd: positions[ticker]?.ytdReturnPct ?? null,
      today: positions[ticker]?.dailyChangePct ?? null,
    }));
  const c1TaxHasAllYtd = c1TaxComponents.every((c) => c.ytd != null);
  const c1TaxYtdPct: number | null = c1TaxHasAllYtd
    ? c1TaxComponents.reduce((sum, c) => sum + (c.ytd as number) * c.weight, 0)
    : null;
  const c1TaxHasAllToday = c1TaxComponents.every((c) => c.today != null);
  const c1TaxTodayPct: number | null = c1TaxHasAllToday
    ? c1TaxComponents.reduce((sum, c) => sum + (c.today as number) * c.weight, 0)
    : null;
  const c1TaxOneYearPct = blendOneYear(c1TaxComponents);
  const c1TaxFiveYearPct = blendFiveYear(c1TaxComponents);
  if (c1VXUS.error) diagnostics["c1_vxus"] = c1VXUS.error;
  if (c1VTEB.error) diagnostics["c1_vteb"] = c1VTEB.error;

  // "C1 IRA" — Chris's proposed uniform model for the six retirement
  // accounts running the standard IRA structure (Noelle's SEP/Rollover/
  // Inherited/Roth, Mike's Traditional/Rollover). Explicitly excludes the
  // Alpine 401k (pending rollover, stays in its target-date fund for now)
  // and the TOD accounts (separate C1 TAX model). Drops VGIT in favor of
  // BND — Chris's rationale: BND is the anchor bond fund Vanguard's own
  // target-date funds use, and it's the only place Mike/Noelle currently
  // hold any corporate bond exposure at all. Every ticker here is already
  // live in `positions` from real holdings or earlier candidate-fetch
  // work — no new network calls needed for this one.
  const c1IraWeights: Record<string, number> = {
    SCHD: 0.16, VEA: 0.15, VTIP: 0.15, SGOV: 0.14, VTI: 0.10,
    VTWO: 0.10, BND: 0.09, VIGI: 0.05, GLDM: 0.03, DBMF: 0.03,
  };
  const c1IraComponents: { ticker: string; weight: number; ytd: number | null; today: number | null }[] =
    Object.entries(c1IraWeights).map(([ticker, weight]) => ({
      ticker, weight,
      ytd: positions[ticker]?.ytdReturnPct ?? null,
      today: positions[ticker]?.dailyChangePct ?? null,
    }));
  const c1IraHasAllYtd = c1IraComponents.every((c) => c.ytd != null);
  const c1IraYtdPct: number | null = c1IraHasAllYtd
    ? c1IraComponents.reduce((sum, c) => sum + (c.ytd as number) * c.weight, 0)
    : null;
  const c1IraHasAllToday = c1IraComponents.every((c) => c.today != null);
  const c1IraTodayPct: number | null = c1IraHasAllToday
    ? c1IraComponents.reduce((sum, c) => sum + (c.today as number) * c.weight, 0)
    : null;
  const c1IraOneYearPct = blendOneYear(c1IraComponents);
  const c1IraFiveYearPct = blendFiveYear(c1IraComponents);

  // "M2" — Mike's dial-back of Chris's C1 IRA model (56/38/6) toward a
  // cleaner 50/40/10. Built by adjusting C1 IRA's actual weights rather
  // than starting fresh: the full -6 equity points comes out of VTWO
  // alone (10% → 5%), leaving SCHD/VEA/VTI/VIGI at or near Chris's
  // original weights so the fund selection still follows his input as
  // closely as possible. SGOV and BND each nudged +1 to round out fixed
  // income to 40; GLDM and DBMF both doubled to 5% to bring alts to 10.
  const m2Weights: Record<string, number> = {
    SCHD: 0.15, VEA: 0.15, VTI: 0.10, VTWO: 0.05, VIGI: 0.05,
    VTIP: 0.15, SGOV: 0.15, BND: 0.10,
    GLDM: 0.05, DBMF: 0.05,
  };
  const m2Components: { ticker: string; weight: number; ytd: number | null; today: number | null }[] =
    Object.entries(m2Weights).map(([ticker, weight]) => ({
      ticker, weight,
      ytd: positions[ticker]?.ytdReturnPct ?? null,
      today: positions[ticker]?.dailyChangePct ?? null,
    }));
  const m2HasAllYtd = m2Components.every((c) => c.ytd != null);
  const m2YtdPct: number | null = m2HasAllYtd
    ? m2Components.reduce((sum, c) => sum + (c.ytd as number) * c.weight, 0)
    : null;
  const m2HasAllToday = m2Components.every((c) => c.today != null);
  const m2TodayPct: number | null = m2HasAllToday
    ? m2Components.reduce((sum, c) => sum + (c.today as number) * c.weight, 0)
    : null;
  const m2OneYearPct = blendOneYear(m2Components);
  const m2FiveYearPct = blendFiveYear(m2Components);

  // "M27" — early tracker for the 2027 conversation with Chris. Same equity
  // sleeve as M26/M2. Two changes: gold trimmed 5% -> 3% (Chris's original
  // size), and 10 points of short ballast (SGOV, VTIP) moved into
  // intermediate duration (BND, VGIT) to lock in ~5% yields before the Fed
  // eventually cuts. 50% equity / 42% fixed income / 8% alts. A draft to
  // watch, not a decision.
  const m27Weights: Record<string, number> = {
    SCHD: 0.15, VEA: 0.15, VTI: 0.10, VTWO: 0.05, VIGI: 0.05,
    SGOV: 0.10, VTIP: 0.10, BND: 0.15, VGIT: 0.07,
    GLDM: 0.03, DBMF: 0.05,
  };
  const m27Components: { ticker: string; weight: number; ytd: number | null; today: number | null }[] =
    Object.entries(m27Weights).map(([ticker, weight]) => ({
      ticker, weight,
      ytd: positions[ticker]?.ytdReturnPct ?? null,
      today: positions[ticker]?.dailyChangePct ?? null,
    }));
  const m27YtdPct: number | null = m27Components.every((c) => c.ytd != null)
    ? m27Components.reduce((sum, c) => sum + (c.ytd as number) * c.weight, 0) : null;
  const m27TodayPct: number | null = m27Components.every((c) => c.today != null)
    ? m27Components.reduce((sum, c) => sum + (c.today as number) * c.weight, 0) : null;
  const m27OneYearPct = blendOneYear(m27Components);
  const m27FiveYearPct = blendFiveYear(m27Components);

  // "M3" — same as M2, but VTWO restored to Chris's original 10% and
  // GLDM/DBMF each at 2.5% instead of 5%. Net effect: equity climbs back
  // to 55%, alts drops to 5%, fixed income holds at 40% — genuinely a
  // different sleeve mix from M2's clean 50/40/10, not just a relabeling.
  const m3Weights: Record<string, number> = {
    SCHD: 0.15, VEA: 0.15, VTI: 0.10, VTWO: 0.10, VIGI: 0.05,
    VTIP: 0.15, SGOV: 0.15, BND: 0.10,
    GLDM: 0.025, DBMF: 0.025,
  };
  const m3Components: { ticker: string; weight: number; ytd: number | null; today: number | null }[] =
    Object.entries(m3Weights).map(([ticker, weight]) => ({
      ticker, weight,
      ytd: positions[ticker]?.ytdReturnPct ?? null,
      today: positions[ticker]?.dailyChangePct ?? null,
    }));
  const m3HasAllYtd = m3Components.every((c) => c.ytd != null);
  const m3YtdPct: number | null = m3HasAllYtd
    ? m3Components.reduce((sum, c) => sum + (c.ytd as number) * c.weight, 0)
    : null;
  const m3HasAllToday = m3Components.every((c) => c.today != null);
  const m3TodayPct: number | null = m3HasAllToday
    ? m3Components.reduce((sum, c) => sum + (c.today as number) * c.weight, 0)
    : null;
  const m3OneYearPct = blendOneYear(m3Components);
  const m3FiveYearPct = blendFiveYear(m3Components);

  // "Panel Consensus" — the 12-voice panel's debate over C1 IRA, holding
  // the 50% equity cap fixed. Cut concentrated entirely in VTWO (its true
  // CAPE runs to ~58x once negative-earnings members are counted, higher
  // than the S&P's own 42x — Hussman's and Slegers' argument). BND raised
  // more than Chris's original (Grantham/Rieder: the freed weight has to
  // land somewhere, but Noland flagged tight credit spreads as a reason
  // not to lean too hard into corporates). GLDM raised more than DBMF —
  // Dalio's point that gold and managed futures hedge different risks
  // (currency debasement vs. equity/rate), not interchangeable "alts."
  const panelWeights: Record<string, number> = {
    SCHD: 0.15, VEA: 0.15, VTI: 0.10, VTWO: 0.05, VIGI: 0.05,
    VTIP: 0.15, SGOV: 0.14, BND: 0.13,
    GLDM: 0.05, DBMF: 0.03,
  };
  const panelComponents: { ticker: string; weight: number; ytd: number | null; today: number | null }[] =
    Object.entries(panelWeights).map(([ticker, weight]) => ({
      ticker, weight,
      ytd: positions[ticker]?.ytdReturnPct ?? null,
      today: positions[ticker]?.dailyChangePct ?? null,
    }));
  const panelHasAllYtd = panelComponents.every((c) => c.ytd != null);
  const panelYtdPct: number | null = panelHasAllYtd
    ? panelComponents.reduce((sum, c) => sum + (c.ytd as number) * c.weight, 0)
    : null;
  const panelHasAllToday = panelComponents.every((c) => c.today != null);
  const panelTodayPct: number | null = panelHasAllToday
    ? panelComponents.reduce((sum, c) => sum + (c.today as number) * c.weight, 0)
    : null;
  const panelOneYearPct = blendOneYear(panelComponents);
  const panelFiveYearPct = blendFiveYear(panelComponents);

  // "Other AI" — a second AI's independent take on the same C1-plus-50%-cap
  // question. Landed close to M2 (same equity lines, same VTIP/SGOV), but
  // BND at 11% (between Chris's 9% and the panel's 13%) and GLDM/DBMF split
  // evenly at 5/5 rather than weighted toward gold. Explicit rationale
  // given was round numbers being easier to hold to when markets get
  // volatile, a real but different kind of argument than the panel's
  // risk-specific reasoning — kept as a separate tile rather than merged
  // in, precisely so the two philosophies can be compared side by side.
  const otherAiWeights: Record<string, number> = {
    SCHD: 0.15, VEA: 0.15, VTI: 0.10, VTWO: 0.05, VIGI: 0.05,
    VTIP: 0.15, SGOV: 0.14, BND: 0.11,
    GLDM: 0.05, DBMF: 0.05,
  };
  const otherAiComponents: { ticker: string; weight: number; ytd: number | null; today: number | null }[] =
    Object.entries(otherAiWeights).map(([ticker, weight]) => ({
      ticker, weight,
      ytd: positions[ticker]?.ytdReturnPct ?? null,
      today: positions[ticker]?.dailyChangePct ?? null,
    }));
  const otherAiHasAllYtd = otherAiComponents.every((c) => c.ytd != null);
  const otherAiYtdPct: number | null = otherAiHasAllYtd
    ? otherAiComponents.reduce((sum, c) => sum + (c.ytd as number) * c.weight, 0)
    : null;
  const otherAiHasAllToday = otherAiComponents.every((c) => c.today != null);
  const otherAiTodayPct: number | null = otherAiHasAllToday
    ? otherAiComponents.reduce((sum, c) => sum + (c.today as number) * c.weight, 0)
    : null;
  const otherAiOneYearPct = blendOneYear(otherAiComponents);
  const otherAiFiveYearPct = blendFiveYear(otherAiComponents);

  // "Hybrid 8" — Mike's curated blend of ALT 45/40/15 and the Noelle
  // Mockup, not a straight average of the two. SCHD stays the largest
  // single line as the foundational quality/value holding. VTWO carries
  // over to honor Chris's small-cap input. VIGI and PDBC are cut for
  // overlapping VEA and DBMF respectively; BTAL is cut too, consolidating
  // to a single alts line (DBMF) to hit 8 total holdings rather than 10-11.
  // Every ticker here is already live in `positions` from real holdings or
  // the Noelle/ALT scaffolding above — no new fetches needed. IMPORTANT:
  // this block must come after all four positions[...] assignments above,
  // since DBMF/VTWO aren't real holdings and only exist in `positions`
  // once those lines run — reading them earlier silently nulls the tile.
  const hybrid8Weights: Record<string, number> = {
    SCHD: 0.20, VEA: 0.15, SGOV: 0.15, DBMF: 0.15, VTI: 0.10, VGIT: 0.10, VTIP: 0.10, VTWO: 0.05,
  };
  const hybrid8Components: { ticker: string; weight: number; ytd: number | null; today: number | null }[] =
    Object.entries(hybrid8Weights).map(([ticker, weight]) => ({
      ticker, weight,
      ytd: positions[ticker]?.ytdReturnPct ?? null,
      today: positions[ticker]?.dailyChangePct ?? null,
    }));
  const hybrid8HasAllYtd = hybrid8Components.every((c) => c.ytd != null);
  const hybrid8YtdPct: number | null = hybrid8HasAllYtd
    ? hybrid8Components.reduce((sum, c) => sum + (c.ytd as number) * c.weight, 0)
    : null;
  const hybrid8HasAllToday = hybrid8Components.every((c) => c.today != null);
  const hybrid8TodayPct: number | null = hybrid8HasAllToday
    ? hybrid8Components.reduce((sum, c) => sum + (c.today as number) * c.weight, 0)
    : null;
  const hybrid8OneYearPct = blendOneYear(hybrid8Components);
  const hybrid8FiveYearPct = blendFiveYear(hybrid8Components);

  // LPL "40/60" proxy blend — essentially LPL's own "Income with Moderate
  // Growth" model (39% equity), close enough to 40% that no reweighting is
  // needed. Ticker mapping in the fetch block above: VEA/VGIT/VTIP/SGOV pull
  // from real holdings, PDBC/DBMF reuse the Clean Slate fetch.
  const lpl4060Components: { ticker: string; weight: number; ytd: number | null; today: number | null }[] = [
    { ticker: "VUG",  weight: 0.12, ytd: lplVUG.ytdReturnPct,  today: lplVUG.dailyChangePct },
    { ticker: "VTV",  weight: 0.16, ytd: lplVTV.ytdReturnPct,  today: lplVTV.dailyChangePct },
    { ticker: "VEA",  weight: 0.07, ytd: positions["VEA"]?.ytdReturnPct ?? null,  today: positions["VEA"]?.dailyChangePct ?? null },
    { ticker: "VWO",  weight: 0.04, ytd: lplVWO.ytdReturnPct,  today: lplVWO.dailyChangePct },
    { ticker: "VGIT", weight: 0.18, ytd: positions["VGIT"]?.ytdReturnPct ?? null, today: positions["VGIT"]?.dailyChangePct ?? null },
    { ticker: "VCIT", weight: 0.15, ytd: lplVCIT.ytdReturnPct, today: lplVCIT.dailyChangePct },
    { ticker: "VMBS", weight: 0.10, ytd: lplVMBS.ytdReturnPct, today: lplVMBS.dailyChangePct },
    { ticker: "VTIP", weight: 0.05, ytd: positions["VTIP"]?.ytdReturnPct ?? null, today: positions["VTIP"]?.dailyChangePct ?? null },
    { ticker: "PDBC", weight: 0.01, ytd: cleanSlatePDBC.ytdReturnPct, today: cleanSlatePDBC.dailyChangePct },
    { ticker: "IGF",  weight: 0.02, ytd: lplIGF.ytdReturnPct,  today: lplIGF.dailyChangePct },
    { ticker: "DBMF", weight: 0.08, ytd: cleanSlateDBMF.ytdReturnPct, today: cleanSlateDBMF.dailyChangePct },
    { ticker: "SGOV", weight: 0.02, ytd: positions["SGOV"]?.ytdReturnPct ?? null, today: positions["SGOV"]?.dailyChangePct ?? null },
  ];
  const lpl4060HasAllYtd = lpl4060Components.every((c) => c.ytd != null);
  const lpl4060YtdPct: number | null = lpl4060HasAllYtd
    ? lpl4060Components.reduce((sum, c) => sum + (c.ytd as number) * c.weight, 0)
    : null;
  const lpl4060HasAllToday = lpl4060Components.every((c) => c.today != null);
  const lpl4060TodayPct: number | null = lpl4060HasAllToday
    ? lpl4060Components.reduce((sum, c) => sum + (c.today as number) * c.weight, 0)
    : null;
  const lpl4060OneYearPct = blendOneYear(lpl4060Components);
  const lpl4060FiveYearPct = blendFiveYear(lpl4060Components);

  // LPL "50/50" proxy blend — interpolated roughly two-thirds of the way from
  // LPL's IMG model (39% equity) toward its Growth-with-Income model (56%
  // equity), landing at 50% equity / 50% fixed income+diversifying+cash.
  // Same twelve tickers as the 40/60 blend above, just reweighted, so no new
  // fetches are needed for this one either.
  const lpl5050Components: { ticker: string; weight: number; ytd: number | null; today: number | null }[] = [
    { ticker: "VUG",  weight: 0.16, ytd: lplVUG.ytdReturnPct,  today: lplVUG.dailyChangePct },
    { ticker: "VTV",  weight: 0.20, ytd: lplVTV.ytdReturnPct,  today: lplVTV.dailyChangePct },
    { ticker: "VEA",  weight: 0.09, ytd: positions["VEA"]?.ytdReturnPct ?? null,  today: positions["VEA"]?.dailyChangePct ?? null },
    { ticker: "VWO",  weight: 0.05, ytd: lplVWO.ytdReturnPct,  today: lplVWO.dailyChangePct },
    { ticker: "VGIT", weight: 0.12, ytd: positions["VGIT"]?.ytdReturnPct ?? null, today: positions["VGIT"]?.dailyChangePct ?? null },
    { ticker: "VCIT", weight: 0.11, ytd: lplVCIT.ytdReturnPct, today: lplVCIT.dailyChangePct },
    { ticker: "VMBS", weight: 0.10, ytd: lplVMBS.ytdReturnPct, today: lplVMBS.dailyChangePct },
    { ticker: "VTIP", weight: 0.04, ytd: positions["VTIP"]?.ytdReturnPct ?? null, today: positions["VTIP"]?.dailyChangePct ?? null },
    { ticker: "PDBC", weight: 0.02, ytd: cleanSlatePDBC.ytdReturnPct, today: cleanSlatePDBC.dailyChangePct },
    { ticker: "IGF",  weight: 0.02, ytd: lplIGF.ytdReturnPct,  today: lplIGF.dailyChangePct },
    { ticker: "DBMF", weight: 0.07, ytd: cleanSlateDBMF.ytdReturnPct, today: cleanSlateDBMF.dailyChangePct },
    { ticker: "SGOV", weight: 0.02, ytd: positions["SGOV"]?.ytdReturnPct ?? null, today: positions["SGOV"]?.dailyChangePct ?? null },
  ];
  const lpl5050HasAllYtd = lpl5050Components.every((c) => c.ytd != null);
  const lpl5050YtdPct: number | null = lpl5050HasAllYtd
    ? lpl5050Components.reduce((sum, c) => sum + (c.ytd as number) * c.weight, 0)
    : null;
  const lpl5050HasAllToday = lpl5050Components.every((c) => c.today != null);
  const lpl5050TodayPct: number | null = lpl5050HasAllToday
    ? lpl5050Components.reduce((sum, c) => sum + (c.today as number) * c.weight, 0)
    : null;
  const lpl5050OneYearPct = blendOneYear(lpl5050Components);
  const lpl5050FiveYearPct = blendFiveYear(lpl5050Components);

  [
    ["vug", lplVUG], ["vtv", lplVTV], ["vwo", lplVWO],
    ["vcit", lplVCIT], ["vmbs", lplVMBS], ["igf", lplIGF],
  ].forEach(([key, r]: any) => { if (r.error) diagnostics[`lpl_${key}`] = r.error; });

  // Vanguard "unconstrained" 40/60 model (VAAM/VCMM, per the client's shared
  // charts) — mapped to tradable ETFs. VGIT stands in for their "long-term
  // Treasury" line since no dedicated long-duration Treasury ticker is
  // fetched elsewhere; that's a real duration mismatch, not an exact match.
  const vg4060Components: { ticker: string; weight: number; ytd: number | null; today: number | null }[] = [
    { ticker: "VTV",  weight: 0.16, ytd: lplVTV.ytdReturnPct,  today: lplVTV.dailyChangePct },
    { ticker: "VUG",  weight: 0.06, ytd: lplVUG.ytdReturnPct,  today: lplVUG.dailyChangePct },
    { ticker: "VWO",  weight: 0.02, ytd: lplVWO.ytdReturnPct,  today: lplVWO.dailyChangePct },
    { ticker: "VEA",  weight: 0.16, ytd: positions["VEA"]?.ytdReturnPct ?? null,  today: positions["VEA"]?.dailyChangePct ?? null },
    { ticker: "BND",  weight: 0.34, ytd: benchmarkBND.ytdReturnPct, today: benchmarkBND.dailyChangePct },
    { ticker: "SGOV", weight: 0.02, ytd: positions["SGOV"]?.ytdReturnPct ?? null, today: positions["SGOV"]?.dailyChangePct ?? null },
    { ticker: "VGIT", weight: 0.07, ytd: positions["VGIT"]?.ytdReturnPct ?? null, today: positions["VGIT"]?.dailyChangePct ?? null },
    { ticker: "VCIT", weight: 0.02, ytd: lplVCIT.ytdReturnPct, today: lplVCIT.dailyChangePct },
    { ticker: "BNDX", weight: 0.15, ytd: vgBNDX.ytdReturnPct, today: vgBNDX.dailyChangePct },
  ];
  const vg4060HasAllYtd = vg4060Components.every((c) => c.ytd != null);
  const vg4060YtdPct: number | null = vg4060HasAllYtd
    ? vg4060Components.reduce((sum, c) => sum + (c.ytd as number) * c.weight, 0)
    : null;
  const vg4060HasAllToday = vg4060Components.every((c) => c.today != null);
  const vg4060TodayPct: number | null = vg4060HasAllToday
    ? vg4060Components.reduce((sum, c) => sum + (c.today as number) * c.weight, 0)
    : null;
  const vg4060OneYearPct = blendOneYear(vg4060Components);
  const vg4060FiveYearPct = blendFiveYear(vg4060Components);
  if (vgBNDX.error) diagnostics["vg_bndx"] = vgBNDX.error;

  if (spx.error) diagnostics["spx"] = spx.error;
  if (qqq.error) diagnostics["qqq"] = qqq.error;
  if (vix.error) diagnostics["vix"] = vix.error;
  if (dxy.error) diagnostics["dxy"] = dxy.error;
  if (putCall.error) diagnostics["putcall"] = putCall.error;
  if (fredReal10y.error) diagnostics["real10y"] = fredReal10y.error;
  if (fredNom10y.error) diagnostics["nom10y"] = fredNom10y.error;
  if (fredHY.error) diagnostics["hy"] = fredHY.error;
  if (fredYC.error) diagnostics["yc"] = fredYC.error;
  if (fredFedFunds.error) diagnostics["fedfunds"] = fredFedFunds.error;
  if (fredBreakeven.error) diagnostics["breakeven"] = fredBreakeven.error;
  if (peData.error) diagnostics["pe"] = peData.error;
  if (capeData.error) diagnostics["cape"] = capeData.error;
  if (fearGreedData.error) diagnostics["feargreed"] = fearGreedData.error;
  if (ivyVTI.error) diagnostics["ivy_vti"] = ivyVTI.error;
  if (ivyVEU.error) diagnostics["ivy_veu"] = ivyVEU.error;
  if (ivyIEF.error) diagnostics["ivy_ief"] = ivyIEF.error;
  if (ivyVNQ.error) diagnostics["ivy_vnq"] = ivyVNQ.error;
  if (ivyDBC.error) diagnostics["ivy_dbc"] = ivyDBC.error;
  if (fredWALCL.error) diagnostics["walcl"] = fredWALCL.error;
  if (djt.error) diagnostics["djt"] = djt.error;
  if (brent.error) diagnostics["brent"] = brent.error;
  if (breadthResult.error) diagnostics["breadth"] = breadthResult.error;

  const breadthPct: number | null = breadthResult.value ?? MANUAL_BREADTH_FALLBACK;
  console.log(`Breadth (% above 200-DMA): ${breadthPct}%`);

  const brentPrice: number | null =
    brentLiveQuote.price ?? brent.meta.regularMarketPrice ?? brent.closes[brent.closes.length - 1] ?? null;
  const brentPrev: number | null = brent.closes.length >= 2 ? brent.closes[brent.closes.length - 2] : null;
  const brentChangePct: number | null =
    brentLiveQuote.changePct ??
    (brentPrice != null && brentPrev != null ? ((brentPrice - brentPrev) / brentPrev) * 100 : null);
  if (brentLiveQuote.error) {
    diagnostics["brent_live_quote"] = brentLiveQuote.error;
  }
  if (brentLiveQuote.price == null) {
    diagnostics["brent_stale_fallback"] = "Live quote unavailable — using chart close, may lag intraday moves";
  }
  const brentRegime: "room" | "neutral" | "watch" | "frozen" | null =
    brentPrice == null ? null :
    brentPrice < 80  ? "room" :
    brentPrice < 95  ? "neutral" :
    brentPrice < 110 ? "watch" : "frozen";
  console.log(`Brent: $${brentPrice} (${brentChangePct?.toFixed(2)}%) → ${brentRegime}`);

  const djtCloses = djt.closes;
  const djtPrice: number | null = djt.meta.regularMarketPrice ?? djtCloses[djtCloses.length - 1] ?? null;
  const djtPrev: number | null = djtCloses.length >= 2 ? djtCloses[djtCloses.length - 2] : null;
  const djtChangePct: number | null = djtPrice != null && djtPrev != null
    ? ((djtPrice - djtPrev) / djtPrev) * 100 : null;

  const djt200dma: number | null = djtCloses.length >= 200
    ? avg(djtCloses.slice(-200)) : null;
  const djt200dma_prev: number | null = djtCloses.length >= 220
    ? avg(djtCloses.slice(-220, -20)) : null;
  const djt200slope: number | null = djt200dma != null && djt200dma_prev != null
    ? ((djt200dma - djt200dma_prev) / djt200dma_prev) * 100 : null;

  const djtVs200: number | null = djtPrice != null && djt200dma != null
    ? ((djtPrice - djt200dma) / djt200dma) * 100 : null;
  const djtAbove200 = djtVs200 != null && djtVs200 >= 0;
  console.log(`DJT: ${djtPrice} vs 200-DMA ${djt200dma?.toFixed(2)} (${djtVs200?.toFixed(2)}%)`);

  const walclMil: number | null = fredWALCL.value;
  const walclPrevMil: number | null = fredWALCL.prev;
  const walclBn: number | null  = walclMil  != null ? Math.round(walclMil  / 1000) : null;
  const walclPrevBn: number | null = walclPrevMil != null ? Math.round(walclPrevMil / 1000) : null;
  const walclChgBn: number | null  = walclBn != null && walclPrevBn != null ? walclBn - walclPrevBn : null;
  const walclDirection: "expanding" | "contracting" | "flat" | null =
    walclChgBn == null ? null :
    walclChgBn >  10 ? "expanding" :
    walclChgBn < -10 ? "contracting" : "flat";
  console.log(`WALCL: $${walclBn}B (chg: ${walclChgBn}B → ${walclDirection})`);

  const spxCloses = spx.closes;
  const spxPrice: number | null = spx.meta.regularMarketPrice ?? spxCloses[spxCloses.length - 1] ?? null;
  const spxPrevClose: number | null =
    spxCloses.length >= 2 ? spxCloses[spxCloses.length - 2] : spx.meta.chartPreviousClose ?? null;
  const spxChangePct: number | null =
    spxPrice != null && spxPrevClose != null
      ? ((spxPrice - spxPrevClose) / spxPrevClose) * 100
      : null;

  const spx20dma = spxCloses.length >= 20 ? avg(spxCloses.slice(-20)) : null;
  const spx50dma = spxCloses.length >= 50 ? avg(spxCloses.slice(-50)) : null;
  const spx100dma = spxCloses.length >= 100 ? avg(spxCloses.slice(-100)) : null;
  const spx200dma = spxCloses.length >= 200 ? avg(spxCloses.slice(-200)) : null;
  const spxTrend14d = spxCloses.slice(-14);
  // 420 calendar days of daily closes covers 12 completed month-ends plus
  // the current month, enough for both the official and live readings.
  const gradedIvy = {
    ...computeGradedIvy(spxCloses, spx.timestamps, spxPrice, MANUAL_ALLOC_BAND.floor, MANUAL_ALLOC_BAND.ceiling),
    actual: MANUAL_ALLOC_BAND.actual,
  };
  const roarLatest = MANUAL_ROAR_LOG[MANUAL_ROAR_LOG.length - 1] ?? null;
  const roarPrior = MANUAL_ROAR_LOG.length >= 2 ? MANUAL_ROAR_LOG[MANUAL_ROAR_LOG.length - 2] : null;
  const roar = roarLatest == null ? null : {
    score: roarLatest.score,
    date: roarLatest.date,
    priorScore: roarPrior?.score ?? null,
    equityPct: roarLatest.score,   // shown as published, not rescaled into the band
    daysOld: Math.floor((Date.now() - Date.parse(`${roarLatest.date}T12:00:00Z`)) / 86400000),
    trackingSince: MANUAL_ROAR_LOG[0].date,
    entries: MANUAL_ROAR_LOG.length,
    log: MANUAL_ROAR_LOG,
  };

  const spxAbove200 = spxPrice != null && spx200dma != null && spxPrice > spx200dma;
  type SchanenpSignal = "bull" | "bear" | "non_confirmation_bull" | "non_confirmation_bear";
  const schannepSignal: SchanenpSignal =
    spxAbove200  && djtAbove200  ? "bull" :
    !spxAbove200 && !djtAbove200 ? "bear" :
    spxAbove200  && !djtAbove200 ? "non_confirmation_bear" :
                                   "non_confirmation_bull";
  const schannepLabel: Record<SchanenpSignal, string> = {
    bull:                  "Confirmed Bull",
    bear:                  "Confirmed Bear",
    non_confirmation_bear: "Non-Confirmation ⚠",
    non_confirmation_bull: "Recovery Signal",
  };
  const schannepColor: Record<SchanenpSignal, string> = {
    bull:                  "#4ade80",
    bear:                  "#ff6b88",
    non_confirmation_bear: "#fbbf24",
    non_confirmation_bull: "#4ade80",
  };
  console.log(`Schannep: ${schannepSignal} (SPX ${spxAbove200 ? "above" : "below"} 200-DMA, DJT ${djtAbove200 ? "above" : "below"} 200-DMA)`);

  const spx20dma_prev = spxCloses.length >= 30 ? avg(spxCloses.slice(-30, -10)) : null;
  const spx20slope = spx20dma != null && spx20dma_prev != null
    ? ((spx20dma - spx20dma_prev) / spx20dma_prev) * 100 : null;

  const spx50dma_prev = spxCloses.length >= 70 ? avg(spxCloses.slice(-70, -20)) : null;
  const spx50slope = spx50dma != null && spx50dma_prev != null
    ? ((spx50dma - spx50dma_prev) / spx50dma_prev) * 100 : null;

  const spx100dma_prev = spxCloses.length >= 120 ? avg(spxCloses.slice(-120, -20)) : null;
  const spx100slope = spx100dma != null && spx100dma_prev != null
    ? ((spx100dma - spx100dma_prev) / spx100dma_prev) * 100 : null;

  const spx200dma_prev = spxCloses.length >= 220 ? avg(spxCloses.slice(-220, -20)) : null;
  const spx200slope = spx200dma != null && spx200dma_prev != null
    ? ((spx200dma - spx200dma_prev) / spx200dma_prev) * 100 : null;

  const aboveDma200 = spxPrice != null && spx200dma != null && spxPrice > spx200dma;
  const dma200Rising = spx200slope != null && spx200slope > 0.02;
  const dma200Falling = spx200slope != null && spx200slope < -0.02;

  type Regime = "bull" | "transition_above" | "transition_below" | "bear";
  const regime: Regime =
    aboveDma200 && dma200Rising  ? "bull"
    : aboveDma200 && !dma200Rising ? "transition_above"
    : !aboveDma200 && dma200Rising ? "transition_below"
    : "bear";

  const regimeLabel: Record<Regime, string> = {
    bull:               "Bull Trend",
    transition_above:   "Transition — Weakening",
    transition_below:   "Transition — Pullback",
    bear:               "Bear Trend",
  };
  const regimeDesc: Record<Regime, string> = {
    bull:             "SPX above rising 200-DMA. Trend intact. Dips are buyable.",
    transition_above: "SPX above 200-DMA but slope flattening or falling. Bull trend losing momentum — watch closely.",
    transition_below: "SPX below 200-DMA but DMA still rising. Pullback within a bull structure — not yet a structural break. Classic head-fake zone.",
    bear:             "SPX below a falling 200-DMA. Structural bear trend confirmed. Rallies are suspect.",
  };
  const regimeColor: Record<Regime, string> = {
    bull: "#4ade80", transition_above: "#fbbf24", transition_below: "#fbbf24", bear: "#ff6b88"
  };
  const regimeEmoji: Record<Regime, string> = {
    bull: "🟢", transition_above: "🟡", transition_below: "🟡", bear: "🔴"
  };

  // ── QQQ (Nasdaq-100) — same DMA/slope/regime math as SPX above, just run
  // against ^QQQ. Added specifically because SPX can hold up fine while
  // tech/momentum leadership breaks underneath it, exactly what happened
  // the week of the momentum crash.
  const qqqCloses = qqq.closes;
  const qqqPrice: number | null = qqq.meta.regularMarketPrice ?? qqqCloses[qqqCloses.length - 1] ?? null;
  const qqqPrevClose: number | null =
    qqqCloses.length >= 2 ? qqqCloses[qqqCloses.length - 2] : qqq.meta.chartPreviousClose ?? null;
  const qqqChangePct: number | null =
    qqqPrice != null && qqqPrevClose != null
      ? ((qqqPrice - qqqPrevClose) / qqqPrevClose) * 100
      : null;

  const qqq20dma = qqqCloses.length >= 20 ? avg(qqqCloses.slice(-20)) : null;
  const qqq50dma = qqqCloses.length >= 50 ? avg(qqqCloses.slice(-50)) : null;
  const qqq100dma = qqqCloses.length >= 100 ? avg(qqqCloses.slice(-100)) : null;
  const qqq200dma = qqqCloses.length >= 200 ? avg(qqqCloses.slice(-200)) : null;
  const qqqTrend14d = qqqCloses.slice(-14);

  const qqq20dma_prev = qqqCloses.length >= 30 ? avg(qqqCloses.slice(-30, -10)) : null;
  const qqq20slope = qqq20dma != null && qqq20dma_prev != null
    ? ((qqq20dma - qqq20dma_prev) / qqq20dma_prev) * 100 : null;

  const qqq50dma_prev = qqqCloses.length >= 70 ? avg(qqqCloses.slice(-70, -20)) : null;
  const qqq50slope = qqq50dma != null && qqq50dma_prev != null
    ? ((qqq50dma - qqq50dma_prev) / qqq50dma_prev) * 100 : null;

  const qqq100dma_prev = qqqCloses.length >= 120 ? avg(qqqCloses.slice(-120, -20)) : null;
  const qqq100slope = qqq100dma != null && qqq100dma_prev != null
    ? ((qqq100dma - qqq100dma_prev) / qqq100dma_prev) * 100 : null;

  const qqq200dma_prev = qqqCloses.length >= 220 ? avg(qqqCloses.slice(-220, -20)) : null;
  const qqq200slope = qqq200dma != null && qqq200dma_prev != null
    ? ((qqq200dma - qqq200dma_prev) / qqq200dma_prev) * 100 : null;

  const qqqAboveDma200 = qqqPrice != null && qqq200dma != null && qqqPrice > qqq200dma;
  const qqqDma200Rising = qqq200slope != null && qqq200slope > 0.02;

  const qqqRegime: Regime =
    qqqAboveDma200 && qqqDma200Rising  ? "bull"
    : qqqAboveDma200 && !qqqDma200Rising ? "transition_above"
    : !qqqAboveDma200 && qqqDma200Rising ? "transition_below"
    : "bear";

  const qqqRegimeDesc: Record<Regime, string> = {
    bull:             "QQQ above rising 200-DMA. Trend intact.",
    transition_above: "QQQ above 200-DMA but slope flattening or falling. Momentum losing steam — watch closely.",
    transition_below: "QQQ below 200-DMA but DMA still rising. Pullback, not yet a structural break.",
    bear:             "QQQ below a falling 200-DMA. Structural downtrend confirmed.",
  };

  // QQQ YTD — total return, using the same adjusted-close method already
  // proven for the seven real positions. QQQ is an ETF with real dividend
  // data, unlike a raw index, so no price-only fallback is needed here.
  // Reuses the 420-day fetch already pulled above — no second network call.
  const qqqCurrentYear = new Date().getUTCFullYear();
  const qqqYtdStartIdx = qqq.timestamps.findIndex(
    (t) => new Date(t * 1000).getUTCFullYear() === qqqCurrentYear
  );
  const qqqStartAdjClose = qqqYtdStartIdx >= 0 ? qqq.adjcloses[qqqYtdStartIdx] : null;
  const qqqYtdPct: number | null =
    qqqStartAdjClose != null && qqqPrice != null && qqqStartAdjClose !== 0
      ? ((qqqPrice - qqqStartAdjClose) / qqqStartAdjClose) * 100
      : null;

  const vixPrice: number | null = vix.meta.regularMarketPrice ?? vix.closes[vix.closes.length - 1] ?? null;

  const real10y: number = fredReal10y.value ?? 1.92;
  const nom10y: number = fredNom10y.value ?? 4.30;

  const hySpread: number = fredHY.value ?? MANUAL_HY_FALLBACK;

  // ─── Equity Allocation models (hero group) ──────────────────────────────
  // Consensus = simple average of the scored models: trend (Graded Ivy US
  // and Intl blended by MANUAL_EQUITY_MIX), Roberts and Credit. ROAR is
  // tracked separately and never enters it.
  const [spxWeekly, spxMonthly, veaDaily] = await Promise.all([spxWeeklyP, spxMonthlyP, veaDailyP]);
  // Graded Ivy · Intl: same method as the S&P tile, run on VEA (the main
  // international holding). Not separately backtested.
  const gradedIvyIntl = computeGradedIvy(
    veaDaily.closes, veaDaily.timestamps,
    veaDaily.meta?.regularMarketPrice ?? veaDaily.closes[veaDaily.closes.length - 1] ?? null,
    MANUAL_ALLOC_BAND.floor, MANUAL_ALLOC_BAND.ceiling
  );
  const ivyUsPct = gradedIvy.official?.equityPct ?? null;
  const ivyIntlPct = gradedIvyIntl.official?.equityPct ?? null;
  const trendBlendPct =
    ivyUsPct != null && ivyIntlPct != null
      ? Math.round(((ivyUsPct * MANUAL_EQUITY_MIX.us + ivyIntlPct * MANUAL_EQUITY_MIX.intl) / (MANUAL_EQUITY_MIX.us + MANUAL_EQUITY_MIX.intl)) * 10) / 10
      : ivyUsPct ?? ivyIntlPct;
  const robertsRisk = computeRobertsRisk(spxWeekly, spxMonthly, MANUAL_ALLOC_BAND.floor, MANUAL_ALLOC_BAND.ceiling);
  const creditModel = computeCredit(hySpread * 100, MANUAL_ALLOC_BAND.floor, MANUAL_ALLOC_BAND.ceiling);
  const scoredModels = [trendBlendPct, robertsRisk?.equityPct ?? null, creditModel.equityPct]
    .filter((v): v is number => v != null);
  const equityAllocation = {
    ...MANUAL_ALLOC_BAND,
    consensus: scoredModels.length ? Math.round((scoredModels.reduce((a, b) => a + b, 0) / scoredModels.length) * 10) / 10 : null,
    modelsInConsensus: scoredModels.length,
    roberts: robertsRisk,
    ivyIntl: { ...gradedIvyIntl, ticker: "VEA" },
    trend: { blendPct: trendBlendPct, usPct: ivyUsPct, intlPct: ivyIntlPct, mix: MANUAL_EQUITY_MIX },
    credit: { ...creditModel, isFallback: fredHY.value == null },
  };

  // Week-over-week priors, live. Same method as the S&P (close from 5
  // trading days back). Null when history is short or the fetch failed,
  // and the page hides the arrow rather than inventing a comparison.
  const vixWeekAgo: number | null = vix.closes.length >= 6 ? vix.closes[vix.closes.length - 6] ?? null : null;
  const hyWeekAgo: number | null = fredHY.value != null ? fredHY.prev : null;

  const yieldCurve: number = fredYC.value ?? 0.55;
  const fedFunds: number = fredFedFunds.value ?? 4.33;
  const fedFundsYearAgo: number | null = fredFedFunds.prev;
  // Direction is now derived from the actual 12-month move in the
  // effective rate, live, not hand-set. 0.125 is half a standard 25bp
  // hike, small enough to catch a single move without flagging noise.
  const fedTrendDirection: "up" | "down" | "flat" =
    fedFundsYearAgo == null ? "flat" :
    fedFunds - fedFundsYearAgo > 0.125 ? "up" :
    fedFundsYearAgo - fedFunds > 0.125 ? "down" : "flat";
  const breakeven5y: number = fredBreakeven.value ?? 2.45;

  const dxyPrice: number | null = dxy.meta.regularMarketPrice ?? dxy.closes[dxy.closes.length - 1] ?? null;
  const dxyPrev: number | null = dxy.closes.length >= 2 ? dxy.closes[dxy.closes.length - 2] : null;
  const dxyChangePct: number | null = dxyPrice != null && dxyPrev != null ? ((dxyPrice - dxyPrev) / dxyPrev) * 100 : null;

  const putCallRatio: number | null = putCall.meta.regularMarketPrice ?? putCall.closes[putCall.closes.length - 1] ?? null;

  // Live P/E when a source works, otherwise price ÷ trailing EPS (tracks the
  // market daily), and only as a last resort the static fallback.
  const peFromPrice: number | null = spxPrice != null ? Math.round((spxPrice / MANUAL_SPX_TTM_EPS) * 10) / 10 : null;
  const trailingPE: number | null = peData.value ?? spx.meta.trailingPE ?? peFromPrice ?? MANUAL_PE_FALLBACK;
  let erp: number | null = null;
  if (trailingPE != null && trailingPE > 0) {
    const earningsYield = (1 / trailingPE) * 100;
    erp = Math.round((earningsYield - real10y) * 100);
    console.log(`ERP: ${erp} bps`);
  }

  const capeFromPrice: number | null = spxPrice != null ? Math.round((spxPrice / MANUAL_CAPE_E10) * 100) / 100 : null;
  const capeRatio: number = capeData.value ?? capeFromPrice ?? MANUAL_CAPE_FALLBACK;

  const spxPctAbove200 = spx200dma != null && spxPrice != null
    ? ((spxPrice - spx200dma) / spx200dma) * 100 : null;
  const isBelow200 = spxPctAbove200 != null && spxPctAbove200 < 0;

  const regimeGate: "trend_broken" | "near_ma" | "trend_intact" | "reclaiming" =
    isBelow200                                    ? "trend_broken" :
    spxPctAbove200 != null && spxPctAbove200 <= 3 ? "near_ma"      : "trend_intact";

  const scoreCAFE    = capeRatio > 30 ? 2 : capeRatio > 20 ? 1 : 0;
  const scoreBuffett = MANUAL_BUFFETT_SIGMA >= 2.0 ? 2 : MANUAL_BUFFETT_SIGMA >= 1.0 ? 1 : 0;
  const scoreVIX     = vixPrice != null ? (vixPrice >= 30 ? 2 : vixPrice >= 20 ? 1 : 0) : 1;
  const scoreHY      = hySpread >= 5 ? 2 : hySpread >= 4 ? 1 : 0;
  const scoreYC      = yieldCurve < -0.5 ? 2 : yieldCurve < 0.5 ? 1 : 0;
  const scoreBreadth = breadthPct != null ? (breadthPct < 50 ? 2 : breadthPct < 70 ? 1 : 0) : 1;
  const scoreERP     = erp != null ? (erp < 100 ? 2 : erp < 300 ? 1 : 0) : 1;
  // Official month-end count, not the live forecast. The Ivy rule only acts
  // at month-end, so mid-month dips should not move the composite score.
  const ivyInvestedCount = Object.values(MANUAL_IVY.signals).filter(s => s === "Invest").length;
  const scoreIvy     = ivyInvestedCount <= 2 ? 2 : ivyInvestedCount <= 4 ? 1 : 0;
  const compositeScore = scoreCAFE + scoreBuffett + scoreVIX + scoreHY + scoreYC + scoreBreadth + scoreERP + scoreIvy;

  const compositeAllocation =
    regimeGate === "trend_broken" ? "35–40%" :
    regimeGate === "near_ma"      ? "42–45%" :
    compositeScore >= 13 ? "42–45%" :
    compositeScore >= 10 ? "45–50%" :
    compositeScore >= 7  ? "50–55%" :
    compositeScore >= 4  ? "55–60%" : "60%+";

  const compositeSignal =
    regimeGate === "trend_broken" ? "RISK OFF — REDUCE" :
    regimeGate === "near_ma"      ? "RISK WATCH — NEAR MA" :
    compositeScore >= 13 ? "RISK ON — HOLD DEFENSIVE" :
    compositeScore >= 10 ? "RISK ON — SLIGHT TILT" :
    compositeScore >= 7  ? "RISK ON — DEPLOY" :
    compositeScore >= 4  ? "RISK ON — LEAN IN" : "RISK ON — FULL POSTURE";

  const compositeColor =
    regimeGate === "trend_broken" ? "#ff6b88" :
    regimeGate === "near_ma"      ? "#fbbf24" :
    compositeScore >= 13 ? "#fbbf24" :
    compositeScore >= 10 ? "#94a3b8" :
    compositeScore >= 7  ? "#4ade80" :
    compositeScore >= 4  ? "#4ade80" : "#22d3ee";

  const fearGreedScore: number = fearGreedData.value ?? MANUAL_FEAR_GREED_FALLBACK;
  const fearGreedRating: string = fearGreedData.rating ?? "Extreme Fear";

  // Total-return YTD, matching the same basis as the portfolio and VBINX
  // tiles. ^GSPC is a price index with no real dividend adjustment, so total
  // return needs ^SP500TR (the S&P 500 Total Return Index) instead — its
  // own series already has dividends reinvested, no adjclose math needed.
  let spxYtdPct: number | null = null;
  let spxYtdIsTotalReturn = false;
  try {
    const now = new Date();
    const daysIntoYear = Math.ceil(
      (now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (1000 * 60 * 60 * 24)
    ) + 10;
    const trYtd = await fetchChart("^SP500TR", daysIntoYear);
    if (trYtd.closes.length > 0) {
      const trStart = trYtd.closes[0];
      const trLatest = trYtd.meta.regularMarketPrice ?? trYtd.closes[trYtd.closes.length - 1];
      spxYtdPct = ((trLatest - trStart) / trStart) * 100;
      spxYtdIsTotalReturn = true;
    } else if (trYtd.error) {
      diagnostics["spx_ytd_total_return"] = trYtd.error;
    }
    // Fallback: price-only YTD if the total-return series is unavailable,
    // so a bad ticker doesn't silently kill the tile.
    if (spxYtdPct == null) {
      const ytd = await fetchChart("^GSPC", daysIntoYear);
      if (ytd.closes.length > 0 && spxPrice != null) {
        spxYtdPct = ((spxPrice - ytd.closes[0]) / ytd.closes[0]) * 100;
      }
      if (ytd.error) diagnostics["ytd"] = ytd.error;
    }
  } catch (err: any) {
    diagnostics["ytd"] = err?.message ?? "YTD fetch failed";
  }

  // Same technique, fixed ~365-day window instead of days-into-year, for
  // the SPX 100/0 tile's new 1-YR figure.
  let spxOneYearPct: number | null = null;
  try {
    const trOneYear = await fetchChart("^SP500TR", 375);
    if (trOneYear.closes.length > 0) {
      const trStart = trOneYear.closes[0];
      const trLatest = trOneYear.meta.regularMarketPrice ?? trOneYear.closes[trOneYear.closes.length - 1];
      spxOneYearPct = ((trLatest - trStart) / trStart) * 100;
    } else if (trOneYear.error) {
      diagnostics["spx_one_year_total_return"] = trOneYear.error;
    }
  } catch (err: any) {
    diagnostics["spx_one_year"] = err?.message ?? "1-YR fetch failed";
  }

  // Same technique again for 5-YR — separate fetch since SPX doesn't run
  // through fetchPositionMetrics's shared 1830-day window like every other
  // ticker on this dashboard does.
  let spxFiveYearPct: number | null = null;
  try {
    const trFiveYear = await fetchChart("^SP500TR", 1830);
    if (trFiveYear.closes.length > 0) {
      const trStart = trFiveYear.closes[0];
      const trLatest = trFiveYear.meta.regularMarketPrice ?? trFiveYear.closes[trFiveYear.closes.length - 1];
      spxFiveYearPct = ((trLatest - trStart) / trStart) * 100;
    } else if (trFiveYear.error) {
      diagnostics["spx_five_year_total_return"] = trFiveYear.error;
    }
  } catch (err: any) {
    diagnostics["spx_five_year"] = err?.message ?? "5-YR fetch failed";
  }

  // Any manual fallback currently standing in for a failed live fetch.
  // Surfaced on the page with its as-of date.
  const fallbacksInUse: { name: string; value: number; asOf: string }[] = [];
  if (fredHY.value == null) fallbacksInUse.push({ name: "HY spread", value: MANUAL_HY_FALLBACK, asOf: FALLBACK_ASOF.hy });
  // CAPE and P/E estimated from price are the normal path now (both live
  // sources are dead), so they only count as a fallback if the estimate
  // itself is unavailable.
  if (capeData.value == null && capeFromPrice == null) fallbacksInUse.push({ name: "CAPE", value: MANUAL_CAPE_FALLBACK, asOf: "Nov 20 2026" });
  if (fearGreedData.value == null) fallbacksInUse.push({ name: "Fear & Greed", value: MANUAL_FEAR_GREED_FALLBACK, asOf: FALLBACK_ASOF.fear_greed });
  if (peData.value == null && spx.meta.trailingPE == null && peFromPrice == null) fallbacksInUse.push({ name: "S&P trailing P/E", value: MANUAL_PE_FALLBACK, asOf: "Nov 20 2026" });

  const hasPartialData = spxPrice != null;
  const status = Object.keys(diagnostics).length === 0 ? "ok" : hasPartialData ? "partial" : "error";

  // ═══════════════════════════════════════════════════════════════════
  // WEEKLY VIEW — the main page. Five signals, three context tiles, a
  // story line and a "call Chris?" status. Plan: hold M2 and rebalance.
  // A call is worth it only when trend, credit and economy turn together.
  // ═══════════════════════════════════════════════════════════════════
  const [claims, tenYrMonth] = await Promise.all([claimsP, tenYrMonthP]);
  type Tone = "green" | "yellow" | "red";
  const wkCloses = lastClosePerPeriod(spxWeekly.closes, spxWeekly.timestamps, "week");
  const moCloses = lastClosePerPeriod(spxMonthly.closes, spxMonthly.timestamps, "month");
  const avgOf = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const sma40w = wkCloses.length >= 40 ? avgOf(wkCloses.slice(-40)) : null;
  const sma10m = moCloses.length >= 10 ? avgOf(moCloses.slice(-10)) : null;
  const pctVs40w = spxPrice != null && sma40w != null ? ((spxPrice - sma40w) / sma40w) * 100 : null;
  const pctVs10m = spxPrice != null && sma10m != null ? ((spxPrice - sma10m) / sma10m) * 100 : null;
  const spxWeekAgoClose = spxCloses.length >= 6 ? spxCloses[spxCloses.length - 6] : null;
  const spxWeekPct = spxPrice != null && spxWeekAgoClose ? ((spxPrice - spxWeekAgoClose) / spxWeekAgoClose) * 100 : null;
  const spxMonthAgoClose = spxCloses.length >= 22 ? spxCloses[spxCloses.length - 22] : null;
  const spxMonthPct = spxPrice != null && spxMonthAgoClose ? ((spxPrice - spxMonthAgoClose) / spxMonthAgoClose) * 100 : null;
  const spxHigh52 = spxCloses.length ? Math.max(...spxCloses.slice(-252)) : null;
  const spxOffHigh = spxPrice != null && spxHigh52 ? ((spxPrice - spxHigh52) / spxHigh52) * 100 : null;

  // RSI(14), Wilder smoothing, on daily closes
  const rsi14 = (() => {
    const c = spxCloses; if (c.length < 30) return null;
    let g = 0, l = 0;
    for (let i = 1; i <= 14; i++) { const d = c[i] - c[i - 1]; if (d >= 0) g += d; else l -= d; }
    g /= 14; l /= 14;
    for (let i = 15; i < c.length; i++) { const d = c[i] - c[i - 1]; g = (g * 13 + Math.max(d, 0)) / 14; l = (l * 13 + Math.max(-d, 0)) / 14; }
    return l === 0 ? 100 : 100 - 100 / (1 + g / l);
  })();

  const fmt = (v: number | null, d = 1) => (v == null ? "n/a" : v.toFixed(d));
  const sgn = (v: number | null, d = 1) => (v == null ? "n/a" : `${v >= 0 ? "+" : ""}${v.toFixed(d)}`);

  // 1. Trend: S&P vs 40-week average (live), 10-month average checked at month-end
  const trendTone: Tone = pctVs40w == null ? "yellow" : pctVs40w < 0 ? "red" : pctVs40w < 3 ? "yellow" : "green";
  const trend = {
    key: "trend", title: "Trend", question: "Is the market breaking down?", tone: trendTone,
    label: trendTone === "red" ? "Broken" : trendTone === "yellow" ? "Thin cushion" : "Uptrend",
    value: pctVs40w == null ? "n/a" : `${sgn(pctVs40w)}%`, unit: "vs 40-wk avg",
    detail: `10-month avg: ${sgn(pctVs10m)}% (official at month-end) · ${fmt(spxOffHigh)}% off the high`,
    weekChange: spxWeekPct == null ? null : `${sgn(spxWeekPct)}% this week`,
    direction: spxWeekPct == null ? "flat" : spxWeekPct > 0.5 ? "better" : spxWeekPct < -0.5 ? "worse" : "flat",
  };

  // 2. Credit: HY spread level and weekly change
  const hyBps = hySpread * 100;
  const hyChg = hyWeekAgo != null ? (hySpread - hyWeekAgo) * 100 : null;
  const creditTone: Tone = hyBps < 350 ? "green" : hyBps < 450 ? "yellow" : "red";
  const credit = {
    key: "credit", title: "Credit", question: "Are lenders getting worried?", tone: creditTone,
    label: creditTone === "green" ? "Calm" : creditTone === "yellow" ? "Caution" : "Stress",
    value: `${Math.round(hyBps)}`, unit: "bps HY spread",
    detail: "Calm under 350 · stress over 450 · 500+ is a recession-type level",
    weekChange: hyChg == null ? null : `${hyChg >= 0 ? "+" : ""}${Math.round(hyChg)} bps this week`,
    direction: hyChg == null ? "flat" : hyChg > 5 ? "worse" : hyChg < -5 ? "better" : "flat",
  };

  // 3. Economy: Sahm rule plus the claims trend
  const claimsK = claims.value != null ? claims.value / 1000 : null;
  const claimsChgPct = claims.value != null && claims.prev ? ((claims.value - claims.prev) / claims.prev) * 100 : null;
  const econTone: Tone =
    MANUAL_SAHM.value >= 0.5 || (claimsChgPct != null && claimsChgPct > 25) ? "red" :
    MANUAL_SAHM.value >= 0.3 || (claimsChgPct != null && claimsChgPct > 10) ? "yellow" : "green";
  const economy = {
    key: "economy", title: "Economy", question: "Is a recession starting?", tone: econTone,
    label: econTone === "green" ? "Healthy" : econTone === "yellow" ? "Softening" : "Recession risk",
    value: MANUAL_SAHM.value.toFixed(2), unit: `Sahm (${MANUAL_SAHM.asOf}) · trigger 0.50`,
    detail: claimsK == null ? "Jobless claims unavailable" : `Jobless claims ${Math.round(claimsK)}k · ${sgn(claimsChgPct, 0)}% vs 13 weeks ago`,
    weekChange: null, direction: "flat",
  };

  // 4. Earnings: are analysts raising or cutting estimates?
  const earnTone: Tone = MANUAL_EARNINGS.trend === "rising" ? "green" : MANUAL_EARNINGS.trend === "flat" ? "yellow" : "red";
  const earnings = {
    key: "earnings", title: "Earnings", question: "Are the fundamentals changing?", tone: earnTone,
    label: earnTone === "green" ? "Estimates rising" : earnTone === "yellow" ? "Estimates flat" : "Estimates being cut",
    value: `$${MANUAL_EARNINGS.fwdEps.toFixed(0)}`, unit: `fwd 12-mo EPS (${MANUAL_EARNINGS.asOf})`,
    detail: MANUAL_EARNINGS.note,
    weekChange: null, direction: "flat",
  };

  // 5. Fed: policy direction plus the real rate
  const realFed = fedFunds - MANUAL_CORE_PCE.value;
  const fedTone: Tone = MANUAL_FED_STANCE === "tightening" ? "red" : MANUAL_FED_STANCE === "holding" ? "yellow" : "green";
  const fed = {
    key: "fed", title: "Fed", question: "Is policy helping or hurting?", tone: fedTone,
    label: fedTone === "red" ? "Headwind (hiking)" : fedTone === "yellow" ? "On hold" : "Tailwind (cutting)",
    value: `${fedFunds.toFixed(2)}%`, unit: "fed funds",
    detail: `${MANUAL_FED_NEXT_MOVE.hikeOdds}% odds of a ${MANUAL_FED_NEXT_MOVE.meeting} hike · real rate about ${realFed.toFixed(1)}% (core PCE ${MANUAL_CORE_PCE.value}%, ${MANUAL_CORE_PCE.label})`,
    weekChange: null, direction: "flat",
  };

  // Context row: explains, never triggers a call
  const valTone: Tone = MANUAL_BUFFETT_SIGMA >= 2 ? "red" : MANUAL_BUFFETT_SIGMA >= 1 ? "yellow" : "green";
  const tenYrChgBp = tenYrMonth.value != null && tenYrMonth.prev != null ? (tenYrMonth.value - tenYrMonth.prev) * 100 : null;
  const bondsHedging = spxMonthPct != null && tenYrChgBp != null && spxMonthPct < -2 && tenYrChgBp < 0;
  const bothFalling = spxMonthPct != null && tenYrChgBp != null && spxMonthPct < -2 && tenYrChgBp > 10;
  const context = [
    { key: "valuation", title: "Valuation", tone: valTone,
      label: valTone === "red" ? "Extreme" : valTone === "yellow" ? "Expensive" : "Reasonable",
      value: `${MANUAL_BUFFETT_SIGMA.toFixed(2)}σ`, unit: "Buffett",
      detail: `CAPE ${capeRatio.toFixed(1)}x · sets long-run returns, not timing` },
    { key: "stocksBonds", title: "Stocks vs bonds", tone: (bothFalling ? "red" : bondsHedging ? "green" : "yellow") as Tone,
      label: bothFalling ? "Both falling" : bondsHedging ? "Bonds hedging" : "Normal",
      value: `${sgn(spxMonthPct)}%`, unit: "S&P, 1 month",
      detail: tenYrChgBp == null ? "10-year change unavailable" : `10-year yield ${tenYrChgBp >= 0 ? "+" : ""}${Math.round(tenYrChgBp)} bps over the same month. Falling yields mean bonds are cushioning stocks` },
    { key: "stretch", title: "Short-term stretch", tone: (rsi14 != null && rsi14 < 30 ? "green" : rsi14 != null && rsi14 > 70 ? "red" : "yellow") as Tone,
      label: rsi14 == null ? "n/a" : rsi14 < 30 ? "Oversold, bounce likely" : rsi14 > 70 ? "Overbought" : "Neutral",
      value: rsi14 == null ? "n/a" : rsi14.toFixed(0), unit: "RSI (14-day)",
      detail: `VIX ${vixPrice != null ? vixPrice.toFixed(1) : "n/a"} · AAII bears ${MANUAL_AAII_BEARS}% · timing for bounces, not allocation` },
  ];

  // Call-Chris logic and story line
  const core = [trend, credit, economy];
  const coreReds = core.filter(c => c.tone === "red").length;
  const wvRegime =
    coreReds === 3 ? "Broad deterioration" :
    trend.tone === "red" && coreReds === 2 ? "Correction with stress spreading" :
    trend.tone === "red" ? "Market-led correction" :
    trend.tone === "yellow" && coreReds === 0 ? "Uptrend losing cushion" :
    coreReds >= 1 ? `Market holding up while ${core.filter(c => c.tone === "red").map(c => c.title.toLowerCase()).join(" and ")} weakens` :
    "Healthy uptrend";
  const notConfirming = [credit, economy, earnings].filter(x => x.tone === "green").map(x => x.title.toLowerCase());
  const watching = [credit, economy, earnings].filter(x => x.tone === "yellow");
  const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  const storyParts = [`${wvRegime}.`];
  if (trend.tone === "red" && notConfirming.length) storyParts.push(`${cap(notConfirming.join(" and "))} ${notConfirming.length > 1 ? "are" : "is"} not confirming.`);
  if (fed.tone === "red") storyParts.push("The Fed is the main risk.");

  // Lance's 4-week 200-day clock: trading days elapsed since the first break.
  const CLOCK_200 = { start: "2026-11-18", deadline: "2026-12-16" };
  const MARKET_HOLIDAYS = ["2026-11-26", "2026-12-25", "2027-01-01"];
  const tradingDaysBetween = (a: string, b: string) => {
    let n = 0; const d = new Date(a + "T12:00:00Z"); const end = new Date(b + "T12:00:00Z");
    while (d <= end) { const dow = d.getUTCDay(); const iso = d.toISOString().slice(0, 10);
      if (dow !== 0 && dow !== 6 && !MARKET_HOLIDAYS.includes(iso)) n++; d.setUTCDate(d.getUTCDate() + 1); }
    return n;
  };
  const todayEt = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const clockTotal = tradingDaysBetween(CLOCK_200.start, CLOCK_200.deadline);
  const clockDay = Math.min(clockTotal, tradingDaysBetween(CLOCK_200.start, todayEt));
  const clock = { start: CLOCK_200.start, deadline: CLOCK_200.deadline, day: clockDay, total: clockTotal, expired: todayEt > CLOCK_200.deadline };

  const keyDates = MANUAL_CALENDAR.filter(c => c.kind === "market" && c.date >= todayEt && !/closed|half day/i.test(c.item)).slice(0, 3);

  // Badge: a one-word read of the market, not an instruction.
  const badge =
    coreReds === 3 ? { text: "DETERIORATING", tone: "red" } :
    coreReds === 2 ? { text: "STRESS SPREADING", tone: "red" } :
    trend.tone === "red" ? { text: "CORRECTION", tone: "yellow" } :
    coreReds === 1 ? { text: "MIXED", tone: "yellow" } :
    trend.tone === "yellow" ? { text: "THIN CUSHION", tone: "yellow" } :
    { text: "UPTREND", tone: "green" };

  // What to watch: the live numbers behind the story.
  const deadlineLabel = new Date(CLOCK_200.deadline + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  // One line per signal: where it stands and what to watch.
  const watchList: { label: string; text: string; tone: Tone }[] = [];
  {
    const t40 = pctVs40w == null ? "n/a" : `${pctVs40w >= 0 ? "+" : ""}${pctVs40w.toFixed(1)}%`;
    let tText = `S&P ${t40} vs its 40-week average.`;
    if (spxPrice != null && spx200dma != null) {
      const pts = Math.round(Math.abs(spx200dma - spxPrice));
      tText += spxPrice < spx200dma
        ? (clock.expired ? ` Still ${pts} pts below the 200-DMA after the 4-week clock expired.` : ` Needs +${pts} pts to reclaim the 200-DMA (${Math.round(spx200dma).toLocaleString()}) by ${deadlineLabel}.`)
        : ` Back above the 200-DMA by ${pts} pts. Watch that it holds.`;
    }
    if (spx50dma != null && spx200dma != null && spx50dma < spx200dma) tText += " Death cross in place (50-DMA below the 200).";
    watchList.push({ label: "Trend", text: tText, tone: trend.tone });
  }
  watchList.push({ label: "Credit", text: `HY ${Math.round(hyBps)} bps${credit.weekChange ? `, ${credit.weekChange}` : ""}. Stress starts at 450.`, tone: credit.tone });
  {
    const jobs = MANUAL_CALENDAR.find(c => c.date >= todayEt && /jobs/i.test(c.item));
    const jobsLabel = jobs ? new Date(jobs.date + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : null;
    watchList.push({ label: "Economy", text: `Sahm ${MANUAL_SAHM.value.toFixed(2)} (recession signal at 0.50)${claimsK != null ? `, claims ${Math.round(claimsK)}k` : ""}.${jobsLabel ? ` Next read: ${jobsLabel} jobs report.` : ""}`, tone: economy.tone });
  }
  watchList.push({ label: "Earnings", text: `Forward EPS $${MANUAL_EARNINGS.fwdEps.toFixed(0)}, ${earnings.tone === "green" ? "estimates still rising" : earnings.tone === "yellow" ? "estimates flat" : "estimates being cut"}. Watch Q4 guidance into January.`, tone: earnings.tone });
  watchList.push({ label: "Fed", text: `${MANUAL_FED_NEXT_MOVE.hikeOdds}% odds of a ${MANUAL_FED_NEXT_MOVE.meeting} hike, core PCE ${MANUAL_CORE_PCE.value}%.${fed.tone === "red" ? " A 50 bp move is the risk." : ""}`, tone: fed.tone });
  const weeklyView = {
    story: storyParts.join(" "),
    badge,
    watchList,
    clock,
    keyDates,
    spxOffHigh,
    spxHigh52,
    signals: [trend, credit, economy, earnings, fed],
    context,
    calendar: MANUAL_CALENDAR,
    actions: MANUAL_ACTIONS,
    asOf: new Date().toISOString(),
  };

  return NextResponse.json({
    ok: hasPartialData,
    status,
    source: "LIVE_YAHOO_FRED",
    asOf: new Date().toISOString(),
    diagnostics: Object.keys(diagnostics).length > 0 ? diagnostics : undefined,
    spx_price: spxPrice,
    spx_change_pct: spxChangePct,
    spx_ytd_pct: spxYtdPct,
    spx_one_year_pct: spxOneYearPct,
    spx_five_year_pct: spxFiveYearPct,
    spx_trend_14d: spxTrend14d,
    spx_history: spxCloses,
    vix: vixPrice,
    fallbacks_in_use: fallbacksInUse,
    weekly_view: weeklyView,
    metrics: {
      spx_price: spxPrice,
      spx_change_pct: spxChangePct,
      spx_ytd_pct: spxYtdPct,
      spx_one_year_pct: spxOneYearPct,
      spx_five_year_pct: spxFiveYearPct,
      spx_ytd_is_total_return: spxYtdIsTotalReturn,
      spx_trend_14d: spxTrend14d,
      spx_history: spxCloses,
      vix: vixPrice,
      vix_week_ago: vixWeekAgo,
      spx_20dma: { level: spx20dma, slope: spx20slope },
      spx_50dma: { level: spx50dma, slope: spx50slope },
      spx_100dma: { level: spx100dma, slope: spx100slope },
      spx_200dma: { level: spx200dma, slope: spx200slope },
      qqq: {
        price: qqqPrice,
        change_pct: qqqChangePct,
        ytd_pct: qqqYtdPct,
        trend_14d: qqqTrend14d,
        dma_20: { level: qqq20dma, slope: qqq20slope },
        dma_50: { level: qqq50dma, slope: qqq50slope },
        dma_100: { level: qqq100dma, slope: qqq100slope },
        dma_200: { level: qqq200dma, slope: qqq200slope },
        regime: qqqRegime,
        regime_label: regimeLabel[qqqRegime],
        regime_desc: qqqRegimeDesc[qqqRegime],
        regime_color: regimeColor[qqqRegime],
        regime_emoji: regimeEmoji[qqqRegime],
      },
      regime,
      regime_label: regimeLabel[regime],
      regime_desc: regimeDesc[regime],
      regime_color: regimeColor[regime],
      regime_emoji: regimeEmoji[regime],
      hy_spread: hySpread,
      hy_spread_week_ago: hyWeekAgo,
      yield_curve_10y_2y: yieldCurve,
      real_10y: real10y,
      nom_10y: nom10y,
      fed_funds: fedFunds,
      fed_funds_year_ago: fedFundsYearAgo,
      fed_trend_direction: fedTrendDirection,
      breakeven_5y: breakeven5y,
      dxy: dxyPrice,
      dxy_change_pct: dxyChangePct,
      put_call_ratio: putCallRatio,
      erp_bps: erp,
      trailing_pe: trailingPE,
      cape_ratio: capeRatio,
      fear_greed_score: fearGreedScore,
      fear_greed_rating: fearGreedRating,
      ad_line: MANUAL_AD,
      walcl_bn: walclBn,
      walcl_prev_bn: walclPrevBn,
      walcl_chg_bn: walclChgBn,
      walcl_direction: walclDirection,
      brent_price: brentPrice,
      brent_change_pct: brentChangePct,
      brent_regime: brentRegime,
      breadth_pct: breadthPct,
      composite_score: compositeScore,
      composite_scores: { cape: scoreCAFE, buffett: scoreBuffett, vix: scoreVIX, hy: scoreHY, yc: scoreYC, breadth: scoreBreadth, erp: scoreERP, ivy: scoreIvy },
      composite_allocation: compositeAllocation,
      composite_signal: compositeSignal,
      composite_color: compositeColor,
      regime_gate: regimeGate,
      buffett_sigma: MANUAL_BUFFETT_SIGMA,
      fed_stance: MANUAL_FED_STANCE,
      fed_next_move: MANUAL_FED_NEXT_MOVE,
      aaii_bears: MANUAL_AAII_BEARS,
      djt_price: djtPrice,
      djt_change_pct: djtChangePct,
      djt_trend_14d: djtCloses.slice(-14),
      djt_200dma: djt200dma,
      djt_200slope: djt200slope,
      djt_vs_200_pct: djtVs200,
      djt_above_200: djtAbove200,
      schannep_signal: schannepSignal,
      schannep_label: schannepLabel[schannepSignal],
      schannep_color: schannepColor[schannepSignal],
      ivy_official: MANUAL_IVY,
      graded_ivy: gradedIvy,
      equity_allocation: equityAllocation,
      roar,
      ivy: {
        vti: { price: ivyVTI.price, sma: ivyVTI.sma, variance: ivyVTI.variancePct, signal: ivyVTI.signal },
        veu: { price: ivyVEU.price, sma: ivyVEU.sma, variance: ivyVEU.variancePct, signal: ivyVEU.signal },
        ief: { price: ivyIEF.price, sma: ivyIEF.sma, variance: ivyIEF.variancePct, signal: ivyIEF.signal },
        vnq: { price: ivyVNQ.price, sma: ivyVNQ.sma, variance: ivyVNQ.variancePct, signal: ivyVNQ.signal },
        dbc: { price: ivyDBC.price, sma: ivyDBC.sma, variance: ivyDBC.variancePct, signal: ivyDBC.signal },
      },
      positions,
      benchmark_6040: {
        ytd_return_pct: benchmark6040YtdPct,
        today_change_pct: benchmark6040TodayPct,
        one_year_return_pct: benchmark6040OneYearPct,
        five_year_return_pct: benchmark6040FiveYearPct,
        vti_ytd_pct: vtiForBenchmark?.ytdReturnPct ?? null,
        bnd_ytd_pct: benchmarkBND.ytdReturnPct,
        components: [
          { ticker: "VTI", weight_pct: 60, ytd_pct: vtiForBenchmark?.ytdReturnPct ?? null, today_pct: vtiForBenchmark?.dailyChangePct ?? null },
          { ticker: "BND", weight_pct: 40, ytd_pct: benchmarkBND.ytdReturnPct, today_pct: benchmarkBND.dailyChangePct },
        ],
      },
      benchmark_4060: {
        ytd_return_pct: benchmark4060YtdPct,
        today_change_pct: benchmark4060TodayPct,
        one_year_return_pct: benchmark4060OneYearPct,
        five_year_return_pct: benchmark4060FiveYearPct,
        vti_ytd_pct: vtiForBenchmark?.ytdReturnPct ?? null,
        bnd_ytd_pct: benchmarkBND.ytdReturnPct,
        components: [
          { ticker: "VTI", weight_pct: 40, ytd_pct: vtiForBenchmark?.ytdReturnPct ?? null, today_pct: vtiForBenchmark?.dailyChangePct ?? null },
          { ticker: "BND", weight_pct: 60, ytd_pct: benchmarkBND.ytdReturnPct, today_pct: benchmarkBND.dailyChangePct },
        ],
      },
      benchmark_5050: {
        ytd_return_pct: benchmark5050YtdPct,
        today_change_pct: benchmark5050TodayPct,
        one_year_return_pct: benchmark5050OneYearPct,
        five_year_return_pct: benchmark5050FiveYearPct,
        vti_ytd_pct: vtiForBenchmark?.ytdReturnPct ?? null,
        bnd_ytd_pct: benchmarkBND.ytdReturnPct,
        components: [
          { ticker: "VTI", weight_pct: 50, ytd_pct: vtiForBenchmark?.ytdReturnPct ?? null, today_pct: vtiForBenchmark?.dailyChangePct ?? null },
          { ticker: "BND", weight_pct: 50, ytd_pct: benchmarkBND.ytdReturnPct, today_pct: benchmarkBND.dailyChangePct },
        ],
      },
      clean_slate: {
        ytd_return_pct: cleanSlateYtdPct,
        today_change_pct: cleanSlateTodayPct,
        one_year_return_pct: cleanSlateOneYearPct,
        five_year_return_pct: cleanSlateFiveYearPct,
        components: serializeComponents(cleanSlateComponents),
      },
      lpl_4060: {
        ytd_return_pct: lpl4060YtdPct,
        today_change_pct: lpl4060TodayPct,
        one_year_return_pct: lpl4060OneYearPct,
        five_year_return_pct: lpl4060FiveYearPct,
        components: serializeComponents(lpl4060Components),
      },
      lpl_5050: {
        ytd_return_pct: lpl5050YtdPct,
        today_change_pct: lpl5050TodayPct,
        one_year_return_pct: lpl5050OneYearPct,
        five_year_return_pct: lpl5050FiveYearPct,
        components: serializeComponents(lpl5050Components),
      },
      vg_4060: {
        ytd_return_pct: vg4060YtdPct,
        today_change_pct: vg4060TodayPct,
        one_year_return_pct: vg4060OneYearPct,
        five_year_return_pct: vg4060FiveYearPct,
        components: serializeComponents(vg4060Components),
      },
      noelle_mockup: {
        ytd_return_pct: noelleMockupYtdPct,
        today_change_pct: noelleMockupTodayPct,
        one_year_return_pct: noelleMockupOneYearPct,
        five_year_return_pct: noelleMockupFiveYearPct,
        components: serializeComponents(noelleMockupComponents),
      },
      c1_tax: {
        ytd_return_pct: c1TaxYtdPct,
        today_change_pct: c1TaxTodayPct,
        one_year_return_pct: c1TaxOneYearPct,
        five_year_return_pct: c1TaxFiveYearPct,
        components: serializeComponents(c1TaxComponents),
      },
      c1_ira: {
        ytd_return_pct: c1IraYtdPct,
        today_change_pct: c1IraTodayPct,
        one_year_return_pct: c1IraOneYearPct,
        five_year_return_pct: c1IraFiveYearPct,
        components: serializeComponents(c1IraComponents),
      },
      m2: {
        ytd_return_pct: m2YtdPct,
        today_change_pct: m2TodayPct,
        one_year_return_pct: m2OneYearPct,
        five_year_return_pct: m2FiveYearPct,
        components: serializeComponents(m2Components),
      },
      m27: {
        ytd_return_pct: m27YtdPct,
        today_change_pct: m27TodayPct,
        one_year_return_pct: m27OneYearPct,
        five_year_return_pct: m27FiveYearPct,
        components: serializeComponents(m27Components),
      },
      m3: {
        ytd_return_pct: m3YtdPct,
        today_change_pct: m3TodayPct,
        one_year_return_pct: m3OneYearPct,
        five_year_return_pct: m3FiveYearPct,
        components: serializeComponents(m3Components),
      },
      panel_consensus: {
        ytd_return_pct: panelYtdPct,
        today_change_pct: panelTodayPct,
        one_year_return_pct: panelOneYearPct,
        five_year_return_pct: panelFiveYearPct,
        components: serializeComponents(panelComponents),
      },
      other_ai: {
        ytd_return_pct: otherAiYtdPct,
        today_change_pct: otherAiTodayPct,
        one_year_return_pct: otherAiOneYearPct,
        five_year_return_pct: otherAiFiveYearPct,
        components: serializeComponents(otherAiComponents),
      },
      hybrid_8: {
        ytd_return_pct: hybrid8YtdPct,
        today_change_pct: hybrid8TodayPct,
        one_year_return_pct: hybrid8OneYearPct,
        five_year_return_pct: hybrid8FiveYearPct,
        components: serializeComponents(hybrid8Components),
      },
    },
  }, { status: 200 });
}
