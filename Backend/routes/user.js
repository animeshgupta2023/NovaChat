import express from "express";
import { login, signup, logout, getCurrentUser } from "../controllers/Users.js";


const router = express.Router();

router.post("/signup", signup);

router.post("/login", login);
router.get("/session", getCurrentUser);
router.get("/logout", logout);

export default router;