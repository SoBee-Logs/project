package com.sobee.sobee.domain.product.repository.es;

import com.sobee.sobee.domain.product.document.InsuranceDocument;
import org.springframework.data.elasticsearch.repository.ElasticsearchRepository;

public interface InsuranceSearchRepository extends ElasticsearchRepository<InsuranceDocument, String> {
}
