# app/api/mapping.py
import json
from openai import AsyncOpenAI
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from app.core.config import settings
from app.api.vlm import reverse_geocode
from langsmith import traceable
from datetime import datetime, timedelta

router = APIRouter()

class VlmData(BaseModel):
    category: Optional[str] = None
    item_name: Optional[str] = None
    price_estimate: Optional[float] = None
    store_type: Optional[str] = None
    store_name: Optional[str] = None
    description: Optional[str] = None
    taken_at: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class TransactionCandidate(BaseModel):
    payment_id: int
    payment_out: Optional[int] = None
    payment_time: Optional[str] = None
    payment_place: Optional[str] = None
    payment_category: Optional[str] = None
    payment_address: Optional[str] = None

class MappingRequest(BaseModel):
    photo_id: int
    user_id: int
    vlm_data: VlmData
    candidates: List[TransactionCandidate]

class MappingResponse(BaseModel):
    payment_id: Optional[int] = None
    reason: Optional[str] = None

MAPPING_PROMPT = """너는 소비 사진과 결제 내역을 매핑하는 AI야.

아래 사진 분석 결과와 결제 후보 목록을 보고, 가장 적합한 결제 내역 1개를 선택해줘.

[사진 분석 결과]
- 카테고리: {category}
- 품목: {item_name}
- 사진 설명: {description} ← 사진에서 직접 추출한 정보이므로 매핑 판단 시 적극 활용
- 추정 금액: {price_estimate}원 (※ 추정값이므로 실제와 다를 수 있음)
- 가게 유형: {store_type}
- 가게명: {store_name}
- 촬영 시각: {taken_at}
- 촬영 위치: {location}

[결제 후보 목록]
{candidates}

[카테고리 대응 관계]
- 요식업 → 한식, 중식, 양식, 일식, 분식, 패스트푸드, 치킨, 피자, 버거, 고기, 해산물 등 식당 관련 결제 포함
- 카페/디저트 → 커피전문점, 카페, 제과점, 베이커리, 아이스크림 등 포함
- 유통/마트 → 대형마트, 슈퍼마켓, 편의점, 백화점 등 포함
- 편의점 → 편의점, 슈퍼 등 포함
- 교통 → 주유소, 대중교통, 택시, 주차, 고속도로 등 포함
- 문화/레져 → 영화관, 공연, 스포츠, 게임, 놀이공원 등 포함
- 의류/잡화 → 옷, 신발, 가방, 액세서리, 화장품 등 포함
- 보건/의료 → 병원, 약국, 헬스, 뷰티 등 포함
- 기타 → 위 카테고리에 해당하지 않는 결제

[매핑 판단 방법]
각 결제 후보에 대해 아래 항목을 평가하고, 종합 점수가 가장 높은 결제 1개를 선택해줘.

- 카테고리/가게 유형 일치 여부 (35점) — 위 카테고리 대응 관계 참고
- 사진 설명과 결제 장소/품목의 연관성 (25점) — 사진 설명을 적극 활용해 장소명, 음식명, 상황을 결제 내역과 비교
- 촬영 시각과 결제 시간의 근접도 (25점)
- 촬영 위치와 결제 장소/주소의 유사도 (10점)
- 금액 유사도 — 추정값이므로 2배 이내 차이면 허용 (5점)

종합 점수가 50점 미만이면 매핑하지 않고 null을 반환해.

규칙:
- 반드시 아래 JSON 형식으로만 응답해
- payment_id는 반드시 후보 목록에 있는 값만 사용

{{
  "payment_id": 숫자 또는 null,
  "reason": "선택 이유 한 줄"
}}"""


def _get_client() -> AsyncOpenAI:
    if not settings.OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY가 설정되지 않았습니다.")
    return AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


def _to_kst(taken_at: Optional[str]) -> Optional[str]:
    """DB에 UTC로 저장된 taken_at을 KST(-9시간)로 변환 -> 이후 db에 애초에 kst 시간으로 저장하도록 수정 에정"""
    if not taken_at:
        return None
    try:
        dt = datetime.fromisoformat(taken_at) - timedelta(hours=9)
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return taken_at


@router.post("/match", response_model=MappingResponse)
@traceable(name="사진-결제 매핑")
async def match_photo_to_transaction(req: MappingRequest):
    if not req.candidates:
        return MappingResponse(payment_id=None, reason="결제 후보 없음")

    client = _get_client()

    # 위도경도 → 주소 변환
    location = "알 수 없음"
    if req.vlm_data.latitude and req.vlm_data.longitude:
        address = reverse_geocode(req.vlm_data.latitude, req.vlm_data.longitude)
        if address:
            location = address

    # taken_at UTC → KST 변환
    taken_at_kst = _to_kst(req.vlm_data.taken_at) or "알 수 없음"

    # 후보 목록 텍스트 변환
    candidates_text = "\n".join([
        f"- payment_id: {c.payment_id}, 금액: {c.payment_out}원, "
        f"시간: {c.payment_time}, 장소: {c.payment_place}, "
        f"카테고리: {c.payment_category}, 주소: {c.payment_address}"
        for c in req.candidates
    ])

    prompt = MAPPING_PROMPT.format(
        category=req.vlm_data.category or "알 수 없음",
        item_name=req.vlm_data.item_name or "알 수 없음",
        price_estimate=int(req.vlm_data.price_estimate) if req.vlm_data.price_estimate else 0,
        store_type=req.vlm_data.store_type or "알 수 없음",
        store_name=req.vlm_data.store_name or "알 수 없음",
        description=req.vlm_data.description or "",
        taken_at=taken_at_kst,
        location=location,
        candidates=candidates_text,
    )

    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0.1,
        max_tokens=200,
    )

    content = response.choices[0].message.content
    if not content:
        return MappingResponse(payment_id=None, reason="LLM 응답 없음")

    try:
        data = json.loads(content)
        payment_id = data.get("payment_id")
        reason = data.get("reason")

        if payment_id is not None:
            try:
                payment_id = int(payment_id)
            except (ValueError, TypeError):
                payment_id = None

        valid_ids = {c.payment_id for c in req.candidates}

        if payment_id not in valid_ids:
            payment_id = None
            reason = "유효하지 않은 payment_id"

        print(f"[매핑 결과] photo_id={req.photo_id} → payment_id={payment_id} | taken_at_kst={taken_at_kst} | {reason}")

        return MappingResponse(payment_id=payment_id, reason=reason)
    except json.JSONDecodeError:
        return MappingResponse(payment_id=None, reason="파싱 실패")