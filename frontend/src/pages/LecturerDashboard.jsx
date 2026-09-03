function LecturerDashboard() {
    const name = localStorage.getItem("name")

    return (
        <div className="min-h-screen bg-gray-100 p-6">
            <div className="bg-white rounded-lg shadow-md p-6">
                <h1 className="text-2xl font-bold text-green-800 mb-2">Lecturer Dashboard</h1>
                <p className="text-gray-600">Welcome, {name || "Lecturer"}.</p>
            </div>
        </div>
    )
}

export default LecturerDashboard