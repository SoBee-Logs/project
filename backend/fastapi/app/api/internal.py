import asyncio
import logging

import aiohttp
from fastapi import APIRouter, Header

log = logging.getLogger(__name__)


async def _trigger_airflow_sync(user_id: int, days: int) -> None:
    """Airflow sobee_transaction_sync DAG 트리거 (회원가입 시 초기 sync)."""
    from app.core.config import settings
    url = f"{settings.AIRFLOW_URL}/api/v1/dags/sobee_transaction_sync/dagRuns"
    try:
        async with aiohttp.ClientSession() as session:
            res = await session.post(
                url,
                json={"conf": {"user_id": user_id, "days": days}},
                auth=aiohttp.BasicAuth(settings.AIRFLOW_USER, settings.AIRFLOW_PASSWORD),
                timeout=aiohttp.ClientTimeout(total=10),
            )
            if res.status in (200, 201):
                log.info(f"Airflow 트리거 완료: user_id={user_id} days={days}")
            else:
                body = await res.text()
                log.warning(f"Airflow 트리거 실패 ({res.status}): {body} — 로컬 sync로 fallback")
                asyncio.create_task(sync_transactions(user_id, days=days))
    except Exception as e:
        log.warning(f"Airflow 연결 실패: {e} — 로컬 sync로 fallback")
        asyncio.create_task(sync_transactions(user_id, days=days))


from app.models.schemas import (
    SyncRequest, SyncResponse,
    MappingRequest, MappingResponse,
    DiaryGenerateRequest, DiaryGenerateResponse,
    RegisterAccountRequest, RegisterAccountResponse,
    ConnectedIdListResponse, ConnectedIdInfo,
    ParseSearchRequest, ParseSearchResponse,
    AvailableOrgsResponse, RegisterFromEnvRequest, RegisterFromEnvResponse,
)
from app.services.sync_service import (
    sync_transactions, register_account,
    list_connected_ids, register_accounts_from_env, INITIAL_SYNC_DAYS,
)
from app.services.mapping_service import run_mapping
from app.services.diary_service import generate_diary
from app.db.user_repository import get_all_user_ids
from app.services.search_parse_service import parse_search_query

router = APIRouter(prefix="/internal", tags=["internal"])


@router.get(
    "/sync/status",
    summary="트랜잭션 적재 완료 여부 확인",
    description="""
유저의 `transactions` 테이블 데이터 존재 여부를 반환합니다.

- `synced: true` → 1건 이상 적재됨
- `synced: false` → 아직 sync 미완료

Airflow DAG 또는 프론트엔드에서 초기 sync 완료 여부를 polling할 때 사용합니다.
""",
)
async def sync_status_check(user_id: int):
    from app.db.connection import get_pool
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "SELECT COUNT(*) FROM transactions WHERE user_id = %s", (user_id,)
            )
            row = await cur.fetchone()
    count = row[0] if row else 0
    return {"synced": count > 0, "transaction_count": count}


@router.get(
    "/accounts/available-orgs",
    response_model=AvailableOrgsResponse,
    summary="ENV에 설정된 기관 코드 목록 조회",
    description="""
`.env`의 `CODEF_BANK_ACCOUNTS` / `CODEF_CARD_ACCOUNTS`에 등록된 기관 코드 목록을 반환합니다.

`register-from-env` 호출 전 어떤 기관 코드를 요청할 수 있는지 확인할 때 사용합니다.

**응답 예시**
```json
{
  "bank_codes": ["0020", "0088"],
  "card_codes": ["0306", "0313"]
}
```
""",
)
async def accounts_available_orgs():
    from app.core.config import settings
    bank_codes = [acc["organization"] for acc in settings.get_codef_bank_accounts()]
    card_codes = [acc["organization"] for acc in settings.get_codef_card_accounts()]
    return AvailableOrgsResponse(bank_codes=bank_codes, card_codes=card_codes)


