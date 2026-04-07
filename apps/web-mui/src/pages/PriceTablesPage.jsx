import { Suspense, lazy } from "react";
import { CircularProgress, Stack } from "@mui/material";
import "../../../web/src/styles.css";

const LegacyPriceTablesPage = lazy(() =>
  import("../../../web/src/pages/PriceTablesPage.jsx").then((module) => ({ default: module.PriceTablesPage }))
);

export function PriceTablesPage() {
  return (
    <Suspense
      fallback={
        <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 240 }}>
          <CircularProgress />
        </Stack>
      }
    >
      <LegacyPriceTablesPage />
    </Suspense>
  );
}
