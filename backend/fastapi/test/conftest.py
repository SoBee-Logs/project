"""
conftest.py — pytest 전역 픽스처 및 import 시점 Mock 설정

해결:
  - sys.modules에 가짜 모듈을 미리 등록해 실제 DB/설정 코드가 import되지 않도록 막음
  - 서비스 모듈을 conftest에서 미리 import해 patch()가 정상 동작하도록 함
  - 테스트는 DB/OpenAI 없이 순수 비즈니스 로직만 검증
"""
import sys
from unittest.mock import MagicMock, AsyncMock


def _make_repo_mock():
    """category_mapping_repository의 모든 함수를 빈 AsyncMock으로 구성."""
    m = MagicMock()
    m.find_mapping                  = AsyncMock(return_value=None)
    m.get_etc_category              = AsyncMock(return_value={"payment_category_id": 16, "category_name": "기타"})
    m.update_transaction_category   = AsyncMock()
    m.get_unmapped_transactions     = AsyncMock(return_value=[])
    m.get_pending_llm_pairs         = AsyncMock(return_value=[])
    m.insert_llm_mapping            = AsyncMock()
    m.backfill_transactions_by_pair = AsyncMock(return_value=0)
    return m


# ── Step 1: 외부 패키지 및 DB 모듈을 import 전에 가짜로 등록 ─────────────
#   - 가상환경에 설치 여부에 관계없이 테스트가 동작하도록 차단
_settings_mock = MagicMock()
_settings_mock.GEMINI_API_KEY = "test-key"

_config_mock = MagicMock()
_config_mock.settings = _settings_mock

sys.modules.setdefault("aiomysql",                           MagicMock())
sys.modules.setdefault("google",                             MagicMock())
sys.modules.setdefault("google.genai",                       MagicMock())
sys.modules.setdefault("google.genai.types",                 MagicMock())
sys.modules.setdefault("pydantic_settings",                  MagicMock())
sys.modules.setdefault("app.core.config",                    _config_mock)
sys.modules.setdefault("app.db.connection",                  MagicMock())
sys.modules.setdefault("app.db.category_mapping_repository", _make_repo_mock())

# ── Step 2: 서비스 모듈을 미리 import → patch()가 모듈을 찾을 수 있게 됨 ──
import app.services.category_mapping_service  # noqa: E402, F401
