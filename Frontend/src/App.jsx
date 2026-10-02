import './App.css'
import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom"
import { useEffect, useState } from "react"

import ChatApp from "./pages/ChatApp.jsx"
import Landing from './pages/Landing.jsx'
import Authentication from "./pages/Authentication.jsx"

const isAuthenticated = () => localStorage.getItem("novachat_logged_in") === "true"

async function verifySession() {
    try {
        const response = await fetch("http://localhost:8080/auth/session", {
            method: "GET",
            credentials: "include",
        })

        return response.ok
    } catch {
        return false
    }
}

function ProtectedRoute({ children }) {
    const [isChecking, setIsChecking] = useState(true)
    const [authorized, setAuthorized] = useState(false)

    useEffect(() => {
        const checkAuth = async () => {
            if (!isAuthenticated()) {
                setAuthorized(false)
                setIsChecking(false)
                return
            }

            const validSession = await verifySession()
            if (!validSession) {
                localStorage.removeItem("novachat_logged_in")
                localStorage.removeItem("novachat_user")
            }

            setAuthorized(validSession)
            setIsChecking(false)
        }

        checkAuth()
    }, [])

    if (isChecking) {
        return null
    }

    return authorized ? children : <Navigate to="/auth?mode=login" replace />
}

function App() {
    return (
        <>
            <Router>
              <Routes>
                  <Route path='/' element={<Landing/>}></Route>
                  <Route
                    path='/home'
                    element={
                        <ProtectedRoute>
                            <ChatApp />
                        </ProtectedRoute>
                    }
                  ></Route>
                  <Route path='/auth' element={<Authentication/>}></Route>
              </Routes>
            </Router>
        </>
    );
}

export default App
