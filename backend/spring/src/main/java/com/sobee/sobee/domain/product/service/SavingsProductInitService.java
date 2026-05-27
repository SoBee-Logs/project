package com.sobee.sobee.domain.product.service;

import com.sobee.sobee.domain.product.repository.SavingsProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class SavingsProductInitService {

    private final SavingsProductRepository savingsProductRepository;
    private final SavingsProductSyncService savingsProductSyncService;

    public void init() {
        if (savingsProductRepository.count() > 0) {
            log.info("예적금 데이터 이미 존재 ({} 건), 스킵", savingsProductRepository.count());
            return;
        }

        log.info("예적금 데이터 적재 시작...");
        try {
            int count = savingsProductSyncService.syncAll();
            log.info("예적금 {}건 적재 완료", count);
        } catch (Exception e) {
            log.error("예적금 적재 실패: {}", e.getMessage());
        }
    }
}