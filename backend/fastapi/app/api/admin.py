import asyncio
import json
import urllib.request

from fastapi import APIRouter, Query, BackgroundTasks
from pydantic import BaseModel
from app.db.connection import get_pool
from app.core.prompt_store import list_prompts, set_prompt, reset_prompt, get_prompt_history, add_prompt_history, get_prompt

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

            await cur.execute("SELECT COUNT(*) FROM users WHERE DATE(created_at) = CURDATE()")
            row = await cur.fetchone()
            stats["new_users_today"] = row[0] if row else 0

            await cur.execute("""
                SELECT DATE(created_at) as d, COUNT(*) as cnt
                FROM diary
                WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
                GROUP BY d ORDER BY d
            """)
            stats["diary_trend"] = [{"date": str(r[0]), "count": r[1]} for r in await cur.fetchall()]

            await cur.execute("""
                SELECT DATE(created_at) as d, COUNT(*) as cnt
                FROM users
                WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
                GROUP BY d ORDER BY d
            """)
            stats["user_trend"] = [{"date": str(r[0]), "count": r[1]} for r in await cur.fetchall()]

            await cur.execute("""
                SELECT DATE(created_at) as d, COUNT(*) as cnt
                FROM photos
                WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
                GROUP BY d ORDER BY d
            """)
            stats["photo_trend"] = [{"date": str(r[0]), "count": r[1]} for r in await cur.fetchall()]

            await cur.execute("""
                SELECT DATE(payment_date) as d, COUNT(*) as cnt
                FROM transactions
                WHERE payment_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
                GROUP BY d ORDER BY d
            """)
            stats["transaction_trend"] = [{"date": str(r[0]), "count": r[1]} for r in await cur.fetchall()]

            stats["vlm_missing"] = max(0, stats["photos"] - stats["vlm_count"])
            stats["vlm_success_rate"] = (
                round(stats["vlm_count"] / stats["photos"] * 100, 1) if stats["photos"] else 0
            )

    return stats


@router.get("/avatars")
async def avatars():
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("""
                SELECT u.user_id, u.name, u.age, u.gender, u.life_stage_code, u.created_at as user_created_at,
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
                    SELECT cm.category_name, SUM(t.payment_out) as total
                    FROM transactions t
                    LEFT JOIN category_master cm ON t.payment_category_id = cm.payment_category_id
                    WHERE t.user_id=%s AND t.payment_out > 0
                    GROUP BY cm.category_name ORDER BY total DESC LIMIT 3
                """, (uid,))
                top_cats = await cur.fetchall()
                av["top_categories"] = [{"category": r[0], "amount": int(r[1])} for r in top_cats]

                await cur.execute("SELECT COUNT(*) FROM persona_transaction WHERE user_id=%s", (uid,))
                av["persona_tx_count"] = (await cur.fetchone())[0]

                if av.get("avatar_created_at"):
                    av["avatar_created_at"] = str(av["avatar_created_at"])
                if av.get("user_created_at"):
                    av["user_created_at"] = str(av["user_created_at"])
                result.append(av)

    return result


@router.get("/user-avatars/{user_id}")
async def user_avatars(user_id: int):
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("""
                SELECT avatar_name, avatar_img_url, avatar_explain, avatar_created_at
                FROM avatar WHERE user_id=%s
                ORDER BY avatar_created_at DESC
            """, (user_id,))
            rows = await cur.fetchall()
            return [
                {
                    "avatar_name": r[0],
                    "avatar_img_url": r[1],
                    "avatar_explain": r[2],
                    "avatar_created_at": str(r[3]) if r[3] else None,
                }
                for r in rows
            ]


@router.get("/user-data")
async def user_data():
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("SELECT user_id, name, age, gender, life_stage_code, nickname, is_active FROM users ORDER BY user_id")
            users = await cur.fetchall()
            result = []
            for u in users:
                uid = u[0]
                await cur.execute("SELECT COUNT(*) FROM cards WHERE user_id=%s", (uid,))
                card_count = (await cur.fetchone())[0]
                await cur.execute("SELECT COUNT(*) FROM bank_accounts WHERE user_id=%s", (uid,))
                bank_count = (await cur.fetchone())[0]
                await cur.execute("SELECT COUNT(*) FROM transactions WHERE user_id=%s", (uid,))
                tx_count = (await cur.fetchone())[0]
                await cur.execute("SELECT COUNT(*) FROM photos WHERE user_id=%s", (uid,))
                photo_count = (await cur.fetchone())[0]
                await cur.execute("SELECT COUNT(*) FROM diary WHERE user_id=%s", (uid,))
                diary_count = (await cur.fetchone())[0]
                await cur.execute("SELECT MAX(created_at) FROM diary WHERE user_id=%s", (uid,))
                last_diary = (await cur.fetchone())[0]

                result.append({
                    "user_id": uid, "name": u[1], "age": u[2],
                    "gender": u[3], "life_stage_code": u[4], "nickname": u[5], "is_active": u[6],
                    "card_count": card_count, "bank_count": bank_count,
                    "tx_count": tx_count,
                    "photo_count": photo_count, "diary_count": diary_count,
                    "last_diary": str(last_diary) if last_diary else None,
                })
    return result


