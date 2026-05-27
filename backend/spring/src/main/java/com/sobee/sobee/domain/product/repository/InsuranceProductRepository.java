package com.sobee.sobee.domain.product.repository;

import com.sobee.sobee.domain.product.entity.InsuranceProduct;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface InsuranceProductRepository extends JpaRepository<InsuranceProduct, String> {

    List<InsuranceProduct> findByCategory(String category);

    List<InsuranceProduct> findByInsurer(String insurer);

    @Query("SELECT i FROM InsuranceProduct i WHERE i.ageMin <= :age AND i.ageMax >= :age")
    List<InsuranceProduct> findByAge(@Param("age") int age);

    @Query("SELECT i FROM InsuranceProduct i WHERE i.situationTags LIKE %:keyword% OR i.description LIKE %:keyword% OR i.productName LIKE %:keyword%")
    List<InsuranceProduct> searchByKeyword(@Param("keyword") String keyword);
}