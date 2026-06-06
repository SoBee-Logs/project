"""
단위 테스트: category_mapping_service.py
- 실제 DB, Gemini API 연결 없이 Mock으로 대체
- 총 13개 테스트
"""
import pytest
from unittest.mock import AsyncMock, patch, call


# ─────────────────────────────────────────────
# 테스트 전체에서 공통으로 쓰는 Mock 경로 상수
# ─────────────────────────────────────────────
REPO = "app.services.category_mapping_service.repo"
LLM  = "app.services.category_mapping_service._call_gemini_classify"


# ══════════════════════════════════════════════════════════════
# 그룹 1: resolve_category — 단건 매핑 (2개)
# ══════════════════════════════════════════════════════════════
class TestResolveCategory:
    """
    resolve_category(payment_category, payment_place)
    - DB에 매핑 있음 → 해당 카테고리 반환
    - DB에 매핑 없음 → 기타(16) 반환
    """

    @pytest.mark.asyncio
    async def test_매핑_있을때_해당_카테고리_반환(self):
        # Given: DB에 (커피전문점 + 스타벅스) → 카페/간식(2) 매핑이 있음
        fake_mapping = {
            "payment_category_id": 2,
            "category_name": "카페/간식",
            "matched_by": "tier2",
        }

        with patch(f"{REPO}.find_mapping", new=AsyncMock(return_value=fake_mapping)):
            from app.services.category_mapping_service import resolve_category
            result = await resolve_category("커피전문점", "스타벅스")

        # Then
        assert result.payment_category_id == 2
        assert result.category_name == "카페/간식"
        assert result.matched_by == "tier2"

    @pytest.mark.asyncio
    async def test_매핑_없을때_기타16_반환(self):
        # Given: DB에 매핑 없음 → get_etc_category 호출됨
        fake_etc = {"payment_category_id": 16, "category_name": "기타"}

        with patch(f"{REPO}.find_mapping", new=AsyncMock(return_value=None)), \
             patch(f"{REPO}.get_etc_category", new=AsyncMock(return_value=fake_etc)):
            from app.services.category_mapping_service import resolve_category
            result = await resolve_category("알수없는분류", "이상한가게")

        # Then
        assert result.payment_category_id == 16
        assert result.category_name == "기타"
        assert result.matched_by == "etc"


# ══════════════════════════════════════════════════════════════
# 그룹 2: _build_llm_prompt — 순수 함수 (3개)
# ══════════════════════════════════════════════════════════════
class TestBuildLlmPrompt:
    """
    _build_llm_prompt(items)
    - 외부 의존성 없는 순수 함수이므로 Mock 불필요
    - 결과 문자열에 필요한 내용이 포함되는지 검증
    """

    def test_가맹점명이_프롬프트에_포함됨(self):
        from app.services.category_mapping_service import _build_llm_prompt

        items = [{"payment_place": "스타벅스", "payment_category": "커피전문점"}]
        prompt = _build_llm_prompt(items)

        assert "스타벅스" in prompt

    def test_카드사분류가_프롬프트에_포함됨(self):
        from app.services.category_mapping_service import _build_llm_prompt

        items = [{"payment_place": "스타벅스", "payment_category": "커피전문점"}]
        prompt = _build_llm_prompt(items)

        assert "커피전문점" in prompt

    def test_여러_아이템이_모두_포함됨(self):
        from app.services.category_mapping_service import _build_llm_prompt

        items = [
            {"payment_place": "스타벅스", "payment_category": "커피전문점"},
            {"payment_place": "신한카드", "payment_category": "금융"},
        ]
        prompt = _build_llm_prompt(items)

        assert "스타벅스" in prompt
        assert "신한카드" in prompt


