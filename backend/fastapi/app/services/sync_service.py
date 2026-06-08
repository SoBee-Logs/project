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
    add_institution,
    fetch_bank_transactions,
    fetch_card_transactions,
    fetch_bank_transactions_by_account,
)
from app.services.category_mapping_service import resolve_and_update_all_unmapped
from app.services.lifecycle_service import predict_lifecycle
from app.models.schemas import LifecycleRequest

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
    """
    반환 형태 (신규):
      { "cid_abc": [{"businessType": "BK", "organization": "0020"}, ...], ... }

    구형 포맷 자동 마이그레이션:
      {"BK": {"0020": "cid_abc"}, "CD": {"0301": "cid_def"}}
      → {"cid_abc": [{"businessType":"BK","organization":"0020"}],
         "cid_def": [{"businessType":"CD","organization":"0301"}]}
    """
    try:
        resp = _sm_client().get_secret_value(SecretId=f"{_SECRETS_PREFIX}/{user_id}")
        raw = json.loads(resp["SecretString"])
    except ClientError as e:
        if e.response["Error"]["Code"] == "ResourceNotFoundException":
            return {}
        raise

    # 구형 포맷 감지 (key가 "BK" 또는 "CD"인 경우)
    if any(k in ("BK", "CD") for k in raw):
        migrated: dict[str, list] = {}
        for btype, org_map in raw.items():
            for org, cid in org_map.items():
                migrated.setdefault(cid, []).append({"businessType": btype, "organization": org})
        log.info(f"Secrets Manager 구형 포맷 마이그레이션: user={user_id}")
        _write_connected_ids(user_id, migrated)
        return migrated

    return raw


def _write_connected_ids(user_id: int, data: dict) -> None:
    """Secrets Manager에 connected_id 맵 전체를 저장."""
    client = _sm_client()
    secret_id = f"{_SECRETS_PREFIX}/{user_id}"
    payload = json.dumps(data)
    try:
        client.update_secret(SecretId=secret_id, SecretString=payload)
    except ClientError as e:
        if e.response["Error"]["Code"] == "ResourceNotFoundException":
            client.create_secret(Name=secret_id, SecretString=payload)
        else:
            raise


def _save_institution(user_id: int, connected_id: str, business_type: str, org_code: str) -> None:
    """connected_id에 기관(businessType+organization)을 추가 저장."""
    data = _load_connected_ids(user_id)
    institutions = data.setdefault(connected_id, [])
    entry = {"businessType": business_type, "organization": org_code}
    if entry not in institutions:
        institutions.append(entry)
    _write_connected_ids(user_id, data)
    log.info(f"Secrets Manager 저장: user={user_id} cid={connected_id} {business_type}/{org_code}")


# ════════════════════════════════════════
# 온보딩 (최초 1회)
# ════════════════════════════════════════

async def register_account(
    user_id: int,
    business_type: str,      # "BK" | "CD"
    org_code: str,
    login_id: str,
    login_pw: str,
    connected_id: str | None = None,
) -> str:
    """
    금융기관 계정 등록 → Secrets Manager 저장.
    - connected_id=None  : /account/create → 새 connected_id 발급 (최초 or 다른 인증수단)
    - connected_id 전달  : /account/add   → 기존 connected_id에 기관 추가 (동일 인증수단)

    인증수단이 같은 여러 기관(예: 인증서로 KB은행+국민카드)은 하나의 connected_id로 관리.
    login_id/login_pw는 CODEF에만 전달, 어디에도 저장하지 않음.
    """
    async with new_session() as session:
        token = await get_access_token(session)

        if connected_id:
            success = await add_institution(
                session, token, connected_id, business_type, org_code, login_id, login_pw
            )
            if not success:
                raise ValueError(
                    f"기관 추가 실패: user={user_id} cid={connected_id} {business_type}/{org_code}"
                )
            cid = connected_id
        else:
            cid = await create_connected_id(
                session, token, business_type, org_code, login_id, login_pw
            )
            if not cid:
                raise ValueError(
                    f"connected_id 발급 실패: user={user_id} {business_type}/{org_code}"
                )

    _save_institution(user_id, cid, business_type, org_code)
    return cid


def list_connected_ids(user_id: int) -> list[dict]:
    """
    유저의 connected_id 목록과 등록된 기관 목록 반환.
    반환 예시:
      [
        {
          "connected_id": "cid_abc",
          "institutions": [
            {"businessType": "BK", "organization": "0020"},
            {"businessType": "CD", "organization": "0301"}
          ]
        }
      ]
    """
    data = _load_connected_ids(user_id)
    return [
        {"connected_id": cid, "institutions": institutions}
        for cid, institutions in data.items()
    ]


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


