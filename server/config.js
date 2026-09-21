import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, ".env");

if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) return;

    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim();

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

const isProduction = process.env.NODE_ENV === "production";

function requiredInProduction(name, fallback) {
  const value = process.env[name];

  if (value) return value;

  if (isProduction) {
    throw new Error(`${name} must be set in production`);
  }

  console.warn(`${name} is not set; using development fallback`);
  return fallback;
}

export const config = {
  corsOrigins: (process.env.CORS_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  defaultAdminPassword: requiredInProduction(
    "DEFAULT_ADMIN_PASSWORD",
    "admin123"
  ),
  jwtSecret: requiredInProduction(
    "JWT_SECRET",
    "development-only-jwt-secret"
  ),
  port: Number(process.env.PORT || 8000),
};
