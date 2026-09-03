import {Routes, Route} from 'react-router-dom';
import LecturerDashboard from "./pages/LecturerDashboard"
import StudentDashboard from "./pages/StudentDashboard";
import Login from "./pages/Login";
import Header from "./components/Header";
import Footer from "./components/Footer";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/lecturer-dashboard" element={<LecturerDashboard />} />
      <Route path="/student-dashboard" element={<StudentDashboard />} />
    </Routes>
  )
}

export default App;