import express from "express";
import multer from "multer";
import { isLoggedIn } from "../middlewares.js";
import { getDocumentStatus, uploadDocument } from "../controllers/Documents.js";

const upload = multer({storage: multer.memoryStorage()});
const router = express.Router();

router.use(isLoggedIn);

router.post("/upload", upload.single("file"), uploadDocument);
router.get("/:documentId/status", getDocumentStatus);

export default router;