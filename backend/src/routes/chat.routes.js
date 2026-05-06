import { Router } from "express";
import { createChat, getUserChats, deleteChat } from "../controllers/chat.controller.js";
import { authUser } from "../middleware/auth.middleware.js";

const chatRouter = Router();

// Protect all chat routes
chatRouter.use(authUser);

/**
 * @route POST /api/chat
 */
chatRouter.post("/", createChat);

/**
 * @route GET /api/chat
 */
chatRouter.get("/", getUserChats);

/**
 * @route DELETE /api/chat/:id
 */
chatRouter.delete("/:id", deleteChat);

export default chatRouter;
