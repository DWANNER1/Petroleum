import { useEffect, useState } from "react";
import {
  Alert,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Stack,
  Typography
} from "@mui/material";
import { api } from "../api";

export function SitesPage() {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const result = await api.getSites();
        if (!ignore) {
          setSites(result);
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
  }, []);

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
          Live API-backed site summary cards for the parallel MUI frontend.
        </Typography>
      </div>

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Grid container spacing={2.5}>
        {sites.map((site) => (
          <Grid key={site.id} size={{ xs: 12, sm: 6, xl: 4 }}>
            <Card>
              <CardContent>
                <Stack spacing={1.5}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                    <Typography variant="h6">{site.name}</Typography>
                    <Chip size="small" label={site.siteCode || site.id} />
                  </Stack>
                  <Typography color="text.secondary">{site.address || "No address"}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Region: {site.region || "Unknown"}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}
