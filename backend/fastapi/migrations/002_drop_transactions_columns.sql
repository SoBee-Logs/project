-- 실행 전 백업 필수
ALTER TABLE `transactions`
    DROP COLUMN `approval_no`,
    DROP COLUMN `card_no`,
    DROP COLUMN `fetched_at`,
    DROP COLUMN `organization`,
    DROP COLUMN `source`,
    DROP COLUMN `source_id`;
