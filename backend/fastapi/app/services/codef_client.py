"""
CODEF API 클라이언트
- OAuth 토큰 발급
- connected_id 생성 (최초 1회)
- 은행/카드 거래내역 조회 (asyncio.gather 병렬)
"""
import asyncio
import base64
import json
import logging
import ssl
from urllib.parse import unquote

import aiohttp

from app.core.config import settings

log = logging.getLogger(__name__)

CODEF_TOKEN_URL = "https://oauth.codef.io/oauth/token"


def _ssl_connector() -> aiohttp.TCPConnector:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return aiohttp.TCPConnector(ssl=ctx)


def new_session() -> aiohttp.ClientSession:
    return aiohttp.ClientSession(connector=_ssl_connector())


def encrypt_rsa(plain: str, public_key: str | None = None) -> str:
    from cryptography.hazmat.primitives.asymmetric import padding
    from cryptography.hazmat.primitives.serialization import load_der_public_key
    key = public_key or settings.CODEF_PUBLIC_KEY
    pub_key = load_der_public_key(base64.b64decode(key))
    encrypted = pub_key.encrypt(plain.encode(), padding.PKCS1v15())
    return base64.b64encode(encrypted).decode()


async def get_access_token(
    session: aiohttp.ClientSession,
    client_id: str | None = None,
    client_secret: str | None = None,
) -> str:
    cid = client_id or settings.CODEF_CLIENT_ID
    csecret = client_secret or settings.CODEF_CLIENT_SECRET
    cred = base64.b64encode(f"{cid}:{csecret}".encode()).decode()
    async with session.post(
        CODEF_TOKEN_URL,
        headers={"Authorization": f"Basic {cred}", "Content-Type": "application/x-www-form-urlencoded"},
        data={"grant_type": "client_credentials", "scope": "read"},
    ) as res:
        return (await res.json())["access_token"]


class CodefRateLimitError(Exception):
    pass


async def _post(
    session: aiohttp.ClientSession,
    token: str,
    endpoint: str,
    payload: dict,
    stop_on: set[str] | None = None,
) -> dict | None:
    url = f"{settings.CODEF_BASE_URL}{endpoint}"
    async with session.post(
        url,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json=payload,
    ) as res:
        data = json.loads(unquote(await res.text()))
        code = data.get("result", {}).get("code", "")
        # errorList 안의 코드도 확인 (CF-04000 래퍼 내부에 실제 오류 코드 포함)
        error_codes = {code}
        for err in data.get("data", {}).get("errorList", []):
            error_codes.add(err.get("code", ""))
        if stop_on and error_codes & stop_on:
            raise CodefRateLimitError(
                f"CODEF 호출 중단 ({error_codes & stop_on}): {endpoint}"
            )
        if code != "CF-00000":
            log.warning(f"CODEF [{code}] {data.get('result', {}).get('message')} | {endpoint} | full={data}")
            return None
        return data.get("data", {})


async def create_connected_id(
    session: aiohttp.ClientSession,
    token: str,
    business_type: str,
    organization: str,
    login_id: str,
    login_pw: str,
    public_key: str | None = None,
) -> str | None:
    """
    최초 1회 → connected_id 신규 발급 (/account/create).
    동일 인증수단으로 기관을 추가할 때는 add_institution() 사용.
    """
    for login_type in ["1", "0"]:
        data = await _post(session, token, "/v1/account/create", {
            "accountList": [{
                "countryCode": "KR",
                "businessType": business_type,
                "clientType": "P",
                "organization": organization,
                "loginType": login_type,
                "id": login_id,
                "password": encrypt_rsa(login_pw, public_key),
            }]
        }, stop_on={"CF-00012"})
        if data:
            cid = data.get("connectedId")
            log.info(f"connected_id 발급 완료: {organization} loginType={login_type} cid={cid}")
            return cid
    log.error(f"connected_id 발급 실패: {organization}")
    return None


async def add_institution(
    session: aiohttp.ClientSession,
    token: str,
    connected_id: str,
    business_type: str,
    organization: str,
    login_id: str,
    login_pw: str,
    public_key: str | None = None,
) -> bool:
    """
    기존 connected_id에 새 기관을 추가 (/account/add).
    동일 인증수단(인증서/ID+PW)으로 여러 기관을 하나의 connected_id로 관리할 때 사용.
    connected_id 1개 → 기관 N개 등록 (CODEF 스펙).
    """
    for login_type in ["1", "0"]:
        data = await _post(session, token, "/v1/account/add", {
            "connectedId": connected_id,
            "accountList": [{
                "countryCode": "KR",
                "businessType": business_type,
                "clientType": "P",
                "organization": organization,
                "loginType": login_type,
                "id": login_id,
                "password": encrypt_rsa(login_pw, public_key),
            }]
        }, stop_on={"CF-00012"})
        if data is not None:
            log.info(f"기관 추가 완료: cid={connected_id} {business_type}/{organization} loginType={login_type}")
            return True
    log.error(f"기관 추가 실패: cid={connected_id} {business_type}/{organization}")
    return False


