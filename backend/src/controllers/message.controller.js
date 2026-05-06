import messageModel from "../models/message.models.js";
import chatModel from "../models/chat.models.js";
import { generateAIResponse, streamAIResponse, generateChatTitle, generateGrammarCorrection } from "../services/ai.service.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");
import mammoth from "mammoth";

/**
 * @desc Stream AI response
 * @route POST /api/message/stream
 * @access Private
 */
export const streamMessage = async (req, res) => {
    try {
        let { chatId, content, provider, persona } = req.body;
        const userId = req.user.id;
        const file = req.file;
        let imageUrl = null;
        let audioUrl = null;

        if (file) {
            const mimeType = file.mimetype;
            const base64 = `data:${mimeType};base64,${file.buffer.toString('base64')}`;
            if (mimeType.startsWith('image/')) imageUrl = base64;
            else if (mimeType.startsWith('audio/')) audioUrl = base64;
        }

        // Verify chat
        const chat = await chatModel.findOne({ _id: chatId, user: userId });
        if (!chat) return res.status(404).json({ message: "Chat not found" });

        const displayContent = file ? `[Attached File: ${file.originalname}]\n${content || ""}` : (content || " ");

        // Save User Message
        const userMessage = await messageModel.create({
            chat: chatId,
            content: displayContent,
            role: "user"
        });

        // Set headers for SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders(); // Ensure headers are sent immediately

        const history = await messageModel.find({ chat: chatId }).sort({ createdAt: 1 });
        
        // Generate title if it's the first message
        let chatTitle = null;
        if (history.length === 1) {
            try {
                chatTitle = await generateChatTitle(provider || 'gemini', content || (file ? `File: ${file.originalname}` : "New Chat"));
                chat.title = chatTitle;
                await chat.save();
            } catch (titleError) {
                console.error("Title Generation Error:", titleError);
            }
        }

        const stream = await streamAIResponse(provider || 'gemini', history, content, imageUrl, persona || 'general', null, 0, audioUrl);

        let fullResponse = "";
        try {
            for await (const chunk of stream) {
                const text = chunk.content;
                if (text) {
                    fullResponse += text;
                    res.write(`data: ${JSON.stringify({ text })}\n\n`);
                }
            }
        } catch (streamError) {
            console.error("Actual Stream Consumption Error:", streamError);
            res.write(`data: ${JSON.stringify({ error: "AI stream interrupted or quota exceeded." })}\n\n`);
            res.end();
            return;
        }

        // Save AI Message at the end
        const aiMessage = await messageModel.create({
            chat: chatId,
            content: fullResponse || "Sorry, I couldn't generate a response. Please try again later.",
            role: "ai"
        });

        // Send final message with complete data
        res.write(`data: ${JSON.stringify({ done: true, aiMessage, userMessage, chatTitle })}\n\n`);
        res.end();

    } catch (error) {
        console.error("Stream Initial Error:", error);
        // If it failed before sending any data, we still need to close the connection
        res.write(`data: ${JSON.stringify({ error: error.message || "Failed to start AI stream" })}\n\n`);
        res.end();
    }
};

/**
 * @desc Send a message and get an AI response
 * @route POST /api/message
 * @access Private
 */
