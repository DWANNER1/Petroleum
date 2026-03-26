import { useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import {
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

type PricingFormulaId = "regular" | "premium" | "diesel";

type PricingFormulaComponent = {
  key: string;
  label: string;
  inputValue: number | null;
  multiplier: number;
  notes: string;
  fallbackTo?: string;
  marketDriven?: boolean;
};

type PricingFormulaTemplate = {
  id: PricingFormulaId;
  label: string;
  totalLabel: string;
  productMatcher: RegExp;
  components: PricingFormulaComponent[];
};

type SitePricingConfig = {
  pricingKey: string;
  formulaId: string;
  fuelType?: string;
  productName: string;
  marketLabel: string;
  config: Record<string, { inputValue?: string; multiplier?: string }>;
  updatedAt?: string;
  updatedBy?: string;
};

const PRICING_FORMULA_TEMPLATES: PricingFormulaTemplate[] = [
  {
    id: "regular",
    label: "Regular Formula",
    totalLabel: "Regular Estimated Price",
    productMatcher: /regular|reg|87|carbob/i,
    components: [
      { key: "carbob", label: "CARBOB Spot Price (USD/gal)", inputValue: 2.8781, multiplier: 0.9, notes: "Pulled from OPIS market table", marketDriven: true },
      { key: "ethanol", label: "Ethanol Spot Price (USD/gal)", inputValue: 2.03, multiplier: 0.1, notes: "Pulled from OPIS market table when available", marketDriven: true },
      { key: "rin", label: "RIN Price (USD/gal)", inputValue: 1.075, multiplier: -0.09, notes: "Pulled from OPIS market table when available", marketDriven: true },
      { key: "terminal_adder", label: "Terminal Adder (USD/gal)", inputValue: 0.01, multiplier: 1, notes: "Editable adder" },
      { key: "lcfs", label: "LCFS (USD/gal)", inputValue: 0.16785, multiplier: 1, notes: "Editable variable" },
      { key: "ghg_term_c", label: "GHG - Term C (Preferred, USD/gal)", inputValue: 0.2211, multiplier: 1, notes: "Editable variable" },
      { key: "ghg_term_d", label: "GHG - Term D (Fallback, USD/gal)", inputValue: null, multiplier: 1, notes: "Editable fallback if Term C is blank", fallbackTo: "ghg_term_c" }
    ]
  },
  {
    id: "premium",
    label: "Premium Formula",
    totalLabel: "Premium Estimated Price",
    productMatcher: /premium|prem|91|93/i,
    components: [
      { key: "carbob", label: "CARBOB Spot Price (USD/gal)", inputValue: 3.0781, multiplier: 0.9, notes: "Pulled from OPIS market table", marketDriven: true },
      { key: "ethanol", label: "Ethanol Spot Price (USD/gal)", inputValue: 2.03, multiplier: 0.1, notes: "Pulled from OPIS market table when available", marketDriven: true },
      { key: "rin", label: "RIN Price (USD/gal)", inputValue: 1.075, multiplier: -0.09, notes: "Pulled from OPIS market table when available", marketDriven: true },
      { key: "terminal_adder", label: "Terminal Adder (USD/gal)", inputValue: 0.01, multiplier: 1, notes: "Editable adder" },
      { key: "lcfs", label: "LCFS (USD/gal)", inputValue: 0.16785, multiplier: 1, notes: "Editable variable" },
      { key: "ghg_term_c", label: "GHG - Term C (Preferred, USD/gal)", inputValue: 0.2204, multiplier: 1, notes: "Editable variable" },
      { key: "ghg_term_d", label: "GHG - Term D (Fallback, USD/gal)", inputValue: null, multiplier: 1, notes: "Editable fallback if Term C is blank", fallbackTo: "ghg_term_c" }
    ]
  },
  {
    id: "diesel",
    label: "Diesel Formula",
    totalLabel: "Diesel Estimated Price",
    productMatcher: /diesel|dsl|ulsd|carb/i,
    components: [
      { key: "spot", label: "Spot Price (USD/gal)", inputValue: 2.7561, multiplier: 1, notes: "Pulled from OPIS market table", marketDriven: true },
      { key: "ethanol", label: "Ethanol Spot Price (USD/gal)", inputValue: 2.03, multiplier: 0.1, notes: "Pulled from OPIS market table when available", marketDriven: true },
      { key: "rin", label: "RIN Price (USD/gal)", inputValue: 1.075, multiplier: 0, notes: "Pulled from OPIS market table when available", marketDriven: true },
      { key: "terminal_adder", label: "Terminal Adder (USD/gal)", inputValue: 0.012, multiplier: 1, notes: "Editable adder" },
      { key: "lcfs", label: "LCFS (USD/gal)", inputValue: 0.16785, multiplier: 1, notes: "Editable variable" },
      { key: "ghg_term_c", label: "GHG - Term C (Preferred, USD/gal)", inputValue: 0.2809, multiplier: 1, notes: "Editable variable" },
      { key: "ghg_term_d", label: "GHG - Term D (Fallback, USD/gal)", inputValue: null, multiplier: 1, notes: "Editable fallback if Term C is blank", fallbackTo: "ghg_term_c" }
    ]
  }
];

const PRICING_FORMULA_TEMPLATE_BY_ID = new Map(PRICING_FORMULA_TEMPLATES.map((template) => [template.id, template]));

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

function averageOpisRows(rows: OpisSummaryRow[], fuelType?: string) {
  const filtered = fuelType ? rows.filter((row) => row.fuelType === fuelType) : rows;
  if (!filtered.length) return null;
  return filtered.reduce((sum, row) => sum + row.price, 0) / filtered.length;
}

function filterOpisRows(rows: OpisSummaryRow[], state: string, city: string) {
  return rows.filter((row) => {
    const stateMatch = state === "ALL" || row.stateAbbr === state;
    const cityLabel = `${row.cityName}, ${row.stateAbbr}`;
    const cityMatch = city === "ALL" || cityLabel === city;
    return stateMatch && cityMatch;
  });
}

function fuelCardTone(label: string) {
  if (/diesel/i.test(label)) return "border-rose-200 bg-rose-50";
  if (/gasoline|premium|midgrade|regular/i.test(label)) return "border-amber-200 bg-amber-50";
  if (/crude|brent|wti/i.test(label)) return "border-blue-200 bg-blue-50";
  if (/stocks/i.test(label)) return "border-slate-200 bg-slate-50";
  return "border-energy-border bg-white";
}

function formatOpisChange(value: number | null) {
  if (value == null) return "n/a";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)} USCPG`;
}

function resolveFormulaId(productName: string): PricingFormulaId | null {
  const match = PRICING_FORMULA_TEMPLATES.find((template) => template.productMatcher.test(productName));
  return match?.id || null;
}

function formatCurrencyPerGallon(value: number | null) {
  if (value == null || Number.isNaN(value)) return "n/a";
  return `$${value.toFixed(4)}`;
}

function computeFormulaTotal(
  components: Array<PricingFormulaComponent & { inputValue: number | null; multiplier: number }>
) {
  const componentMap = new Map(components.map((component) => [component.key, component]));
  return components.reduce((sum, component) => {
    if (component.fallbackTo) {
      const primary = componentMap.get(component.fallbackTo);
      if (primary?.inputValue != null) return sum;
    }
    return sum + ((component.inputValue ?? 0) * component.multiplier);
  }, 0);
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
  const [opisCity, setOpisCity] = useState("ALL");
  const [pricingFormulaInputs, setPricingFormulaInputs] = useState<Record<string, { inputValue: string; multiplier: string }>>({});
  const [selectedPricingRowKey, setSelectedPricingRowKey] = useState<string | null>(null);
  const [currentJobber, setCurrentJobber] = useState<{ id: string; name: string; slug?: string } | null>(null);
  const [jobberPricingConfigs, setJobberPricingConfigs] = useState<Record<string, SitePricingConfig>>({});
  const [pricingSaveStatus, setPricingSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

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

  useEffect(() => {
    let cancelled = false;
    async function loadJobberPricingConfigs() {
      try {
        const [jobber, configs] = await Promise.all([
          api.getCurrentJobber(),
          api.getJobberPricingConfigs()
        ]);
        if (cancelled) return;
        setCurrentJobber(jobber);
        const nextConfigs = Object.fromEntries(configs.map((item) => [item.pricingKey, item]));
        setJobberPricingConfigs(nextConfigs);
      } catch (_error) {
        if (!cancelled) {
          setCurrentJobber(null);
          setJobberPricingConfigs({});
        }
      }
    }
    setPricingFormulaInputs({});
    setPricingSaveStatus("idle");
    loadJobberPricingConfigs();
    return () => {
      cancelled = true;
    };
  }, []);

  const opisCityOptions = useMemo(() => {
    if (!opisData) return [];
    const stateScopedRows = opisData.rows.filter((row) => opisState === "ALL" || row.stateAbbr === opisState);
    return [
      { value: "ALL", label: "All Cities" },
      ...[...new Map(stateScopedRows.map((row) => [`${row.cityName}, ${row.stateAbbr}`, { value: `${row.cityName}, ${row.stateAbbr}`, label: `${row.cityName}, ${row.stateAbbr}` }])).values()]
        .sort((a, b) => a.label.localeCompare(b.label))
    ];
  }, [opisData, opisState]);

  useEffect(() => {
    setOpisCity("ALL");
  }, [opisState]);

  const filteredOpisRows = useMemo(() => {
    if (!opisData) return [];
    return filterOpisRows(opisData.rows, opisState, opisCity);
  }, [opisData, opisState, opisCity]);

  const opisComparisonSnapshot = useMemo(
    () => opisData?.timingSnapshots.find((snapshot) => snapshot.timing !== opisData.appliedFilters.timing) || null,
    [opisData]
  );

  const opisTableRows = useMemo(() => {
    if (!opisData) return [];
    const comparisonRows = opisComparisonSnapshot
      ? filterOpisRows(opisComparisonSnapshot.rows, opisState, opisCity)
      : [];
    const comparisonByProduct = new Map<string, OpisSummaryRow[]>();
    comparisonRows.forEach((row) => {
      const key = `${row.cityName}, ${row.stateAbbr}__${row.productName}`;
      if (!comparisonByProduct.has(key)) comparisonByProduct.set(key, []);
      comparisonByProduct.get(key)?.push(row);
    });

    const grouped = new Map<string, OpisSummaryRow[]>();
    filteredOpisRows.forEach((row) => {
      const key = `${row.cityName}, ${row.stateAbbr}__${row.productName}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)?.push(row);
    });

    return [...grouped.entries()]
      .map(([groupKey, rows]) => {
        const prices = rows.map((row) => row.price);
        const averagePrice = averageOpisRows(rows);
        const comparisonAverage = averageOpisRows(comparisonByProduct.get(groupKey) || []);
        const sample = rows[0];
        const productName = sample.productName;
        const formulaId = resolveFormulaId(productName);
        const pricingKey = `${sample.cityName}, ${sample.stateAbbr}__${formulaId || sample.fuelType}`;
        const rowKey = `${sample.cityName}, ${sample.stateAbbr}__${productName}`;
        return {
          key: rowKey,
          pricingKey,
          productName,
          fuelType: sample.fuelType,
          marketLabel: `${sample.cityName}, ${sample.stateAbbr}`,
          formulaId,
          formulaLabel: formulaId ? (PRICING_FORMULA_TEMPLATE_BY_ID.get(formulaId)?.label || "Custom") : "Custom",
          low: Math.min(...prices),
          high: Math.max(...prices),
          average: averagePrice,
          change: averagePrice != null && comparisonAverage != null ? averagePrice - comparisonAverage : null,
          estimatedPrice: null
        };
      })
      .sort((a, b) => a.marketLabel.localeCompare(b.marketLabel) || a.productName.localeCompare(b.productName));
  }, [opisData, opisComparisonSnapshot, filteredOpisRows, opisState, opisCity]);

  const pricingCards = useMemo(() => {
    return opisTableRows.flatMap((row) => {
      if (!row.formulaId || row.average == null) return [];
      const template = PRICING_FORMULA_TEMPLATE_BY_ID.get(row.formulaId);
      if (!template) return [];
      const marketSpot = row.average / 100;
      const savedConfig = jobberPricingConfigs[row.pricingKey]?.config || {};
      const components = template.components.map((component) => {
        const stateKey = `${row.key}:${component.key}`;
        const override = pricingFormulaInputs[stateKey] || savedConfig[component.key] || {};
        const rawInput = component.marketDriven ? marketSpot : (override?.inputValue ?? component.inputValue ?? "");
        const inputValue = rawInput === "" || rawInput == null ? null : Number(rawInput);
        const multiplier = Number(override?.multiplier ?? component.multiplier);
        return {
          ...component,
          inputValue: Number.isFinite(inputValue) ? inputValue : null,
          multiplier: Number.isFinite(multiplier) ? multiplier : component.multiplier,
          stateKey
        };
      });

      return [{
        ...row,
        totalLabel: template.totalLabel,
        components,
        marketSpot,
        estimatedPrice: computeFormulaTotal(components)
      }];
    });
  }, [opisTableRows, pricingFormulaInputs, jobberPricingConfigs]);

  const pricingCardByRowKey = useMemo(
    () => new Map(pricingCards.map((card) => [card.key, card])),
    [pricingCards]
  );

  const opisDisplayRows = useMemo(
    () => opisTableRows.map((row) => ({
      ...row,
      estimatedPrice: pricingCardByRowKey.get(row.key)?.estimatedPrice ?? row.estimatedPrice
    })),
    [opisTableRows, pricingCardByRowKey]
  );

  useEffect(() => {
    if (!pricingCards.length) {
      setSelectedPricingRowKey(null);
      return;
    }
    if (!selectedPricingRowKey || !pricingCardByRowKey.has(selectedPricingRowKey)) {
      setSelectedPricingRowKey(pricingCards[0].key);
    }
  }, [pricingCards, pricingCardByRowKey, selectedPricingRowKey]);

  const selectedPricingCard = selectedPricingRowKey ? pricingCardByRowKey.get(selectedPricingRowKey) ?? null : null;
  const selectedSavedConfig = selectedPricingCard ? jobberPricingConfigs[selectedPricingCard.pricingKey]?.config || {} : {};
  const selectedPricingDirty = !!selectedPricingCard && selectedPricingCard.components.some((component) => {
    const saved = selectedSavedConfig[component.key] || {};
    const defaultInput = component.inputValue == null ? "" : String(component.inputValue);
    const defaultMultiplier = String(component.multiplier);
    const current = pricingFormulaInputs[component.stateKey];
    if (!current) return false;
    const baselineInput = saved.inputValue ?? (component.marketDriven ? defaultInput : (component.inputValue == null ? "" : String(PRICING_FORMULA_TEMPLATE_BY_ID.get(selectedPricingCard.formulaId)?.components.find((item) => item.key === component.key)?.inputValue ?? "")));
    const baselineMultiplier = saved.multiplier ?? defaultMultiplier;
    return current.inputValue !== baselineInput || current.multiplier !== baselineMultiplier;
  });

  async function saveSelectedPricingCard() {
    if (!selectedPricingCard) return;
    setPricingSaveStatus("saving");
    try {
      const config = Object.fromEntries(selectedPricingCard.components.map((component) => {
        const current = pricingFormulaInputs[component.stateKey];
        return [
          component.key,
          {
            inputValue: component.marketDriven ? (component.inputValue == null ? "" : String(component.inputValue)) : (current?.inputValue ?? (component.inputValue == null ? "" : String(component.inputValue))),
            multiplier: current?.multiplier ?? String(component.multiplier)
          }
        ];
      }));
      const saved = await api.saveJobberPricingConfig({
        pricingKey: selectedPricingCard.pricingKey,
        formulaId: selectedPricingCard.formulaId,
        fuelType: selectedPricingCard.fuelType,
        productName: selectedPricingCard.productName,
        marketLabel: selectedPricingCard.marketLabel,
        config
      });
      setJobberPricingConfigs((current) => ({
        ...current,
        [saved.pricingKey]: saved
      }));
      setPricingFormulaInputs((current) => {
        const next = { ...current };
        selectedPricingCard.components.forEach((component) => {
          delete next[component.stateKey];
        });
        return next;
      });
      setPricingSaveStatus("saved");
    } catch (_error) {
      setPricingSaveStatus("error");
    }
  }

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
              <div className="rounded-3xl border border-energy-border bg-slate-50 p-5">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-energy-slate">OPIS Market Monitor</div>
                    <h3 className="mt-2 text-2xl font-semibold text-energy-ink">Build a city market view</h3>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-energy-slate">
                      Choose the state and city, then refresh the rack feed to rebuild the wholesale product table below.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => loadOpis({ timing: opisTiming, state: opisState, fuelType: "all" })}
                    className="rounded-full border border-energy-border bg-white px-5 py-3 text-sm font-semibold text-energy-ink transition hover:border-energy-blue hover:text-energy-blue disabled:cursor-wait disabled:opacity-70"
                    disabled={opisStatus === "loading"}
                  >
                    {opisStatus === "loading" ? "Refreshing..." : "Refresh"}
                  </button>
                </div>
                <div className="mt-6 grid gap-4 md:grid-cols-2">
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
                      value={opisCity}
                      onChange={(event) => setOpisCity(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-energy-border bg-white px-4 py-3 text-sm font-semibold text-energy-ink outline-none transition focus:border-energy-blue"
                    >
                      {opisCityOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
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
                  Save OPIS credentials for the current jobber in Admin, or start the API with `OPIS_USERNAME` and `OPIS_PASSWORD`, then try again.
                </p>
              </section>
            ) : null}

            {opisData ? (
              <>
                <section className="rounded-3xl border border-energy-border bg-white p-6 shadow-energy">
                <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-energy-slate">Market Fuel And Prices</div>
                    <h3 className="mt-2 text-xl font-semibold text-energy-ink">
                      {opisCity === "ALL" ? (opisState === "ALL" ? "All returned markets" : `All cities in ${opisState}`) : opisCity}
                    </h3>
                    <p className="mt-2 text-sm text-energy-slate">
                      Products are grouped into a market table with low, high, average, and change versus{" "}
                      <span className="font-medium text-energy-ink">
                        {opisComparisonSnapshot?.label || "the comparison timing"}
                      </span>.
                    </p>
                  </div>
                  <div className="text-sm text-energy-slate">
                    Current timing: <span className="font-medium text-energy-ink">{(opisData.filterOptions.timing || []).find((option) => option.value === opisData.appliedFilters.timing)?.label || opisData.appliedFilters.timing}</span>
                  </div>
                </div>
                {opisDisplayRows.length ? (
                  <div className="mt-6 overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-energy-border text-left text-[11px] uppercase tracking-[0.14em] text-energy-slate">
                          <th className="pb-3 pr-4">Market Fuel</th>
                          <th className="pb-3 pr-4">Market</th>
                          <th className="pb-3 pr-4">Formula</th>
                          <th className="pb-3 pr-4">Low</th>
                          <th className="pb-3 pr-4">High</th>
                          <th className="pb-3 pr-4">Avg</th>
                          <th className="pb-3 pr-4">Spot USD/gal</th>
                          <th className="pb-3 pr-4">Change</th>
                          <th className="pb-3">Est. Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {opisDisplayRows.map((row) => (
                          <tr key={`${row.marketLabel}-${row.productName}`} className="border-b border-slate-100 align-top">
                            <td className="py-4 pr-4">
                              <div className="font-semibold text-energy-ink">{row.productName}</div>
                              <div className="text-energy-slate">{row.fuelType}</div>
                            </td>
                            <td className="py-4 pr-4 text-energy-slate">{row.marketLabel}</td>
                            <td className="py-4 pr-4 text-energy-slate">{row.formulaLabel}</td>
                            <td className="py-4 pr-4 font-medium text-energy-ink">{formatOpisPrice(row.low)}</td>
                            <td className="py-4 pr-4 font-medium text-energy-ink">{formatOpisPrice(row.high)}</td>
                            <td className="py-4 pr-4 font-semibold text-energy-ink">{formatOpisPrice(row.average)}</td>
                            <td className="py-4 pr-4 font-semibold text-energy-ink">{formatCurrencyPerGallon(row.average != null ? row.average / 100 : null)}</td>
                            <td className={`py-4 pr-4 font-semibold ${row.change == null ? "text-energy-slate" : row.change >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                              {formatOpisChange(row.change)}
                            </td>
                            <td className="py-4 font-semibold text-energy-ink">
                              <button
                                type="button"
                                onClick={() => setSelectedPricingRowKey(row.key)}
                                className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                                  selectedPricingRowKey === row.key
                                    ? "bg-indigo-100 text-indigo-700"
                                    : "border border-energy-border bg-white text-energy-ink hover:border-energy-blue hover:text-energy-blue"
                                }`}
                              >
                                {formatCurrencyPerGallon(row.estimatedPrice)}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="mt-6 rounded-2xl border border-dashed border-energy-border bg-slate-50 p-8 text-center text-sm text-energy-slate">
                    No OPIS market rows matched the current state and city selection.
                  </div>
                )}
                </section>

                <section className="rounded-3xl border border-energy-border bg-white p-5 shadow-energy">
                {selectedPricingCard ? (
                  <div className="min-w-0">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div className="space-y-2">
                        <div className="text-base font-semibold text-energy-ink">{selectedPricingCard.productName}</div>
                        <div className="text-sm text-energy-slate">{selectedPricingCard.marketLabel}</div>
                        <div className="text-sm text-energy-slate">
                          Market conversion: <span className="font-medium text-energy-ink">{`${(selectedPricingCard.marketSpot * 100).toFixed(2)} USCPG / 100 = ${formatCurrencyPerGallon(selectedPricingCard.marketSpot)}`}</span>
                        </div>
                        <div className="text-sm text-energy-slate">
                          Saving for: <span className="font-medium text-energy-ink">{currentJobber?.name || "Current jobber"}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-energy-slate">{selectedPricingCard.totalLabel}</div>
                        <div className="mt-2 text-2xl font-semibold text-energy-ink">{formatCurrencyPerGallon(selectedPricingCard.estimatedPrice)}</div>
                        <div className={`mt-2 text-sm ${pricingSaveStatus === "error" ? "text-rose-600" : "text-energy-slate"}`}>
                          {pricingSaveStatus === "saved" ? "Saved for current jobber." : pricingSaveStatus === "error" ? "Save failed." : selectedPricingDirty ? "Unsaved changes." : "Saved values loaded."}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="border-b border-energy-border text-left text-[11px] uppercase tracking-[0.14em] text-energy-slate">
                            <th className="pb-3 pr-4">Component</th>
                            <th className="pb-3 pr-4">Input</th>
                            <th className="pb-3 pr-4">Multiplier</th>
                            <th className="pb-3 pr-4">Value</th>
                            <th className="pb-3">Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedPricingCard.components.map((component) => {
                            const componentKey = component.stateKey;
                            const primaryComponent = component.fallbackTo
                              ? selectedPricingCard.components.find((item) => item.key === component.fallbackTo)
                              : null;
                            const contribution = component.fallbackTo && primaryComponent?.inputValue != null
                              ? null
                              : (component.inputValue ?? 0) * component.multiplier;
                            const savedComponentConfig = selectedSavedConfig[component.key] || {};
                            const inputFieldValue = pricingFormulaInputs[componentKey]?.inputValue
                              ?? savedComponentConfig.inputValue
                              ?? (component.inputValue == null ? "" : String(component.inputValue));
                            const multiplierFieldValue = pricingFormulaInputs[componentKey]?.multiplier
                              ?? savedComponentConfig.multiplier
                              ?? String(component.multiplier);
                            return (
                              <tr key={componentKey} className="border-b border-slate-100 align-top">
                                <td className="py-3 pr-4">
                                  <div className="font-medium text-energy-ink">{component.label}</div>
                                </td>
                                <td className="py-3 pr-4">
                                  {component.marketDriven ? (
                                    <div className="w-28 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-energy-ink">
                                      {formatCurrencyPerGallon(component.inputValue)}
                                    </div>
                                  ) : (
                                    <input
                                      type="number"
                                      step="0.0001"
                                      value={inputFieldValue}
                                      onChange={(event) => {
                                        const nextValue = event.target.value;
                                        setPricingSaveStatus("idle");
                                        setPricingFormulaInputs((current) => ({
                                          ...current,
                                          [componentKey]: {
                                            inputValue: nextValue,
                                            multiplier: current[componentKey]?.multiplier ?? String(component.multiplier)
                                          }
                                        }));
                                      }}
                                      className="w-28 rounded-xl border border-energy-border bg-white px-3 py-2 text-sm font-semibold text-energy-ink outline-none transition focus:border-energy-blue"
                                    />
                                  )}
                                </td>
                                <td className="py-3 pr-4">
                                  <input
                                    type="number"
                                    step="0.0001"
                                    value={multiplierFieldValue}
                                    onChange={(event) => {
                                      const nextValue = event.target.value;
                                      setPricingSaveStatus("idle");
                                      setPricingFormulaInputs((current) => ({
                                        ...current,
                                        [componentKey]: {
                                          inputValue: current[componentKey]?.inputValue ?? (component.inputValue == null ? "" : String(component.inputValue)),
                                          multiplier: nextValue
                                        }
                                      }));
                                    }}
                                    className="w-24 rounded-xl border border-energy-border bg-white px-3 py-2 text-sm font-semibold text-energy-ink outline-none transition focus:border-energy-blue"
                                  />
                                </td>
                                <td className="py-3 pr-4 font-semibold text-energy-ink">
                                  {contribution == null ? "Using Term C" : formatCurrencyPerGallon(contribution)}
                                </td>
                                <td className="py-3 text-energy-slate">{component.notes}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-6 flex justify-end">
                      <button
                        type="button"
                        onClick={saveSelectedPricingCard}
                        disabled={pricingSaveStatus === "saving"}
                        className="rounded-2xl border border-slate-900 bg-gradient-to-b from-white via-slate-100 to-slate-300 px-6 py-3 text-sm font-semibold text-slate-950 shadow-[0_6px_0_rgba(15,23,42,0.35)] transition active:translate-y-[2px] active:shadow-[0_3px_0_rgba(15,23,42,0.35)] disabled:cursor-wait disabled:opacity-70"
                      >
                        {pricingSaveStatus === "saving" ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-energy-border bg-slate-50 p-8 text-center text-sm text-energy-slate">
                    Click an estimated price in the market table to open its editable pricing breakdown.
                  </div>
                )}
                </section>
              </>
            ) : null}
          </section>
        )}
      </div>
    </div>
  );
}
