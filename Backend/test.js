import "dotenv/config"
import { ChatOpenAI } from "@langchain/openai"

if (!process.env.NVIDIA_API_KEY) {
    console.error("NVIDIA_API_KEY is missing from Backend/.env")
    process.exit(1)
}

const model = new ChatOpenAI({
    model: "deepseek-ai/deepseek-v4.1-flash",
    apiKey: process.env.NVIDIA_API_KEY,
    configuration: {
        baseURL: "https://integrate.api.nvidia.com/v1",
    },
    maxTokens: 32,
})

try {
    const response = await model.invoke(
        "Reply with exactly: NVIDIA API works"
    )
    console.log(response.content)
} catch (error) {
    console.error("NVIDIA API request failed.")
    console.error("Status:", error.status ?? "unknown")
    console.error("Message:", error.message)
    process.exitCode = 1
}