# Smart Exam System

Fixes MUST VLE's exact-match short-answer grading (e.g. `Daud K. Azole` failing
against `Daud K Azole`) by generating format variants and WordNet synonyms for
lecturer approval before grading, instead of requiring an exact string match.

## Mapping to the lecturer's requirements

### 1. At least five different types of users

| Role | Demo login |
|---|---|
| Student | Register at `/register` with a 14-digit reg number, then log in |
| Lecturer | `Lecturer` / `lecturer101` |
| Exams Coordinator | `Coordinator` / `coordinator101` |
| Head of Department (HOD) | `HOD` / `hod101` |
| Admin | `Admin` / `admin101` |

### 2 & 3. Ten actions, each with CRUD scoped by role

| # | Action | Create | Read | Update | Delete |
|---|---|---|---|---|---|
| 1 | User accounts | Admin | Admin, self (`/me`) | Admin | Admin |
| 2 | Exams | Lecturer | All roles (scoped) | Lecturer (own, unapproved) / Coordinator | Lecturer (own) / Coordinator / Admin |
| 3 | Questions | Lecturer | Lecturer, privileged roles | - | Lecturer |
| 4 | Exam approval | - | Coordinator (`/exams/pending`) | Coordinator (`/exams/{id}/status`) | - |
| 5 | Submissions | Student | Student (own), Lecturer, privileged roles | - (locked after submit, integrity) | - |
| 6 | Grade overrides | - | Included in submission read | Lecturer (own exam), Admin | - |
| 7 | Announcements | Lecturer, Admin | All roles | Author, Admin | Author, Admin |
| 8 | Courses | Admin | All roles | Admin | Admin |
| 9 | Reports (auto-generated) | System | Lecturer (own), Coordinator, HOD, Admin | - | - |
| 10 | Downloads | - | All roles (scoped to their own data) | - | - |

Some rows intentionally don't support every CRUD verb - e.g. submissions can't
be updated/deleted by anyone once graded, because allowing that would defeat
the point of an exam system. That's a deliberate business rule, not a missed
requirement.

### 4. PDF and XLSX downloads

| Endpoint | Format | Who |
|---|---|---|
| `GET /submissions/{id}/result.pdf` | PDF | Student (own), Lecturer, Coordinator, HOD, Admin |
| `GET /reports/exam/{id}/summary.pdf` | PDF | Lecturer (own), Coordinator, HOD, Admin |
| `GET /exams/{id}/gradebook.xlsx` | XLSX | Lecturer (own), Coordinator, HOD, Admin |
| `GET /admin/users.xlsx` | XLSX | Admin |

All buttons are wired into the frontend (exam detail page, admin dashboard).

## Setup

```bash
# backend
cd backend
pip install -r requirements.txt
python3 -c "import nltk; nltk.download('wordnet'); nltk.download('omw-1.4')"
python3 -m uvicorn app.main:app --reload --port 8000

# frontend, separate terminal
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## Suggested demo flow

1. Log in as **Admin** - create a course, create a lecturer/coordinator/HOD account if you want fresh ones, download `users.xlsx`.
2. Log in as **Lecturer** - create an exam (assign it to the course), add a gap question (`Daud K Azole`, approve suggested variants), an MCQ, and a matching question.
3. Log in as **Coordinator** - see the exam in the pending queue, approve it.
4. Register a **Student** account, log in, find the exam on the calendar, submit answers (try `daud k. azole` for the gap question to show the matching engine working), download the result PDF.
5. Back as **Lecturer** - open the exam, see the submission, override a grade with a note, download the gradebook XLSX.
6. Log in as **HOD** - open the same exam, view the report summary, download the report PDF.

## Known limitations (worth stating up front, not hiding)

- Fixed demo credentials for non-student roles - a real deployment would use
  proper account provisioning, same as MUST's actual VLE does via SSO.
- No real-time notifications - announcements and calendar require a manual refresh.
- WordNet synonym coverage is general English, not domain-specific academic terms.
