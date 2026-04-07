import React from "react";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";

export class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, errorInfo: null };
    this.handleReset = this.handleReset.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    if (typeof console !== "undefined") {
      console.error("AppErrorBoundary caught error", error, errorInfo);
    }
  }

  handleReset() {
    this.setState({ error: null, errorInfo: null });
  }

  render() {
    if (this.state.error) {
      return (
        <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 3, bgcolor: "background.default" }}>
          <Stack spacing={2} sx={{ width: "100%", maxWidth: 860 }}>
            <Alert severity="error">
              A frontend error occurred while rendering this screen. This fallback is shown so the app does not collapse to a blank white page.
            </Alert>
            <Box sx={{ p: 3, bgcolor: "background.paper", borderRadius: 2, border: "1px solid rgba(15,23,42,0.08)" }}>
              <Stack spacing={1.5}>
                <Typography variant="h6">Runtime Error</Typography>
                <Typography variant="body2" sx={{ fontFamily: "Consolas, 'Courier New', monospace", whiteSpace: "pre-wrap" }}>
                  {String(this.state.error?.message || this.state.error)}
                </Typography>
                {this.state.errorInfo?.componentStack ? (
                  <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "Consolas, 'Courier New', monospace", whiteSpace: "pre-wrap" }}>
                    {this.state.errorInfo.componentStack}
                  </Typography>
                ) : null}
                <Stack direction="row" spacing={1}>
                  <Button variant="contained" onClick={this.handleReset}>Reset Boundary</Button>
                  <Button variant="outlined" onClick={() => window.location.reload()}>Reload Page</Button>
                </Stack>
              </Stack>
            </Box>
          </Stack>
        </Box>
      );
    }

    return this.props.children;
  }
}
