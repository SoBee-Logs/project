async def run_mapping(user_id: int) -> dict:
    """photo_vlm_results ↔ transactions를 LLM으로 매핑해 persona_transaction에 저장.
    LLM 매핑 로직 설계 후 구현 예정."""
    # TODO: photo_vlm_results에서 해당 user_id의 미매핑 사진 조회
    # TODO: transactions에서 같은 기간 결제내역 조회
    # TODO: LLM으로 사진 description ↔ 결제내역 매칭
    # TODO: 매칭 결과 persona_transaction에 INSERT
    raise NotImplementedError("run_mapping: LLM 매핑 로직 설계 후 구현")
