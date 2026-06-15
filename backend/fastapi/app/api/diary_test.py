# app/api/diary_test.py

import asyncio
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from google import genai
from google.genai import types

from app.core.config import settings
from app.core.life_stage_prompt import get_system_prompt

router = APIRouter()

class DiaryToneTestRequest(BaseModel):
    life_stage_code: Optional[str] = None
    item_name: Optional[str] = "아이스 아메리카노"
    category: Optional[str] = "카페/간식"
    store_name: Optional[str] = "스타벅스"
    memo: Optional[str] = None
    photo_count: Optional[int] = 1

class DiaryToneTestResponse(BaseModel):
    life_stage_code: str
    prompt_group: str
    title: str
    diary_lines: list[str]


def _get_client() -> genai.Client:
    if not settings.GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY가 설정되지 않았습니다.")
    return genai.Client(api_key=settings.GEMINI_API_KEY)


def _get_prompt_group_name(life_stage_code: str | None) -> str:
    from app.core.life_stage_prompt import (
        PROMPT_YOUNG, PROMPT_ADULT, PROMPT_PARENT, PROMPT_MIDDLE, PROMPT_SENIOR
    )
    prompt = get_system_prompt(life_stage_code)
    mapping = {
        id(PROMPT_YOUNG):  "PROMPT_YOUNG (TEEN, UNI)",
        id(PROMPT_ADULT):  "PROMPT_ADULT (NEW_JOB, NEW_WED)",
        id(PROMPT_PARENT): "PROMPT_PARENT (CHILD_BABY, CHILD_TEEN, CHILD_UNI)",
        id(PROMPT_MIDDLE): "PROMPT_MIDDLE (GOLLIFE, SECLIFE)",
        id(PROMPT_SENIOR): "PROMPT_SENIOR (RETIR)",
    }
    return mapping.get(id(prompt), "UNKNOWN")


def _get_line_guide(photo_count: int) -> str:
    if photo_count <= 0:
        return "Write the diary_lines array with exactly 4 sentences."
    elif photo_count == 1:
        return "Write the diary_lines array with exactly 6 sentences."
    elif photo_count == 2:
        return "Write the diary_lines array with exactly 8 sentences."
    else:
        return "Write the diary_lines array with exactly 10 sentences."


@router.post("/generate-by-stage", response_model=DiaryToneTestResponse, summary="생애주기별 일기 생성 테스트")
async def test_diary_by_stage(req: DiaryToneTestRequest):
    """
    life_stage_code와 간단한 소비 정보를 입력하면
    해당 생애주기 말투로 일기를 생성해 반환합니다.

    life_stage_code 목록:
    - TEEN, UNI → 20대 말투
    - NEW_JOB, NEW_WED → 직장인/신혼 말투
    - CHILD_BABY, CHILD_TEEN, CHILD_UNI → 부모 말투
    - GOLLIFE, SECLIFE → 중년 말투
    - RETIR → 은퇴 말투
    - null 또는 미입력 → 기본값(UNI) 적용
    """
    client = _get_client()
    line_guide = _get_line_guide(req.photo_count or 1)
    system_content = get_system_prompt(req.life_stage_code).format(line_guide=line_guide)

    user_content = f"""\
[Today's Consumption Info]
- Item: {req.item_name or "알 수 없음"}
- Category: {req.category or "기타"}
- Store: {req.store_name or "알 수 없음"}
- User memo: {req.memo or "없음"}
- Amount paid: 0 KRW
- User mood: 😊
- Group theme: 일상 소비
- Room writing theme: 소비의 감정, 분위기, 장소의 특징을 자연스럽게 녹여 표현해줘.
- AI photo analysis: {req.store_name or "가게"}에서 {req.item_name or "소비"}하는 장면

Write a JSON consumption diary based on the above.
"""

    response = await asyncio.get_event_loop().run_in_executor(
        None,
        lambda: client.models.generate_content(
            model="gemini-2.5-flash",
            contents=user_content,
            config=types.GenerateContentConfig(
                temperature=0.75,
                max_output_tokens=2048,
                response_mime_type="application/json",
                system_instruction=system_content,
            ),
        )
    )

    content = response.text.strip() if response.text else ""
    if not content:
        raise HTTPException(status_code=500, detail="Gemini 응답이 비어있습니다.")

    if content.startswith("```"):
        content = content.split("```")[1]
        if content.startswith("json"):
            content = content[4:]
        content = content.strip()

    try:
        data = json.loads(content)
        return DiaryToneTestResponse(
            life_stage_code=req.life_stage_code or "None → UNI 기본값 적용",
            prompt_group=_get_prompt_group_name(req.life_stage_code),
            title=data["title"],
            diary_lines=data["diary_lines"],
        )
    except (json.JSONDecodeError, KeyError) as e:
        raise HTTPException(status_code=500, detail=f"파싱 실패: {e} | raw: {content[:200]}")