-- persona_transaction: user_id, photo_id 인덱스 (VLM/감정 쿼리 풀스캔 방지)
CREATE INDEX IF NOT EXISTS idx_pt_user_id  ON persona_transaction(user_id);
CREATE INDEX IF NOT EXISTS idx_pt_photo_id ON persona_transaction(photo_id);

-- photo_metadata: taken_at 인덱스 (날짜 범위 필터)
CREATE INDEX IF NOT EXISTS idx_pm_taken_at ON photo_metadata(taken_at);

-- avatar: (user_id, avatar_created_at) 복합 인덱스 (월별 조회)
CREATE INDEX IF NOT EXISTS idx_avatar_user_created ON avatar(user_id, avatar_created_at);
