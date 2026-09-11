import io
import os
from datetime import datetime

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from openpyxl import Workbook
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from . import models, schemas, auth
from .database import get_db, engine, Base, ensure_database_schema
from .grading import grade_submission
from .matcher import generate_variants
from .synonyms import suggest_synonyms

ensure_database_schema()

app = FastAPI()

configured_origins = {
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
}
configured_origins.add("https://smart-vle.vercel.app")

app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(configured_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

REG_NUMBER_LENGTH = 14

R = models.Role


@app.get("/")
def read_root():
    return {"message": "Server is running"}


# ---------- Auth: registration + login (5 roles) ----------

def parse_admission_year(reg_number: str) -> int:
    return 2000 + int(reg_number[:2])


def validate_reg_number(reg_number: str) -> None:
    if len(reg_number) != REG_NUMBER_LENGTH or not reg_number.isdigit():
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Registration number must be {REG_NUMBER_LENGTH} digits",
        )


@app.post("/auth/register")
def register_student(reg_number: str, password: str, db: Session = Depends(get_db)):
    validate_reg_number(reg_number)

    existing = db.query(models.User).filter(models.User.reg_number == reg_number).first()
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Registration number already registered")

    if len(password) < 6:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Password must be at least 6 characters")

    user = models.User(
        name=f"Student {reg_number}",
        email=f"{reg_number}@must.demo",
        password_hash=auth.hash_password(password),
        role=R.student,
        reg_number=reg_number,
        admission_year=parse_admission_year(reg_number),
    )
    db.add(user)
    db.commit()

    return {"message": "Registration successful", "redirect": "/"}


FIXED_ACCOUNTS = {
    "Lecturer": {"password": "lecturer101", "role": R.lecturer, "name": "Demo Lecturer"},
    "Coordinator": {"password": "coordinator101", "role": R.coordinator, "name": "Demo Coordinator"},
    "HOD": {"password": "hod101", "role": R.hod, "name": "Demo HOD"},
    "Admin": {"password": "admin101", "role": R.admin, "name": "Demo Admin"},
}


@app.post("/auth/login")
def login(username: str, password: str, db: Session = Depends(get_db)):
    account = FIXED_ACCOUNTS.get(username)
    if account is not None:
        if password != account["password"]:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid username or password")
        email = f"{username.lower()}@must.demo"
        user = db.query(models.User).filter(models.User.email == email).first()
        if user is None:
            user = models.User(
                name=account["name"], email=email,
                password_hash=auth.hash_password(password), role=account["role"],
            )
            db.add(user); db.commit(); db.refresh(user)
        if not user.is_active:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is deactivated")
        token = auth.create_access_token(user.id, user.role.value)
        return {"access_token": token, "token_type": "bearer", "role": user.role.value, "name": user.name}

    user = db.query(models.User).filter(models.User.reg_number == username).first()
    if user is None or not auth.verify_password(password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid username or password")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is deactivated")

    token = auth.create_access_token(user.id, user.role.value)
    return {"access_token": token, "token_type": "bearer", "role": "student", "name": user.name}


# ---------- Action 1: User accounts (Admin CRUD, self read/limited update) ----------

@app.post("/admin/users", response_model=schemas.UserOut)
def admin_create_user(payload: schemas.UserCreate, db: Session = Depends(get_db),
                       admin: models.User = Depends(auth.require_role(R.admin))):
    if payload.role not in [r.value for r in R]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid role")
    if db.query(models.User).filter(models.User.email == payload.email).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already in use")

    user = models.User(
        name=payload.name, email=payload.email,
        password_hash=auth.hash_password(payload.password), role=models.Role(payload.role),
    )
    db.add(user); db.commit(); db.refresh(user)
    return user


@app.get("/admin/users", response_model=list[schemas.UserOut])
def admin_list_users(db: Session = Depends(get_db),
                      admin: models.User = Depends(auth.require_role(R.admin))):
    return db.query(models.User).all()


@app.patch("/admin/users/{user_id}", response_model=schemas.UserOut)
def admin_update_user(user_id: str, payload: schemas.UserUpdate, db: Session = Depends(get_db),
                       admin: models.User = Depends(auth.require_role(R.admin))):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if payload.name is not None:
        user.name = payload.name
    if payload.role is not None:
        if payload.role not in [r.value for r in R]:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid role")
        user.role = models.Role(payload.role)
    if payload.is_active is not None:
        user.is_active = payload.is_active
    db.commit(); db.refresh(user)
    return user


