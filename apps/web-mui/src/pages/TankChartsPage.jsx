import { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import {
  Alert,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Collapse,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Typography,
  useMediaQuery
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import TimelineIcon from "@mui/icons-material/Timeline";
import OpacityIcon from "@mui/icons-material/Opacity";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import FilterListIcon from "@mui/icons-material/FilterList";
import TableRowsIcon from "@mui/icons-material/TableRows";
import { api } from "../api";
import { useNavigate, useSearchParams } from "react-router-dom";

const rangeOptions = [
  { value: "12h", label: "12 Hours", hours: 12 },
  { value: "24h", label: "24 Hours", hours: 24 },
  { value: "48h", label: "48 Hours", hours: 48 },
  { value: "72h", label: "3 Days", hours: 72 }
];

function buildRangeStart(anchorIso, range) {
  const selected = rangeOptions.find((option) => option.value === range) || rangeOptions[1];
  return new Date(new Date(anchorIso).getTime() - selected.hours * 60 * 60 * 1000).toISOString();
}

function formatVolume(value) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })} L`;
}

function formatPercent(value) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return `${Number(value).toFixed(1)}%`;
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function buildYAxisTicks(minValue, maxValue) {
  const start = Math.max(0, Math.floor(minValue / 10) * 10);
  const end = Math.min(100, Math.ceil(maxValue / 10) * 10);
  const ticks = [];
  for (let value = start; value <= end; value += 10) ticks.push(value);
  return ticks.length ? ticks : [0, 50, 100];
}

function buildGaugeOption(value) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  return {
    animationDuration: 700,
    animationEasing: "cubicOut",
    series: [
      {
        type: "gauge",
        startAngle: 205,
        endAngle: -25,
        min: 0,
        max: 100,
        splitNumber: 10,
        center: ["50%", "66%"],
        radius: "92%",
        axisLine: {
          lineStyle: {
            width: 18,
            color: [
              [0.1, "#c84232"],
              [0.15, "#d6a63f"],
              [0.8, "#4c9a63"],
              [0.9, "#d6a63f"],
              [1, "#c84232"]
            ]
          }
        },
        pointer: {
          length: "72%",
          width: 7,
          itemStyle: { color: "#0b5fff" }
        },
        anchor: {
          show: true,
          size: 14,
          itemStyle: {
            color: "#173447",
            borderColor: "#f7fbff",
            borderWidth: 3
          }
        },
        axisTick: {
          distance: -19,
          splitNumber: 4,
          lineStyle: { width: 2, color: "#5a7689" }
        },
        splitLine: {
          distance: -20,
          length: 18,
          lineStyle: { width: 4, color: "#29465a" }
        },
        axisLabel: {
          distance: 10,
          color: "#59758a",
          fontSize: 12,
          formatter(valueLabel) {
            if (valueLabel === 0) return "E";
            if (valueLabel === 50) return "1/2";
            if (valueLabel === 100) return "F";
            return "";
          }
        },
        detail: {
          valueAnimation: true,
          offsetCenter: [0, "48%"],
          fontSize: 24,
          fontWeight: 700,
          color: "#173447",
          formatter: "{value}%"
        },
        title: {
          offsetCenter: [0, "66%"],
          color: "#59758a",
          fontSize: 11
        },
        data: [{ value: Number(safeValue.toFixed(1)), name: "Current fill" }]
      }
    ]
  };
}

function buildTrendOption(tank, minValue, maxValue, yTicks) {
  return {
    animationDuration: 700,
    grid: { top: 22, right: 22, bottom: 42, left: 56 },
    tooltip: {
      trigger: "axis",
      backgroundColor: "#173447",
      borderWidth: 0,
      textStyle: { color: "#f7fbff" },
      formatter(params) {
        const point = params?.[0]?.data;
        if (!point) return "";
        return [
          new Date(point.readAt).toLocaleString(),
          `Fill: ${formatPercent(point.fillPercent)}`,
          `Volume: ${formatVolume(point.volume)}`
        ].join("<br/>");
      }
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      axisLine: { lineStyle: { color: "#9bb2c2" } },
      axisTick: { show: false },
      axisLabel: {
        color: "#59758a",
        formatter(value) {
          return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        }
      },
      data: tank.points.map((point) => point.readAt)
    },
    yAxis: {
      type: "value",
      min: minValue,
      max: maxValue,
      interval: yTicks.length > 1 ? yTicks[1] - yTicks[0] : 10,
      axisLabel: {
        color: "#59758a",
        formatter(valueLabel) {
          return `${valueLabel}%`;
        }
      },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: "rgba(99, 136, 159, 0.18)" } }
    },
    series: [
      {
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 7,
        showSymbol: tank.points.length <= 20,
        lineStyle: { width: 4, color: "#0b5fff" },
        itemStyle: {
          color: "#ffffff",
          borderColor: "#0b5fff",
          borderWidth: 2
        },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(11, 95, 255, 0.26)" },
              { offset: 1, color: "rgba(11, 95, 255, 0.03)" }
            ]
          }
        },
        markArea: {
          silent: true,
          itemStyle: { opacity: 0.08 },
          data: [
            [{ yAxis: 0, itemStyle: { color: "#c84232" } }, { yAxis: 10 }],
            [{ yAxis: 10, itemStyle: { color: "#d6a63f" } }, { yAxis: 15 }],
            [{ yAxis: 15, itemStyle: { color: "#4c9a63" } }, { yAxis: 80 }],
            [{ yAxis: 80, itemStyle: { color: "#d6a63f" } }, { yAxis: 90 }],
            [{ yAxis: 90, itemStyle: { color: "#c84232" } }, { yAxis: 100 }]
          ]
        },
        data: tank.points.map((point) => ({
          value: Number(point.fillPercent.toFixed(2)),
          volume: point.volume,
          readAt: point.readAt,
          fillPercent: point.fillPercent
        }))
      }
    ]
  };
}

function MobileTankSelectorCard({ tank, selected, onClick }) {
  const latest = tank.points[tank.points.length - 1];
  const fillPercent = latest?.fillPercent || 0;
  const progressColor =
    fillPercent >= 80 || fillPercent <= 10 ? "error" :
    fillPercent >= 15 ? "success" :
    "warning";

  return (
    <Card
      variant="outlined"
      sx={{
        borderColor: selected ? "primary.main" : "divider",
        borderWidth: selected ? 2 : 1
      }}
    >
      <CardActionArea onClick={onClick}>
        <CardContent>
          <Stack spacing={1.25}>
            <Stack direction="row" justifyContent="space-between" spacing={1}>
              <div>
                <Typography fontWeight={700}>{tank.label}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Tank {tank.atgTankId} • {tank.product}
                </Typography>
              </div>
              <Chip size="small" label={latest ? formatPercent(latest.fillPercent) : "No data"} />
            </Stack>
            <LinearProgress
              variant="determinate"
              value={Math.max(0, Math.min(100, fillPercent))}
              color={progressColor}
              sx={{ height: 10, borderRadius: 999 }}
            />
            <Typography variant="body2" color="text.secondary">
              {latest ? `Latest ${formatVolume(latest.volume)} at ${formatDateTime(latest.readAt)}` : "No history rows in range"}
            </Typography>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function TankChartDetail({ tank }) {
  if (!tank) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Tank Trend</Typography>
          <Typography color="text.secondary">
            Pick one tank to inspect its trend closely. On phone, keep the selector compact and the chart focused.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  if (!tank.points.length) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6">{tank.label}</Typography>
          <Typography color="text.secondary">
            No history rows for this tank in the selected timeframe.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const fillValues = tank.points.map((point) => point.fillPercent);
  const minValue = Math.max(0, Math.min(...fillValues) - 4);
  const maxValue = Math.min(100, Math.max(...fillValues) + 4);
  const yTicks = buildYAxisTicks(minValue, maxValue);
  const latest = tank.points[tank.points.length - 1];
  const low = tank.points.reduce((current, point) => (point.fillPercent < current.fillPercent ? point : current), tank.points[0]);
  const high = tank.points.reduce((current, point) => (point.fillPercent > current.fillPercent ? point : current), tank.points[0]);
  const gaugeOption = buildGaugeOption(latest.fillPercent);
  const trendOption = buildTrendOption(tank, minValue, maxValue, yTicks);

  return (
    <Card>
      <CardContent>
        <Stack spacing={2.5}>
          <div>
            <Typography variant="h6">{tank.label}</Typography>
            <Typography color="text.secondary">
              Tank {tank.atgTankId} • {tank.product} • {formatVolume(tank.capacity)} capacity
            </Typography>
          </div>
          <Grid container spacing={1.5}>
            <Grid size={4}>
              <Typography variant="caption" color="text.secondary">Latest</Typography>
              <Typography fontWeight={700}>{formatPercent(latest.fillPercent)}</Typography>
              <Typography variant="body2" color="text.secondary">{formatVolume(latest.volume)}</Typography>
            </Grid>
            <Grid size={4}>
              <Typography variant="caption" color="text.secondary">Low</Typography>
              <Typography fontWeight={700}>{formatPercent(low.fillPercent)}</Typography>
              <Typography variant="body2" color="text.secondary">{formatDateTime(low.readAt)}</Typography>
            </Grid>
            <Grid size={4}>
              <Typography variant="caption" color="text.secondary">Peak</Typography>
              <Typography fontWeight={700}>{formatPercent(high.fillPercent)}</Typography>
              <Typography variant="body2" color="text.secondary">{tank.points.length} rows</Typography>
            </Grid>
          </Grid>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, lg: 4 }}>
              <Card variant="outlined">
                <CardContent>
                  <ReactECharts option={gaugeOption} style={{ height: 260 }} notMerge lazyUpdate opts={{ renderer: "svg" }} />
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, lg: 8 }}>
              <Card variant="outlined">
                <CardContent>
                  <ReactECharts option={trendOption} style={{ height: 320 }} notMerge lazyUpdate opts={{ renderer: "svg" }} />
                  <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
                    <Typography variant="caption" color="text.secondary">{formatDateTime(tank.points[0]?.readAt)}</Typography>
                    <Typography variant="caption" color="text.secondary">{formatDateTime(latest.readAt)}</Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Stack>
      </CardContent>
    </Card>
  );
}

export function TankChartsPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sites, setSites] = useState([]);
  const [selectedSiteId, setSelectedSiteId] = useState(searchParams.get("siteId") || "");
  const [selectedTankId, setSelectedTankId] = useState(searchParams.get("tankId") || "");
  const [siteDetail, setSiteDetail] = useState(null);
  const [range, setRange] = useState("24h");
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [anchorTs, setAnchorTs] = useState("");
  const [mobileView, setMobileView] = useState("list");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    api.getSites()
      .then((data) => {
        setSites(data);
        if (!selectedSiteId && data.length) setSelectedSiteId(data[0].id);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    const siteIdFromUrl = searchParams.get("siteId") || "";
    const tankIdFromUrl = searchParams.get("tankId") || "";
    if (siteIdFromUrl !== selectedSiteId) setSelectedSiteId(siteIdFromUrl);
    if (tankIdFromUrl !== selectedTankId) setSelectedTankId(tankIdFromUrl);
    if (tankIdFromUrl) setMobileView("detail");
  }, [searchParams]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);
    if (selectedSiteId) nextParams.set("siteId", selectedSiteId);
    else nextParams.delete("siteId");
    if (selectedTankId) nextParams.set("tankId", selectedTankId);
    else nextParams.delete("tankId");
    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [selectedSiteId, selectedTankId, searchParams, setSearchParams]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      if (!selectedSiteId) {
        setSiteDetail(null);
        setRows([]);
        setAnchorTs("");
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [site, latestRows] = await Promise.all([
          api.getSite(selectedSiteId),
          api.getTankHistory({ siteId: selectedSiteId, limit: "1" })
        ]);
        if (ignore) return;
        setSiteDetail(site);
        const latestTs = latestRows[0]?.ts || "";
        setAnchorTs(latestTs);
        if (!latestTs) {
          setRows([]);
          setError("");
          setLoading(false);
          return;
        }
        const tankRows = await api.getTankHistory({
          siteId: selectedSiteId,
          from: buildRangeStart(latestTs, range),
          to: latestTs,
          limit: "10000"
        });
        if (ignore) return;
        setRows(tankRows);
        setError("");
      } catch (err) {
        if (!ignore) setError(err.message);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [selectedSiteId, range]);

  const groupedTanks = useMemo(() => {
    if (!siteDetail?.tanks?.length) return [];
    const rowsByTankId = new Map();
    rows.forEach((row) => {
      if (!rowsByTankId.has(row.tankId)) rowsByTankId.set(row.tankId, []);
      rowsByTankId.get(row.tankId).push(row);
    });

    return siteDetail.tanks.map((tank) => {
      const capacity = Number(tank.capacityLiters || 0);
      const points = (rowsByTankId.get(tank.id) || [])
        .slice()
        .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
        .map((row) => {
          const volume = Number(row.fuelVolumeL || 0);
          return {
            ...row,
            volume,
            readAt: row.ts,
            fillPercent: capacity > 0 ? (volume / capacity) * 100 : 0
          };
        });

      return {
        tankId: tank.id,
        atgTankId: tank.atgTankId,
        label: tank.label,
        product: tank.product,
        capacity,
        points
      };
    });
  }, [rows, siteDetail]);

  useEffect(() => {
    if (!selectedTankId && groupedTanks.length) {
      setSelectedTankId(groupedTanks[0].tankId);
      return;
    }
    if (selectedTankId && !groupedTanks.find((tank) => tank.tankId === selectedTankId)) {
      setSelectedTankId(groupedTanks[0]?.tankId || "");
    }
  }, [groupedTanks, selectedTankId]);

  const selectedTank = useMemo(
    () => groupedTanks.find((tank) => tank.tankId === selectedTankId) || groupedTanks[0] || null,
    [groupedTanks, selectedTankId]
  );

  const summary = useMemo(() => {
    const totalRows = groupedTanks.reduce((sum, tank) => sum + tank.points.length, 0);
    const averageFill = groupedTanks.length
      ? groupedTanks.reduce((sum, tank) => sum + Number(tank.points[tank.points.length - 1]?.fillPercent || 0), 0) / groupedTanks.length
      : 0;
    return {
      tanks: groupedTanks.length,
      rows: totalRows,
      averageFill
    };
  }, [groupedTanks]);

  return (
      <Stack spacing={3}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5}>
        <div>
          <Typography variant={isMobile ? "h5" : "h4"}>Tank Charts</Typography>
          {!isMobile ? (
            <Typography color="text.secondary" variant="body2">
              Phone-first trend review. Start with one tank, see the gauge and trend immediately, and expand across the site on larger screens.
            </Typography>
          ) : null}
        </div>
        {!isMobile ? (
          <Stack direction={{ xs: "row", sm: "row" }} spacing={1.25} flexWrap="wrap" useFlexGap>
            <Chip icon={<TimelineIcon />} label={`${summary.rows} rows`} />
            <Chip icon={<OpacityIcon />} label={`Avg ${formatPercent(summary.averageFill)}`} />
          </Stack>
        ) : null}
      </Stack>

      {!isMobile ? (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card><CardContent><Typography variant="caption" color="text.secondary">Visible Tanks</Typography><Typography variant="h4">{summary.tanks}</Typography></CardContent></Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card><CardContent><Typography variant="caption" color="text.secondary">Time Range</Typography><Typography variant="h4">{rangeOptions.find((option) => option.value === range)?.label || range}</Typography></CardContent></Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card><CardContent><Typography variant="caption" color="text.secondary">Latest Anchor</Typography><Typography variant="body1" fontWeight={700}>{anchorTs ? formatDateTime(anchorTs) : "-"}</Typography></CardContent></Card>
          </Grid>
        </Grid>
      ) : null}

      <Card>
        <CardContent>
          {isMobile ? (
            <Stack spacing={1.5}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Chip label={selectedSiteId ? "Location selected" : "Choose a location"} />
                <Button
                  size="small"
                  startIcon={<FilterListIcon />}
                  onClick={() => setMobileFiltersOpen((open) => !open)}
                >
                  {mobileFiltersOpen ? "Hide filters" : "Filters"}
                </Button>
              </Stack>
              <Collapse in={mobileFiltersOpen}>
                <Grid container spacing={1.5}>
                  <Grid size={12}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Location</InputLabel>
                      <Select value={selectedSiteId} label="Location" onChange={(event) => setSelectedSiteId(event.target.value)}>
                        <MenuItem value="">Select a Location</MenuItem>
                        {sites.map((site) => (
                          <MenuItem key={site.id} value={site.id}>{site.siteCode} - {site.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={12}>
                    <FormControl fullWidth size="small" disabled={!groupedTanks.length}>
                      <InputLabel>Focused Tank</InputLabel>
                      <Select
                        value={selectedTankId}
                        label="Focused Tank"
                        onChange={(event) => {
                          setSelectedTankId(event.target.value);
                          setMobileView(event.target.value ? "detail" : "list");
                        }}
                      >
                        {groupedTanks.map((tank) => (
                          <MenuItem key={tank.tankId} value={tank.tankId}>{tank.label}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={12}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Range</InputLabel>
                      <Select value={range} label="Range" onChange={(event) => setRange(event.target.value)}>
                        {rangeOptions.map((option) => (
                          <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </Collapse>
            </Stack>
          ) : (
            <Grid container spacing={1.5}>
              <Grid size={{ xs: 12, md: 5 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Location</InputLabel>
                  <Select value={selectedSiteId} label="Location" onChange={(event) => setSelectedSiteId(event.target.value)}>
                    <MenuItem value="">Select a Location</MenuItem>
                    {sites.map((site) => (
                      <MenuItem key={site.id} value={site.id}>{site.siteCode} - {site.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <FormControl fullWidth size="small" disabled={!groupedTanks.length}>
                  <InputLabel>Focused Tank</InputLabel>
                  <Select value={selectedTankId} label="Focused Tank" onChange={(event) => setSelectedTankId(event.target.value)}>
                    {groupedTanks.map((tank) => (
                      <MenuItem key={tank.tankId} value={tank.tankId}>{tank.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Range</InputLabel>
                  <Select value={range} label="Range" onChange={(event) => setRange(event.target.value)}>
                    {rangeOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          )}
          <Typography color="text.secondary" sx={{ mt: 2 }}>
            {siteDetail
              ? `${siteDetail.address || "Address n/a"} ${siteDetail.postalCode || ""}`.trim()
              : "Select a location to load all tank charts for that site."}
          </Typography>
        </CardContent>
      </Card>

      {error ? <Alert severity="error">{error}</Alert> : null}

      {loading ? (
        <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 220 }}>
          <CircularProgress />
        </Stack>
      ) : !selectedSiteId ? (
        <Card><CardContent><Typography color="text.secondary">Select a location to view tank trend charts.</Typography></CardContent></Card>
      ) : groupedTanks.length === 0 ? (
        <Card><CardContent><Typography color="text.secondary">No tanks are available for the selected location.</Typography></CardContent></Card>
      ) : isMobile ? (
        <Stack spacing={2}>
          {mobileView === "detail" && selectedTank ? (
            <Stack spacing={2}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Button startIcon={<ArrowBackIcon />} onClick={() => setMobileView("list")}>
                  Back to tanks
                </Button>
                <Chip label={`Tank ${selectedTank.atgTankId}`} />
              </Stack>
              <TankChartDetail tank={selectedTank} />
              <Button
                variant="outlined"
                startIcon={<TableRowsIcon />}
                onClick={() => navigate(`/tank-information?siteId=${encodeURIComponent(selectedSiteId)}&tankId=${encodeURIComponent(selectedTank.tankId)}`)}
              >
                Open Tank Information
              </Button>
            </Stack>
          ) : (
            <Stack spacing={1.5}>
              {groupedTanks.map((tank) => (
                <MobileTankSelectorCard
                  key={tank.tankId}
                  tank={tank}
                  selected={selectedTank?.tankId === tank.tankId}
                  onClick={() => {
                    setSelectedTankId(tank.tankId);
                    setMobileView("detail");
                  }}
                />
              ))}
            </Stack>
          )}
        </Stack>
      ) : (
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, xl: 4 }}>
            <Stack spacing={1.5}>
              {groupedTanks.map((tank) => (
                <MobileTankSelectorCard
                  key={tank.tankId}
                  tank={tank}
                  selected={selectedTank?.tankId === tank.tankId}
                  onClick={() => setSelectedTankId(tank.tankId)}
                />
              ))}
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, xl: 8 }}>
            <TankChartDetail tank={selectedTank} />
          </Grid>
        </Grid>
      )}
    </Stack>
  );
}
