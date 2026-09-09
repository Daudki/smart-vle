import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { API_BASE } from "../api"

function Register() {
    const navigate = useNavigate()
    const [regNumber, setRegNumber] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [success, setSuccess] = useState("")
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e) {
        e.preventDefault()
        setError("")
        setSuccess("")

        if (!/^\d{14}$/.test(regNumber)) {
            setError("Registration number must be exactly 14 digits.")
            return
        }
        if (password.length < 6) {
            setError("Password must be at least 6 characters.")
            return
        }

        setLoading(true)
        try {
            const params = new URLSearchParams({ reg_number: regNumber, password })
            const res = await fetch(`${API_BASE}/auth/register?${params.toString()}`, { method: "POST" })
            const data = await res.json()
            if (!res.ok) throw new Error(data.detail || "Registration failed")

            setSuccess("Registration successful. Redirecting to login...")
            setTimeout(() => navigate("/"), 1200)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-green-100 flex items-center justify-center">
            <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-md w-80">
                <h1 className="text-xl font-bold text-green-800 mb-4">Student Registration</h1>

                <label className="block text-sm font-medium mb-1">Registration number</label>
                <input
                    type="text"
                    maxLength={14}
                    value={regNumber}
                    onChange={(e) => setRegNumber(e.target.value)}
                    className="w-full border rounded px-3 py-1 mb-4"
                />

                <label className="block text-sm font-medium mb-1">Password</label>
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border rounded px-3 py-1 mb-4"
                />

                {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
                {success && <p className="text-green-700 text-sm mb-3">{success}</p>}

                <button type="submit" disabled={loading} className="w-full bg-green-800 text-white py-2 rounded disabled:opacity-50">
                    {loading ? "Registering..." : "Register"}
                </button>

                <p className="text-sm text-gray-600 mt-4">
                    Already registered? <Link to="/" className="text-green-800 font-medium">Log in</Link>
                </p>
            </form>
        </div>
    )
}

export default Register