@app.delete("/admin/users/{user_id}")
def admin_delete_user(user_id: str, db: Session = Depends(get_db),
                       admin: models.User = Depends(auth.require_role(R.admin))):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    try:
        db.delete(user)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Cannot delete: user has linked records. Deactivate instead.")
    return {"message": "User deleted"}


@app.get("/admin/users.xlsx")
def admin_export_users(db: Session = Depends(get_db),
                        admin: models.User = Depends(auth.require_role(R.admin))):
    wb = Workbook()
    ws = wb.active
    ws.title = "Users"
    ws.append(["Name", "Email", "Role", "Active", "Reg Number"])
    for u in db.query(models.User).all():
        ws.append([u.name, u.email, u.role.value, "Yes" if u.is_active else "No", u.reg_number or ""])

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=users.xlsx"},
    )


@app.get("/me", response_model=schemas.UserOut)
def get_me(user: models.User = Depends(auth.get_current_user)):
    return user


# ---------- Action 8: Courses (Admin CRUD, all read) ----------

@app.post("/courses", response_model=schemas.CourseOut)
def create_course(payload: schemas.CourseCreate, db: Session = Depends(get_db),
                   admin: models.User = Depends(auth.require_role(R.admin))):
    if db.query(models.Course).filter(models.Course.code == payload.code).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Course code already exists")
    course = models.Course(code=payload.code, name=payload.name)
    db.add(course); db.commit(); db.refresh(course)
    return course


@app.get("/courses", response_model=list[schemas.CourseOut])
def list_courses(db: Session = Depends(get_db),
                  user: models.User = Depends(auth.get_current_user)):
    return db.query(models.Course).all()


@app.patch("/courses/{course_id}", response_model=schemas.CourseOut)
def update_course(course_id: str, payload: schemas.CourseCreate, db: Session = Depends(get_db),
                   admin: models.User = Depends(auth.require_role(R.admin))):
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if course is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")
    course.code = payload.code
    course.name = payload.name
    db.commit(); db.refresh(course)
    return course


@app.delete("/courses/{course_id}")
def delete_course(course_id: str, db: Session = Depends(get_db),
                   admin: models.User = Depends(auth.require_role(R.admin))):
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if course is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")
    try:
        db.delete(course)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Cannot delete: course has linked exams")
    return {"message": "Course deleted"}


# ---------- Action 2: Exams (Lecturer create/update/delete own; all read) ----------

def _exam_summary(e: models.Exam) -> schemas.ExamSummary:
    return schemas.ExamSummary(
        id=e.id, title=e.title, start_time=e.start_time,
        end_time=e.end_time, lecturer_name=e.lecturer.name, status=e.status.value,
        max_attempts=e.max_attempts, early_submission_bonus=e.early_submission_bonus,
    )


@app.post("/exams", response_model=schemas.ExamSummary)
def create_exam(payload: schemas.ExamCreate, db: Session = Depends(get_db),
                 lecturer: models.User = Depends(auth.require_role(R.lecturer))):
    if payload.end_time <= payload.start_time:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "end_time must be after start_time")
    if payload.duration_minutes < 1 or payload.max_attempts < 1 or payload.early_submission_bonus < 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Exam limits must be positive")

    exam = models.Exam(
        lecturer_id=lecturer.id, course_id=payload.course_id, title=payload.title,
        start_time=payload.start_time, end_time=payload.end_time,
        duration_minutes=payload.duration_minutes, max_attempts=payload.max_attempts,
        early_submission_bonus=payload.early_submission_bonus, status=models.ExamStatus.pending,
    )
    db.add(exam); db.commit(); db.refresh(exam)
    return _exam_summary(exam)


@app.get("/exams/pending", response_model=list[schemas.ExamSummary])
def list_pending_exams(db: Session = Depends(get_db),
                        coordinator: models.User = Depends(auth.require_role(R.coordinator))):
    exams = db.query(models.Exam).filter(models.Exam.status == models.ExamStatus.pending).all()
    return [_exam_summary(e) for e in exams]