# ══════════════════════════════════════════════════════════════
# 그룹 3: resolve_and_update_all_unmapped — 일괄 매핑 (4개)
# ══════════════════════════════════════════════════════════════
class TestResolveAndUpdateAll:
    """
    resolve_and_update_all_unmapped()
    - 미매핑 없음 → 빈 결과 반환, LLM 호출 안 함
    - 전부 룰베이스 성공 → LLM 호출 안 함
    - 일부 기타로 떨어짐 → LLM 자동 호출
    - 동일 페어 중복 → find_mapping 1번만 호출 (캐시)
    """

    @pytest.mark.asyncio
    async def test_미매핑_없을때_빈_결과_반환(self):
        # Given: 처리할 트랜잭션이 없음
        with patch(f"{REPO}.get_unmapped_transactions", new=AsyncMock(return_value=[])):
            from app.services.category_mapping_service import resolve_and_update_all_unmapped
            result = await resolve_and_update_all_unmapped()

        # Then: LLM 호출도 없고 결과도 0
        assert result["total"] == 0
        assert result["matched"] == 0
        assert result["etc"] == 0

    @pytest.mark.asyncio
    async def test_전부_룰베이스_성공시_LLM_호출_안됨(self):
        # Given: 트랜잭션 2개, 둘 다 룰베이스 매핑 성공
        fake_txs = [
            {"payment_id": 1, "payment_category": "커피전문점", "payment_place": "스타벅스"},
            {"payment_id": 2, "payment_category": "편의점",    "payment_place": "GS25"},
        ]
        fake_mapping = {"payment_category_id": 2, "category_name": "카페/간식", "matched_by": "tier1"}

        mock_llm = AsyncMock()
        with patch(f"{REPO}.get_unmapped_transactions", new=AsyncMock(return_value=fake_txs)), \
             patch(f"{REPO}.find_mapping",              new=AsyncMock(return_value=fake_mapping)), \
             patch(f"{REPO}.update_transaction_category", new=AsyncMock()), \
             patch("app.services.category_mapping_service.process_llm_for_etc_transactions", new=mock_llm):
            from app.services.category_mapping_service import resolve_and_update_all_unmapped
            result = await resolve_and_update_all_unmapped()

        # Then: etc=0이므로 LLM 호출 안 됨
        assert result["matched"] == 2
        assert result["etc"] == 0
        mock_llm.assert_not_called()

    @pytest.mark.asyncio
    async def test_일부_기타_떨어질때_LLM_자동_호출(self):
        # Given: 트랜잭션 2개, 1개는 매핑 성공 / 1개는 실패(기타)
        fake_txs = [
            {"payment_id": 1, "payment_category": "커피전문점", "payment_place": "스타벅스"},
            {"payment_id": 2, "payment_category": "알수없음",   "payment_place": "이상한가게"},
        ]
        fake_mapping = {"payment_category_id": 2, "category_name": "카페/간식", "matched_by": "tier1"}

        # find_mapping: 첫 번째는 성공, 두 번째는 None 반환
        find_mock = AsyncMock(side_effect=[fake_mapping, None])
        llm_mock  = AsyncMock(return_value={"processed": 1, "transactions_backfilled": 1})

        with patch(f"{REPO}.get_unmapped_transactions",    new=AsyncMock(return_value=fake_txs)), \
             patch(f"{REPO}.find_mapping",                 new=find_mock), \
             patch(f"{REPO}.update_transaction_category",  new=AsyncMock()), \
             patch("app.services.category_mapping_service.process_llm_for_etc_transactions", new=llm_mock):
            from app.services.category_mapping_service import resolve_and_update_all_unmapped
            result = await resolve_and_update_all_unmapped()

        # Then: etc=1이므로 LLM 호출됨
        assert result["matched"] == 1
        assert result["etc"] == 1
        llm_mock.assert_called_once()

    @pytest.mark.asyncio
    async def test_동일_페어_중복시_find_mapping_1번만_호출(self):
        # Given: 3개 트랜잭션이 모두 같은 (payment_category, payment_place) 쌍
        fake_txs = [
            {"payment_id": 1, "payment_category": "커피전문점", "payment_place": "스타벅스"},
            {"payment_id": 2, "payment_category": "커피전문점", "payment_place": "스타벅스"},
            {"payment_id": 3, "payment_category": "커피전문점", "payment_place": "스타벅스"},
        ]
        fake_mapping = {"payment_category_id": 2, "category_name": "카페/간식", "matched_by": "tier1"}
        find_mock = AsyncMock(return_value=fake_mapping)

        with patch(f"{REPO}.get_unmapped_transactions",   new=AsyncMock(return_value=fake_txs)), \
             patch(f"{REPO}.find_mapping",                new=find_mock), \
             patch(f"{REPO}.update_transaction_category", new=AsyncMock()):
            from app.services.category_mapping_service import resolve_and_update_all_unmapped
            await resolve_and_update_all_unmapped()

        # Then: 동일 페어라서 캐시에 의해 find_mapping은 1번만 호출됨
        assert find_mock.call_count == 1


