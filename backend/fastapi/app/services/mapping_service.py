import logging
from datetime import datetime, timedelta
from typing import Optional

import aiomysql

from app.db.connection import get_pool

log = logging.getLogger(__name__)


def _timedelta_to_timestr(t) -> str:
    """MySQL TIME 타입(timedelta) → 'HH:MM:SS'"""
    if t is None:
        return "00:00:00"
    if isinstance(t, timedelta):
        total = int(t.total_seconds())
        h, m, s = total // 3600, (total % 3600) // 60, total % 60
        return f"{h:02d}:{m:02d}:{s:02d}"
    return str(t)[:8]


def _to_datetime_str(value) -> str:
    """datetime 객체 → 'YYYY-MM-DD HH:MM:SS'"""
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M:%S")
    return str(value)[:19]


def _payment_datetime_str(payment_date, payment_time) -> str:
    """DATE + TIME(timedelta) → 'YYYY-MM-DD HH:MM:SS'"""
    date_str = str(payment_date)[:10] if payment_date else "0000-00-00"
    return f"{date_str} {_timedelta_to_timestr(payment_time)}"


async def _get_last_mapped_checkpoint(conn, user_id: int) -> Optional[datetime]:
    """persona_transaction 기준 마지막으로 매핑된 결제의 datetime 반환."""
    async with conn.cursor() as cur:
        await cur.execute(
            """
            SELECT MAX(TIMESTAMP(t.payment_date, t.payment_time)) AS last_dt
            FROM persona_transaction pt
            JOIN transactions t ON pt.payment_id = CONVERT(t.payment_id, CHAR)
            WHERE pt.user_id = %s
            """,
            (user_id,),
        )
        row = await cur.fetchone()
    if not row or row[0] is None:
        return None
    val = row[0]
    if isinstance(val, datetime):
        return val
    try:
        return datetime.strptime(str(val)[:19], "%Y-%m-%d %H:%M:%S")
    except Exception:
        return None


async def _get_unmapped_photos(conn, user_id: int, start_date: str, end_date: str) -> list[dict]:
    """날짜 범위 내 persona_transaction에 없는 사진의 VLM 데이터 조회."""
    async with conn.cursor(aiomysql.DictCursor) as cur:
        await cur.execute(
            """
            SELECT
                p.photo_id, pm.taken_at,
                pvr.vlm_id, pvr.vlm_category,
                pvr.vlm_item_name, pvr.vlm_price_estimate,
                pvr.vlm_store_type, pvr.vlm_store_name,
                pvr.vlm_description, pvr.vlm_address
            FROM photos p
            JOIN photo_metadata pm ON p.photo_id = pm.photo_id
            JOIN photo_vlm_results pvr ON p.photo_id = pvr.photo_id
            WHERE p.user_id = %s
              AND DATE(pm.taken_at) BETWEEN %s AND %s
              AND p.is_valid = TRUE
              AND pm.taken_at IS NOT NULL
              AND p.photo_id NOT IN (
                  SELECT photo_id FROM persona_transaction WHERE user_id = %s
              )
            ORDER BY pm.taken_at ASC
            """,
            (user_id, start_date, end_date, user_id),
        )
        rows = await cur.fetchall()
    return [dict(row) for row in rows]


async def _get_transaction_candidates(
    conn, user_id: int, start_date: str, end_date: str, checkpoint: Optional[datetime]
) -> list[dict]:
    """날짜 범위 내 결제 후보 조회. checkpoint 이후 미매핑 결제만 반환."""
    async with conn.cursor(aiomysql.DictCursor) as cur:
        if checkpoint:
            await cur.execute(
                """
                SELECT payment_id, payment_date, payment_time, payment_out,
                       payment_place, payment_category, payment_address
                FROM transactions
                WHERE user_id = %s
                  AND payment_date BETWEEN %s AND %s
                  AND TIMESTAMP(payment_date, payment_time) > %s
                ORDER BY payment_date ASC, payment_time ASC
                """,
                (user_id, start_date, end_date, checkpoint),
            )
        else:
            await cur.execute(
                """
                SELECT payment_id, payment_date, payment_time, payment_out,
                       payment_place, payment_category, payment_address
                FROM transactions
                WHERE user_id = %s
                  AND payment_date BETWEEN %s AND %s
                ORDER BY payment_date ASC, payment_time ASC
                """,
                (user_id, start_date, end_date),
            )
        rows = await cur.fetchall()
    return [dict(row) for row in rows]


