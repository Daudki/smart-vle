import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Integer, Float, Boolean, ForeignKey, DateTime,
    Enum, JSON, Text
)
from sqlalchemy.orm import relationship

from .database import Base


def gen_id() -> str:
    return str(uuid.uuid4())


class Role(str, enum.Enum):
    lecturer = "lecturer"
    student = "student"
    coordinator = "coordinator"
    hod = "hod"
    admin = "admin"


class ExamStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class QuestionType(str, enum.Enum):
    mcq = "mcq"
    gap = "gap"
    matching = "matching"


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(Enum(Role), nullable=False)
    reg_number = Column(String, unique=True, nullable=True)
    admission_year = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True)

    exams = relationship("Exam", back_populates="lecturer")
    submissions = relationship("Submission", back_populates="student")


class Course(Base):
    __tablename__ = "courses"

    id = Column(String, primary_key=True, default=gen_id)
    code = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)

    exams = relationship("Exam", back_populates="course")


class Exam(Base):
    __tablename__ = "exams"

    id = Column(String, primary_key=True, default=gen_id)
    lecturer_id = Column(String, ForeignKey("users.id"), nullable=False)
    course_id = Column(String, ForeignKey("courses.id"), nullable=True)
    title = Column(String, nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    max_attempts = Column(Integer, nullable=False, default=1)
    early_submission_bonus = Column(Float, nullable=False, default=0.0)
    status = Column(Enum(ExamStatus), default=ExamStatus.pending)

    lecturer = relationship("User", back_populates="exams")
    course = relationship("Course", back_populates="exams")
    questions = relationship(
        "Question", back_populates="exam", cascade="all, delete-orphan",
        order_by="Question.order",
    )


class Question(Base):
    __tablename__ = "questions"

    id = Column(String, primary_key=True, default=gen_id)
    exam_id = Column(String, ForeignKey("exams.id"), nullable=False)
    type = Column(Enum(QuestionType), nullable=False)
    prompt = Column(Text, nullable=False)
    order = Column(Integer, default=0)
    points = Column(Float, default=1.0)

    exam = relationship("Exam", back_populates="questions")
    accepted_answers = relationship(
        "AcceptedAnswer", back_populates="question", cascade="all, delete-orphan"
    )
    mcq_options = relationship(
        "McqOption", back_populates="question", cascade="all, delete-orphan"
    )
    matching_pairs = relationship(
        "MatchingPair", back_populates="question", cascade="all, delete-orphan"
    )


class AcceptedAnswer(Base):
    __tablename__ = "accepted_answers"

    id = Column(String, primary_key=True, default=gen_id)
    question_id = Column(String, ForeignKey("questions.id"), nullable=False)
    answer_text = Column(String, nullable=False)

    question = relationship("Question", back_populates="accepted_answers")


class McqOption(Base):
    __tablename__ = "mcq_options"

    id = Column(String, primary_key=True, default=gen_id)
    question_id = Column(String, ForeignKey("questions.id"), nullable=False)
    text = Column(String, nullable=False)
    is_correct = Column(Boolean, default=False)

    question = relationship("Question", back_populates="mcq_options")


class MatchingPair(Base):
    __tablename__ = "matching_pairs"

    id = Column(String, primary_key=True, default=gen_id)
    question_id = Column(String, ForeignKey("questions.id"), nullable=False)
    left_text = Column(String, nullable=False)
    right_text = Column(String, nullable=False)

    question = relationship("Question", back_populates="matching_pairs")


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(String, primary_key=True, default=gen_id)
    student_id = Column(String, ForeignKey("users.id"), nullable=False)
    exam_id = Column(String, ForeignKey("exams.id"), nullable=False)
    answers = Column(JSON, nullable=False)
    score = Column(Float, nullable=True)
    max_score = Column(Float, nullable=True)
    per_question_result = Column(JSON, nullable=True)
    overridden_score = Column(Float, nullable=True)
    override_note = Column(String, nullable=True)
    attempt_number = Column(Integer, nullable=False, default=1)
    submitted_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("User", back_populates="submissions")


class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(String, primary_key=True, default=gen_id)
    author_id = Column(String, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    author = relationship("User")
