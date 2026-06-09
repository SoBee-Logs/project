import base64
import io
import json
import os
import urllib.request
import time

from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS
from google import genai
from google.genai import types
from fastapi import APIRouter, HTTPException, UploadFile, File

from app.core.config import settings
from app.core.prompt_store import register, get_prompt

router = APIRouter()

EXTRACTION_PROMPT = """이 사진을 분석해서 소비 정보를 추출해줘.

반드시 아래 JSON 형식으로만 응답해. 다른 텍스트는 절대 포함하지 마.

{
    "category": "식비 | 카페간식 | 온라인쇼핑 | 패션쇼핑 | 교통 | 여행숙박 | 문화여가 | 술유흥 | 의료건강 | 뷰티미용 | 주거통신 | 교육학습 | 금융 | 경조선물 | 생활 | 기타",
    "item_name": "품목 또는 메뉴 이름",
    "price": 숫자만 원단위,
    "location_type": "식당 | 카페 | 마트 | 편의점 | 온라인 등",
    "store_name": "가게 이름 또는 null",
    "description": "사진 한 줄 설명",
    "confidence": "high | medium | low",
    "reasoning": "판단 근거 한 문장",
    "groups": [
        {   
            "group_id": 1,
            "store": "가게명 또는 null",
            "category": "카테고리",
            "items": ["품목1", "품목2"],
            "price": 합산금액
        }
    ]
}

카테고리 기준:
- 식비: 식당, 분식, 패스트푸드, 배달, 편의점 도시락/삼각김밥, 해산물 요리, 과일
- 카페간식: 카페 음료, 베이커리, 디저트, 편의점 과자/스낵, 호떡/붕어빵 등 길거리 음식
- 패션쇼핑: 옷, 신발, 가방, 액세서리 (인형 제외)
- 교통: 지하철, 버스, 택시, 기차, 주유
- 여행숙박: 항공권, 숙박, 면세점, 해외결제
- 문화여가: 영화, 공연, 스키장, 놀이공원, 노래방, PC방, 인형뽑기, 완구류(피규어/키링/장난감)
- 술유흥: 술집, 바, 와인/맥주/소주 구매
- 의료건강: 병원, 약국, 안경, 영양제
- 뷰티미용: 미용실, 네일샵, 화장품
- 교육학습: 학원, 교재, 책, 스터디카페
- 금융: 증권/투자, 보험, 복권
- 경조선물: 경조사비, 선물, 꽃다발
- 생활: 마트, 생활용품
- 기타: 동물, 자연, 풍경 등 소비 없는 사진
- 음식처럼 보이지만 실제로는 음식 모양 굿즈(그립톡, 자석, 키링 등)일 수 있으니 포장재, 재질, 맥락을 꼼꼼히 확인해줘
- 굿즈샵, 소품샵 맥락이 보이면 음식이 아닌 문화여가로 분류해줘

아래는 올바른 분류 예시야 (사진 내용 → 올바른 카테고리):
[식비]
- 대게, 랍스터 등 해산물 요리 → 식비 (고급 식당 음식)
- 과일(딸기, 수박 등) 한 접시/한 팩 → 식비 (식재료)
[카페간식]
- 편의점 과자/스낵 → 카페간식
- 호떡, 붕어빵, 길거리 음식 → 카페간식
[문화여가]
- 불꽃놀이, 축제, 공연 현장 사진 → 문화여가
- 인형뽑기, 뽑기방 → 문화여가
- 완구류(피규어, 장난감, 볼펜 등 캐릭터 상품) → 문화여가
[패션쇼핑]
- 인형은 패션쇼핑 아님 → 문화여가 또는 기타
[교육학습]
- 학원, 독서실, 교재, 책, 스터디카페 → 교육학습

groups 규칙:
- 카테고리가 다른 품목은 별도 group으로 분리하기
- 같은 가게 품목은 하나의 group으로 묶기 (예를 들어 편의점에서 산 것으로 추정되면 카테고리 달라도 같은 group)
- 가게가 다르거나 불분명하면 반드시 별도 group으로 분리하기
- 브랜드/로고로 가게 추정 가능하면 store에 입력
- 소비 없는 사진은 groups 빈 배열
- groups price 합산 = 전체 price
- 카페에서 음료 + 빵/디저트를 함께 구매한 것으로 보이면 반드시 같은 group으로 묶기
- 사진 속 같은 품목이 여러 개 보이면 개수 × 단가로 계산해줘

2025~2026년 시세:
- 아메리카노: 저가 2000원 / 일반 4500~6000원
- 카페 음료: 5000~7000원 / 식당 한 끼: 9000~15000원
- 치킨: 20000~25000원 / 디저트: 5000~12000원
- 지하철/버스: 1500~1550원 / 택시 평균: 10000~15000원
- 영화표: 14000~20000원
- 병원: 10000~20000원
- 약국(처방전 없이): 3000~15000원
- 우산: 일반 8000~15000원
- 인형뽑기: 1회 1000~2000원 / 여러 번 도전 5000~15000원
- 편의점 간식: 1000~3000원
- 옷(일반): 20000~50000원 / 브랜드: 70000~200000원
- 화장품: "올리브영 PB/일반 브랜드: 15000~30000원, 맥/나스/헤라 등 고가: 30000~80000원, 샤넬/딥디크 등 럭셔리: 50000~200000원"

규칙:
- category 반드시 1개 선택. 소비 없는 사진도 기타로 선택
- secondary_category: 서로 다른 카테고리 품목이 함께 있을 때만 입력, 없으면 null
- 가격은 2025~2026년 시세로 반드시 추정. 소비 없는 사진만 0
- 상품이나 물건이 찍혀 있으면 무조건 소비로 보고 가격 추정해줘
- 사진에 여러 품목이 있으면 전체 합산해서 price 반환
- 가격 추정 시 보수적으로 추정해줘. 불확실하면 정말 평균적인 가격으로.
- 사진 불명확해도 최대한 추정. null/빈값 금지
- JSON만 출력"""

