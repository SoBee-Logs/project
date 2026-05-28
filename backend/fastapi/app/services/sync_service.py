"""
sync_service.py
────────────────────────────────────────────────────────
CODEF API → bank_accounts / bank_transactions / cards / card_transactions 적재
→ transactions 병합

connected_id 저장소: AWS Secrets Manager
  키: sobee/codef/{user_id}
  값: {"BK": {"0020": "cid_xxx"}, "CD": {"0301": "cid_yyy"}}

온보딩 흐름 (최초 1회):
  register_account() → connected_id 발급 → Secrets Manager 저장

일별 동기화:
  sync_transactions(user_id) → Secrets Manager에서 connected_id 조회
  → 기관별 병렬 호출 → DB 저장 → transactions 병합 → 카테고리 매핑
"""
import asyncio
import json
import logging
from datetime import datetime, timedelta

import aiomysql
import boto3
from botocore.exceptions import ClientError

from app.core.config import settings
from app.db.connection import get_pool
from app.services.codef_client import (
    new_session,
    get_access_token,
    create_connected_id,
    fetch_bank_transactions,
    fetch_card_transactions,
)
from app.services.category_mapping_service import resolve_and_update_all_unmapped  # ✅ 추가

log = logging.getLogger(__name__)

_SECRETS_PREFIX = "sobee/codef"


# ════════════════════════════════════════
# Secrets Manager
# ════════════════════════════════════════

def _sm_client():
    return boto3.client(
        "secretsmanager",
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION,
    )


def _load_connected_ids(user_id: int) -> dict:
    """반환 형태: {"BK": {"0020": "cid_xxx"}, "CD": {"0301": "cid_yyy"}}"""
    try:
        resp = _sm_client().get_secret_value(SecretId=f"{_SECRETS_PREFIX}/{user_id}")
        return json.loads(resp["SecretString"])
    except ClientError as e:
        if e.response["Error"]["Code"] == "ResourceNotFoundException":
            return {}
        raise


def _save_connected_id(user_id: int, business_type: str, org_code: str, connected_id: str) -> None:
    data = _load_connected_ids(user_id)
    data.setdefault(business_type, {})[org_code] = connected_id
    client = _sm_client()
    secret_id = f"{_SECRETS_PREFIX}/{user_id}"
    try:
        client.update_secret(SecretId=secret_id, SecretString=json.dumps(data))
    except ClientError as e:
        if e.response["Error"]["Code"] == "ResourceNotFoundException":
            client.create_secret(Name=secret_id, SecretString=json.dumps(data))
        else:
            raise
    log.info(f"Secrets Manager 저장: user={user_id} {business_type}/{org_code}")


# ════════════════════════════════════════
# 온보딩 (최초 1회)
# ════════════════════════════════════════

async def register_account(
    user_id: int,
    business_type: str,   # "BK" | "CD"
    org_code: str,
    login_id: str,
    login_pw: str,
) -> str:
    """
    사용자 금융기관 계정 등록 → connected_id 발급 후 Secrets Manager 저장.
    실제 자격증명(login_id, login_pw)은 CODEF에만 전달되며 어디에도 저장하지 않음.
    """
    async with new_session() as session:
        token = await get_access_token(session)
        cid = await create_connected_id(session, token, business_type, org_code, login_id, login_pw)

    if not cid:
        raise ValueError(f"connected_id 발급 실패: user={user_id} {business_type}/{org_code}")

    _save_connected_id(user_id, business_type, org_code, cid)
    return cid


# ════════════════════════════════════════
# DB 저장 — 은행
# ════════════════════════════════════════

