import express from "express"

import { isLoggedIn } from "../middlewares.js";
import { getAllThreads, ThreadInfo, deleteThread, chat } from "../controllers/chats.js";


const router = express.Router();

router.use(isLoggedIn)

// sending the threads of a user
router.get("/thread", getAllThreads);

router.get("/thread/:threadId", ThreadInfo);

router.delete("/thread/:threadId", deleteThread);

router.post("/chat", chat);

export default router;  