@app.patch("/exams/{exam_id}", response_model=schemas.ExamSummary)
def update_exam(exam_id: str, payload: schemas.ExamUpdate, db: Session = Depends(get_db),
                 user: models.User = Depends(auth.get_current_user)):
    exam = db.query(models.Exam).filter(models.Exam.id == exam_id).first()
    if exam is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Exam not found")

    is_owner = user.role == R.lecturer and exam.lecturer_id == user.id
    is_coordinator = user.role == R.coordinator
    if not (is_owner or is_coordinator):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized to edit this exam")
    if is_owner and exam.status == models.ExamStatus.approved:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot edit an approved exam - contact the coordinator")

    if payload.title is not None:
        exam.title = payload.title
    if payload.start_time is not None:
        exam.start_time = payload.start_time
    if payload.end_time is not None:
        exam.end_time = payload.end_time
    if payload.duration_minutes is not None:
        exam.duration_minutes = payload.duration_minutes
    if payload.max_attempts is not None:
        if payload.max_attempts < 1:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Maximum attempts must be at least 1")
        exam.max_attempts = payload.max_attempts
    if payload.early_submission_bonus is not None:
        if payload.early_submission_bonus < 0:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Early submission bonus cannot be negative")
        exam.early_submission_bonus = payload.early_submission_bonus
    db.commit(); db.refresh(exam)
    return _exam_summary(exam)


@app.patch("/exams/{exam_id}/status", response_model=schemas.ExamSummary)
def update_exam_status(exam_id: str, payload: schemas.ExamStatusUpdate, db: Session = Depends(get_db),
                        coordinator: models.User = Depends(auth.require_role(R.coordinator))):
    if payload.status not in ("approved", "rejected"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Status must be 'approved' or 'rejected'")
    exam = db.query(models.Exam).filter(models.Exam.id == exam_id).first()
    if exam is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Exam not found")
    exam.status = models.ExamStatus(payload.status)
    db.commit(); db.refresh(exam)
    return _exam_summary(exam)


@app.delete("/exams/{exam_id}")
def delete_exam(exam_id: str, db: Session = Depends(get_db),
                 user: models.User = Depends(auth.get_current_user)):
    exam = db.query(models.Exam).filter(models.Exam.id == exam_id).first()
    if exam is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Exam not found")

    is_owner = user.role == R.lecturer and exam.lecturer_id == user.id
    is_privileged = user.role in (R.coordinator, R.admin)
    if not (is_owner or is_privileged):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized to delete this exam")

    db.query(models.Submission).filter(models.Submission.exam_id == exam.id).delete(
        synchronize_session=False
    )
    db.delete(exam)
    db.commit()
    return {"message": "Exam deleted"}


# ---------- Calendar (role-scoped read) ----------

@app.get("/calendar", response_model=list[schemas.ExamSummary])
def get_calendar(start: datetime, end: datetime, db: Session = Depends(get_db),
                  user: models.User = Depends(auth.get_current_user)):
    query = db.query(models.Exam).filter(
        models.Exam.start_time <= end, models.Exam.end_time >= start
    )
    if user.role == R.lecturer:
        query = query.filter(models.Exam.lecturer_id == user.id)
    elif user.role == R.student:
        query = query.filter(models.Exam.status == models.ExamStatus.approved)
    # coordinator, hod, admin see everything (oversight roles)

    return [_exam_summary(e) for e in query.all()]


@app.get("/exams/{exam_id}", response_model=schemas.ExamDetail)
def get_exam_detail(exam_id: str, db: Session = Depends(get_db),
                     user: models.User = Depends(auth.get_current_user)):
    exam = db.query(models.Exam).filter(models.Exam.id == exam_id).first()
    if exam is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Exam not found")

    is_owner_lecturer = user.role == R.lecturer and exam.lecturer_id == user.id
    is_privileged = is_owner_lecturer or user.role in (R.coordinator, R.hod, R.admin)

    if not is_privileged:
        already_submitted = (
            db.query(models.Submission)
            .filter(models.Submission.exam_id == exam.id, models.Submission.student_id == user.id)
            .first() is not None
        )
        if exam.status != models.ExamStatus.approved and not already_submitted:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "This exam has not been approved yet")
        now = datetime.utcnow()
        if not already_submitted:
            if now < exam.start_time:
                raise HTTPException(status.HTTP_403_FORBIDDEN, "Exam has not opened yet")
            if now > exam.end_time:
                raise HTTPException(status.HTTP_403_FORBIDDEN, "Exam window has closed")

    questions_out = []
    for q in exam.questions:
        item = {"id": q.id, "type": q.type.value, "prompt": q.prompt, "points": q.points}
        if q.type == models.QuestionType.mcq:
            if is_privileged:
                item["options"] = [{"id": o.id, "text": o.text, "is_correct": o.is_correct} for o in q.mcq_options]
            else:
                item["options"] = [{"id": o.id, "text": o.text} for o in q.mcq_options]
        elif q.type == models.QuestionType.matching:
            if is_privileged:
                item["pairs"] = [{"left": p.left_text, "right": p.right_text} for p in q.matching_pairs]
            else:
                item["left_items"] = [p.left_text for p in q.matching_pairs]
                item["right_items"] = [p.right_text for p in q.matching_pairs]
        elif q.type == models.QuestionType.gap:
            if is_privileged:
                item["accepted_answers"] = [a.answer_text for a in q.accepted_answers]
        questions_out.append(item)

    return schemas.ExamDetail(
        id=exam.id, title=exam.title, start_time=exam.start_time,
        end_time=exam.end_time, duration_minutes=exam.duration_minutes,
        max_attempts=exam.max_attempts, early_submission_bonus=exam.early_submission_bonus,
        status=exam.status.value,
        questions=questions_out,
    )


