package com.sobee.sobee.domain.product.config;

import com.sobee.sobee.domain.product.service.CardProductInitService;
import com.sobee.sobee.domain.product.service.SavingsProductInitService;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements ApplicationRunner {

    private final CardProductInitService cardProductInitService;
    private final SavingsProductInitService savingsProductInitService;

    @Override
    public void run(ApplicationArguments args) {
        log.info("=== 금융상품 초기 데이터 적재 시작 ===");
        cardProductInitService.init();
        savingsProductInitService.init();
        log.info("=== 금융상품 초기 데이터 적재 완료 ===");
    }
}