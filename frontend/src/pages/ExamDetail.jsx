import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { apiFetch, downloadFile, getRole } from "../api"

function ExamDetail() {
    const { id } = useParams()
    const role = getRole()
    const isPrivileged = ["lecturer", "coordinator", "hod", "admin"].includes(role)

    const [exam, setExam] = useState(null)
    const [submission, setSubmission] = useState(null)
    const [error, setError] = useState("")
    const [answers, setAnswers] = useState({})
    const [submitError, setSubmitError] = useState("")

    const [statusMsg, setStatusMsg] = useState("")
    const [submissions, setSubmissions] = useState([])
    const [report, setReport] = useState(null)
    const [overrideDrafts, setOverrideDrafts] = useState({})

    useEffect(() => {
        load()
    }, [id])

    async function load() {
        setError("")
        if (role === "student") {
            try {
                const sub = await apiFetch(`/exams/${id}/my-submission`)
                setSubmission(sub)
            } catch (e) {}
        }
        try {
            const data = await apiFetch(`/exams/${id}`)
            setExam(data)
        } catch (e) {
            setError(e.message)
            return
        }

        if (isPrivileged) {
            try {
                const subs = await apiFetch(`/exams/${id}/submissions`)
                setSubmissions(subs)
            } catch (e) {}
            try {
                const rep = await apiFetch(`/reports/exam/${id}`)
                setReport(rep)
            } catch (e) {}
        }
    }

    async function decideExam(newStatus) {
        setStatusMsg("")
        try {
            await apiFetch(`/exams/${id}/status`, {
                method: "PATCH",
                body: JSON.stringify({ status: newStatus }),
            })
            setStatusMsg(`Exam ${newStatus}.`)
            load()
        } catch (err) {
            setStatusMsg(err.message)
        }
    }

    async function submitOverride(submissionId) {
        const draft = overrideDrafts[submissionId]
        if (!draft || draft.score === undefined || draft.score === "") return
        try {
            await apiFetch(`/submissions/${submissionId}/override`, {
                method: "PATCH",
                body: JSON.stringify({ score: parseFloat(draft.score), note: draft.note || "" }),
            })
            load()
        } catch (err) {
            alert(err.message)
        }
    }

    function setMcqAnswer(questionId, optionId) {
        setAnswers({ ...answers, [questionId]: optionId })
    }
    function setGapAnswer(questionId, text) {
        setAnswers({ ...answers, [questionId]: text })
    }
    function setMatchingAnswer(questionId, left, right) {
        const current = answers[questionId] || {}
        setAnswers({ ...answers, [questionId]: { ...current, [left]: right } })
    }

    async function submitExam() {
        setSubmitError("")
        const unanswered = exam.questions.some((q) => {
            const a = answers[q.id]
            if (a === undefined || a === null || a === "") return true
            if (q.type === "matching") return q.left_items.some((left) => !a[left])
            return false
        })
        if (unanswered) {
            setSubmitError("Please answer every question before submitting.")
            return
        }
        try {
            await apiFetch("/submissions", { method: "POST", body: JSON.stringify({ exam_id: id, answers }) })
            load()
        } catch (err) {
            setSubmitError(err.message)
        }
    }

    if (error) {
        return <div className="p-6"><div className="bg-white rounded-lg shadow-sm border p-6 max-w-lg mx-auto text-red-600">{error}</div></div>
    }
    if (!exam) {
        return <div className="p-6">Loading...</div>
    }

    return (
        <div className="p-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-2xl mx-auto">
                <div className="flex justify-between items-start mb-1">
                    <h1 className="text-xl font-bold text-green-800">{exam.title}</h1>
                    {exam.status && (
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                            exam.status === "approved" ? "bg-green-100 text-green-800" :
                            exam.status === "rejected" ? "bg-red-100 text-red-800" :
                            "bg-yellow-100 text-yellow-800"
                        }`}>
                            {exam.status}
                        </span>
                    )}
                </div>
                <p className="text-gray-500 text-sm mb-4">
                    {new Date(exam.start_time).toLocaleString()} - {new Date(exam.end_time).toLocaleString()}
                </p>

                {role === "coordinator" && exam.status === "pending" && (
                    <div className="mb-4 flex gap-2">
                        <button onClick={() => decideExam("approved")} className="bg-green-800 text-white px-4 py-1 rounded text-sm">Approve</button>
                        <button onClick={() => decideExam("rejected")} className="bg-red-700 text-white px-4 py-1 rounded text-sm">Reject</button>
                    </div>
                )}
                {statusMsg && <p className="text-sm text-gray-600 mb-3">{statusMsg}</p>}

                {isPrivileged && (
                    <div className="mb-4 flex gap-2 flex-wrap">
                        <button
                            onClick={() => downloadFile(`/exams/${id}/gradebook.xlsx`, `gradebook_${exam.title}.xlsx`)}
                            className="bg-teal-700 text-white px-3 py-1 rounded text-sm"
                        >
                            Download gradebook (.xlsx)
                        </button>
                        <button
                            onClick={() => downloadFile(`/reports/exam/${id}/summary.pdf`, `report_${exam.title}.pdf`)}
                            className="bg-teal-700 text-white px-3 py-1 rounded text-sm"
                        >
                            Download report (.pdf)
                        </button>
                    </div>
                )}

                {submission && (
                    <p className="text-lg font-bold text-green-800 mb-2">
                        Score: {submission.overridden_score !== null && submission.overridden_score !== undefined ? submission.overridden_score : submission.score} / {submission.max_score}
                    </p>
                )}
                {submission && submission.overridden_score !== null && submission.overridden_score !== undefined && (
                    <p className="text-sm text-gray-500 mb-4">Grade overridden by lecturer: {submission.override_note}</p>
                )}
                {submission && (
                    <button
                        onClick={() => downloadFile(`/submissions/${submission.id}/result.pdf`, `result_${exam.title}.pdf`)}
                        className="bg-teal-700 text-white px-3 py-1 rounded text-sm mb-4"
                    >
                        Download my result (.pdf)
                    </button>
                )}

                {report && (
                    <div className="bg-gray-50 border border-gray-200 rounded p-3 mb-4 text-sm">
                        <p className="font-medium text-gray-700 mb-1">Report summary</p>
                        <p>Submissions: {report.submissions} | Average: {report.average_score}/{report.max_score} | Pass rate: {report.pass_rate_percent}%</p>
                    </div>
                )}

                {exam.questions.map((q, i) => (
                    <div key={q.id} className="border-l-4 border-green-800 pl-3 mb-4">
                        <p className="font-medium">{i + 1}. {q.prompt} <span className="text-gray-400 text-sm">({q.points} pts)</span></p>

                        {q.type === "mcq" && (
                            <div className="mt-2">
                                {q.options.map((o) => (
                                    <label key={o.id} className="block text-sm mb-1">
                                        {isPrivileged ? (
                                            <span>{o.text} {o.is_correct && <b className="text-green-800">(correct)</b>}</span>
                                        ) : submission ? (
                                            <span>{o.text}</span>
                                        ) : (
                                            <>
                                                <input type="radio" name={`mcq-${q.id}`} onChange={() => setMcqAnswer(q.id, o.id)} className="mr-2" />
                                                {o.text}
                                            </>
                                        )}
                                    </label>
                                ))}
                            </div>
                        )}

                        {q.type === "gap" && (
                            <div className="mt-2">
                                {isPrivileged ? (
                                    <p className="text-sm text-gray-500">Accepted answers: {q.accepted_answers.join(", ")}</p>
                                ) : submission ? (
                                    <p className={submission.per_question_result[q.id] ? "text-green-700" : "text-red-600"}>
                                        {submission.per_question_result[q.id] ? "Correct" : "Incorrect"}
                                    </p>
                                ) : (
                                    <input type="text" onChange={(e) => setGapAnswer(q.id, e.target.value)} className="w-full border rounded px-3 py-1" placeholder="Your answer" />
                                )}
                            </div>
                        )}

                        {q.type === "matching" && (
                            <div className="mt-2">
                                {isPrivileged ? (
                                    <ul className="text-sm text-gray-500 list-disc ml-5">
                                        {q.pairs.map((p, idx) => <li key={idx}>{p.left} - {p.right}</li>)}
                                    </ul>
                                ) : submission ? (
                                    <p className={submission.per_question_result[q.id] ? "text-green-700" : "text-red-600"}>
                                        {submission.per_question_result[q.id] ? "Correct" : "Incorrect"}
                                    </p>
                                ) : (
                                    q.left_items.map((left) => (
                                        <div key={left} className="flex items-center gap-2 mb-1">
                                            <span className="w-32 text-sm">{left}</span>
                                            <select onChange={(e) => setMatchingAnswer(q.id, left, e.target.value)} className="border rounded px-2 py-1 text-sm">
                                                <option value="">-- choose --</option>
                                                {q.right_items.map((r) => <option key={r} value={r}>{r}</option>)}
                                            </select>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                ))}

                {role === "student" && !submission && exam.status === "approved" && (
                    <>
                        {submitError && <p className="text-red-600 text-sm mb-3">{submitError}</p>}
                        <button onClick={submitExam} className="w-full bg-green-800 text-white py-2 rounded">Submit exam</button>
                    </>
                )}
            </div>

            {isPrivileged && submissions.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-2xl mx-auto mt-4">
                    <h2 className="font-bold text-green-800 mb-3">Submissions</h2>
                    {submissions.map((s) => (
                        <div key={s.id} className="border-b border-gray-100 py-2">
                            <p className="text-sm font-medium">{s.student_name} ({s.reg_number})</p>
                            <p className="text-sm text-gray-500">
                                Auto score: {s.score}/{s.max_score}
                                {s.overridden_score !== null && s.overridden_score !== undefined && ` - Overridden: ${s.overridden_score} (${s.override_note})`}
                            </p>
                            {role === "lecturer" && (
                                <div className="flex gap-2 mt-1">
                                    <input
                                        type="number"
                                        step="0.5"
                                        placeholder="Override score"
                                        className="border rounded px-2 py-1 text-sm w-32"
                                        onChange={(e) => setOverrideDrafts({ ...overrideDrafts, [s.id]: { ...overrideDrafts[s.id], score: e.target.value } })}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Note"
                                        className="border rounded px-2 py-1 text-sm flex-1"
                                        onChange={(e) => setOverrideDrafts({ ...overrideDrafts, [s.id]: { ...overrideDrafts[s.id], note: e.target.value } })}
                                    />
                                    <button onClick={() => submitOverride(s.id)} className="bg-green-800 text-white px-3 py-1 rounded text-sm">Save</button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default ExamDetail
