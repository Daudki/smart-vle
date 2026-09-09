import Calendar from "../components/Calendar"
import AnnouncementsBoard from "../components/AnnouncementsBoard"
import { getName } from "../api"

function HODDashboard() {
    const name = getName()

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Hi, {name || "HOD"}! 👋</h1>
            <p className="text-sm text-gray-500 mb-4">Click any exam on the calendar to view its performance report and downloads.</p>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-4">
                <Calendar />
            </div>

            <AnnouncementsBoard />
        </div>
    )
}

export default HODDashboard
