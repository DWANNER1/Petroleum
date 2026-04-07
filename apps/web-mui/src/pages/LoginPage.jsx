import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { getOAuthProviders, loginWithPassword, oauthStartUrl } from "../api";

const defaultCredentials = {
  email: "manager@demo.com",
  password: "demo123"
};

export function LoginPage({ onAuthenticated }) {
  const [form, setForm] = useState(defaultCredentials);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [providers, setProviders] = useState([]);
  const [providersLoading, setProvidersLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    async function loadProviders() {
      setProvidersLoading(true);
      try {
        const result = await getOAuthProviders();
        if (!ignore) setProviders(result);
      } catch (_error) {
        if (!ignore) setProviders([]);
      } finally {
        if (!ignore) setProvidersLoading(false);
      }
    }
    loadProviders();
    return () => {
      ignore = true;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const result = await loginWithPassword(form.email, form.password);
      await onAuthenticated(result.user);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        px: 2,
        background: "linear-gradient(180deg, #eef4ff 0%, #f8fafc 100%)"
      }}
    >
      <Card sx={{ width: "100%", maxWidth: 460 }}>
        <CardContent sx={{ p: 4 }}>
          <Stack spacing={3} component="form" onSubmit={handleSubmit}>
            <div>
              <Typography variant="h4" gutterBottom>Petroleum MUI</Typography>
              <Typography color="text.secondary">
                Parallel frontend preview for desktop and phone-friendly layouts.
              </Typography>
            </div>

            {error ? <Alert severity="error">{error}</Alert> : null}

            <TextField
              label="Email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              autoComplete="email"
              fullWidth
            />
            <TextField
              label="Password"
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              autoComplete="current-password"
              fullWidth
            />

            <Button type="submit" variant="contained" size="large" disabled={submitting}>
              {submitting ? "Signing in..." : "Sign In"}
            </Button>

            <Stack spacing={1.5}>
              <Typography variant="subtitle2" color="text.secondary">OAuth</Typography>
              {providersLoading ? (
                <Stack direction="row" alignItems="center" spacing={1}>
                  <CircularProgress size={16} />
                  <Typography variant="body2" color="text.secondary">Loading providers...</Typography>
                </Stack>
              ) : providers.length ? (
                providers.map((provider) => (
                  <Button key={provider.key} variant="outlined" onClick={() => { window.location.href = oauthStartUrl(provider.key); }}>
                    Continue with {provider.label || provider.key}
                  </Button>
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">No OAuth providers configured.</Typography>
              )}
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