async def _save_mapping(conn, user_id: int, photo_id: int, vlm_id: int, payment_id: int) -> None:
    async with conn.cursor() as cur:
        await cur.execute(
            "INSERT INTO persona_transaction (vlm_id, photo_id, payment_id, user_id) VALUES (%s, %s, %s, %s)",
            (vlm_id, photo_id, str(payment_id), user_id),
        )


async def run_mapping(
    user_id: int,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> dict:
    """
    photo_vlm_results ↔ transactions 매핑 후 persona_transaction에 저장.
    - start_date/end_date 미전달 시 당일 기준 (일기 생성용)
    - 페르소나 아바타 생성 시: 지난주 월~일 범위로 호출
    - 데이터 정합성: persona_transaction의 마지막 매핑 payment_time 이후 결제만 후보로 사용
    """
    # 순환 임포트 방지를 위해 지연 임포트
    from app.api.mapping import match_photo_to_transaction
    from app.api.mapping import MappingRequest, VlmData, TransactionCandidate

    if not start_date or not end_date:
        today = datetime.today().strftime("%Y-%m-%d")
        start_date = end_date = today

    pool = await get_pool()
    async with pool.acquire() as conn:
        checkpoint = await _get_last_mapped_checkpoint(conn, user_id)
        log.info(f"[매핑] user={user_id} 범위={start_date}~{end_date} checkpoint={checkpoint}")

        photos = await _get_unmapped_photos(conn, user_id, start_date, end_date)
        if not photos:
            log.info(f"[매핑] 매핑할 사진 없음: user={user_id}")
            return {"message": f"매핑할 사진 없음 ({start_date}~{end_date})", "mapped": 0}

        candidates_raw = await _get_transaction_candidates(conn, user_id, start_date, end_date, checkpoint)
        if not candidates_raw:
            log.info(f"[매핑] 매핑할 결제 없음: user={user_id}")
            return {"message": f"매핑할 결제 없음 ({start_date}~{end_date})", "mapped": 0}

        log.info(f"[매핑] 사진={len(photos)}장 결제후보={len(candidates_raw)}건")

        # DB row → TransactionCandidate 변환 (payment_time: DATE+TIME → 'YYYY-MM-DD HH:MM:SS')
        candidates = [
            TransactionCandidate(
                payment_id=row["payment_id"],
                payment_out=row.get("payment_out"),
                payment_time=_payment_datetime_str(row.get("payment_date"), row.get("payment_time")),
                payment_place=row.get("payment_place"),
                payment_category=row.get("payment_category"),
                payment_address=row.get("payment_address"),
            )
            for row in candidates_raw
        ]

        mapped_count = 0
        for photo in photos:
            vlm_data = VlmData(
                category=photo.get("vlm_category"),
                item_name=photo.get("vlm_item_name"),
                price_estimate=float(photo["vlm_price_estimate"]) if photo.get("vlm_price_estimate") else None,
                store_type=photo.get("vlm_store_type"),
                store_name=photo.get("vlm_store_name"),
                description=photo.get("vlm_description"),
                taken_at=_to_datetime_str(photo["taken_at"]) if photo.get("taken_at") else None,
                store_address=photo.get("vlm_address"),
            )
            req = MappingRequest(
                photo_id=photo["photo_id"],
                user_id=user_id,
                vlm_data=vlm_data,
                candidates=candidates,
            )

            result = await match_photo_to_transaction(req)

            if result.payment_id is not None:
                await _save_mapping(conn, user_id, photo["photo_id"], photo["vlm_id"], result.payment_id)
                candidates = [c for c in candidates if c.payment_id != result.payment_id]
                mapped_count += 1
                log.info(f"[매핑] photo={photo['photo_id']} → payment={result.payment_id} | {result.reason}")

    return {
        "message": f"매핑 완료: {mapped_count}건 ({start_date}~{end_date})",
        "mapped": mapped_count,
    }
