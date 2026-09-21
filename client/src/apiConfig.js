const configuredApiUrl = import.meta.env.VITE_API_URL;
const envApiUrl =
  configuredApiUrl && !configuredApiUrl.includes("YOUR_MAC_IP")
    ? configuredApiUrl
    : "";

const browserApiUrl =
  typeof window !== "undefined" &&
  window.location.hostname &&
  !["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : "http://localhost:8000";

export const API_URL = envApiUrl || browserApiUrl;