@router.get("/user-detail/{user_id}")
async def user_detail(user_id: int):
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "SELECT user_id, name, age, gender, life_stage_code FROM users WHERE user_id=%s",
                (user_id,)
            )
            u = await cur.fetchone()
            if not u:
                return {"error": "not found"}

            # 최근 일기 10건
            await cur.execute("""
                SELECT diary_id, diary_content, created_at
                FROM diary WHERE user_id=%s ORDER BY created_at DESC LIMIT 10
            """, (user_id,))
            diaries = [
                {"id": r[0], "content": r[1] or "", "created_at": str(r[2])}
                for r in await cur.fetchall()
            ]

            # 소비 카테고리 top 8
            await cur.execute("""
                SELECT cm.category_name, COUNT(*) as cnt, SUM(t.payment_out) as total
                FROM transactions t
                LEFT JOIN category_master cm ON t.payment_category_id = cm.payment_category_id
                WHERE t.user_id=%s AND t.payment_out > 0
                GROUP BY cm.category_name ORDER BY total DESC LIMIT 8
            """, (user_id,))
            top_cats = [
                {"category": r[0] or '미분류', "count": r[1], "total": int(r[2])}
                for r in await cur.fetchall()
            ]

            # 최근 거래 10건
            await cur.execute("""
                SELECT t.payment_place, cm.category_name, t.payment_out, t.payment_date
                FROM transactions t
                LEFT JOIN category_master cm ON t.payment_category_id = cm.payment_category_id
                WHERE t.user_id=%s AND t.payment_out > 0
                ORDER BY t.payment_date DESC, t.payment_id DESC LIMIT 10
            """, (user_id,))
            recent_tx = [
                {"place": r[0], "category": r[1] or '미분류', "amount": int(r[2]), "date": str(r[3])}
                for r in await cur.fetchall()
            ]

            # VLM 분석된 사진
            await cur.execute("""
                SELECT p.photo_id, p.image_url, v.vlm_category, v.vlm_item_name,
                       v.vlm_price_estimate, v.vlm_confidence
                FROM photos p
                LEFT JOIN photo_vlm_results v ON p.photo_id = v.photo_id
                WHERE p.user_id=%s ORDER BY p.photo_id DESC LIMIT 12
            """, (user_id,))
            photos = [
                {
                    "photo_id": r[0], "url": r[1], "category": r[2],
                    "item": r[3], "price_estimate": r[4], "confidence": r[5]
                }
                for r in await cur.fetchall()
            ]

            # 카드 목록
            await cur.execute("""
                SELECT card_id, res_card_name, res_card_type
                FROM cards WHERE user_id=%s
            """, (user_id,))
            cards = [
                {"card_id": r[0], "name": r[1], "type": r[2]}
                for r in await cur.fetchall()
            ]

    return {
        "user_id": u[0], "name": u[1], "age": u[2],
        "gender": u[3], "life_stage_code": u[4],
        "recent_diaries": diaries,
        "top_categories": top_cats,
        "recent_transactions": recent_tx,
        "recent_photos": photos,
        "cards": cards,
    }


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

            vlm_missing = max(0, total_photos - total_vlm)

            await cur.execute("""
                SELECT c.category_name, COUNT(v.photo_id) as cnt
                FROM category_master c
                LEFT JOIN photo_vlm_results v ON v.vlm_category COLLATE utf8mb4_0900_ai_ci = c.category_name COLLATE utf8mb4_0900_ai_ci
                GROUP BY c.payment_category_id, c.category_name ORDER BY cnt DESC
            """)
            categories = [{"category": r[0], "count": r[1]} for r in await cur.fetchall()]

            await cur.execute("SELECT COUNT(*) FROM photo_vlm_results WHERE vlm_category IS NULL")
            null_category_count = (await cur.fetchone())[0]

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
            age_bucket: dict = {}
            for age, item, cnt in rows:
                low = (age // 5) * 5
                age_key = f"{low}~{low + 4}세"
                if age_key not in age_bucket:
                    age_bucket[age_key] = {}
                for single in [i.strip() for i in item.split(",") if i.strip()]:
                    age_bucket[age_key][single] = age_bucket[age_key].get(single, 0) + cnt
            age_items: dict = {}
            for age_key in sorted(age_bucket.keys()):
                top = sorted(age_bucket[age_key].items(), key=lambda x: -x[1])[:5]
                age_items[age_key] = [{"item": i, "count": c} for i, c in top]

            await cur.execute("""
                SELECT DATE_FORMAT(p.created_at, '%Y-%m') as ym,
                       CEIL(DAY(p.created_at) / 7) as week,
                       v.vlm_item_name, COUNT(*) as cnt
                FROM photo_vlm_results v
                JOIN photos p ON v.photo_id = p.photo_id
                WHERE v.vlm_item_name IS NOT NULL
                GROUP BY ym, week, v.vlm_item_name
                ORDER BY ym, week, cnt DESC
            """)
            week_rows = await cur.fetchall()
            week_bucket: dict = {}
            for ym, week, item, cnt in week_rows:
                if week is None or ym is None:
                    continue
                slot = f"{ym} {min(int(week), 4)}주차"
                if slot not in week_bucket:
                    week_bucket[slot] = {}
                for single in [i.strip() for i in item.split(",") if i.strip()]:
                    week_bucket[slot][single] = week_bucket[slot].get(single, 0) + cnt
            week_items: dict = {}
            for slot in sorted(week_bucket.keys()):
                top = sorted(week_bucket[slot].items(), key=lambda x: -x[1])[:5]
                week_items[slot] = [{"item": i, "count": c} for i, c in top]

            await cur.execute("""
                SELECT u.name, COUNT(p.photo_id) as total,
                       COUNT(v.photo_id) as analyzed
                FROM users u
                LEFT JOIN photos p ON u.user_id = p.user_id
                LEFT JOIN photo_vlm_results v ON p.photo_id = v.photo_id
                GROUP BY u.user_id, u.name
            """)
            per_user_vlm = [
                {"name": r[0], "total": r[1], "analyzed": r[2], "missing": max(0, r[1]-r[2])}
                for r in await cur.fetchall()
            ]

    return {
        "total_vlm": total_vlm,
        "total_photos": total_photos,
        "mapped_count": mapped_count,
        "mapping_rate": round(mapped_count / total_photos * 100, 1) if total_photos else 0,
        "vlm_missing": vlm_missing,
        "null_category_count": null_category_count,
        "vlm_success_rate": round(total_vlm / total_photos * 100, 1) if total_photos else 0,
        "categories": categories,
        "age_items": age_items,
        "week_items": week_items,
        "per_user_vlm": per_user_vlm,
    }


class UpdateVlmCategoryBody(BaseModel):
    category: str

@router.patch("/vlm-photo/{photo_id}/category")
async def update_vlm_category(photo_id: int, body: UpdateVlmCategoryBody):
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "UPDATE photo_vlm_results SET vlm_category = %s WHERE photo_id = %s",
                (body.category, photo_id)
            )
            await conn.commit()
            return {"ok": True, "photo_id": photo_id, "category": body.category}


