import "dotenv/config"

const getLLMResponse = async(messages, max_tokens=800)=>{
    const options = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
            model: "qwen/qwen3.8-27b", // context window size is 262k tokens or 200k words for free teir it is 8k tokens only
            messages,
            max_tokens: max_tokens,
        })
    }

    try{
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", options)
        if(!response.ok){
            const errorData = await response.json().catch(()=>({}));
            throw new Error(errorData?.error?.message || `HTTP error! status: ${response.status}`)
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