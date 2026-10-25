// Frontend/src/config.js
const isLocalBrowser = typeof window !== "undefined" && 
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

// When deployed on EC2/production, use relative URL ("") so Nginx proxies /api, /auth, /document to port 8080.
// When developing locally on localhost, point to http://localhost:8080.
export const API_URL = (!isLocalBrowser && import.meta.env.PROD)
    ? ""
    : (import.meta.env.VITE_API_URL || "http://localhost:8080");