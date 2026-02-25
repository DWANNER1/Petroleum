import { useEffect, useState } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import { loginDefault } from "./api";
import { PortfolioPage } from "./pages/PortfolioPage";
import { WorkQueuePage } from "./pages/WorkQueuePage";
import { SiteDetailPage } from "./pages/SiteDetailPage";
import { LayoutPage } from "./pages/LayoutPage";
import { LayoutEditorPage } from "./pages/LayoutEditorPage";

export default function App() {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    loginDefault()
      .then(() => setStatus("ready"))
      .catch((err) => {
        setError(err.message);
        setStatus("error");
      });
  }, []);

  if (status === "loading") return <div className="content">Connecting...</div>;
  if (status === "error") return <div className="content">Login failed: {error}</div>;

  return (
    <div className="app-shell">
      <header className="topbar">
        <strong>Petroleum Dashboard</strong>
        <nav>
          <Link to="/portfolio">Portfolio</Link>
          <Link to="/work-queue">Work Queue</Link>
        </nav>
      </header>
      <main className="content">
        <Routes>
          <Route path="/" element={<Navigate to="/portfolio" replace />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/work-queue" element={<WorkQueuePage />} />
          <Route path="/sites/:siteId" element={<SiteDetailPage />} />
          <Route path="/sites/:siteId/layout" element={<LayoutPage />} />
          <Route path="/sites/:siteId/layout/edit" element={<LayoutEditorPage />} />
        </Routes>
      </main>
    </div>
  );
}
