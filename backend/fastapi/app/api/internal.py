import asyncio
import logging

import aiohttp
from fastapi import APIRouter

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
    sync_transactions, sync_transactions_env, register_account,
    list_connected_ids, register_accounts_from_env, INITIAL_SYNC_DAYS,
)
from app.services.mapping_service import run_mapping
from app.services.diary_service import generate_diary
from app.db.user_repository import get_all_user_ids
from app.services.search_parse_service import parse_search_query

router = APIRouter(prefix="/internal", tags=["internal"])


@router.get("/sync/status")
async def sync_status_check(user_id: int):
    """트랜잭션 DB 적재 완료 여부 확인 (월 필터 없이 전체 카운트)."""
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


@router.get("/accounts/available-orgs", response_model=AvailableOrgsResponse)
async def accounts_available_orgs():
    """ENV에 등록된 기관 코드 목록 반환 (프론트 검증용)."""
    from app.core.config import settings
    bank_codes = [acc["organization"] for acc in settings.get_codef_bank_accounts()]
    card_codes = [acc["organization"] for acc in settings.get_codef_card_accounts()]
    return AvailableOrgsResponse(bank_codes=bank_codes, card_codes=card_codes)


@router.post("/accounts/register-from-env", response_model=RegisterFromEnvResponse)
async def accounts_register_from_env(request: RegisterFromEnvRequest):
    """
    사용자가 선택한 org_code를 ENV에서 조회 → CODEF 등록 → 30일 sync 백그라운드 트리거.
    ENV에 없는 기관 코드는 missing 목록으로 반환.
    """
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
    asyncio.create_task(_trigger_airflow_sync(request.user_id, days=INITIAL_SYNC_DAYS))
    return RegisterFromEnvResponse(
        user_id=request.user_id,
        registered=result["registered"],
        missing=[],
        message=f"{len(result['registered'])}개 기관 등록 완료. 30일 sync 시작.",
    )


@router.get("/users")
async def list_users():
    """Airflow DAG에서 전체 유저 목록 조회용"""
    return {"user_ids": await get_all_user_ids()}


@router.post("/accounts/setup")
async def accounts_setup():
    """
    .env의 CODEF_ACCOUNT_N 목록을 읽어 전체 계정을 일괄 등록.
    connected_id를 발급받아 Secrets Manager에 저장.
    """
    from app.core.config import settings
    accounts = settings.get_codef_accounts()
    if not accounts:
        return {"message": ".env에 CODEF_ACCOUNT_N 설정이 없습니다."}

    results = []
    registered_user_ids: set[int] = set()
    for acct in accounts:
        try:
            await register_account(
                user_id=acct["user_id"],
                business_type=acct["business_type"],
                org_code=acct["org_code"],
                login_id=acct["login_id"],
                login_pw=acct["login_pw"],
            )
            registered_user_ids.add(acct["user_id"])
            results.append({"user_id": acct["user_id"], "org_code": acct["org_code"], "status": "ok"})
        except Exception as e:
            results.append({"user_id": acct["user_id"], "org_code": acct["org_code"], "status": "error", "error": str(e)})

    # 등록 성공한 유저별로 초기 30일 sync 백그라운드 트리거 (유저당 1회)
    for uid in registered_user_ids:
        asyncio.create_task(sync_transactions(uid, days=INITIAL_SYNC_DAYS))

    return {"results": results}


@router.get("/accounts/{user_id}", response_model=ConnectedIdListResponse)
async def accounts_list(user_id: int):
    """
    유저의 connected_id 목록과 각 connected_id에 등록된 기관 목록 조회.
    응답 예시:
      {
        "user_id": 1,
        "connected_ids": [
          {
            "connected_id": "cid_abc",
            "institutions": [
              {"businessType": "BK", "organization": "0020"},
              {"businessType": "CD", "organization": "0301"}
            ]
          }
        ]
      }
    """
    entries = list_connected_ids(user_id)
    return ConnectedIdListResponse(
        user_id=user_id,
        connected_ids=[ConnectedIdInfo(**e) for e in entries],
    )


@router.post("/accounts/register", response_model=RegisterAccountResponse)
async def accounts_register(request: RegisterAccountRequest):
    """
    금융기관 계정 등록.

    connected_id 미전달: /account/create → 새 connected_id 발급
      → 최초 등록 또는 다른 인증수단(인증서 vs ID/PW)으로 추가할 때 사용

    connected_id 전달: /account/add → 기존 connected_id에 기관 추가
      → 인증서 하나로 여러 은행/카드를 하나의 connected_id로 묶을 때 사용

    등록 완료 후 최근 30일 transactions 초기 sync 백그라운드 트리거.
    login_id / login_pw는 CODEF에만 전달되며 저장되지 않음.
    """
    cid = await register_account(
        user_id=request.user_id,
        business_type=request.business_type,
        org_code=request.org_code,
        login_id=request.login_id,
        login_pw=request.login_pw,
        connected_id=request.connected_id,
    )
    asyncio.create_task(_trigger_airflow_sync(request.user_id, days=INITIAL_SYNC_DAYS))
    action = "기관 추가" if request.connected_id else "connected_id 발급"
    return RegisterAccountResponse(
        user_id=request.user_id,
        business_type=request.business_type,
        org_code=request.org_code,
        connected_id=cid,
        message=f"{action} 완료. Airflow 초기 30일 sync 트리거됨.",
    )


@router.post("/transactions/sync", response_model=SyncResponse)
async def transactions_sync(request: SyncRequest):
    from app.services.sync_service import (
        DAILY_SYNC_DAYS, sync_transactions, sync_transactions_env,
    )
    days = request.days if request.days is not None else DAILY_SYNC_DAYS
    try:
        result = await sync_transactions_env(request.user_id, days=days)
    except ValueError as e:
        return SyncResponse(message=f"skip (연동 계정 없음): {e}")
    msg = (
        f"sync 완료 [env] | 기간:{result['period']} "
        f"계좌:{result['bank_saved']} 카드:{result['card_saved']} "
        f"transactions:{result['transactions_merged']}"
    )
    return SyncResponse(message=msg)


@router.post("/mapping/run", response_model=MappingResponse)
async def mapping_run(request: MappingRequest):
    result = await run_mapping(request.user_id, request.start_date, request.end_date)
    return MappingResponse(message=result.get("message", "mapping complete"))




@router.post("/diary/generate", response_model=DiaryGenerateResponse)
async def diary_generate(request: DiaryGenerateRequest):
    result = await generate_diary(request.user_id)
    return DiaryGenerateResponse(message=result.get("message", "diary generated"))


@router.post("/parse-search", response_model=ParseSearchResponse)
async def parse_search(request: ParseSearchRequest):
    result = await parse_search_query(request.query)
    return ParseSearchResponse(**result)


@router.get("/persona/has-photo")
async def persona_has_photo(user_id: int, start_date: str, end_date: str):
    """지난주(start_date~end_date) 기간에 photo-결제 매핑 데이터 존재 여부 반환 (Airflow용)."""
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
