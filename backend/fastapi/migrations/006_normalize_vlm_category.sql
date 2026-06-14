-- VLM이 슬래시를 누락해 저장한 vlm_category 값을 category_master 표기로 통일
-- 실행 전 백업 권장
UPDATE `photo_vlm_results` SET `vlm_category` = '카페/간식' WHERE `vlm_category` = '카페간식';
UPDATE `photo_vlm_results` SET `vlm_category` = '문화/여가' WHERE `vlm_category` = '문화여가';
UPDATE `photo_vlm_results` SET `vlm_category` = '패션/쇼핑' WHERE `vlm_category` = '패션쇼핑';
