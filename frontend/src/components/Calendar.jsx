import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { apiFetch } from "../api"

function Calendar({ newEventLabel, onNewEvent }) {
    const navigate = useNavigate()
    const [viewDate, setViewDate] = useState(new Date())
    const [events, setEvents] = useState([])
    const [error, setError] = useState("")

    useEffect(() => {
        loadEvents()
    }, [viewDate])

    async function loadEvents() {
        const year = viewDate.getFullYear()
        const month = viewDate.getMonth()
        const monthStart = new Date(year, month, 1)
        const monthEnd = new Date(year, month + 1, 0, 23, 59, 59)

        try {
            const data = await apiFetch(`/calendar?start=${monthStart.toISOString()}&end=${monthEnd.toISOString()}`)
            setEvents(data)
        } catch (err) {
            setError(err.message)
        }
    }

    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()
    const monthStart = new Date(year, month, 1)
    const monthEnd = new Date(year, month + 1, 0)
    const daysInMonth = monthEnd.getDate()
    const firstWeekday = (monthStart.getDay() + 6) % 7
    const monthLabel = monthStart.toLocaleString("default", { month: "long", year: "numeric" })

    const today = new Date()
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month

    const eventsByDay = {}
    events.forEach((ev) => {
        const day = new Date(ev.start_time).getDate()
        if (!eventsByDay[day]) eventsByDay[day] = []
        eventsByDay[day].push(ev)
    })

    const cells = []
    for (let i = 0; i < firstWeekday; i++) {
        const isWeekendCol = i === 5 || i === 6
        cells.push(<td key={"empty-" + i} className={isWeekendCol ? "bg-gray-100" : ""}></td>)
    }
    for (let day = 1; day <= daysInMonth; day++) {
        const dayEvents = eventsByDay[day] || []
        const weekdayIndex = (firstWeekday + day - 1) % 7
        const isWeekend = weekdayIndex === 5 || weekdayIndex === 6
        const isToday = isCurrentMonth && today.getDate() === day

        cells.push(
            <td key={day} className={`border border-gray-200 p-1 align-top h-16 w-1/7 ${isWeekend ? "bg-gray-100" : ""}`}>
                {isToday ? (
                    <div className="w-5 h-5 rounded-full bg-teal-600 text-white text-xs flex items-center justify-center">
                        {day}
                    </div>
                ) : (
                    <div className="text-xs text-black">{day}</div>
                )}
                {dayEvents.map((ev) => (
                    <div
                        key={ev.id}
                        onClick={() => navigate(`/exam/${ev.id}`)}
                        className="bg-green-100 text-green-800 text-xs rounded px-1 mt-1 cursor-pointer"
                    >
                        {ev.title}
                    </div>
                ))}
            </td>
        )
    }

    const rows = []
    for (let i = 0; i < cells.length; i += 7) {
        rows.push(<tr key={i}>{cells.slice(i, i + 7)}</tr>)
    }

    return (
        <div>
            <div className="border-b border-gray-200 px-4 py-3 mb-4 w-full">
                <h2 className="font-semibold text-gray-800">Calendar</h2>
            </div>
            {onNewEvent && (
                <button
                    onClick={onNewEvent}
                    className="bg-teal-700 text-white px-4 py-2 rounded-full text-sm font-medium mb-4"
                >
                    {newEventLabel || "New event"}
                </button>
            )}

            <div className="flex justify-between items-center mb-3">
                <button
                    onClick={() => setViewDate(new Date(year, month - 1, 1))}
                    className="bg-gray-500 text-white px-3 py-1 rounded text-sm"
                >
                    Prev
                </button>
                <h3 className="font-bold text-green-800">{monthLabel}</h3>
                <button
                    onClick={() => setViewDate(new Date(year, month + 1, 1))}
                    className="bg-gray-500 text-white px-3 py-1 rounded text-sm"
                >
                    Next
                </button>
            </div>

            {error && <p className="text-red-600 text-sm mb-2">{error}</p>}

            <table className="w-full border-collapse">
                <thead>
                    <tr>
                        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                            <th key={d} className="border border-gray-100 text-xs bg-gray-50 py-1">{d}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>{rows}</tbody>
            </table>
        </div>
    )
}

export default Calendar
