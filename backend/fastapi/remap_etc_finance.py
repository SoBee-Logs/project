"""
remap_etc_finance.py — 기타/금융/미분류(NULL) 결제내역만 후보로 삼아 사진 매핑 재시도 (일회성)

기존 persona_transaction 매핑은 그대로 두고,
아직 어느 거래에도 매핑되지 않은 사진만 대상으로
payment_category_id 가 NULL/13(금융)/16(기타) 인 거래 후보에 매칭한다.

사용:
    # 미리보기 (DB 변경 없음)
    python remap_etc_finance.py --dry-run

    # 실제 매핑 저장
    python remap_etc_finance.py

    # 특정 유저/기간만
    python remap_etc_finance.py --user_id 5 --start 2025-01-01 --end 2026-12-31
"""
import argparse
import asyncio
import inspect

import aiomysql

from app.db.connection import get_pool
from app.db.user_repository import get_all_user_ids
from app.services.mapping_service import (
    _get_unmapped_photos,
    _save_mapping,
    _parse_vlm_groups,
    _to_datetime_str,
    _payment_datetime_str,
)
from app.api.mapping import (
    match_photo_to_transaction,
    MappingRequest,
    VlmGroup,
    TransactionCandidate,
)

# 기타/금융/미분류
ETC_FINANCE_NULL = (16, 13)


async def _get_etc_finance_candidates(conn, user_id, start_date, end_date):
    """payment_category_id 가 NULL/13/16 인 거래만 후보로 조회."""
    async with conn.cursor(aiomysql.DictCursor) as cur:
        await cur.execute(
            """
            SELECT payment_id, payment_date, payment_time, payment_out,
                   payment_place, payment_category, payment_address
            FROM transactions
            WHERE user_id = %s
              AND payment_date BETWEEN %s AND %s
              AND (payment_category_id IS NULL OR payment_category_id IN (13, 16))
            ORDER BY payment_date ASC, payment_time ASC
            """,
            (user_id, start_date, end_date),
        )
        return [dict(r) for r in await cur.fetchall()]


async def remap_user(conn, user_id, start_date, end_date, dry_run):
    photos = await _get_unmapped_photos(conn, user_id, start_date, end_date)
    if not photos:
        return 0

    candidates_raw = await _get_etc_finance_candidates(conn, user_id, start_date, end_date)
    if not candidates_raw:
        print(f"  user={user_id}: 안 붙은 사진 {len(photos)}장 있으나 기타/금융/null 후보 없음")
        return 0

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

    print(f"  user={user_id}: 안 붙은 사진 {len(photos)}장 · 기타/금융/null 후보 {len(candidates)}건")

    mapped = 0
    used_payment_ids = set()

    for photo in photos:
        taken_at_str = _to_datetime_str(photo["taken_at"]) if photo.get("taken_at") else None
        location = photo.get("vlm_address") or ""

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
            groups = [
                VlmGroup(
                    group_id=1,
                    store=photo.get("vlm_store_name"),
                    category=photo.get("vlm_category"),
                    items=[photo["vlm_item_name"]] if photo.get("vlm_item_name") else [],
                    price=float(photo["vlm_price_estimate"]) if photo.get("vlm_price_estimate") else None,
                )
            ]

        available = [c for c in candidates if c.payment_id not in used_payment_ids]
        if not available:
            break

        req = MappingRequest(
            photo_id=photo["photo_id"],
            user_id=user_id,
            taken_at=taken_at_str,
            location=location,
            groups=groups,
            candidates=available,
        )

        results = match_photo_to_transaction(req)
        if inspect.isawaitable(results):
            results = await results

        for result in results:
            if result.payment_id is None:
                continue
            matched_group = next((g for g in groups if g.group_id == result.group_id), None)
            cat = matched_group.category if matched_group else None
            print(f"    photo={photo['photo_id']} → payment={result.payment_id} "
                  f"| VLM={cat} | {result.reason}")
            if not dry_run:
                await _save_mapping(
                    conn,
                    user_id=user_id,
                    photo_id=photo["photo_id"],
                    vlm_id=photo["vlm_id"],
                    payment_id=result.payment_id,
                    group_id=result.group_id,
                    group_store=matched_group.store if matched_group else None,
                    group_category=cat,
                    group_price=matched_group.price if matched_group else None,
                )
            used_payment_ids.add(result.payment_id)
            mapped += 1

    return mapped


async def main(user_id, start_date, end_date, dry_run):
    pool = await get_pool()
    user_ids = [user_id] if user_id else await get_all_user_ids()
    print(f"{'[DRY-RUN] ' if dry_run else ''}대상 유저 {len(user_ids)}명 · 기간 {start_date}~{end_date}\n")

    total = 0
    async with pool.acquire() as conn:
        for uid in user_ids:
            mapped = await remap_user(conn, uid, start_date, end_date, dry_run)
            total += mapped
        if not dry_run:
            await conn.commit()

    print(f"\n{'[DRY-RUN] 매핑 가능' if dry_run else '매핑 저장'}: 총 {total}건")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--user_id", type=int, default=None)
    ap.add_argument("--start", default="2000-01-01")
    ap.add_argument("--end", default="2100-01-01")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    asyncio.run(main(args.user_id, args.start, args.end, args.dry_run))
