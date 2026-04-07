import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControlLabel,
  Grid,
  LinearProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Checkbox,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography
} from "@mui/material";
import { api } from "../api";

const EMPTY_BRANDING = { name: "", logoUrl: "" };
const EMPTY_OPIS = { username: "", password: "" };
const EMPTY_EIA = { apiKey: "" };
const EMPTY_USER = { name: "", email: "", password: "", role: "manager", jobberId: "", siteIds: [] };
const TABS = ["overview", "users", "branding", "credentials", "pricing"];

function statusTone(saved) {
  return saved ? "success" : "default";
}

function formatDateTime(value) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString();
}

function SummaryCard({ label, value, caption }) {
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary">{label}</Typography>
          <Typography variant="h5">{value}</Typography>
          {caption ? <Typography variant="caption" color="text.secondary">{caption}</Typography> : null}
        </Stack>
      </CardContent>
    </Card>
  );
}

function Section({ title, subtitle, children, action }) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
            <Box>
              <Typography variant="h6">{title}</Typography>
              {subtitle ? <Typography variant="body2" color="text.secondary">{subtitle}</Typography> : null}
            </Box>
            {action}
          </Stack>
          {children}
        </Stack>
      </CardContent>
    </Card>
  );
}

export function AdminPreviewPage({ user, jobber, onJobberUpdated }) {
  const [tab, setTab] = useState("overview");
  const [brandingForm, setBrandingForm] = useState(EMPTY_BRANDING);
  const [opisForm, setOpisForm] = useState(EMPTY_OPIS);
  const [eiaForm, setEiaForm] = useState(EMPTY_EIA);
  const [opisStatus, setOpisStatus] = useState(null);
  const [eiaStatus, setEiaStatus] = useState(null);
  const [pricingConfigs, setPricingConfigs] = useState([]);
  const [managementOverview, setManagementOverview] = useState(null);
  const [userForm, setUserForm] = useState(EMPTY_USER);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingBranding, setSavingBranding] = useState(false);
  const [savingOpis, setSavingOpis] = useState(false);
  const [savingEia, setSavingEia] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const canManage = user?.jobberRole === "admin" || user?.role === "system_manager";

  useEffect(() => {
    setBrandingForm({
      name: jobber?.name || "",
      logoUrl: jobber?.logoUrl || ""
    });
  }, [jobber]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      setLoading(true);
      try {
        const [nextOpisStatus, nextEiaStatus, nextPricingConfigs] = await Promise.all([
          api.getJobberOpisCredentialsStatus(),
          api.getJobberEiaCredentialsStatus(),
          api.getJobberPricingConfigs()
        ]);
        if (ignore) return;
        setOpisStatus(nextOpisStatus);
        setEiaStatus(nextEiaStatus);
        setPricingConfigs(Array.isArray(nextPricingConfigs) ? nextPricingConfigs : []);
        try {
          const nextManagementOverview = await api.getManagementOverview();
          if (!ignore) setManagementOverview(nextManagementOverview);
        } catch (_nextManagementError) {
          if (!ignore) setManagementOverview(null);
        }
        setError("");
      } catch (nextError) {
        if (!ignore) {
          setError(nextError instanceof Error ? nextError.message : String(nextError || "Unable to load admin workspace"));
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [jobber?.id]);

  const pricingSummary = useMemo(() => {
    const configs = pricingConfigs || [];
    const withCustomMargin = configs.filter((row) => Number(row.marginCents || row.margin || 0) !== 0).length;
    return {
      total: configs.length,
      withCustomMargin,
      markets: new Set(configs.map((row) => row.marketLabel || row.location || row.marketKey).filter(Boolean)).size
    };
  }, [pricingConfigs]);

  const managementUsers = useMemo(() => managementOverview?.users || [], [managementOverview]);
  const managementSites = useMemo(() => managementOverview?.sites || [], [managementOverview]);
  const isSystemScope = managementOverview?.scope === "system";
  const activeJobberId = managementOverview?.jobber?.id || jobber?.id || "";
  const filteredUsers = useMemo(() => {
    if (!managementUsers.length) return [];
    if (isSystemScope) return managementUsers;
    return managementUsers.filter((row) => row.jobberId === activeJobberId);
  }, [activeJobberId, isSystemScope, managementUsers]);
  const filteredSites = useMemo(() => {
    if (!managementSites.length) return [];
    if (isSystemScope) return managementSites;
    return managementSites.filter((row) => row.jobberId === activeJobberId);
  }, [activeJobberId, isSystemScope, managementSites]);
  const selectedUser = useMemo(() => filteredUsers.find((row) => row.id === selectedUserId) || null, [filteredUsers, selectedUserId]);
  const roleCounts = useMemo(() => {
    return filteredUsers.reduce((acc, row) => {
      if (row.role === "admin") acc.admin += 1;
      if (row.role === "manager") acc.manager += 1;
      return acc;
    }, { admin: 0, manager: 0 });
  }, [filteredUsers]);
  const availableSitesForUserForm = useMemo(() => {
    const targetJobberId = userForm.jobberId || activeJobberId;
    return filteredSites.filter((row) => !targetJobberId || row.jobberId === targetJobberId);
  }, [activeJobberId, filteredSites, userForm.jobberId]);

  useEffect(() => {
    if (!selectedUser) return;
    setUserForm({
      name: selectedUser.name || "",
      email: selectedUser.email || "",
      password: "",
      role: selectedUser.role || "manager",
      jobberId: selectedUser.jobberId || activeJobberId,
      siteIds: selectedUser.siteIds || []
    });
  }, [activeJobberId, selectedUser]);

  useEffect(() => {
    if (!selectedUser && activeJobberId) {
      setUserForm((current) => ({ ...EMPTY_USER, jobberId: current.jobberId || activeJobberId }));
    }
  }, [activeJobberId, selectedUser]);

  function clearUserWorkspace() {
    setSelectedUserId("");
    setUserForm({ ...EMPTY_USER, jobberId: activeJobberId });
  }

  function toggleUserSite(siteId) {
    setUserForm((current) => ({
      ...current,
      siteIds: current.siteIds.includes(siteId)
        ? current.siteIds.filter((id) => id !== siteId)
        : [...current.siteIds, siteId]
    }));
  }

  async function reloadManagementOverview() {
    const nextOverview = await api.getManagementOverview();
    setManagementOverview(nextOverview);
    return nextOverview;
  }

  function onLogoFileSelected(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setBrandingForm((current) => ({ ...current, logoUrl: reader.result }));
      }
    };
    reader.readAsDataURL(file);
  }

  async function saveBranding(event) {
    event.preventDefault();
    setSavingBranding(true);
    setError("");
    setMessage("");
    try {
      const updated = await api.updateCurrentJobber({
        name: brandingForm.name.trim() || jobber?.name || "Jobber",
        logoUrl: brandingForm.logoUrl
      });
      onJobberUpdated?.(updated);
      setMessage("Jobber branding updated.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError || "Unable to save branding"));
    } finally {
      setSavingBranding(false);
    }
  }

  async function saveOpis(event) {
    event.preventDefault();
    setSavingOpis(true);
    setError("");
    setMessage("");
    try {
      const nextStatus = await api.saveJobberOpisCredentials({
        username: opisForm.username.trim(),
        password: opisForm.password
      });
      setOpisStatus(nextStatus);
      setOpisForm(EMPTY_OPIS);
      setMessage("OPIS credentials saved securely for this jobber.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError || "Unable to save OPIS credentials"));
    } finally {
      setSavingOpis(false);
    }
  }

  async function saveEia(event) {
    event.preventDefault();
    setSavingEia(true);
    setError("");
    setMessage("");
    try {
      const nextStatus = await api.saveJobberEiaCredentials({
        apiKey: eiaForm.apiKey.trim()
      });
      setEiaStatus(nextStatus);
      setEiaForm(EMPTY_EIA);
      setMessage("EIA API key saved securely for this jobber.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError || "Unable to save EIA key"));
    } finally {
      setSavingEia(false);
    }
  }

  async function saveUser(event) {
    event.preventDefault();
    setSavingUser(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        name: userForm.name.trim(),
        email: userForm.email.trim(),
        role: userForm.role,
        jobberId: isSystemScope ? (userForm.jobberId || activeJobberId) : activeJobberId,
        siteIds: userForm.role === "manager" ? userForm.siteIds : []
      };
      if (userForm.password.trim()) payload.password = userForm.password.trim();
      if (selectedUserId) {
        await api.updateManagedUser(selectedUserId, payload);
        setMessage("User updated.");
      } else {
        await api.createManagedUser(payload);
        setMessage("User created.");
      }
      await reloadManagementOverview();
      clearUserWorkspace();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError || "Unable to save user"));
    } finally {
      setSavingUser(false);
    }
  }

  async function removeUser() {
    if (!selectedUser) return;
    if (!window.confirm(`Delete user ${selectedUser.email}?`)) return;
    setSavingUser(true);
    setError("");
    setMessage("");
    try {
      await api.deleteManagedUser(selectedUser.id);
      await reloadManagementOverview();
      clearUserWorkspace();
      setMessage("User deleted.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError || "Unable to delete user"));
    } finally {
      setSavingUser(false);
    }
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", lg: "row" }} justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="h4">Admin</Typography>
          <Typography color="text.secondary">
            Jobber setup first. Summary stays on top, write actions stay below it.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip label={jobber?.name || "No jobber"} color="primary" variant="outlined" />
          <Chip label={user?.jobberRole || user?.role || "guest"} variant="outlined" />
        </Stack>
      </Stack>

      {loading ? <LinearProgress /> : null}
      {error ? <Alert severity="error">{error}</Alert> : null}
      {message ? <Alert severity="success">{message}</Alert> : null}
      {!canManage ? <Alert severity="info">This workspace is read-only unless the current user has a jobber admin role.</Alert> : null}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
          <SummaryCard label="Branding" value={jobber?.name || "No jobber"} caption={jobber?.slug || "No slug"} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
          <SummaryCard label="OPIS" value={opisStatus?.saved ? "Saved" : "Missing"} caption={formatDateTime(opisStatus?.updatedAt)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
          <SummaryCard label="EIA" value={eiaStatus?.saved ? "Saved" : "Missing"} caption={formatDateTime(eiaStatus?.updatedAt)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
          <SummaryCard label="Pricing Configs" value={pricingSummary.total.toLocaleString()} caption={`${pricingSummary.markets} markets`} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
          <SummaryCard label="Users" value={filteredUsers.length.toLocaleString()} caption={`${roleCounts.admin} admins / ${roleCounts.manager} managers`} />
        </Grid>
      </Grid>

      <Section title="Workspace" subtitle="Choose one admin task at a time so the page stays readable on a phone.">
        <Tabs
          value={tab}
          onChange={(_event, nextTab) => setTab(nextTab)}
          variant="scrollable"
          allowScrollButtonsMobile
        >
          {TABS.map((value) => <Tab key={value} value={value} label={value} />)}
        </Tabs>
      </Section>

      {tab === "overview" ? (
        <Stack spacing={2.5}>
          <Section title="Current Status" subtitle="High-level admin health for the current jobber.">
            <Grid container spacing={1.5}>
              <Grid size={{ xs: 6, md: 3 }}>
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">Branding</Typography>
                  <Typography fontWeight={700}>{brandingForm.name || "Unnamed"}</Typography>
                </Paper>
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">OPIS Status</Typography>
                  <Typography fontWeight={700}>{opisStatus?.saved ? "Configured" : "Missing"}</Typography>
                </Paper>
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">EIA Status</Typography>
                  <Typography fontWeight={700}>{eiaStatus?.saved ? "Configured" : "Missing"}</Typography>
                </Paper>
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">Pricing Rows</Typography>
                  <Typography fontWeight={700}>{pricingSummary.total.toLocaleString()}</Typography>
                </Paper>
              </Grid>
            </Grid>
          </Section>

          <Section title="Recommended Next Actions" subtitle="This keeps the admin migration focused instead of rebuilding the full legacy tool immediately.">
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip color={statusTone(!jobber?.logoUrl)} label={jobber?.logoUrl ? "Logo loaded" : "Add logo"} />
              <Chip color={statusTone(!opisStatus?.saved)} label={opisStatus?.saved ? "OPIS configured" : "Configure OPIS"} />
              <Chip color={statusTone(!eiaStatus?.saved)} label={eiaStatus?.saved ? "EIA configured" : "Configure EIA"} />
              <Chip color={statusTone(pricingSummary.total > 0)} label={pricingSummary.total > 0 ? "Pricing configs loaded" : "Review pricing configs"} />
            </Stack>
          </Section>
        </Stack>
      ) : null}

      {tab === "users" ? (
        <Stack spacing={2.5}>
          <Section title="User Summary" subtitle="Read the current user posture first, then edit below.">
            <Grid container spacing={1.5}>
              <Grid size={{ xs: 6, md: 3 }}>
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">Visible Users</Typography>
                  <Typography fontWeight={700}>{filteredUsers.length.toLocaleString()}</Typography>
                </Paper>
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">Admins</Typography>
                  <Typography fontWeight={700}>{roleCounts.admin.toLocaleString()}</Typography>
                </Paper>
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">Managers</Typography>
                  <Typography fontWeight={700}>{roleCounts.manager.toLocaleString()}</Typography>
                </Paper>
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">Visible Sites</Typography>
                  <Typography fontWeight={700}>{filteredSites.length.toLocaleString()}</Typography>
                </Paper>
              </Grid>
            </Grid>
          </Section>

          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, xl: 5 }}>
              <Section
                title="Users"
                subtitle="Select a user to edit, or start a new one."
                action={<Button variant="outlined" onClick={clearUserWorkspace}>New User</Button>}
              >
                <List disablePadding>
                  {filteredUsers.length ? filteredUsers.map((row) => (
                    <ListItem key={row.id} disablePadding sx={{ mb: 1 }}>
                      <ListItemButton
                        selected={selectedUserId === row.id}
                        onClick={() => setSelectedUserId(row.id)}
                        sx={{ border: "1px solid", borderColor: selectedUserId === row.id ? "primary.main" : "divider", borderRadius: 2 }}
                      >
                        <ListItemText
                          primary={row.name || row.email}
                          secondary={`${row.email} | ${row.role} | ${row.role === "manager" ? `${row.siteIds?.length || 0} sites` : "all sites"}`}
                        />
                      </ListItemButton>
                    </ListItem>
                  )) : <Typography color="text.secondary">No users returned for this jobber.</Typography>}
                </List>
              </Section>
            </Grid>

            <Grid size={{ xs: 12, xl: 7 }}>
              <Section title={selectedUser ? "Edit User" : "Add User"} subtitle="Write actions stay below the summary and list.">
                <Box component="form" onSubmit={saveUser}>
                  <Stack spacing={2}>
                    <TextField
                      label="Full Name"
                      value={userForm.name}
                      onChange={(event) => setUserForm((current) => ({ ...current, name: event.target.value }))}
                      fullWidth
                      disabled={!canManage || savingUser}
                    />
                    <TextField
                      label="Email"
                      value={userForm.email}
                      onChange={(event) => setUserForm((current) => ({ ...current, email: event.target.value }))}
                      fullWidth
                      disabled={!canManage || savingUser}
                    />
                    <TextField
                      label={selectedUser ? "New Password (Optional)" : "Temporary Password"}
                      type="password"
                      value={userForm.password}
                      onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))}
                      fullWidth
                      disabled={!canManage || savingUser}
                    />
                    <TextField
                      select
                      label="Role"
                      value={userForm.role}
                      onChange={(event) => setUserForm((current) => ({ ...current, role: event.target.value, siteIds: event.target.value === "admin" ? [] : current.siteIds }))}
                      fullWidth
                      disabled={!canManage || savingUser}
                    >
                      <MenuItem value="manager">Manager</MenuItem>
                      <MenuItem value="admin">Admin</MenuItem>
                    </TextField>

                    {userForm.role === "manager" ? (
                      <Paper variant="outlined" sx={{ p: 1.5 }}>
                        <Stack spacing={1.25}>
                          <Typography variant="subtitle2">Site Access</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Managers only see checked sites. Leave all unchecked for no site access.
                          </Typography>
                          <Stack>
                            {availableSitesForUserForm.map((siteRow) => (
                              <FormControlLabel
                                key={siteRow.id}
                                control={<Checkbox checked={userForm.siteIds.includes(siteRow.id)} onChange={() => toggleUserSite(siteRow.id)} />}
                                label={`${siteRow.siteCode} - ${siteRow.name}`}
                                disabled={!canManage || savingUser}
                              />
                            ))}
                          </Stack>
                        </Stack>
                      </Paper>
                    ) : (
                      <Alert severity="info">Admins automatically see all sites for their jobber.</Alert>
                    )}

                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                      <Button type="submit" variant="contained" disabled={!canManage || savingUser}>
                        {selectedUser ? "Save User" : "Create User"}
                      </Button>
                      {selectedUser ? (
                        <Button type="button" color="error" variant="outlined" onClick={removeUser} disabled={!canManage || savingUser}>
                          Delete User
                        </Button>
                      ) : null}
                      <Button type="button" variant="text" onClick={clearUserWorkspace} disabled={savingUser}>
                        Clear
                      </Button>
                    </Stack>
                  </Stack>
                </Box>
              </Section>
            </Grid>
          </Grid>
        </Stack>
      ) : null}

      {tab === "branding" ? (
        <Section title="Branding" subtitle="Keep jobber identity controls together and below the status summary.">
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, lg: 4 }}>
              <Paper variant="outlined" sx={{ p: 2, minHeight: 220, display: "grid", placeItems: "center", backgroundColor: "background.default" }}>
                {brandingForm.logoUrl ? (
                  <Box component="img" src={brandingForm.logoUrl} alt={brandingForm.name || "Jobber logo"} sx={{ maxWidth: "100%", maxHeight: 160, objectFit: "contain" }} />
                ) : (
                  <Typography color="text.secondary">No logo configured</Typography>
                )}
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, lg: 8 }}>
              <Box component="form" onSubmit={saveBranding}>
                <Stack spacing={2}>
                  <TextField
                    label="Jobber Name"
                    value={brandingForm.name}
                    onChange={(event) => setBrandingForm((current) => ({ ...current, name: event.target.value }))}
                    fullWidth
                    disabled={!canManage || savingBranding}
                  />
                  <TextField
                    label="Logo URL or Base64"
                    value={brandingForm.logoUrl}
                    onChange={(event) => setBrandingForm((current) => ({ ...current, logoUrl: event.target.value }))}
                    fullWidth
                    multiline
                    minRows={3}
                    disabled={!canManage || savingBranding}
                  />
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                    <Button component="label" variant="outlined" disabled={!canManage || savingBranding}>
                      Upload Logo
                      <input hidden type="file" accept="image/*" onChange={(event) => onLogoFileSelected(event.target.files?.[0])} />
                    </Button>
                    <Button type="button" variant="text" onClick={() => setBrandingForm((current) => ({ ...current, logoUrl: "" }))} disabled={!canManage || savingBranding}>
                      Clear Logo
                    </Button>
                    <Button type="submit" variant="contained" disabled={!canManage || savingBranding}>
                      Save Branding
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            </Grid>
          </Grid>
        </Section>
      ) : null}

      {tab === "credentials" ? (
        <Stack spacing={2.5}>
          <Section title="Credential Status" subtitle="Read status first, then save changes below.">
            <Grid container spacing={1.5}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Stack spacing={1}>
                    <Typography variant="subtitle2">OPIS</Typography>
                    <Chip label={opisStatus?.saved ? "Saved" : "Missing"} color={opisStatus?.saved ? "success" : "default"} sx={{ width: "fit-content" }} />
                    <Typography variant="caption" color="text.secondary">Last updated: {formatDateTime(opisStatus?.updatedAt)}</Typography>
                  </Stack>
                </Paper>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Stack spacing={1}>
                    <Typography variant="subtitle2">EIA</Typography>
                    <Chip label={eiaStatus?.saved ? "Saved" : "Missing"} color={eiaStatus?.saved ? "success" : "default"} sx={{ width: "fit-content" }} />
                    <Typography variant="caption" color="text.secondary">Last updated: {formatDateTime(eiaStatus?.updatedAt)}</Typography>
                  </Stack>
                </Paper>
              </Grid>
            </Grid>
          </Section>

          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, xl: 6 }}>
              <Section title="OPIS Credentials" subtitle="Stored securely at the jobber level.">
                <Box component="form" onSubmit={saveOpis}>
                  <Stack spacing={2}>
                    <TextField
                      label="Username"
                      value={opisForm.username}
                      onChange={(event) => setOpisForm((current) => ({ ...current, username: event.target.value }))}
                      fullWidth
                      disabled={!canManage || savingOpis}
                    />
                    <TextField
                      label="Password"
                      type="password"
                      value={opisForm.password}
                      onChange={(event) => setOpisForm((current) => ({ ...current, password: event.target.value }))}
                      fullWidth
                      disabled={!canManage || savingOpis}
                    />
                    <Button type="submit" variant="contained" disabled={!canManage || savingOpis}>
                      Save OPIS
                    </Button>
                  </Stack>
                </Box>
              </Section>
            </Grid>
            <Grid size={{ xs: 12, xl: 6 }}>
              <Section title="EIA API Key" subtitle="Stored securely at the jobber level.">
                <Box component="form" onSubmit={saveEia}>
                  <Stack spacing={2}>
                    <TextField
                      label="API Key"
                      value={eiaForm.apiKey}
                      onChange={(event) => setEiaForm((current) => ({ ...current, apiKey: event.target.value }))}
                      fullWidth
                      multiline
                      minRows={3}
                      disabled={!canManage || savingEia}
                    />
                    <Button type="submit" variant="contained" disabled={!canManage || savingEia}>
                      Save EIA Key
                    </Button>
                  </Stack>
                </Box>
              </Section>
            </Grid>
          </Grid>
        </Stack>
      ) : null}

      {tab === "pricing" ? (
        <Stack spacing={2.5}>
          <Section title="Pricing Summary" subtitle="Status first, config rows below.">
            <Grid container spacing={1.5}>
              <Grid size={{ xs: 6, md: 3 }}>
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">Config Rows</Typography>
                  <Typography fontWeight={700}>{pricingSummary.total.toLocaleString()}</Typography>
                </Paper>
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">Markets</Typography>
                  <Typography fontWeight={700}>{pricingSummary.markets.toLocaleString()}</Typography>
                </Paper>
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">Custom Margins</Typography>
                  <Typography fontWeight={700}>{pricingSummary.withCustomMargin.toLocaleString()}</Typography>
                </Paper>
              </Grid>
            </Grid>
          </Section>

          <Section title="Pricing Config Rows" subtitle="Read-only in this first MUI admin slice.">
            <Stack spacing={1.25}>
              {pricingConfigs.length ? pricingConfigs.slice(0, 24).map((row, index) => (
                <Paper key={`${row.id || row.marketKey || "pricing"}-${index}`} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1}>
                    <Box>
                      <Typography fontWeight={700}>{row.marketLabel || row.location || row.marketKey || "Pricing Row"}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {[row.productKey, row.terminalKey, row.marketKey].filter(Boolean).join(" | ") || "No canonical keys"}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {row.marginCents != null || row.margin != null ? <Chip size="small" variant="outlined" label={`Margin ${row.marginCents ?? row.margin}`} /> : null}
                      {row.freightCents != null ? <Chip size="small" variant="outlined" label={`Freight ${row.freightCents}`} /> : null}
                    </Stack>
                  </Stack>
                </Paper>
              )) : <Typography color="text.secondary">No jobber pricing configs were returned.</Typography>}
            </Stack>
          </Section>
        </Stack>
      ) : null}
    </Stack>
  );
}