@router.get("/vlm-category")
async def vlm_category_detail(category: str = Query(...)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("""
                SELECT v.photo_id, p.image_url, v.vlm_item_name, v.vlm_price_estimate,
                       v.vlm_confidence, v.vlm_store_name, v.vlm_description, u.name
                FROM photo_vlm_results v
                JOIN photos p ON v.photo_id = p.photo_id
                JOIN users u ON p.user_id = u.user_id
                WHERE v.vlm_category = %s
                ORDER BY v.vlm_confidence DESC LIMIT 30
            """, (category,))
            rows = await cur.fetchall()
            photos = [
                {
                    "photo_id": r[0], "url": r[1], "item": r[2],
                    "price_estimate": r[3], "confidence": r[4],
                    "store": r[5], "description": r[6], "user": r[7],
                }
                for r in rows
            ]

            # 이 카테고리 내 품목 분포
            await cur.execute("""
                SELECT vlm_item_name, COUNT(*) as cnt
                FROM photo_vlm_results
                WHERE vlm_category = %s AND vlm_item_name IS NOT NULL
                GROUP BY vlm_item_name ORDER BY cnt DESC LIMIT 10
            """, (category,))
            items = [{"item": r[0], "count": r[1]} for r in await cur.fetchall()]

    return {"category": category, "photos": photos, "items": items}


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


@router.get("/diary-user/{user_id}")
async def diary_user_detail(user_id: int):
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("SELECT name FROM users WHERE user_id=%s", (user_id,))
            row = await cur.fetchone()
            if not row:
                return {"error": "not found"}
            name = row[0]

            # 사진별 매핑 상태
            await cur.execute("""
                SELECT p.photo_id, p.image_url,
                       MAX(CASE WHEN dp.photo_id IS NOT NULL THEN 1 ELSE 0 END) as in_diary,
                       MAX(CASE WHEN pt.photo_id IS NOT NULL THEN 1 ELSE 0 END) as tx_mapped,
                       v.vlm_category, v.vlm_item_name
                FROM photos p
                LEFT JOIN diary_photos dp ON p.photo_id = dp.photo_id
                LEFT JOIN persona_transaction pt ON p.photo_id = pt.photo_id
                LEFT JOIN photo_vlm_results v ON p.photo_id = v.photo_id
                WHERE p.user_id = %s
                GROUP BY p.photo_id, p.image_url, v.vlm_category, v.vlm_item_name
                ORDER BY p.photo_id DESC
            """, (user_id,))
            photos = [
                {
                    "photo_id": r[0], "url": r[1],
                    "in_diary": bool(r[2]), "tx_mapped": bool(r[3]),
                    "category": r[4], "item": r[5],
                }
                for r in await cur.fetchall()
            ]

            # 일기 목록
            await cur.execute("""
                SELECT d.diary_id, d.diary_content, d.created_at,
                       COUNT(dp.photo_id) as photo_count
                FROM diary d
                LEFT JOIN diary_photos dp ON d.diary_id = dp.diary_id
                WHERE d.user_id = %s
                GROUP BY d.diary_id, d.diary_content, d.created_at
                ORDER BY d.created_at DESC
            """, (user_id,))
            diaries = [
                {"id": r[0], "content": (r[1] or "")[:120], "created_at": str(r[2]), "photo_count": r[3]}
                for r in await cur.fetchall()
            ]

    return {"user_id": user_id, "name": name, "photos": photos, "diaries": diaries}


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


@router.get("/lifecycle/{stage}")
async def lifecycle_stage_detail(stage: str):
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            condition = "life_stage_code IS NULL" if stage == "미분류" else "life_stage_code = %s"
            params = () if stage == "미분류" else (stage,)

            await cur.execute(f"""
                SELECT u.user_id, u.name, u.age, u.gender,
                       COUNT(DISTINCT p.photo_id) as photo_count,
                       COUNT(DISTINCT d.diary_id) as diary_count,
                       COUNT(DISTINCT t.payment_id) as tx_count,
                       SUM(CASE WHEN t.payment_out > 0 THEN t.payment_out ELSE 0 END) as total_spend
                FROM users u
                LEFT JOIN photos p ON u.user_id = p.user_id
                LEFT JOIN diary d ON u.user_id = d.user_id
                LEFT JOIN transactions t ON u.user_id = t.user_id
                WHERE {condition}
                GROUP BY u.user_id, u.name, u.age, u.gender
            """, params)

            users = [
                {
                    "user_id": r[0], "name": r[1], "age": r[2], "gender": r[3],
                    "photo_count": r[4], "diary_count": r[5],
                    "tx_count": r[6], "total_spend": int(r[7] or 0),
                }
                for r in await cur.fetchall()
            ]

            # 이 그룹의 소비 카테고리 top 5
            await cur.execute(f"""
                SELECT cm.category_name, COUNT(*) as cnt, SUM(t.payment_out) as total
                FROM transactions t
                JOIN users u ON t.user_id = u.user_id
                JOIN category_master cm ON t.payment_category_id = cm.payment_category_id
                WHERE {condition} AND t.payment_out > 0
                GROUP BY cm.category_name ORDER BY total DESC LIMIT 5
            """, params)
            top_cats = [{"category": r[0], "count": r[1], "total": int(r[2])} for r in await cur.fetchall()]

    stage_labels = {
        "UNI": "대학생", "CHILD_BABY": "영유아 자녀", "NEW_WED": "신혼부부",
        "SINGLE": "1인 가구", "SENIOR": "시니어", "미분류": "미분류"
    }
    return {
        "stage": stage,
        "label": stage_labels.get(stage, stage),
        "users": users,
        "top_categories": top_cats,
    }


@router.get("/spending-detail/{category}")
async def spending_category_detail(category: str):
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            # 최근 거래 30건
            await cur.execute("""
                SELECT t.payment_place, t.payment_out, t.payment_date, u.name
                FROM transactions t
                JOIN users u ON t.user_id = u.user_id
                JOIN category_master c ON t.payment_category_id = c.payment_category_id
                WHERE c.category_name = %s AND t.payment_out > 0
                ORDER BY t.payment_date DESC, t.payment_id DESC LIMIT 30
            """, (category,))
            transactions = [
                {"place": r[0], "amount": int(r[1]), "date": str(r[2]), "user": r[3]}
                for r in await cur.fetchall()
            ]

            # 유저별 이 카테고리 소비
            await cur.execute("""
                SELECT u.name, COUNT(*) as cnt, SUM(t.payment_out) as total
                FROM transactions t
                JOIN users u ON t.user_id = u.user_id
                JOIN category_master c ON t.payment_category_id = c.payment_category_id
                WHERE c.category_name = %s AND t.payment_out > 0
                GROUP BY u.user_id, u.name ORDER BY total DESC
            """, (category,))
            per_user = [
                {"name": r[0], "count": r[1], "total": int(r[2])}
                for r in await cur.fetchall()
            ]

            # 월별 추이
            await cur.execute("""
                SELECT DATE_FORMAT(t.payment_date, '%%Y-%%m') as month,
                       COUNT(*) as cnt, SUM(t.payment_out) as total
                FROM transactions t
                JOIN category_master c ON t.payment_category_id = c.payment_category_id
                WHERE c.category_name = %s AND t.payment_out > 0
                GROUP BY month ORDER BY month DESC LIMIT 6
            """, (category,))
            monthly = [{"month": r[0], "count": r[1], "total": int(r[2])} for r in await cur.fetchall()]

    return {
        "category": category,
        "transactions": transactions,
        "per_user": per_user,
        "monthly": list(reversed(monthly)),
    }


@router.get("/system-health")
async def system_health():
    import time
    result = {}

    try:
        pool = await get_pool()
        t0 = time.monotonic()
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute("SELECT 1")
                await cur.fetchone()
        result["db"] = {"status": "ok", "latency_ms": round((time.monotonic() - t0) * 1000, 1)}
    except Exception as e:
        result["db"] = {"status": "error", "error": str(e)}

    from app.core.metrics import get_stats
    result["llm_response_times"] = {
        "vlm": get_stats("vlm"),
        "diary": get_stats("diary"),
        "avatar": get_stats("avatar"),
    }

    try:
        prompts = list_prompts()
        result["prompt_store"] = {"status": "ok", "count": len(prompts), "modified": sum(1 for p in prompts if p["is_modified"])}
    except Exception as e:
        result["prompt_store"] = {"status": "error", "error": str(e)}

    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute("SELECT COUNT(*) FROM photos p LEFT JOIN photo_vlm_results v ON p.photo_id = v.photo_id WHERE v.photo_id IS NULL")
                vlm_unprocessed = (await cur.fetchone())[0]
                await cur.execute("SELECT COUNT(*) FROM users u LEFT JOIN diary d ON u.user_id = d.user_id WHERE d.user_id IS NULL")
                users_no_diary = (await cur.fetchone())[0]
                await cur.execute("SELECT COUNT(*) FROM users u LEFT JOIN avatar a ON u.user_id = a.user_id WHERE a.user_id IS NULL")
                users_no_avatar = (await cur.fetchone())[0]

        result["data_quality"] = {
            "vlm_unprocessed_photos": vlm_unprocessed,
            "users_without_diary": users_no_diary,
            "users_without_avatar": users_no_avatar,
        }
    except Exception as e:
        result["data_quality"] = {"status": "error", "error": str(e)}

    return result


class PromptUpdate(BaseModel):
    value: str


@router.get("/prompts")
async def get_prompts():
    return list_prompts()


@router.put("/prompts/{key}")
async def update_prompt(key: str, body: PromptUpdate):
    old_value = get_prompt(key)
    add_prompt_history(key, old_value)
    set_prompt(key, body.value)
    return {"key": key, "saved": True}


@router.delete("/prompts/{key}")
async def reset_prompt_endpoint(key: str):
    old_value = get_prompt(key)
    add_prompt_history(key, old_value)
    reset_prompt(key)
    return {"key": key, "reset": True}


@router.get("/prompts/{key}/history")
async def get_prompt_history_endpoint(key: str):
    return get_prompt_history(key)


class PromptTestInput(BaseModel):
    input: str
    prompt: str = ""


@router.post("/prompts/{key}/test")
async def test_prompt(key: str, body: PromptTestInput):
    import json, httpx, os
    prompt_text = body.prompt or get_prompt(key)
    try:
        user_input = json.loads(body.input)
    except Exception:
        user_input = body.input

    openai_key = os.getenv("OPENAI_API_KEY", "")
    if not openai_key:
        return {"error": "OPENAI_API_KEY가 설정되지 않았습니다."}

    messages = [
        {"role": "system", "content": prompt_text},
        {"role": "user", "content": json.dumps(user_input, ensure_ascii=False) if isinstance(user_input, dict) else str(user_input)},
    ]
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {openai_key}"},
            json={"model": "gpt-4o", "messages": messages},
        )
        data = resp.json()

    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    try:
        parsed = json.loads(content)
        return {"result": parsed, "raw": content, "valid_json": True}
    except Exception:
        return {"result": content, "raw": content, "valid_json": False}


