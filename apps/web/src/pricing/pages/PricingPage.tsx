import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { ChartPanel } from "../components/ChartPanel";
import { KpiCard } from "../components/KpiCard";
import { SectionHeader } from "../components/SectionHeader";
import { SourceBadgeRow } from "../components/SourceBadgeRow";
import { getPricingDashboardData } from "../services/marketDataService";
import type { BenchmarkKey, PricingDashboardData } from "../types/market";
import {
  buildInventoryModeSeries,
  filterPriceHistory,
  formatDateLabel,
  getSeriesColor
} from "../utils/marketCalculations";
import { getOpisMarketData } from "../services/marketDataService";
import type { OpisFuelFilter, OpisMarketSnapshot, OpisSummaryRow } from "../types/market";

const PRICE_SERIES: Array<{ key: BenchmarkKey; label: string }> = [
  { key: "wti", label: "WTI" },
  { key: "brent", label: "Brent" },
  { key: "gasoline", label: "Gasoline" },
  { key: "diesel", label: "Diesel" }
];

const TIMEFRAME_OPTIONS = ["7D", "30D", "90D", "1Y"] as const;

function formatOpisPrice(value: number | null, unit = "USCPG") {
  if (value == null) return "n/a";
  return `${value.toFixed(2)} ${unit}`;
}

function formatOpisDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function OpisHighlightList({ title, rows }: { title: string; rows: OpisSummaryRow[] }) {
  return (
    <div className="rounded-2xl border border-energy-border bg-slate-50 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-energy-slate">{title}</div>
      <div className="mt-3 space-y-3">
        {rows.map((row) => (
          <div key={`${title}-${row.cityId}-${row.productId}`} className="flex items-start justify-between gap-4 text-sm">
            <div>
              <div className="font-semibold text-energy-ink">{row.cityName}, {row.stateAbbr}</div>
              <div className="text-energy-slate">{row.productName}</div>
            </div>
            <div className="text-right">
              <div className="font-semibold text-energy-ink">{formatOpisPrice(row.price, row.currencyUnit)}</div>
              <div className="text-xs text-energy-slate">{row.grossNet}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function averageOpisRows(rows: OpisSummaryRow[], fuelType?: string) {
  const filtered = fuelType ? rows.filter((row) => row.fuelType === fuelType) : rows;
  if (!filtered.length) return null;
  return filtered.reduce((sum, row) => sum + row.price, 0) / filtered.length;
}

function filterOpisRows(rows: OpisSummaryRow[], city: string, products: string[]) {
  return rows.filter((row) => {
    const cityLabel = `${row.cityName}, ${row.stateAbbr}`;
    const cityMatch = city === "ALL" || cityLabel === city;
    const productMatch = products.includes(row.productName);
    return cityMatch && productMatch;
  });
}

function buildOpisCommentary(
  rows: OpisSummaryRow[],
  selectedCity: string,
  selectedProducts: string[],
  primaryTiming?: { label: string; averagePrice: number | null },
  compareTiming?: { label: string; averagePrice: number | null }
) {
  if (!rows.length) {
    return {
      summary: ["No OPIS rows match the current city and product filters."],
      outlook: ["Broaden the city or product selection to restore the comparison view."]
    };
  }

  const sorted = [...rows].sort((a, b) => b.price - a.price);
  const highest = sorted[0];
  const lowest = sorted[sorted.length - 1];
  const averagePrice = averageOpisRows(rows);
  const gasolineAverage = averageOpisRows(rows, "Gasoline");
  const dieselAverage = averageOpisRows(rows, "Distillate");
  const spread = gasolineAverage != null && dieselAverage != null ? dieselAverage - gasolineAverage : null;
  const timingDelta = primaryTiming?.averagePrice != null && compareTiming?.averagePrice != null
    ? primaryTiming.averagePrice - compareTiming.averagePrice
    : null;
  const cityLabel = selectedCity === "ALL" ? "all returned cities" : selectedCity;

  return {
    summary: [
      `The filtered OPIS table contains ${rows.length.toLocaleString("en-US")} rows across ${cityLabel} and ${selectedProducts.length.toLocaleString("en-US")} selected product filters.`,
      `Average returned rack pricing is ${(averagePrice || 0).toFixed(2)} USCPG, with the current range running from ${lowest.cityName}, ${lowest.stateAbbr} at ${lowest.price.toFixed(2)} USCPG up to ${highest.cityName}, ${highest.stateAbbr} at ${highest.price.toFixed(2)} USCPG.`,
      spread == null
        ? "The current filter set does not include enough gasoline and diesel rows to show a fuel spread."
        : spread > 0
          ? `Diesel is averaging ${spread.toFixed(2)} USCPG above gasoline in the current OPIS filter set.`
          : `Gasoline is averaging ${Math.abs(spread).toFixed(2)} USCPG above diesel in the current OPIS filter set.`
    ],
    outlook: [
      timingDelta == null
        ? "The selected timing pair does not have enough overlap to produce a clean comparison."
        : timingDelta > 0
          ? `${primaryTiming?.label} pricing is running ${timingDelta.toFixed(2)} USCPG above ${compareTiming?.label}, which points to a firmer prompt wholesale tone.`
          : timingDelta < 0
            ? `${primaryTiming?.label} pricing is running ${Math.abs(timingDelta).toFixed(2)} USCPG below ${compareTiming?.label}, which suggests the current rack tone is softer than the comparison timing.`
            : `${primaryTiming?.label} and ${compareTiming?.label} are effectively flat versus each other in the current selection.`,
      "Use the city selector to narrow the rack table to one market center, then tighten the product checkboxes to compare only the product slate you actually buy."
    ]
  };
}

function fuelCardTone(label: string) {
  if (/diesel/i.test(label)) return "border-rose-200 bg-rose-50";
  if (/gasoline|premium|midgrade|regular/i.test(label)) return "border-amber-200 bg-amber-50";
  if (/crude|brent|wti/i.test(label)) return "border-blue-200 bg-blue-50";
  if (/stocks/i.test(label)) return "border-slate-200 bg-slate-50";
  return "border-energy-border bg-white";
}

function fuelGroupTone(fuelType: string) {
  if (/biodiesel/i.test(fuelType)) return "border-emerald-200 bg-emerald-50";
  if (/distillate|diesel/i.test(fuelType)) return "border-rose-200 bg-rose-50";
  if (/gasoline/i.test(fuelType)) return "border-amber-200 bg-amber-50";
  return "border-slate-200 bg-slate-50";
}

function OpisTooltip({
  active,
  payload,
  label
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-energy-border bg-white p-3 shadow-energy">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-energy-slate">{label}</div>
      <div className="space-y-1 text-sm">
        {payload.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-4">
            <span className="font-medium" style={{ color: item.color }}>{item.name}</span>
            <span className="text-energy-ink">{Number(item.value).toFixed(2)} USCPG</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ToggleGroup({
  options,
  selected,
  onChange
}: {
  options: readonly string[];
  selected: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-energy-border bg-slate-50 p-1">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${selected === option ? "bg-white text-energy-ink shadow-sm" : "text-energy-slate"}`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="pricing-shell min-h-full rounded-[32px] border border-energy-border p-6">
      <div className="rounded-3xl border border-energy-border bg-white p-10 text-center text-energy-slate shadow-energy">
        Loading pricing dashboard...
      </div>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="pricing-shell min-h-full rounded-[32px] border border-energy-border p-6">
      <div className="rounded-3xl border border-rose-200 bg-white p-10 text-center shadow-energy">
        <div className="text-lg font-semibold text-energy-ink">Pricing data is unavailable.</div>
        <p className="mt-2 text-sm text-energy-slate">The mock service did not return a usable dashboard payload.</p>
        <button type="button" onClick={onRetry} className="mt-4 rounded-full bg-energy-blue px-4 py-2 text-sm font-semibold text-white">
          Try again
        </button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="pricing-shell min-h-full rounded-[32px] border border-energy-border p-6">
      <div className="rounded-3xl border border-energy-border bg-white p-10 text-center text-energy-slate shadow-energy">
        No pricing data is available for the selected view.
      </div>
    </div>
  );
}

function PriceTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="rounded-2xl border border-energy-border bg-white p-3 shadow-energy">
      <div className="space-y-1 text-sm">
        {payload.map((item) => (
          <div key={item.dataKey} className="flex items-center justify-between gap-4">
            <span className="font-medium" style={{ color: item.color }}>
              {String(item.dataKey).toUpperCase()} | {formatDateLabel(label)}
            </span>
            <span className="text-energy-ink">{item.value.toFixed(item.dataKey === "gasoline" || item.dataKey === "diesel" ? 3 : 2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InventoryTooltip({
  active,
  payload,
  label,
  mode
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  mode: "absolute" | "wow";
}) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="rounded-2xl border border-energy-border bg-white p-3 shadow-energy">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-energy-slate">{formatDateLabel(label)}</div>
      <div className="space-y-1 text-sm">
        {payload.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-4">
            <span className="font-medium" style={{ color: item.color }}>{item.name}</span>
            <span className="text-energy-ink">{mode === "wow" && item.value > 0 ? "+" : ""}{item.value.toFixed(1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PricingPage() {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [data, setData] = useState<PricingDashboardData | null>(null);
  const [timeframe, setTimeframe] = useState<(typeof TIMEFRAME_OPTIONS)[number]>("30D");
  const [inventoryMode, setInventoryMode] = useState<"absolute" | "wow">("absolute");
  const [selectedSeries, setSelectedSeries] = useState<Record<BenchmarkKey, boolean>>({
    wti: true,
    brent: true,
    gasoline: true,
    diesel: true
  });
  const [activeView, setActiveView] = useState<"prices" | "trends" | "opis">("prices");
  const [opisStatus, setOpisStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [opisData, setOpisData] = useState<OpisMarketSnapshot | null>(null);
  const [opisTiming, setOpisTiming] = useState("0");
  const [opisState, setOpisState] = useState("ALL");
  const [pendingOpisCity, setPendingOpisCity] = useState("ALL");
  const [appliedOpisCity, setAppliedOpisCity] = useState("ALL");
  const [pendingOpisProducts, setPendingOpisProducts] = useState<string[]>([]);
  const [appliedOpisProducts, setAppliedOpisProducts] = useState<string[]>([]);
  const [primaryTiming, setPrimaryTiming] = useState("0");
  const [compareTiming, setCompareTiming] = useState("1");

  async function load() {
    setStatus("loading");
    try {
      setData(await getPricingDashboardData());
      setStatus("ready");
    } catch (_error) {
      setStatus("error");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function loadOpis(nextFilters = { timing: opisTiming, state: opisState, fuelType: "all" as OpisFuelFilter }) {
    setOpisStatus("loading");
    try {
      const snapshot = await getOpisMarketData(nextFilters);
      setOpisData(snapshot);
      setOpisStatus("ready");
    } catch (_error) {
      setOpisStatus("error");
    }
  }

  useEffect(() => {
    if (activeView !== "opis") return;
    loadOpis();
  }, [activeView]);

  const opisProductOptions = useMemo(() => {
    if (!opisData) return [];
    const grouped = new Map<string, { count: number; fuelType: string }>();
    opisData.rows.forEach((row) => {
      const current = grouped.get(row.productName);
      grouped.set(row.productName, {
        count: (current?.count || 0) + 1,
        fuelType: current?.fuelType || row.fuelType
      });
    });
    return [...grouped.entries()]
      .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
      .slice(0, 12)
      .map(([value, meta]) => ({ value, label: value, count: meta.count, fuelType: meta.fuelType }));
  }, [opisData]);

  const opisProductGroups = useMemo(() => {
    const grouped = new Map<string, Array<{ value: string; label: string; count: number; fuelType: string }>>();
    opisProductOptions.forEach((option) => {
      if (!grouped.has(option.fuelType)) grouped.set(option.fuelType, []);
      grouped.get(option.fuelType)?.push(option);
    });
    return [...grouped.entries()];
  }, [opisProductOptions]);

  useEffect(() => {
    if (!opisProductOptions.length) return;
    const allProducts = opisProductOptions.map((option) => option.value);
    setPendingOpisProducts(allProducts);
    setAppliedOpisProducts(allProducts);
  }, [opisProductOptions]);

  useEffect(() => {
    if (primaryTiming === compareTiming) {
      const fallback = (opisData?.filterOptions.timing || []).find((option) => option.value !== primaryTiming)?.value || primaryTiming;
      setCompareTiming(fallback);
    }
  }, [primaryTiming, compareTiming, opisData]);

  const opisCityOptions = useMemo(() => {
    if (!opisData) return [];
    return [
      { value: "ALL", label: "All Cities" },
      ...[...new Map(opisData.rows.map((row) => [`${row.cityName}, ${row.stateAbbr}`, { value: `${row.cityName}, ${row.stateAbbr}`, label: `${row.cityName}, ${row.stateAbbr}` }])).values()]
        .sort((a, b) => a.label.localeCompare(b.label))
    ];
  }, [opisData]);

  const filteredOpisRows = useMemo(() => {
    if (!opisData) return [];
    return filterOpisRows(opisData.rows, appliedOpisCity, appliedOpisProducts);
  }, [opisData, appliedOpisCity, appliedOpisProducts]);

  const opisFilteredCommentary = useMemo(() => {
    const timingRows = opisData?.charts.timingComparison || [];
    const primary = timingRows.find((item) => item.timing === primaryTiming);
    const compare = timingRows.find((item) => item.timing === compareTiming);
    return buildOpisCommentary(filteredOpisRows, appliedOpisCity, appliedOpisProducts, primary, compare);
  }, [filteredOpisRows, appliedOpisCity, appliedOpisProducts, opisData, primaryTiming, compareTiming]);

  const opisTimingChartData = useMemo(() => {
    const primaryRows = filterOpisRows(
      (opisData?.timingSnapshots.find((item) => item.timing === primaryTiming)?.rows || []),
      appliedOpisCity,
      appliedOpisProducts
    );
    const compareRows = filterOpisRows(
      (opisData?.timingSnapshots.find((item) => item.timing === compareTiming)?.rows || []),
      appliedOpisCity,
      appliedOpisProducts
    );
    return [
      {
        category: "Overall Avg",
        primary: averageOpisRows(primaryRows),
        compare: averageOpisRows(compareRows)
      },
      {
        category: "Gasoline Avg",
        primary: averageOpisRows(primaryRows, "Gasoline"),
        compare: averageOpisRows(compareRows, "Gasoline")
      },
      {
        category: "Diesel Avg",
        primary: averageOpisRows(primaryRows, "Distillate"),
        compare: averageOpisRows(compareRows, "Distillate")
      }
    ];
  }, [opisData, primaryTiming, compareTiming, appliedOpisCity, appliedOpisProducts]);

  const opisHighestRows = useMemo(() => [...filteredOpisRows].sort((a, b) => b.price - a.price).slice(0, 5), [filteredOpisRows]);
  const opisLowestRows = useMemo(() => [...filteredOpisRows].sort((a, b) => a.price - b.price).slice(0, 5), [filteredOpisRows]);

  const filteredHistory = useMemo(() => (data ? filterPriceHistory(data.priceHistory, timeframe) : []), [data, timeframe]);
  const inventorySeries = useMemo(() => (data ? buildInventoryModeSeries(data.inventorySeries, inventoryMode) : []), [data, inventoryMode]);

  const inventoryChartData = useMemo(() => (
    inventorySeries.length
      ? inventorySeries[0].points.map((point, index) => ({
          date: point.date,
          crude: inventorySeries.find((item) => item.key === "crude")?.points[index]?.value ?? null,
          gasoline: inventorySeries.find((item) => item.key === "gasoline")?.points[index]?.value ?? null,
          distillate: inventorySeries.find((item) => item.key === "distillate")?.points[index]?.value ?? null
        }))
      : []
  ), [inventorySeries]);

  const forwardCurveData = useMemo(() => (
    data
      ? data.forwardCurves[0].points.map((point, index) => ({
          month: point.month,
          wti: data.forwardCurves.find((item) => item.key === "wti")?.points[index]?.value ?? null,
          brent: data.forwardCurves.find((item) => item.key === "brent")?.points[index]?.value ?? null,
          gasoline: data.forwardCurves.find((item) => item.key === "gasoline")?.points[index]?.value ?? null,
          diesel: data.forwardCurves.find((item) => item.key === "diesel")?.points[index]?.value ?? null
        }))
      : []
  ), [data]);

  if (status === "loading") return <LoadingState />;
  if (status === "error") return <ErrorState onRetry={load} />;
  if (!data || !data.benchmarkCards.length) return <EmptyState />;

  const lastUpdatedLabel = new Date(data.lastUpdated).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });

  const priceDrivers = data.insightSummary.narrativeBullets.slice(0, 3);
  const inventoryDrivers = data.insightSummary.narrativeBullets.slice(1, 4);
  const curveDrivers = data.insightSummary.curveSummaries;

  return (
    <div className="pricing-shell min-h-full rounded-[32px] border border-energy-border p-4 md:p-6">
      <div className="space-y-6">
        <section className="rounded-[28px] border border-energy-border bg-white p-6 shadow-energy">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div>
              <SectionHeader eyebrow="Market Monitor" title="Energy Market Dashboard" description="Crude, gasoline, diesel, inventories, and forward outlook" />
              <div className="mt-3 text-sm text-energy-slate">Last updated: <span className="font-medium text-energy-ink">{lastUpdatedLabel}</span></div>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={load}
                  disabled={status === "loading"}
                  className="rounded-full border border-energy-border bg-white px-4 py-2 text-sm font-semibold text-energy-ink transition hover:border-energy-blue hover:text-energy-blue disabled:cursor-wait disabled:opacity-60"
                >
                  {status === "loading" ? "Updating..." : "Update now"}
                </button>
              </div>
            </div>
            <div className="rounded-3xl border border-energy-border bg-slate-50 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-energy-slate">Market Monitor</div>
              <div className="mt-4">
                <label className="sr-only" htmlFor="pricing-section">Section</label>
                <select
                  id="pricing-section"
                  value={activeView}
                  onChange={(event) => setActiveView(event.target.value as "prices" | "trends" | "opis")}
                  className="w-full rounded-2xl border border-energy-border bg-white px-4 py-3 text-sm font-semibold text-energy-ink outline-none transition focus:border-energy-blue"
                >
                  <option value="prices">Prices</option>
                  <option value="trends">Trends</option>
                  <option value="opis">OPIS</option>
                </select>
              </div>
              <div className="mt-4">
                <SourceBadgeRow badges={data.sourceBadges} coverage={data.sourceCoverage} />
              </div>
              <div className="mt-4 rounded-2xl border border-energy-border bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-energy-slate">
                    {data.insightSummary.outlookTitle}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-energy-slate">
                    {data.insightSummary.confidence}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-energy-ink">{data.insightSummary.narrativeBullets[0]}</p>
              </div>
            </div>
          </div>
        </section>

        {activeView === "prices" ? (
          <section className="space-y-6">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              {data.benchmarkCards.map((card) => (
                <div key={card.key} className={`rounded-[28px] border p-[1px] ${fuelCardTone(card.label)}`}>
                  <KpiCard card={card} />
                </div>
              ))}
            </section>

            <section className="rounded-3xl border border-energy-border bg-white p-6 shadow-energy">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-energy-slate">Price Snapshot</div>
                  <h3 className="mt-2 text-xl font-semibold text-energy-ink">What matters in the current market</h3>
                  <div className="mt-4 space-y-4 text-sm leading-6 text-energy-ink">
                    {priceDrivers.map((bullet) => (
                      <div key={bullet} className="flex gap-3">
                        <span className="mt-2 h-2 w-2 rounded-full bg-energy-blue" />
                        <span>{bullet}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-energy-border bg-slate-50 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-energy-slate">
                      {data.insightSummary.outlookTitle}
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-energy-slate">
                      Confidence: {data.insightSummary.confidence}
                    </span>
                  </div>
                  <div className="mt-4 space-y-3 text-sm leading-6 text-energy-ink">
                    {data.insightSummary.outlookBody.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                  </div>
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Interpretation only. This dashboard is not trading advice.
                  </div>
                </div>
              </div>
            </section>
          </section>
        ) : activeView === "trends" ? (
          <section className="space-y-6">
            <ChartPanel
              title="Price Trends"
              description="Benchmark prices across crude and refined products."
              actions={<ToggleGroup options={TIMEFRAME_OPTIONS} selected={timeframe} onChange={(value) => setTimeframe(value as (typeof TIMEFRAME_OPTIONS)[number])} />}
              bodyClassName="min-h-[460px] w-full overflow-hidden"
              titlePopover={
                <div className="space-y-3">
                  {priceDrivers.map((bullet) => <p key={bullet}>{bullet}</p>)}
                  <p>{data.insightSummary.outlookBody[0]}</p>
                </div>
              }
            >
              <div className="min-w-0">
                <div className="mb-4 flex flex-wrap gap-2">
                  {PRICE_SERIES.map((series) => (
                    <button
                      key={series.key}
                      type="button"
                      onClick={() => setSelectedSeries((current) => ({ ...current, [series.key]: !current[series.key] }))}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${selectedSeries[series.key] ? "border-transparent text-white" : "border-energy-border bg-white text-energy-slate"}`}
                      style={selectedSeries[series.key] ? { backgroundColor: getSeriesColor(series.key) } : undefined}
                    >
                      {series.label}
                    </button>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={380}>
                  <LineChart data={filteredHistory} margin={{ top: 12, right: 20, left: 90, bottom: 4 }}>
                    <CartesianGrid stroke="#e6edf3" strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={formatDateLabel} tick={{ fontSize: 12, fill: "#5f7389" }} minTickGap={24} />
                    <YAxis tick={{ fontSize: 12, fill: "#5f7389" }} width={60} />
                    <Tooltip content={<PriceTooltip />} />
                    <Legend layout="vertical" align="left" verticalAlign="middle" wrapperStyle={{ left: 0 }} />
                    {PRICE_SERIES.map((series) => selectedSeries[series.key] ? (
                      <Line key={series.key} type="monotone" dataKey={series.key} name={series.label} stroke={getSeriesColor(series.key)} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                    ) : null)}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartPanel>

            <ChartPanel
              title="Inventory Trends"
              description="Weekly U.S. stock context across crude and major transport fuels."
              actions={<ToggleGroup options={["absolute", "wow"]} selected={inventoryMode} onChange={(value) => setInventoryMode(value as "absolute" | "wow")} />}
              bodyClassName="min-h-[460px] w-full overflow-hidden"
              titlePopover={
                <div className="space-y-3">
                  {inventoryDrivers.map((bullet) => <p key={bullet}>{bullet}</p>)}
                  <p>{data.insightSummary.outlookBody[1]}</p>
                </div>
              }
            >
              <div className="min-w-0">
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={inventoryChartData} margin={{ top: 12, right: 20, left: 120, bottom: 4 }}>
                    <CartesianGrid stroke="#e6edf3" strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={formatDateLabel} tick={{ fontSize: 12, fill: "#5f7389" }} minTickGap={18} />
                    <YAxis tick={{ fontSize: 12, fill: "#5f7389" }} width={60} />
                    <Tooltip content={<InventoryTooltip mode={inventoryMode} />} />
                    <Legend layout="vertical" align="left" verticalAlign="middle" wrapperStyle={{ left: 0 }} />
                    {(["crude", "gasoline", "distillate"] as const).map((key) => (
                      <Line key={key} type="monotone" dataKey={key} name={inventorySeries.find((series) => series.key === key)?.label || key} stroke={getSeriesColor(key)} strokeWidth={2.4} dot={false} activeDot={{ r: 4 }} />
                    ))}
                    {inventoryMode === "wow" ? <ReferenceLine y={0} stroke="#9fb0bf" strokeDasharray="4 4" /> : null}
                    {data.inventorySeries.flatMap((series) => series.annotations.map((annotation) => (
                      <ReferenceLine key={`${series.key}-${annotation.date}`} x={annotation.date} stroke={getSeriesColor(series.key)} strokeDasharray="2 6" label={{ value: annotation.label, position: "top", fill: getSeriesColor(series.key), fontSize: 11 }} />
                    )))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartPanel>

            <ChartPanel
              title="Futures / Forward Curve"
              description="Prompt versus deferred pricing across the major contracts."
              bodyClassName="min-h-[460px] w-full overflow-hidden"
              titlePopover={
                <div className="space-y-3">
                  {curveDrivers.map((curve) => (
                    <div key={curve.market}>
                      <div className="font-semibold text-energy-ink">{curve.label}</div>
                      <p className="mt-1">{curve.description}</p>
                    </div>
                  ))}
                </div>
              }
            >
              <div className="min-w-0">
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={forwardCurveData} margin={{ top: 12, right: 20, left: 90, bottom: 4 }}>
                    <CartesianGrid stroke="#e6edf3" strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#5f7389" }} />
                    <YAxis tick={{ fontSize: 12, fill: "#5f7389" }} width={60} />
                    <Tooltip />
                    <Legend layout="vertical" align="left" verticalAlign="middle" wrapperStyle={{ left: 0 }} />
                    {PRICE_SERIES.map((series) => (
                      <Line key={series.key} type="monotone" dataKey={series.key} name={series.label} stroke={getSeriesColor(series.key)} strokeWidth={2.5} dot={{ r: 3 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartPanel>
          </section>
        ) : (
          <section className="space-y-6">
            <section className="rounded-3xl border border-energy-border bg-white p-6 shadow-energy">
              <div className="grid gap-4 lg:grid-cols-3">
                <label className="block">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-energy-slate">Timing</div>
                  <select
                    value={opisTiming}
                    onChange={(event) => setOpisTiming(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-energy-border bg-white px-4 py-3 text-sm font-semibold text-energy-ink outline-none transition focus:border-energy-blue"
                  >
                    {(opisData?.filterOptions.timing || []).map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-energy-slate">State</div>
                  <select
                    value={opisState}
                    onChange={(event) => setOpisState(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-energy-border bg-white px-4 py-3 text-sm font-semibold text-energy-ink outline-none transition focus:border-energy-blue"
                  >
                    {(opisData?.filterOptions.states || []).map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-energy-slate">City</div>
                  <select
                    value={pendingOpisCity}
                    onChange={(event) => setPendingOpisCity(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-energy-border bg-white px-4 py-3 text-sm font-semibold text-energy-ink outline-none transition focus:border-energy-blue"
                  >
                    {opisCityOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-5 rounded-2xl border border-energy-border bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-energy-slate">Products</div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPendingOpisProducts(opisProductOptions.map((option) => option.value))}
                      className="rounded-full border border-energy-border bg-white px-3 py-1 text-xs font-semibold text-energy-ink"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingOpisProducts([])}
                      className="rounded-full border border-energy-border bg-white px-3 py-1 text-xs font-semibold text-energy-ink"
                    >
                      Clear all
                    </button>
                  </div>
                </div>
                <div className="mt-3 space-y-4">
                  {opisProductGroups.map(([fuelType, options]) => (
                    <div key={fuelType} className={`rounded-2xl border p-4 ${fuelGroupTone(fuelType)}`}>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-energy-slate">{fuelType}</div>
                      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {options.map((option) => {
                          const checked = pendingOpisProducts.includes(option.value);
                          return (
                            <label key={option.value} className="flex items-start gap-3 rounded-2xl border border-white/70 bg-white/90 px-3 py-3 text-sm text-energy-ink">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setPendingOpisProducts((current) => (
                                    current.includes(option.value)
                                      ? current.filter((item) => item !== option.value)
                                      : [...current, option.value]
                                  ));
                                }}
                                className="mt-1 h-4 w-4 rounded border-energy-border text-energy-blue"
                              />
                              <span>
                                <span className="block font-medium">{option.label}</span>
                                <span className="block text-xs text-energy-slate">{option.count} returned rows</span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-5 rounded-2xl border-2 border-slate-900 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm font-medium text-energy-ink">
                    Apply the selected timing, state, city, and product filters to all OPIS data below.
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAppliedOpisCity(pendingOpisCity);
                      setAppliedOpisProducts([...pendingOpisProducts]);
                      loadOpis({ timing: opisTiming, state: opisState, fuelType: "all" });
                    }}
                    style={{
                      minHeight: "56px",
                      minWidth: "240px",
                      backgroundColor: "#111827",
                      color: "#ffffff",
                      border: "2px solid #111827",
                      borderRadius: "18px",
                      fontSize: "15px",
                      fontWeight: 700,
                      padding: "0 24px",
                      cursor: "pointer",
                      position: "relative",
                      zIndex: 40
                    }}
                  >
                    {opisStatus === "loading" ? "Refreshing..." : "Apply Filters"}
                  </button>
                </div>
              </div>
              <div className="mt-4 text-sm text-energy-slate">
                Source: <span className="font-medium text-energy-ink">OPIS Rack API</span>
                {opisData ? <span> | Last refreshed {formatOpisDateTime(opisData.lastUpdated)}</span> : null}
              </div>
            </section>

            {opisStatus === "loading" && !opisData ? (
              <section className="rounded-3xl border border-energy-border bg-white p-10 text-center text-energy-slate shadow-energy">
                Loading OPIS rack market data...
              </section>
            ) : null}

            {opisStatus === "error" ? (
              <section className="rounded-3xl border border-rose-200 bg-white p-10 text-center shadow-energy">
                <div className="text-lg font-semibold text-energy-ink">OPIS data is unavailable.</div>
                <p className="mt-2 text-sm text-energy-slate">
                  Check that the API was started with `OPIS_USERNAME` and `OPIS_PASSWORD`, then try again.
                </p>
              </section>
            ) : null}

            {opisData ? (
              <>
                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    { label: "Returned Rows", value: opisData.metrics.rowCount.toLocaleString("en-US"), detail: `${opisData.metrics.stateCount} states / ${opisData.metrics.cityCount} cities` },
                    { label: "Average Price", value: formatOpisPrice(opisData.metrics.averagePrice), detail: opisData.metrics.effectiveDate ? formatDateLabel(opisData.metrics.effectiveDate.slice(0, 10)) : "n/a" },
                    { label: "Gasoline Avg", value: formatOpisPrice(opisData.metrics.gasolineAverage), detail: "Selected OPIS market set" },
                    { label: "Diesel Avg", value: formatOpisPrice(opisData.metrics.dieselAverage), detail: `${opisData.coverage.products} subscribed products` }
                  ].map((item) => (
                    <article key={item.label} className="rounded-3xl border border-energy-border bg-white p-5 shadow-energy">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-energy-slate">{item.label}</div>
                      <div className="mt-3 text-3xl font-semibold text-energy-ink">{item.value}</div>
                      <div className="mt-2 text-sm text-energy-slate">{item.detail}</div>
                    </article>
                  ))}
                </section>

                <section className="grid gap-6">
                  <ChartPanel
                    title="Timing Comparison"
                    description="Selected timing averages for the current city and product filter."
                    actions={
                    <div className="flex flex-wrap gap-3">
                        <select
                          value={primaryTiming}
                          onChange={(event) => setPrimaryTiming(event.target.value)}
                          className="rounded-2xl border border-energy-border bg-white px-4 py-2 text-sm font-semibold text-energy-ink outline-none"
                        >
                          {(opisData.filterOptions.timing || []).map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                        <select
                          value={compareTiming}
                          onChange={(event) => setCompareTiming(event.target.value)}
                          className="rounded-2xl border border-energy-border bg-white px-4 py-2 text-sm font-semibold text-energy-ink outline-none"
                        >
                          {(opisData.filterOptions.timing || []).filter((option) => option.value !== primaryTiming).map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                    }
                    bodyClassName="min-h-[380px] w-full overflow-hidden"
                    titlePopover={
                      <div className="space-y-3">
                        {opisFilteredCommentary.summary.map((line) => <p key={line}>{line}</p>)}
                      </div>
                    }
                  >
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={opisTimingChartData} margin={{ top: 12, right: 20, left: 20, bottom: 4 }} barGap={18}>
                        <CartesianGrid stroke="#e6edf3" strokeDasharray="3 3" />
                        <XAxis dataKey="category" tick={{ fontSize: 12, fill: "#5f7389" }} />
                        <YAxis tick={{ fontSize: 12, fill: "#5f7389" }} width={70} />
                        <Tooltip content={<OpisTooltip />} />
                        <Legend />
                        <Bar dataKey="primary" name={(opisData.filterOptions.timing || []).find((option) => option.value === primaryTiming)?.label || primaryTiming} fill="#275df5" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="compare" name={(opisData.filterOptions.timing || []).find((option) => option.value === compareTiming)?.label || compareTiming} fill="#0f8d8d" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartPanel>
                </section>

                <section className="grid gap-6">
                  <div className="rounded-3xl border border-energy-border bg-white p-6 shadow-energy">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-energy-slate">Rack Summary</div>
                      <h3 className="mt-2 text-xl font-semibold text-energy-ink">Live wholesale rack price table</h3>
                    </div>
                    <div className="mt-4 overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="border-b border-energy-border text-left text-[11px] uppercase tracking-[0.14em] text-energy-slate">
                            <th className="pb-3 pr-4">Market</th>
                            <th className="pb-3 pr-4">Product</th>
                            <th className="pb-3 pr-4">Fuel</th>
                            <th className="pb-3 pr-4">Price</th>
                            <th className="pb-3 pr-4">Type</th>
                            <th className="pb-3 pr-4">Timing</th>
                            <th className="pb-3">Effective</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredOpisRows.map((row) => (
                            <tr key={`${row.cityId}-${row.productId}-${row.branded}-${row.grossNet}`} className="border-b border-slate-100 align-top">
                              <td className="py-3 pr-4">
                                <div className="font-semibold text-energy-ink">{row.cityName}, {row.stateAbbr}</div>
                                <div className="text-energy-slate">{row.countryName}</div>
                              </td>
                              <td className="py-3 pr-4 text-energy-ink">{row.productName}</td>
                              <td className="py-3 pr-4 text-energy-slate">{row.fuelType}</td>
                              <td className="py-3 pr-4 font-semibold text-energy-ink">{formatOpisPrice(row.price, row.currencyUnit)}</td>
                              <td className="py-3 pr-4 text-energy-slate">{row.grossNet} / {row.branded}</td>
                              <td className="py-3 pr-4 text-energy-slate">{row.benchmarkTimingType}</td>
                              <td className="py-3 text-energy-slate">{formatDateLabel(row.effectiveDate.slice(0, 10))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-2">
                    <section className="rounded-3xl border border-energy-border bg-white p-6 shadow-energy">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-energy-slate">What This Feed Covers</div>
                      <div className="mt-4 space-y-3 text-sm leading-6 text-energy-ink">
                        {opisData.notes.map((note) => (
                          <div key={note} className="flex gap-3">
                            <span className="mt-2 h-2 w-2 rounded-full bg-energy-blue" />
                            <span>{note}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                    <section className="rounded-3xl border border-energy-border bg-white p-6 shadow-energy">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-energy-slate">OPIS Commentary</div>
                      <div className="mt-4 space-y-3 text-sm leading-6 text-energy-ink">
                        {opisFilteredCommentary.summary.map((line) => (
                          <div key={line} className="flex gap-3">
                            <span className="mt-2 h-2 w-2 rounded-full bg-energy-blue" />
                            <span>{line}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                    <section className="rounded-3xl border border-energy-border bg-white p-6 shadow-energy">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-energy-slate">Market Read</div>
                      <div className="mt-4 space-y-3 text-sm leading-6 text-energy-ink">
                        {opisFilteredCommentary.outlook.map((line) => <p key={line}>{line}</p>)}
                      </div>
                    </section>
                    <OpisHighlightList title="Lowest Returned Markets" rows={opisLowestRows} />
                    <OpisHighlightList title="Highest Returned Markets" rows={opisHighestRows} />
                  </div>
                </section>
              </>
            ) : null}
          </section>
        )}
      </div>
    </div>
  );
}