# ---------- Action 3: Questions (Lecturer CRUD on own exam's questions) ----------

def _get_owned_exam(exam_id: str, lecturer: models.User, db: Session) -> models.Exam:
    exam = db.query(models.Exam).filter(models.Exam.id == exam_id).first()
    if exam is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Exam not found")
    if exam.lecturer_id != lecturer.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your exam")
    return exam


@app.post("/questions/suggest-answers")
def suggest_answers(payload: schemas.SuggestVariantsRequest,
                     lecturer: models.User = Depends(auth.require_role(R.lecturer))):
    if not payload.answer.strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Answer cannot be empty")
    variants = generate_variants(payload.answer)
    synonym_senses = suggest_synonyms(payload.answer)
    return {"canonical": payload.answer, "variants": variants, "synonym_senses": synonym_senses}


@app.post("/exams/{exam_id}/questions/mcq")
def add_mcq_question(exam_id: str, payload: schemas.McqQuestionCreate, db: Session = Depends(get_db),
                      lecturer: models.User = Depends(auth.require_role(R.lecturer))):
    exam = _get_owned_exam(exam_id, lecturer, db)
    if not any(o.is_correct for o in payload.options):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "At least one option must be marked correct")
    question = models.Question(exam_id=exam.id, type=models.QuestionType.mcq,
                                prompt=payload.prompt, points=payload.points, order=len(exam.questions))
    db.add(question); db.flush()
    for opt in payload.options:
        db.add(models.McqOption(question_id=question.id, text=opt.text, is_correct=opt.is_correct))
    db.commit()
    return {"id": question.id, "type": "mcq"}


@app.post("/exams/{exam_id}/questions/gap")
def add_gap_question(exam_id: str, payload: schemas.GapQuestionCreate, db: Session = Depends(get_db),
                      lecturer: models.User = Depends(auth.require_role(R.lecturer))):
    exam = _get_owned_exam(exam_id, lecturer, db)
    if not payload.accepted_answers:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "At least one accepted answer is required")
    question = models.Question(exam_id=exam.id, type=models.QuestionType.gap,
                                prompt=payload.prompt, points=payload.points, order=len(exam.questions))
    db.add(question); db.flush()
    for ans in payload.accepted_answers:
        db.add(models.AcceptedAnswer(question_id=question.id, answer_text=ans))
    db.commit()
    return {"id": question.id, "type": "gap"}


@app.post("/exams/{exam_id}/questions/matching")
def add_matching_question(exam_id: str, payload: schemas.MatchingQuestionCreate, db: Session = Depends(get_db),
                           lecturer: models.User = Depends(auth.require_role(R.lecturer))):
    exam = _get_owned_exam(exam_id, lecturer, db)
    if len(payload.pairs) < 2:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "At least two pairs are required")
    question = models.Question(exam_id=exam.id, type=models.QuestionType.matching,
                                prompt=payload.prompt, points=payload.points, order=len(exam.questions))
    db.add(question); db.flush()
    for pair in payload.pairs:
        db.add(models.MatchingPair(question_id=question.id, left_text=pair.left, right_text=pair.right))
    db.commit()
    return {"id": question.id, "type": "matching"}


