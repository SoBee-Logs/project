"""
LLM 응답시간을 메모리에 누적 저장하는 모듈.
FastAPI 재시작 시 초기화됨.
"""
from collections import deque
from statistics import mean

_MAX = 100  # 서비스별 최근 N건만 유지

_store: dict[str, deque] = {
    "vlm": deque(maxlen=_MAX),
    "diary": deque(maxlen=_MAX),
    "avatar": deque(maxlen=_MAX),
}


def record(service: str, elapsed_ms: int):
    if service in _store:
        _store[service].append(elapsed_ms)


def get_stats(service: str) -> dict | None:
    q = _store.get(service)
    if not q:
        return None
    return {
        "avg_ms": round(mean(q)),
        "min_ms": min(q),
        "max_ms": max(q),
        "count": len(q),
    }
