package com.sobee.sobee.domain.product.service;

import com.sobee.sobee.domain.product.entity.CardInfo;
import com.sobee.sobee.domain.product.repository.CardInfoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CardService {

    private final CardInfoRepository cardInfoRepository;

    public List<CardInfo> findAll() {
        return cardInfoRepository.findAll();
    }

    public List<CardInfo> findActive() {
        return cardInfoRepository.findByIsDiscontinuedFalse();
    }

    public List<CardInfo> findByCorpName(String corpName) {
        return cardInfoRepository.findByCorpName(corpName);
    }

    public List<CardInfo> search(String keyword) {
        return cardInfoRepository.searchByKeyword(keyword);
    }
}