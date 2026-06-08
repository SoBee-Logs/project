"""
런타임에 LLM 프롬프트를 관리하는 모듈.
각 모듈이 register()로 기본값을 등록하고, get_prompt()로 현재 값을 읽는다.
set_prompt()로 수정하면 즉시 반영되고 prompts.json에 영구 저장된다.
변경 이력은 prompt_history.json에 저장된다.
"""
import json
from datetime import datetime
from pathlib import Path

_STORE_PATH = Path(__file__).parent.parent / "prompts.json"
_HISTORY_PATH = Path(__file__).parent.parent / "prompt_history.json"
_DEFAULTS: dict[str, str] = {}
_OVERRIDES: dict[str, str] = {}
_HISTORY: dict[str, list] = {}


def _load_overrides():
    global _OVERRIDES
    if _STORE_PATH.exists():
        try:
            _OVERRIDES = json.loads(_STORE_PATH.read_text(encoding="utf-8"))
        except Exception:
            _OVERRIDES = {}


def _load_history():
    global _HISTORY
    if _HISTORY_PATH.exists():
        try:
            _HISTORY = json.loads(_HISTORY_PATH.read_text(encoding="utf-8"))
        except Exception:
            _HISTORY = {}


def _save_history():
    _HISTORY_PATH.write_text(
        json.dumps(_HISTORY, ensure_ascii=False, indent=2), encoding="utf-8"
    )


_load_overrides()
_load_history()


def register(key: str, default: str):
    _DEFAULTS[key] = default


def get_prompt(key: str) -> str:
    return _OVERRIDES.get(key, _DEFAULTS.get(key, ""))


def set_prompt(key: str, value: str):
    _OVERRIDES[key] = value
    _STORE_PATH.write_text(
        json.dumps(_OVERRIDES, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def reset_prompt(key: str):
    _OVERRIDES.pop(key, None)
    _STORE_PATH.write_text(
        json.dumps(_OVERRIDES, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def add_prompt_history(key: str, old_value: str):
    if key not in _HISTORY:
        _HISTORY[key] = []
    _HISTORY[key].append({
        "value": old_value,
        "saved_at": datetime.now().isoformat(timespec="seconds"),
    })
    # 최대 20개 보관
    _HISTORY[key] = _HISTORY[key][-20:]
    _save_history()


def get_prompt_history(key: str) -> list:
    return list(reversed(_HISTORY.get(key, [])))


def list_prompts() -> list[dict]:
    all_keys = set(_DEFAULTS) | set(_OVERRIDES)
    return [
        {
            "key": k,
            "value": get_prompt(k),
            "is_modified": k in _OVERRIDES,
            "default": _DEFAULTS.get(k, ""),
            "history_count": len(_HISTORY.get(k, [])),
        }
        for k in sorted(all_keys)
    ]
