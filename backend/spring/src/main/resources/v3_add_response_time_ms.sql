-- VLM 응답시간 (Gemini 호출 ms)
ALTER TABLE photo_vlm_results
    ADD COLUMN response_time_ms INT DEFAULT NULL;

-- 일기 생성 응답시간 (OpenAI 호출 ms)
ALTER TABLE diary
    ADD COLUMN response_time_ms INT DEFAULT NULL;

-- 아바타 생성 응답시간 (Gemini 분석 + DALL-E 이미지 합산 ms)
ALTER TABLE avatar
    ADD COLUMN response_time_ms INT DEFAULT NULL;
