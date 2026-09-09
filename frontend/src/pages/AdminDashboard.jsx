import { useEffect, useState } from "react"
import { apiFetch, downloadFile, getName } from "../api"
import AnnouncementsBoard from "../components/AnnouncementsBoard"

function AdminDashboard() {
    const name = getName()
    const [users, setUsers] = useState([])
    const [courses, setCourses] = useState([])
    const [error, setError] = useState("")

    const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "lecturer" })
    const [newCourse, setNewCourse] = useState({ code: "", name: "" })

    useEffect(() => {
        loadUsers()
        loadCourses()
    }, [])

    async function loadUsers() {
        try { setUsers(await apiFetch("/admin/users")) } catch (e) { setError(e.message) }
    }
    async function loadCourses() {
        try { setCourses(await apiFetch("/courses")) } catch (e) { setError(e.message) }
    }

    async function createUser() {
        if (!newUser.name || !newUser.email || !newUser.password) return
        try {
            await apiFetch("/admin/users", { method: "POST", body: JSON.stringify(newUser) })
            setNewUser({ name: "", email: "", password: "", role: "lecturer" })
            loadUsers()
        } catch (e) { setError(e.message) }
    }

    async function toggleActive(user) {
        try {
            await apiFetch(`/admin/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ is_active: !user.is_active }) })
            loadUsers()
        } catch (e) { setError(e.message) }
    }

    async function deleteUser(id) {
        try {
            await apiFetch(`/admin/users/${id}`, { method: "DELETE" })
            loadUsers()
        } catch (e) { setError(e.message) }
    }

    async function createCourse() {
        if (!newCourse.code || !newCourse.name) return
        try {
            await apiFetch("/courses", { method: "POST", body: JSON.stringify(newCourse) })
            setNewCourse({ code: "", name: "" })
            loadCourses()
        } catch (e) { setError(e.message) }
    }

    async function deleteCourse(id) {
        try {
            await apiFetch(`/courses/${id}`, { method: "DELETE" })
            loadCourses()
        } catch (e) { setError(e.message) }
    }

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Hi, {name || "Admin"}! 👋</h1>
            {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-4">
                <div className="flex justify-between items-center mb-3">
                    <h2 className="font-bold text-green-800">Users</h2>
                    <button onClick={() => downloadFile("/admin/users.xlsx", "users.xlsx")} className="bg-teal-700 text-white px-3 py-1 rounded text-sm">
                        Download (.xlsx)
                    </button>
                </div>

                <div className="flex gap-2 mb-4 flex-wrap">
                    <input placeholder="Name" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} className="border rounded px-2 py-1 text-sm flex-1" />
                    <input placeholder="Email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} className="border rounded px-2 py-1 text-sm flex-1" />
                    <input placeholder="Password" type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} className="border rounded px-2 py-1 text-sm flex-1" />
                    <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })} className="border rounded px-2 py-1 text-sm">
                        <option value="lecturer">Lecturer</option>
                        <option value="coordinator">Coordinator</option>
                        <option value="hod">HOD</option>
                        <option value="admin">Admin</option>
                        <option value="student">Student</option>
                    </select>
                    <button onClick={createUser} className="bg-green-800 text-white px-3 py-1 rounded text-sm">Add</button>
                </div>

                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-gray-500 border-b">
                            <th className="py-1">Name</th><th>Email</th><th>Role</th><th>Active</th><th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((u) => (
                            <tr key={u.id} className="border-b border-gray-100">
                                <td className="py-1">{u.name}</td>
                                <td>{u.email}</td>
                                <td>{u.role}</td>
                                <td>
                                    <button onClick={() => toggleActive(u)} className={u.is_active ? "text-green-700" : "text-gray-400"}>
                                        {u.is_active ? "Active" : "Inactive"}
                                    </button>
                                </td>
                                <td><button onClick={() => deleteUser(u.id)} className="text-red-600">delete</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-4">
                <h2 className="font-bold text-green-800 mb-3">Courses</h2>

                <div className="flex gap-2 mb-4">
                    <input placeholder="Code (e.g. CS201)" value={newCourse.code} onChange={(e) => setNewCourse({ ...newCourse, code: e.target.value })} className="border rounded px-2 py-1 text-sm flex-1" />
                    <input placeholder="Name" value={newCourse.name} onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })} className="border rounded px-2 py-1 text-sm flex-1" />
                    <button onClick={createCourse} className="bg-green-800 text-white px-3 py-1 rounded text-sm">Add</button>
                </div>

                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-gray-500 border-b"><th className="py-1">Code</th><th>Name</th><th></th></tr>
                    </thead>
                    <tbody>
                        {courses.map((c) => (
                            <tr key={c.id} className="border-b border-gray-100">
                                <td className="py-1">{c.code}</td>
                                <td>{c.name}</td>
                                <td><button onClick={() => deleteCourse(c.id)} className="text-red-600">delete</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <AnnouncementsBoard />
        </div>
    )
}

export default AdminDashboard
