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
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    // Fetch last sync time
    apiGet("/api/overview/last-sync")
      .then((res) => { if (res.data?.lastSyncAt) setLastSync(res.data.lastSyncAt); })
      .catch(() => {});

    // Poll sync status every 10 seconds to check if sync is running
    const checkSyncStatus = () => {
      apiGet("/api/overview/sync/bigquery/status")
        .then((res) => {
          const status = res.data?.status;
          setIsSyncing(status === "running");
          
          // If sync just completed, refresh last sync time
          if (status === "completed" && !isSyncing) {
            apiGet("/api/overview/last-sync")
              .then((res) => { if (res.data?.lastSyncAt) setLastSync(res.data.lastSyncAt); })
              .catch(() => {});
          }
        })
        .catch(() => setIsSyncing(false));
    };

    // Check immediately
    checkSyncStatus();

    // Then check every 10 seconds
    const interval = setInterval(checkSyncStatus, 10000);

    return () => clearInterval(interval);
  }, [isSyncing]);

  return (
    <div className="dashboard-header">
      <div className="header-brand">
        <h1>Campaign Performance Dashboard</h1>
        <div className="header-sync-info">
          {isSyncing ? (
            <span className="header-syncing">
              <span className="sync-spinner"></span>
              Data refresh in progress
            </span>
          ) : lastSync ? (
            <span className="header-last-sync">Last data sync: {formatIST(lastSync)}</span>
          ) : null}
        </div>
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