async def _upsert_bank_account(pool, user_id: int, org_code: str, acct: dict) -> int:
    """bank_accounts UPSERT → 해당 행의 id 반환"""
    sql = """
        INSERT INTO bank_accounts
            (user_id, organization, res_account, res_account_display,
             res_account_name, res_account_deposit, res_account_currency,
             res_account_balance, res_account_start_date, res_last_tran_date,
             created_at)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW())
        ON DUPLICATE KEY UPDATE
            res_account_balance  = VALUES(res_account_balance),
            res_last_tran_date   = VALUES(res_last_tran_date)
    """

    def _to_date(s: str) -> str | None:
        if not s or len(s) < 8:
            return None
        return f"{s[:4]}-{s[4:6]}-{s[6:8]}"

    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(sql, (
                user_id, org_code,
                acct.get("resAccount", ""),
                acct.get("resAccountDisplay", ""),
                acct.get("resAccountName", ""),
                acct.get("resAccountDeposit", ""),
                acct.get("resAccountCurrency", "KRW"),
                float(acct.get("resAccountBalance") or 0),
                _to_date(acct.get("resAccountStartDate", "")),
                _to_date(acct.get("resLastTranDate", "")),
            ))
            await cur.execute(
                "SELECT id FROM bank_accounts WHERE user_id=%s AND res_account=%s",
                (user_id, acct.get("resAccount", "")),
            )
            row = await cur.fetchone()
        await conn.commit()
    return row[0] if row else 0


async def _upsert_bank_txs(pool, bank_account_id: int, txs: list[dict]) -> int:
    if not txs:
        return 0

    def _to_date(s):
        return f"{s[:4]}-{s[4:6]}-{s[6:8]}" if s and len(s) >= 8 else None

    def _to_time(s):
        return f"{s[:2]}:{s[2:4]}:{s[4:6]}" if s and len(s) >= 6 else None

    sql = """
        INSERT INTO bank_transactions
            (bank_account_id, tr_date, tr_time,
             amount_in, amount_out, after_balance,
             desc1, desc2, desc3, desc4, created_at)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW())
        ON DUPLICATE KEY UPDATE
            after_balance = VALUES(after_balance)
    """
    rows = [
        (
            bank_account_id,
            _to_date(tx.get("resAccountTrDate", "")),
            _to_time(tx.get("resAccountTrTime", "")),
            float(tx.get("resAccountIn") or 0),
            float(tx.get("resAccountOut") or 0),
            float(tx.get("resAfterTranBalance") or 0),
            tx.get("resAccountDesc1", ""),
            tx.get("resAccountDesc2", ""),
            tx.get("resAccountDesc3", ""),
            tx.get("resAccountDesc4", ""),
        )
        for tx in txs
    ]
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.executemany(sql, rows)
        await conn.commit()
    return len(rows)


# ════════════════════════════════════════
# DB 저장 — 카드
# ════════════════════════════════════════

async def _upsert_card(pool, user_id: int, org_code: str, card: dict) -> int:
    """cards UPSERT → 해당 행의 card_id 반환"""
    sql = """
        INSERT INTO cards
            (user_id, organization, res_card_no, res_card_name,
             res_card_type, res_sleep_yn, res_traffic_yn,
             res_state, res_image_link, created_at)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW())
        ON DUPLICATE KEY UPDATE
            res_card_name  = VALUES(res_card_name),
            res_sleep_yn   = VALUES(res_sleep_yn),
            res_state      = VALUES(res_state),
            res_image_link = VALUES(res_image_link)
    """
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(sql, (
                user_id, org_code,
                card.get("resCardNo", ""),
                card.get("resCardName", ""),
                card.get("resCardType", ""),
                card.get("resSleepYN", "N"),
                card.get("resTrafficYN", "N"),
                card.get("resState", ""),
                card.get("resImageLink", ""),
            ))
            await cur.execute(
                "SELECT card_id FROM cards WHERE user_id=%s AND res_card_no=%s",
                (user_id, card.get("resCardNo", "")),
            )
            row = await cur.fetchone()
        await conn.commit()
    return row[0] if row else 0


