const fs = require("fs");
const path = require("path");

function resolveKeyPath() {
  const fromEnv = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || "./secrets/google-sa.json";
  return path.isAbsolute(fromEnv) ? fromEnv : path.resolve(__dirname, fromEnv);
}

function ensureServiceAccountFile() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON;
  if (!keyJson || !String(keyJson).trim()) return;

  const targetPath = resolveKeyPath();
  const targetDir = path.dirname(targetPath);

  try {
    JSON.parse(String(keyJson));
  } catch (error) {
    throw new Error(`GOOGLE_SERVICE_ACCOUNT_KEY_JSON is not valid JSON: ${error.message}`);
  }

  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(targetPath, String(keyJson), { encoding: "utf8", mode: 0o600 });
}

module.exports = {
  ensureServiceAccountFile
};

