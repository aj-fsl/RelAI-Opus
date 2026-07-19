export const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

// Startup diagnostics — runs once when this module is first imported
console.log("[config/api] import.meta.env:", import.meta.env);
console.log("[config/api] VITE_API_BASE_URL:", import.meta.env.VITE_API_BASE_URL);
console.log("[config/api] API_BASE resolved to:", API_BASE);

if (!API_BASE) {
  console.warn(
    "[config/api] WARNING: VITE_API_BASE_URL is not set. " +
    "All API requests will go to the current origin. " +
    "Set VITE_API_BASE_URL before running `vite build`."
  );
}