async def _upsert_bank_txs(pool, bank_account_id: int, txs: list[dict], start_date: str, end_date: str) -> int:
    if not txs:
        return 0

    def _to_date(s):
        return f"{s[:4]}-{s[4:6]}-{s[6:8]}" if s and len(s) >= 8 else None

    def _to_time(s):
        return f"{s[:2]}:{s[2:4]}:{s[4:6]}" if s and len(s) >= 6 else None

    sd = f"{start_date[:4]}-{start_date[4:6]}-{start_date[6:]}"
    ed = f"{end_date[:4]}-{end_date[4:6]}-{end_date[6:]}"

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
        await conn.begin()
        try:
            async with conn.cursor() as cur:
                await cur.execute(
                    "DELETE FROM bank_transactions WHERE bank_account_id=%s AND tr_date BETWEEN %s AND %s",
                    (bank_account_id, sd, ed),
                )
                await cur.executemany("""
                    INSERT INTO bank_transactions
                        (bank_account_id, tr_date, tr_time,
                         amount_in, amount_out, after_balance,
                         desc1, desc2, desc3, desc4, created_at)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW())
                """, rows)
            await conn.commit()
        except Exception:
            await conn.rollback()
            raise

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


async def _upsert_card_txs(pool, card_id: int, txs: list[dict], start_date: str, end_date: str) -> int:
    if not txs:
        return 0

    def _to_date(s):
        return f"{s[:4]}-{s[4:6]}-{s[6:8]}" if s and len(s) >= 8 else None

    def _to_time(s):
        return f"{s[:2]}:{s[2:4]}:{s[4:6]}" if s and len(s) >= 6 else None

    sd = f"{start_date[:4]}-{start_date[4:6]}-{start_date[6:]}"
    ed = f"{end_date[:4]}-{end_date[4:6]}-{end_date[6:]}"

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
    ]

    async with pool.acquire() as conn:
        await conn.begin()
        try:
            async with conn.cursor() as cur:
                await cur.execute(
                    "DELETE FROM card_transactions WHERE card_id=%s AND used_date BETWEEN %s AND %s",
                    (card_id, sd, ed),
                )
                await cur.executemany("""
                    INSERT INTO card_transactions
                        (card_id, used_date, used_time,
                         member_store_name, member_store_no, member_store_corp_no,
                         member_store_type, member_store_addr,
                         used_amount, payment_type, installment_month,
                         approval_no, home_foreign_type,
                         cancel_yn, cancel_amount, account_currency, krw_amount,
                         created_at)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW())
                """, rows)
            await conn.commit()
        except Exception:
            await conn.rollback()
            raise

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

    # 방법1: desc1~4에 유저 이름 포함된 거래 제거 (토스+현소영, 현소영 등 자기 계좌 이체)
    if user_name:
        for bt in bank_raw:
            descs = " ".join(filter(None, [bt.get(f"desc{i}") for i in range(1, 5)]))
            if user_name in descs:
                self_transfer_ids.add(bt["id"])

    # 방법2: 날짜+금액 일치하는 입출금 쌍 제거 (계좌 간 이체)
    out_index: dict[tuple, list[dict]] = {}
    for bt in bank_raw:
        if bt["amount_out"] > 0:
            key = (bt["tr_date"], bt["amount_out"])
            out_index.setdefault(key, []).append(bt)

    for bt in bank_raw:
        if bt["amount_in"] > 0:
            key = (bt["tr_date"], bt["amount_in"])
            for partner in out_index.get(key, []):
                if partner["id"] not in self_transfer_ids:
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
                if records:
                    await cur.executemany("""
                        INSERT INTO transactions
                            (user_id, payment_date, payment_time,
                            payment_out, payment_in,
                            payment_place, payment_category, payment_address)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                        ON DUPLICATE KEY UPDATE
                            payment_category = VALUES(payment_category),
                            payment_address = VALUES(payment_address)
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


# ════════════════════════════════════════
# ENV 기반 sync (팀원 테스트용)
# ════════════════════════════════════════

async def register_accounts_from_env(
    user_id: int,
    bank_codes: list[str],
    card_codes: list[str],
    force_register: bool = False,
) -> dict:
    """
    사용자가 선택한 org_code를 ENV에서 조회해 CODEF 등록.
    loginId 기준 그룹핑으로 connected_id 최소화.
    force_register=True: 기존 Secrets Manager 항목 삭제 후 재등록 (자격증명 변경 시 사용)
    반환: {"registered": [...], "missing": [...]}
    """
    env_bank = {acc["organization"]: acc for acc in settings.get_codef_bank_accounts()}
    env_card = {acc["organization"]: acc for acc in settings.get_codef_card_accounts()}

    missing = [c for c in bank_codes if c not in env_bank] + \
              [c for c in card_codes if c not in env_card]
    if missing:
        return {"registered": [], "missing": missing}

    to_register = [
        {"businessType": "BK", **env_bank[c]} for c in bank_codes
    ] + [
        {"businessType": "CD", **env_card[c]} for c in card_codes
    ]

    # force_register=True면 기존 Secrets Manager 항목 초기화 후 전체 재등록
    if force_register:
        _write_connected_ids(user_id, {})
        log.info(f"Secrets Manager 초기화 (force_register): user={user_id}")
    else:
        # 이미 Secrets Manager에 등록된 기관은 skip
        existing = _load_connected_ids(user_id)
        registered_set: set[tuple] = {
            (inst["businessType"], inst["organization"])
            for insts in existing.values()
            for inst in insts
        }
        to_register = [
            acc for acc in to_register
            if (acc["businessType"], acc["organization"]) not in registered_set
        ]

    registered: list[str] = []
    if to_register:
        async with new_session() as session:
            token = await get_access_token(session)
            groups: dict[str, list] = {}
            for acc in to_register:
                groups.setdefault(acc["loginId"], []).append(acc)

            for login_id, accs in groups.items():
                cid: str | None = None
                for acc in accs:
                    btype = acc["businessType"]
                    org = acc["organization"]
                    if cid is None:
                        cid = await create_connected_id(
                            session, token, btype, org, acc["loginId"], acc["loginPw"]
                        )
                        if cid:
                            _save_institution(user_id, cid, btype, org)
                            registered.append(org)
                            log.info(f"connected_id 발급: user={user_id} cid={cid} {btype}/{org}")
                    else:
                        ok = await add_institution(
                            session, token, cid, btype, org, acc["loginId"], acc["loginPw"]
                        )
                        if ok:
                            _save_institution(user_id, cid, btype, org)
                            registered.append(org)

    return {"registered": registered, "missing": []}


async def sync_transactions_env(
    user_id: int,
    days: int = INITIAL_SYNC_DAYS,
    start_date: str | None = None,
    end_date: str | None = None,
    skip_avatar: bool = False,
    force_register: bool = False,
) -> dict:
    """
    ENV 기반 sync (팀원 로컬 테스트용).

    ENV 형식:
      CODEF_CARD_ACCOUNTS=[{"organization":"0301","loginId":"myid","loginPw":"mypw","cardName":"신한카드"}]
      CODEF_BANK_ACCOUNTS=[{"organization":"0020","loginId":"myid","loginPw":"mypw","account":"1234567890","bankName":"우리은행"}]

    흐름:
      1. 이미 Secrets Manager에 등록된 (businessType, org)는 skip
      2. 미등록 기관을 connected_id 발급/추가 → Secrets Manager 저장
         - 같은 loginId끼리는 하나의 connected_id로 묶음 (CODEF 1:N 스펙)
      3. sync_transactions(user_id) 호출 → 이후 Secrets Manager 기반 정상 sync

    loginId/loginPw는 CODEF에만 전달, 어디에도 저장되지 않음.
    """
    card_accounts = settings.get_codef_card_accounts()
    bank_accounts = settings.get_codef_bank_accounts()
    if not card_accounts and not bank_accounts:
        raise ValueError("ENV에 CODEF_CARD_ACCOUNTS / CODEF_BANK_ACCOUNTS 설정이 없습니다.")

    # force_register=True면 기존 Secrets Manager 항목 초기화
    if force_register:
        _write_connected_ids(user_id, {})
        log.info(f"Secrets Manager 초기화 (force_register): user={user_id}")
        registered: set[tuple] = set()
    else:
        existing = _load_connected_ids(user_id)
        registered: set[tuple] = {
            (inst["businessType"], inst["organization"])
            for insts in existing.values()
            for inst in insts
        }

    # 미등록 계정만 추려서 businessType 붙여 통합 리스트 구성
    to_register = [
        {"businessType": "CD", **acc}
        for acc in card_accounts
        if ("CD", acc["organization"]) not in registered
    ] + [
        {"businessType": "BK", **acc}
        for acc in bank_accounts
        if ("BK", acc["organization"]) not in registered
    ]

    if to_register:
        async with new_session() as session:
            token = await get_access_token(session)

            # 같은 loginId끼리 그룹핑 → 동일 자격증명이면 하나의 connected_id로 묶음
            groups: dict[str, list] = {}
            for acc in to_register:
                groups.setdefault(acc["loginId"], []).append(acc)

            for login_id, accs in groups.items():
                cid: str | None = None
                for acc in accs:
                    btype = acc["businessType"]
                    org   = acc["organization"]
                    if cid is None:
                        cid = await create_connected_id(
                            session, token, btype, org, acc["loginId"], acc["loginPw"]
                        )
                        if cid:
                            _save_institution(user_id, cid, btype, org)
                            log.info(f"connected_id 발급: user={user_id} cid={cid} {btype}/{org}")
                    else:
                        ok = await add_institution(
                            session, token, cid, btype, org, acc["loginId"], acc["loginPw"]
                        )
                        if ok:
                            _save_institution(user_id, cid, btype, org)

    # 등록 완료 후 Secrets Manager 기반 일반 sync 실행
    return await sync_transactions(user_id, days=days, skip_avatar=skip_avatar)


def _sync_date_range(days: int) -> tuple[str, str]:
    end = datetime.now()
    start = end - timedelta(days=days)
    return start.strftime("%Y%m%d"), end.strftime("%Y%m%d")


async def sync_transactions(user_id: int, days: int = DAILY_SYNC_DAYS, skip_avatar: bool = False) -> dict:
    """
    Airflow DAG / 최초 가입 후 호출 (Secrets Manager 모드).

    Secrets Manager 형태: {connected_id: [{"businessType":"BK","organization":"0020"}, ...]}
    → 하나의 connected_id로 등록된 모든 기관을 병렬 조회.

    days=DAILY_SYNC_DAYS (3) : Airflow 일별 동기화
    days=INITIAL_SYNC_DAYS (30): 최초 가입 시 전체 fetch
    """
    connected_id_map = _load_connected_ids(user_id)
    if not connected_id_map:
        raise ValueError(
            f"user_id={user_id}의 connected_id가 없습니다. register_account()를 먼저 호출하세요."
        )

    start_date, end_date = _sync_date_range(days)
    log.info(
        f"동기화 시작: user={user_id} {start_date}~{end_date} "
        f"connected_ids={list(connected_id_map.keys())}"
    )

    pool = await get_pool()
    bank_saved = card_saved = 0

    # (connected_id, organization) 메타 정보 수집
    bank_meta: list[tuple[str, str]] = []  # [(cid, org), ...]
    card_meta: list[tuple[str, str]] = []

    async with new_session() as session:
        token = await get_access_token(session)

        bank_tasks = []
        card_tasks = []

        for cid, institutions in connected_id_map.items():
            for inst in institutions:
                btype = inst["businessType"]
                org   = inst["organization"]
                if btype == "BK":
                    bank_tasks.append(
                        fetch_bank_transactions(session, token, cid, org, start_date, end_date)
                    )
                    bank_meta.append((cid, org))
                elif btype == "CD":
                    card_tasks.append(
                        fetch_card_transactions(session, token, cid, org, start_date, end_date)
                    )
                    card_meta.append((cid, org))

        results = await asyncio.gather(*bank_tasks, *card_tasks, return_exceptions=True)

    bank_results = results[:len(bank_tasks)]
    card_results = results[len(bank_tasks):]

    # 은행 저장
    for (cid, org), result in zip(bank_meta, bank_results):
        if isinstance(result, Exception):
            log.error(f"은행 조회 실패 cid={cid} org={org}: {result}")
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
                bank_saved += await _upsert_bank_txs(pool, bank_account_id, txs, start_date, end_date)

    # 카드 저장
    for (cid, org), result in zip(card_meta, card_results):
        if isinstance(result, Exception):
            log.error(f"카드 조회 실패 cid={cid} org={org}: {result}")
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
                card_saved += await _upsert_card_txs(pool, card_id, txs, start_date, end_date)

    # transactions 병합 (해당 기간 DELETE → INSERT, 멱등)
    merged = await _merge_to_transactions(pool, user_id, start_date, end_date)

    # 카테고리 매핑 — 룰베이스 → 기타 남은 건 LLM 자동 체이닝
    mapping_result = {}
    try:
        mapping_result = await resolve_and_update_all_unmapped()
        log.info(f"카테고리 매핑 완료: {mapping_result}")
    except Exception as e:
        log.error(f"카테고리 매핑 실패 (sync는 정상 완료): {e}")

    # 생애주기 예측 — 매핑 완료 후 트랜잭션 기반으로 예측 → users.life_stage_code 저장
    lifecycle_result = {}
    try:
        lifecycle_resp = await predict_lifecycle(LifecycleRequest(user_id=user_id))
        lifecycle_result = {"life_stage_code": lifecycle_resp.life_stage_code}
        log.info(f"생애주기 예측 완료: user={user_id} → {lifecycle_resp.life_stage_code}")
    except Exception as e:
        log.error(f"생애주기 예측 실패 (sync는 정상 완료): {e}")

    return {
        "user_id": user_id,
        "period": f"{start_date}~{end_date}",
        "bank_saved": bank_saved,
        "card_saved": card_saved,
        "transactions_merged": merged,
        "mapping": mapping_result,
        "lifecycle": lifecycle_result,
    }