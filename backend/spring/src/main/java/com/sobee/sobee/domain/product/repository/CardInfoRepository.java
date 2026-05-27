package com.sobee.sobee.domain.product.repository;

import com.sobee.sobee.domain.product.entity.CardInfo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface CardInfoRepository extends JpaRepository<CardInfo, Long> {

    Optional<CardInfo> findByGorillaId(Integer gorillaId);

    List<CardInfo> findByCorpName(String corpName);

    List<CardInfo> findByIsDiscontinuedFalse();

    @Query("SELECT c FROM CardInfo c WHERE c.cardName LIKE %:keyword% OR c.corpName LIKE %:keyword%")
    List<CardInfo> searchByKeyword(@Param("keyword") String keyword);

    @Query("SELECT DISTINCT c FROM CardInfo c JOIN c.benefits b WHERE b.cateName LIKE %:category%")
    List<CardInfo> searchByBenefitCategory(@Param("category") String category);

    @Query("SELECT DISTINCT c FROM CardInfo c LEFT JOIN FETCH c.benefits")
    List<CardInfo> findAllWithBenefits();

    @Query("SELECT DISTINCT c FROM CardInfo c LEFT JOIN FETCH c.topBenefits")
    List<CardInfo> findAllWithTopBenefits();

    @Query("SELECT DISTINCT c FROM CardInfo c LEFT JOIN FETCH c.benefits WHERE c.cardInfoId IN :ids")
    List<CardInfo> findAllWithBenefitsByIds(@Param("ids") List<Long> ids);
}