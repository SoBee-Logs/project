package com.sobee.sobee.domain.product.service;

import com.sobee.sobee.domain.product.entity.InsuranceCoverage;
import com.sobee.sobee.domain.product.entity.InsuranceProduct;
import com.sobee.sobee.domain.product.repository.InsuranceProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class InsuranceProductService {

    private final InsuranceProductRepository insuranceRepo;

    public List<InsuranceProduct> findAll() {
        return insuranceRepo.findAll();
    }

    public List<InsuranceProduct> findByCategory(String category) {
        return insuranceRepo.findByCategory(category);
    }

    public List<InsuranceProduct> findByAge(int age) {
        return insuranceRepo.findByAge(age);
    }

    public List<InsuranceProduct> search(String keyword) {
        return insuranceRepo.searchByKeyword(keyword);
    }

    @Transactional
    public InsuranceProduct save(InsuranceProduct product) {
        product.setSyncedAt(LocalDateTime.now());
        return insuranceRepo.save(product);
    }

    @Transactional
    public InsuranceProduct saveWithCoverages(InsuranceProduct product, List<InsuranceCoverage> coverages) {
        product.setSyncedAt(LocalDateTime.now());
        for (InsuranceCoverage c : coverages) {
            product.addCoverage(c);
        }
        return insuranceRepo.save(product);
    }
}