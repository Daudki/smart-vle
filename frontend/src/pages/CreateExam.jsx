import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { apiFetch } from "../api"

function CreateExam() {
    const navigate = useNavigate()

    const [examId, setExamId] = useState(null)
    const [title, setTitle] = useState("")
    const [startTime, setStartTime] = useState("")
    const [endTime, setEndTime] = useState("")
    const [maxAttempts, setMaxAttempts] = useState(1)
    const [earlyBonus, setEarlyBonus] = useState(0)
    const [courseId, setCourseId] = useState("")
    const [courses, setCourses] = useState([])
    const [examError, setExamError] = useState("")

    useEffect(() => {
        apiFetch("/courses").then(setCourses).catch(() => { })
    }, [])

    const [qType, setQType] = useState("mcq")
    const [qPrompt, setQPrompt] = useState("")
    const [qPoints, setQPoints] = useState(1)
    const [questionError, setQuestionError] = useState("")
    const [questionSuccess, setQuestionSuccess] = useState("")

    const [mcqOptions, setMcqOptions] = useState([{ text: "", isCorrect: false }, { text: "", isCorrect: false }])

    const [gapCanonical, setGapCanonical] = useState("")
    const [approvedAnswers, setApprovedAnswers] = useState([])
    const [synonymSenses, setSynonymSenses] = useState({})

    const [matchingPairs, setMatchingPairs] = useState([{ left: "", right: "" }, { left: "", right: "" }])

    const [questionsAdded, setQuestionsAdded] = useState([])

    const durationMinutes = startTime && endTime
        ? Math.round((new Date(endTime) - new Date(startTime)) / 60000)
        : 0

    async function handleCreateExam(e) {
        e.preventDefault()
        setExamError("")

        if (!title || !startTime || !endTime) {
            setExamError("Fill in title, start time, and end time.")
            return
        }
        if (durationMinutes < 1) {
            setExamError("End time must be after the start time.")
            return
        }

        try {
            const exam = await apiFetch("/exams", {
                method: "POST",
                body: JSON.stringify({
                    title,
                    start_time: new Date(startTime).toISOString(),
                    end_time: new Date(endTime).toISOString(),
                    duration_minutes: durationMinutes,
                    max_attempts: parseInt(maxAttempts, 10),
                    early_submission_bonus: parseFloat(earlyBonus),
                    course_id: courseId || null,
                }),
            })
            setExamId(exam.id)
        } catch (err) {
            setExamError(err.message)
        }
    }

    function addMcqOption() {
        setMcqOptions([...mcqOptions, { text: "", isCorrect: false }])
    }

    function updateMcqOption(index, field, value) {
        const updated = [...mcqOptions]
        if (field === "isCorrect") {
            updated.forEach((o, i) => { o.isCorrect = i === index })
        } else {
            updated[index][field] = value
        }
        setMcqOptions(updated)
    }

    function removeMcqOption(index) {
        setMcqOptions(mcqOptions.filter((_, i) => i !== index))
    }

    async function suggestAnswers() {
        if (!gapCanonical.trim()) {
            setQuestionError("Enter a canonical answer first.")
            return
        }
        setQuestionError("")
        try {
            const result = await apiFetch("/questions/suggest-answers", {
                method: "POST",
                body: JSON.stringify({ answer: gapCanonical }),
            })
            setApprovedAnswers([...result.variants])
            setSynonymSenses(result.synonym_senses)
        } catch (err) {
            setQuestionError(err.message)
        }
    }

    function toggleSense(senseId, checked) {
        const synonyms = synonymSenses[senseId].synonyms
        if (checked) {
            const merged = [...approvedAnswers]
            synonyms.forEach((s) => { if (!merged.includes(s)) merged.push(s) })
            setApprovedAnswers(merged)
        } else {
            setApprovedAnswers(approvedAnswers.filter((a) => !synonyms.includes(a)))
        }
    }

    function removeApprovedAnswer(index) {
        setApprovedAnswers(approvedAnswers.filter((_, i) => i !== index))
    }

    function addMatchingPair() {
        setMatchingPairs([...matchingPairs, { left: "", right: "" }])
    }

    function updateMatchingPair(index, field, value) {
        const updated = [...matchingPairs]
        updated[index][field] = value
        setMatchingPairs(updated)
    }

    function removeMatchingPair(index) {
        setMatchingPairs(matchingPairs.filter((_, i) => i !== index))
    }

    function resetQuestionForm() {
        setQPrompt("")
        setMcqOptions([{ text: "", isCorrect: false }, { text: "", isCorrect: false }])
        setGapCanonical("")
        setApprovedAnswers([])
        setSynonymSenses({})
        setMatchingPairs([{ left: "", right: "" }, { left: "", right: "" }])
    }

    async function handleAddQuestion() {
        setQuestionError("")
        setQuestionSuccess("")

        if (!qPrompt.trim()) {
            setQuestionError("Enter a question prompt.")
            return
        }

        try {
            if (qType === "mcq") {
                const validOptions = mcqOptions.filter((o) => o.text.trim())
                if (validOptions.length < 2) {
                    setQuestionError("Add at least two options.")
                    return
                }
                if (!validOptions.some((o) => o.isCorrect)) {
                    setQuestionError("Mark one option as correct.")
                    return
                }
                await apiFetch(`/exams/${examId}/questions/mcq`, {
                    method: "POST",
                    body: JSON.stringify({
                        prompt: qPrompt,
                        points: parseFloat(qPoints),
                        options: validOptions.map((o) => ({ text: o.text, is_correct: o.isCorrect })),
                    }),
                })
            } else if (qType === "gap") {
                if (approvedAnswers.length === 0) {
                    setQuestionError("Suggest and approve at least one answer.")
                    return
                }
                await apiFetch(`/exams/${examId}/questions/gap`, {
                    method: "POST",
                    body: JSON.stringify({
                        prompt: qPrompt,
                        points: parseFloat(qPoints),
                        accepted_answers: approvedAnswers,
                    }),
                })
            } else {
                const validPairs = matchingPairs.filter((p) => p.left.trim() && p.right.trim())
                if (validPairs.length < 2) {
                    setQuestionError("Add at least two complete pairs.")
                    return
                }
                await apiFetch(`/exams/${examId}/questions/matching`, {
                    method: "POST",
                    body: JSON.stringify({ prompt: qPrompt, points: parseFloat(qPoints), pairs: validPairs }),
                })
            }

            setQuestionsAdded([...questionsAdded, { type: qType, prompt: qPrompt }])
            setQuestionSuccess("Question added.")
            resetQuestionForm()
        } catch (err) {
            setQuestionError(err.message)
        }
    }

    return (
        <div className="min-h-screen bg-gray-100 p-6">
            {!examId && (
                <div className="bg-white rounded-lg shadow-md p-6 max-w-lg mx-auto">
                    <h1 className="text-xl font-bold text-green-800 mb-4">1. Exam details</h1>

                    <label className="block text-sm font-medium mb-1">Title</label>
                    <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border rounded px-3 py-1 mb-4" />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <label className="block text-sm font-medium">Starts
                            <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full border rounded px-3 py-2 mt-1" />
                        </label>
                        <label className="block text-sm font-medium">Finishes
                            <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full border rounded px-3 py-2 mt-1" />
                        </label>
                    </div>
                    <div className={`rounded border px-3 py-2 mb-4 text-sm ${durationMinutes > 0 ? "border-green-200 bg-green-50 text-green-800" : "border-gray-200 bg-gray-50 text-gray-500"}`}>
                        {durationMinutes > 0
                            ? `Exam duration: ${durationMinutes} minute${durationMinutes === 1 ? "" : "s"}`
                            : "Choose a start and finish time to calculate the duration."}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                        <label className="block text-sm font-medium">Maximum attempts
                            <input type="number" min="1" value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} className="w-full border rounded px-3 py-1 mt-1" />
                        </label>
                        <label className="block text-sm font-medium">Early completion bonus
                            <input type="number" min="0" step="0.5" value={earlyBonus} onChange={(e) => setEarlyBonus(e.target.value)} className="w-full border rounded px-3 py-1 mt-1" />
                        </label>
                    </div>

                    <label className="block text-sm font-medium mb-1">Course (optional)</label>
                    <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="w-full border rounded px-3 py-1 mb-4">
                        <option value="">-- none --</option>
                        {courses.map((c) => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
                    </select>

                    {examError && <p className="text-red-600 text-sm mb-3">{examError}</p>}
                    <button onClick={handleCreateExam} className="w-full bg-green-800 text-white py-2 rounded">Create exam and continue</button>
                </div>
            )}

            {examId && (
                <div className="max-w-2xl mx-auto">
                    <div className="bg-white rounded-lg shadow-md p-6 mb-4">
                        <h2 className="text-xl font-bold text-green-800 mb-4">2. Add questions</h2>

                        <label className="block text-sm font-medium mb-1">Question type</label>
                        <select value={qType} onChange={(e) => setQType(e.target.value)} className="w-full border rounded px-3 py-1 mb-4">
                            <option value="mcq">Multiple choice</option>
                            <option value="gap">Fill in the gap</option>
                            <option value="matching">Matching</option>
                        </select>

                        <label className="block text-sm font-medium mb-1">Prompt</label>
                        <textarea value={qPrompt} onChange={(e) => setQPrompt(e.target.value)} rows={2} className="w-full border rounded px-3 py-1 mb-4" />

                        <label className="block text-sm font-medium mb-1">Points</label>
                        <input type="number" step="0.5" value={qPoints} onChange={(e) => setQPoints(e.target.value)} className="w-full border rounded px-3 py-1 mb-4" />

                        {qType === "mcq" && (
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1">Options</label>
                                {mcqOptions.map((opt, i) => (
                                    <div key={i} className="flex items-center gap-2 mb-2">
                                        <input
                                            type="text"
                                            value={opt.text}
                                            onChange={(e) => updateMcqOption(i, "text", e.target.value)}
                                            placeholder="Option text"
                                            className="flex-1 border rounded px-3 py-1"
                                        />
                                        <label className="flex items-center gap-1 text-sm">
                                            <input type="radio" name="mcq-correct" checked={opt.isCorrect} onChange={() => updateMcqOption(i, "isCorrect", true)} />
                                            correct
                                        </label>
                                        <button onClick={() => removeMcqOption(i)} className="text-red-600 text-sm">x</button>
                                    </div>
                                ))}
                                <button onClick={addMcqOption} className="bg-gray-500 text-white px-3 py-1 rounded text-sm">+ Add option</button>
                            </div>
                        )}

                        {qType === "gap" && (
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1">Canonical answer</label>
                                <input type="text" value={gapCanonical} onChange={(e) => setGapCanonical(e.target.value)} className="w-full border rounded px-3 py-1 mb-2" />
                                <button onClick={suggestAnswers} className="bg-gray-500 text-white px-3 py-1 rounded text-sm mb-3">Suggest variants and synonyms</button>

                                {Object.keys(synonymSenses).length > 0 && (
                                    <div className="mb-3">
                                        <p className="text-sm text-gray-600 mb-1">Synonym senses (check the ones that fit this question):</p>
                                        {Object.entries(synonymSenses).map(([senseId, info]) => (
                                            <label key={senseId} className="block text-sm mb-1">
                                                <input type="checkbox" onChange={(e) => toggleSense(senseId, e.target.checked)} className="mr-2" />
                                                <b>{senseId}</b> - {info.definition}
                                                <br />
                                                <span className="text-gray-500 ml-5">{info.synonyms.join(", ")}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}

                                <p className="text-sm text-gray-600 mb-1">Approved answers:</p>
                                <div>
                                    {approvedAnswers.length === 0 && <span className="text-gray-400 text-sm">No approved answers yet.</span>}
                                    {approvedAnswers.map((a, i) => (
                                        <span key={i} className="inline-flex items-center gap-1 bg-green-50 border border-green-200 rounded-full px-3 py-1 text-sm mr-2 mb-2">
                                            {a}
                                            <button onClick={() => removeApprovedAnswer(i)} className="text-red-600">x</button>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {qType === "matching" && (
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1">Pairs</label>
                                {matchingPairs.map((pair, i) => (
                                    <div key={i} className="flex gap-2 mb-2">
                                        <input type="text" value={pair.left} onChange={(e) => updateMatchingPair(i, "left", e.target.value)} placeholder="Left item" className="flex-1 border rounded px-3 py-1" />
                                        <input type="text" value={pair.right} onChange={(e) => updateMatchingPair(i, "right", e.target.value)} placeholder="Right item" className="flex-1 border rounded px-3 py-1" />
                                        <button onClick={() => removeMatchingPair(i)} className="text-red-600 text-sm">x</button>
                                    </div>
                                ))}
                                <button onClick={addMatchingPair} className="bg-gray-500 text-white px-3 py-1 rounded text-sm">+ Add pair</button>
                            </div>
                        )}

                        {questionError && <p className="text-red-600 text-sm mb-3">{questionError}</p>}
                        {questionSuccess && <p className="text-green-700 text-sm mb-3">{questionSuccess}</p>}
                        <button onClick={handleAddQuestion} className="w-full bg-green-800 text-white py-2 rounded">Add question to exam</button>
                    </div>

                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h3 className="font-bold text-green-800 mb-2">Questions added so far</h3>
                        {questionsAdded.length === 0 && <p className="text-gray-400 text-sm">No questions added yet.</p>}
                        {questionsAdded.map((q, i) => (
                            <div key={i} className="border-l-4 border-green-800 pl-3 mb-2">
                                <b>{i + 1}. [{q.type}]</b> {q.prompt}
                            </div>
                        ))}
                        <button onClick={() => navigate("/lecturer-dashboard")} className="w-full bg-green-800 text-white py-2 rounded mt-3">
                            Done - back to dashboard
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

export default CreateExam
