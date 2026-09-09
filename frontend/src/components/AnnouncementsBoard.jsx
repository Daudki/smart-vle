import { useEffect, useState } from "react"
import { apiFetch, getRole } from "../api"

function AnnouncementsBoard() {
    const role = getRole()
    const canPost = role === "lecturer" || role === "admin"

    const [announcements, setAnnouncements] = useState([])
    const [title, setTitle] = useState("")
    const [body, setBody] = useState("")
    const [error, setError] = useState("")

    useEffect(() => {
        load()
    }, [])

    async function load() {
        try {
            const data = await apiFetch("/announcements")
            setAnnouncements(data)
        } catch (e) {
            setError(e.message)
        }
    }

    async function post() {
        if (!title.trim() || !body.trim()) return
        try {
            await apiFetch("/announcements", { method: "POST", body: JSON.stringify({ title, body }) })
            setTitle(""); setBody("")
            load()
        } catch (e) {
            setError(e.message)
        }
    }

    async function remove(id) {
        try {
            await apiFetch(`/announcements/${id}`, { method: "DELETE" })
            load()
        } catch (e) {
            setError(e.message)
        }
    }

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="font-bold text-green-800 mb-3">Announcements</h2>

            {canPost && (
                <div className="mb-4">
                    <input
                        type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                        placeholder="Title" className="w-full border rounded px-3 py-1 mb-2"
                    />
                    <textarea
                        value={body} onChange={(e) => setBody(e.target.value)}
                        placeholder="Message" rows={2} className="w-full border rounded px-3 py-1 mb-2"
                    />
                    <button onClick={post} className="bg-green-800 text-white px-3 py-1 rounded text-sm">Post</button>
                </div>
            )}

            {error && <p className="text-red-600 text-sm mb-2">{error}</p>}

            {announcements.length === 0 && <p className="text-gray-400 text-sm">No announcements yet.</p>}
            {announcements.map((a) => (
                <div key={a.id} className="border-b border-gray-100 py-2">
                    <div className="flex justify-between items-start">
                        <p className="font-medium text-sm">{a.title}</p>
                        {canPost && (
                            <button onClick={() => remove(a.id)} className="text-red-600 text-xs">delete</button>
                        )}
                    </div>
                    <p className="text-sm text-gray-600">{a.body}</p>
                    <p className="text-xs text-gray-400">{a.author_name} - {new Date(a.created_at).toLocaleDateString()}</p>
                </div>
            ))}
        </div>
    )
}

export default AnnouncementsBoard
