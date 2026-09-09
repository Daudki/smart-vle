import { useEffect, useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { getRole } from "../api"

function Login() {
    const navigate = useNavigate()
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        const token = localStorage.getItem("token")
        if (!token) return

        const dashboards = {
            lecturer: "/lecturer-dashboard",
            student: "/student-dashboard",
            coordinator: "/coordinator-dashboard",
            hod: "/hod-dashboard",
            admin: "/admin-dashboard",
        }

        navigate(dashboards[getRole()] || "/", { replace: true })
    }, [navigate])

    async function handleSubmit(e) {
        e.preventDefault()
        setError("")
        setLoading(true)

        try {
            const params = new URLSearchParams({ username, password })
            const response = await fetch(`http://localhost:8000/auth/login?${params.toString()}`, { method: "POST" })
            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.detail || "Login failed")
            }

            localStorage.setItem("token", data.access_token)
            localStorage.setItem("role", data.role)
            localStorage.setItem("name", data.name)

            const dashboards = {
                lecturer: "/lecturer-dashboard",
                student: "/student-dashboard",
                coordinator: "/coordinator-dashboard",
                hod: "/hod-dashboard",
                admin: "/admin-dashboard",
            }
            navigate(dashboards[data.role] || "/")
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-green-100 flex items-center justify-center">
            <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-md w-80">
                <h1 className="text-xl font-bold text-green-800 mb-4">Log In</h1>
                <label className="block text-sm font-medium mb-1">Username</label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full border rounded px-3 py-1 mb-4" />
                <label className="block text-sm font-medium mb-1">Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border rounded px-3 py-1 mb-4" />
                {error && <p className="text-red-600 text-sm mb-3 ">{error}</p>}
                <button type="submit" className="w-full bg-green-800 text-white py-2 rounded disabled:opacity-50">{loading ? "Logging in..." : "Log In"}</button>
                <p className="text-sm text-gray-600 mt-4">
                    New student? <Link to="/register" className="text-green-800 font-medium">Register here</Link>
                </p>
                <p className="text-xs text-gray-400 mt-4">
                    Demo accounts: Lecturer/lecturer101, Coordinator/coordinator101, HOD/hod101, Admin/admin101
                </p>
            </form>
        </div>
    )
}

export default Login