import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import Calendar from "../components/Calendar"
import AnnouncementsBoard from "../components/AnnouncementsBoard"
import { apiFetch, getName } from "../api"

function CoordinatorDashboard() {
    const navigate = useNavigate()
    const name = getName()
    const [pending, setPending] = useState([])
    const [error, setError] = useState("")

    useEffect(() => {
        load()
    }, [])

    async function load() {
        try {
            const data = await apiFetch("/exams/pending")
            setPending(data)
        } catch (e) {
            setError(e.message)
        }
    }

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Hi, {name || "Coordinator"}! 👋</h1>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-4">
                <h2 className="font-bold text-green-800 mb-3">Exams awaiting approval</h2>
                {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
                {pending.length === 0 && <p className="text-gray-400 text-sm">Nothing pending.</p>}
                {pending.map((e) => (
                    <div key={e.id} onClick={() => navigate(`/exam/${e.id}`)} className="border-b border-gray-100 py-2 cursor-pointer hover:bg-gray-50">
                        <p className="font-medium text-sm">{e.title}</p>
                        <p className="text-xs text-gray-500">{e.lecturer_name} - {new Date(e.start_time).toLocaleString()}</p>
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-4">
                <Calendar />
            </div>

            <AnnouncementsBoard />
        </div>
    )
}

export default CoordinatorDashboard