async def _upsert_card_txs(pool, card_id: int, txs: list[dict]) -> int:
    if not txs:
        return 0

    def _to_date(s):
        return f"{s[:4]}-{s[4:6]}-{s[6:8]}" if s and len(s) >= 8 else None

    def _to_time(s):
        return f"{s[:2]}:{s[2:4]}:{s[4:6]}" if s and len(s) >= 6 else None

    sql = """
        INSERT INTO card_transactions
            (card_id, used_date, used_time,
             member_store_name, member_store_no, member_store_corp_no,
             member_store_type, member_store_addr,
             used_amount, payment_type, installment_month,
             approval_no, home_foreign_type,
             cancel_yn, cancel_amount, account_currency, krw_amount,
             created_at)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW())
        ON DUPLICATE KEY UPDATE
            member_store_name = VALUES(member_store_name),
            cancel_yn         = VALUES(cancel_yn),
            cancel_amount     = VALUES(cancel_amount)
    """
    rows = [
        (
            card_id,
            _to_date(tx.get("resUsedDate", "")),
            _to_time(tx.get("resUsedTime", "")),
            tx.get("resMemberStoreName", ""),
            tx.get("resMemberStoreNo", ""),
            tx.get("resMemberStoreCorpNo", ""),
            tx.get("resMemberStoreType", ""),
            tx.get("resMemberStoreAddr", ""),
            float(tx.get("resUsedAmount") or 0),
            tx.get("resPaymentType", "1"),
            int(tx.get("resInstallmentMonth") or 0),
            tx.get("resApprovalNo", ""),
            tx.get("resHomeForeignType", "1"),
            tx.get("resCancelYN", "0"),
            float(tx.get("resCancelAmount") or 0),
            tx.get("resAccountCurrency", "KRW"),
            float(tx.get("resKRWAmt") or 0),
        )
        for tx in txs
        if tx.get("resApprovalNo")
    ]
    if not rows:
        return 0
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.executemany(sql, rows)
        await conn.commit()
    return len(rows)


# ════════════════════════════════════════
# transactions 병합
# ════════════════════════════════════════

async def _get_user_name(pool, user_id: int) -> str:
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("SELECT name FROM users WHERE user_id = %s", (user_id,))
            row = await cur.fetchone()
    return row[0] if row else ""


