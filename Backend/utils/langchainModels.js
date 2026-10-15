import "dotenv/config";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatGroq } from "@langchain/groq";

export function getChatModel(provider = "gemini", temperature = 0.3){
    if(provider == "groq" && process.env.GROQ_API_KEY){
        return new ChatGroq({
            apiKey: process.env.GROQ_API_KEY,
            model: "qwen/qwen3.8-27b",
            temperature,
        });
    }

    return new ChatGoogleGenerativeAI({
        apiKey: process.env.GEMINI_API_KEY,
        model: "gemini-3.5-flash-lite",
        temperature,
    })
}

export function getRouterModel(){
    if(process.env.GROQ_API_KEY){
        return new ChatGroq({
            apiKey: process.env.GROQ_API_KEY,
            model: "qwen/qwen3.8-27b",
            temperature:0,
            maxTokens: 300,
        });
    }
    getChatModel("gemini", 0);
}