import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#0b5fff"
    },
    secondary: {
      main: "#1d8348"
    },
    background: {
      default: "#f3f6fb",
      paper: "#ffffff"
    }
  },
  shape: {
    borderRadius: 14
  },
  typography: {
    fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
    h4: {
      fontWeight: 700
    },
    h5: {
      fontWeight: 700
    },
    h6: {
      fontWeight: 700
    }
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          border: "1px solid rgba(15, 23, 42, 0.08)",
          boxShadow: "0 12px 30px rgba(15, 23, 42, 0.06)"
        }
      }
    }
  }
});

export default theme;
