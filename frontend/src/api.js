const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000"
const SESSION_KEY = "smart-vle-session"

function getSession() {
    try {
        const stored = localStorage.getItem(SESSION_KEY)
        if (stored) return JSON.parse(stored)
    } catch (e) {
        localStorage.removeItem(SESSION_KEY)
    }

    const session = {
        token: localStorage.getItem("token"),
        role: localStorage.getItem("role"),
        name: localStorage.getItem("name"),
    }
    return session.token ? session : null
}

function saveSession(session) {
    const value = {
        token: session.token,
        role: session.role,
        name: session.name,
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify(value))
    localStorage.setItem("token", value.token)
    localStorage.setItem("role", value.role)
    localStorage.setItem("name", value.name)
    window.dispatchEvent(new Event("smart-vle-session-change"))
}

function getToken() {
    return getSession()?.token || null
}

function getRole() {
    return getSession()?.role || null
}

function getName() {
    return getSession()?.name || null
}

function clearSession() {
    localStorage.removeItem(SESSION_KEY)
    localStorage.removeItem("token")
    localStorage.removeItem("role")
    localStorage.removeItem("name")
    window.dispatchEvent(new Event("smart-vle-session-change"))
}

function logout(navigate) {
    clearSession()
    navigate("/", { replace: true })
}

async function apiFetch(path, options = {}) {
    const headers = options.headers || {}
    const token = getToken()
    if (token) headers["Authorization"] = "Bearer " + token
    if (options.body && !(options.body instanceof FormData)) {
        headers["Content-Type"] = "application/json"
    }
    const res = await fetch(API_BASE + path, { ...options, headers })
    let data = null
    try { data = await res.json() } catch (e) { }
    if (!res.ok) {
        throw new Error((data && data.detail) ? data.detail : "Request failed (" + res.status + ")")
    }
    return data
}

async function downloadFile(path, filename) {
    const token = getToken()
    const res = await fetch(API_BASE + path, {
        headers: token ? { Authorization: "Bearer " + token } : {},
    })
    if (!res.ok) {
        let detail = "Download failed"
        try { detail = (await res.json()).detail } catch (e) { }
        throw new Error(detail)
    }
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
}

export { API_BASE, getSession, saveSession, getToken, getRole, getName, clearSession, logout, apiFetch, downloadFile }
