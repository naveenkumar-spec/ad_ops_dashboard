import { NavLink } from "react-router-dom";

export default function AppLayout({ currentUser, children }) {
  const canSeeAdmin = currentUser?.role === "admin" || (currentUser?.allowedTabs || []).includes("admin");
  const showSidebar = canSeeAdmin;
  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "#f4f7f6" }}>
      {showSidebar ? (
        <aside style={{ width: 220, background: "#0f1f3d", color: "#fff", padding: 16 }}>
          <div style={{ fontSize: 14, opacity: 0.85, marginBottom: 20 }}>Navigation</div>
          <nav style={{ display: "grid", gap: 8 }}>
            <NavLink to="/" style={({ isActive }) => ({ color: "#fff", textDecoration: "none", padding: "10px 12px", borderRadius: 8, background: isActive ? "rgba(255,255,255,0.18)" : "transparent" })}>
              Dashboard
            </NavLink>
            <NavLink to="/admin" style={({ isActive }) => ({ color: "#fff", textDecoration: "none", padding: "10px 12px", borderRadius: 8, background: isActive ? "rgba(255,255,255,0.18)" : "transparent" })}>
              Admin Setup
            </NavLink>
          </nav>
        </aside>
      ) : null}
      <main style={{ flex: 1, width: "100%" }}>{children}</main>
    </div>
  );
}


