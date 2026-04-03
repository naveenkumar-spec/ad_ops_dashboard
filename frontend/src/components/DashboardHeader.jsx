import { NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import { apiGet } from "../utils/apiClient";
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

  const isAdmin = currentUser?.role === "admin";
  const allowedTabs = currentUser?.allowedTabs || [];
  const canSeeManagement = isAdmin || allowedTabs.includes("management");

  const [lastSync, setLastSync] = useState(null);

  useEffect(() => {
    apiGet("/api/overview/last-sync")
      .then((res) => { if (res.data?.lastSyncAt) setLastSync(res.data.lastSyncAt); })
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
              {canSeeManagement && (
                <NavLink to="/management" className={({ isActive }) => `tab-link ${isActive ? "active" : ""}`}>Management</NavLink>
              )}
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
