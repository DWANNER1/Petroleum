import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Divider,
  Grid,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  TextareaAutosize,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import RouterIcon from "@mui/icons-material/Router";
import OilBarrelIcon from "@mui/icons-material/OilBarrel";
import PaymentsIcon from "@mui/icons-material/Payments";
import { api } from "../api";
import { SiteMap } from "../components/SiteMap";

const FILTERS = {
  all: "all",
  critical: "critical",
  warning: "warning"
};

function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function formatDateTime(value) {
  if (!value) return "No signal";
  return new Date(value).toLocaleString();
}

function statusColor(value) {
  if (value >= 0.95) return "success";
  if (value >= 0.8) return "warning";
  return "error";
}

function siteHealth(site) {
  const expected = Number(site.pumpSidesExpected || 0);
  const connected = Number(site.pumpSidesConnected || 0);
  if (!expected) return 0;
  return connected / expected;
}

function buildRegionRows(sites) {
  const buckets = new Map();
  for (const site of sites) {
    const key = site.region || "Unassigned";
    if (!buckets.has(key)) {
      buckets.set(key, {
        region: key,
        sites: 0,
        critical: 0,
        warning: 0,
        connected: 0,
        expected: 0
      });
    }
    const bucket = buckets.get(key);
    bucket.sites += 1;
    bucket.critical += Number(site.criticalCount || 0);
    bucket.warning += Number(site.warnCount || 0);
    bucket.connected += Number(site.pumpSidesConnected || 0);
    bucket.expected += Number(site.pumpSidesExpected || 0);
  }

  return [...buckets.values()]
    .map((bucket) => ({
      ...bucket,
      health: bucket.expected ? bucket.connected / bucket.expected : 0
    }))
    .sort((a, b) => b.critical - a.critical || b.warning - a.warning || a.region.localeCompare(b.region));
}

function buildAttentionFeed(sites) {
  return [...sites]
    .sort((a, b) => {
      const aScore = Number(a.criticalCount || 0) * 100 + Number(a.warnCount || 0);
      const bScore = Number(b.criticalCount || 0) * 100 + Number(b.warnCount || 0);
      return bScore - aScore;
    })
    .slice(0, 8);
}

function buildConnectivityFeed(sites) {
  return [...sites]
    .sort((a, b) => siteHealth(a) - siteHealth(b))
    .slice(0, 8);
}

function initialAgentLog(site) {
  if (!site) return [];
  return [
    "Microsoft Windows [Version 10.0.19045.0]",
    "(c) WannLynx Petroleum local agent console",
    "",
    `C:\\Sites\\${site.siteCode}> connected to ${site.name}`,
    `C:\\Sites\\${site.siteCode}> ready for local AI prompts`
  ];
}

function SummaryCard({ icon, label, value, tone = "default", caption, onClick, active = false }) {
  const borderColor = tone === "critical" ? "#d14343" : tone === "warning" ? "#c77700" : tone === "success" ? "#2e7d32" : "rgba(15, 23, 42, 0.08)";
  const content = (
    <CardContent>
      <Stack spacing={1.5}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="body2" color="text.secondary">{label}</Typography>
          {icon}
        </Stack>
        <Typography variant="h4">{value}</Typography>
        {caption ? <Typography variant="body2" color="text.secondary">{caption}</Typography> : null}
      </Stack>
    </CardContent>
  );

  return (
    <Card
      sx={{
        height: "100%",
        borderColor: active ? "primary.main" : borderColor,
        borderWidth: active ? 2 : 1,
        borderStyle: "solid",
        backgroundColor: active ? "rgba(11, 95, 255, 0.04)" : "background.paper"
      }}
    >
      {onClick ? (
        <CardActionArea onClick={onClick} sx={{ height: "100%", alignItems: "stretch" }}>
          {content}
        </CardActionArea>
      ) : content}
    </Card>
  );
}

