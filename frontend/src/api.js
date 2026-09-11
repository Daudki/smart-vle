const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000"

function getToken() {
    return localStorage.getItem("token")
}

function getRole() {
    return localStorage.getItem("role")
}

function getName() {
    return localStorage.getItem("name")
}

function clearSession() {
    localStorage.removeItem("token")
    localStorage.removeItem("role")
    localStorage.removeItem("name")
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

export { API_BASE, getToken, getRole, getName, clearSession, logout, apiFetch, downloadFile }
