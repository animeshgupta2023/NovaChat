import express from "express"
import Thread from "../models/Thread.js"
import getLLMResponse from "../utils/openai.js"

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
            res.json({error: "Failed to fetch threads"})
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
            res.status(500).json({error: "Thread not found"})
        }

        res.status(200).json({success: "Thread deleted Successfully"})
    } catch(err){
        console.log(err);
        res.status(500).json({error: "failed to delete thread"})
    }
})

router.post("/chat", async(req, res)=>{
    const {threadId, message} = req.body;

    if(!threadId || !message){
        res.status(400).json({error: "missing required fields"})
    }

    try{
        let thread = await Thread.findOne({threadId})

        if(!thread){
            thread = new Thread({
                threadId,
                title: message,
                messages: [{role: "user", content: message}]
            })    
        } else{
            thread.messages.push({role: "user", content: message})
        }
 
        const assistantReply = await getLLMResponse(message)
        thread.messages.push({role: "assistant", content: assistantReply}) 
        thread.updatedAt = new Date()

        await thread.save()
        res.json({reply: assistantReply})

    } catch(err){
        console.log(err)
        res.status(500).json({error: "something went wrong"})
    }
})

export default router;