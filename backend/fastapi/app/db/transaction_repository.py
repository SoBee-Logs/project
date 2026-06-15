import aiomysql
from app.db.connection import get_pool


async def get_transactions_by_date_range(user_id: int, start_date: str, end_date: str) -> list[dict]:
    """start_date, end_date: 'YYYY-MM-DD' 형식 문자열"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(
                """
                SELECT payment_id, payment_date, payment_time, payment_out, payment_in,
                       payment_place, payment_category, payment_category_id, payment_address
                FROM transactions
                WHERE user_id = %s
                AND payment_date BETWEEN %s AND %s
                ORDER BY payment_date DESC, payment_time DESC
                """,
                (user_id, start_date, end_date),
            )
            rows = await cur.fetchall()
    return [dict(row) for row in rows]


async def get_mapped_transactions_with_vlm(user_id: int, start_date: str, end_date: str) -> list[dict]:
    """persona_transaction 기준으로 매핑된 결제 + VLM description + emoji 조회.
    start_date, end_date: 'YYYY-MM-DD' 형식 문자열"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(
                """
                SELECT t.payment_id, t.payment_date, t.payment_time, t.payment_out, t.payment_in,
                       t.payment_place, t.payment_category, t.payment_category_id, t.payment_address,
                       pvr.vlm_item_name, pvr.vlm_description, et.emoji
                FROM persona_transaction pt
                JOIN transactions t
                    ON pt.payment_id = t.payment_id
                JOIN photo_vlm_results pvr
                    ON pt.vlm_id = pvr.vlm_id
                LEFT JOIN emotions_text et
                    ON pt.photo_id = et.photo_id
                WHERE pt.user_id = %s
                AND t.payment_date BETWEEN %s AND %s
                ORDER BY t.payment_date DESC, t.payment_time DESC
                """,
                (user_id, start_date, end_date),
            )
            rows = await cur.fetchall()
    return [dict(row) for row in rows]


async def get_photo_emotions_by_payment_date(user_id: int, start_date: str, end_date: str) -> list[tuple]:
    """기간 내(매핑된 결제의 payment_date 기준) 사진들의 (감정 enum 이름, 촬영시각) 조회.
    아바타 생성의 다른 소스(거래·VLM)와 동일하게 payment_date 기준으로 통일 — 사진 단위 1행.
    taken_at은 동률 시 최근 사진 우선 정렬용으로만 함께 반환한다.
    start_date, end_date: 'YYYY-MM-DD' 형식 문자열"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(
                """
                SELECT et.emoji AS mood, pm.taken_at
                FROM (
                    SELECT DISTINCT pt.photo_id
                    FROM persona_transaction pt
                    JOIN transactions t ON pt.payment_id = t.payment_id
                    WHERE pt.user_id = %s
                      AND t.payment_date BETWEEN %s AND %s
                ) pt
                JOIN photo_metadata pm ON pt.photo_id = pm.photo_id
                JOIN emotions_text et ON pt.photo_id = et.photo_id
                WHERE et.emoji IS NOT NULL AND et.emoji != ''
                """,
                (user_id, start_date, end_date),
            )
            rows = await cur.fetchall()
    return [(r["mood"], r["taken_at"]) for r in rows]
