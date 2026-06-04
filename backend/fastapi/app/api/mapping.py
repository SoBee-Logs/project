# app/api/mapping.py
import json
from openai import AsyncOpenAI
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from app.core.config import settings
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
    store_address: Optional[str] = None

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
후보는 촬영시각과의 시간 차이 오름차순으로 정렬되어 있음.
{candidates}

[카테고리 대응 관계]
- 요식업 → 한식, 중식, 양식, 일식, 분식, 패스트푸드, 치킨, 피자, 버거, 고기, 해산물 등 식당 관련 결제 포함
- 카페/디저트 → 커피전문점, 카페, 제과점, 베이커리, 아이스크림 등 포함
- 유통/마트 → 대형마트, 슈퍼마켓, 편의점, 백화점 등 포함
- 편의점 → 편의점, 슈퍼 등 포함
- 교통 → 주유소, 대중교통, 택시, 주차, 고속도로 등 포함
- 문화/레져 → 영화관, 공연, 스포츠, 게임, 놀이공원, 동물원, 테마파크, 키즈카페, 실내동물카페 등 포함
- 의류/잡화 → 옷, 신발, 가방, 액세서리, 화장품 등 포함
- 보건/의료 → 병원, 약국, 헬스, 뷰티 등 포함
- 기타 → 위 카테고리에 해당하지 않는 결제

[매핑 판단 방법]
아래 기준을 종합적으로 고려해서 가장 적합한 결제 1개를 선택해.

1. 가게명 일치 (최우선)
   가게명이 있으면 후보 목록의 payment_place와 비교해.
   일치하거나 포함 관계면 강하게 우선 고려해.

2. 사진 설명과 결제 장소의 연관성 (핵심)
   사진 설명, 품목명, 가게 유형을 결제 장소명과 적극 비교해.
   메뉴명, 업종, 분위기가 장소명과 연관되면 높게 평가해.
   payment_category는 카드사 오분류가 많으니 무시하고 장소명 위주로 판단해.

3. 시간 근접도
   후보 목록에 표시된 시간 차이 값을 그대로 읽어. 절대 직접 계산하지 말 것.
   시간이 가까울수록 우선 고려해.
   동일 가맹점이 여러 개면 시간이 가장 가까운 걸 선택해.

4. 위치 유사도
   촬영 위치와 결제 장소 주소의 도로명, 동 이름이 일치하면 높게 평가해.

위 기준을 종합해서 적합한 후보가 없으면 null을 반환해.

규칙:
- 반드시 아래 JSON 형식으로만 응답해
- payment_id는 반드시 아래 목록에 있는 값만 사용: {valid_ids}
- 위 목록에 없는 숫자는 절대 사용하지 말 것

{{
  "payment_id": 숫자 또는 null,
  "reason": "선택 이유 한 줄"
}}"""


def _get_client() -> AsyncOpenAI:
    if not settings.OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY가 설정되지 않았습니다.")
    return AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


def _time_diff_str(taken_at_kst: str, payment_time: Optional[str]) -> str:
    """촬영시각과 결제시간 차이를 문자열로 반환"""
    try:
        t1 = datetime.strptime(taken_at_kst[:19], "%Y-%m-%d %H:%M:%S")
        t2 = datetime.strptime(payment_time[:19], "%Y-%m-%d %H:%M:%S")
        diff = abs(int((t1 - t2).total_seconds() / 60))
        if diff < 60:
            return f"{diff}분 차이"
        else:
            return f"{diff // 60}시간 {diff % 60}분 차이"
    except Exception:
        return "알 수 없음"


def _to_kst(taken_at: Optional[str]) -> Optional[str]:
    """DB에 UTC로 저장된 taken_at을 KST(-9시간)로 변환"""
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

    # 촬영 위치 (store_address 직접 사용)
    location = req.vlm_data.store_address or "알 수 없음"

    # taken_at (DB에 KST로 저장되어 있으므로 변환 없이 그대로 사용)
    taken_at_kst = req.vlm_data.taken_at or "알 수 없음"

    # 후보 목록 시간 차이 오름차순 정렬
    def _diff_minutes(c) -> int:
        try:
            t1 = datetime.strptime(taken_at_kst[:19], "%Y-%m-%d %H:%M:%S")
            t2 = datetime.strptime(c.payment_time[:19], "%Y-%m-%d %H:%M:%S")
            return abs(int((t1 - t2).total_seconds() / 60))
        except Exception:
            return 99999

    sorted_candidates = sorted(req.candidates, key=_diff_minutes)

    candidates_text = "\n".join([
        f"- payment_id: {c.payment_id}, 금액: {c.payment_out}원, "
        f"시간: {c.payment_time} (촬영시각과 {_time_diff_str(taken_at_kst, c.payment_time)}), "
        f"장소: {c.payment_place}, 카테고리: {c.payment_category}, 주소: {c.payment_address}"
        for c in sorted_candidates
    ])

    valid_ids = [c.payment_id for c in req.candidates]

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
        valid_ids=valid_ids,
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

        candidate_ids = {c.payment_id for c in req.candidates}

        if payment_id not in candidate_ids:
            payment_id = None
            reason = "유효하지 않은 payment_id"

        print(f"[매핑 결과] photo_id={req.photo_id} → payment_id={payment_id} | taken_at_kst={taken_at_kst} | {reason}")

        return MappingResponse(payment_id=payment_id, reason=reason)
    except json.JSONDecodeError:
        return MappingResponse(payment_id=None, reason="파싱 실패")