@app.delete("/questions/{question_id}")
def delete_question(question_id: str, db: Session = Depends(get_db),
                     lecturer: models.User = Depends(auth.require_role(R.lecturer))):
    question = db.query(models.Question).filter(models.Question.id == question_id).first()
    if question is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Question not found")
    if question.exam.lecturer_id != lecturer.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your question")
    db.delete(question)
    db.commit()
    return {"message": "Question deleted"}


# ---------- Action 5 & 6: Submissions + grade override ----------

@app.get("/exams/{exam_id}/my-submission", response_model=schemas.SubmissionResult)
def get_my_submission(exam_id: str, db: Session = Depends(get_db),
                       student: models.User = Depends(auth.require_role(R.student))):
    submission = (
        db.query(models.Submission)
        .filter(models.Submission.exam_id == exam_id, models.Submission.student_id == student.id)
        .order_by(models.Submission.submitted_at.desc())
        .first()
    )
    if submission is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No submission yet")
    attempts_used = db.query(models.Submission).filter(
        models.Submission.exam_id == exam_id, models.Submission.student_id == student.id
    ).count()
    exam = db.query(models.Exam).filter(models.Exam.id == exam_id).first()
    return {
        "id": submission.id,
        "score": submission.score,
        "max_score": submission.max_score,
        "per_question_result": submission.per_question_result,
        "overridden_score": submission.overridden_score,
        "override_note": submission.override_note,
        "submitted_at": submission.submitted_at,
        "attempt_number": submission.attempt_number,
        "attempts_used": attempts_used,
        "max_attempts": exam.max_attempts,
    }


@app.post("/submissions", response_model=schemas.SubmissionResult)
def submit_answers(payload: schemas.SubmissionCreate, db: Session = Depends(get_db),
                    student: models.User = Depends(auth.require_role(R.student))):
    exam = db.query(models.Exam).filter(models.Exam.id == payload.exam_id).first()
    if exam is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Exam not found")
    if exam.status != models.ExamStatus.approved:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This exam has not been approved yet")

    now = datetime.utcnow()
    if now < exam.start_time:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Exam has not started yet")
    if now > exam.end_time:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Exam window has closed")

    attempt_count = db.query(models.Submission).filter(
        models.Submission.student_id == student.id, models.Submission.exam_id == exam.id
    ).count()
    if attempt_count >= exam.max_attempts:
        raise HTTPException(status.HTTP_409_CONFLICT, "Maximum attempts reached")

    score, max_score, per_question_result = grade_submission(db, exam, payload.answers)
    if exam.early_submission_bonus > 0 and now < exam.end_time:
        score = min(max_score, score + exam.early_submission_bonus)

    submission = models.Submission(
        student_id=student.id, exam_id=exam.id, answers=payload.answers,
        score=score, max_score=max_score, per_question_result=per_question_result,
        attempt_number=attempt_count + 1,
    )
    db.add(submission); db.commit(); db.refresh(submission)
    return submission


@app.get("/exams/{exam_id}/submissions")
def list_exam_submissions(exam_id: str, db: Session = Depends(get_db),
                           user: models.User = Depends(auth.get_current_user)):
    exam = db.query(models.Exam).filter(models.Exam.id == exam_id).first()
    if exam is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Exam not found")
    is_owner_lecturer = user.role == R.lecturer and exam.lecturer_id == user.id
    if not (is_owner_lecturer or user.role in (R.hod, R.admin, R.coordinator)):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized to view these submissions")

    submissions = db.query(models.Submission).filter(models.Submission.exam_id == exam_id).all()
    out = []
    for s in submissions:
        student = db.query(models.User).filter(models.User.id == s.student_id).first()
        out.append({
            "id": s.id, "student_name": student.name, "reg_number": student.reg_number,
            "score": s.score, "max_score": s.max_score,
            "overridden_score": s.overridden_score, "override_note": s.override_note,
            "submitted_at": s.submitted_at,
        })
    return out