export function DashboardPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [sites, setSites] = useState([]);
  const [alliedSummary, setAlliedSummary] = useState(null);
  const [error, setError] = useState("");
  const [alliedError, setAlliedError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [filter, setFilter] = useState(FILTERS.all);
  const [agentDraft, setAgentDraft] = useState("");
  const [agentLog, setAgentLog] = useState([]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const rows = await api.getSites();
        if (!ignore) setSites(rows);
      } catch (nextError) {
        if (!ignore) setError(nextError instanceof Error ? nextError.message : String(nextError || "Unable to load portfolio"));
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    async function loadAllied() {
      try {
        const payload = await api.getAlliedPortfolioSummary({ preset: "30d" });
        if (!ignore) {
          setAlliedSummary(payload);
          setAlliedError("");
        }
      } catch (nextError) {
        if (!ignore) {
          setAlliedSummary(null);
          setAlliedError(nextError instanceof Error ? nextError.message : String(nextError || "Unable to load Allied summary"));
        }
      }
    }
    loadAllied();
    return () => {
      ignore = true;
    };
  }, []);

  const filteredSites = useMemo(() => {
    return sites.filter((site) => {
      if (filter === FILTERS.critical) return Number(site.criticalCount || 0) > 0;
      if (filter === FILTERS.warning) return Number(site.warnCount || 0) > 0;
      return true;
    });
  }, [sites, filter]);

  const selectedSite = useMemo(
    () => filteredSites.find((site) => site.id === selectedSiteId) || sites.find((site) => site.id === selectedSiteId) || null,
    [filteredSites, selectedSiteId, sites]
  );

  useEffect(() => {
    setAgentDraft("");
    setAgentLog(initialAgentLog(selectedSite));
  }, [selectedSite]);

  const totals = useMemo(() => {
    return sites.reduce(
      (acc, site) => {
        acc.critical += Number(site.criticalCount || 0);
        acc.warning += Number(site.warnCount || 0);
        acc.expected += Number(site.pumpSidesExpected || 0);
        acc.connected += Number(site.pumpSidesConnected || 0);
        if (site.atgLastSeenAt) acc.atgReporting += 1;
        return acc;
      },
      { critical: 0, warning: 0, expected: 0, connected: 0, atgReporting: 0 }
    );
  }, [sites]);

  const networkHealth = totals.expected ? totals.connected / totals.expected : 0;
  const regionRows = useMemo(() => buildRegionRows(filteredSites), [filteredSites]);
  const attentionFeed = useMemo(() => buildAttentionFeed(filteredSites), [filteredSites]);
  const connectivityFeed = useMemo(() => buildConnectivityFeed(filteredSites), [filteredSites]);

  function submitAgentPrompt(event) {
    event.preventDefault();
    const prompt = agentDraft.trim();
    if (!prompt || !selectedSite) return;
    setAgentLog((current) => [
      ...current,
      `C:\\Sites\\${selectedSite.siteCode}> ${prompt}`,
      `Local AI agent: preview shell only. Wire this panel to the real local agent workflow later for ${selectedSite.name}.`
    ]);
    setAgentDraft("");
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }}>
        <div>
          <Typography variant="h4">Portfolio Command Center</Typography>
          <Typography color="text.secondary">
            Dense, responsive operations view for the parallel MUI frontend. This is the track to bring the current portfolio into a more polished desktop and mobile layout.
          </Typography>
        </div>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <TextField
            select
            size="small"
            label="Filter"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value={FILTERS.all}>All sites</MenuItem>
            <MenuItem value={FILTERS.critical}>Critical only</MenuItem>
            <MenuItem value={FILTERS.warning}>Warning only</MenuItem>
          </TextField>
          <Chip color="primary" label={`Visible sites: ${filteredSites.length}`} />
        </Stack>
      </Stack>

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
          <SummaryCard
            icon={<WarningAmberIcon color="error" />}
            label="Critical Alerts"
            value={totals.critical}
            tone="critical"
            caption="Raised critical events across visible sites"
            onClick={() => {
              setFilter(FILTERS.critical);
              setSelectedSiteId("");
            }}
            active={filter === FILTERS.critical}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
          <SummaryCard
            icon={<WarningAmberIcon color="warning" />}
            label="Warning Alerts"
            value={totals.warning}
            tone="warning"
            caption="Raised warning events across visible sites"
            onClick={() => {
              setFilter(FILTERS.warning);
              setSelectedSiteId("");
            }}
            active={filter === FILTERS.warning}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
          <SummaryCard
            icon={<RouterIcon color={statusColor(networkHealth)} />}
            label="Pump Connectivity"
            value={formatPercent(networkHealth)}
            tone={statusColor(networkHealth) === "success" ? "success" : statusColor(networkHealth) === "warning" ? "warning" : "critical"}
            caption={`${totals.connected}/${totals.expected} connected pump sides`}
            onClick={() => {
              setFilter(FILTERS.all);
              setSelectedSiteId(connectivityFeed[0]?.id || "");
            }}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
          <SummaryCard
            icon={<OilBarrelIcon color="primary" />}
            label="ATG Reporting"
            value={`${totals.atgReporting}/${sites.length}`}
            caption="Sites with an ATG heartbeat recorded"
            onClick={() => {
              setFilter(FILTERS.all);
              setSelectedSiteId("");
            }}
            active={filter === FILTERS.all}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, xl: 8 }}>
          <Card sx={{ mb: 2.5, overflow: "hidden" }}>
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ p: 2.5, pb: 1.5 }}>
                <Typography variant="h6">Portfolio Map</Typography>
                <Typography color="text.secondary">
                  Map-first overview of the visible site portfolio. Select a site from the map or table to focus the right-side detail panel.
                </Typography>
              </Box>
              <Box sx={{ height: { xs: 280, md: 360, xl: 420 }, borderTop: "1px solid rgba(15, 23, 42, 0.08)" }}>
                <SiteMap sites={filteredSites} selectedSiteId={selectedSiteId} onSelect={(site) => setSelectedSiteId(site.id)} />
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Stack spacing={2.5}>
                <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
                  <div>
                    <Typography variant="h6">Site Directory</Typography>
                    <Typography color="text.secondary">
                      Operations summary, connectivity, and alert posture across the portfolio.
                    </Typography>
                  </div>
                  <TextField
                    select
                    size="small"
                    label="Focused site"
                    value={selectedSiteId}
                    onChange={(event) => setSelectedSiteId(event.target.value)}
                    sx={{ minWidth: { xs: "100%", md: 260 } }}
                  >
                    <MenuItem value="">None selected</MenuItem>
                    {filteredSites.map((site) => (
                      <MenuItem key={site.id} value={site.id}>{site.siteCode} - {site.name}</MenuItem>
                    ))}
                  </TextField>
                </Stack>
                {isMobile ? (
                  <Stack spacing={1.5}>
                    {filteredSites.map((site) => {
                      const health = siteHealth(site);
                      return (
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
                                <Stack direction="row" justifyContent="space-between" spacing={1}>
                                  <div>
                                    <Typography fontWeight={700}>{site.name}</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {site.siteCode} · {site.region || "Unassigned"}
                                    </Typography>
                                  </div>
                                  <Stack direction="row" spacing={0.75}>
                                    <Chip size="small" color="error" variant="outlined" label={`C ${site.criticalCount || 0}`} />
                                    <Chip size="small" color="warning" variant="outlined" label={`W ${site.warnCount || 0}`} />
                                  </Stack>
                                </Stack>
                                <Typography variant="body2" color="text.secondary">
                                  {[site.address, site.postalCode].filter(Boolean).join(" ") || "No address"}
                                </Typography>
                                <Stack spacing={0.5}>
                                  <Stack direction="row" justifyContent="space-between">
                                    <Typography variant="body2">Pump Health</Typography>
                                    <Typography variant="body2">{formatPercent(health)}</Typography>
                                  </Stack>
                                  <LinearProgress variant="determinate" value={Math.max(0, Math.min(100, health * 100))} color={statusColor(health)} sx={{ height: 10, borderRadius: 999 }} />
                                </Stack>
                                <Typography variant="caption" color="text.secondary">
                                  ATG last seen: {formatDateTime(site.atgLastSeenAt)}
                                </Typography>
                              </Stack>
                            </CardContent>
                          </CardActionArea>
                        </Card>
                      );
                    })}
                  </Stack>
                ) : (
                  <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Site</TableCell>
                          <TableCell>Region</TableCell>
                          <TableCell>Address</TableCell>
                          <TableCell align="right">Critical</TableCell>
                          <TableCell align="right">Warn</TableCell>
                          <TableCell align="right">Pump Health</TableCell>
                          <TableCell>ATG Last Seen</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredSites.map((site) => {
                          const health = siteHealth(site);
                          return (
                            <TableRow
                              key={site.id}
                              hover
                              selected={selectedSiteId === site.id}
                              onClick={() => setSelectedSiteId(site.id)}
                              sx={{ cursor: "pointer" }}
                            >
                              <TableCell>
                                <Stack spacing={0.5}>
                                  <Typography fontWeight={600}>{site.name}</Typography>
                                  <Typography variant="caption" color="text.secondary">{site.siteCode}</Typography>
                                </Stack>
                              </TableCell>
                              <TableCell>{site.region || "Unassigned"}</TableCell>
                              <TableCell>{[site.address, site.postalCode].filter(Boolean).join(" ") || "No address"}</TableCell>
                              <TableCell align="right">{site.criticalCount || 0}</TableCell>
                              <TableCell align="right">{site.warnCount || 0}</TableCell>
                              <TableCell align="right" sx={{ minWidth: 140 }}>
                                <Stack spacing={0.5}>
                                  <Typography variant="body2">{formatPercent(health)}</Typography>
                                  <LinearProgress variant="determinate" value={Math.max(0, Math.min(100, health * 100))} color={statusColor(health)} />
                                </Stack>
                              </TableCell>
                              <TableCell>{formatDateTime(site.atgLastSeenAt)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, xl: 4 }}>
          <Stack spacing={2.5}>
            <Card>
              <CardContent>
                <Stack spacing={1.5}>
                  <Typography variant="h6">Focused Site</Typography>
                  {selectedSite ? (
                    <>
                      <Typography variant="h5">{selectedSite.name}</Typography>
                      <Typography color="text.secondary">{selectedSite.siteCode} · {selectedSite.region || "Unassigned"}</Typography>
                      <Divider />
                      <Typography variant="body2">Address: {[selectedSite.address, selectedSite.postalCode].filter(Boolean).join(" ") || "No address"}</Typography>
                      <Typography variant="body2">Critical alerts: {selectedSite.criticalCount || 0}</Typography>
                      <Typography variant="body2">Warning alerts: {selectedSite.warnCount || 0}</Typography>
                      <Typography variant="body2">Pump sides: {selectedSite.pumpSidesConnected || 0}/{selectedSite.pumpSidesExpected || 0}</Typography>
                      <Typography variant="body2">ATG last seen: {formatDateTime(selectedSite.atgLastSeenAt)}</Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Chip color="error" variant="outlined" label={`Critical ${selectedSite.criticalCount || 0}`} />
                        <Chip color="warning" variant="outlined" label={`Warn ${selectedSite.warnCount || 0}`} />
                        <Chip color={statusColor(siteHealth(selectedSite))} variant="outlined" label={`Connectivity ${formatPercent(siteHealth(selectedSite))}`} />
                      </Stack>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Button size="small" variant="outlined">Open Site Detail</Button>
                        <Button size="small" variant="outlined">Open Layout</Button>
                        <Button size="small" variant="contained">Open Alerts</Button>
                      </Stack>
                    </>
                  ) : (
                    <Typography color="text.secondary">
                      Select a site from the table to populate the detail panel.
                    </Typography>
                  )}
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Stack spacing={1.5}>
                  <Typography variant="h6">Operations Snapshot</Typography>
                  {selectedSite ? (
                    <>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">Alert load</Typography>
                        <Typography variant="body2">{Number(selectedSite.criticalCount || 0) + Number(selectedSite.warnCount || 0)} open</Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={Math.max(0, Math.min(100, ((Number(selectedSite.criticalCount || 0) * 20) + (Number(selectedSite.warnCount || 0) * 10))))}
                        color={Number(selectedSite.criticalCount || 0) > 0 ? "error" : Number(selectedSite.warnCount || 0) > 0 ? "warning" : "success"}
                        sx={{ height: 10, borderRadius: 999 }}
                      />
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">Pump network</Typography>
                        <Typography variant="body2">{selectedSite.pumpSidesConnected || 0}/{selectedSite.pumpSidesExpected || 0}</Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={Math.max(0, Math.min(100, siteHealth(selectedSite) * 100))}
                        color={statusColor(siteHealth(selectedSite))}
                        sx={{ height: 10, borderRadius: 999 }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        Use this panel for quick operational triage before opening the full site screen.
                      </Typography>
                    </>
                  ) : (
                    <Typography color="text.secondary">
                      Select a site to see a quick operational snapshot.
                    </Typography>
                  )}
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Stack spacing={1.5}>
                  <Typography variant="h6">Local Agent Console</Typography>
                  <Box
                    sx={{
                      borderRadius: 2,
                      bgcolor: "#09111f",
                      color: "#d3e6ff",
                      px: 2,
                      py: 1.5,
                      fontFamily: "Consolas, 'Courier New', monospace",
                      minHeight: 180
                    }}
                  >
                    {agentLog.length ? agentLog.map((line, index) => (
                      <Typography key={`${selectedSiteId || "none"}-${index}`} variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                        {line || "\u00A0"}
                      </Typography>
                    )) : (
                      <Typography variant="body2">Select a site to start a local site console session.</Typography>
                    )}
                  </Box>
                  <Box component="form" onSubmit={submitAgentPrompt}>
                    <TextareaAutosize
                      minRows={2}
                      value={agentDraft}
                      onChange={(event) => setAgentDraft(event.target.value)}
                      placeholder={selectedSite ? `Ask the local AI agent about ${selectedSite.siteCode}` : "Select a site first"}
                      style={{
                        width: "100%",
                        resize: "vertical",
                        borderRadius: 12,
                        border: "1px solid rgba(15, 23, 42, 0.16)",
                        padding: "12px 14px",
                        fontFamily: "inherit"
                      }}
                    />
                    <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}>
                      <Button type="submit" variant="contained" disabled={!selectedSite || !agentDraft.trim()}>
                        Send Prompt
                      </Button>
                    </Stack>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Stack spacing={1.5}>
                  <Typography variant="h6">Top Attention Sites</Typography>
                  <List disablePadding>
                    {attentionFeed.map((site) => (
                      <ListItem
                        key={site.id}
                        disablePadding
                        secondaryAction={<Chip size="small" color={Number(site.criticalCount || 0) > 0 ? "error" : "warning"} label={`${Number(site.criticalCount || 0) + Number(site.warnCount || 0)} alerts`} />}
                        sx={{ py: 0.75 }}
                      >
                        <ListItemText
                          primary={site.name}
                          secondary={`${site.siteCode} · ${site.region || "Unassigned"}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6">Connectivity Watchlist</Typography>
                <Typography color="text.secondary">
                  Lowest pump-side connection ratios in the currently visible portfolio.
                </Typography>
                {connectivityFeed.map((site) => {
                  const health = siteHealth(site);
                  return (
                    <Box key={site.id}>
                      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                        <Typography fontWeight={600}>{site.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {site.pumpSidesConnected || 0}/{site.pumpSidesExpected || 0}
                        </Typography>
                      </Stack>
                      <LinearProgress variant="determinate" value={Math.max(0, Math.min(100, health * 100))} color={statusColor(health)} sx={{ height: 10, borderRadius: 999 }} />
                    </Box>
                  );
                })}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6">Regional Rollup</Typography>
                <Typography color="text.secondary">
                  Region-level alert counts and connectivity posture for quick management review.
                </Typography>
                {isMobile ? (
                  <Stack spacing={1.25}>
                    {regionRows.map((row) => (
                      <Card key={row.region} variant="outlined">
                        <CardContent>
                          <Stack spacing={1}>
                            <Stack direction="row" justifyContent="space-between" spacing={1}>
                              <Typography fontWeight={700}>{row.region}</Typography>
                              <Chip size="small" label={`${row.sites} sites`} />
                            </Stack>
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                              <Chip size="small" color="error" variant="outlined" label={`Critical ${row.critical}`} />
                              <Chip size="small" color="warning" variant="outlined" label={`Warn ${row.warning}`} />
                              <Chip size="small" color={statusColor(row.health)} variant="outlined" label={`Health ${formatPercent(row.health)}`} />
                            </Stack>
                          </Stack>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                ) : (
                  <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Region</TableCell>
                          <TableCell align="right">Sites</TableCell>
                          <TableCell align="right">Critical</TableCell>
                          <TableCell align="right">Warn</TableCell>
                          <TableCell align="right">Health</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {regionRows.map((row) => (
                          <TableRow key={row.region}>
                            <TableCell>{row.region}</TableCell>
                            <TableCell align="right">{row.sites}</TableCell>
                            <TableCell align="right">{row.critical}</TableCell>
                            <TableCell align="right">{row.warning}</TableCell>
                            <TableCell align="right">{formatPercent(row.health)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 4 }}>
          <SummaryCard
            icon={<PaymentsIcon color="primary" />}
            label="Allied Sales (30D)"
            value={alliedSummary ? formatMoney(alliedSummary.kpis.totalSales) : "--"}
            caption={alliedSummary ? `${alliedSummary.kpis.totalTransactions} transactions across ${alliedSummary.kpis.sitesWithTransactions} active sites` : "Allied summary pending"}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <SummaryCard
            icon={<PaymentsIcon color="primary" />}
            label="Completion Rate (30D)"
            value={alliedSummary ? formatPercent(alliedSummary.kpis.completionRate) : "--"}
            caption={alliedSummary ? `Abort rate ${formatPercent(alliedSummary.kpis.abortRate)}` : "Allied summary pending"}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <SummaryCard
            icon={<PaymentsIcon color="primary" />}
            label="Flagged Rate (30D)"
            value={alliedSummary ? formatPercent(alliedSummary.kpis.flaggedRate) : "--"}
            caption={alliedSummary ? `Gallons ${Number(alliedSummary.kpis.totalGallons || 0).toFixed(1)}` : "Allied summary pending"}
          />
        </Grid>
      </Grid>

      {alliedError ? <Alert severity="info">{alliedError}</Alert> : null}

      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
            <div>
              <Typography variant="h6">Migration Notes</Typography>
              <Typography color="text.secondary">
                This page is the target shell for reproducing the current portfolio with a more professional MUI system. Next sensible additions are a portfolio map panel, work-queue snapshots, and embedded chart widgets.
              </Typography>
            </div>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
              <Button variant="outlined" onClick={() => setSelectedSiteId("")}>Clear Focus</Button>
              <Button variant="contained" onClick={() => window.location.reload()}>Refresh Dashboard</Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
