"""
소비 일기 파이프라인 자동화 테스트
사진 업로드 → VLM 분석 → DB 결제 매핑 → LLM 일기 생성

실행:
    pip install pytest pytest-asyncio
    pytest test_pipeline.py -v

특정 케이스만 실행:
    pytest test_pipeline.py::TestVlmFailure -v
    pytest test_pipeline.py::TestMappingNoTransaction -v
    pytest test_pipeline.py::TestDiaryLlmGuard -v

실제 API 통합 테스트 (비용 발생):
    pytest test_pipeline.py::TestIntegration -v -s --run-integration
"""

import json
import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import HTTPException

from app.api.vlm import analyze_image, extract_exif
from app.api.diary_generate import generate_diary
from app.models.schemas import DiaryRequest


# ── 공통 헬퍼 ────────────────────────────────────────────────────────────────

FAKE_IMAGE_BYTES = b"\xff\xd8\xff\xe0" + b"\x00" * 100  # JPEG 시그니처만 있는 더미


def _mock_openai_response(content: str) -> MagicMock:
    """OpenAI chat.completions.create 반환값 객체를 흉내냄"""
    msg = MagicMock()
    msg.content = content
    choice = MagicMock()
    choice.message = msg
    resp = MagicMock()
    resp.choices = [choice]
    return resp


# ── Case A: VLM 분석 실패 (블랙/블러 이미지) ─────────────────────────────────

class TestVlmFailure:
    """
    분석 불가능한 이미지(검정 화면, 블러)가 들어왔을 때
    파이프라인이 error 키를 반환하고 서버가 죽지 않는지 검증.
    """

    @pytest.mark.asyncio
    @patch("app.api.vlm._get_client")
    async def test_empty_response_returns_error_key(self, mock_get_client):
        """OpenAI가 빈 content를 반환하면 응답에 error 키가 있어야 함"""
        mock_client = AsyncMock()
        mock_client.chat.completions.create.return_value = _mock_openai_response("")
        mock_get_client.return_value = mock_client

        result = await analyze_image("black.jpg", FAKE_IMAGE_BYTES)

        assert "error" in result, "분석 불가 이미지에서 error 키가 없음"

    @pytest.mark.asyncio
    @patch("app.api.vlm._get_client")
    async def test_non_json_response_returns_error_key(self, mock_get_client):
        """OpenAI가 JSON이 아닌 텍스트를 반환하면 error 키를 포함해야 함"""
        mock_client = AsyncMock()
        mock_client.chat.completions.create.return_value = _mock_openai_response(
            "이 이미지는 분석할 수 없습니다."  # 블러/노이즈 이미지 상황 시뮬레이션
        )
        mock_get_client.return_value = mock_client

        result = await analyze_image("blur.jpg", FAKE_IMAGE_BYTES)

        assert "error" in result
        assert result.get("file") == "blur.jpg", "파일명은 그대로 응답에 포함돼야 함"

    def test_exif_on_non_image_bytes_returns_null(self):
        """EXIF 추출 시 유효하지 않은 바이트면 datetime/gps 모두 None이어야 함"""
        result = extract_exif(b"not an image")

        assert result["datetime"] is None
        assert result["gps"] is None


# ── Case B: 매핑 실패 (DB에 해당 시간 결제 내역 없음) ────────────────────────

class TestMappingNoTransaction:
    """
    EXIF 시간은 뽑혔지만 ±오차범위 내 결제 내역이 없을 때
    파이프라인이 None/빈 리스트를 반환하고 에러 없이 처리되는지 검증.
    """

    @pytest.mark.asyncio
    @patch("app.db.transaction_repository.get_pool")
    async def test_db_returns_empty_list(self, mock_get_pool):
        """DB에 해당 날짜 결제 내역이 전혀 없을 때 빈 리스트를 반환해야 함"""
        from app.db.transaction_repository import get_transactions_by_date_range

        # aiomysql 풀/커넥션/커서 비동기 컨텍스트 매니저 모킹
        mock_cursor = AsyncMock()
        mock_cursor.__aenter__ = AsyncMock(return_value=mock_cursor)
        mock_cursor.__aexit__ = AsyncMock(return_value=False)
        mock_cursor.fetchall.return_value = []

        mock_conn = AsyncMock()
        mock_conn.__aenter__ = AsyncMock(return_value=mock_conn)
        mock_conn.__aexit__ = AsyncMock(return_value=False)
        mock_conn.cursor.return_value = mock_cursor

        mock_pool = MagicMock()
        mock_pool.acquire.return_value = mock_conn
        mock_get_pool.return_value = mock_pool

        result = await get_transactions_by_date_range(
            user_id=1, start_date="2024-01-01", end_date="2024-01-01"
        )

        assert result == [], "결제 내역이 없으면 빈 리스트여야 함"

    def test_time_window_no_match_returns_none(self):
        """±30분 오차 범위 내 결제가 없으면 None을 반환해야 함"""
        result = _find_closest_transaction(
            transactions=[],
            target_dt=datetime(2024, 6, 1, 14, 30, 0),
        )
        assert result is None

    def test_time_window_within_tolerance_returns_match(self):
        """±30분 오차 범위 내 결제가 있으면 해당 항목을 반환해야 함"""
        transactions = [
            {
                "payment_id": 42,
                "payment_date": "2024-06-01",
                "payment_time": "14:35:00",
                "payment_place": "스타벅스",
            }
        ]
        result = _find_closest_transaction(
            transactions=transactions,
            target_dt=datetime(2024, 6, 1, 14, 30, 0),  # 5분 차이 → 범위 내
        )
        assert result is not None
        assert result["payment_id"] == 42

    def test_time_window_outside_tolerance_returns_none(self):
        """오차 범위(30분)를 초과한 결제는 매칭하지 않아야 함"""
        transactions = [
            {
                "payment_id": 99,
                "payment_date": "2024-06-01",
                "payment_time": "16:00:00",
                "payment_place": "맥도날드",
            }
        ]
        result = _find_closest_transaction(
            transactions=transactions,
            target_dt=datetime(2024, 6, 1, 14, 30, 0),  # 90분 차이 → 범위 밖
        )
        assert result is None


