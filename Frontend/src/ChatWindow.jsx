import "./ChatWindow.css"
import Chat from "./Chat.jsx"
import { MyContext } from "./MyContext.jsx"
import { useContext, useState, useEffect} from "react"
import {ScaleLoader} from "react-spinners"

export default function ChatWindow(){
    const {prompt, setPrompt, reply, setReply, currThreadId, setPrevChats, setNewChat } = useContext(MyContext)
    const [loading, setLoading] = useState(false)
    const [isOpen, setIsOpen] = useState(false) 

    const getReply = async()=>{
        if(!prompt || !prompt.trim()){
            return
        }
        setNewChat(false)
        setLoading(true)
        const options = {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: prompt,
                threadId: currThreadId,
            })
        }

        try{
            const response = await fetch("http://localhost:8080/api/chat", options) 
            if(!response.ok){
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Server error: ${response.status}`);
            }
            const res = await response.json() 
            setReply(res.reply)
        } catch(err){
            console.log(err);
        }
        setLoading(false)
    } 

    // append new chats to the prevChats
    useEffect(()=>{
        if(prompt && reply){
            setPrevChats(prevChats=>(
                [...prevChats, {
                    role: "user",
                    content: prompt
                },{
                    role: "assistant",
                    content: reply
                }]
            ))
        }
        setPrompt("")
    }, [reply]);

    const handleProfileClick = ()=>{
        setIsOpen(!isOpen)
    }

    return (
        <div className="chatWindow">
            <div className="navbar">
                <span>NovaChat <i className="fa-solid fa-chevron-down"></i></span>
                <div className="userIconDiv" onClick={handleProfileClick}>
                    <span className="userIcon"><i className="fa-solid fa-user"></i></span>
                </div>
            </div> 
            {
                isOpen &&
                <div className="dropDown"> 
                    <div className="dropDownItem"><i class="fa-solid fa-gear"></i> Settings</div>
                    <div className="dropDownItem"><i class="fa-solid fa-cloud-arrow-up"></i> Upgrade Plan</div>
                    <div className="dropDownItem"><i class="fa-solid fa-arrow-right-from-bracket"></i> Logout</div>
                </div>
            }

            <Chat></Chat>

            <ScaleLoader color="#fff" loading={loading}>

            </ScaleLoader>

            <div className="chatInput">
                <div className="inputBox">
                    <input placeholder="Ask Anything"
                        value={prompt}
                        onChange={(e)=>setPrompt(e.target.value)}
                        onKeyDown={(e)=> e.key === 'Enter'? getReply(): ''}
                    >
                    </input>
                    <div id="submit" onClick={getReply} style={{opacity: prompt.trim() ? 1: 0.5, pointerEvents: prompt.trim()?'auto': 'none'}}>
                        <i className="fa-solid fa-paper-plane"></i>
                    </div>
                </div>
                <p className="info">
                    NovaChat can make mistakes. This is for persnal use only.
                </p>
            </div>
        </div>
    )
}