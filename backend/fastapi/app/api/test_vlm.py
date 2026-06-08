import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from app.api.vlm import (
    extract_exif,
    _convert_gps_to_decimal,
    _get_mime_type,
    _analyze_with_gemini,
)

# 1. MIME 타입 변환 테스트
def test_get_mime_type_jpeg():
    assert _get_mime_type("photo.jpg") == "image/jpeg"

def test_get_mime_type_png():
    assert _get_mime_type("photo.png") == "image/png"

def test_get_mime_type_unknown():
    assert _get_mime_type("photo.bmp") == "image/jpeg"  # 기본값

# 2. GPS 변환 테스트
def test_gps_to_decimal_north():
    result = _convert_gps_to_decimal((37, 30, 0), "N")
    assert result == pytest.approx(37.5, 0.01)

def test_gps_to_decimal_south():
    result = _convert_gps_to_decimal((37, 30, 0), "S")
    assert result == pytest.approx(-37.5, 0.01)

def test_gps_to_decimal_invalid():
    result = _convert_gps_to_decimal(None, None)
    assert result is None

# 3. EXIF 추출 테스트 — 빈 이미지
def test_extract_exif_invalid_bytes():
    result = extract_exif(b"invalid")
    assert result == {"datetime": None, "gps": None}

# 4. Gemini 응답 파싱 테스트
@pytest.mark.asyncio
async def test_analyze_with_gemini_success():
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.text = '{"category": "카페간식", "price": 5000}'
    mock_client.models.generate_content = MagicMock(return_value=mock_response)

    result = await _analyze_with_gemini(mock_client, b"fake_image", "image/jpeg")

    assert result["category"] == "카페간식"
    assert result["price"] == 5000
    assert "_elapsed_ms" in result

# 5. Gemini 응답이 비었을 때
@pytest.mark.asyncio
async def test_analyze_with_gemini_empty_response():
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.text = ""
    mock_client.models.generate_content = MagicMock(return_value=mock_response)

    result = await _analyze_with_gemini(mock_client, b"fake_image", "image/jpeg")
    assert "error" in result

# 6. JSON 파싱 실패할 때
@pytest.mark.asyncio
async def test_analyze_with_gemini_invalid_json():
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.text = "이건 JSON이 아님"
    mock_client.models.generate_content = MagicMock(return_value=mock_response)

    result = await _analyze_with_gemini(mock_client, b"fake_image", "image/jpeg")
    assert result["error"] == "JSON 파싱 실패"