"""
category_mapping_repository.py
"""
import aiomysql
from typing import Optional
from app.db.connection import get_pool

ETC_PAYMENT_CATEGORY_ID = 16


async def find_mapping(
    payment_category: str,
    payment_place: Optional[str],
) -> Optional[dict]:
    """category_mapping에서 매핑 1건 조회.

    우선순위:
      tier2      : payment_category + payment_place 둘 다 일치
      tier1      : payment_category 일치 + payment_place IS NULL (범용 룰)
      tier_place : payment_place만 일치 (다른 payment_category로 이미 분류된 적 있음)
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            # tier2 / tier1: 기존 로직
            await cur.execute(
                """
                SELECT
                    m.payment_category_id,
                    c.category_name,
                    CASE WHEN m.payment_place IS NULL THEN 'tier1' ELSE 'tier2' END AS matched_by
                FROM category_mapping m
                JOIN category_master c ON c.payment_category_id = m.payment_category_id
                WHERE m.payment_category = %s
                  AND (m.payment_place = %s OR m.payment_place IS NULL)
                ORDER BY m.payment_place IS NULL ASC
                LIMIT 1
                """,
                (payment_category, payment_place),
            )
            row = await cur.fetchone()
            if row:
                return dict(row)

            if not payment_place:
                return None

            # tier_place: payment_place만으로 재사용 (LLM 중복 호출 방지)
            await cur.execute(
                """
                SELECT
                    m.payment_category_id,
                    c.category_name,
                    'tier_place' AS matched_by
                FROM category_mapping m
                JOIN category_master c ON c.payment_category_id = m.payment_category_id
                WHERE m.payment_place = %s
                  AND m.payment_category_id != %s
                LIMIT 1
                """,
                (payment_place, ETC_PAYMENT_CATEGORY_ID),
            )
            row = await cur.fetchone()
    return dict(row) if row else None


async def get_etc_category() -> dict:
    """'기타' 카테고리 정보 반환."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(
                """
                SELECT payment_category_id, category_name
                FROM category_master
                WHERE payment_category_id = %s
                """,
                (ETC_PAYMENT_CATEGORY_ID,),
            )
            row = await cur.fetchone()
    return dict(row) if row else {"payment_category_id": ETC_PAYMENT_CATEGORY_ID, "category_name": "기타"}


async def update_transaction_category(payment_id: int, payment_category_id: int) -> None:
    """transactions의 payment_category_id 업데이트."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                UPDATE transactions
                SET payment_category_id = %s
                WHERE payment_id = %s
                """,
                (payment_category_id, payment_id),
            )


async def get_unmapped_transactions() -> list[dict]:
    """payment_category_id가 NULL인 transactions 조회."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(
                """
                SELECT payment_id, payment_category, payment_place
                FROM transactions
                WHERE payment_category_id IS NULL
                """
            )
            rows = await cur.fetchall()
    return [dict(row) for row in rows]


async def get_pending_llm_pairs(limit: int = 50) -> list[dict]:
    """LLM 처리가 필요한 페어 추출."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(
                """
                SELECT DISTINCT t.payment_category,
                                t.payment_place
                FROM transactions t
                WHERE t.payment_category_id = %s
                  AND NOT EXISTS (
                      SELECT 1 FROM category_mapping m
                      WHERE m.payment_category = t.payment_category
                        AND (m.payment_place <=> t.payment_place)
                  )
                LIMIT %s
                """,
                (ETC_PAYMENT_CATEGORY_ID, limit),
            )
            rows = await cur.fetchall()
    return [dict(row) for row in rows]


async def insert_llm_mapping(
    payment_category: str,
    payment_place: Optional[str],
    payment_category_id: int,
) -> None:
    """LLM 분류 결과를 category_mapping에 INSERT."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                INSERT IGNORE INTO category_mapping
                    (payment_category, payment_place, payment_category_id, source)
                VALUES (%s, %s, %s, 'llm')
                """,
                (payment_category, payment_place, payment_category_id),
            )


async def backfill_transactions_by_pair(
    payment_category: str,
    payment_place: Optional[str],
    payment_category_id: int,
) -> int:
    """LLM이 매핑한 페어의 transactions 백필."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                UPDATE transactions
                SET payment_category_id = %s
                WHERE payment_category = %s
                  AND (payment_place <=> %s)
                  AND payment_category_id = %s
                """,
                (payment_category_id, payment_category, payment_place, ETC_PAYMENT_CATEGORY_ID),
            )
            return cur.rowcount