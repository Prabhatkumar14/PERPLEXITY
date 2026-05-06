import chatModel from "../models/chat.models.js";
import messageModel from "../models/message.models.js";

/**
 * @desc Create a new chat session
 * @route POST /api/chat
 * @access Private
 */
export const createChat = async (req, res) => {
    try {
        const userId = req.user.id;
        const { title } = req.body;

        const newChat = await chatModel.create({
            user: userId,
            title: title || "New Chat"
        });

        res.status(201).json({
            message: "Chat created successfully",
            success: true,
            chat: newChat
        });
    } catch (error) {
        res.status(500).json({
            message: "Error creating chat",
            success: false,
            err: error.message
        });
    }
};

/**
 * @desc Get all chats for logged-in user
 * @route GET /api/chat
 * @access Private
 */
export const getUserChats = async (req, res) => {
    try {
        const userId = req.user.id;

        const chats = await chatModel.find({ user: userId }).sort({ updatedAt: -1 });

        res.status(200).json({
            message: "Chats fetched successfully",
            success: true,
            chats
        });
    } catch (error) {
        res.status(500).json({
            message: "Error fetching chats",
            success: false,
            err: error.message
        });
    }
};

/**
 * @desc Delete a chat and its messages
 * @route DELETE /api/chat/:id
 * @access Private
 */
export const deleteChat = async (req, res) => {
    try {
        const chatId = req.params.id;
        const userId = req.user.id;

        const chat = await chatModel.findOne({ _id: chatId, user: userId });

        if (!chat) {
            return res.status(404).json({
                message: "Chat not found or unauthorized",
                success: false
            });
        }

        // Delete associated messages
        await messageModel.deleteMany({ chat: chatId });
        // Delete chat
        await chatModel.findByIdAndDelete(chatId);

        res.status(200).json({
            message: "Chat and associated messages deleted successfully",
            success: true
        });
    } catch (error) {
        res.status(500).json({
            message: "Error deleting chat",
            success: false,
            err: error.message
        });
    }
};
