const { OAuth2Client } = require("google-auth-library");

const googleClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
let client = null;

function getClient() {
  if (!googleClientId) throw new Error("GOOGLE_OAUTH_CLIENT_ID is required for Google login");
  if (!client) client = new OAuth2Client(googleClientId);
  return client;
}

async function verifyGoogleIdToken(idToken) {
  const ticket = await getClient().verifyIdToken({
    idToken: String(idToken || ""),
    audience: googleClientId
  });

  const payload = ticket.getPayload();
  if (!payload) throw new Error("Invalid Google token");
  const email = String(payload.email || "").toLowerCase();
  if (!email) throw new Error("Google token does not contain an email");
  if (!payload.email_verified) throw new Error("Google email is not verified");

  return {
    email,
    name: payload.name || payload.given_name || email
  };
}

module.exports = {
  verifyGoogleIdToken
};
