from fastapi import APIRouter
from pydantic import BaseModel
from app.db.connection import get_pool
from app.core.prompt_store import list_prompts, set_prompt, reset_prompt

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/overview")
async def overview():
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            stats = {}
            queries = {
                "users": "SELECT COUNT(*) FROM users",
                "transactions": "SELECT COUNT(*) FROM transactions",
                "photos": "SELECT COUNT(*) FROM photos",
                "diaries": "SELECT COUNT(*) FROM diary",
                "avatars": "SELECT COUNT(*) FROM avatar",
                "vlm_count": "SELECT COUNT(*) FROM photo_vlm_results",
                "cards": "SELECT COUNT(*) FROM cards",
                "bank_accounts": "SELECT COUNT(*) FROM bank_accounts",
                "card_transactions": "SELECT COUNT(*) FROM card_transactions",
                "bank_transactions": "SELECT COUNT(*) FROM bank_transactions",
            }
            for key, q in queries.items():
                await cur.execute(q)
                stats[key] = (await cur.fetchone())[0]
    return stats


@router.get("/avatars")
async def avatars():
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("""
                SELECT u.user_id, u.name, u.age, u.gender, u.life_stage_code,
                       a.avatar_name, a.avatar_img_url, a.avatar_explain, a.avatar_created_at
                FROM users u
                LEFT JOIN avatar a ON u.user_id = a.user_id
                ORDER BY a.avatar_created_at DESC
            """)
            rows = await cur.fetchall()
            cols = [d[0] for d in cur.description]
            avatars_list = [dict(zip(cols, r)) for r in rows]

            result = []
            for av in avatars_list:
                uid = av["user_id"]
                await cur.execute("""
                    SELECT payment_category, SUM(payment_out) as total
                    FROM transactions WHERE user_id=%s AND payment_out > 0
                    GROUP BY payment_category ORDER BY total DESC LIMIT 3
                """, (uid,))
                top_cats = await cur.fetchall()
                av["top_categories"] = [{"category": r[0], "amount": int(r[1])} for r in top_cats]

                await cur.execute("""
                    SELECT COUNT(*) FROM persona_transaction WHERE user_id=%s
                """, (uid,))
                av["persona_tx_count"] = (await cur.fetchone())[0]

                if av.get("avatar_created_at"):
                    av["avatar_created_at"] = str(av["avatar_created_at"])
                result.append(av)

    return result


@router.get("/user-data")
async def user_data():
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("SELECT user_id, name, age, gender, life_stage_code FROM users ORDER BY user_id")
            users = await cur.fetchall()
            result = []
            for u in users:
                uid = u[0]
                await cur.execute("SELECT COUNT(*) FROM cards WHERE user_id=%s", (uid,))
                card_count = (await cur.fetchone())[0]
                await cur.execute("SELECT COUNT(*) FROM bank_accounts WHERE user_id=%s", (uid,))
                bank_count = (await cur.fetchone())[0]
                await cur.execute("""
                    SELECT COUNT(*) FROM card_transactions ct
                    JOIN cards c ON ct.card_id = c.card_id WHERE c.user_id=%s
                """, (uid,))
                card_tx = (await cur.fetchone())[0]
                await cur.execute("""
                    SELECT COUNT(*) FROM bank_transactions bt
                    JOIN bank_accounts ba ON bt.bank_account_id = ba.id WHERE ba.user_id=%s
                """, (uid,))
                bank_tx = (await cur.fetchone())[0]
                await cur.execute("SELECT COUNT(*) FROM photos WHERE user_id=%s", (uid,))
                photo_count = (await cur.fetchone())[0]
                await cur.execute("SELECT COUNT(*) FROM diary WHERE user_id=%s", (uid,))
                diary_count = (await cur.fetchone())[0]
                result.append({
                    "user_id": uid, "name": u[1], "age": u[2],
                    "gender": u[3], "life_stage_code": u[4],
                    "card_count": card_count, "bank_count": bank_count,
                    "card_tx": card_tx, "bank_tx": bank_tx,
                    "photo_count": photo_count, "diary_count": diary_count,
                })
    return result


@router.get("/vlm-stats")
async def vlm_stats():
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("SELECT COUNT(*) FROM photo_vlm_results")
            total_vlm = (await cur.fetchone())[0]
            await cur.execute("SELECT COUNT(*) FROM photos")
            total_photos = (await cur.fetchone())[0]
            await cur.execute("SELECT COUNT(DISTINCT photo_id) FROM persona_transaction")
            mapped_count = (await cur.fetchone())[0]

            await cur.execute("""
                SELECT vlm_category, COUNT(*) as cnt
                FROM photo_vlm_results
                WHERE vlm_category IS NOT NULL
                GROUP BY vlm_category ORDER BY cnt DESC LIMIT 10
            """)
            categories = [{"category": r[0], "count": r[1]} for r in await cur.fetchall()]

            await cur.execute("""
                SELECT u.age, v.vlm_item_name, COUNT(*) as cnt
                FROM photo_vlm_results v
                JOIN photos p ON v.photo_id = p.photo_id
                JOIN users u ON p.user_id = u.user_id
                WHERE v.vlm_item_name IS NOT NULL AND u.age IS NOT NULL
                GROUP BY u.age, v.vlm_item_name
                ORDER BY u.age, cnt DESC
            """)
            rows = await cur.fetchall()
            age_items: dict = {}
            for age, item, cnt in rows:
                age_key = str(age)
                if age_key not in age_items:
                    age_items[age_key] = []
                if len(age_items[age_key]) < 5:
                    age_items[age_key].append({"item": item, "count": cnt})

    return {
        "total_vlm": total_vlm,
        "total_photos": total_photos,
        "mapped_count": mapped_count,
        "mapping_rate": round(mapped_count / total_photos * 100, 1) if total_photos else 0,
        "categories": categories,
        "age_items": age_items,
    }