@router.get("/spending")
async def spending():
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("""
                SELECT c.category_name,
                       COUNT(t.payment_id) as cnt,
                       COALESCE(SUM(t.payment_out), 0) as total
                FROM category_master c
                LEFT JOIN transactions t
                  ON t.payment_category_id = c.payment_category_id AND t.payment_out > 0
                GROUP BY c.payment_category_id, c.category_name ORDER BY cnt DESC
            """)
            categories = [
                {"category": r[0], "count": r[1], "total": int(r[2])}
                for r in await cur.fetchall()
            ]

            await cur.execute("""
                SELECT member_store_type, COUNT(*) as cnt, SUM(used_amount) as total
                FROM card_transactions
                WHERE cancel_yn='0' AND member_store_type IS NOT NULL
                GROUP BY member_store_type ORDER BY cnt DESC LIMIT 10
            """)
            card_types = [
                {"type": r[0], "count": r[1], "total": float(r[2])}
                for r in await cur.fetchall()
            ]

            await cur.execute("""
                SELECT DATE_FORMAT(used_date, '%Y-%m') as month, SUM(used_amount) as total
                FROM card_transactions WHERE cancel_yn='0'
                GROUP BY month ORDER BY month DESC LIMIT 6
            """)
            monthly = [{"month": r[0], "total": float(r[1])} for r in await cur.fetchall()]

            await cur.execute("""
                SELECT u.life_stage_code,
                       COUNT(DISTINCT ct.card_transaction_id) as tx_count,
                       AVG(ct.used_amount) as avg_amount
                FROM card_transactions ct
                JOIN cards c ON ct.card_id = c.card_id
                JOIN users u ON c.user_id = u.user_id
                WHERE ct.cancel_yn='0' AND u.life_stage_code IS NOT NULL
                GROUP BY u.life_stage_code
            """)
            stage_labels = {
                "UNI": "대학생", "CHILD_BABY": "영유아 자녀", "NEW_WED": "신혼부부",
                "SINGLE": "1인 가구", "SENIOR": "시니어"
            }
            lifecycle_spending = [
                {
                    "stage": stage_labels.get(r[0], r[0]),
                    "tx_count": r[1],
                    "avg_amount": round(float(r[2]), 0) if r[2] else 0
                }
                for r in await cur.fetchall()
            ]

    return {
        "categories": categories,
        "card_types": card_types,
        "monthly": list(reversed(monthly)),
        "lifecycle_spending": lifecycle_spending,
    }


