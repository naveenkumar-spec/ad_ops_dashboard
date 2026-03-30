import os
from typing import Any, Dict, List

import pandas as pd
import requests
import streamlit as st


st.set_page_config(page_title="AdOps Dashboard (Streamlit)", layout="wide")


def get_backend_base_url() -> str:
    from_secret = st.secrets.get("BACKEND_BASE_URL", "")
    from_env = os.getenv("BACKEND_BASE_URL", "")
    default_url = from_secret or from_env or ""
    return default_url.strip().rstrip("/")


def api_get(path: str, token: str = "", params: Dict[str, Any] | None = None) -> Any:
    base = st.session_state.get("backend_base_url", "").strip().rstrip("/")
    if not base:
        raise RuntimeError("Set BACKEND_BASE_URL in sidebar or Streamlit secrets.")
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    response = requests.get(f"{base}{path}", headers=headers, params=params or {}, timeout=20)
    response.raise_for_status()
    return response.json()


def api_post(path: str, body: Dict[str, Any]) -> Any:
    base = st.session_state.get("backend_base_url", "").strip().rstrip("/")
    if not base:
        raise RuntimeError("Set BACKEND_BASE_URL in sidebar or Streamlit secrets.")
    response = requests.post(f"{base}{path}", json=body, timeout=20)
    response.raise_for_status()
    return response.json()


def trend_to_long_df(rows: List[Dict[str, Any]], metric_name: str) -> pd.DataFrame:
    records = []
    for row in rows or []:
        month = row.get("month")
        for key, value in row.items():
            if key == "month":
                continue
            try:
                year = int(key)
            except Exception:
                continue
            records.append(
                {
                    "month": month,
                    "year": year,
                    metric_name: float(value or 0),
                }
            )
    return pd.DataFrame(records)


def render_login() -> str:
    st.sidebar.subheader("Backend Login")
    email = st.sidebar.text_input("Email", value=st.session_state.get("email", "admin@silverpush.local"))
    password = st.sidebar.text_input("Password", type="password", value=st.session_state.get("password", ""))
    col1, col2 = st.sidebar.columns(2)
    token = st.session_state.get("token", "")

    with col1:
        if st.button("Login", use_container_width=True):
            try:
                payload = api_post("/api/auth/login", {"email": email, "password": password})
                token = payload.get("token", "")
                st.session_state["token"] = token
                st.session_state["email"] = email
                st.session_state["password"] = password
                st.sidebar.success("Logged in")
            except Exception as exc:
                st.sidebar.error(f"Login failed: {exc}")

    with col2:
        if st.button("Logout", use_container_width=True):
            st.session_state["token"] = ""
            token = ""
            st.sidebar.info("Logged out")

    return token


def render_overview(token: str) -> None:
    st.title("AdOps Overview (Streamlit)")

    kpis = api_get("/api/overview/kpis", token=token)
    cards = {item.get("title"): item for item in (kpis or [])}
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("No of Campaigns", cards.get("No of Campaigns", {}).get("value", "-"), cards.get("No of Campaigns", {}).get("subtitle", ""))
    c2.metric("Gross Margin %", cards.get("Gross Margin %", {}).get("value", "-"), cards.get("Gross Margin %", {}).get("subtitle", ""))
    c3.metric("Net Margin %", cards.get("Net Margin %", {}).get("value", "-"), cards.get("Net Margin %", {}).get("subtitle", ""))
    c4.metric("Spend", cards.get("Spend", {}).get("value", "-"), cards.get("Spend", {}).get("subtitle", ""))

    st.subheader("Trends")
    revenue = api_get("/api/overview/revenue-trend", token=token)
    margin = api_get("/api/overview/margin-trend", token=token)
    cpm = api_get("/api/overview/cpm-trend", token=token)
    net_margin = api_get("/api/overview/net-margin-trend", token=token)

    rev_df = trend_to_long_df(revenue, "booked_revenue_m")
    mar_df = trend_to_long_df(margin, "gross_margin_pct")
    cpm_df = trend_to_long_df(cpm, "average_buying_cpm")
    net_df = trend_to_long_df(net_margin, "net_margin_pct")

    t1, t2 = st.columns(2)
    with t1:
        st.caption("Booked Revenue Trend")
        st.dataframe(rev_df, use_container_width=True, hide_index=True)
    with t2:
        st.caption("Gross Margin Trend")
        st.dataframe(mar_df, use_container_width=True, hide_index=True)

    t3, t4 = st.columns(2)
    with t3:
        st.caption("Average Buying CPM Trend")
        st.dataframe(cpm_df, use_container_width=True, hide_index=True)
    with t4:
        st.caption("Net Margin Trend")
        st.dataframe(net_df, use_container_width=True, hide_index=True)

    st.subheader("Bottom Campaigns")
    campaigns_payload = api_get("/api/overview/campaigns-detailed", token=token)
    campaign_rows = campaigns_payload.get("rows", []) if isinstance(campaigns_payload, dict) else []
    st.dataframe(pd.DataFrame(campaign_rows), use_container_width=True, hide_index=True)


def main() -> None:
    st.session_state.setdefault("backend_base_url", get_backend_base_url())
    st.sidebar.title("Settings")
    st.session_state["backend_base_url"] = st.sidebar.text_input(
        "BACKEND_BASE_URL",
        value=st.session_state["backend_base_url"],
        help="Example: https://your-backend.onrender.com",
    ).strip()

    token = render_login()

    if not st.session_state["backend_base_url"]:
        st.info("Set `BACKEND_BASE_URL` in sidebar (or Streamlit secrets) and log in to load data.")
        return

    try:
        health = api_get("/health")
        st.sidebar.success(f"Backend: {health.get('status', 'ok')}")
        st.sidebar.caption(f"Data source: {health.get('dataSource', '-')}")
    except Exception:
        st.sidebar.warning("Could not read /health")

    try:
        render_overview(token)
    except Exception as exc:
        st.error(f"Failed to load dashboard data: {exc}")


if __name__ == "__main__":
    main()

