import { Router } from "express";
import { sendMessage, streamMessage, getChatMessages, grammarCheck } from "../controllers/message.controller.js";
import { authUser } from "../middleware/auth.middleware.js";

import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });
const messageRouter = Router();

// Protect all message routes
messageRouter.use(authUser);

/**
 * @route POST /api/message
 */
messageRouter.post("/", upload.single('file'), sendMessage);
messageRouter.post("/stream", upload.single('file'), streamMessage);

/**
 * @route POST /api/message/grammar-check
 */
messageRouter.post("/grammar-check", grammarCheck);

/**
 * @route GET /api/message/:chatId
 */
messageRouter.get("/:chatId", getChatMessages);

export default messageRouter;
