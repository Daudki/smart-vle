import { Routes, Route } from "react-router-dom"
import Login from "./pages/Login"
import Register from "./pages/Register"
import LecturerDashboard from "./pages/LecturerDashboard"
import StudentDashboard from "./pages/StudentDashboard"
import CoordinatorDashboard from "./pages/CoordinatorDashboard"
import HODDashboard from "./pages/HODDashboard"
import AdminDashboard from "./pages/AdminDashboard"
import CreateExam from "./pages/CreateExam"
import ExamDetail from "./pages/ExamDetail"
import Layout from "./components/Layout"
import ProtectedRoute from "./components/ProtectedRoute"

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/lecturer-dashboard"
          element={
            <ProtectedRoute requiredRole="lecturer">
              <LecturerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student-dashboard"
          element={
            <ProtectedRoute requiredRole="student">
              <StudentDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/coordinator-dashboard"
          element={
            <ProtectedRoute requiredRole="coordinator">
              <CoordinatorDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hod-dashboard"
          element={
            <ProtectedRoute requiredRole="hod">
              <HODDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create-exam"
          element={
            <ProtectedRoute requiredRole="lecturer">
              <CreateExam />
            </ProtectedRoute>
          }
        />
        <Route
          path="/exam/:id"
          element={
            <ProtectedRoute>
              <ExamDetail />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Layout>
  )
}

export default App
