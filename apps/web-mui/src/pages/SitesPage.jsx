import { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  LinearProgress,
  Stack,
  Typography
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import FlashOnIcon from "@mui/icons-material/FlashOn";
import { api } from "../api";
import { SiteAlertsDialog } from "../components/SiteAlertsDialog";

function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function formatCount(value) {
  return Number(value || 0).toLocaleString();
}

function formatVolume(value) {
  return `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} Gal`;
}

function formatDateTime(value) {
  if (!value) return "No signal";
  return new Date(value).toLocaleString();
}

function siteHealth(site) {
  const expected = Number(site?.pumpSidesExpected || 0);
  const connected = Number(site?.pumpSidesConnected || 0);
  if (!expected) return 0;
  return connected / expected;
}

function statusColor(value) {
  if (value >= 0.95) return "success";
  if (value >= 0.8) return "warning";
  return "error";
}

function buildTankGaugeOption(fillPercent) {
  const safeValue = Math.max(0, Math.min(100, Number(fillPercent) || 0));
  return {
    animation: false,
    series: [
      {
        type: "gauge",
        startAngle: 205,
        endAngle: -25,
        min: 0,
        max: 100,
        center: ["50%", "63%"],
        radius: "96%",
        axisLine: {
          lineStyle: {
            width: 14,
            color: [
              [0.15, "#d14343"],
              [0.35, "#c77700"],
              [1, "#2e7d32"]
            ]
          }
        },
        pointer: {
          length: "68%",
          width: 5,
          itemStyle: { color: "#0b5fff" }
        },
        anchor: {
          show: true,
          size: 10,
          itemStyle: {
            color: "#173447",
            borderColor: "#ffffff",
            borderWidth: 2
          }
        },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        detail: {
          valueAnimation: false,
          offsetCenter: [0, "30%"],
          fontSize: 15,
          fontWeight: 700,
          color: "#173447",
          formatter: "{value}%"
        },
        title: {
          offsetCenter: [0, "44%"],
          color: "#59758a",
          fontSize: 9
        },
        data: [{ value: Number(safeValue.toFixed(1)), name: "fill" }]
      }
    ]
  };
}

function AlertBadge({ type, count, onClick }) {
  if (!Number(count || 0)) return null;

  const isCritical = type === "critical";
  const Icon = isCritical ? FlashOnIcon : WarningAmberIcon;
  const accent = isCritical ? "#d14343" : "#c77700";

  return (
    <Chip
      size="small"
      icon={<Icon sx={{ color: `${accent} !important` }} />}
      label={`${count || 0}`}
      variant="outlined"
      onClick={onClick}
      sx={{
        color: accent,
        borderColor: isCritical ? "rgba(209,67,67,0.4)" : "rgba(199,119,0,0.45)",
        backgroundColor: isCritical ? "rgba(209,67,67,0.06)" : "rgba(199,119,0,0.10)",
        cursor: onClick ? "pointer" : "default",
        "& .MuiChip-label": {
          px: 1,
          fontWeight: 700
        }
      }}
    />
  );
}

function SitePreview({ site, summary, loading, error, isMobile, onBack, onOpenAlerts }) {
  const tankPreview = (site?.tanks || []).slice(0, 3);
  const tankCount = site?.tanks?.length || 0;
  const transactionKpis = summary?.kpis || null;

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Typography color="text.secondary">Loading site detail...</Typography>
        </CardContent>
      </Card>
    );
  }

  if (!site) {
    return (
      <Card>
        <CardContent>
          <Typography color="text.secondary">Tap a site to see pumps, tanks, and transactions.</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Stack spacing={2}>
      {isMobile ? <Button onClick={onBack}>Back to Sites</Button> : null}
      {error ? <Alert severity="warning">{error}</Alert> : null}

      <Card>
        <CardContent>
          <Stack spacing={1.5}>
            <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
              <div>
                <Typography variant="overline" color="text.secondary">Site Lens</Typography>
                <Typography variant="h5">{site.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {[site.siteCode, site.region || "Unassigned"].filter(Boolean).join(" · ")}
                </Typography>
              </div>
              <Stack direction="row" spacing={0.75}>
                <AlertBadge type="critical" count={site.criticalCount || 0} onClick={() => onOpenAlerts?.(site, "critical")} />
                <AlertBadge type="warning" count={site.warnCount || 0} onClick={() => onOpenAlerts?.(site, "warning")} />
              </Stack>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {[site.address, site.postalCode].filter(Boolean).join(" ") || "No address"}
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={1.5}>
            <Typography variant="h6">Pumps</Typography>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">Connected sides</Typography>
              <Typography variant="h4">{site.pumpSidesConnected || 0}</Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={Math.max(0, Math.min(100, siteHealth(site) * 100))}
              color={statusColor(siteHealth(site))}
              sx={{ height: 10, borderRadius: 999 }}
            />
            <Typography variant="caption" color="text.secondary">
              Red/yellow on the line indicates missing sides. ATG last seen: {formatDateTime(site.atgLastSeenAt)}
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={1.5}>
            <Typography variant="h6">Tank Snapshot</Typography>
            {tankPreview.length ? (
              <Grid container spacing={1.5}>
                {tankPreview.map((tank) => (
                  <Grid key={tank.id} size={{ xs: 12, sm: 4 }}>
                    <Card variant="outlined">
                      <CardContent>
                        <Stack spacing={1}>
                          <Typography fontWeight={700}>{tank.label}</Typography>
                          <Typography variant="caption" color="text.secondary">{tank.product || "Product n/a"}</Typography>
                          {isMobile ? (
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <Box sx={{ height: 84, width: 120, ml: -1, flexShrink: 0 }}>
                                <ReactECharts option={buildTankGaugeOption(tank.fillPercent ?? tank.currentFillPercent ?? 0)} style={{ height: "100%", width: "100%" }} opts={{ renderer: "svg" }} />
                              </Box>
                              <Typography variant="body2" color="text.secondary">
                                {formatVolume(tank.currentVolumeLiters ?? tank.fuelVolumeLiters ?? tank.inventoryVolumeLiters ?? 0)} left
                              </Typography>
                            </Stack>
                          ) : (
                            <>
                              <Box sx={{ height: 120 }}>
                                <ReactECharts option={buildTankGaugeOption(tank.fillPercent ?? tank.currentFillPercent ?? 0)} style={{ height: "100%", width: "100%" }} opts={{ renderer: "svg" }} />
                              </Box>
                              <Typography variant="body2" color="text.secondary">
                                {formatVolume(tank.currentVolumeLiters ?? tank.fuelVolumeLiters ?? tank.inventoryVolumeLiters ?? 0)} left
                              </Typography>
                            </>
                          )}
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Typography color="text.secondary">No tank assets loaded for this site.</Typography>
            )}
            {tankPreview.length && tankCount > tankPreview.length ? (
              <Typography variant="caption" color="text.secondary">+{tankCount - tankPreview.length} more tanks</Typography>
            ) : null}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={1.5}>
            <Typography variant="h6">Transaction Pulse</Typography>
            {transactionKpis ? (
              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12 }}>
                  <Typography variant="caption" color="text.secondary">Transactions</Typography>
                  <Typography variant="h5">{formatCount(transactionKpis.totalTransactions)}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">Sales</Typography>
                  <Typography variant="h6">{formatMoney(transactionKpis.totalSales)}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">Gallons</Typography>
                  <Typography variant="h6">{Number(transactionKpis.totalGallons || 0).toFixed(1)}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">Completion</Typography>
                  <Typography variant="h6">{formatPercent(transactionKpis.completionRate)}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">Avg Ticket</Typography>
                  <Typography variant="h6">{formatMoney(transactionKpis.averageTicket)}</Typography>
                </Grid>
              </Grid>
            ) : (
              <Typography color="text.secondary">No transaction summary is available for this site yet.</Typography>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

export function SitesPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [siteDetail, setSiteDetail] = useState(null);
  const [siteSummary, setSiteSummary] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [mobileView, setMobileView] = useState("list");
  const [alertsDialog, setAlertsDialog] = useState({ open: false, severity: "", siteId: "", siteName: "" });

  useEffect(() => {
    let ignore = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const result = await api.getSites();
        if (!ignore) {
          setSites(result);
          if (!selectedSiteId && result[0]?.id) setSelectedSiteId(result[0].id);
        }
      } catch (nextError) {
        if (!ignore) {
          setError(nextError instanceof Error ? nextError.message : String(nextError || "Unable to load sites"));
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [selectedSiteId]);

  useEffect(() => {
    let ignore = false;
    if (!selectedSiteId) {
      setSiteDetail(null);
      setSiteSummary(null);
      return () => {
        ignore = true;
      };
    }

    async function loadDetail() {
      setDetailLoading(true);
      setDetailError("");
      try {
        const [detail, summary] = await Promise.all([
          api.getSite(selectedSiteId),
          api.getAlliedTransactionsSummary(selectedSiteId, { preset: "30d" }).catch(() => null)
        ]);
        if (!ignore) {
          setSiteDetail(detail);
          setSiteSummary(summary);
        }
      } catch (nextError) {
        if (!ignore) {
          setSiteDetail(null);
          setSiteSummary(null);
          setDetailError(nextError instanceof Error ? nextError.message : String(nextError || "Unable to load site detail"));
        }
      } finally {
        if (!ignore) setDetailLoading(false);
      }
    }

    loadDetail();
    return () => {
      ignore = true;
    };
  }, [selectedSiteId]);

  const orderedSites = useMemo(
    () => [...sites].sort((a, b) => Number(b.criticalCount || 0) - Number(a.criticalCount || 0) || Number(b.warnCount || 0) - Number(a.warnCount || 0) || a.name.localeCompare(b.name)),
    [sites]
  );

  function openAlertsDialog(site, severity) {
    if (!site || !severity) return;
    setAlertsDialog({ open: true, severity, siteId: site.id, siteName: site.name });
  }

  if (loading) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 240 }}>
        <CircularProgress />
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h4">Sites</Typography>
        <Typography color="text.secondary">
          Tap a site card to open the same operational preview used in the dashboard.
        </Typography>
      </div>

      {error ? <Alert severity="error">{error}</Alert> : null}

      {isMobile ? (
        mobileView === "detail" ? (
          <SitePreview
            site={siteDetail}
            summary={siteSummary}
            loading={detailLoading}
            error={detailError}
            isMobile
            onBack={() => setMobileView("list")}
            onOpenAlerts={openAlertsDialog}
          />
        ) : (
          <Stack spacing={1.5}>
            {orderedSites.map((site) => (
              <Card
                key={site.id}
                variant="outlined"
                sx={{
                  borderColor: selectedSiteId === site.id ? "primary.main" : "divider",
                  borderWidth: selectedSiteId === site.id ? 2 : 1
                }}
              >
                <CardActionArea
                  onClick={() => {
                    setSelectedSiteId(site.id);
                    setMobileView("detail");
                  }}
                >
                  <CardContent>
                    <Stack spacing={1.25}>
                      <Stack direction="row" justifyContent="space-between" spacing={1}>
                        <div>
                          <Typography fontWeight={700}>{site.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {[site.siteCode, site.region || "Unassigned"].filter(Boolean).join(" · ")}
                          </Typography>
                        </div>
                        <Stack direction="row" spacing={0.75}>
                          <AlertBadge type="critical" count={site.criticalCount || 0} onClick={(event) => { event.stopPropagation(); openAlertsDialog(site, "critical"); }} />
                          <AlertBadge type="warning" count={site.warnCount || 0} onClick={(event) => { event.stopPropagation(); openAlertsDialog(site, "warning"); }} />
                        </Stack>
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {[site.address, site.postalCode].filter(Boolean).join(" ") || "No address"}
                      </Typography>
                    </Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            ))}
          </Stack>
        )
      ) : (
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, xl: 5 }}>
            <Stack spacing={1.5}>
              {orderedSites.map((site) => (
                <Card
                  key={site.id}
                  variant="outlined"
                  sx={{
                    borderColor: selectedSiteId === site.id ? "primary.main" : "divider",
                    borderWidth: selectedSiteId === site.id ? 2 : 1
                  }}
                >
                  <CardActionArea onClick={() => setSelectedSiteId(site.id)}>
                    <CardContent>
                      <Stack spacing={1.25}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                          <div>
                            <Typography variant="h6">{site.name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {[site.siteCode, site.region || "Unassigned"].filter(Boolean).join(" · ")}
                            </Typography>
                          </div>
                          <Stack direction="row" spacing={0.75}>
                            <AlertBadge
                              type="critical"
                              count={site.criticalCount || 0}
                              onClick={(event) => {
                                event.stopPropagation();
                                openAlertsDialog(site, "critical");
                              }}
                            />
                            <AlertBadge
                              type="warning"
                              count={site.warnCount || 0}
                              onClick={(event) => {
                                event.stopPropagation();
                                openAlertsDialog(site, "warning");
                              }}
                            />
                          </Stack>
                        </Stack>
                        <Typography color="text.secondary">{site.address || "No address"}</Typography>
                      </Stack>
                    </CardContent>
                  </CardActionArea>
                </Card>
              ))}
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, xl: 7 }}>
            <SitePreview
              site={siteDetail}
              summary={siteSummary}
              loading={detailLoading}
              error={detailError}
              isMobile={false}
              onBack={() => {}}
              onOpenAlerts={openAlertsDialog}
            />
          </Grid>
        </Grid>
      )}
      <SiteAlertsDialog
        open={alertsDialog.open}
        onClose={() => setAlertsDialog({ open: false, severity: "", siteId: "", siteName: "" })}
        siteId={alertsDialog.siteId}
        siteName={alertsDialog.siteName}
        severity={alertsDialog.severity}
      />
    </Stack>
  );
}
