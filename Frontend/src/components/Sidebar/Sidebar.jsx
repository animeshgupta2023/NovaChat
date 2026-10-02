import "./Sidebar.css"
import { useContext, useEffect } from "react"
import {MyContext} from "../../context/MyContext.jsx"
import {v1 as uuidv1} from 'uuid'

export default function Sidebar(){
    const {allThreads, setAllThreads, currThreadId, setNewChat, setPrompt, setReply, setCurrThreadId, setPrevChats, currentUser, prevChats} = useContext(MyContext)

    const getAllThreads = async()=>{
        try{
            const response = await fetch("http://localhost:8080/api/thread", {
                credentials: "include",
            })
            const res = await response.json()
            const filteredData = res.map(thread => ({threadId: thread.threadId, title: thread.title}))   
            setAllThreads(filteredData)
        } catch(err){   
            console.log(err)
        }
    };

    useEffect(()=>{
        getAllThreads()
    }, [currThreadId, prevChats.length])

    const createNewChat = ()=>{
        setNewChat(true) 
        setPrompt("")
        setReply(null)
        setCurrThreadId(uuidv1())
        setPrevChats([])
    }

    const changeThread = async(newThreadId)=>{
        setCurrThreadId(newThreadId)

        try{
            const response = await fetch(`http://localhost:8080/api/thread/${newThreadId}`, {
                credentials: "include",
            })
            const res = await response.json()
            setPrevChats(res)
            setNewChat(false)
            setReply(null)
        }catch(err){    
            console.log(err)
        }
    }

    const deleteThread = async(threadId) =>{
        try{
            const response = await fetch(`http://localhost:8080/api/thread/${threadId}`, {
                method: "DELETE",
                credentials: "include",
            })
            const res = await response.json()

            setAllThreads(prev=> prev.filter(thread=>thread.threadId !== threadId))
            if(threadId === currThreadId){
                createNewChat()
            }
        } catch(err){
            console.log(err)
        }
    }

    return (
        <section className="sidebar">
            <button onClick={createNewChat}>
                <img src="src/assets/blacklogo.png" alt="blacklogo" className="logo"/> 
                <span><i className="fa-solid fa-pen-to-square"></i></span>
            </button>

            <ul className="history">
                {
                    allThreads?.map((thread, idx)=>(
                        <li key={idx} 
                            onClick={()=>changeThread(thread.threadId)}
                            className={thread.threadId === currThreadId? "highlighted": " "}
                        >
                            {thread.title}
                            <i className="fa-solid fa-trash-can"
                               onClick={(e)=>{
                                    e.stopPropagation()
                                    deleteThread(thread.threadId)
                               }}
                            ></i>
                        </li>
                    ))
                }
            </ul>

            <div className="sign">
                <p className="userDisplayName">{currentUser?.username || "Guest"}</p>
                <p className="userDisplayEmail">{currentUser?.email || "Not signed in"}</p>
            </div>
        </section>
    )
}