# ══════════════════════════════════════════════════════════════
# 그룹 4: process_llm_for_etc_transactions — LLM 재분류 (4개)
# ══════════════════════════════════════════════════════════════
class TestProcessLlmForEtc:
    """
    process_llm_for_etc_transactions(batch_size)
    - 페어 없음 → 즉시 반환
    - LLM 예외 발생 → 오류 메시지 반환
    - LLM 유효한 ID 반환 → 정상 저장
    - LLM 범위 밖 ID(99) 반환 → 16으로 fallback 저장
    """

    @pytest.mark.asyncio
    async def test_처리할_페어_없을때_즉시_반환(self):
        # Given: LLM 처리 대상 페어가 없음
        with patch(f"{REPO}.get_pending_llm_pairs", new=AsyncMock(return_value=[])):
            from app.services.category_mapping_service import process_llm_for_etc_transactions
            result = await process_llm_for_etc_transactions()

        # Then: 처리 없이 즉시 반환
        assert result["processed"] == 0
        assert "없음" in result["message"]

    @pytest.mark.asyncio
    async def test_LLM_호출_실패시_오류_반환(self):
        # Given: LLM API가 예외를 던짐
        fake_pairs = [{"payment_category": "알수없음", "payment_place": "이상한가게"}]
        insert_mock = AsyncMock()

        with patch(f"{REPO}.get_pending_llm_pairs", new=AsyncMock(return_value=fake_pairs)), \
             patch(LLM, new=AsyncMock(side_effect=Exception("OpenAI 연결 실패"))), \
             patch(f"{REPO}.insert_llm_mapping", new=insert_mock):
            from app.services.category_mapping_service import process_llm_for_etc_transactions
            result = await process_llm_for_etc_transactions()

        # Then: 오류 메시지 반환, DB 저장 안 됨
        assert result["processed"] == 0
        assert "실패" in result["message"]
        insert_mock.assert_not_called()

    @pytest.mark.asyncio
    async def test_LLM_유효한_ID_반환시_정상_저장(self):
        # Given: LLM이 카페/간식(2) 반환
        fake_pairs = [{"payment_category": "커피전문점", "payment_place": "알수없는카페"}]
        llm_result = [{"index": 1, "payment_category_id": 2}]
        insert_mock   = AsyncMock()
        backfill_mock = AsyncMock(return_value=3)

        with patch(f"{REPO}.get_pending_llm_pairs",          new=AsyncMock(return_value=fake_pairs)), \
             patch(LLM,                                       new=AsyncMock(return_value=llm_result)), \
             patch(f"{REPO}.insert_llm_mapping",             new=insert_mock), \
             patch(f"{REPO}.backfill_transactions_by_pair",  new=backfill_mock):
            from app.services.category_mapping_service import process_llm_for_etc_transactions
            result = await process_llm_for_etc_transactions()

        # Then: id=2로 정상 저장됨
        assert result["processed"] == 1
        insert_mock.assert_called_once_with(
            payment_category="커피전문점",
            payment_place="알수없는카페",
            payment_category_id=2,
        )

    @pytest.mark.asyncio
    async def test_LLM_범위밖_ID_반환시_16으로_fallback(self):
        # Given: LLM이 유효하지 않은 ID(99) 반환
        fake_pairs = [{"payment_category": "알수없음", "payment_place": "이상한가게"}]
        llm_result = [{"index": 1, "payment_category_id": 99}]  # 범위 초과
        insert_mock   = AsyncMock()
        backfill_mock = AsyncMock(return_value=1)

        with patch(f"{REPO}.get_pending_llm_pairs",         new=AsyncMock(return_value=fake_pairs)), \
             patch(LLM,                                      new=AsyncMock(return_value=llm_result)), \
             patch(f"{REPO}.insert_llm_mapping",            new=insert_mock), \
             patch(f"{REPO}.backfill_transactions_by_pair", new=backfill_mock):
            from app.services.category_mapping_service import process_llm_for_etc_transactions
            result = await process_llm_for_etc_transactions()

        # Then: 99는 유효하지 않으므로 16(기타)으로 교체되어 저장됨
        assert result["processed"] == 1
        insert_mock.assert_called_once_with(
            payment_category="알수없음",
            payment_place="이상한가게",
            payment_category_id=16,  # fallback
        )