@app.patch("/submissions/{submission_id}/override", response_model=schemas.SubmissionResult)
def override_submission_score(submission_id: str, payload: schemas.SubmissionOverride, db: Session = Depends(get_db),
                               user: models.User = Depends(auth.get_current_user)):
    submission = db.query(models.Submission).filter(models.Submission.id == submission_id).first()
    if submission is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Submission not found")

    exam = db.query(models.Exam).filter(models.Exam.id == submission.exam_id).first()
    is_owner_lecturer = user.role == R.lecturer and exam.lecturer_id == user.id
    if not (is_owner_lecturer or user.role == R.admin):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized to override this grade")

    if payload.score < 0 or payload.score > submission.max_score:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Score must be between 0 and {submission.max_score}")

    submission.overridden_score = payload.score
    submission.override_note = payload.note
    db.commit(); db.refresh(submission)
    return submission


@app.get("/submissions/{submission_id}/result.pdf")
def download_result_pdf(submission_id: str, db: Session = Depends(get_db),
                         user: models.User = Depends(auth.get_current_user)):
    submission = db.query(models.Submission).filter(models.Submission.id == submission_id).first()
    if submission is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Submission not found")

    exam = db.query(models.Exam).filter(models.Exam.id == submission.exam_id).first()
    student = db.query(models.User).filter(models.User.id == submission.student_id).first()
    is_owner_lecturer = user.role == R.lecturer and exam.lecturer_id == user.id
    is_self = user.role == R.student and submission.student_id == user.id
    if not (is_self or is_owner_lecturer or user.role in (R.hod, R.admin, R.coordinator)):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized to view this result")

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4
    y = height - 60

    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, y, "Exam Result Slip")
    y -= 30
    c.setFont("Helvetica", 11)
    c.drawString(50, y, f"Exam: {exam.title}"); y -= 18
    c.drawString(50, y, f"Student: {student.name} ({student.reg_number or student.email})"); y -= 18
    c.drawString(50, y, f"Submitted: {submission.submitted_at}"); y -= 30

    final_score = submission.overridden_score if submission.overridden_score is not None else submission.score
    c.setFont("Helvetica-Bold", 13)
    c.drawString(50, y, f"Score: {final_score} / {submission.max_score}")
    y -= 25
    if submission.overridden_score is not None:
        c.setFont("Helvetica-Oblique", 10)
        c.drawString(50, y, f"(Grade overridden - original auto-score: {submission.score}. Note: {submission.override_note})")
        y -= 25

    c.setFont("Helvetica-Bold", 11)
    c.drawString(50, y, "Per-question results:")
    y -= 18
    c.setFont("Helvetica", 10)
    for q in exam.questions:
        correct = submission.per_question_result.get(q.id, False)
        c.drawString(60, y, f"- {q.prompt[:70]}: {'Correct' if correct else 'Incorrect'}")
        y -= 15
        if y < 60:
            c.showPage(); y = height - 60

    c.showPage()
    c.save()
    buf.seek(0)
    return StreamingResponse(
        buf, media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=result_{submission_id[:8]}.pdf"},
    )


# ---------- Action 9: Reports (auto-generated, read-only) ----------

def _compute_exam_report(exam: models.Exam, db: Session) -> dict:
    submissions = db.query(models.Submission).filter(models.Submission.exam_id == exam.id).all()
    scores = [
        (s.overridden_score if s.overridden_score is not None else s.score) for s in submissions
    ]
    count = len(scores)
    avg = sum(scores) / count if count else 0
    max_score = submissions[0].max_score if submissions else 0
    pass_count = sum(1 for s in scores if max_score and s / max_score >= 0.5)
    pass_rate = (pass_count / count * 100) if count else 0
    return {
        "exam_title": exam.title, "submissions": count, "average_score": round(avg, 2),
        "max_score": max_score, "pass_rate_percent": round(pass_rate, 1),
    }


@app.get("/reports/exam/{exam_id}")
def get_exam_report(exam_id: str, db: Session = Depends(get_db),
                     user: models.User = Depends(auth.get_current_user)):
    exam = db.query(models.Exam).filter(models.Exam.id == exam_id).first()
    if exam is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Exam not found")
    is_owner_lecturer = user.role == R.lecturer and exam.lecturer_id == user.id
    if not (is_owner_lecturer or user.role in (R.hod, R.admin, R.coordinator)):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized to view this report")
    return _compute_exam_report(exam, db)