async def fetch_bank_transactions(
    session: aiohttp.ClientSession,
    token: str,
    connected_id: str,
    org_code: str,
    start_date: str,
    end_date: str,
) -> list[dict]:
    """
    은행 거래내역 조회.
    1) 보유 계좌 목록 조회
    2) 각 계좌 거래내역을 asyncio.gather로 병렬 조회
    """
    accounts_data = await _post(session, token, "/v1/kr/bank/p/account/account-list", {
        "organization": org_code,
        "connectedId": connected_id,
    })
    if not accounts_data:
        return []

    accounts = (
        accounts_data.get("resAccountList")
        or accounts_data.get("resBankAccountList")
        or accounts_data.get("resDepositTrust")
        or (accounts_data if isinstance(accounts_data, list) else [])
    )
    log.info(f"[BK:{org_code}] account-list keys={list(accounts_data.keys())} accounts={[(a.get('resAccount'), a.get('resAccountDeposit')) for a in accounts]}")
    account_nums = [a["resAccount"] for a in accounts if a.get("resAccount")]
    if not account_nums:
        log.warning(f"[BK:{org_code}] 계좌 없음 — account-list raw keys: {list(accounts_data.keys())}")
        return []

    async def _fetch_one(acc_num: str) -> list[dict]:
        data = await _post(session, token, "/v1/kr/bank/p/account/transaction-list", {
            "organization": org_code,
            "connectedId": connected_id,
            "account": acc_num,
            "startDate": start_date,
            "endDate": end_date,
            "orderBy": "0",
            "inquiryType": "1",
        })
        if not data:
            log.warning(f"[BK:{org_code}] transaction-list 실패 account={acc_num}")
            return []
        txs = data.get("resTrHistoryList", [])
        log.info(f"[BK:{org_code}] account={acc_num} → {len(txs)}건")
        for tx in txs:
            tx["_org"] = org_code
            tx["_account"] = acc_num
        return txs

    results = await asyncio.gather(*[_fetch_one(n) for n in account_nums])
    return [tx for batch in results for tx in batch]


async def fetch_card_transactions(
    session: aiohttp.ClientSession,
    token: str,
    connected_id: str,
    org_code: str,
    start_date: str,
    end_date: str,
) -> list[dict]:
    """카드 승인내역 조회"""
    data = await _post(session, token, "/v1/kr/card/p/account/approval-list", {
        "organization": org_code,
        "connectedId": connected_id,
        "startDate": start_date,
        "endDate": end_date,
        "orderBy": "0",
        "inquiryType": "1",
        "memberStoreInfoType": "1",
    })
    if not data:
        return []
    if isinstance(data, list):
        txs = data
    else:
        txs = data.get("resApprovalList", data.get("resList", []))
    for tx in txs:
        tx["_org"] = org_code
    return txs


async def fetch_bank_transactions_by_account(
    session: aiohttp.ClientSession,
    token: str,
    connected_id: str,
    org_code: str,
    account: str,
    start_date: str,
    end_date: str,
) -> list[dict]:
    """
    계좌번호를 직접 지정하여 수시입출 거래내역 조회.
    (account-list 선행 조회 없이 바로 호출)
    5000건 초과 및 commStartDate 불일치 시 WARNING 로깅.
    """
    data = await _post(session, token, "/v1/kr/bank/p/account/transaction-list", {
        "organization": org_code,
        "connectedId": connected_id,
        "account": account,
        "startDate": start_date,
        "endDate": end_date,
        "orderBy": "0",
        "inquiryType": "1",
    })
    if not data:
        return []
    comm_start = data.get("commStartDate", "")
    if comm_start and comm_start != start_date:
        log.warning(
            f"commStartDate({comm_start}) ≠ startDate({start_date}): org={org_code} account={account}"
        )
    txs = data.get("resTrHistoryList", [])
    if len(txs) >= 5000:
        log.warning(f"거래내역 5000건 초과 — 추가 과금 가능: org={org_code} account={account}")
    for tx in txs:
        tx["_org"] = org_code
        tx["_account"] = account
    return txs
