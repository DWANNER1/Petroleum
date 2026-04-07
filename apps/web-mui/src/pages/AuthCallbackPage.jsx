import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import { completeOAuthLogin, api } from "../api";

export function AuthCallbackPage({ onAuthenticated }) {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    let ignore = false;

    async function completeLogin() {
      const params = new URLSearchParams(location.search);
      const token = params.get("token");
      const error = params.get("error");
      if (error || !token) {
        navigate("/login", { replace: true, state: { error: error || "oauth_login_failed" } });
        return;
      }

      try {
        completeOAuthLogin(token);
        const sessionUser = await api.getSessionUser();
        if (!ignore) {
          await onAuthenticated(sessionUser);
          navigate("/", { replace: true });
        }
      } catch (_error) {
        if (!ignore) {
          navigate("/login", { replace: true, state: { error: "oauth_session_invalid" } });
        }
      }
    }

    completeLogin();
    return () => {
      ignore = true;
    };
  }, [location.search, navigate, onAuthenticated]);

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <Stack spacing={2} alignItems="center">
        <CircularProgress />
        <Typography>Completing sign-in...</Typography>
      </Stack>
    </Box>
  );
}
