const { createRemoteJWKSet, jwtVerify } = require("jose");

const tenantId = process.env.ENTRA_TENANT_ID || process.env.POWERBI_TENANT_ID;
const clientId = process.env.ENTRA_CLIENT_ID || process.env.POWERBI_CLIENT_ID;

function getIssuer() {
  return `https://login.microsoftonline.com/${tenantId}/v2.0`;
}

function getJwks() {
  return createRemoteJWKSet(new URL(`${getIssuer()}/discovery/v2.0/keys`));
}

async function verifyEntraIdToken(idToken) {
  if (!tenantId || !clientId) {
    throw new Error("ENTRA_TENANT_ID and ENTRA_CLIENT_ID are required for company-email login");
  }
  const { payload } = await jwtVerify(String(idToken || ""), getJwks(), {
    issuer: getIssuer(),
    audience: clientId
  });
  const email = payload.preferred_username || payload.upn || payload.email;
  if (!email) {
    throw new Error("Could not read user email from Microsoft token");
  }
  return {
    email: String(email).toLowerCase(),
    name: payload.name || payload.given_name || email
  };
}

module.exports = {
  verifyEntraIdToken
};
