#!/usr/bin/env python3
"""
sync_transactions.py — 트랜잭션 수동 동기화 CLI

사용법:
    # 모드 A: ENV CODEF_CARD/BANK_ACCOUNTS JSON 배열 기반 (기본)
    python sync_transactions.py --user_id 1

    # 모드 B: DB users.codef_card/bank_accounts JSON 컬럼 기반
    python sync_transactions.py --user_id 2 --from_db

    # 기간 오버라이드 (기본: 최근 30일)
    python sync_transactions.py --user_id 1 --start_date 20250101 --end_date 20250131
"""
import argparse
import asyncio
import logging
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
log = logging.getLogger(__name__)


async def main() -> None:
    parser = argparse.ArgumentParser(description="CODEF 트랜잭션 수동 동기화")
    parser.add_argument("--user_id", type=int, required=True, help="저장 대상 user_id")
    parser.add_argument("--from_db", action="store_true", help="DB 계정 정보 사용 (기본: ENV)")
    parser.add_argument("--start_date", type=str, default=None, help="시작일 YYYYMMDD")
    parser.add_argument("--end_date", type=str, default=None, help="종료일 YYYYMMDD")
    args = parser.parse_args()

    from app.services.sync_service import (
        sync_transactions_env,
        sync_transactions_db,
        INITIAL_SYNC_DAYS,
    )

    try:
        if args.from_db:
            log.info(f"모드 B (DB) 시작 — user_id={args.user_id}")
            result = await sync_transactions_db(
                user_id=args.user_id,
                days=INITIAL_SYNC_DAYS,
                start_date=args.start_date,
                end_date=args.end_date,
            )
        else:
            log.info(f"모드 A (ENV) 시작 — user_id={args.user_id}")
            result = await sync_transactions_env(
                user_id=args.user_id,
                days=INITIAL_SYNC_DAYS,
                start_date=args.start_date,
                end_date=args.end_date,
            )

        log.info(
            f"완료 | 기간:{result['period']} "
            f"카드:{result['card_saved']} 계좌:{result['bank_saved']} "
            f"transactions:{result['transactions_merged']} "
            f"mapping:{result.get('mapping', {})}"
        )
    except Exception as e:
        log.error(f"동기화 실패: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