async def _merge_to_transactions(pool, user_id: int, start_date: str, end_date: str) -> int:
    """
    card_transactions + bank_transactions → transactions 병합.

    카드 처리:
      1. 취소 내역 제거 (cancel_yn != '0' 또는 cancel_amount > 0)
      2. 계좌와 날짜·시간·금액이 일치하는 건 찾기 (체크카드)
      3. 체크카드 → transactions INSERT, 매칭된 계좌 행 제거
      4. 나머지 카드(신용카드) → transactions INSERT

    계좌 처리:
      1. 자기 이체 제거 (날짜·시간·금액 일치하는 입출금 쌍 + desc3에 사용자 이름)
      2. 카드와 매칭된 행 제거 (위 체크카드 매칭에서 식별)
      3. desc3에 '캐시백', '이자' 포함된 입금 제거
      4. 나머지 계좌 내역 → transactions INSERT

    멱등성: 동기화 기간을 DELETE 후 INSERT (같은 기간으로 재실행해도 결과 동일).
    DELETE/INSERT는 단일 트랜잭션으로 묶어 원자성 보장.
    """
    sd = f"{start_date[:4]}-{start_date[4:6]}-{start_date[6:]}"
    ed = f"{end_date[:4]}-{end_date[4:6]}-{end_date[6:]}"

    user_name = await _get_user_name(pool, user_id)

    # ── 원본 데이터 로드 ──────────────────────────────────────
    async with pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute("""
                SELECT ct.card_transaction_id AS id,
                       ct.used_date, ct.used_time, ct.used_amount,
                       ct.member_store_name, ct.member_store_addr, ct.member_store_type,
                       ct.cancel_yn, ct.cancel_amount
                FROM card_transactions ct
                JOIN cards c ON ct.card_id = c.card_id
                WHERE c.user_id = %s AND ct.used_date BETWEEN %s AND %s
            """, (user_id, sd, ed))
            card_raw = await cur.fetchall()

            await cur.execute("""
                SELECT bt.bank_transaction_id AS id,
                       bt.tr_date, bt.tr_time, bt.amount_in, bt.amount_out,
                       bt.desc1, bt.desc2, bt.desc3, bt.desc4
                FROM bank_transactions bt
                JOIN bank_accounts ba ON bt.bank_account_id = ba.id
                WHERE ba.user_id = %s
                  AND (bt.amount_in > 0 OR bt.amount_out > 0)
                  AND bt.tr_date BETWEEN %s AND %s
            """, (user_id, sd, ed))
            bank_raw = await cur.fetchall()

    # ── 카드: 취소 내역 제거 ──────────────────────────────────
    card_valid = [
        ct for ct in card_raw
        if ct["cancel_yn"] == "0" and (ct["cancel_amount"] or 0) == 0 and ct["used_amount"] > 0
    ]

    # ── 계좌: 자기 이체 제거 ─────────────────────────────────
    self_transfer_ids: set[int] = set()
    if user_name:
        out_index: dict[tuple, list[dict]] = {}
        for bt in bank_raw:
            if bt["amount_out"] > 0:
                key = (bt["tr_date"], bt["tr_time"], bt["amount_out"])
                out_index.setdefault(key, []).append(bt)

        for bt in bank_raw:
            if bt["amount_in"] > 0:
                key = (bt["tr_date"], bt["tr_time"], bt["amount_in"])
                for partner in out_index.get(key, []):
                    if partner["id"] in self_transfer_ids:
                        continue
                    desc3_bt = bt.get("desc3") or ""
                    desc3_partner = partner.get("desc3") or ""
                    if user_name in desc3_bt or user_name in desc3_partner:
                        self_transfer_ids.add(bt["id"])
                        self_transfer_ids.add(partner["id"])

    bank_valid = [bt for bt in bank_raw if bt["id"] not in self_transfer_ids]

    # ── 체크카드 매칭: 카드·계좌 날짜·시간·금액 일치 ────────────
    bank_out_index: dict[tuple, dict] = {}
    for bt in bank_valid:
        if bt["amount_out"] > 0:
            key = (bt["tr_date"], bt["tr_time"], bt["amount_out"])
            bank_out_index.setdefault(key, bt)

    debit_card: list[dict] = []
    credit_card: list[dict] = []
    matched_bank_ids: set[int] = set()

    for ct in card_valid:
        key = (ct["used_date"], ct["used_time"], ct["used_amount"])
        match = bank_out_index.get(key)
        if match and match["id"] not in matched_bank_ids:
            debit_card.append(ct)
            matched_bank_ids.add(match["id"])
        else:
            credit_card.append(ct)

    # ── 계좌: 체크카드 매칭분 + 캐시백·이자 제거 ───────────────
    _EXCLUDE = {"캐시백", "이자"}
    bank_final = [
        bt for bt in bank_valid
        if bt["id"] not in matched_bank_ids
        and not any(kw in (bt.get("desc3") or "") for kw in _EXCLUDE)
    ]

    # ── transactions 레코드 구성 ──────────────────────────────
    records: list[tuple] = []

    for ct in debit_card + credit_card:
        records.append((
            user_id,
            ct["used_date"],
            ct["used_time"],
            ct["used_amount"],
            0,
            ct.get("member_store_name"),
            ct.get("member_store_type"),
            ct.get("member_store_addr"),
        ))

    for bt in bank_final:
        records.append((
            user_id,
            bt["tr_date"],
            bt["tr_time"],
            bt["amount_out"],
            bt["amount_in"],
            bt.get("desc3"),
            bt.get("desc2"),
            None,
        ))

    # ── DELETE → INSERT (해당 기간만, 멱등 보장) ────────────
    async with pool.acquire() as conn:
        await conn.begin()
        try:
            async with conn.cursor() as cur:
                await cur.execute(
                    "DELETE FROM transactions WHERE user_id=%s AND payment_date BETWEEN %s AND %s",
                    (user_id, sd, ed),
                )
                if records:
                    await cur.executemany("""
                        INSERT INTO transactions
                            (user_id, payment_date, payment_time,
                             payment_out, payment_in,
                             payment_place, payment_category, payment_address)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                    """, records)
            await conn.commit()
        except Exception:
            await conn.rollback()
            raise

    log.info(
        f"transactions 병합: user={user_id} "
        f"체크카드={len(debit_card)} 신용카드={len(credit_card)} 계좌={len(bank_final)} "
        f"(자기이체제거={len(self_transfer_ids)//2} 체크매칭={len(matched_bank_ids)})"
    )
    return len(records)


# ════════════════════════════════════════
# 메인 동기화
# ════════════════════════════════════════

DAILY_SYNC_DAYS = 3
INITIAL_SYNC_DAYS = 30


