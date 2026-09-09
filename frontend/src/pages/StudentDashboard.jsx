import Calendar from "../components/Calendar"
import AnnouncementsBoard from "../components/AnnouncementsBoard"
import Timeline from "../components/Timeline"
import { getName } from "../api"

function StudentDashboard() {
    const name = getName()

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Hi, {name || "Student"}! 👋</h1>

            <Timeline />

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-4">
                <Calendar />
            </div>

            <AnnouncementsBoard />
        </div>
    )
}

export default StudentDashboard