@app.get("/reports/exam/{exam_id}/summary.pdf")
def download_report_pdf(exam_id: str, db: Session = Depends(get_db),
                         user: models.User = Depends(auth.get_current_user)):
    exam = db.query(models.Exam).filter(models.Exam.id == exam_id).first()
    if exam is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Exam not found")
    is_owner_lecturer = user.role == R.lecturer and exam.lecturer_id == user.id
    if not (is_owner_lecturer or user.role in (R.hod, R.admin, R.coordinator)):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized to view this report")

    report = _compute_exam_report(exam, db)
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4
    y = height - 60

    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, y, "Exam Performance Report"); y -= 30
    c.setFont("Helvetica", 12)
    for label, value in report.items():
        c.drawString(50, y, f"{label.replace('_', ' ').title()}: {value}")
        y -= 20

    c.showPage(); c.save(); buf.seek(0)
    return StreamingResponse(
        buf, media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=report_{exam_id[:8]}.pdf"},
    )


# ---------- Action 10: Downloads - gradebook XLSX ----------

@app.get("/exams/{exam_id}/gradebook.xlsx")
def download_gradebook_xlsx(exam_id: str, db: Session = Depends(get_db),
                             user: models.User = Depends(auth.get_current_user)):
    exam = db.query(models.Exam).filter(models.Exam.id == exam_id).first()
    if exam is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Exam not found")
    is_owner_lecturer = user.role == R.lecturer and exam.lecturer_id == user.id
    if not (is_owner_lecturer or user.role in (R.hod, R.admin, R.coordinator)):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized to view this gradebook")

    submissions = db.query(models.Submission).filter(models.Submission.exam_id == exam_id).all()

    wb = Workbook()
    ws = wb.active
    ws.title = "Gradebook"
    headers = ["Student Name", "Registration Number", "Score", "Max Score", "Overridden Score", "Submitted At"]
    ws.append(headers)
    for s in submissions:
        student = db.query(models.User).filter(models.User.id == s.student_id).first()
        ws.append([
            student.name, student.reg_number or "", s.score, s.max_score,
            s.overridden_score if s.overridden_score is not None else "",
            s.submitted_at.isoformat(),
        ])

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=gradebook_{exam_id[:8]}.xlsx"},
    )


# ---------- Action 7: Announcements (lecturer/admin CRUD, all read) ----------

@app.post("/announcements")
def create_announcement(payload: schemas.AnnouncementCreate, db: Session = Depends(get_db),
                         user: models.User = Depends(auth.require_role(R.lecturer, R.admin))):
    ann = models.Announcement(author_id=user.id, title=payload.title, body=payload.body)
    db.add(ann); db.commit(); db.refresh(ann)
    return {"id": ann.id, "title": ann.title, "body": ann.body,
            "author_name": user.name, "created_at": ann.created_at}


@app.get("/announcements")
def list_announcements(db: Session = Depends(get_db),
                        user: models.User = Depends(auth.get_current_user)):
    anns = db.query(models.Announcement).order_by(models.Announcement.created_at.desc()).all()
    return [
        {"id": a.id, "title": a.title, "body": a.body, "author_name": a.author.name, "created_at": a.created_at}
        for a in anns
    ]


@app.patch("/announcements/{announcement_id}")
def update_announcement(announcement_id: str, payload: schemas.AnnouncementCreate, db: Session = Depends(get_db),
                         user: models.User = Depends(auth.get_current_user)):
    ann = db.query(models.Announcement).filter(models.Announcement.id == announcement_id).first()
    if ann is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Announcement not found")
    if not (ann.author_id == user.id or user.role == R.admin):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized to edit this announcement")
    ann.title = payload.title
    ann.body = payload.body
    db.commit()
    return {"message": "Announcement updated"}


@app.delete("/announcements/{announcement_id}")
def delete_announcement(announcement_id: str, db: Session = Depends(get_db),
                         user: models.User = Depends(auth.get_current_user)):
    ann = db.query(models.Announcement).filter(models.Announcement.id == announcement_id).first()
    if ann is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Announcement not found")
    if not (ann.author_id == user.id or user.role == R.admin):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized to delete this announcement")
    db.delete(ann)
    db.commit()
    return {"message": "Announcement deleted"}
