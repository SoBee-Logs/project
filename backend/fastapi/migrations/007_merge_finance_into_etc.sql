-- 금융(13) 카테고리를 기타(16)로 통합한다.
-- category_master의 금융(13) 행은 유지하되 더이상 분류에 사용하지 않는다.
-- 실행 전 백업 권장.
UPDATE `transactions`     SET `payment_category_id` = 16 WHERE `payment_category_id` = 13;
UPDATE `category_mapping` SET `payment_category_id` = 16 WHERE `payment_category_id` = 13;
