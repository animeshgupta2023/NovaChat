// Frontend/src/config.js
export const API_URL = import.meta.env.VITE_API_URL !== undefined 
    ? import.meta.env.VITE_API_URL 
    : (import.meta.env.PROD ? "" : "http://localhost:8080");