import aiomysql
from datetime import datetime
from app.db.connection import get_pool


async def get_all_user_ids() -> list[int]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("SELECT user_id FROM users")
            rows = await cur.fetchall()
    return [row[0] for row in rows]


async def get_user_life_stage(user_id: int) -> str | None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "SELECT life_stage_code FROM users WHERE user_id = %s",
                (user_id,),
            )
            row = await cur.fetchone()
    return row[0] if row else None


async def get_user_avatar(user_id: int) -> dict | None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                SELECT avatar_name, avatar_explain, avatar_img_url
                FROM avatar
                WHERE user_id = %s
                ORDER BY avatar_created_at DESC
                LIMIT 1
                """,
                (user_id,),
            )
            row = await cur.fetchone()
    if row is None:
        return None
    return {
        "avatarName": row[0],
        "avatarExplain": row[1],
        "avatarImgUrl": row[2],
    }


async def update_user_avatar(
    user_id: int,
    avatar_name: str,
    avatar_explain: str,
    avatar_img_url: str,
    avatar_change_reason: str,
    avatar_created_at: datetime | None = None,
) -> None:
    created_at = avatar_created_at if avatar_created_at is not None else datetime.now()
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                DELETE FROM avatar
                WHERE user_id = %s AND DATE(avatar_created_at) = DATE(%s)
                """,
                (user_id, created_at),
            )
            await cur.execute(
                """
                INSERT INTO avatar (user_id, avatar_name, avatar_explain, avatar_img_url, avatar_change_reason, avatar_created_at)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (user_id, avatar_name, avatar_explain, avatar_img_url, avatar_change_reason, created_at),
            )
            # users 테이블도 업데이트 (Spring persona 엔드포인트가 읽는 테이블)
            await cur.execute(
                """
                UPDATE users
                SET avatar_name = %s,
                    avatar_explain = %s,
                    avatar_img_url = %s
                WHERE user_id = %s
                """,
                (avatar_name, avatar_explain, avatar_img_url, user_id),
            )
        await conn.commit()
