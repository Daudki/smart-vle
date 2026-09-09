from sqlalchemy.orm import Session

from . import models
from .matcher import is_match


def grade_question(question: models.Question, student_answer) -> bool:
    if question.type == models.QuestionType.mcq:
        correct_option = next(
            (o.id for o in question.mcq_options if o.is_correct), None
        )
        return student_answer == correct_option

    if question.type == models.QuestionType.gap:
        accepted = [a.answer_text for a in question.accepted_answers]
        return is_match(str(student_answer), accepted)

    if question.type == models.QuestionType.matching:
        correct_pairs = {p.left_text: p.right_text for p in question.matching_pairs}
        if not isinstance(student_answer, dict):
            return False
        return all(
            student_answer.get(left) == right
            for left, right in correct_pairs.items()
        ) and len(student_answer) == len(correct_pairs)

    return False


def grade_submission(db: Session, exam: models.Exam, answers: dict):
    score = 0.0
    max_score = 0.0
    per_question_result = {}

    for question in exam.questions:
        max_score += question.points
        submitted = answers.get(question.id)
        correct = grade_question(question, submitted) if submitted is not None else False
        per_question_result[question.id] = correct
        if correct:
            score += question.points

    return score, max_score, per_question_result
