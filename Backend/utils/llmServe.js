import "dotenv/config"

const PROVIDERS = {
    gemini: {
        url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        apiKey: process.env.GEMINI_API_KEY,
        //defaultModel: "gemini-3.8-flash",
        defaultModel: "gemini-3.5-flash"
    },
    groq: {
        url: "https://api.groq.com/openai/v1/chat/completions",
        apiKey: process.env.GROQ_API_KEY,
        defaultModel: "qwen/qwen3.8-27b",
    },
    nvidia: {
        url: "https://integrate.api.nvidia.com/v1/chat/completions",
        apiKey: process.env.NVIDIA_API_KEY,
        defaultModel: "deepseek-ai/deepseek-v4.1-flash",
    },
    openrouter:{
        url: "https://openrouter.ai/api/v1/chat/completions",
        apiKey:process.env.OPENROUTER_API_KEY,
        defaultModel: "qwen/qwen3.8-27b:free"
    }
}

const getLLMResponse = async(messages, config={})=>{
    const providerKey = config.provider || "groq"; 
    const provider = PROVIDERS[providerKey];

    if (!provider) {
        throw new Error(`Unsupported provider: "${providerKey}". Supported: ${Object.keys(PROVIDERS).join(", ")}`);
    }

    if (!provider.apiKey) {
        throw new Error(`Missing API key for ${providerKey}. Check your .env file.`);
    }

    const model = config.model || provider.defaultModel;
    const max_tokens = config.max_tokens || 800;
    const stream = config.stream ?? false;

    const options = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${provider.apiKey}`
        },
        body: JSON.stringify({
            model: model, // context window size is 262k tokens or 200k words for free teir it is 8k tokens only
            messages,
            max_tokens: max_tokens,
            stream,
        })
    };

    try{
        const response = await fetch(provider.url, options);

        if(!response.ok){
            const errorData = await response.json().catch(()=>({}));
            throw new Error(
                errorData?.error?.message || `HTTP error! status: ${response.status}` 
            );
        }
        if(stream){
            return response.body;
        }
        const data = await response.json()
         
        if (!data.choices || data.choices.length === 0) {
            throw new Error("No choices returned from Groq API")
        }

        return data.choices[0].message.content 
    } catch(err){
        console.log(err)
        throw err
    }
}

export default getLLMResponse;  