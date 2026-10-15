import { tool } from "@langchain/core/tools";
import { z } from "zod";


// weather search tool 
export const weatherTool = tool(
    async ({ city, units = "metric" }) => {
        const apiKey = process.env.OPENWEATHER_API_KEY;
        if (!apiKey) {
            return "OpenWeather API key is not configured on the server.";
        }

        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
            city
        )}&units=${units}&appid=${apiKey}`;

        const res = await fetch(url);
        const data = await res.json();

        if (!res.ok) {
            return `Could not fetch weather for "${city}": ${data.message || res.statusText}`;
        }

        const unitSymbol = units === "imperial" ? "°F" : "°C";
        return JSON.stringify({
            location: `${data.name}, ${data.sys?.country}`,
            temperature: `${data.main?.temp}${unitSymbol}`,
            feels_like: `${data.main?.feels_like}${unitSymbol}`,
            condition: data.weather?.[0]?.description,
            humidity: `${data.main?.humidity}%`,
            wind_speed: `${data.wind?.speed} m/s`,
        });
    },
    {
        name: "get_current_weather",
        description:
            "Get real-time current weather, temperature, humidity, and wind conditions for any city in the world.",
        schema: z.object({
            city: z.string().describe("City name, e.g., 'Faridabad', 'New Delhi', 'London, UK'"),
            units: z.enum(["metric", "imperial"]).optional().default("metric"),
        }),
    }
);

// Tavily Web Search Tool
export const tavilySearchTool = tool(
    async ({ query }) => {
        const apiKey = process.env.TAVILY_API_KEY;
        if (!apiKey) {
            return "Tavily API key is not configured on the server.";
        }

        const res = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                api_key: apiKey,
                query,
                search_depth: "basic",
                max_results: 4,
                include_answer: true,
            }),
        });

        if (!res.ok) {
            return `Web search failed with status ${res.status}`;
        }

        const data = await res.json();
        const snippets = (data.results || []).map((r, i) => ({
            index: i + 1,
            title: r.title,
            url: r.url,
            content: r.content,
        }));

        return JSON.stringify({
            direct_answer: data.answer || null,
            sources: snippets,
        });
    },
    {
        name: "web_search",
        description:
            "Search the live web using Tavily for current events, recent news, live documentation, facts, or information not present in uploaded documents.",
        schema: z.object({
            query: z.string().describe("The search query to look up on the web"),
        }),
    }
);

export const AGENT_TOOLS = [weatherTool, tavilySearchTool];
export const TOOL_MAP = {
    get_current_weather: weatherTool,
    web_search: tavilySearchTool,
};