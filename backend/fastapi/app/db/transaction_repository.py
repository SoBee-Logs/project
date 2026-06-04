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
                       payment_place, payment_category, payment_address
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
                       t.payment_place, t.payment_category, t.payment_address,
                       pvr.vlm_item_name, pvr.vlm_description, et.emoji
                FROM persona_transaction pt
                JOIN transactions t
                    ON pt.payment_id = t.payment_id
                JOIN photo_vlm_results pvr
                    ON pt.vlm_id = pvr.vlm_id
                JOIN emotions_text et
                    ON pt.photo_id = et.photo_id
                WHERE pt.user_id = %s
                AND t.payment_date BETWEEN %s AND %s
                ORDER BY t.payment_date DESC, t.payment_time DESC
                """,
                (user_id, start_date, end_date),
            )
            rows = await cur.fetchall()
    return [dict(row) for row in rows]
