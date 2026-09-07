import { Navigate, Route, Routes } from 'react-router-dom';
import LecturerDashboard from "./pages/LecturerDashboard"
import StudentDashboard from "./pages/StudentDashboard";
import Login from "./pages/Login";

function ProtectedRoute({ role, children }) {
  const loggedInRole = localStorage.getItem("role")

  if (!loggedInRole) {
    return <Navigate to="/" replace />
  }

  if (loggedInRole !== role) {
    return <Navigate to={loggedInRole === "lecturer" ? "/lecturer-dashboard" : "/student-dashboard"} replace />
  }

  return children
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/lecturer-dashboard" element={<ProtectedRoute role="lecturer"><LecturerDashboard /></ProtectedRoute>} />
      <Route path="/student-dashboard" element={<ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>} />
    </Routes>
  )
}

export default App;