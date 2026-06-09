from typing import Final

# emoji → English label (LLM 프롬프트용, Java MoodType과 동일한 5가지)
MOOD_LABEL: Final[dict[str, str]] = {
    "☺️": "HAPPY",
    "😭": "SAD",
    "😮": "SURPRISED",
    "😍": "LOVE",
    "😡": "ANGRY",
}

# MoodType명 → emoji (Java MoodType enum / Spring API 연동용)
MOOD_NAME_TO_EMOJI: Final[dict[str, str]] = {
    "HAPPY":     "☺️",
    "SAD":       "😭",
    "SURPRISED": "😮",
    "LOVE":      "😍",
    "ANGRY":     "😡",
}

# emoji → 이미지 생성용 명시적 영어 표현 (아바타 표정 일관성)
MOOD_EXPRESSION_EN: Final[dict[str, str]] = {
    "☺️": "big warm satisfied smile, relaxed happy eyes, contentedly cheerful",
    "😭": "crying with tears streaming down, deeply sad drooping mouth, visibly upset",
    "😮": "shocked wide-open mouth, wide eyes with raised eyebrows, visibly startled",
    "😍": "overjoyed heart-eyes expression, ecstatic huge smile, pure delight and excitement",
    "😡": "furious scowling face, deeply furrowed brows, intense angry glare, clearly enraged",
}