@router.get("/vlm-unprocessed")
async def vlm_unprocessed():
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("""
                SELECT p.photo_id, p.image_url, p.created_at, u.name, u.user_id
                FROM photos p
                JOIN users u ON p.user_id = u.user_id
                LEFT JOIN photo_vlm_results v ON p.photo_id = v.photo_id
                WHERE v.photo_id IS NULL
                ORDER BY p.created_at DESC
                LIMIT 50
            """)
            rows = await cur.fetchall()
    return [
        {"photo_id": r[0], "url": r[1], "created_at": str(r[2]), "user": r[3], "user_id": r[4]}
        for r in rows
    ]

@router.get("/category-overrides")
async def category_overrides():
    """
    기타/금융/미분류(NULL) 였다가 VLM 분석으로 다른 카테고리로 변경된 거래 목록.
    payment_ct_update = 1 인 거래만 조회한다.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            # 변경된 카테고리별 건수 요약
            await cur.execute("""
                SELECT cm.category_name, COUNT(*) as cnt
                FROM transactions t
                JOIN category_master cm ON t.payment_category_id = cm.payment_category_id
                WHERE t.payment_ct_update = 1
                GROUP BY cm.payment_category_id, cm.category_name
                ORDER BY cnt DESC
            """)
            by_category = [{"category": r[0], "count": r[1]} for r in await cur.fetchall()]

            # 카테고리 분포 (변경 전/후 비교, payment_out=0 입금내역 제외)
            #   변경 후 = 현재 payment_category_id 기준
            #   변경 전 = payment_ct_update=1 인 거래는 원래 기타/NULL 이었다고 보고 '기타'로 간주
            await cur.execute("""
                SELECT cm.category_name, COUNT(*)
                FROM transactions t
                JOIN category_master cm ON t.payment_category_id = cm.payment_category_id
                WHERE t.payment_out > 0
                GROUP BY cm.payment_category_id, cm.category_name
            """)
            after_map = {r[0]: r[1] for r in await cur.fetchall()}

            await cur.execute("""
                SELECT CASE WHEN t.payment_ct_update = 1 THEN '기타'
                            ELSE cm.category_name END AS cat,
                       COUNT(*)
                FROM transactions t
                JOIN category_master cm ON t.payment_category_id = cm.payment_category_id
                WHERE t.payment_out > 0
                GROUP BY cat
            """)
            before_map = {r[0]: r[1] for r in await cur.fetchall()}

            _cats = sorted(set(after_map) | set(before_map),
                           key=lambda c: after_map.get(c, 0), reverse=True)
            category_dist = [
                {"category": c, "before": before_map.get(c, 0), "after": after_map.get(c, 0)}
                for c in _cats
            ]

            # 전체 변경 건수 (= 보정 전 대비 줄어든 건수)
            await cur.execute("SELECT COUNT(*) FROM transactions WHERE payment_ct_update = 1")
            total = (await cur.fetchone())[0]

            # 보정 후(현재) 기타/금융/미분류 건수 (payment_out=0 입금내역 제외)
            await cur.execute("""
                SELECT COUNT(*) FROM transactions
                WHERE (payment_category_id IS NULL OR payment_category_id IN (13, 16))
                  AND payment_out > 0
            """)
            after_count = (await cur.fetchone())[0]

            # 보정 전 기타/금융/미분류 건수
            #   = (현재 기타/금융/null 이면서 미변경) + (변경된 건 ct_update=1)
            #   두 집합은 ct_update 0/1 로 나뉘어 겹치지 않으므로 단순 합산
            await cur.execute("""
                SELECT COUNT(*) FROM transactions
                WHERE (payment_category_id IS NULL OR payment_category_id IN (13, 16))
                  AND payment_ct_update = 0
                  AND payment_out > 0
            """)
            untouched_count = (await cur.fetchone())[0]
            before_count = untouched_count + total

            # 변경 거래 상세 (최근 200건)
            await cur.execute("""
                SELECT t.payment_id, t.payment_place, t.payment_out, t.payment_date,
                       u.name, cm.category_name,
                       MAX(pvr.vlm_category) AS vlm_category,
                       MAX(p.image_url) AS image_url
                FROM transactions t
                JOIN users u ON t.user_id = u.user_id
                LEFT JOIN category_master cm ON t.payment_category_id = cm.payment_category_id
                LEFT JOIN persona_transaction pt ON pt.payment_id = CONVERT(t.payment_id, CHAR)
                LEFT JOIN photo_vlm_results pvr ON pt.vlm_id = pvr.vlm_id
                LEFT JOIN photos p ON pt.photo_id = p.photo_id
                WHERE t.payment_ct_update = 1
                GROUP BY t.payment_id, t.payment_place, t.payment_out, t.payment_date,
                         u.name, cm.category_name
                ORDER BY t.payment_date DESC, t.payment_id DESC
                LIMIT 200
            """)
            items = [
                {
                    "payment_id": r[0],
                    "place": r[1],
                    "amount": int(r[2]) if r[2] is not None else 0,
                    "date": str(r[3]) if r[3] else None,
                    "user": r[4],
                    "new_category": r[5],
                    "vlm_category": r[6],
                    "image_url": r[7],
                }
                for r in await cur.fetchall()
            ]

            # 아직 기타/금융/미분류로 남아있는 거래 (최근 200건)
            await cur.execute("""
                SELECT t.payment_id, t.payment_place, t.payment_out, t.payment_date,
                       u.name, cm.category_name,
                       MAX(pvr.vlm_category) AS vlm_category,
                       MAX(p.image_url) AS image_url
                FROM transactions t
                JOIN users u ON t.user_id = u.user_id
                LEFT JOIN category_master cm ON t.payment_category_id = cm.payment_category_id
                LEFT JOIN persona_transaction pt ON pt.payment_id = CONVERT(t.payment_id, CHAR)
                LEFT JOIN photo_vlm_results pvr ON pt.vlm_id = pvr.vlm_id
                LEFT JOIN photos p ON pt.photo_id = p.photo_id
                WHERE (t.payment_category_id IS NULL OR t.payment_category_id IN (13, 16))
                  AND t.payment_out > 0
                GROUP BY t.payment_id, t.payment_place, t.payment_out, t.payment_date,
                         u.name, cm.category_name
                ORDER BY t.payment_date DESC, t.payment_id DESC
                LIMIT 200
            """)
            remaining_items = [
                {
                    "payment_id": r[0],
                    "place": r[1],
                    "amount": int(r[2]) if r[2] is not None else 0,
                    "date": str(r[3]) if r[3] else None,
                    "user": r[4],
                    "current_category": r[5] or "미분류",
                    "vlm_category": r[6],
                    "image_url": r[7],
                }
                for r in await cur.fetchall()
            ]

    return {
        "total": total,
        "before_count": before_count,
        "after_count": after_count,
        "by_category": by_category,
        "category_dist": category_dist,
        "items": items,
        "remaining_items": remaining_items,
    }
  
async def _do_reprocess(photo_id: int):
    from app.api.vlm import analyze_image
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("SELECT image_url FROM photos WHERE photo_id = %s", (photo_id,))
            row = await cur.fetchone()
            if not row or not row[0]:
                return {"error": "photo not found"}
            image_url = row[0]

    try:
        req = urllib.request.Request(image_url, headers={"User-Agent": "SoBee-Admin/1.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            image_bytes = resp.read()
    except Exception as e:
        return {"error": f"이미지 다운로드 실패: {e}"}

    filename = image_url.split("/")[-1].split("?")[0] or "image.jpg"
    result = await analyze_image(filename, image_bytes)
    if "error" in result:
        return result

    groups_json = json.dumps(result.get("groups", []), ensure_ascii=False) if result.get("groups") is not None else None

    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("SELECT vlm_id FROM photo_vlm_results WHERE photo_id = %s", (photo_id,))
            existing = await cur.fetchone()
            if existing:
                await cur.execute("""
                    UPDATE photo_vlm_results SET
                        vlm_category = %s, vlm_item_name = %s, vlm_price_estimate = %s,
                        vlm_store_type = %s, vlm_store_name = %s, vlm_description = %s,
                        vlm_confidence = %s, is_valid = %s, vlm_groups = %s
                    WHERE photo_id = %s
                """, (
                    result.get("category"), result.get("item_name"),
                    result.get("price") or None, result.get("location_type"),
                    result.get("store_name"), result.get("description"),
                    result.get("confidence", "low"), bool(result.get("is_valid", True)),
                    groups_json, photo_id
                ))
            else:
                await cur.execute("""
                    INSERT INTO photo_vlm_results
                        (photo_id, vlm_category, vlm_item_name, vlm_price_estimate,
                         vlm_store_type, vlm_store_name, vlm_description,
                         vlm_confidence, is_valid, vlm_groups)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    photo_id, result.get("category"), result.get("item_name"),
                    result.get("price") or None, result.get("location_type"),
                    result.get("store_name"), result.get("description"),
                    result.get("confidence", "low"), bool(result.get("is_valid", True)),
                    groups_json
                ))
            await conn.commit()
    return {"ok": True, "photo_id": photo_id, "category": result.get("category")}