register("vlm_extraction", EXTRACTION_PROMPT)


def _get_client():
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY가 설정되지 않았습니다.")
    return genai.Client(api_key=api_key)


def _convert_to_jpeg_if_needed(filename: str, image_bytes: bytes) -> tuple[bytes, str]:
    ext = filename.lower().rsplit(".", 1)[-1]
    if ext in ("heic", "heif"):
        try:
            import pillow_heif
            pillow_heif.register_heif_opener()
            img = Image.open(io.BytesIO(image_bytes))
            buf = io.BytesIO()
            # HEIC → JPEG 변환 시 EXIF 메타데이터 보존 (taken_at, gps 손실 방지)
            exif_data = img.info.get("exif", b"")
            img.convert("RGB").save(buf, format="JPEG", exif=exif_data)
            return buf.getvalue(), "converted.jpg"
        except Exception:
            raise HTTPException(status_code=400, detail="HEIC 변환 실패. JPEG/PNG로 다시 시도해주세요.")
    return image_bytes, filename


def _convert_gps_to_decimal(coords, ref) -> float | None:
    if not coords or not ref:
        return None
    try:
        degrees = float(coords[0])
        minutes = float(coords[1])
        seconds = float(coords[2])
        decimal = degrees + minutes / 60 + seconds / 3600
        if ref in ("S", "W"):
            decimal = -decimal
        return round(decimal, 6)
    except (TypeError, IndexError, ValueError):
        return None


def extract_exif(image_bytes: bytes) -> dict:
    try:
        img = Image.open(io.BytesIO(image_bytes))
        exif_data = img._getexif()
    except Exception:
        return {"datetime": None, "gps": None}

    if not exif_data:
        return {"datetime": None, "gps": None}

    result = {"datetime": None, "gps": None}

    datetime_original = None
    offset_original = None

    for tag_id, value in exif_data.items():
        tag_name = TAGS.get(tag_id, tag_id)
        if tag_name == "DateTimeOriginal":
            datetime_original = value.replace(":", "-", 2)
        elif tag_name == "OffsetTimeOriginal":
            offset_original = value

    if datetime_original:
        result["datetime"] = f"{datetime_original}{offset_original}" if offset_original else datetime_original

    for tag_id, value in exif_data.items():
        tag_name = TAGS.get(tag_id, tag_id)
        if tag_name == "GPSInfo":
            gps_info = {GPSTAGS.get(k, k): v for k, v in value.items()}
            lat = _convert_gps_to_decimal(gps_info.get("GPSLatitude"), gps_info.get("GPSLatitudeRef"))
            lon = _convert_gps_to_decimal(gps_info.get("GPSLongitude"), gps_info.get("GPSLongitudeRef"))
            if lat is not None and lon is not None:
                result["gps"] = {"latitude": lat, "longitude": lon}
            break

    return result


