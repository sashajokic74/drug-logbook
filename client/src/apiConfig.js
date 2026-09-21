const configuredApiUrl = import.meta.env.VITE_API_URL;
const envApiUrl =
  configuredApiUrl && !configuredApiUrl.includes("YOUR_MAC_IP")
    ? configuredApiUrl
    : "";

function getBrowserApiUrl() {
  if (typeof window === "undefined" || !window.location.hostname) {
    return "http://localhost:8000";
  }

  if (import.meta.env.PROD) {
    return window.location.origin;
  }

  if (!["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }

  return "http://localhost:8000";
}

export const API_URL = envApiUrl || getBrowserApiUrl();
