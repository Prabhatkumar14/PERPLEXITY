import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatMistralAI } from "@langchain/mistralai";
import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { searchWeb, needsSearch } from "./search.service.js";

/**
 * Ye aapka System Prompt hai. Aap isko apne hisaab se change kar sakte hain.
 */
const getSystemPrompt = (persona = 'general') => {
    const currentDate = new Date().toLocaleString('en-IN', { 
        timeZone: 'Asia/Kolkata',
        dateStyle: 'full', 
        timeStyle: 'long' 
    });

    const basePrompt = `You are an expert AI assistant for an app called SeekrX. 
Current Date/Time: ${currentDate}.
CRITICAL RULES:
1. LANGUAGE MIRRORING: Always reply in the SAME LANGUAGE as the user's latest message. If the user talks in Hinglish, reply in Hinglish. If Hindi, then Hindi. If English, then English.
2. STYLE: Provide helpful, well-structured, and balanced responses. If a question is simple, be direct. If it's complex, provide a detailed breakdown.
3. FORMATTING: Use Markdown for readability.
4. IDENTITY: You are SeekrX Assistant.`;

    const personas = {
        general: `${basePrompt}\nStyle: Helpful, balanced, and direct.`,
        coder: `${basePrompt}\nStyle: Expert Software Engineer. Focus on clean code, best practices, and detailed technical explanations. Always use code blocks.`,
        creative: `${basePrompt}\nStyle: Creative Writer. Use expressive language, storytelling, and vivid descriptions. Be imaginative and engaging.`,
        tutor: `${basePrompt}
Style: Professional Spoken English & Interview Coach.
CRITICAL INSTRUCTIONS:
1. OUTPUT FORMAT: You MUST respond in a valid JSON object. Do not include any text outside the JSON.
2. LANGUAGE RATIO: 70% simple English (to encourage exposure), 30% Hinglish/Hindi (for clear explanations).
3. JSON STRUCTURE:
{
  "conversationalResponse": "Your short, human-like reply to the user in English.",
  "hindiExplanation": "Brief explanation or encouragement in Hinglish.",
  "corrections": [
    { "original": "text", "corrected": "text", "why": "reason in Hinglish", "type": "grammar|spelling|pronunciation" }
  ],
  "betterVersion": "A professional version of their entire input for interviews.",
  "metrics": {
    "confidence": 0-100,
    "fluency": 0-100,
    "professionalism": 0-100,
    "grammar": 0-100,
    "interviewReadiness": 0-100
  },
  "fillersDetected": ["umm", "actually", "like"],
  "practiceTask": "A short sentence for the user to repeat.",
  "mode": "beginner|intermediate|advanced"
}
4. AUDIO ANALYSIS: If audio is provided, listen for hesitations, 'umm', 'ah', 'matlab', and pronunciation issues. Mention them in the corrections or fillersDetected.
5. TONE: Be a supportive mentor, not a strict checker. Use short, punchy sentences.`
    };

    return personas[persona] || personas.general;
};

/**
 * API Key Rotation Logic
 */
let geminiIndex = 0;
let mistralIndex = 0;

const getNextKey = (provider) => {
    if (provider === 'mistral') {
        const keys = [process.env.MISTRAL_API_KEY, process.env.MISTRAL_API_KEY_2].filter(k => k);
        const key = keys[mistralIndex % keys.length];
        mistralIndex++;
        return key;
    } else {
        const keys = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_2].filter(k => k);
        const key = keys[geminiIndex % keys.length];
        geminiIndex++;
        return key;
    }
};

/**
 * Helper to get the correct LangChain model based on provider
 */
const getModel = (provider) => {
    const key = getNextKey(provider);
    if (!key) throw new Error(`${provider.toUpperCase()} API Key missing`);

    if (provider === 'mistral') {
        return new ChatMistralAI({ 
            model: "mistral-small-latest", 
            temperature: 0.7, 
            apiKey: key 
        });
    } else {
        return new ChatGoogleGenerativeAI({ 
            model: "gemini-flash-latest", 
            apiKey: key,
            maxRetries: 1,
            temperature: 0.7
        });
    }
};

