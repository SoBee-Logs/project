package com.sobee.sobee.domain.product.repository;

import com.sobee.sobee.domain.product.entity.SavingsProduct;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface SavingsProductRepository extends JpaRepository<SavingsProduct, Long> {

    Optional<SavingsProduct> findByFinPrdtCdAndSaveTrm(String finPrdtCd, Integer saveTrm);

    List<SavingsProduct> findByKorCoNm(String korCoNm);

    List<SavingsProduct> findTop10ByOrderByIntrMaxRateDesc();

    @Query("SELECT s FROM SavingsProduct s WHERE s.finPrdtNm LIKE %:keyword% OR s.spclCnd LIKE %:keyword%")
    List<SavingsProduct> searchByKeyword(@Param("keyword") String keyword);
}