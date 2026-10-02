import Sidebar from "../components/Sidebar/Sidebar.jsx"
import ChatWindow from "../components/ChatWindow/ChatWindow.jsx"
import { MyContext, defaultUser } from "../context/MyContext.jsx" 
import { useState } from 'react'
import {v1 as uuidv1} from 'uuid'

const getStoredUser = () => {
    try {
        const savedUser = localStorage.getItem("novachat_user")
        return savedUser ? JSON.parse(savedUser) : defaultUser
    } catch {
        return defaultUser
    }
}

export default function ChatApp(){
    const [prompt, setPrompt] = useState("")
    const [reply, setReply] = useState(null)
    const [currThreadId, setCurrThreadId] = useState(uuidv1)
    const [prevChats, setPrevChats] = useState([])
    const [newChat, setNewChat] = useState(true) 
    const [allThreads, setAllThreads] = useState([])
    const [currentUser, setCurrentUser] = useState(getStoredUser())

    const providerValues = {
        prompt, setPrompt,
        reply, setReply,
        currThreadId, setCurrThreadId,
        newChat, setNewChat,
        prevChats, setPrevChats,
        allThreads, setAllThreads,
        currentUser, setCurrentUser,
    }

    return (
        <div className='app'>
            <MyContext.Provider value={providerValues}>
            <Sidebar></Sidebar>
            <ChatWindow></ChatWindow>
            </MyContext.Provider>
        </div>
    )
}