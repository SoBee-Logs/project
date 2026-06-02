import json
from openai import AsyncOpenAI
from fastapi import APIRouter, HTTPException

from app.core.config import settings
from app.models.schemas import DiaryRequest, DiaryResponse

router = APIRouter()

MOOD_LABEL = {
    "☺️": "satisfied",
    "😭": "sad",
    "😮": "surprised",
    "😍": "happy",
    "😡": "regretful",
}

<<<<<<< HEAD
# 모임방 카테고리별 일기 작성 테마 지침
# room_category 값이 없거나 알 수 없는 경우 DEFAULT 사용
ROOM_CATEGORY_THEME = {
    "EXERCISE": "이 방은 운동 기록 방이야. 운동 후의 뿌듯함, 땀, 근육통, 성취감을 역동적이고 생동감 있게 표현해줘. 건강한 에너지가 느껴지도록.",
    "HOBBY":    "이 방은 취미 생활 방이야. 취미에 빠져드는 몰입감, 설렘, 소소한 행복을 위트 있고 감성적으로 표현해줘.",
    "TRAVEL":   "이 방은 여행/아웃도어 방이야. 낯선 장소의 설렘, 자연의 풍경, 여행의 자유로움을 생생하고 감각적으로 묘사해줘.",
    "FAMILY":   "이 방은 가족/육아 방이야. 소중한 가족과의 따뜻한 순간, 아이의 귀여운 모습, 가족 간의 애정을 따뜻하고 다정하게 표현해줘.",
    "DAILY":    "이 방은 일상 기록 방이야. 평범하지만 소중한 하루의 순간들을 감각적이고 담담하게, 그러나 특별하게 느껴지도록 표현해줘.",
    "FOOD":     "이 방은 맛집/음식 방이야. 음식의 맛, 향, 식감과 함께 카페나 식당의 분위기와 비주얼을 인스타 감성으로 트렌디하게 묘사해줘.",
    "PET":      "이 방은 반려동물 방이야. 귀여운 반려동물과의 교감, 일상 속 소소한 웃음 포인트를 사랑스럽고 유쾌하게 표현해줘.",
    "DEFAULT":  "소비의 감정, 분위기, 장소의 특징을 자연스럽게 녹여 인스타그램 피드 감성으로 표현해줘.",
}

def _get_line_guide(photo_count: int) -> str:
    if photo_count <= 0:
        return "Write the diary_lines array with exactly 2 sentences. Each sentence should flow naturally into the next, forming one cohesive diary entry."
    elif photo_count == 1:
        return "Write the diary_lines array with exactly 3 sentences. Each sentence should flow naturally into the next, forming one cohesive diary entry."
    elif photo_count == 2:
        return "Write the diary_lines array with exactly 4 sentences. Each sentence should flow naturally into the next, forming one cohesive diary entry."
    else:
        return "Write the diary_lines array with exactly 5 sentences. Each sentence should flow naturally into the next, forming one cohesive diary entry."

# ── 프롬프트 템플릿 ───────────────────────────────────────────────
SYSTEM_PROMPT_TEMPLATE = """\
한국 20대가 쓰는 카톡 감성 소비 일기 작가야. 반말, 슬랭(레전드·찐·개~·아니 근데), 이모지/이모티콘(ㅋㅋ·ㅠㅠ·헐 등) 왕창 써서 친구한테 털어놓듯 써줘.

[규칙]
1. 전체 한국어로 작성.
2. {line_guide}
3. 문장들이 자연스럽게 이어져 하나의 일기처럼 읽혀야 함.
4. 각 문장마다 이모지·이모티콘, ㅋㅋ, ㅠㅠ, ㅎㅎ 등 자연스럽게 섞되, 1-2개만 쓰기.
	- 유행어와 줄임말은 전체 diary_lines 기준 2~4개 정도만 사용한다.
	- 같은 표현을 반복하지 않는다.
	- 너무 오래됐거나 부자연스러운 신조어는 피한다.
5. "~을 샀습니다" 같은 기계적 표현 절대 금지. 감정·장면 위주로.
6. 실제 10~20대가 카톡에서 쓰는 말투를 자연스럽게 섞어 써.
   - 줄임말 예시: 아이스 아메리카노→아아, 따뜻한 아메리카노→뜨아, 스타벅스→스벅, 파리바게뜨→파바, 맥도날드→맥날, 배달의민족→배민, 올리브영→올영, 코인노래방→코노, 엽기떡볶이 → 엽떡, 삼각김밥 → 삼김, 넷플릭스 → 넷플, PC방 → 피방, 롯데월드 → 롯월, 포토카드 → 포카, 스터디카페 → 스카, 시험기간 → 셤기간
   - 소비 표현 예시: 긁었다, 질렀다, 결제 갈김, 지갑 털림, 탕진, 플렉스, 합리화 완료, 가성비, 가심비
   - 감탄 표현 예시: ㄹㅇ, 찐, 레전드, 개맛있음, 미쳤다, 도랏, 에바, 실화냐, 홀리몰리, 킹받네
   - 무드 표현 예시: 갬성, 사진각, 인스타각, 비주얼 합격, 분위기 미쳤다, 소확행, 힐링
   단, 모든 문장에 억지로 유행어를 넣지 말고 실제 친구에게 말하듯 자연스럽게 사용해.
7. 아래 JSON만 출력 (마크다운 백틱 제외).

[예시 문장]
아니 오늘 아아 없었으면 진짜 기절각이었음 ㅠㅠ
디저트까지 야무지게 먹었는데 당충전 레전드였다:heart_eyes: ㅋㅋ

스카 결제하고 카공까지 조진 날 ㅋㅋ
셤기간이라 인강이랑 교재에 돈 줄줄 나감 ㅠㅠ

{{
  "title": "제목 (이모지 포함, 12자 이내)",
  "diary_lines": ["문장1 :raised_hands:", "문장2 ㅋㅋ", ...]
}}
"""

