import { NavLink } from "react-router-dom";
import "../../styles/DashboardHeader.css";

export default function DashboardHeader({ activeTab, currentUser, onLogout }) {
  const rawIdentity = currentUser?.email || currentUser?.username || "";
  const localIdentity = rawIdentity.split("@")[0] || rawIdentity;
  const logoutName = localIdentity.split(".")[0] || localIdentity;

  return (
    <div className="dashboard-header">
      <div>
        <h1>Campaign Performance Dashboard</h1>
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
