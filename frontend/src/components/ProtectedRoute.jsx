import { useEffect, useState } from "react"
import { Navigate, useLocation } from "react-router-dom"

function ProtectedRoute({ requiredRole, children }) {
    const location = useLocation()
    const [auth, setAuth] = useState({
        token: localStorage.getItem("token"),
        role: localStorage.getItem("role"),
    })

    useEffect(() => {
        const syncAuth = () => {
            setAuth({
                token: localStorage.getItem("token"),
                role: localStorage.getItem("role"),
            })
        }

        syncAuth()
        window.addEventListener("storage", syncAuth)

        return () => {
            window.removeEventListener("storage", syncAuth)
        }
    }, [location.pathname])

    const token = auth.token
    const role = auth.role

    if (!token) {
        return <Navigate to="/" replace />
    }

    if (requiredRole && role !== requiredRole) {
        return <Navigate to="/" replace />
    }

    return children
}

export default ProtectedRoute
