import dotenv from "dotenv";
import SearchCache from "../models/searchCache.model.js";
dotenv.config();

/**
 * Tavily API Service for real-time web search
 */
export const searchWeb = async (query) => {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
        console.warn("TAVILY_API_KEY is missing. Real-time search disabled.");
        return null;
    }

    // Check Cache first
    try {
        const cachedResult = await SearchCache.findOne({ query: query.toLowerCase().trim() });
        if (cachedResult) {
            console.log(`[CACHE HIT] Returning saved results for: "${query}"`);
            return cachedResult.results;
        }
    } catch (err) {
        console.error("Cache Read Error:", err);
    }

    try {
        console.log(`Searching the web for: "${query}"...`);
        const response = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                api_key: apiKey,
                query: query,
                search_depth: "basic", // 'basic' is faster and cheaper, 'advanced' is deeper
                include_answer: true,
                max_results: 5,
            }),
        });

        const data = await response.json();
        console.log("Tavily Response Received:", !!data.results);
        
        if (!response.ok) {
            console.error("Tavily API Error Details:", data);
            throw new Error(data.detail || "Tavily API error");
        }

        const results = data.results.map(res => `- [${res.title}](${res.url}): ${res.content}`).join("\n\n");
        const answer = data.answer ? `\n\nSummary Answer: ${data.answer}` : "";
        const finalResults = `REAL-TIME WEB SEARCH RESULTS:\n\n${results}${answer}`;

        // Save to Cache
        try {
            await SearchCache.create({ 
                query: query.toLowerCase().trim(), 
                results: finalResults 
            });
            console.log(`[CACHE SAVED] New results stored for: "${query}"`);
        } catch (err) {
            console.error("Cache Write Error:", err);
        }

        return finalResults;
    } catch (error) {
        console.error("Web Search Error:", error);
        return null;
    }
};

/**
 * Logic to determine if a query needs real-time search
 */
export const needsSearch = (query) => {
    const keywords = [
        "news", "latest", "today", "current", "who is", "who won", "score", 
        "price", "weather", "status", "election", "result", "recently", 
        "now", "bihar cm", "prime minister", "president", "ipl", "t20",
        "cm", "pm", "chief minister", "minister", "winner", "won", "happened",
        "kab", "kaun", "kon", "kya", "news", "update"
    ];
    
    const lowerQuery = query.toLowerCase();
    return keywords.some(keyword => lowerQuery.includes(keyword)) || lowerQuery.split(" ").length > 10;
};