export const sendMessage = async (req, res) => {
    try {
        let { chatId, content, provider, persona } = req.body;
        const userId = req.user.id;
        const file = req.file;
        let imageUrl = null;
        let audioUrl = null;

        // Process file if attached
        if (file) {
            const mimeType = file.mimetype;
            if (mimeType === 'application/pdf') {
                const pdfData = await pdfParse(file.buffer);
                content = `[Document Content:\n${pdfData.text}\n]\n\n${content || "Please summarize this document."}`;
            } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || mimeType === 'application/msword') {
                const docData = await mammoth.extractRawText({ buffer: file.buffer });
                content = `[Document Content:\n${docData.value}\n]\n\n${content || "Please summarize this document."}`;
            } else if (mimeType.startsWith('text/')) {
                const textData = file.buffer.toString('utf-8');
                content = `[Document Content:\n${textData}\n]\n\n${content || "Please summarize this document."}`;
            } else if (mimeType.startsWith('image/')) {
                // Images require Gemini for vision capabilities
                provider = 'gemini'; 
                imageUrl = `data:${mimeType};base64,${file.buffer.toString('base64')}`;
                content = content || "Please describe this image.";
            } else if (mimeType.startsWith('audio/')) {
                provider = 'gemini';
                audioUrl = `data:${mimeType};base64,${file.buffer.toString('base64')}`;
                content = content || "Listen to this audio and provide feedback.";
            } else {
                return res.status(400).json({ success: false, message: "Unsupported file type." });
            }
        }

        if (!content && !imageUrl) {
            return res.status(400).json({ success: false, message: "Message content or file is required." });
        }

        // Verify chat exists and belongs to user
        const chat = await chatModel.findOne({ _id: chatId, user: userId });
        if (!chat) {
            return res.status(404).json({
                message: "Chat not found or unauthorized",
                success: false
            });
        }

        // Fetch past messages for context
        const history = await messageModel.find({ chat: chatId }).sort({ createdAt: 1 });

        let isNewChat = history.length === 0;

        // Save User Message
        const userMessage = await messageModel.create({
            chat: chatId,
            content: file ? `[Attached File: ${file.originalname}]\n${content || ""}` : (content || " "),
            role: "user"
        });

        // Get AI Response from the requested provider (defaults to gemini)
        let aiResponseText;
        try {
            aiResponseText = await generateAIResponse(provider || 'gemini', history, content, imageUrl, persona || 'general', null, 0, audioUrl);
        } catch (aiError) {
            console.error("AI GENERATION ERROR DETAILS:", {
                provider: provider || 'gemini',
                error: aiError.message,
                stack: aiError.stack,
                historyLength: history.length,
                contentLength: content?.length
            });
            const modelName = provider === 'mistral' ? 'SeekrNew' : 'SeekrX 2.5';
            aiResponseText = `${modelName} couldn't generate a response right now. Please try again.`;
        }

        // If it's the first message, generate a chat title dynamically
        if (isNewChat) {
            const newTitle = await generateChatTitle(provider || 'gemini', content || (file ? `File: ${file.originalname}` : "New Chat"));
            chat.title = newTitle;
            await chat.save();
        }

        // Save AI Message
        const aiMessage = await messageModel.create({
            chat: chatId,
            content: aiResponseText,
            role: "ai"
        });

        res.status(201).json({
            message: "Message sent and response received",
            success: true,
            data: {
                userMessage,
                aiMessage,
                chatTitle: isNewChat ? chat.title : undefined
            }
        });
    } catch (error) {
        console.error("Message Controller Error:", error);
        res.status(500).json({
            message: "Error sending message: " + error.message,
            success: false,
            err: error.stack
        });
    }
};

/**
 * @desc Get all messages for a specific chat
 * @route GET /api/message/:chatId
 * @access Private
 */
export const getChatMessages = async (req, res) => {
    try {
        const { chatId } = req.params;
        const userId = req.user.id;

        // Verify chat exists and belongs to user
        const chat = await chatModel.findOne({ _id: chatId, user: userId });
        if (!chat) {
            return res.status(404).json({
                message: "Chat not found or unauthorized",
                success: false
            });
        }

        const messages = await messageModel.find({ chat: chatId }).sort({ createdAt: 1 });

        res.status(200).json({
            message: "Messages fetched successfully",
            success: true,
            messages
        });
    } catch (error) {
        res.status(500).json({
            message: "Error fetching messages",
            success: false,
            err: error.message
        });
    }
};

/**
 * @desc Check grammar of the provided text
 * @route POST /api/message/grammar-check
 * @access Private
 */
export const grammarCheck = async (req, res) => {
    try {
        const { content, provider } = req.body;
        
        if (!content || content.trim().length === 0) {
            return res.status(400).json({ success: false, message: "Content is required" });
        }

        const correction = await generateGrammarCorrection(provider || 'gemini', content);

        res.status(200).json({
            success: true,
            correction: correction === "CORRECT" ? null : correction
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error checking grammar",
            err: error.message
        });
    }
};
