import base64
import io
import json
import urllib.request

from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS
from openai import AsyncOpenAI
from fastapi import APIRouter, HTTPException, UploadFile, File

from app.core.config import settings

# /api/vlm 하위 경로를 담당하는 라우터 (main.py에서 prefix로 /api/vlm 붙임)
router = APIRouter()


EXTRACTION_PROMPT = """이 사진을 분석해서 소비 정보를 추출해줘.

반드시 아래 JSON 형식으로만 응답해. 다른 텍스트는 절대 포함하지 마.

{
    "category": "식비 | 카페간식 | 온라인쇼핑 | 패션쇼핑 | 교통 | 여행숙박 | 문화여가 | 술유흥 | 의료건강 | 뷰티미용 | 주거통신 | 교육학습 | 금융 | 경조선물 | 생활 | 기타",
    "secondary_category": "",
    "item_name": "품목 또는 메뉴 이름",
    "price": 금액(숫자만, 원 단위. 알 수 없으면 2025~2026년 한국 최신 시세로 반드시 추정),
    "location_type": "장소 유형 (식당, 카페, 마트, 편의점, 온라인 등)",
    "store_name": "가게 이름 (알 수 없으면 null)",
    "description": "사진에 대한 한 줄 설명",
    "confidence": "high | medium | low",
    "reasoning": "카테고리와 가격을 이렇게 판단한 이유를 한 문장으로"
}

카테고리 분류 기준:
- 식비: 한식, 일식, 양식, 중식 등 일반 음식점. 식당, 분식집, 패스트푸드, 배달음식 등 식사 목적의 소비. 편의점 도시락/삼각김밥도 식비
- 카페간식: 커피전문점, 베이커리, 디저트, 편의점 간식 등. 카페/디저트 전문점의 음료(커피, 라떼, 에이드), 케이크, 빵, 마카롱, 크로플, 디저트 등. 카페나 베이커리에서 구매한 것은 반드시 카페간식
- 온라인쇼핑: 쿠팡, 11번가, 지그재그 등 인터넷 쇼핑몰
- 패션쇼핑:  화장품 외 일반 쇼핑. 옷, 신발, 가방, 액세서리 등 (소품샵에서 산 피규어도 포함)
- 교통: 택시, 버스, 지하철, 고속버스, 철도, 주유, 주차 등 이동 수단
- 여행숙박: 항공권, 숙박, 여행사, 면세점, 해외 결제. 호텔, 펜션, 리조트 등
- 문화여가: 영화, 공연, 도서, OTT 구독, 게임, 노래방, PC방, 스포츠, 놀이공원, 스키장, 완구점, 인형뽑기 등 여가 활동
- 술유흥: 주점, 술집, 바, 클럽 등. 와인/맥주/소주 구매도 포함
- 의료건강: 병원, 약국, 안경, 건강검진. 영양제, 의료용품 등
- 뷰티미용: 미용실, 네일샵, 피부과(미용), 마사지. 화장품, 피부관리 등
- 주거통신: 관리비, 공과금, 휴대폰/인터넷 요금
- 교육학습: 학원, 인강, 교재, 스터디카페, 자격증
- 금융: 수수료, 증권/투자, 보험료, 협회비 등 금융 관련 소비
- 경조선물: 선물하기, 상품권, 경조사비, 후원, 결혼식, 장례식, 생일 등 경조사 관련 지출
- 생활: 편의점, 마트, 생활용품 등 일상적 지출 (일상 생활에 필요한 지출)
- 기타: 위 카테고리에 해당하지 않거나 소비일 확률이 없는 사진 (동물, 자연 사진 등)
- '스터디' 글자가 포함되면 교육학습 카테고리로 분류

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
- 완구류(피규어, 키링, 그립톡, 자석, 장난감, 볼펜 등 캐릭터 상품) → 문화여가
- 전시 작품, 공연장, 영화관, 티켓, 입장권, 행사장 내부처럼 문화 활동 소비 맥락이 명확 → 문화여가
[패션쇼핑]
- 인형은 패션쇼핑 아님 → 문화여가 또는 기타
[교육학습]
- 학원, 독서실, 교재, 책, 스터디카페 → 교육학습
[기타]
- 강아지, 고양이 등 동물 사진 → 기타 (소비 없음)
- 바위, 바다, 하늘 등 자연/풍경 사진 → 기타 (소비 없음)
[금융]
- 주식 앱 화면, 정기예금 화면 → 금융

카테고리 혼합 규칙:
- category는 대표 소비 카테고리 1개를 반드시 선택한다.
- secondary_category는 사진 안에 서로 다른 소비 목적의 품목이 명확히 함께 있을 때만 입력한다.
- secondary_category가 없으면 null로 반환한다.
- 단순히 음식 종류가 여러 개 있는 것은 혼합 카테고리가 아니다. 모두 식사 목적이면 category는 식비 하나만 선택한다.
- 카페 음료와 디저트가 함께 있으면 category는 카페간식 하나만 선택한다.
- 뷰티/패션/문화여가 등 비식품 소비와 음식이 함께 있으면 주된 피사체를 category로, 부수적으로 보이는 소비를 secondary_category로 설정한다.

2025~2026년 한국 최신 시세 기준:
-대표 시세:
- 아메리카노: 저가(메가, 컴포즈 등) 2000원, 일반 4500~6000원
- 카페 음료: 5000~7000원
- 식당 한 끼: 9000~15000원
- 편의점 도시락: 4000~6000원
- 디저트/케이크: 5000~12000원
- 치킨: 20000~25000원
- 영화표: 14000~15000원
- 택시 평균: 10000~15000원
- 지하철/버스: 1500~1550원
- 병원: 링겔 사진 있을 시 50000~100000원 / 보통(동네 병원) 10000~20000원

중요 규칙:
- category는 반드시 하나만 선택하되 무조건 결과가 나오게 해줘.
- category 불확실하면, item_name을 보고 추정해줘.
- 영수증이면 금액을 정확히 읽어줘
- price는 사진 속 소비 품목 전체의 합산 추정액을 반환한다.
- category와 secondary_category가 함께 있는 경우에도 price는 전체 합산 금액으로 반환한다.
- 가격은 반드시 2025~2026년 최신 시세 기준으로 추정해줘. 절대 0을 반환하지 마.
- 대신 소비가 아닌 것으로 추정되는 사진(동물, 자연, 풍경)은 price를 0으로 반환해줘.
- 사진에 여러 품목이 있을 경우 모든 품목의 추정 가격을 합산해서 price에 반환해줘.
- 가격 시세 목록에 없는 품목이라도 반드시 한국 시세로 추정해서 반환해줘.
- 사진이 흐리거나 불명확해도 최대한 추정해서 결과를 반환해줘. 절대 null이나 빈값 반환 금지.
- confidence는 추정 확신도야. 영수증처럼 명확하면 high, 사진으로 추정하면 medium, 불명확하면 low
- reasoning은 꼭 포함해줘.
- JSON만 출력해"""



