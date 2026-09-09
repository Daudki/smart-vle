from nltk.corpus import wordnet as wn


def suggest_synonyms(answer: str, pos: str | None = None) -> dict:
    word = answer.strip().lower().replace(" ", "_")
    synsets = wn.synsets(word, pos=pos)

    suggestions = {}
    for s in synsets:
        lemmas = sorted({
            l.name().replace("_", " ")
            for l in s.lemmas()
            if l.name().replace("_", " ").lower() != word.replace("_", " ")
        })
        if lemmas:
            suggestions[s.name()] = {
                "definition": s.definition(),
                "synonyms": lemmas,
            }
    return suggestions
