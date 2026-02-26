import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { loginDefault } from "./api";
import { PortfolioPage } from "./pages/PortfolioPage";
import { WorkQueuePage } from "./pages/WorkQueuePage";
import { SiteDetailPage } from "./pages/SiteDetailPage";
import { LayoutPage } from "./pages/LayoutPage";
import { LayoutEditorPage } from "./pages/LayoutEditorPage";
import { AdminPage } from "./pages/AdminPage";
import xpLogo from "./assets/xprotean-logo.svg";

function AppFrame({ children }) {
  const location = useLocation();
  const pageTitle =
    location.pathname.startsWith("/sites/") ? "Site Operations" :
    location.pathname.startsWith("/work-queue") ? "Service Work Queue" :
    "Portfolio Command Center";
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img src={xpLogo} alt="XProtean logo" className="brand-logo" />
        </div>
        <nav className="side-nav">
          <NavLink to="/portfolio" className={({ isActive }) => (isActive ? "active" : "")}>
            Portfolio
          </NavLink>
          <NavLink to="/work-queue" className={({ isActive }) => (isActive ? "active" : "")}>
            Work Queue
          </NavLink>
          <NavLink to="/admin" className={({ isActive }) => (isActive ? "active" : "")}>
            Admin
          </NavLink>
        </nav>
      </aside>
      <section className="main-shell">
        <header className="topbar">
          <div>
            <div className="topbar-title">{pageTitle}</div>
            <div className="topbar-subtitle">Gas Station Monitoring Dashboard</div>
          </div>
        </header>
        <main className="content">{children}</main>
      </section>
    </div>
  );
}

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
    <AppFrame>
        <Routes>
          <Route path="/" element={<Navigate to="/portfolio" replace />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/work-queue" element={<WorkQueuePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/sites/:siteId" element={<SiteDetailPage />} />
          <Route path="/sites/:siteId/layout" element={<LayoutPage />} />
          <Route path="/sites/:siteId/layout/edit" element={<LayoutEditorPage />} />
        </Routes>
    </AppFrame>
  );
}