def _get_client() -> AsyncOpenAI:
    if not settings.OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY가 설정되지 않았습니다.")
    return AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

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


async def _analyze_with_openai(client: AsyncOpenAI, image_bytes: bytes, mime_type: str) -> dict:
    b64 = base64.b64encode(image_bytes).decode()

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{mime_type};base64,{b64}"},
                    },
                    {"type": "text", "text": EXTRACTION_PROMPT},
                ],
            }
        ],
        response_format={"type": "json_object"},
        max_tokens=1000,
        temperature=0.1,
    )

    content = response.choices[0].message.content
    if not content:
        return {"error": "OpenAI 응답이 비어있습니다."}

    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return {"error": "JSON 파싱 실패", "raw_response": content[:200]}


# exif 파라미터 추가 — 엔드포인트에서 원본 EXIF를 미리 추출해서 넘겨줌
async def analyze_image(filename: str, image_bytes: bytes, exif: dict = None) -> dict:
    client = _get_client()

    # exif가 없으면 직접 추출 (일반 JPEG/PNG 케이스)
    if exif is None:
        exif = extract_exif(image_bytes)

    address = None
    if exif["gps"]:
        address = reverse_geocode(exif["gps"]["latitude"], exif["gps"]["longitude"])

    mime_type = _get_mime_type(filename)
    vlm_result = await _analyze_with_openai(client, image_bytes, mime_type)

    return {
        "file": filename,
        "taken_at": exif["datetime"],
        "gps": exif["gps"],
        "address": address,
        **vlm_result,
    }


# POST /api/vlm/analyze — 이미지 파일을 받아 GPT-4o로 소비 정보를 분석하는 엔드포인트
@router.post("/analyze")
async def analyze_image_endpoint(image: UploadFile = File(...)):
    image_bytes = await image.read()
    filename = image.filename or "image.jpg"
    # HEIC는 변환 후에 EXIF 추출해야 함
    image_bytes, filename = _convert_to_jpeg_if_needed(filename, image_bytes)
    exif = extract_exif(image_bytes)  # 변환 후 추출
    return await analyze_image(filename, image_bytes, exif)

    