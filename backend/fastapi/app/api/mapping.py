# app/api/mapping.py
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from app.core.config import settings
from app.core.prompt_store import register, get_prompt
from langsmith import traceable, get_current_run_tree
from datetime import datetime, timedelta
from langsmith.wrappers import wrap_openai
from openai import OpenAI  # AsyncOpenAI → OpenAI로 변경

router = APIRouter()

class VlmGroup(BaseModel):
    group_id: Optional[int] = None
    store: Optional[str] = None
    category: Optional[str] = None
    items: Optional[List[str]] = None
    price: Optional[float] = None

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
    taken_at: Optional[str] = None
    location: Optional[str] = None
    groups: List[VlmGroup]
    candidates: List[TransactionCandidate]

class MappingResponse(BaseModel):
    group_id: Optional[int] = None
    payment_id: Optional[int] = None
    reason: Optional[str] = None

from app.core.prompt_store import register, get_prompt

GROUP_MAPPING_PROMPT = """너는 소비 사진의 특정 그룹과 결제 내역을 매핑하는 AI야.

[매핑 대상 그룹]
- 그룹 ID: {group_id}
- 가게명: {store}
- 카테고리: {category}
- 품목: {items}
- 금액: {price}원
- 촬영 시각: {taken_at}
- 촬영 위치: {location}

[결제 후보 목록]
후보는 촬영시각과의 시간 차이 오름차순으로 정렬되어 있음.
{candidates}

[카테고리 대응 관계]
- 요식업 → 한식, 중식, 양식, 일식, 분식, 패스트푸드, 치킨, 피자, 버거, 고기, 해산물 등 식당 관련 결제 포함
- 카페/디저트 → 커피전문점, 카페, 제과점, 베이커리, 아이스크림 등 포함
- 유통/마트 → 대형마트, 슈퍼마켓, 편의점, 백화점 등 포함
- 교통 → 주유소, 대중교통, 택시, 주차, 고속도로 등 포함
- 문화/레져 → 영화관, 공연, 스포츠, 게임, 놀이공원, 동물원, 테마파크 등 포함
- 의류/잡화 → 옷, 신발, 가방, 액세서리, 화장품 등 포함
- 보건/의료 → 병원, 약국, 헬스, 뷰티 등 포함
- 기타 → 위 카테고리에 해당하지 않는 결제

[시간 근접도 기준 - 공통 적용]
후보 목록에 표시된 시간 차이 값을 그대로 읽어. 절대 직접 계산하지 말 것.
- 30분 이내: 강하게 우선 고려
- 30분~2시간: 카테고리 또는 위치가 일치할 때만 고려
- 2시간 초과: 시간은 참고만 하고 위치·카테고리·품목 일치 여부를 주요 판단 기준으로 삼을 것.
  위치나 카테고리가 명확히 일치하지 않으면 null 반환.

[매핑 판단 방법]

## 가게명이 있는 경우
1. 가게명 일치 (최우선)
   후보 목록의 payment_place와 비교해.
   일치하거나 포함 관계면 강하게 우선 고려해.

2. 품목/카테고리와 결제 장소 연관성
   품목명, 카테고리를 결제 장소명과 비교해.
   payment_category는 카드사 오분류가 많으니 무시하고 장소명 위주로 판단해.

3. 시간 근접도 → 위 [시간 근접도 기준] 적용

4. 위치 유사도
   촬영 위치와 결제 장소 주소의 도로명, 동 이름이 일치하면 높게 평가해.

## 가게명이 "알 수 없음"인 경우
1. 위치 유사도 (최우선)
   촬영 위치와 결제 장소 주소의 도로명, 동 이름이 일치하면 강하게 우선 고려해.

2. 품목/카테고리와 결제 장소 연관성 (핵심)
   품목명, 카테고리를 결제 장소명과 적극 비교해.
   메뉴명, 업종이 장소명과 연관되면 높게 평가해.
   payment_category는 카드사 오분류가 많으니 무시하고 장소명 위주로 판단해.

3. 시간 근접도 → 위 [시간 근접도 기준] 적용
   동일 가맹점이 여러 개면 시간이 가장 가까운 걸 선택해.

4. 금액 근접도
   추정 금액(price)과 payment_out을 비교해.
   추정값이므로 ±50% 허용.

## 공통 규칙
- 간편결제 (네이버페이, 카카오페이 등): 시간 근접도와 금액 근접도만으로 판단해.
- 더치페이 이체 (이체, 송금): 시간이 매우 근접하고 금액이 추정 금액의 1/2~1/4 범위이면 더치페이로 판단해.
- 위치와 카테고리가 어느 정도 일치하면 적극적으로 매핑해. 가게명이 없다는 이유만으로 null을 반환하지 말 것.

위 기준을 종합해서 적합한 후보가 정말 없으면 null을 반환해.

규칙:
- 반드시 아래 JSON 형식으로만 응답해
- payment_id는 반드시 아래 목록에 있는 값만 사용: {valid_ids}
- 위 목록에 없는 숫자는 절대 사용하지 말 것

{{
  "payment_id": 숫자 또는 null,
  "reason": "선택 이유 한 줄"
}}"""