@router.post("/vlm-reprocess/{photo_id}")
async def reprocess_photo(photo_id: int):
    return await _do_reprocess(photo_id)


@router.post("/vlm-reprocess-all")
async def reprocess_all(background_tasks: BackgroundTasks):
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("""
                SELECT p.photo_id FROM photos p
                LEFT JOIN photo_vlm_results v ON p.photo_id = v.photo_id
                WHERE v.photo_id IS NULL
                ORDER BY p.created_at DESC LIMIT 50
            """)
            rows = await cur.fetchall()
    photo_ids = [r[0] for r in rows]

    async def run_all():
        for pid in photo_ids:
            await _do_reprocess(pid)
            await asyncio.sleep(0.3)

    background_tasks.add_task(run_all)
    return {"ok": True, "queued": len(photo_ids)}


@router.get("/avatar-detail/{user_id}")
async def avatar_detail(user_id: int, start: str = Query(None), end: str = Query(None)):
    """
    아바타가 '왜' 이렇게 생성됐는지 근거 데이터를 반환한다.
    아바타 생성기(avatar_service)와 동일한 헬퍼·기간 로직을 재사용해 실제 생성 근거와 일치시킨다.

    프롬프트 요소 ↔ 근거 데이터:
      - 표정       ← 사진 감정(emotion_distribution + photos)
      - 소품       ← VLM 아이템(top_items + photos)
      - 옷/소비    ← top 카테고리(category_spend + category_transactions)
      - 배경/시간  ← 결제 시간대(time_distribution)
      - 생애주기   ← life_stage

    기간 미지정 시: 최신 아바타 생성 주(avatar_created_at 직전 주, 없으면 지난주).
    """
    from collections import defaultdict
    from datetime import datetime, timedelta
    from zoneinfo import ZoneInfo
    from app.services.avatar_service import (
        CATEGORY_ID_MAP, TIME_SLOTS, _classify_time_slot, _extract_hour,
        _extract_persona_elements, _LIFE_STAGE_VIBE,
    )
    from app.services.ai_insight_service import LIFE_STAGE_KO
    from app.core.constants import MOOD_NAME_TO_EMOJI, MOOD_KO
    from app.core.emotion import pick_top_mood_name
    from app.db.transaction_repository import (
        get_transactions_by_date_range, get_mapped_transactions_with_vlm,
        get_photo_emotions_by_payment_date,
    )
    from app.db.user_repository import get_user_life_stage

    # 감정 enum 이름(HAPPY) → 이모지(☺️) → 한글(행복/만족). MOOD_KO는 이모지 키.
    def _mko(name):
        return MOOD_KO.get(MOOD_NAME_TO_EMOJI.get(name or "", ""), name)

    pool = await get_pool()

    # 1) 사용자 + 최신 아바타
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("SELECT name FROM users WHERE user_id=%s", (user_id,))
            urow = await cur.fetchone()
            if not urow:
                return {"error": "user not found"}
            user_name = urow[0]
            await cur.execute("""
                SELECT avatar_name, avatar_img_url, avatar_explain, avatar_created_at
                FROM avatar WHERE user_id=%s ORDER BY avatar_created_at DESC LIMIT 1
            """, (user_id,))
            arow = await cur.fetchone()

    avatar = None
    ref_date = None
    if arow:
        avatar = {
            "name": arow[0], "img_url": arow[1], "explain": arow[2],
            "created_at": str(arow[3]) if arow[3] else None,
        }
        if arow[3] and hasattr(arow[3], "date"):
            ref_date = arow[3].date()

    # 2) 기간: 명시값 > 아바타가 대표하는 주 > 지난주(now)
    #   avatar_created_at은 해당 아바타가 대표하는 주의 시작(월요일 00:00)으로 저장된다.
    #   따라서 created_at이 속한 주(월~일)가 곧 페르소나 기간이다.
    if start and end:
        start_date, end_date = start, end
    elif ref_date:
        # 생성 로직상 avatar_created_at = 생성 기간 시작(start_date), end_date = start_date + 6일.
        start_date, end_date = str(ref_date), str(ref_date + timedelta(days=6))
    else:
        base = datetime.now(ZoneInfo("Asia/Seoul")).date()
        this_monday = base - timedelta(days=base.weekday())
        last_monday = this_monday - timedelta(days=7)
        start_date, end_date = str(last_monday), str(last_monday + timedelta(days=6))

    # 3) 생성기와 동일 소스 조회
    transactions = await get_transactions_by_date_range(user_id, start_date, end_date)
    mapped = await get_mapped_transactions_with_vlm(user_id, start_date, end_date)
    photo_emotions = await get_photo_emotions_by_payment_date(user_id, start_date, end_date)
    life_stage_code = (await get_user_life_stage(user_id)) or "NEW_JOB"

    # 매핑 사진(소품/표정 근거, url 포함) — payment_date 기준, 사진 단위 dedupe
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("""
                SELECT p.photo_id, MAX(p.image_url), MAX(pvr.vlm_item_name),
                       MAX(pvr.vlm_category), MAX(pvr.vlm_description), MAX(et.emoji)
                FROM (
                    SELECT DISTINCT pt.photo_id, pt.vlm_id
                    FROM persona_transaction pt
                    JOIN transactions t ON pt.payment_id = t.payment_id
                    WHERE pt.user_id=%s AND t.payment_date BETWEEN %s AND %s
                ) pt
                JOIN photos p ON pt.photo_id = p.photo_id
                JOIN photo_vlm_results pvr ON pt.vlm_id = pvr.vlm_id
                LEFT JOIN emotions_text et ON pt.photo_id = et.photo_id
                GROUP BY p.photo_id
            """, (user_id, start_date, end_date))
            prows = await cur.fetchall()

    mapped_photos = [
        {
            "photo_id": r[0], "url": r[1], "vlm_item_name": r[2],
            "vlm_category": r[3], "vlm_description": r[4],
            "emotion": r[5], "emotion_ko": _mko(r[5]),
            "emotion_emoji": MOOD_NAME_TO_EMOJI.get(r[5]),
        }
        for r in prows
    ]

    # 4) 페르소나 핵심값 — 생성기와 동일 헬퍼 사용
    top_mood = pick_top_mood_name(photo_emotions)
    emoji = MOOD_NAME_TO_EMOJI.get(top_mood) if top_mood else None
    # 생성기와 동일하게 매핑 거래(payment_date 기준)에서 vlm 아이템 추출
    vlm_items = list(dict.fromkeys(r["vlm_item_name"] for r in mapped if r.get("vlm_item_name")))
    elements = _extract_persona_elements(transactions, vlm_items, emoji or "")
    top_category = elements["top_category"]
    dominant_slot = elements["dominant_slot"]
    top_items = vlm_items[:2] if vlm_items else [top_category]

    # 5) 근거 집계 (금액·가맹점은 실제 소비 payment_out>0 기준, 시간대는 전체)
    category_spend: dict[str, int] = defaultdict(int)
    category_count: dict[str, int] = defaultdict(int)
    slot_count: dict[str, int] = defaultdict(int)
    place_count: dict[str, int] = defaultdict(int)
    for t in transactions:
        out = int(t.get("payment_out") or 0)
        cat = CATEGORY_ID_MAP.get(t.get("payment_category_id"), "기타") if t.get("payment_category_id") else "기타"
        hour = _extract_hour(t.get("payment_time"))
        if hour is not None:
            slot_count[_classify_time_slot(hour)] += 1
        if out > 0:
            category_spend[cat] += out
            category_count[cat] += 1
            place = (t.get("payment_place") or "").strip()
            if place:
                place_count[place] += 1

    category_spend_list = [
        {"category": c, "amount": a, "count": category_count[c]}
        for c, a in sorted(category_spend.items(), key=lambda x: x[1], reverse=True)
    ]
    category_transactions = sorted(
        [
            {
                "place": (t.get("payment_place") or "").strip() or "가맹점 미상",
                "amount": int(t.get("payment_out") or 0),
                "date": str(t.get("payment_date")) if t.get("payment_date") else None,
                "time": str(t.get("payment_time")) if t.get("payment_time") else None,
            }
            for t in transactions
            if int(t.get("payment_out") or 0) > 0
            and (CATEGORY_ID_MAP.get(t.get("payment_category_id"), "기타") if t.get("payment_category_id") else "기타") == top_category
        ],
        key=lambda x: x["amount"], reverse=True,
    )[:20]
    time_distribution = [
        {"slot": s, "emoji": TIME_SLOTS[s]["emoji"], "count": slot_count.get(s, 0)}
        for s in TIME_SLOTS
    ]
    emo_count: dict[str, int] = defaultdict(int)
    for mood, _taken in photo_emotions:
        if mood:
            emo_count[mood] += 1
    emotion_distribution = [
        {"name": m, "ko": _mko(m), "emoji": MOOD_NAME_TO_EMOJI.get(m, ""), "count": c}
        for m, c in sorted(emo_count.items(), key=lambda x: x[1], reverse=True)
    ]
    top_places = [
        {"place": p, "count": c}
        for p, c in sorted(place_count.items(), key=lambda x: x[1], reverse=True)[:5]
    ]

    return {
        "user_id": user_id,
        "name": user_name,
        "period": {"start": start_date, "end": end_date},
        "avatar": avatar,
        "life_stage": {
            "code": life_stage_code,
            "label": LIFE_STAGE_KO.get(life_stage_code, life_stage_code),
            "vibe": _LIFE_STAGE_VIBE.get(life_stage_code, ""),
        },
        "persona": {
            "top_category": top_category,
            "dominant_slot": dominant_slot,
            "dominant_slot_emoji": TIME_SLOTS.get(dominant_slot, {}).get("emoji", ""),
            "top_emotion": (
                {"name": top_mood, "ko": _mko(top_mood), "emoji": emoji}
                if top_mood else None
            ),
            "top_items": top_items,
        },
        "evidence": {
            "total_tx": len(transactions),
            "total_spend": sum(category_spend.values()),
            "category_spend": category_spend_list,
            "category_transactions": category_transactions,
            "time_distribution": time_distribution,
            "emotion_distribution": emotion_distribution,
            "top_places": top_places,
            "photos": mapped_photos,
        },
    }
