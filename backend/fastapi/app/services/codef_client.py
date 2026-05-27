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


def encrypt_rsa(plain: str) -> str:
    from cryptography.hazmat.primitives.asymmetric import padding
    from cryptography.hazmat.primitives.serialization import load_der_public_key
    pub_key = load_der_public_key(base64.b64decode(settings.CODEF_PUBLIC_KEY))
    encrypted = pub_key.encrypt(plain.encode(), padding.PKCS1v15())
    return base64.b64encode(encrypted).decode()


async def get_access_token(session: aiohttp.ClientSession) -> str:
    cred = base64.b64encode(
        f"{settings.CODEF_CLIENT_ID}:{settings.CODEF_CLIENT_SECRET}".encode()
    ).decode()
    async with session.post(
        CODEF_TOKEN_URL,
        headers={"Authorization": f"Basic {cred}", "Content-Type": "application/x-www-form-urlencoded"},
        data={"grant_type": "client_credentials", "scope": "read"},
    ) as res:
        return (await res.json())["access_token"]


async def _post(session: aiohttp.ClientSession, token: str, endpoint: str, payload: dict) -> dict | None:
    url = f"{settings.CODEF_BASE_URL}{endpoint}"
    async with session.post(
        url,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json=payload,
    ) as res:
        data = json.loads(unquote(await res.text()))
        code = data.get("result", {}).get("code", "")
        if code != "CF-00000":
            log.warning(f"CODEF [{code}] {data.get('result', {}).get('message')} | {endpoint}")
            return None
        return data.get("data", {})


async def create_connected_id(
    session: aiohttp.ClientSession,
    token: str,
    business_type: str,
    organization: str,
    login_id: str,
    login_pw: str,
) -> str | None:
    """최초 1회 호출 → connected_id 발급. 이후 Secrets Manager에 저장해 재사용."""
    for login_type in ["1", "0"]:
        data = await _post(session, token, "/v1/account/create", {
            "accountList": [{
                "countryCode": "KR",
                "businessType": business_type,
                "clientType": "P",
                "organization": organization,
                "loginType": login_type,
                "id": login_id,
                "password": encrypt_rsa(login_pw),
            }]
        })
        if data:
            cid = data.get("connectedId")
            log.info(f"connected_id 발급 완료: {organization} (loginType={login_type})")
            return cid
    log.error(f"connected_id 발급 실패: {organization}")
    return None


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
    account_nums = [a["resAccount"] for a in accounts if a.get("resAccount")]
    if not account_nums:
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
            return []
        txs = data.get("resTrHistoryList", [])
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