def reverse_geocode(lat: float, lon: float) -> str | None:
    try:
        url = (
            f"https://nominatim.openstreetmap.org/reverse?"
            f"lat={lat}&lon={lon}&format=json&accept-language=ko"
        )
        req = urllib.request.Request(url, headers={"User-Agent": "SoBee-VLM/1.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            return data.get("display_name")
    except Exception:
        return None


def _get_mime_type(filename: str) -> str:
    ext = filename.lower().rsplit(".", 1)[-1]
    return {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}.get(ext, "image/jpeg")


async def _analyze_with_gemini(client, image_bytes: bytes, mime_type: str, max_retries: int = 2) -> dict:
    image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)

    for attempt in range(max_retries):
        try:
            start = time.time()
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[image_part, get_prompt("vlm_extraction")],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.1,
                    thinking_config=types.ThinkingConfig(
                        thinking_budget=0
                    ),
                ),
            )
            elapsed = time.time() - start
            print(f"[Gemini] 응답시간: {elapsed:.2f}s | attempt={attempt+1}")

            content = response.text
            if not content:
                return {"error": "Gemini 응답이 비어있습니다."}

            try:
                cleaned = content.strip()
                if cleaned.startswith("```"):
                    cleaned = cleaned.split("```")[1]
                    if cleaned.startswith("json"):
                        cleaned = cleaned[4:]
                result = json.loads(cleaned.strip())
                result["_elapsed_ms"] = round(elapsed * 1000)
                return result
            except json.JSONDecodeError:
                return {"error": "JSON 파싱 실패", "raw_response": content[:200]}

        except Exception as e:
            if attempt < max_retries - 1:
                print(f"[Gemini] 오류 발생 (attempt={attempt+1}), 3초 후 재시도: {e}")
                time.sleep(3)
                continue
            print(f"[Gemini] 최종 실패: {e}")
            return {"error": f"Gemini 호출 실패: {str(e)}"}


# exif 파라미터 추가 — 엔드포인트에서 원본 EXIF를 미리 추출해서 넘겨줌
async def analyze_image(filename: str, image_bytes: bytes, exif: dict = None) -> dict:
    client = _get_client()

    # exif가 없으면 직접 추출
    if exif is None:
        exif = extract_exif(image_bytes)

    address = None
    if exif["gps"]:
        address = reverse_geocode(exif["gps"]["latitude"], exif["gps"]["longitude"])

    # 추가: 이미지 리사이즈 (전송 크기 줄여서 속도 개선)
    try:
        img = Image.open(io.BytesIO(image_bytes))
        img.thumbnail((768 , 768))
        buf = io.BytesIO()
        img.convert("RGB").save(buf, format="JPEG", quality=85)
        image_bytes = buf.getvalue()
        filename = "resized.jpg"
    except Exception:
        pass  # 리사이즈 실패 시 원본 사용

    mime_type = _get_mime_type(filename)
    vlm_result = await _analyze_with_gemini(client, image_bytes, mime_type)

    return {
        "file": filename,
        "taken_at": exif["datetime"],
        "gps": exif["gps"],
        "address": address,
        **vlm_result,
    }


@router.post("/analyze")
async def analyze_image_endpoint(image: UploadFile = File(...)):
    image_bytes = await image.read()
    filename = image.filename or "image.jpg"
    # HEIC는 변환 후에 EXIF 추출해야 함
    image_bytes, filename = _convert_to_jpeg_if_needed(filename, image_bytes)
    exif = extract_exif(image_bytes)  # 변환 후 추출
    return await analyze_image(filename, image_bytes, exif)

    