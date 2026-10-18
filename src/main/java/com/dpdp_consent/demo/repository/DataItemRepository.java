package com.dpdp_consent.demo.repository;

import com.dpdp_consent.demo.model.DataItem;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface DataItemRepository extends JpaRepository<DataItem, Long> {
    Optional<DataItem> findByName(String name);
}