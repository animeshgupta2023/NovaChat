import "./Chat.css"
import { useContext, useRef, useEffect } from "react"
import { MyContext } from "../../context/MyContext"
import ReactMarkdown from "react-markdown"
import rehypeHighlight from "rehype-highlight"
import "highlight.js/styles/github-dark.css"

export default function Chat(){
    const {newChat, prevChats} = useContext(MyContext);
    const chatEndRef = useRef(null)

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [prevChats])

    return (
        <>  
            {newChat && <h1>Start a new Chat!</h1>}
            <div className="chats">
                <div className="chatContent">
                    {prevChats?.map((chat, idx)=>(
                        <div className={chat.role === "user"? "userDiv": "novaDiv"} key={idx}> 
                            {chat.role === "user"? (
                                <p className="userMessage">{chat.content}</p>
                            ):(
                                <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                                    {chat.content}
                                </ReactMarkdown>
                            )}
                        </div>    
                    ))}
                    <div ref={chatEndRef} />
                </div>
            </div>
        </>
    )
}