/**
 * Generate AI Response using the requested provider
 */
export const generateAIResponse = async (provider, history, newPrompt, imageUrl = null, persona = 'general', searchResults = null, retryCount = 0, audioUrl = null) => {
    // Audio requires Gemini
    const effectiveProvider = audioUrl ? 'gemini' : provider;
    const model = getModel(effectiveProvider);
    const limitedHistory = history.slice(-15);
    
    // Real-time search logic
    let searchContext = "";
    if (searchResults) {
        searchContext = `\n\n[CRITICAL REAL-TIME DATA - PRIORITIZE THIS]:\n${searchResults}\n\n(Instruction: Use the data above as the absolute truth for current facts.)`;
    } else if (persona !== 'tutor' && needsSearch(newPrompt)) {
        searchResults = await searchWeb(newPrompt);
        if (searchResults) {
            console.log("Search Context Generated Successfully");
            searchContext = `\n\n[CRITICAL REAL-TIME DATA - PRIORITIZE THIS]:\n${searchResults}\n\n(Instruction: Use the data above as the absolute truth for current facts, even if it contradicts your training.)`;
        } else {
            console.log("Search triggered but returned no results.");
        }
    }

    const messages = [new SystemMessage(getSystemPrompt(persona) + searchContext)];
    
    limitedHistory.forEach(msg => {
        if (msg.role === 'ai') messages.push(new AIMessage(msg.content || " "));
        else messages.push(new HumanMessage(msg.content || " "));
    });
    
    if (audioUrl) {
        // Multi-modal message with Audio
        const [mimeTypePart, base64Data] = audioUrl.split(';base64,');
        const mimeType = mimeTypePart.split(':')[1];
        
        messages.push(new HumanMessage({
            content: [
                { type: "text", text: newPrompt || "Listen to this audio and provide feedback as a tutor." },
                { 
                    type: "media", 
                    mimeType: mimeType, 
                    data: base64Data 
                }
            ]
        }));
    } else if (imageUrl) {
        messages.push(new HumanMessage({
            content: [{ type: "text", text: newPrompt }, { type: "image_url", image_url: imageUrl }]
        }));
    } else {
        messages.push(new HumanMessage(newPrompt));
    }

    try {
        console.log(`Generating AI response using ${effectiveProvider}...`);
        const response = await model.invoke(messages);
        return response?.content;
    } catch (error) {
        // ... (rest of error handling remains same)
        if ((error?.message?.includes('429') || error?.message?.includes('quota')) && retryCount < 2) {
            return generateAIResponse(effectiveProvider, history, newPrompt, imageUrl, persona, searchResults, retryCount + 1, audioUrl);
        }
        
        if (persona !== 'fallback' && !audioUrl) {
            const fallbackProvider = effectiveProvider === 'gemini' ? 'mistral' : 'gemini';
            return generateAIResponse(fallbackProvider, history, newPrompt, imageUrl, 'fallback', searchResults);
        }
        throw error;
    }
};

/**
 * Stream AI Response using the requested provider
 */