def _find_closest_transaction(
    transactions: list[dict],
    target_dt: datetime,
    tolerance_minutes: int = 30,
) -> dict | None:
    """
    EXIF 촬영 시각(target_dt) 기준 ±tolerance_minutes 이내 결제 내역을 반환.
    매핑 로직 구현 전 시간 윈도우 로직만 단독 검증하는 헬퍼.
    """
    for tx in transactions:
        tx_dt = datetime.strptime(
            f"{tx['payment_date']} {tx['payment_time']}", "%Y-%m-%d %H:%M:%S"
        )
        if abs((tx_dt - target_dt).total_seconds()) <= tolerance_minutes * 60:
            return tx
    return None


# ── Case C: LLM 환각 방어 (JSON 파싱 에러 → 500) ─────────────────────────────

class TestDiaryLlmGuard:
    """
    LLM이 깨진 JSON을 뱉거나 필수 키가 빠졌을 때
    HTTPException(500)이 정상 발생하는지 검증.
    """

    @pytest.mark.asyncio
    @patch("app.api.diary_generate._get_client")
    async def test_broken_json_raises_500(self, mock_get_client):
        """닫는 괄호가 없는 깨진 JSON → HTTPException 500"""
        mock_client = AsyncMock()
        mock_client.chat.completions.create.return_value = _mock_openai_response(
            '{ "title": "깨진 응답"'  # 닫는 } 없음
        )
        mock_get_client.return_value = mock_client

        req = DiaryRequest(item_name="아메리카노", price=1500, store_name="스타벅스")
        with pytest.raises(HTTPException) as exc_info:
            await generate_diary(req)

        assert exc_info.value.status_code == 500
        assert "파싱 실패" in exc_info.value.detail

    @pytest.mark.asyncio
    @patch("app.api.diary_generate._get_client")
    async def test_missing_diary_lines_key_raises_500(self, mock_get_client):
        """diary_lines 키 누락 → HTTPException 500 (KeyError 방어)"""
        mock_client = AsyncMock()
        mock_client.chat.completions.create.return_value = _mock_openai_response(
            json.dumps({"title": "제목만 있음"})  # diary_lines 없음
        )
        mock_get_client.return_value = mock_client

        req = DiaryRequest(item_name="아메리카노", price=1500)
        with pytest.raises(HTTPException) as exc_info:
            await generate_diary(req)

        assert exc_info.value.status_code == 500

    @pytest.mark.asyncio
    @patch("app.api.diary_generate._get_client")
    async def test_empty_content_raises_500(self, mock_get_client):
        """LLM이 빈 응답을 반환하면 HTTPException 500"""
        mock_client = AsyncMock()
        mock_client.chat.completions.create.return_value = _mock_openai_response("")
        mock_get_client.return_value = mock_client

        req = DiaryRequest(item_name="치킨", price=20000)
        with pytest.raises(HTTPException) as exc_info:
            await generate_diary(req)

        assert exc_info.value.status_code == 500

    # ── 정상 동작 검증 ────────────────────────────────────────────────────────

    @pytest.mark.asyncio
    @patch("app.api.diary_generate._get_client")
    async def test_valid_response_returns_diary(self, mock_get_client):
        """정상 JSON 응답 → DiaryResponse 반환"""
        mock_client = AsyncMock()
        mock_client.chat.completions.create.return_value = _mock_openai_response(
            json.dumps({
                "title": "1500원의 여유",
                "diary_lines": ["아메리카노 한 잔으로", "오늘 하루 버팀."],
            })
        )
        mock_get_client.return_value = mock_client

        req = DiaryRequest(
            item_name="아메리카노", price=1500, store_name="스타벅스", photo_count=1
        )
        result = await generate_diary(req)

        assert result.title == "1500원의 여유"
        assert len(result.diary_lines) == 2

    @pytest.mark.asyncio
    @patch("app.api.diary_generate._get_client")
    async def test_photo_count_1_injects_2_to_3_guide(self, mock_get_client):
        """photo_count=1 → system prompt에 '2~3개' 가이드가 주입돼야 함"""
        mock_client = AsyncMock()
        mock_client.chat.completions.create.return_value = _mock_openai_response(
            json.dumps({"title": "테스트", "diary_lines": ["줄1", "줄2"]})
        )
        mock_get_client.return_value = mock_client

        await generate_diary(DiaryRequest(item_name="커피", price=4500, photo_count=1))

        system_msg = mock_client.chat.completions.create.call_args.kwargs["messages"][0]["content"]
        assert "2~3개" in system_msg

    @pytest.mark.asyncio
    @patch("app.api.diary_generate._get_client")
    async def test_photo_count_3_injects_4_to_5_guide(self, mock_get_client):
        """photo_count=3 → system prompt에 '4~5개' 가이드가 주입돼야 함"""
        mock_client = AsyncMock()
        mock_client.chat.completions.create.return_value = _mock_openai_response(
            json.dumps({"title": "테스트", "diary_lines": ["줄1", "줄2", "줄3", "줄4"]})
        )
        mock_get_client.return_value = mock_client

        await generate_diary(DiaryRequest(item_name="치킨", price=20000, photo_count=3))

        system_msg = mock_client.chat.completions.create.call_args.kwargs["messages"][0]["content"]
        assert "4~5개" in system_msg

    @pytest.mark.asyncio
    @patch("app.api.diary_generate._get_client")
    async def test_photo_count_5_injects_6_to_8_guide(self, mock_get_client):
        """photo_count=5 → system prompt에 '6~8개' 가이드가 주입돼야 함"""
        mock_client = AsyncMock()
        mock_client.chat.completions.create.return_value = _mock_openai_response(
            json.dumps({"title": "테스트", "diary_lines": ["줄1", "줄2", "줄3", "줄4", "줄5", "줄6"]})
        )
        mock_get_client.return_value = mock_client

        await generate_diary(DiaryRequest(item_name="자켓", price=89000, photo_count=5))

        system_msg = mock_client.chat.completions.create.call_args.kwargs["messages"][0]["content"]
        assert "6~8개" in system_msg


