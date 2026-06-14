import logging
from datetime import datetime, timedelta
from typing import Optional

import aiomysql

from app.db.connection import get_pool

log = logging.getLogger(__name__)


def _timedelta_to_timestr(t) -> str:
    if t is None:
        return "00:00:00"
    if isinstance(t, timedelta):
        total = int(t.total_seconds())
        h, m, s = total // 3600, (total % 3600) // 60, total % 60
        return f"{h:02d}:{m:02d}:{s:02d}"
    return str(t)[:8]


def _to_datetime_str(value) -> str:
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M:%S")
    return str(value)[:19]


def _payment_datetime_str(payment_date, payment_time) -> str:
    date_str = str(payment_date)[:10] if payment_date else "0000-00-00"
    return f"{date_str} {_timedelta_to_timestr(payment_time)}"


async def _get_last_mapped_checkpoint(conn, user_id: int) -> Optional[datetime]:
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
    async with conn.cursor(aiomysql.DictCursor) as cur:
        await cur.execute(
            """
            SELECT
                p.photo_id, pm.taken_at,
                pvr.vlm_id, pvr.vlm_category,
                pvr.vlm_item_name, pvr.vlm_price_estimate,
                pvr.vlm_store_type, pvr.vlm_store_name,
                pvr.vlm_description, pvr.vlm_address,
                pvr.vlm_groups
            FROM photos p
            JOIN photo_metadata pm ON p.photo_id = pm.photo_id
            JOIN photo_vlm_results pvr ON p.photo_id = pvr.photo_id
            WHERE p.user_id = %s
              AND DATE(pm.taken_at) BETWEEN %s AND %s
              AND pvr.is_valid = TRUE
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


async def _save_mapping(
    conn, user_id: int, photo_id: int, vlm_id: int,
    payment_id: int, group_id: Optional[int] = None,
    group_store: Optional[str] = None, group_category: Optional[str] = None,
    group_price: Optional[float] = None,
) -> None:
    async with conn.cursor() as cur:
        await cur.execute(
            """
            INSERT INTO persona_transaction
              (vlm_id, photo_id, group_id, group_store, group_category, group_price, payment_id, user_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (vlm_id, photo_id, group_id, group_store, group_category, group_price, str(payment_id), user_id),
        )


def _parse_vlm_groups(vlm_groups_json) -> list[dict]:
    """vlm_groups JSON → group 리스트"""
    if not vlm_groups_json:
        return []
    try:
        if isinstance(vlm_groups_json, str):
            import json
            groups = json.loads(vlm_groups_json)
        else:
            groups = vlm_groups_json
        if isinstance(groups, list):
            return groups
    except Exception:
        pass
    return []


async def run_mapping(
    user_id: int,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> dict:
    from app.api.mapping import match_photo_to_transaction
    from app.api.mapping import MappingRequest, VlmGroup, TransactionCandidate

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
        used_payment_ids = set()

        for photo in photos:
            taken_at_str = _to_datetime_str(photo["taken_at"]) if photo.get("taken_at") else None
            location = photo.get("vlm_address") or ""

            # vlm_groups 파싱 → groups 구성
            raw_groups = _parse_vlm_groups(photo.get("vlm_groups"))
            if raw_groups:
                groups = [
                    VlmGroup(
                        group_id=g.get("group_id"),
                        store=g.get("store"),
                        category=g.get("category"),
                        items=g.get("items", []),
                        price=float(g["price"]) if g.get("price") else None,
                    )
                    for g in raw_groups
                ]
            else:
                # vlm_groups 없으면 vlm 단일 정보로 group 1개 생성
                groups = [
                    VlmGroup(
                        group_id=1,
                        store=photo.get("vlm_store_name"),
                        category=photo.get("vlm_category"),
                        items=[photo["vlm_item_name"]] if photo.get("vlm_item_name") else [],
                        price=float(photo["vlm_price_estimate"]) if photo.get("vlm_price_estimate") else None,
                    )
                ]

            # 이미 매핑된 payment_id 제외
            available = [c for c in candidates if c.payment_id not in used_payment_ids]
            if not available:
                continue

            req = MappingRequest(
                photo_id=photo["photo_id"],
                user_id=user_id,
                taken_at=taken_at_str,
                location=location,
                groups=groups,
                candidates=available,
            )

            results = await match_photo_to_transaction(req)

            for result in results:
                if result.payment_id is None:
                    continue

                matched_group = next(
                    (g for g in groups if g.group_id == result.group_id), None
                )

                await _save_mapping(
                    conn,
                    user_id=user_id,
                    photo_id=photo["photo_id"],
                    vlm_id=photo["vlm_id"],
                    payment_id=result.payment_id,
                    group_id=result.group_id,
                    group_store=matched_group.store if matched_group else None,
                    group_category=matched_group.category if matched_group else None,
                    group_price=matched_group.price if matched_group else None,
                )
                used_payment_ids.add(result.payment_id)
                mapped_count += 1
                log.info(f"[매핑] photo={photo['photo_id']} group={result.group_id} → payment={result.payment_id} | {result.reason}")

    return {
        "message": f"매핑 완료: {mapped_count}건 ({start_date}~{end_date})",
        "mapped": mapped_count,
    }