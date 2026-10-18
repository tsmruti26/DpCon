package com.dpdp_consent.demo.repository;

import com.dpdp_consent.demo.model.Purpose;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface PurposeRepository extends JpaRepository<Purpose, Long> {
    Optional<Purpose> findByDescription(String description);
}