@router.post(
    "/accounts/register",
    response_model=RegisterAccountResponse,
    summary="금융기관 계정 직접 입력으로 등록 (codef_connected_id)",
    description="""
유저가 본인의 `loginId` / `loginPw`를 직접 입력해 금융기관 계정을 CODEF에 등록합니다.
Swagger에서 유저별로 개별 호출하는 용도입니다.

**connected_id 미전달** → `/account/create`: 새 connected_id 발급 (최초 등록)
**connected_id 전달** → `/account/add`: 기존 connected_id에 기관 추가
- 동일 인증수단(같은 ID/PW)으로 여러 기관을 하나의 connected_id로 묶을 때 사용

등록 완료 후 데이터 수집은 `POST /internal/transactions/sync`를 별도 호출하세요.
`loginId` / `loginPw`는 CODEF에만 전달되며 서버에 저장되지 않습니다.

**기관 코드 예시**
| 기관 | 코드 | 타입 |
|------|------|------|
| 우리은행 | 0020 | BK |
| 신한은행 | 0088 | BK |
| 신한카드 | 0306 | CD |
| 하나카드 | 0313 | CD |
""",
)
async def accounts_register(request: RegisterAccountRequest):
    from fastapi import HTTPException
    try:
        cid = await register_account(
            user_id=request.user_id,
            business_type=request.business_type,
            org_code=request.org_code,
            login_id=request.login_id,
            login_pw=request.login_pw,
            connected_id=request.connected_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    action = "기관 추가" if request.connected_id else "connected_id 발급"
    return RegisterAccountResponse(
        user_id=request.user_id,
        business_type=request.business_type,
        org_code=request.org_code,
        connected_id=cid,
        message=f"{action} 완료. 데이터 수집은 POST /internal/transactions/sync 를 호출하세요.",
    )


@router.post(
    "/accounts/register-from-env",
    response_model=RegisterFromEnvResponse,
    summary="금융기관 계정 env로 등록 (codef_connected_id)",
    description="""
`.env`에 미리 저장된 팀원 공용 자격증명을 사용해 CODEF connected_id를 발급하고 AWS Secrets Manager에 저장합니다.
유저가 직접 loginId/loginPw를 입력하지 않아도 되는 팀 내부 테스트 전용 엔드포인트입니다.

**등록 흐름**
1. `bank_codes` / `card_codes`가 `.env`에 있는지 확인 → 없으면 `missing` 반환
2. 이미 Secrets Manager에 등록된 기관은 skip
3. 같은 `loginId`끼리 하나의 connected_id로 묶어 등록 (CODEF 1:N 스펙)
4. 등록 완료 후 최근 30일 트랜잭션 sync 백그라운드 트리거

**유저 그룹별 CODEF API 계정**
`.env`의 `CODEF_USER_IDS_N`에 매핑된 user_id는 해당 그룹의 `CODEF_CLIENT_ID_N` 자격증명을 사용합니다.
매핑이 없으면 전역 `CODEF_CLIENT_ID`로 fallback됩니다.

**에러 케이스**
- `missing`: ENV에 없는 기관 코드 요청
- `rate_limited`: CODEF 일일 API 호출 한도(100건) 초과 → 내일 재시도
""",
)
async def accounts_register_from_env(request: RegisterFromEnvRequest):
    result = await register_accounts_from_env(
        request.user_id, request.bank_codes, request.card_codes
    )
    if result["missing"]:
        return RegisterFromEnvResponse(
            user_id=request.user_id,
            registered=[],
            missing=result["missing"],
            message=f"ENV에 없는 기관: {result['missing']}",
        )
    if result.get("rate_limited"):
        return RegisterFromEnvResponse(
            user_id=request.user_id,
            registered=result["registered"],
            missing=[],
            message="CODEF 일일 API 한도 초과. 내일 다시 시도해주세요.",
        )
    if not result["registered"]:
        return RegisterFromEnvResponse(
            user_id=request.user_id,
            registered=[],
            missing=[],
            message="등록할 기관이 없거나 등록에 실패했습니다.",
        )
    asyncio.create_task(_trigger_airflow_sync(request.user_id, days=INITIAL_SYNC_DAYS))
    return RegisterFromEnvResponse(
        user_id=request.user_id,
        registered=result["registered"],
        missing=[],
        message=f"{len(result['registered'])}개 기관 등록 완료. 30일 sync 시작.",
    )


@router.get(
    "/users",
    summary="전체 유저 ID 목록 조회",
    description="""
DB의 활성 유저(`is_active = true`) 전체 ID 목록을 반환합니다.

Airflow DAG에서 일별 sync 대상 유저를 순회할 때 호출합니다.
""",
)
async def list_users():
    return {"user_ids": await get_all_user_ids()}


@router.get(
    "/accounts/{user_id}",
    response_model=ConnectedIdListResponse,
    summary="유저의 connected_id 목록 조회",
    description="""
AWS Secrets Manager(`sobee/codef/{user_id}`)에 저장된 connected_id 목록과 각 connected_id에 등록된 기관 정보를 반환합니다.

등록 상태 확인 및 디버깅 용도로 사용합니다.
""",
)
async def accounts_list(user_id: int):
    entries = list_connected_ids(user_id)
    return ConnectedIdListResponse(
        user_id=user_id,
        connected_ids=[ConnectedIdInfo(**e) for e in entries],
    )


@router.post(
    "/transactions/sync",
    response_model=SyncResponse,
    summary="트랜잭션 수동 sync",
    description="""
Secrets Manager의 connected_id를 사용해 CODEF에서 트랜잭션을 가져와 DB에 적재합니다.

**처리 순서**
1. CODEF 은행 계좌 목록 조회 → 계좌별 거래내역 적재
2. CODEF 카드 승인내역 적재
3. `transactions` 병합 (체크카드-계좌 매칭, 자기이체 제거, 취소 내역 제거)
4. 카테고리 매핑 실행 (룰베이스 → LLM 체이닝)
5. 생애주기 예측 업데이트

`days` 미전달 시 기본 3일 적용 (Airflow 일별 sync 기준).
connected_id 미등록 유저는 skip 메시지를 반환하며 에러 처리되지 않습니다.
""",
)
async def transactions_sync(request: SyncRequest):
    from app.services.sync_service import DAILY_SYNC_DAYS
    days = request.days if request.days is not None else DAILY_SYNC_DAYS
    try:
        result = await sync_transactions(request.user_id, days=days)
    except ValueError as e:
        return SyncResponse(message=f"skip (연동 계정 없음): {e}")
    msg = (
        f"sync 완료 | 기간:{result['period']} "
        f"계좌:{result['bank_saved']} 카드:{result['card_saved']} "
        f"transactions:{result['transactions_merged']}"
    )
    return SyncResponse(message=msg)


@router.post(
    "/mapping/run",
    response_model=MappingResponse,
    summary="카테고리 매핑 수동 실행",
    description="""
미매핑 트랜잭션에 대해 카테고리 매핑을 실행합니다.

**매핑 우선순위**
1. 룰베이스 매핑 — 키워드 기반 즉시 분류
2. LLM 자동 매핑 — 룰베이스 미처리 건을 LLM으로 분류

`user_id` / `start_date` / `end_date` 미전달 시 전체 미매핑 건을 대상으로 실행합니다.
""",
)
async def mapping_run(request: MappingRequest):
    result = await run_mapping(request.user_id, request.start_date, request.end_date)
    return MappingResponse(message=result.get("message", "mapping complete"))


@router.post(
    "/diary/generate",
    response_model=DiaryGenerateResponse,
    summary="소비 일기 생성",
    description="""
유저의 최근 소비 데이터를 기반으로 AI 소비 일기를 생성합니다.

생성된 일기는 `diary` 테이블에 저장됩니다.
""",
)
async def diary_generate(request: DiaryGenerateRequest):
    result = await generate_diary(request.user_id)
    return DiaryGenerateResponse(message=result.get("message", "diary generated"))


@router.post(
    "/parse-search",
    response_model=ParseSearchResponse,
    summary="자연어 검색 쿼리 파싱",
    description="""
자연어 검색 입력을 구조화된 필터 조건으로 변환합니다.

검색 기능의 전처리 단계로 사용됩니다.

**예시**
- 입력: `"지난달 카페 지출"`
- 출력: `{"category": "카페", "period": "last_month", "type": "출금"}`
""",
)
async def parse_search(request: ParseSearchRequest):
    result = await parse_search_query(request.query)
    return ParseSearchResponse(**result)


@router.get(
    "/persona/has-photo",
    summary="페르소나 생성 가능 여부 확인",
    description="""
지정 기간(`start_date` ~ `end_date`) 내에 사진-결제 매핑 데이터(`persona_transaction`)가 존재하는지 확인합니다.

Airflow 아바타 생성 DAG에서 생성 조건 충족 여부를 판단할 때 사용합니다.

- `has_photo: true` → 매핑 데이터 존재, 아바타 생성 가능
- `has_photo: false` → 매핑 데이터 없음, 아바타 생성 skip

`start_date` / `end_date` 형식: `YYYY-MM-DD`
""",
)
async def persona_has_photo(user_id: int, start_date: str, end_date: str):
    from app.db.connection import get_pool
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("""
                SELECT COUNT(*) FROM persona_transaction pt
                JOIN transactions t ON pt.payment_id = t.payment_id
                WHERE pt.user_id = %s
                  AND t.payment_date BETWEEN %s AND %s
            """, (user_id, start_date, end_date))
            row = await cur.fetchone()
    return {"user_id": user_id, "has_photo": (row[0] > 0) if row else False}


@router.get("/daily-summary", summary="어제 소비 AI 한줄 요약")
async def daily_summary(
    user_id: int,
    date: str,
    x_internal_secret: str = Header(None, alias="X-Internal-Secret"),
):
    from fastapi import HTTPException
    from app.core.config import settings
    if x_internal_secret != settings.INTERNAL_SECRET_KEY:
        raise HTTPException(status_code=403, detail="Forbidden")

    from app.db.connection import get_pool
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("""
                SELECT v.vlm_item_name, v.vlm_category, v.vlm_price_estimate
                FROM photo_vlm_results v
                JOIN photos p ON v.photo_id = p.photo_id
                WHERE p.user_id = %s
                  AND DATE(p.created_at) = %s
                  AND v.vlm_category IS NOT NULL
                  AND v.vlm_category != '기타'
                  AND v.is_valid = TRUE
            """, (user_id, date))
            rows = await cur.fetchall()

    if not rows:
        return {"summary": "기록 없음"}

    items_text = "\n".join([f"- {r[1]}: {r[0]} ({r[2]}원)" for r in rows])

    try:
        from google import genai
        from google.genai import types
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=f"소비 기록:\n{items_text}\n\n위 소비를 한국어 15자 이내로 한 줄 요약해줘. 20대 말투로 이모지 1개 포함. 예: '카페 또 갔네 ☕ㅋㅋ', '쇼핑 신났다~ 🛍️', '식비 탕진 중 🍚', '카페+쇼핑 데이 ✨'. 요약문만 출력.",
            config=types.GenerateContentConfig(
                temperature=0.8,
                thinking_config=types.ThinkingConfig(thinking_budget=0),
            ),
        )
        summary = response.text.strip()
    except Exception as e:
        log.warning(f"[daily-summary] Gemini 실패: {e}")
        summary = "소비 요약 실패"

    return {"summary": summary}
