package com.sobee.sobee.domain.product.repository.es;

import com.sobee.sobee.domain.product.document.CardDocument;
import org.springframework.data.elasticsearch.repository.ElasticsearchRepository;

public interface CardSearchRepository extends ElasticsearchRepository<CardDocument, String> {
}
