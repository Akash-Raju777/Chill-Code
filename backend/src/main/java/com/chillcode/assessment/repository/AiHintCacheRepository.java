package com.chillcode.assessment.repository;

import com.chillcode.assessment.entity.AiHintCache;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface AiHintCacheRepository extends JpaRepository<AiHintCache, Long> {
    Optional<AiHintCache> findByHash(String hash);
}