export const streamAIResponse = async (provider, history, newPrompt, imageUrl = null, persona = 'general', searchResults = null, retryCount = 0, audioUrl = null) => {
    const effectiveProvider = audioUrl ? 'gemini' : provider;
    const model = getModel(effectiveProvider);
    const limitedHistory = history.slice(-15);
    
    // Real-time search logic for streaming
    let searchContext = "";
    if (searchResults) {
        searchContext = `\n\n[CRITICAL REAL-TIME DATA - PRIORITIZE THIS]:\n${searchResults}\n\n(Instruction: Use the data above as the absolute truth for current facts.)`;
    } else if (persona !== 'tutor' && needsSearch(newPrompt)) {
        searchResults = await searchWeb(newPrompt);
        if (searchResults) {
            console.log("Stream Search Context Generated Successfully");
            searchContext = `\n\n[CRITICAL REAL-TIME DATA - PRIORITIZE THIS]:\n${searchResults}\n\n(Instruction: Use the data above as the absolute truth for current facts.)`;
        } else {
            console.log("Stream search triggered but returned no results.");
        }
    }

    const messages = [new SystemMessage(getSystemPrompt(persona) + searchContext)];
    
    limitedHistory.forEach(msg => {
        if (msg.role === 'ai') messages.push(new AIMessage(msg.content || " "));
        else messages.push(new HumanMessage(msg.content || " "));
    });
    
    if (audioUrl) {
        const [mimeTypePart, base64Data] = audioUrl.split(';base64,');
        const mimeType = mimeTypePart.split(':')[1];

        messages.push(new HumanMessage({
            content: [
                { type: "text", text: newPrompt || "Listen to this audio and provide feedback as a tutor." },
                { 
                    type: "media", 
                    mimeType: mimeType, 
                    data: base64Data 
                }
            ]
        }));
    } else if (imageUrl) {
        messages.push(new HumanMessage({
            content: [{ type: "text", text: newPrompt }, { type: "image_url", image_url: imageUrl }]
        }));
    } else {
        messages.push(new HumanMessage(newPrompt));
    }

    try {
        console.log(`Starting AI stream using ${effectiveProvider}...`);
        return await model.stream(messages);
    } catch (error) {
        console.error(`Stream Error for ${effectiveProvider}:`, error.message);
        
        if ((error?.message?.includes('429') || error?.message?.includes('quota')) && retryCount < 2) {
            return streamAIResponse(effectiveProvider, history, newPrompt, imageUrl, persona, searchResults, retryCount + 1, audioUrl);
        }

        if (persona !== 'fallback' && !audioUrl) {
            const fallbackProvider = effectiveProvider === 'gemini' ? 'mistral' : 'gemini';
            return await streamAIResponse(fallbackProvider, history, newPrompt, imageUrl, 'fallback', searchResults);
        }
        throw error;
    }
};

/**
 * Generate a short title for a new chat based on the first prompt
 */
export const generateChatTitle = async (provider, firstPrompt) => {
    try {
        let cleanPrompt = firstPrompt.replace(/\[Attached File:.*?\]/g, '').trim();
        if (cleanPrompt.startsWith('{')) {
            try {
                const parsed = JSON.parse(cleanPrompt);
                cleanPrompt = parsed.conversationalResponse || parsed.text || cleanPrompt;
            } catch (e) {
                // If partial JSON, just use as is
            }
        }
        
        if (!cleanPrompt) cleanPrompt = "Audio/File Chat";

        const words = cleanPrompt.split(/\s+/).slice(0, 4).join(' ');
        const localTitle = words + (cleanPrompt.split(/\s+/).length > 4 ? '...' : '');
        
        return localTitle || "New Chat";
    } catch (err) {
        return "New Chat";
    }
};

/**
 * Generate a grammar correction for the given text
 */
export const generateGrammarCorrection = async (provider, text) => {
    const prompt = `You are a strict grammar assistant. Analyze the following text. If it contains grammatical errors, spelling mistakes, or is written in Hinglish, reply ONLY with the fully corrected, natural-sounding English sentence. Do not add any conversational text, quotes, or explanations. If the text is already perfect English and needs no changes, reply ONLY with the exact word: CORRECT.
Text: "${text}"`;

    try {
        const model = getModel(provider);
        const response = await model.invoke([new HumanMessage(prompt)]);
        return response.content.trim().replace(/^"|"$/g, '');
    } catch (err) {
        console.error("Error generating grammar correction:", err);
        return "CORRECT";
    }
};
