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


async def get_user_avatar(user_id: int) -> dict | None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                SELECT avatar_name, avatar_explane, avatar_img_url
                FROM users
                WHERE user_id = %s
                """,
                (user_id,),
            )
            row = await cur.fetchone()
    if row is None:
        return None
    return {
        "avatarName": row[0],
        "avatarExplane": row[1],
        "avatarImgUrl": row[2],
    }


async def update_user_avatar(
    user_id: int,
    avatar_name: str,
    avatar_explane: str,
    avatar_img_url: str,
    avatar_change_reason: str,
) -> None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                UPDATE users
                SET avatar_name = %s,
                    avatar_explane = %s,
                    avatar_img_url = %s,
                    avatar_change_reason = %s,
                    updated_at = %s
                WHERE user_id = %s
                """,
                (avatar_name, avatar_explane, avatar_img_url, avatar_change_reason, datetime.now(), user_id),
            )
        await conn.commit()
