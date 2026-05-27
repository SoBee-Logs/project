package com.sobee.sobee.domain.product.repository;

import com.sobee.sobee.domain.product.entity.InsuranceCoverage;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface InsuranceCoverageRepository extends JpaRepository<InsuranceCoverage, Long> {

    List<InsuranceCoverage> findByInsuranceProduct_ProductId(String productId);
}