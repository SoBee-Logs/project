"""
test_category_mapping.py
카테고리 매핑 로직 테스트용 스크립트
"""
import asyncio
from app.services import category_mapping_service

TEST_USER_ID = 13


async def main():
    print("=" * 60)
    print("STEP 1: 룰베이스 매핑 배치")
    print("=" * 60)
    result = await category_mapping_service.resolve_and_update_all_unmapped()
    print(f"  - 전체:            {result['total']}건")
    print(f"  - 매핑 성공:       {result['matched']}건")
    print(f"  - 기타로 fallback: {result['etc']}건")
    print()

    if result['etc'] == 0:
        print("✅ 기타로 빠진 게 없어서 LLM 처리는 스킵합니다.")
        return

    print("=" * 60)
    print("STEP 2: LLM 분류 처리")
    print("=" * 60)
    llm_result = await category_mapping_service.process_llm_for_etc_transactions(batch_size=50)
    print(f"  - {llm_result.get('message')}")
    print(f"  - 페어 처리:                {llm_result['processed']}건")
    print(f"  - 백필된 transactions:      {llm_result['transactions_backfilled']}건")
    print()
    print("=" * 60)
    print("✅ 완료!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())