from collections import defaultdict
from datetime import datetime
from typing import Iterable, Optional

# 주차별 소비 감정 선택 규칙 (리포트·아바타 공용)
# - 입력: 사진 단위 (감정 enum 이름, 촬영시각) 행들. 한 사진이 1표.
# - 최빈 감정을 고르되, 동률이면 taken_at이 가장 최근인 사진의 감정을 우선한다.
def pick_top_mood_name(rows: Iterable[tuple[Optional[str], Optional[datetime]]]) -> Optional[str]:
    counts: dict[str, int] = defaultdict(int)
    latest: dict[str, datetime] = {}
    for mood_name, taken_at in rows:
        if not mood_name:
            continue
        counts[mood_name] += 1
        ts = taken_at or datetime.min
        if mood_name not in latest or ts > latest[mood_name]:
            latest[mood_name] = ts
    if not counts:
        return None
    # 1순위: 등장 횟수, 2순위(동률): 가장 최근 taken_at
    return max(counts, key=lambda m: (counts[m], latest[m]))
