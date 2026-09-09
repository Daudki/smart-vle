import re

from .synonyms import suggest_synonyms


def canonicalize(text: str) -> str:
    text = text.strip().lower()
    text = re.sub(r"[.,;:!?\"'-]", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _answer_variants(answer: str) -> set[str]:
    variants = set()
    stripped = (answer or "").strip()
    if not stripped:
        return variants

    for candidate in generate_variants(stripped):
        variants.add(canonicalize(candidate))

    for token in re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?", stripped):
        token_variants = suggest_synonyms(token)
        for syn_info in token_variants.values():
            for synonym in syn_info.get("synonyms", []):
                variants.add(canonicalize(synonym))

    return variants


def is_match(student_answer: str, accepted_answers: list[str]) -> bool:
    student_norm = canonicalize(student_answer)
    if not student_norm:
        return False

    accepted_norm = set()
    for answer in accepted_answers:
        accepted_norm |= _answer_variants(answer)

    return student_norm in accepted_norm


def _initial(word: str) -> str:
    return word[0].upper() if word else ""


def _with_periods(words: list[str], already_dotted: bool = False) -> str:
    out = []
    for w in words:
        w_clean = w.rstrip(".")
        if not already_dotted and len(w_clean) == 1:
            out.append(w_clean + ".")
        else:
            out.append(w)
    return " ".join(out)


def generate_variants(answer: str) -> list[str]:
    words = answer.strip().split()
    variants = {answer.strip()}

    if 2 <= len(words) <= 4:
        variants.add(_with_periods(words))

        if len(words) >= 3:
            middled = [words[0]] + [
                _initial(w) + "." for w in words[1:-1]
            ] + [words[-1]]
            variants.add(" ".join(middled))
            variants.add(_with_periods(middled, already_dotted=True))
            variants.add(f"{words[0]} {words[-1]}")

        if len(words) >= 2:
            initials_form = [
                _initial(w) + "." for w in words[:-1]
            ] + [words[-1]]
            variants.add(" ".join(initials_form))
    else:
        variants.add(re.sub(r"\s*\.\s*", "", answer.strip()))

    return sorted(variants, key=lambda v: (len(v), v))