register("group_mapping", GROUP_MAPPING_PROMPT)


def _get_client():
    if not settings.OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY가 설정되지 않았습니다.")
    return wrap_openai(OpenAI(api_key=settings.OPENAI_API_KEY))


def _time_diff_str(taken_at_kst: str, payment_time: Optional[str]) -> str:
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


@router.post("/match", response_model=List[MappingResponse])
@traceable(name="그룹 단위 매핑")
def match_photo_to_transaction(req: MappingRequest):
    if not req.candidates or not req.groups:
        return []

    client = _get_client()
    taken_at_kst = req.taken_at or "알 수 없음"
    location = req.location or "알 수 없음"

    def _diff_minutes(c) -> int:
        try:
            t1 = datetime.strptime(taken_at_kst[:19], "%Y-%m-%d %H:%M:%S")
            t2 = datetime.strptime(c.payment_time[:19], "%Y-%m-%d %H:%M:%S")
            return abs(int((t1 - t2).total_seconds() / 60))
        except Exception:
            return 99999

    sorted_candidates = sorted(req.candidates, key=_diff_minutes)
    used_payment_ids = set()
    results = []

    for group in req.groups:
        available = [c for c in sorted_candidates
                     if c.payment_id not in used_payment_ids]
        if not available:
            results.append(MappingResponse(
                group_id=group.group_id,
                payment_id=None,
                reason="남은 후보 없음"
            ))
            continue

        candidates_text = "\n".join([
            f"- payment_id: {c.payment_id}, 금액: {c.payment_out}원, "
            f"시간: {c.payment_time} (촬영시각과 {_time_diff_str(taken_at_kst, c.payment_time)}), "
            f"장소: {c.payment_place}, 카테고리: {c.payment_category}, 주소: {c.payment_address}"
            for c in available
        ])

        prompt = get_prompt("group_mapping").format(
            group_id=group.group_id,
            store=group.store or "알 수 없음",
            category=group.category or "알 수 없음",
            items=", ".join(group.items) if group.items else "알 수 없음",
            price=int(group.price) if group.price else 0,
            taken_at=taken_at_kst,
            location=location,
            candidates=candidates_text,
            valid_ids=[c.payment_id for c in available],
        )

        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.1,
                max_tokens=200,
                langsmith_extra={"run_tree": get_current_run_tree()},
            )
            content = response.choices[0].message.content
            data = json.loads(content)
            payment_id = data.get("payment_id")
            reason = data.get("reason")

            if payment_id is not None:
                try:
                    payment_id = int(payment_id)
                except (ValueError, TypeError):
                    payment_id = None

            available_ids = {c.payment_id for c in available}
            if payment_id not in available_ids:
                payment_id = None
                reason = "유효하지 않은 payment_id"

            if payment_id:
                used_payment_ids.add(payment_id)

            print(f"[매핑] photo_id={req.photo_id} group_id={group.group_id} → payment_id={payment_id} | {reason}")

            results.append(MappingResponse(
                group_id=group.group_id,
                payment_id=payment_id,
                reason=reason
            ))

        except Exception as e:
            results.append(MappingResponse(
                group_id=group.group_id,
                payment_id=None,
                reason=f"오류: {str(e)}"
            ))

    return results