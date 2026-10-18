package com.dpdp_consent.demo.repository;
import com.dpdp_consent.demo.model.DataPrincipal;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
public interface DataPrincipalRepository extends JpaRepository<DataPrincipal, Long> {
    Optional<DataPrincipal> findByPseudoId(String pseudoId);
}