USER_PROMPT_TEMPLATE = """\
[Today's Consumption Info]
- Item: {item_name}
- Category: {category}
- Amount paid: {price} KRW
- Store: {store_name}
- User mood: {mood_label} ({mood})
- User memo: {emotion_text}
- Group theme / context: {group_description}
- Room writing theme: {room_theme}
- AI photo analysis: {description}
=======
# System Prompt: 페르소나 + 절대 규칙 (소비 데이터 없이 규칙만)
SYSTEM_PROMPT_TEMPLATE = """너는 20대 직장인/대학생이 인스타 스머프 계정이나 에브리타임, 개인 블로그에 올리는 솔직하고 유쾌한 소비 일기를 대신 써주는 작가야.
유저의 소비 내역과 사진 분석 결과를 보고, 그 소비의 감정과 분위기를 자연스럽게 녹여서 써줘.

[절대 규칙 - 무조건 지켜]
1. 말투: 음/슴체 또는 가벼운 반말. 딱딱한 경어나 과장된 감탄("정말!", "너무너무") 금지.
2. 금지어: "마법 같은", "환상적인", "~을 샀습니다", "소비했습니다", "경험했습니다", "느꼈습니다" 같은 설명체·AI 냄새나는 표현 절대 금지.
3. 제목(title): 10자 이내. 유튜브 썸네일이나 해시태그처럼 핵심만 짤막하게.
4. 분량: diary_lines 배열을 정확히 {line_guide} 작성.
5. 각 줄: 한 문장 최대 35자. 짧은 호흡으로 끊어서 써.
6. 출력 형식: 반드시 아래 JSON만 출력 (마크다운 백틱, 설명 텍스트 모두 금지).

{{
  "title": "제목 (10자 이내)",
  "diary_lines": ["줄1", "줄2", ...]
}}
"""

# User Prompt: 소비 데이터만
USER_PROMPT_TEMPLATE = """[소비 정보]
- 품목: {item_name}
- 카테고리: {category}
- 결제 금액: {price}원
- 장소(가게): {store_name}
- 기분: {mood_label} ({mood})
- 메모: {emotion_text}
- 모임방 테마/특징: {group_description}
- 사진 분석 결과: {description}
"""


def _get_line_guide(photo_count: int) -> str:
    if photo_count <= 1:
        return "2~3개"
    elif photo_count <= 3:
        return "4~5개"
    else:
        return "6~8개"
>>>>>>> c0552f4e919b8e7cedb60f30cb817a95d57c117f

Write a JSON consumption diary based on the above.
"""

def _get_client() -> AsyncOpenAI:
    if not settings.OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY가 설정되지 않았습니다.")
    return AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


async def generate_diary(req: DiaryRequest) -> DiaryResponse:
    client = _get_client()

<<<<<<< HEAD
    mood_label = MOOD_LABEL.get(req.mood or "", "neutral")
    line_guide = _get_line_guide(req.photo_count or 0)

    # room_category로 테마 지침 조회 — 없으면 DEFAULT 사용
    room_theme = ROOM_CATEGORY_THEME.get(
        (req.room_category or "").upper(),
        ROOM_CATEGORY_THEME["DEFAULT"]
    )
=======
    mood_label = MOOD_LABEL.get(req.mood or "", "평범한")
    line_guide = _get_line_guide(req.photo_count or 1)
>>>>>>> c0552f4e919b8e7cedb60f30cb817a95d57c117f

    system_content = SYSTEM_PROMPT_TEMPLATE.format(line_guide=line_guide)
    user_content = USER_PROMPT_TEMPLATE.format(
        item_name=req.item_name or "알 수 없음",
        category=req.category or "기타",
        price=f"{int(req.price):,}" if req.price is not None else "0",
        store_name=req.store_name or "알 수 없음",
        mood=req.mood or "",
        mood_label=mood_label,
        emotion_text=req.emotion_text or "없음",
        group_description=req.group_description or "일반 소비",
<<<<<<< HEAD
        room_theme=room_theme,
=======
>>>>>>> c0552f4e919b8e7cedb60f30cb817a95d57c117f
        description=req.description or "특이사항 없음",
    )

    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_content},
            {"role": "user", "content": user_content},
        ],
        response_format={"type": "json_object"},
        temperature=0.75,
<<<<<<< HEAD
        max_tokens=400,
=======
        max_tokens=600,
>>>>>>> c0552f4e919b8e7cedb60f30cb817a95d57c117f
    )

    content = response.choices[0].message.content
    if not content:
        raise HTTPException(status_code=500, detail="OpenAI 응답이 비어있습니다.")

    try:
        data = json.loads(content)
        return DiaryResponse(
            title=data["title"],
            diary_lines=data["diary_lines"],
            tags=req.tags or [],
        )
    except (json.JSONDecodeError, KeyError) as e:
        raise HTTPException(status_code=500, detail=f"일기 생성 파싱 실패: {e} | raw: {content[:200]}")


# POST /api/diary/generate
@router.post("/generate", response_model=DiaryResponse)
async def generate_diary_endpoint(req: DiaryRequest):
    return await generate_diary(req)
