import "./ChatWindow.css"
import Chat from "../Chat/Chat.jsx"
import { MyContext } from "../../context/MyContext.jsx"
import { useContext, useEffect, useRef, useState } from "react"
import { ScaleLoader } from "react-spinners"
import { useNavigate } from "react-router-dom"

export default function ChatWindow() {
    const navigate = useNavigate()
    const { 
        prompt,
        setPrompt,
        currThreadId,
        setPrevChats,
        setNewChat,
        currentUser,
    } = useContext(MyContext)

    const [loading, setLoading] = useState(false)
    const [isOpen, setIsOpen] = useState(false)

    const fileinputRef = useRef(null)
    const dropdownRef = useRef(null)
    const userButtonRef = useRef(null)

    useEffect(() => {
        if (!isOpen) return

        const handleOutsideClick = (event) => {
            const clickedOutsideDropdown = dropdownRef.current && !dropdownRef.current.contains(event.target)
            const clickedOutsideButton = userButtonRef.current && !userButtonRef.current.contains(event.target)

            if (clickedOutsideDropdown && clickedOutsideButton) {
                setIsOpen(false)
            }
        }

        document.addEventListener("mousedown", handleOutsideClick)

        // a cleanup function below runs just before next time when the  UseEffect runs
        return () => document.removeEventListener("mousedown", handleOutsideClick)
    }, [isOpen])

    const getReply = async () => {
        const userMessage = prompt.trim()

        if (!userMessage || loading) {
            return
        }

        setNewChat(false)
        setLoading(true)
        setPrompt("")

        // Add the user message and an empty assistant message once.
        setPrevChats((chats) => [
            ...chats,
            { role: "user", content: userMessage },
            { role: "assistant", content: "" },
        ])

        try {
            const response = await fetch("http://localhost:8080/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include",
                body: JSON.stringify({
                    message: userMessage,
                    threadId: currThreadId,
                }),
            })


            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(
                    errorData.error || errorData.message || `Server error: ${response.status}`
                )
            }

            if (!response.body) {
                throw new Error("The server did not return a response stream")
            }

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            const eventBoundary = /\r?\n\r?\n/
            let buffer = ""

            const handleEvent = (event) => {
                const lines = event.split(/\r?\n/)
                const eventName = lines
                    .find((line) => line.startsWith("event:"))
                    ?.slice(6)
                    .trim()

                const data = lines
                    .filter((line) => line.startsWith("data:"))
                    .map((line) => line.slice(5).trim())
                    .join("\n")

                if (!data) return

                const payload = JSON.parse(data)

                if (eventName === "error") {
                    throw new Error(payload.message || "The response stream failed")
                }

                if (payload.content) {
                    setPrevChats((chats) => {
                        const updated = [...chats]
                        const lastIndex = updated.length - 1
                        const lastMessage = updated[lastIndex]

                        if (lastMessage?.role === "assistant") {
                            updated[lastIndex] = {
                                ...lastMessage,
                                content: lastMessage.content + payload.content,
                            }
                        }

                        return updated
                    })
                }
            }

            while (true) {
                const { value, done } = await reader.read()
                buffer += decoder.decode(value || new Uint8Array(), { stream: !done })

                let boundaryMatch
                while ((boundaryMatch = eventBoundary.exec(buffer)) !== null) {
                    const event = buffer.slice(0, boundaryMatch.index)
                    buffer = buffer.slice(
                        boundaryMatch.index + boundaryMatch[0].length
                    )
                    handleEvent(event)
                }

                if (done) {
                    if (buffer.trim()) {
                        handleEvent(buffer)
                    }
                    break
                }
            }
        } catch (err) {
            console.error(err)

            setPrevChats((chats) => {
                const updated = [...chats]
                const lastIndex = updated.length - 1
                const lastMessage = updated[lastIndex]

                if (lastMessage?.role === "assistant") {
                    updated[lastIndex] = {
                        ...lastMessage,
                        content: lastMessage.content
                            ? `${lastMessage.content}\n\n[Response stopped: ${err.message}]`
                            : `Sorry, the response failed: ${err.message}`,
                    }
                }

                return updated
            })
        } finally {
            setLoading(false)
        }
    }

    const handleProfileClick = () => {
        setIsOpen(!isOpen)
    }

    const handleLogout = async () => {
        try {
            const response = await fetch("http://localhost:8080/auth/logout", {
                method: "GET",
                credentials: "include",
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.message || "Logout failed")
            }

            localStorage.removeItem("novachat_logged_in")
            localStorage.removeItem("novachat_user")
            setIsOpen(false)
            navigate("/auth?mode=login")
        } catch (error) {
            console.error("Logout error:", error)
            alert(error.message || "Unable to log out right now.")
        }
    }

    const handleDocumentUpload = async (event) => { 
        const input = event.currentTarget
        const file = input.files?.[0]
        if (!file) return

        const formData = new FormData()
        formData.append("file", file) 
        formData.append("threadId", currThreadId)

        try {
            const response = await fetch("http://localhost:8080/document/upload", {
                method: "POST",
                credentials: "include",
                body: formData,
            })

            const result = await response.json().catch(() => ({}))
            if (!response.ok) {
                throw new Error(result.error || result.message || "Upload failed")
            }

            alert(result.message || "Document uploaded and indexed.")
        } catch (error) {
            console.error("Document upload failed:", error)
            alert(error.message || "Document upload failed.")
        } finally {
            input.value = ""
        }
    }

    return (
        <div className="chatWindow">
            <div className="navbar">
                <span>
                    NovaChat <i className="fa-solid fa-chevron-down"></i>
                </span>
                <div ref={userButtonRef} className="userIconDiv" onClick={handleProfileClick}>
                    <span className="userIcon">
                        <i className="fa-solid fa-user"></i>
                    </span>
                </div>
            </div>

            {isOpen && (
                <div ref={dropdownRef} className="dropDown">
                    <div className="profileSummary">
                        <div className="profileName">{currentUser?.username || "Guest"}</div>
                        <div className="profileEmail">{currentUser?.email || "No email"}</div>
                    </div>
                    <div className="dropDownItem">
                        <i className="fa-solid fa-gear"></i> Settings
                    </div>
                    <div className="dropDownItem">
                        <i className="fa-solid fa-cloud-arrow-up"></i> Upgrade Plan
                    </div>
                    <div className="dropDownItem" onClick={handleLogout} style={{ cursor: "pointer" }}>
                        <i className="fa-solid fa-arrow-right-from-bracket"></i> Logout
                    </div>
                </div>
            )}

            <Chat />

            <ScaleLoader color="#fff" loading={loading} />

            <div className="chatInput">
                <div className="inputBox">

                    <button
                        type="button"
                        className="uploadButton"
                        aria-label="Upload a document"
                        onClick={()=>fileinputRef.current?.click()}
                    >
                        <i className="fa-solid fa-plus" aria-hidden="true"></i>   
                    </button>

                    <input
                        ref={fileinputRef}
                        className="documentFileInput"
                        type="file"
                        accept=".pdf,.txt"
                        onChange={handleDocumentUpload}
                    />


                    <input
                        className="promptInput"
                        placeholder="Ask Anything"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") getReply()
                        }}
                    />
                    <div
                        id="submit"
                        onClick={getReply}
                        style={{
                            opacity: prompt.trim() && !loading ? 1 : 0.5,
                            pointerEvents: prompt.trim() && !loading ? "auto" : "none",
                        }}
                    >
                        <i className="fa-solid fa-paper-plane"></i>
                    </div>
                </div>
                <p className="info">
                    NovaChat can make mistakes. This is for personal use only.
                </p>
            </div>
        </div>
    )
}