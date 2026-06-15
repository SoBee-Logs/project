# app/api/mapping.py
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from app.core.config import settings
from app.core.prompt_store import register, get_prompt
from langsmith import traceable, get_current_run_tree
from datetime import datetime
from google import genai
from google.genai import types

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

GROUP_MAPPING_PROMPT = """너는 소비 사진의 특정 그룹과 결제 내역을 1:1 매핑하는 AI야.

## 공통 주의사항 (전체 적용)
- payment_category는 카드사마다 기준이 달라 오분류가 많으므로, 아래 [카테고리 분류표]를
  기준으로 payment_place(결제 장소명)를 직접 재분류해서 사용해.
- 재분류된 카테고리는 단독으로 매핑을 결정하지 말고, 반드시 시간 근접도·위치 유사도·
  장소명 연관성 중 하나 이상과 함께 종합 판단해.
- 후보 목록의 시간 차이 값을 그대로 읽어. 절대 직접 계산하지 말 것.
- payment_id는 반드시 아래 [유효한 결제 ID 목록]에 있는 값만 사용할 것.

[카테고리 분류표]
   - 식비: 식당, 분식, 패스트푸드, 배달, 편의점 도시락/삼각김밥, 해산물 요리, 과일
   - 카페/간식: 카페 음료, 베이커리, 디저트, 편의점 과자/스낵, 길거리 음식
   - 패션/쇼핑: 옷, 신발, 가방, 액세서리 (인형 제외)
   - 교통: 지하철, 버스, 택시, 기차, 주유
   - 여행/숙박: 항공권, 숙박, 면세점, 해외결제
   - 문화/여가: 영화, 공연, 스키장, 놀이공원, 노래방, PC방, 인형뽑기, 완구류
   - 술/유흥: 술집, 바, 와인/맥주/소주 구매
   - 의료/건강: 병원, 약국, 안경, 영양제
   - 뷰티/미용: 미용실, 네일샵, 화장품
   - 교육/학습: 학원, 교재, 책, 스터디카페
   - 금융: 증권/투자, 보험, 복권
   - 경조/선물: 경조사비, 선물, 꽃다발
   - 생활: 마트, 생활용품

---

## [매핑 대상 그룹]
- 그룹 ID: {group_id}
- 가게명: {store}
- 카테고리: {category}
- 품목: {items}
- 금액: {price}원
- 촬영 시각: {taken_at}
- 촬영 위치: {location}

## [결제 후보 목록]
후보는 촬영 시각과의 시간 차이 오름차순으로 정렬되어 있음.
{candidates}

## [유효한 결제 ID 목록]
{valid_ids}

---

## STEP 1. 간편결제 여부 확인 (최우선)

결제 장소(payment_place)가 카카오페이·네이버페이·삼성페이·토스·페이코·애플페이 등 간편결제이면:
- 아래 조건을 모두 충족하면 즉시 매핑하고 STEP 2, 3은 읽지 않는다.
  - 시간 차이 2시간 이내
  - 결제 금액이 추정 금액의 0.5배~2배 범위 (더치페이 의심 시 0.25배~0.5배도 허용)
- 위 조건 미충족 시 → null 반환

---

## STEP 2. 가게명이 있는 경우

아래 우선순위 순서대로 판단한다.

1. **가게명 일치** (최우선)
   payment_place와 가게명이 일치하거나 포함 관계이면 강하게 우선 고려한다.

2. **시간 근접도**
   - 30분 이내: 강하게 우선 고려
   - 30분~2시간: 가게명이 일치할 때만 고려
   - 2시간 초과: 가게명이 일치하더라도 금액이 추정값의 ±100% 범위 이내일 때만 매핑

3. **위치 유사도**
   촬영 위치와 결제 장소 주소의 도로명·동 이름이 일치하면 높게 평가한다.

→ 위 기준을 종합해 적합한 후보가 없으면 null 반환

---

## STEP 3. 가게명이 "알 수 없음"인 경우

아래 우선순위 순서대로 판단한다.

1. **위치 유사도** (최우선)
   촬영 위치와 결제 장소 주소의 도로명·동 이름이 일치하는 후보를 강하게 우선 고려한다.

2. **품목 ↔ 결제 장소명 연관성**
   아래 카테고리 분류표를 참고해 품목이 어떤 업종인지 판단한 뒤,
   결제 장소명(payment_place)과 연관성이 있으면 높게 평가한다.
   동일 업종의 가맹점이 여러 개면 시간이 가장 가까운 것을 선택한다.

3. **시간 근접도**
   - 30분 이내: 강하게 우선 고려
   - 30분~2시간: 위치 또는 품목 연관성이 있을 때만 고려
   - 2시간 초과: 위치·품목 연관성이 모두 있고 금액이 ±100% 범위 이내일 때만 매핑

4. **금액 근접도**
   추정 금액(price)과 결제 금액(payment_out)을 비교한다.
   추정값이므로 ±50% 오차를 허용한다.

→ 위치·품목 연관성이 어느 정도 일치하면 적극적으로 매핑한다.
  가게명이 없다는 이유만으로 null을 반환하지 말 것.
→ 위 기준을 종합해 적합한 후보가 정말 없으면 null 반환

---

## 출력 형식
반드시 JSON 객체만 출력한다. 설명 텍스트, 마크다운 없이.

{{
  "payment_id": 숫자 또는 null,
  "reason": "선택 이유 한 줄"
}}"""

register("group_mapping", GROUP_MAPPING_PROMPT)


def _get_client() -> genai.Client:
    if not settings.GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY가 설정되지 않았습니다.")
    return genai.Client(api_key=settings.GEMINI_API_KEY)


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
            response = client.models.generate_content(
                model="gemini-3.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.1,
                    max_output_tokens=3000,
                    response_mime_type="application/json",
                    system_instruction="You must respond with valid JSON only. No explanation, no markdown, no text before or after the JSON object.",
                ),
            )
            content = response.text.strip() if response.text else ""
            print(f"[Gemini 응답 원문] {repr(content)}")  # ← 추가
            content = response.text.strip()

            # 백틱 감싸진 경우 제거
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
                content = content.strip()

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