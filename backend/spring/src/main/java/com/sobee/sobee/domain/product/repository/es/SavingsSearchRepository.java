package com.sobee.sobee.domain.product.repository.es;

import com.sobee.sobee.domain.product.document.SavingsDocument;
import org.springframework.data.elasticsearch.repository.ElasticsearchRepository;

public interface SavingsSearchRepository extends ElasticsearchRepository<SavingsDocument, String> {
}
