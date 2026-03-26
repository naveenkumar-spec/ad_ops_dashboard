import { PublicClientApplication } from "@azure/msal-browser";

const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID;
const tenantId = import.meta.env.VITE_ENTRA_TENANT_ID;

let msalApp = null;

export function isMicrosoftLoginConfigured() {
  return Boolean(clientId && tenantId);
}

export function getMsalApp() {
  if (!isMicrosoftLoginConfigured()) {
    throw new Error("Microsoft login is not configured");
  }
  if (!msalApp) {
    msalApp = new PublicClientApplication({
      auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        redirectUri: window.location.origin
      },
      cache: {
        cacheLocation: "localStorage"
      }
    });
  }
  return msalApp;
}