@router.get("/diary-mapping")
async def diary_mapping():
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("SELECT COUNT(*) FROM photos")
            total_photos = (await cur.fetchone())[0]
            await cur.execute("SELECT COUNT(DISTINCT photo_id) FROM diary_photos")
            photos_in_diary = (await cur.fetchone())[0]
            await cur.execute("SELECT COUNT(*) FROM diary")
            total_diaries = (await cur.fetchone())[0]
            await cur.execute("SELECT COUNT(DISTINCT photo_id) FROM persona_transaction")
            tx_mapped = (await cur.fetchone())[0]

            await cur.execute("""
                SELECT u.name, u.user_id,
                       COUNT(DISTINCT p.photo_id) as total_photos,
                       COUNT(DISTINCT dp.photo_id) as diary_photos,
                       COUNT(DISTINCT pt.photo_id) as mapped_photos
                FROM users u
                LEFT JOIN photos p ON u.user_id = p.user_id
                LEFT JOIN diary_photos dp ON p.photo_id = dp.photo_id
                LEFT JOIN persona_transaction pt ON p.photo_id = pt.photo_id
                GROUP BY u.user_id, u.name
                ORDER BY u.user_id
            """)
            per_user = await cur.fetchall()

    return {
        "total_photos": total_photos,
        "photos_in_diary": photos_in_diary,
        "diary_rate": round(photos_in_diary / total_photos * 100, 1) if total_photos else 0,
        "total_diaries": total_diaries,
        "tx_mapped": tx_mapped,
        "tx_mapping_rate": round(tx_mapped / total_photos * 100, 1) if total_photos else 0,
        "per_user": [
            {
                "name": r[0], "user_id": r[1],
                "total_photos": r[2], "diary_photos": r[3], "mapped_photos": r[4]
            } for r in per_user
        ],
    }


@router.get("/lifecycle")
async def lifecycle():
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("""
                SELECT COALESCE(life_stage_code, '미분류') as stage, COUNT(*) as cnt
                FROM users GROUP BY stage ORDER BY cnt DESC
            """)
            distribution = [{"stage": r[0], "count": r[1]} for r in await cur.fetchall()]

            stage_labels = {
                "UNI": "대학생", "CHILD_BABY": "영유아 자녀", "NEW_WED": "신혼부부",
                "SINGLE": "1인 가구", "SENIOR": "시니어", "미분류": "미분류"
            }
            for d in distribution:
                d["label"] = stage_labels.get(d["stage"], d["stage"])

    return distribution


class PromptUpdate(BaseModel):
    value: str


@router.get("/prompts")
async def get_prompts():
    return list_prompts()


@router.put("/prompts/{key}")
async def update_prompt(key: str, body: PromptUpdate):
    set_prompt(key, body.value)
    return {"key": key, "saved": True}


@router.delete("/prompts/{key}")
async def reset_prompt_endpoint(key: str):
    reset_prompt(key)
    return {"key": key, "reset": True}


@router.get("/spending")
async def spending():
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("""
                SELECT payment_category, COUNT(*) as cnt, SUM(payment_out) as total
                FROM transactions
                WHERE payment_out > 0 AND payment_category IS NOT NULL
                GROUP BY payment_category ORDER BY cnt DESC LIMIT 15
            """)
            categories = [
                {"category": r[0], "count": r[1], "total": int(r[2])}
                for r in await cur.fetchall()
            ]

            await cur.execute("""
                SELECT member_store_type, COUNT(*) as cnt, SUM(used_amount) as total
                FROM card_transactions
                WHERE cancel_yn='N' AND member_store_type IS NOT NULL
                GROUP BY member_store_type ORDER BY cnt DESC LIMIT 10
            """)
            card_types = [
                {"type": r[0], "count": r[1], "total": float(r[2])}
                for r in await cur.fetchall()
            ]

            await cur.execute("""
                SELECT DATE_FORMAT(used_date, '%Y-%m') as month, SUM(used_amount) as total
                FROM card_transactions WHERE cancel_yn='N'
                GROUP BY month ORDER BY month DESC LIMIT 6
            """)
            monthly = [{"month": r[0], "total": float(r[1])} for r in await cur.fetchall()]

    return {
        "categories": categories,
        "card_types": card_types,
        "monthly": list(reversed(monthly)),
    }