def _sync_date_range(days: int) -> tuple[str, str]:
    end = datetime.now()
    start = end - timedelta(days=days)
    return start.strftime("%Y%m%d"), end.strftime("%Y%m%d")


async def sync_transactions(user_id: int, days: int = DAILY_SYNC_DAYS) -> dict:
    """
    Airflow DAG / 최초 가입 후 호출하는 메인 함수.
    1. Secrets Manager에서 connected_id 조회
    2. 은행/카드 기관별 병렬 API 호출
    3. bank_accounts → bank_transactions, cards → card_transactions 저장
    4. transactions 병합 (해당 기간만 DELETE → INSERT, 멱등 보장)
    5. 카테고리 매핑 (룰베이스 → LLM 체이닝)  ✅ 추가

    days=DAILY_SYNC_DAYS : 일별 동기화 (Airflow)
    days=INITIAL_SYNC_DAYS: 최초 가입 시 30일 전체 fetch
    """
    connected_ids = _load_connected_ids(user_id)
    if not connected_ids:
        raise ValueError(f"user_id={user_id}의 connected_id가 없습니다. register_account()를 먼저 호출하세요.")

    start_date, end_date = _sync_date_range(days)
    log.info(f"동기화 시작: user={user_id} {start_date}~{end_date}")

    pool = await get_pool()
    bank_saved = card_saved = 0

    async with new_session() as session:
        token = await get_access_token(session)

        bank_orgs = list(connected_ids.get("BK", {}).items())
        card_orgs  = list(connected_ids.get("CD", {}).items())

        bank_tasks = [
            fetch_bank_transactions(session, token, cid, org, start_date, end_date)
            for org, cid in bank_orgs
        ]
        card_tasks = [
            fetch_card_transactions(session, token, cid, org, start_date, end_date)
            for org, cid in card_orgs
        ]

        results = await asyncio.gather(*bank_tasks, *card_tasks, return_exceptions=True)

    bank_results = results[:len(bank_tasks)]
    card_results = results[len(bank_tasks):]

    # 은행 저장
    for (org, _), result in zip(bank_orgs, bank_results):
        if isinstance(result, Exception):
            log.error(f"은행 조회 실패 {org}: {result}")
            continue
        acct_map: dict[str, list] = {}
        for tx in result:
            acct_map.setdefault(tx.get("_account", ""), []).append(tx)

        for acc_num, txs in acct_map.items():
            bank_account_id = await _upsert_bank_account(pool, user_id, org, {
                "resAccount": acc_num,
                "resAccountDisplay": acc_num,
                "resAccountName": "",
                "resAccountDeposit": "11",
                "resAccountCurrency": "KRW",
                "resAccountBalance": "0",
            })
            if bank_account_id:
                saved = await _upsert_bank_txs(pool, bank_account_id, txs)
                bank_saved += saved

    # 카드 저장
    for (org, _), result in zip(card_orgs, card_results):
        if isinstance(result, Exception):
            log.error(f"카드 조회 실패 {org}: {result}")
            continue
        card_map: dict[str, list] = {}
        for tx in result:
            card_map.setdefault(tx.get("resCardNo", ""), []).append(tx)

        for card_no, txs in card_map.items():
            card_id = await _upsert_card(pool, user_id, org, {
                "resCardNo": card_no,
                "resCardName": txs[0].get("resCardName", ""),
            })
            if card_id:
                saved = await _upsert_card_txs(pool, card_id, txs)
                card_saved += saved

    # transactions 병합
    merged = await _merge_to_transactions(pool, user_id, start_date, end_date)

    # ✅ 카테고리 매핑 — 룰베이스 → 기타 남은 건 LLM 자동 체이닝
    mapping_result = {}
    try:
        mapping_result = await resolve_and_update_all_unmapped()
        log.info(f"카테고리 매핑 완료: {mapping_result}")
    except Exception as e:
        log.error(f"카테고리 매핑 실패 (sync는 정상 완료): {e}")

    return {
        "user_id": user_id,
        "period": f"{start_date}~{end_date}",
        "bank_saved": bank_saved,
        "card_saved": card_saved,
        "transactions_merged": merged,
        "mapping": mapping_result,  # ✅ 추가
    }