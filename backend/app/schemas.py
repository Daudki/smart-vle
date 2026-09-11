from datetime import datetime
from typing import Any

from pydantic import BaseModel


class ExamCreate(BaseModel):
    title: str
    start_time: datetime
    end_time: datetime
    duration_minutes: int
    max_attempts: int = 1
    early_submission_bonus: float = 0.0
    course_id: str | None = None


class ExamUpdate(BaseModel):
    title: str | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    duration_minutes: int | None = None
    max_attempts: int | None = None
    early_submission_bonus: float | None = None


class ExamStatusUpdate(BaseModel):
    status: str


class ExamSummary(BaseModel):
    id: str
    title: str
    start_time: datetime
    end_time: datetime
    lecturer_name: str
    status: str
    max_attempts: int = 1
    early_submission_bonus: float = 0.0

    class Config:
        from_attributes = True


class ExamDetail(BaseModel):
    id: str
    title: str
    start_time: datetime
    end_time: datetime
    duration_minutes: int
    max_attempts: int
    early_submission_bonus: float
    status: str
    questions: list[dict]

    class Config:
        from_attributes = True


class SuggestVariantsRequest(BaseModel):
    answer: str


class McqOptionIn(BaseModel):
    text: str
    is_correct: bool = False


class McqQuestionCreate(BaseModel):
    prompt: str
    points: float = 1.0
    options: list[McqOptionIn]


class GapQuestionCreate(BaseModel):
    prompt: str
    points: float = 1.0
    accepted_answers: list[str]


class MatchingPairIn(BaseModel):
    left: str
    right: str


class MatchingQuestionCreate(BaseModel):
    prompt: str
    points: float = 1.0
    pairs: list[MatchingPairIn]


class SubmissionCreate(BaseModel):
    exam_id: str
    answers: dict[str, Any]


class SubmissionResult(BaseModel):
    id: str
    score: float
    max_score: float
    per_question_result: dict[str, bool]
    overridden_score: float | None = None
    override_note: str | None = None
    submitted_at: datetime
    attempt_number: int

    class Config:
        from_attributes = True


class SubmissionOverride(BaseModel):
    score: float
    note: str


class CourseCreate(BaseModel):
    code: str
    name: str


class CourseOut(BaseModel):
    id: str
    code: str
    name: str

    class Config:
        from_attributes = True


class AnnouncementCreate(BaseModel):
    title: str
    body: str


class AnnouncementOut(BaseModel):
    id: str
    title: str
    body: str
    author_name: str
    created_at: datetime


class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    role: str


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    role: str
    is_active: bool
    reg_number: str | None = None

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    name: str | None = None
    role: str | None = None
    is_active: bool | None = None
