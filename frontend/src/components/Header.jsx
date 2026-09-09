import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { getToken, getName, logout } from "../api"

function Header() {
    const navigate = useNavigate()
    const location = useLocation()
    const [session, setSession] = useState({ token: getToken(), name: getName() })
    const [menuOpen, setMenuOpen] = useState(false)

    useEffect(() => {
        const syncSession = () => {
            setSession({ token: getToken(), name: getName() })
        }

        syncSession()
        window.addEventListener("storage", syncSession)

        return () => {
            window.removeEventListener("storage", syncSession)
        }
    }, [location.pathname])

    const token = session.token
    const name = session.name

    const initials = name
        ? name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
        : ""

    return (
        <nav className="w-full bg-white border-b border-gray-400 py-3 px-6 flex items-center justify-between relative">
            <h1 className="text-green-800 font-bold text-lg">VLE</h1>

            {token && (
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <button
                            onClick={() => setMenuOpen(!menuOpen)}
                            className="w-9 h-9 rounded-full bg-green-800 text-white text-sm font-bold flex items-center justify-center"
                        >
                            {initials}
                        </button>

                        {menuOpen && (
                            <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded shadow-md py-1 z-10">
                                <p className="px-3 py-2 text-sm text-gray-600 border-b">{name}</p>
                                <button
                                    onClick={() => logout(navigate)}
                                    className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-gray-50"
                                >
                                    Log out
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </nav>
    )
}

export default Header