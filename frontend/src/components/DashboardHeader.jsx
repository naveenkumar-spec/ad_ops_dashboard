import { NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import "../../styles/DashboardHeader.css";

function formatIST(isoString) {
  if (!isoString) return null;
  const date = new Date(isoString);
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  }) + " IST";
}

export default function DashboardHeader({ activeTab, currentUser, onLogout }) {
  const rawIdentity = currentUser?.email || currentUser?.username || "";
  const localIdentity = rawIdentity.split("@")[0] || rawIdentity;
  const logoutName = localIdentity.split(".")[0] || localIdentity;

  const [lastSync, setLastSync] = useState(null);

  useEffect(() => {
    fetch("/api/overview/last-sync")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.lastSyncAt) setLastSync(data.lastSyncAt); })
      .catch(() => {});
  }, []);

  return (
    <div className="dashboard-header">
      <div className="header-brand">
        <h1>Campaign Performance Dashboard</h1>
        {lastSync && (
          <span className="header-last-sync">Last data sync: {formatIST(lastSync)}</span>
        )}
      </div>
      <div className="header-actions">
        <div className="header-tabs">
          {activeTab === "admin" ? (
            <span className="tab-link active">Admin Setup</span>
          ) : (
            <>
              <NavLink to="/" className={({ isActive }) => `tab-link ${isActive ? "active" : ""}`}>Overview</NavLink>
              <NavLink to="/management" className={({ isActive }) => `tab-link ${isActive ? "active" : ""}`}>Management</NavLink>
            </>
          )}
        </div>
        <button className="header-logout-btn" type="button" onClick={onLogout}>
          Logout {logoutName ? `(${logoutName})` : ""}
        </button>
      </div>
    </div>
  );
}