# ── 실제 통합 테스트 (실제 API 키 필요, 비용 발생) ───────────────────────────

@pytest.mark.skip(reason="실제 OpenAI API 호출. 수동 실행 시 -m integration 으로 실행")
class TestIntegration:
    """
    실제 OpenAI API를 호출하는 통합 테스트.

    실행 방법:
        pytest test_pipeline.py::TestIntegration -v -s

    사전 조건:
        - .env 파일에 OPENAI_API_KEY 설정 필요
        - 통합 테스트용 sample.jpg 파일을 fastapi/ 디렉터리에 배치
    """

    @pytest.mark.asyncio
    async def test_real_vlm_with_image_file(self):
        import os
        from dotenv import load_dotenv
        load_dotenv("../.env")

        img_path = "sample.jpg"
        if not os.path.exists(img_path):
            pytest.skip("sample.jpg 없음 — fastapi/ 디렉터리에 테스트 이미지를 배치하세요")

        with open(img_path, "rb") as f:
            image_bytes = f.read()

        result = await analyze_image("sample.jpg", image_bytes)

        print(f"\n[통합] VLM 결과: {json.dumps(result, ensure_ascii=False, indent=2)}")
        assert "error" not in result, f"VLM 분석 실패: {result.get('error')}"
        assert "category" in result

    @pytest.mark.asyncio
    async def test_real_diary_generation(self):
        import os
        from dotenv import load_dotenv
        load_dotenv("../.env")

        req = DiaryRequest(
            item_name="아이스 아메리카노",
            category="카페/디저트",
            price=5900,
            store_name="스타벅스",
            mood="☺️",
            emotion_text="오늘 회의 버텼음",
            group_description="직장인 소비 모임",
            photo_count=2,
        )
        result = await generate_diary(req)

        print(f"\n[통합] 제목: {result.title}")
        print(f"[통합] 일기:\n" + "\n".join(f"  {line}" for line in result.diary_lines))
        assert result.title
        assert 2 <= len(result.diary_lines) <= 5, "photo_count=2 → 4~5줄 범위여야 함"