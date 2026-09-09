import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { apiFetch } from "../api"

function Timeline() {
    const navigate = useNavigate()
    const [range, setRange] = useState("7")
    const [sortOrder, setSortOrder] = useState("date")
    const [search, setSearch] = useState("")
    const [events, setEvents] = useState([])
    const [error, setError] = useState("")

    useEffect(() => {
        async function loadTimeline() {
            const start = new Date()
            const end = new Date(start)
            end.setDate(end.getDate() + Number(range))

            try {
                setError("")
                const data = await apiFetch(`/calendar?start=${start.toISOString()}&end=${end.toISOString()}`)
                setEvents(data)
            } catch (err) {
                setError(err.message)
            }
        }

        loadTimeline()
    }, [range])

    const filteredEvents = useMemo(() => {
        const query = search.trim().toLowerCase()
        const matchingEvents = events.filter((event) => !query || event.title.toLowerCase().includes(query))

        return [...matchingEvents].sort((first, second) => {
            const firstTime = new Date(first.start_time).getTime()
            const secondTime = new Date(second.start_time).getTime()
            return sortOrder === "date" ? firstTime - secondTime : secondTime - firstTime
        })
    }, [events, search, sortOrder])

    return (
        <section className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4">
            <div className="border-b border-gray-200 px-4 py-3">
                <h2 className="font-semibold text-gray-800">Timeline</h2>
            </div>

            <div className="p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <select
                        value={range}
                        onChange={(event) => setRange(event.target.value)}
                        className="border border-gray-300 rounded px-3 py-2 text-sm text-gray-700"
                        aria-label="Timeline date range"
                    >
                        <option value="7">Next 7 days</option>
                        <option value="30">Next 30 days</option>
                        <option value="90">Next 90 days</option>
                    </select>
                    <select
                        value={sortOrder}
                        onChange={(event) => setSortOrder(event.target.value)}
                        className="border border-gray-300 rounded px-3 py-2 text-sm text-gray-700"
                        aria-label="Timeline sort order"
                    >
                        <option value="date">Sort by dates</option>
                        <option value="recent">Latest first</option>
                    </select>
                    <input
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search by activity type or name"
                        className="min-w-0 flex-1 border border-teal-700 rounded px-3 py-2 text-sm"
                        aria-label="Search timeline"
                    />
                </div>

                {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

                <div className="mt-3 border-t border-gray-100 pt-5">
                    {filteredEvents.length === 0 ? (
                        <div className="py-2 text-center text-sm text-gray-500">
                            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center bg-gray-200 text-xl text-gray-500">&#9776;</div>
                            <p>No activities require action</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredEvents.map((event) => (
                                <button
                                    key={event.id}
                                    type="button"
                                    onClick={() => navigate(`/exam/${event.id}`)}
                                    className="flex w-full items-center justify-between rounded border border-gray-200 px-3 py-2 text-left hover:bg-gray-50"
                                >
                                    <span className="font-medium text-green-800">{event.title}</span>
                                    <span className="text-sm text-gray-500">
                                        {new Date(event.start_time).toLocaleDateString()}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </section>
    )
}

export default Timeline
