import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { login, signup, logout, getCurrentUser } from "../controllers/Users.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// If Nginx forwards GET /auth to Express, serve the frontend SPA index.html
router.get("/", (req, res) => {
    const distIndex = path.resolve(__dirname, "../../Frontend/dist/index.html");
    if (fs.existsSync(distIndex)) {
        return res.sendFile(distIndex);
    }
    return res.status(200).json({ status: "auth-endpoint-ready" });
});

router.post("/signup", signup);
router.post("/login", login);
router.get("/session", getCurrentUser);
router.get("/logout", logout);

export default router;