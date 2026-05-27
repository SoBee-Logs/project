package com.sobee.sobee.domain.product.service;

import com.sobee.sobee.domain.product.repository.CardInfoRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class CardProductInitService {

    private final CardInfoRepository cardInfoRepository;
    private final CardSyncService cardSyncService;

    public void init() {
        if (cardInfoRepository.count() > 0) {
            log.info("카드 상품 데이터 이미 존재 ({} 건), 스킵", cardInfoRepository.count());
            return;
        }

        log.info("카드 상품 데이터 적재 시작...");
        try {
            int count = cardSyncService.syncFromJson();
            log.info("카드 상품 {}건 적재 완료", count);
        } catch (Exception e) {
            log.error("카드 상품 적재 실패: {}", e.getMessage());
        }
    }
}