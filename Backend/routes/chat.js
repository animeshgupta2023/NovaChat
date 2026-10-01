import express from "express"
import Thread from "../models/Thread.js"
import getLLMResponse from "../utils/llmServe.js"

const router = express.Router();

router.get("/thread", async(req, res)=>{
    try{
        const threads = await Thread.find({}).sort({updatedAt: -1})
        res.json(threads)
    } catch(err){
        console.log(err);
        res.status(500).json({error: "failed to fetch threads"})
    }
})

router.get("/thread/:threadId", async(req, res)=>{
    const {threadId} = req.params;

    try{
        const thread = await Thread.findOne({threadId})

        if(!thread){
            return res.status(404).json({ error: "Thread not found" });
        }

        res.json(thread.messages)
    } catch(err){
        console.log(err);
        res.status(500).json({error: "failed to fetch chat"})
    }
})

router.delete("/thread/:threadId", async(req, res)=>{
    const {threadId} = req.params;

    try{
        const deletedThread = await Thread.findOneAndDelete({threadId})

        if(!deletedThread){
            return res.status(404).json({ error: "Thread not found" });
        }

        res.status(200).json({success: "Thread deleted Successfully"})
    } catch(err){
        console.log(err);
        res.status(500).json({error: "failed to delete thread"})
    }
})

router.post("/chat", async(req, res)=>{
    const {threadId, message} = req.body;
    const provider = "gemini";

    if(!threadId || !message){
        return res.status(400).json({error: "missing required fields"})
    }

    const MAX_HISTORY = 10; // Keep the last 10 messages for the LLM
    const BATCH_SIZE = 4;   // summerize the older messages in batches of 4 to save API Calls

    try{
        let thread = await Thread.findOne({threadId})

        if(!thread){
            thread = new Thread({
                threadId,
                title: message.slice(0, 30),
                messages: [{role: "user", content: message}],
                summary: "",
                lastSummerizedLength: 0
            })    
        } else{
            thread.messages.push({role: "user", content: message})
        }
        
        let messagesForLLM = []

        const unsummerizedCount = thread.messages.length - thread.lastSummerizedLength
        if(unsummerizedCount >= MAX_HISTORY){

            const batchMessages = thread.messages
            .slice(thread.lastSummerizedLength, thread.lastSummerizedLength + BATCH_SIZE)
            .map((m)=>`${m.role}: ${m.content}`)
            .join('\n')

            const systemPrompt = [
                {
                    role: "system",
                    content: "You are an AI assistant tasked with summerizing conversation histories. Keep the summary concise, factual and retain key user preferences or important context."
                },
                {
                    role: "user",
                    content: `Existing Summary: ${thread.summary || 'None'}\n\n New messages to incorporate: \n${batchMessages}`
                }
            ];

            try{
                thread.summary = await getLLMResponse(systemPrompt, { 
                    stream: false,
                    provider: provider,
                    summarize: true,
                });
                thread.lastSummerizedLength += BATCH_SIZE;
            } catch(summaryErr){
                console.error("failed to generate summary: ", summaryErr);
            }
        }

        if(thread.lastSummerizedLength > 0){
            messagesForLLM.push({
                role: "system",
                content: `Context from earlier in the conversation: ${thread.summary}`,
            });
        }
        
        const recentMessages = thread.messages
        .slice(thread.lastSummerizedLength)
        .slice(-MAX_HISTORY)
        .map(({role, content}) => ({
            role, 
            content
        }));

        messagesForLLM.push(...recentMessages);

        const providerStream = await getLLMResponse(messagesForLLM, {
            stream: true, 
            provider: provider,
            summarize: false,
        });
        
        // tells the client to keep the connection open for streaming
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive"); 
        res.flushHeaders(); // tells the client this is the sse event

        const reader = providerStream.getReader(); // llm response
        const decoder = new TextDecoder(); // converts the raw bytes to text

        let buffer = ""; // temp storage for partiall chunks until full sse message arrives
        let assistantReply = "";
        let providerDone = false;

        while(!providerDone){
            const { value, done } = await reader.read(); // reads the chunks
            buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

            let boundary;
            while ((boundary = buffer.indexOf("\n\n")) !== -1) { //SSE messages are separated by double newlines (\n\n).
                const event = buffer.slice(0, boundary);
                buffer = buffer.slice(boundary + 2);

                const dataLine = event
                    .split(/\r?\n/)
                    .find((line) => line.startsWith("data:"));

                if (!dataLine) continue;

                const data = dataLine.slice(5).trim();
                if (data === "[DONE]") {
                    providerDone = true;
                    break;
                }

                const payload = JSON.parse(data);
                const textChunk = payload.choices?.[0]?.delta?.content;

                if (textChunk) {
                    assistantReply += textChunk;
                    res.write(`data: ${JSON.stringify({ content: textChunk })}\n\n`); // sending to client
                }
            }
            if (done) break;
        }

        thread.messages.push({role: "assistant", content: assistantReply}) 
        thread.updatedAt = new Date()
        await thread.save()

        res.write(`event: done\ndata: {}\n\n`);
        res.end();

    } catch(err){
        console.error("unable to get suitable response",err) 

        if (res.headersSent) {
            res.write(`event: error\ndata: ${JSON.stringify({ message: "Stream failed" })}\n\n`);
            res.end();
        } else {
            res.status(500).json({ error: "Server Error" });
        }
    }
})

export default router;  