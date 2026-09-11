import { useEffect, useState } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { getSession } from "../api"

function ProtectedRoute({ requiredRole, children }) {
    const location = useLocation()
    const [auth, setAuth] = useState({
        session: getSession(),
    })

    useEffect(() => {
        const syncAuth = () => {
            setAuth({ session: getSession() })
        }

        syncAuth()
        window.addEventListener("storage", syncAuth)
        window.addEventListener("smart-vle-session-change", syncAuth)

        return () => {
            window.removeEventListener("storage", syncAuth)
            window.removeEventListener("smart-vle-session-change", syncAuth)
        }
    }, [location.pathname])

    const token = auth.session?.token
    const role = auth.session?.role

    if (!token) {
        return <Navigate to="/" replace />
    }

    if (requiredRole && role !== requiredRole) {
        return <Navigate to="/" replace />
    }

    return children
}

export default ProtectedRoute
