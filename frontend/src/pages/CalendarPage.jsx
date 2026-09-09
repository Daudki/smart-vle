import Calendar from "../components/Calendar"

function CalendarPage() {
    return (
        <main className="vle-page">
            <div className="page-heading">
                <div>
                    <p className="eyebrow">Academic planning</p>
                    <h1>Calendar</h1>
                    <p>Keep track of assessments, deadlines, and learning activities.</p>
                </div>
            </div>
            <section className="vle-panel">
                <Calendar />
            </section>
        </main>
    )
}

export default CalendarPage
