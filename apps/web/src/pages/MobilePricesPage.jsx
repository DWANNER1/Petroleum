import { useEffect, useMemo, useState } from "react";
import { api } from "../api";

const PRODUCT_FAMILIES = ["regular", "mid", "premium", "diesel"];
const VISIBLE_PRODUCT_FAMILIES = ["regular", "premium", "diesel"];
const PROFILE_RULE_FIELDS = ["distributionLabel", "gasPrepay", "dieselPrepay", "storageFee", "gasFedExcise", "gasStateExcise", "dieselFedExcise", "dieselStateExcise", "gasSalesTaxRate", "dieselSalesTaxRate", "gasRetailMargin", "dieselRetailMargin"];
const MOBILE_SECTIONS = ["run", "preview", "results", "source"];

function formatMoney(value) {
  return value == null || Number.isNaN(Number(value)) ? "n/a" : `$${Number(value).toFixed(4)}`;
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString() : "n/a";
}
function formatPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "n/a";
  const percent = numeric <= 1 ? numeric * 100 : numeric;
  return `${percent.toFixed(percent % 1 === 0 ? 0 : percent < 10 ? 3 : 2)}%`;
}

function localDateInputValue(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

function productFamilyLabel(value) {
  if (value === "regular") return "REG 87";
  if (value === "premium") return "PRE 91";
  if (value === "diesel") return "Diesel";
  if (value === "mid") return "MID 89";
  return value;
}

function traceAmount(item) {
  return item.contribution != null ? formatMoney(item.contribution) : item.value != null ? formatMoney(item.value) : "n/a";
}

function basisTraceItem(output) {
  return (output.trace || []).find((item) => Number.isFinite(item?.spotValue) || Number.isFinite(item?.rackValue)) || null;
}

function derivedBasisTotals(output) {
  if (output?.basisComparison) {
    return {
      spotTotal: output.basisComparison.spotTotal,
      rackTotal: output.basisComparison.rackTotal,
      difference: output.basisComparison.difference
    };
  }
  const basis = basisTraceItem(output);
  if (!basis || !Number.isFinite(output?.totalPrice) || !Number.isFinite(basis.rawValue)) return null;
  const current = Number(output.totalPrice);
  const selectedBasis = Number(basis.rawValue);
  const spotTotal = Number.isFinite(basis.spotValue) ? Number((current - selectedBasis + Number(basis.spotValue)).toFixed(4)) : null;
  const rackTotal = Number.isFinite(basis.rackValue) ? Number((current - selectedBasis + Number(basis.rackValue)).toFixed(4)) : null;
  const difference = spotTotal != null && rackTotal != null ? Number((spotTotal - rackTotal).toFixed(4)) : null;
  return { spotTotal, rackTotal, difference };
}
function defaultTraceMode(output) {
  const recommendation = String(basisTraceItem(output)?.recommendation || "").trim().toLowerCase();
  return recommendation === "spot" ? "spot" : "rack";
}
function traceAmountForMode(item, mode) {
  if ((mode === "spot" || mode === "rack") && Number.isFinite(item?.spotValue) && Number.isFinite(item?.rackValue)) {
    return formatMoney(mode === "spot" ? item.spotValue : item.rackValue);
  }
  return traceAmount(item);
}
function traceDetailForMode(item, mode) {
  if ((mode === "spot" || mode === "rack") && (Number.isFinite(item?.spotValue) || Number.isFinite(item?.rackValue))) {
    const chosen = mode === "spot" ? item.spotValue : item.rackValue;
    const alternate = mode === "spot" ? item.rackValue : item.spotValue;
    const chosenLabel = mode === "spot" ? "Spot" : "Rack";
    const alternateLabel = mode === "spot" ? "Rack" : "Spot";
    return `${item.detail} | Using ${chosenLabel} ${formatMoney(chosen)}${Number.isFinite(alternate) ? ` | ${alternateLabel} ${formatMoney(alternate)}` : ""}`;
  }
  return item.detail;
}
function traceModeSummary(output, mode) {
  const basis = basisTraceItem(output);
  const derived = derivedBasisTotals(output);
  if (!basis || (mode !== "spot" && mode !== "rack")) return "";
  const derivedTotal = mode === "spot" ? derived?.spotTotal : derived?.rackTotal;
  const chosenBasis = mode === "spot" ? basis.spotValue : basis.rackValue;
  const profileTarget = basis.terminalKey || basis.marketKey || "selected profile";
  return `${mode === "spot" ? "Derived Spot" : "Derived Rack"} recalculates the finished price with a ${mode} basis of ${formatMoney(chosenBasis)} for a total of ${formatMoney(derivedTotal)} using ${profileTarget}.`;
}
function formatBasisObserved(output, mode) {
  const comparison = output?.basisComparison || {};
  const observedAt = mode === "spot" ? comparison.spotObservedAt : comparison.rackObservedAt;
  const timing = mode === "spot" ? comparison.spotTimingLabel : comparison.rackTimingLabel;
  const city = mode === "spot" ? comparison.spotSourceCity : comparison.rackSourceCity;
  const supplier = mode === "spot" ? comparison.spotSourceSupplier : comparison.rackSourceSupplier;
  const pieces = [timing, city, supplier, observedAt ? formatDateTime(observedAt) : ""].filter(Boolean);
  return pieces.join(" | ");
}
function spotProductCodeForFamily(family) {
  if (family === "regular") return "O1007NR";
  if (family === "premium") return "O1007NW";
  if (family === "diesel") return "O1007G4";
  return "";
}
function spotMarketReferenceForFamily(family) {
  if (family === "regular") return "San Francisco CARB RFG Regular Average";
  if (family === "premium") return "San Francisco CARB RFG Premium Average";
  if (family === "diesel") return "San Francisco CARB Diesel Average";
  return "OPIS market average";
}
function basisValidationLines(output, mode) {
  const basis = basisTraceItem(output);
  const comparison = output?.basisComparison || {};
  const family = output?.productFamily || "";
  if (!basis || (mode !== "spot" && mode !== "rack")) return [];
  if (mode === "spot") {
    const code = spotProductCodeForFamily(family);
    const endpoint = comparison.spotSourceEndpoint || "GET /api/SpotValues";
    const sourceMode = comparison.spotSourceMode === "intraday"
      ? "Intraday spot"
      : comparison.spotSourceMode === "latest_prompt_average"
        ? "Latest published prompt average"
        : "Spot price";
    return [
      `Source API: OPIS Spot API -> ${endpoint}`,
      `Selection rule: ${sourceMode} for ${productFamilyLabel(family)}`,
      `Report match line: ${spotMarketReferenceForFamily(family)}`,
      `Product code: ${code || "n/a"}`,
      `Market: ${comparison.spotSourceCity || "San Francisco"}`,
      `Timing label: ${comparison.spotTimingLabel || "Latest Spot"}`,
      `Published date: ${comparison.spotPublishedDate ? formatDateTime(comparison.spotPublishedDate) : "n/a"}`,
      `Fetched at: ${comparison.spotFetchedAt ? formatDateTime(comparison.spotFetchedAt) : "n/a"}`,
      `Validation keys: market line, product code, and published date should all match the OPIS spot report`
    ];
  }
  return [
    `Source API: OPIS Rack API -> GET /Summary`,
    `Selection rule: first available unbranded net average after 6:00 AM ET`,
    `Market: ${comparison.rackSourceCity || "n/a"}`,
    `Supplier: ${comparison.rackSourceSupplier || "n/a"}`,
    `Timing label: ${comparison.rackTimingLabel || "n/a"}`,
    `Published date: ${comparison.rackPublishedDate ? formatDateTime(comparison.rackPublishedDate) : "n/a"}`,
    `Fetched at: ${comparison.rackFetchedAt ? formatDateTime(comparison.rackFetchedAt) : "n/a"}`,
    `Invoice match keys: supplier, terminal/market, product family, and BOL/report date should line up with the supplier invoice`
  ];
}

function traceLabel(item) {
  const label = item.label || item.kind || item.componentKey;
  if (label === "Lowest Rack") return "Lowest Rack Input";
  if (label === "Lowest of Day Basis" || label === "Spot or Rack") return "Spot or Rack";
  if (item.kind === "active_taxes") return "Taxes Applied";
  return label;
}
function traceLabelForMode(item, mode) {
  const label = traceLabel(item);
  if (label === "Spot or Rack") {
    return mode === "spot" ? "Spot Basis" : mode === "rack" ? "Rack Basis" : label;
  }
  return label;
}
function traceIndentLevel(item, mode) {
  const label = traceLabelForMode(item, mode);
  if (/prepay/i.test(label)) return 1;
  if (/(federal|fed excise|state excise|sales tax amt|sales tax amount|sales tax rate|storage fee|storage fees|freight)/i.test(label)) return 1;
  return 0;
}
function traceDisplayAmount(item, mode) {
  const label = traceLabelForMode(item, mode);
  if (/sales tax rate/i.test(label)) {
    const value = item.contribution != null ? item.contribution : item.value;
    return formatPercent(value);
  }
  return traceAmountForMode(item, mode);
}
const TRACE_LABELS_TO_HIDE = new Set([
  "Contract Minus",
  "Freight",
  "Rack Margin",
  "Tax",
  "Taxes Applied",
  "Discount",
  "Distribution Terminal",
  "Today's Cost",
  "discount_not_applied"
]);
const TRACE_KINDS_TO_HIDE = new Set(["active_taxes", "discount_not_applied"]);
function filteredTraceItems(output) {
  return (output?.trace || []).filter((item) => {
    const label = traceLabel(item);
    const kind = String(item?.kind || "");
    return !TRACE_LABELS_TO_HIDE.has(label) && !TRACE_KINDS_TO_HIDE.has(kind);
  });
}
function traceSourceText(item) {
  return String(item?.sourcePath || "").trim();
}
function basisCellTone(kind, recommendation) {
  if (kind === "spot") return "price-tables-tone-spot";
  if (kind === "rack") return "price-tables-tone-rack";
  if (kind === "winner") return recommendation === "spot" ? "price-tables-tone-spot" : recommendation === "rack" ? "price-tables-tone-rack" : "";
  return "";
}

function sourceValueMatchesTerminal(value, terminalKey) {
  if (!terminalKey) return true;
  return String(value?.terminalKey || "").trim() === terminalKey;
}

function latestGeneratedOutputs(items) {
  const latest = new Map();
  for (const item of items || []) {
    const key = `${item.customerId || item.customerName || ""}|${item.pricingDate || ""}`;
    const current = latest.get(key);
    if (!current) {
      latest.set(key, item);
      continue;
    }
    const currentCreatedAt = Date.parse(current.createdAt || 0);
    const nextCreatedAt = Date.parse(item.createdAt || 0);
    if (nextCreatedAt >= currentCreatedAt) {
      latest.set(key, item);
    }
  }
  return [...latest.values()].sort((a, b) => (
    String(b.pricingDate || "").localeCompare(String(a.pricingDate || "")) ||
    String(b.createdAt || "").localeCompare(String(a.createdAt || "")) ||
    String(a.customerName || "").localeCompare(String(b.customerName || ""))
  ));
}

function OutputCard({ output, fallbackStatus, onOpen, onSelectTraceMode }) {
  const basis = basisTraceItem(output);
  const derived = derivedBasisTotals(output);
  return (
    <div className="mobile-prices-output-card card">
      <button type="button" className="mobile-prices-output-open" onClick={onOpen}>
        <div className="mobile-prices-output-head">
          <strong>{productFamilyLabel(output.productFamily)}</strong>
          <span>{output.status || fallbackStatus}</span>
        </div>
      </button>
      {basis ? (
        <div className="mobile-prices-basis-grid">
          <div className={`mobile-prices-kv ${basisCellTone("spot", basis.recommendation)}`.trim()}><span>Spot Basis</span><strong>{formatMoney(basis.spotValue)}</strong>{formatBasisObserved(output, "spot") ? <small>{formatBasisObserved(output, "spot")}</small> : null}</div>
          <div className={`mobile-prices-kv ${basisCellTone("rack", basis.recommendation)}`.trim()}><span>Rack Basis</span><strong>{formatMoney(basis.rackValue)}</strong>{formatBasisObserved(output, "rack") ? <small>{formatBasisObserved(output, "rack")}</small> : null}</div>
          <div className={`mobile-prices-kv ${basisCellTone("winner", basis.recommendation)}`.trim()}><span>Using</span><strong>{basis.recommendation || "n/a"}</strong></div>
          <button type="button" className={`mobile-prices-basis-action ${basisCellTone("spot", basis.recommendation)}`.trim()} onClick={() => onSelectTraceMode("spot")}><span>Derived Spot</span><strong>{formatMoney(derived?.spotTotal)}</strong></button>
          <button type="button" className={`mobile-prices-basis-action ${basisCellTone("rack", basis.recommendation)}`.trim()} onClick={() => onSelectTraceMode("rack")}><span>Derived Rack</span><strong>{formatMoney(derived?.rackTotal)}</strong></button>
          <div className={`mobile-prices-kv ${basisCellTone("winner", basis.recommendation)}`.trim()}><span>Difference</span><strong>{derived?.difference == null ? "n/a" : `${derived.difference > 0 ? "+" : ""}${formatMoney(derived.difference)}`}</strong></div>
        </div>
      ) : null}
    </div>
  );
}

function Sheet({ title, subtitle, onClose, children }) {
  return (
    <div className="mobile-prices-sheet-backdrop" onClick={onClose}>
      <div className="mobile-prices-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="mobile-prices-sheet-head">
          <div>
            <strong>{title}</strong>
            {subtitle ? <span>{subtitle}</span> : null}
          </div>
          <button type="button" onClick={onClose}>Close</button>
        </div>
        <div className="mobile-prices-sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function MobilePricesPage() {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedSection, setSelectedSection] = useState("run");
  const [customerSearch, setCustomerSearch] = useState("");
  const [pricingDate, setPricingDate] = useState(localDateInputValue());
  const [customerProfile, setCustomerProfile] = useState(null);
  const [profileDraft, setProfileDraft] = useState(null);
  const [preview, setPreview] = useState(null);
  const [runHistory, setRunHistory] = useState(null);
  const [outputs, setOutputs] = useState([]);
  const [selectedOutputId, setSelectedOutputId] = useState("");
  const [selectedOutputDetail, setSelectedOutputDetail] = useState(null);
  const [sources, setSources] = useState([]);
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [selectedSourceDetail, setSelectedSourceDetail] = useState(null);
  const [activeSheet, setActiveSheet] = useState("");
  const [selectedFamily, setSelectedFamily] = useState("");
  const [selectedTraceMode, setSelectedTraceMode] = useState("rack");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [touchStartX, setTouchStartX] = useState(null);

  const selectedCustomer = useMemo(() => customers.find((item) => item.id === selectedCustomerId) || null, [customers, selectedCustomerId]);
  const selectedTerminalKey = (customerProfile?.rules?.terminalKey || customerProfile?.terminalKey || selectedCustomer?.terminalKey || "").trim();
  const selectedMarketKey = (customerProfile?.rules?.marketKey || "").trim();
  const selectedBranch = customerProfile?.rules?.branch || "unbranded";
  const selectedSourceRows = useMemo(
    () => (selectedSourceDetail?.values || []).filter((value) => sourceValueMatchesTerminal(value, selectedTerminalKey)),
    [selectedSourceDetail, selectedTerminalKey]
  );
  const filteredCustomers = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    if (!query) return customers;
    return customers.filter((customer) => {
      const haystack = [
        customer.name,
        customer.terminalKey,
        customer.status,
        customer.city,
        customer.state
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [customerSearch, customers]);
  const mobileAlerts = useMemo(() => {
    const items = [];
    const seen = new Set();
    for (const issue of preview?.missingInputs || []) {
      if (seen.has(issue.key)) continue;
      seen.add(issue.key);
      items.push(issue);
    }
    for (const issue of selectedOutputDetail?.detail?.missingInputs || []) {
      if (seen.has(issue.key)) continue;
      seen.add(issue.key);
      items.push(issue);
    }
    return items.slice(0, 6);
  }, [preview, selectedOutputDetail]);

  async function loadWorkspace(preferredCustomerId = "") {
    setLoading(true);
    setError("");
    try {
      const nextCustomers = await api.getCustomers();
      const nextCustomerId = preferredCustomerId || nextCustomers[0]?.id || "";
      setCustomers(nextCustomers);
      setSelectedCustomerId(nextCustomerId);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError || "Unable to load mobile prices"));
    } finally {
      setLoading(false);
    }
  }

  async function loadRunData(nextPricingDate, customerId) {
    if (!customerId) {
      setRunHistory(null);
      setOutputs([]);
      setSources([]);
      return;
    }
    try {
      const [history, nextOutputs, nextSources] = await Promise.all([
        api.getPricingRunHistory(nextPricingDate, { customerId }),
        api.getGeneratedPricingOutputs({ pricingDate: nextPricingDate, customerId }),
        api.getPricingSources({ pricingDate: nextPricingDate })
      ]);
      const latestOutputs = latestGeneratedOutputs(nextOutputs);
      setRunHistory(history);
      setOutputs(latestOutputs);
      setSources(nextSources);
      setSelectedOutputId((current) => latestOutputs.some((item) => item.id === current) ? current : (latestOutputs[0]?.id || ""));
      setSelectedSourceId((current) => nextSources.some((item) => item.id === current) ? current : (nextSources[0]?.id || ""));
    } catch (loadError) {
      setRunHistory(null);
      setOutputs([]);
      setSources([]);
      setSelectedOutputId("");
      setSelectedSourceId("");
      setSelectedOutputDetail(null);
      setSelectedSourceDetail(null);
      setError(loadError instanceof Error ? loadError.message : String(loadError || "Unable to load mobile run data"));
    }
  }

  useEffect(() => { loadWorkspace(); }, []);
  useEffect(() => { loadRunData(pricingDate, selectedCustomerId); }, [pricingDate, selectedCustomerId]);
  useEffect(() => {
    if (!selectedCustomerId) {
      setCustomerProfile(null);
      setProfileDraft(null);
      return;
    }
    let active = true;
    api.getCustomerPricingProfile(selectedCustomerId)
      .then((profile) => {
        if (!active) return;
        setCustomerProfile(profile);
        setProfileDraft(profile ? {
          effectiveStart: profile.effectiveStart || pricingDate,
          effectiveEnd: profile.effectiveEnd || "",
          distributionLabel: profile.rules?.distributionLabel ?? "",
          gasPrepay: profile.rules?.gasPrepay ?? "",
          dieselPrepay: profile.rules?.dieselPrepay ?? "",
          storageFee: profile.rules?.storageFee ?? "",
          gasFedExcise: profile.rules?.gasFedExcise ?? "",
          gasStateExcise: profile.rules?.gasStateExcise ?? "",
          dieselFedExcise: profile.rules?.dieselFedExcise ?? "",
          dieselStateExcise: profile.rules?.dieselStateExcise ?? "",
          gasSalesTaxRate: profile.rules?.gasSalesTaxRate ?? "",
          dieselSalesTaxRate: profile.rules?.dieselSalesTaxRate ?? "",
          gasRetailMargin: profile.rules?.gasRetailMargin ?? "",
          dieselRetailMargin: profile.rules?.dieselRetailMargin ?? "",
          freightCostGas: profile.freightCostGas ?? "",
          freightCostDiesel: profile.freightCostDiesel ?? "",
          rackMarginGas: profile.rackMarginGas ?? "",
          rackMarginDiesel: profile.rackMarginDiesel ?? "",
          discountRegular: profile.discountRegular ?? "",
          discountMid: profile.discountMid ?? "",
          discountPremium: profile.discountPremium ?? "",
          discountDiesel: profile.discountDiesel ?? "",
          branch: profile.rules?.branch || "unbranded",
          marketKey: profile.rules?.marketKey || "",
          terminalKey: profile.rules?.terminalKey || profile.terminalKey || selectedCustomer?.terminalKey || ""
        } : {
          effectiveStart: pricingDate,
          effectiveEnd: "",
          distributionLabel: "",
          gasPrepay: "",
          dieselPrepay: "",
          storageFee: "",
          gasFedExcise: "",
          gasStateExcise: "",
          dieselFedExcise: "",
          dieselStateExcise: "",
          gasSalesTaxRate: "",
          dieselSalesTaxRate: "",
          gasRetailMargin: "",
          dieselRetailMargin: "",
          freightCostGas: "",
          freightCostDiesel: "",
          rackMarginGas: "",
          rackMarginDiesel: "",
          discountRegular: "",
          discountMid: "",
          discountPremium: "",
          discountDiesel: "",
          branch: "unbranded",
          marketKey: "",
          terminalKey: selectedCustomer?.terminalKey || ""
        });
      })
      .catch(() => {
        if (!active) return;
        setCustomerProfile(null);
        setProfileDraft({
          effectiveStart: pricingDate,
          effectiveEnd: "",
          distributionLabel: "",
          gasPrepay: "",
          dieselPrepay: "",
          storageFee: "",
          gasFedExcise: "",
          gasStateExcise: "",
          dieselFedExcise: "",
          dieselStateExcise: "",
          gasSalesTaxRate: "",
          dieselSalesTaxRate: "",
          gasRetailMargin: "",
          dieselRetailMargin: "",
          freightCostGas: "",
          freightCostDiesel: "",
          rackMarginGas: "",
          rackMarginDiesel: "",
          discountRegular: "",
          discountMid: "",
          discountPremium: "",
          discountDiesel: "",
          branch: "unbranded",
          marketKey: "",
          terminalKey: selectedCustomer?.terminalKey || ""
        });
      });
    return () => { active = false; };
  }, [selectedCustomerId, pricingDate, selectedCustomer]);
  useEffect(() => {
    if (!selectedOutputId) {
      setSelectedOutputDetail(null);
      return;
    }
    let active = true;
    api.getGeneratedPricingOutput(selectedOutputId)
      .then((detail) => active && setSelectedOutputDetail(detail))
      .catch((loadError) => active && setError(loadError instanceof Error ? loadError.message : String(loadError || "Unable to load output detail")));
    return () => { active = false; };
  }, [selectedOutputId]);
  useEffect(() => {
    if (!selectedSourceId) {
      setSelectedSourceDetail(null);
      return;
    }
    let active = true;
    api.getPricingSource(selectedSourceId)
      .then((detail) => active && setSelectedSourceDetail(detail))
      .catch((loadError) => active && setError(loadError instanceof Error ? loadError.message : String(loadError || "Unable to load source detail")));
    return () => { active = false; };
  }, [selectedSourceId]);

  async function handlePreview() {
    if (!selectedCustomerId) return;
    setError(""); setStatus("Running preview...");
    try {
      setPreview(await api.previewPricingRun({ customerId: selectedCustomerId, pricingDate }));
      setSelectedSection("preview");
      setStatus("Preview ready.");
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : String(runError || "Unable to run preview"));
      setStatus("");
    }
  }

  async function handleGenerate() {
    if (!selectedCustomerId) return;
    setError(""); setStatus("Generating prices...");
    try {
      await api.generatePricingRun({ customerId: selectedCustomerId, pricingDate });
      await loadRunData(pricingDate, selectedCustomerId);
      setSelectedSection("results");
      setStatus("Generated prices.");
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : String(runError || "Unable to generate prices"));
      setStatus("");
    }
  }

  async function handleSaveProfile() {
    if (!selectedCustomerId || !profileDraft) return;
    setError(""); setStatus("Saving profile...");
    try {
      const normalizedRuleFields = Object.fromEntries(PROFILE_RULE_FIELDS.map((field) => [field, profileDraft[field] === "" ? null : profileDraft[field]]));
      const saved = await api.saveCustomerPricingProfile(selectedCustomerId, {
        effectiveStart: profileDraft.effectiveStart || pricingDate,
        effectiveEnd: profileDraft.effectiveEnd || "",
        freightCostGas: profileDraft.freightCostGas,
        freightCostDiesel: profileDraft.freightCostDiesel,
        rackMarginGas: profileDraft.rackMarginGas,
        rackMarginDiesel: profileDraft.rackMarginDiesel,
        discountRegular: profileDraft.discountRegular,
        discountMid: profileDraft.discountMid,
        discountPremium: profileDraft.discountPremium,
        discountDiesel: profileDraft.discountDiesel,
        rules: {
          ...normalizedRuleFields,
          branch: profileDraft.branch || "unbranded",
          marketKey: profileDraft.marketKey || "",
          terminalKey: profileDraft.terminalKey || ""
        }
      });
      setCustomerProfile(saved);
      setActiveSheet("");
      setStatus("Profile saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError || "Unable to save profile"));
      setStatus("");
    }
  }

  function openFamilySheet(family, traceMode = "") {
    setSelectedFamily(family);
    setSelectedTraceMode(traceMode || defaultTraceMode(familyDetail?.productFamily === family ? familyDetail : (preview?.outputs || selectedOutputDetail?.detail?.outputs || []).find((item) => item.productFamily === family) || { trace: [] }));
    setActiveSheet("family");
  }

  function handleSectionSwipeStart(event) {
    if (activeSheet) return;
    setTouchStartX(event.touches?.[0]?.clientX ?? null);
  }

  function handleSectionSwipeEnd(event) {
    if (activeSheet || touchStartX == null) return;
    const endX = event.changedTouches?.[0]?.clientX;
    if (typeof endX !== "number") {
      setTouchStartX(null);
      return;
    }
    const deltaX = endX - touchStartX;
    const currentIndex = MOBILE_SECTIONS.indexOf(selectedSection);
    if (Math.abs(deltaX) < 56 || currentIndex === -1) {
      setTouchStartX(null);
      return;
    }
    const direction = deltaX < 0 ? 1 : -1;
    const nextIndex = Math.min(Math.max(currentIndex + direction, 0), MOBILE_SECTIONS.length - 1);
    setSelectedSection(MOBILE_SECTIONS[nextIndex]);
    setTouchStartX(null);
  }

  if (loading) return <div className="login-status">Loading mobile prices...</div>;

  const outputCards = selectedOutputDetail?.detail?.outputs?.length
    ? selectedOutputDetail.detail.outputs.filter((item) => VISIBLE_PRODUCT_FAMILIES.includes(item.productFamily))
    : VISIBLE_PRODUCT_FAMILIES.map((family) => ({
        productFamily: family,
        basePrice: selectedOutputDetail?.[`${family}Base`] ?? selectedOutputDetail?.[`${family}base`] ?? null,
        totalPrice: selectedOutputDetail?.[`${family}Total`] ?? selectedOutputDetail?.[`${family}total`] ?? null,
        trace: []
      }));
  const familyDetail = (preview?.outputs || selectedOutputDetail?.detail?.outputs || []).filter((item) => VISIBLE_PRODUCT_FAMILIES.includes(item.productFamily)).find((item) => item.productFamily === selectedFamily);

  return (
    <div className="mobile-prices-page">
      <section className="mobile-prices-hero card">
        <div>
          <div className="price-tables-kicker">Prototype</div>
          <h1>Mobile Prices</h1>
          <p>Mobile-first concept for terminal pricing, focused on one terminal and one action at a time.</p>
        </div>
        <div className="mobile-prices-controls">
          <label><span>Date</span><input type="date" value={pricingDate} onChange={(event) => setPricingDate(event.target.value)} /></label>
          <button type="button" onClick={() => setActiveSheet("customers")}>{selectedCustomer?.name || "Choose Terminal"}</button>
        </div>
      </section>

      {status ? <div className="price-tables-banner price-tables-banner-success">{status}</div> : null}
      {error ? <div className="price-tables-banner price-tables-banner-error">{error}</div> : null}
      {mobileAlerts.length ? (
        <section className="mobile-prices-alert-stack">
          {mobileAlerts.map((issue) => (
            <div key={issue.key} className="mobile-prices-alert-card">
              <strong>Input warning</strong>
              <span>{issue.message}</span>
            </div>
          ))}
        </section>
      ) : null}

      <section className="mobile-prices-summary-grid">
        <div className="metric-card"><div className="metric-label">Terminal</div><div className="metric-value">{selectedCustomer?.name || "n/a"}</div></div>
        <div className="metric-card"><div className="metric-label">Terminal</div><div className="metric-value">{selectedTerminalKey || "n/a"}</div></div>
        <div className="metric-card"><div className="metric-label">Outputs</div><div className="metric-value">{runHistory?.total || 0}</div></div>
      </section>

      <div className="mobile-prices-section-stage" onTouchStart={handleSectionSwipeStart} onTouchEnd={handleSectionSwipeEnd}>
      {selectedSection === "run" ? (
        <section className="mobile-prices-section card">
          <div className="mobile-prices-section-head">
            <div><div className="price-tables-panel-kicker">Run</div><h3>{selectedCustomer?.name || "Select a terminal"}</h3></div>
            <button type="button" onClick={() => setActiveSheet("profile")}>Edit Profile</button>
          </div>
          <div className="mobile-prices-rule-summary card">
            <div className="mobile-prices-inline-head">
              <div>
                <div className="price-tables-panel-kicker">Rule / Source Summary</div>
                <h3>{selectedSourceDetail?.sourceLabel || "Active pricing context"}</h3>
              </div>
              <button type="button" onClick={() => setSelectedSection("source")}>View OPIS</button>
            </div>
            <div className="mobile-prices-summary-pills">
              <span>{selectedBranch}</span>
              <span>{selectedMarketKey || "No market"}</span>
              <span>{selectedTerminalKey || "No terminal"}</span>
            </div>
            <div className="mobile-prices-kv"><span>Source status</span><strong>{selectedSourceDetail?.status || "No snapshot"}</strong></div>
            <div className="mobile-prices-kv"><span>Filtered rows</span><strong>{selectedSourceRows.length}</strong></div>
            <div className="mobile-prices-kv"><span>As of</span><strong>{selectedSourceDetail?.pricingDate || pricingDate}</strong></div>
          </div>
          <div className="mobile-prices-kv"><span>Current date</span><strong>{pricingDate}</strong></div>
          <div className="mobile-prices-kv"><span>Incomplete outputs</span><strong>{runHistory?.incompleteCount || 0}</strong></div>
        </section>
      ) : null}

      {selectedSection === "preview" ? (
        <section className="mobile-prices-section">
          {preview ? (
            <>
              <div className="mobile-prices-output-grid">
                {preview.outputs?.filter((output) => VISIBLE_PRODUCT_FAMILIES.includes(output.productFamily)).map((output) => <OutputCard key={output.productFamily} output={output} fallbackStatus={preview.status} onOpen={() => openFamilySheet(output.productFamily)} onSelectTraceMode={(mode) => openFamilySheet(output.productFamily, mode)} />)}
              </div>
            </>
          ) : <div className="price-tables-empty">Run preview to inspect mobile output cards.</div>}
        </section>
      ) : null}

      {selectedSection === "results" ? (
        <section className="mobile-prices-section">
          {outputs.length ? outputs.map((output) => (
            <button key={output.id} type="button" className={`mobile-prices-history-card card${output.id === selectedOutputId ? " mobile-prices-customer-active" : ""}`} onClick={() => { setSelectedOutputId(output.id); setActiveSheet("output"); }}>
              <strong>{output.customerName}</strong>
              <div className="mobile-prices-kv"><span>Status</span><strong>{output.status}</strong></div>
              <div className="mobile-prices-kv"><span>Regular</span><strong>{formatMoney(output.regularTotal)}</strong></div>
              <div className="mobile-prices-kv"><span>Created</span><strong>{formatDateTime(output.createdAt)}</strong></div>
            </button>
          )) : <div className="price-tables-empty">No generated outputs for this terminal/date yet.</div>}
        </section>
      ) : null}

      {selectedSection === "source" ? (
        <section className="mobile-prices-section">
          <div className="mobile-prices-inline-head">
            <div><div className="price-tables-panel-kicker">Source / OPIS</div><h3>{selectedSourceDetail?.sourceLabel || "Snapshot source"}</h3></div>
            <button type="button" onClick={() => setActiveSheet("source")}>{selectedSourceRows.length} Rows</button>
          </div>
          <div className="mobile-prices-detail card">
            <strong>{selectedSourceDetail?.sourceType || "No snapshot selected"}</strong>
            <span>{selectedSourceDetail ? `${selectedSourceDetail.status} | ${selectedSourceDetail.pricingDate}` : "Select a snapshot from the sheet."}</span>
            <span>Terminal filter: {selectedTerminalKey || "All terminals"}</span>
          </div>
          <div className="mobile-prices-source-grid">
            {selectedSourceRows.slice(0, 6).map((row) => (
              <button key={row.id} type="button" className="mobile-prices-source-card card" onClick={() => setActiveSheet("source")}>
                <strong>{row.productKey || row.quoteCode}</strong>
                <span>{row.vendorKey || "market"}</span>
                <div className="mobile-prices-kv"><span>Quote</span><strong>{row.quoteCode}</strong></div>
                <div className="mobile-prices-kv"><span>Value</span><strong>{row.value}</strong></div>
              </button>
            ))}
          </div>
          {!selectedSourceRows.length ? <div className="price-tables-empty">No source rows matched the selected terminal.</div> : null}
        </section>
      ) : null}
      </div>

      <div className="mobile-prices-bottom-bar">
        <div className="mobile-prices-tabbar">
          {[
            ["run", "Run"],
            ["preview", "Preview"],
            ["results", "Results"],
            ["source", "OPIS"]
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={selectedSection === key ? "mobile-prices-nav-active" : ""}
              onClick={() => setSelectedSection(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mobile-prices-bottom-actions">
          <button type="button" onClick={() => setActiveSheet("customers")}>{selectedCustomer?.name ? "Switch Terminal" : "Terminals"}</button>
          <button type="button" onClick={() => setActiveSheet("profile")} disabled={!selectedCustomerId}>Profile</button>
          <button type="button" onClick={handlePreview} disabled={!selectedCustomerId}>Preview</button>
          <button type="button" onClick={handleGenerate} disabled={!selectedCustomerId}>Generate</button>
        </div>
      </div>

      {activeSheet === "customers" ? (
        <Sheet title="Terminals" subtitle="Pick the terminal you want to work on" onClose={() => setActiveSheet("")}>
          <label className="mobile-prices-search">
            <span>Search terminals</span>
            <input type="search" value={customerSearch} placeholder="Name, terminal, city" onChange={(event) => setCustomerSearch(event.target.value)} />
          </label>
          <div className="mobile-prices-sheet-grid">
            {filteredCustomers.map((customer) => (
              <button key={customer.id} type="button" className={`mobile-prices-customer card${customer.id === selectedCustomerId ? " mobile-prices-customer-active" : ""}`} onClick={() => { setSelectedCustomerId(customer.id); setCustomerSearch(""); setActiveSheet(""); }}>
                <strong>{customer.name}</strong>
                <span>{customer.terminalKey || "No terminal"} | {customer.status}</span>
              </button>
            ))}
          </div>
          {!filteredCustomers.length ? <div className="price-tables-empty">No terminals matched that search.</div> : null}
        </Sheet>
      ) : null}

      {activeSheet === "output" && selectedOutputDetail ? (
        <Sheet title={selectedOutputDetail.customerName} subtitle={`${selectedOutputDetail.status} | ${selectedOutputDetail.pricingDate}`} onClose={() => setActiveSheet("")}>
          <div className="mobile-prices-output-grid">
            {outputCards.map((output) => <OutputCard key={output.productFamily} output={output} fallbackStatus={selectedOutputDetail.status} onOpen={() => openFamilySheet(output.productFamily)} onSelectTraceMode={(mode) => openFamilySheet(output.productFamily, mode)} />)}
          </div>
        </Sheet>
      ) : null}

      {activeSheet === "profile" && profileDraft ? (
        <Sheet title="Terminal Profile" subtitle={selectedCustomer?.name || "Selected terminal"} onClose={() => setActiveSheet("")}>
          <div className="mobile-prices-profile-form">
            {[
              ["distributionLabel", "Distribution Label", "text"],
              ["gasPrepay", "Gas Prepay", "text"],
              ["dieselPrepay", "Diesel Prepay", "text"],
              ["storageFee", "Storage Fee", "text"],
              ["gasFedExcise", "Gas Fed Excise", "text"],
              ["gasStateExcise", "Gas State Excise", "text"],
              ["dieselFedExcise", "Diesel Fed Excise", "text"],
              ["dieselStateExcise", "Diesel State Excise", "text"],
              ["gasSalesTaxRate", "Gas Sales Tax Rate", "text"],
              ["dieselSalesTaxRate", "Diesel Sales Tax Rate", "text"],
              ["gasRetailMargin", "Gas Retail Margin", "text"],
              ["dieselRetailMargin", "Diesel Retail Margin", "text"],
              ["effectiveStart", "Effective Start", "date"],
              ["effectiveEnd", "Effective End", "date"],
              ["terminalKey", "Terminal Key", "text"],
              ["marketKey", "Market Key", "text"],
              ["freightCostGas", "Freight Gas", "text"],
              ["freightCostDiesel", "Freight Diesel", "text"],
              ["rackMarginGas", "Margin Gas", "text"],
              ["rackMarginDiesel", "Margin Diesel", "text"],
              ["discountRegular", "Discount Regular", "text"],
              ["discountMid", "Discount Mid", "text"],
              ["discountPremium", "Discount Premium", "text"],
              ["discountDiesel", "Discount Diesel", "text"]
            ].map(([field, label, type]) => (
              <label key={field}>
                <span>{label}</span>
                <input type={type} value={profileDraft[field] ?? ""} onChange={(event) => setProfileDraft((current) => ({ ...current, [field]: event.target.value }))} />
              </label>
            ))}
            <label>
              <span>Branch</span>
              <select value={profileDraft.branch} onChange={(event) => setProfileDraft((current) => ({ ...current, branch: event.target.value }))}>
                <option value="unbranded">unbranded</option>
                <option value="branded">branded</option>
              </select>
            </label>
          </div>
          <div className="mobile-prices-sheet-actions">
            <button type="button" onClick={handleSaveProfile}>Save Profile</button>
          </div>
        </Sheet>
      ) : null}

      {activeSheet === "source" ? (
        <Sheet title="Terminal-filtered source rows" subtitle={selectedTerminalKey || "All terminals"} onClose={() => setActiveSheet("")}>
          <div className="mobile-prices-sheet-grid">
            {sources.map((source) => (
              <button key={source.id} type="button" className={`mobile-prices-history-card card${source.id === selectedSourceId ? " mobile-prices-customer-active" : ""}`} onClick={() => setSelectedSourceId(source.id)}>
                <strong>{source.sourceLabel || source.sourceType}</strong>
                <span>{source.sourceType} | {source.status}</span>
              </button>
            ))}
          </div>
          <div className="mobile-prices-sheet-grid">
            {selectedSourceRows.map((row) => (
              <div key={row.id} className="mobile-prices-source-card card">
                <strong>{row.productKey || row.quoteCode}</strong>
                <span>{row.vendorKey || row.marketKey}</span>
                <div className="mobile-prices-kv"><span>Terminal</span><strong>{row.terminalKey}</strong></div>
                <div className="mobile-prices-kv"><span>Quote</span><strong>{row.quoteCode}</strong></div>
                <div className="mobile-prices-kv"><span>Value</span><strong>{row.value}</strong></div>
              </div>
            ))}
          </div>
        </Sheet>
      ) : null}

      {activeSheet === "family" && familyDetail ? (
        <Sheet title={`${selectedTraceMode === "spot" ? "Derived Spot Detail" : "Derived Rack Detail"} · ${productFamilyLabel(familyDetail.productFamily)}`} subtitle="Full price trace" onClose={() => setActiveSheet("")}>
          <div className="mobile-prices-output-card card">
            <div className="mobile-prices-kv"><span>Exposed Price</span><strong>{formatMoney(familyDetail.totalPrice)}</strong></div>
            {"taxes" in familyDetail ? <div className="mobile-prices-kv"><span>Taxes</span><strong>{formatMoney(familyDetail.taxes)}</strong></div> : null}
            <div className="mobile-prices-kv"><span>Rack Basis</span><strong>{formatMoney(familyDetail.basePrice)}</strong></div>
            {basisTraceItem(familyDetail) ? (
              <div className="mobile-prices-basis-grid">
                <div className={`mobile-prices-kv ${basisCellTone("spot", basisTraceItem(familyDetail).recommendation)}`.trim()}><span>Spot Basis</span><strong>{formatMoney(basisTraceItem(familyDetail).spotValue)}</strong>{formatBasisObserved(familyDetail, "spot") ? <small>{formatBasisObserved(familyDetail, "spot")}</small> : null}</div>
                <div className={`mobile-prices-kv ${basisCellTone("rack", basisTraceItem(familyDetail).recommendation)}`.trim()}><span>Rack Basis</span><strong>{formatMoney(basisTraceItem(familyDetail).rackValue)}</strong>{formatBasisObserved(familyDetail, "rack") ? <small>{formatBasisObserved(familyDetail, "rack")}</small> : null}</div>
                <div className={`mobile-prices-kv ${basisCellTone("winner", basisTraceItem(familyDetail).recommendation)}`.trim()}><span>Using</span><strong>{basisTraceItem(familyDetail).recommendation || "n/a"}</strong></div>
                <button type="button" className={`mobile-prices-basis-action ${basisCellTone("spot", basisTraceItem(familyDetail).recommendation)}${selectedTraceMode === "spot" ? " mobile-prices-basis-action-active" : ""}`.trim()} onClick={() => setSelectedTraceMode("spot")}><span>Derived Spot</span><strong>{formatMoney(derivedBasisTotals(familyDetail)?.spotTotal)}</strong></button>
                <button type="button" className={`mobile-prices-basis-action ${basisCellTone("rack", basisTraceItem(familyDetail).recommendation)}${selectedTraceMode === "rack" ? " mobile-prices-basis-action-active" : ""}`.trim()} onClick={() => setSelectedTraceMode("rack")}><span>Derived Rack</span><strong>{formatMoney(derivedBasisTotals(familyDetail)?.rackTotal)}</strong></button>
                <div className={`mobile-prices-kv ${basisCellTone("winner", basisTraceItem(familyDetail).recommendation)}`.trim()}><span>Difference</span><strong>{derivedBasisTotals(familyDetail)?.difference == null ? "n/a" : `${derivedBasisTotals(familyDetail).difference > 0 ? "+" : ""}${formatMoney(derivedBasisTotals(familyDetail).difference)}`}</strong></div>
              </div>
            ) : null}
          </div>
          <div className="mobile-prices-trace-context card">{traceModeSummary(familyDetail, selectedTraceMode)}</div>
          <div className={`mobile-prices-trace-context card ${selectedTraceMode === "spot" ? "price-tables-tone-spot" : "price-tables-tone-rack"}`.trim()}>
            <strong>{selectedTraceMode === "spot" ? "Spot pickup detail" : "Rack pickup detail"}</strong>
            {basisValidationLines(familyDetail, selectedTraceMode).map((line) => <span key={line}>{line}</span>)}
          </div>
          <div className="mobile-prices-trace-list">
            {filteredTraceItems(familyDetail).map((item, index) => (
              <div key={`${familyDetail.productFamily}-${index}`} className={`mobile-prices-trace-row card ${traceLabel(item) === "Landed Cost Price" ? "price-tables-trace-row-success" : selectedTraceMode === "spot" && traceLabelForMode(item, selectedTraceMode) === "Spot Basis" ? "price-tables-trace-row-spot" : selectedTraceMode === "rack" && traceLabelForMode(item, selectedTraceMode) === "Rack Basis" ? "price-tables-trace-row-rack" : ""} ${traceIndentLevel(item, selectedTraceMode) ? `price-tables-trace-row-indent-${traceIndentLevel(item, selectedTraceMode)}` : ""}`.trim()}>
                <strong>{traceLabelForMode(item, selectedTraceMode)}</strong>
                {item.detail ? <span>{traceDetailForMode(item, selectedTraceMode)}</span> : null}
                {traceSourceText(item) ? <small>{traceSourceText(item)}</small> : null}
                <em>{traceDisplayAmount(item, selectedTraceMode)}</em>
              </div>
            ))}
          </div>
        </Sheet>
      ) : null}
    </div>
  );
}
