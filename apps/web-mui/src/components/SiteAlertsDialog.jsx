import { useEffect, useState } from "react";
import {
  Alert,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Stack,
  Typography
} from "@mui/material";
import FlashOnIcon from "@mui/icons-material/FlashOn";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { api } from "../api";

function formatDateTime(value) {
  if (!value) return "No timestamp";
  return new Date(value).toLocaleString();
}

export function SiteAlertsDialog({ open, onClose, siteId, siteName, severity }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const apiSeverity = severity === "warning" ? "warn" : severity;

  useEffect(() => {
    let ignore = false;

    if (!open || !siteId || !apiSeverity) {
      setRows([]);
      setError("");
      setLoading(false);
      return () => {
        ignore = true;
      };
    }

    async function load() {
      setLoading(true);
      setError("");
      try {
        const result = await api.getAlerts({ siteId, severity: apiSeverity, state: "raised" });
        if (!ignore) setRows(result);
      } catch (nextError) {
        if (!ignore) setError(nextError instanceof Error ? nextError.message : String(nextError || "Unable to load alerts"));
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [apiSeverity, open, siteId]);

  const titleTone = severity === "critical" ? "Critical" : "Warning";
  const TitleIcon = severity === "critical" ? FlashOnIcon : WarningAmberIcon;
  const accent = severity === "critical" ? "#d14343" : "#c77700";

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <TitleIcon sx={{ color: accent }} />
          <span>{titleTone} Alerts: {siteName || "Selected Site"}</span>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 160 }}>
            <CircularProgress />
          </Stack>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : rows.length ? (
          <Stack spacing={1.25}>
            {rows.map((alert) => (
              <Stack
                key={alert.id}
                spacing={0.5}
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  border: "1px solid rgba(15, 23, 42, 0.08)",
                  backgroundColor: "rgba(248, 250, 252, 0.8)"
                }}
              >
                <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
                  <Typography fontWeight={700}>{alert.message || alert.alertType || "Alert"}</Typography>
                  <Chip
                    size="small"
                    label={alert.severity}
                    sx={{
                      color: accent,
                      borderColor: severity === "critical" ? "rgba(209,67,67,0.4)" : "rgba(199,119,0,0.45)",
                      backgroundColor: severity === "critical" ? "rgba(209,67,67,0.06)" : "rgba(199,119,0,0.10)"
                    }}
                    variant="outlined"
                  />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {formatDateTime(alert.eventAt || alert.raisedAt || alert.createdAt)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {[alert.component, alert.alertType, alert.pumpId || alert.tankId || null].filter(Boolean).join(" · ") || "No component details"}
                </Typography>
              </Stack>
            ))}
          </Stack>
        ) : (
          <Typography color="text.secondary">No open {severity} alerts for this site.</Typography>
        )}
      </DialogContent>
    </Dialog>
  );
}
