# Plantilla: Certification Matrix

**Propósito:** Garantizar trazabilidad bidireccional entre los requisitos del dominio (reglas de negocio/invariantes) y su implementación y prueba real, mitigando el riesgo de funcionalidades huérfanas.

| Requirement ID | Regla de Negocio / Invariante | Archivo Responsable | Método Responsable | Caso de Prueba | Estado (PASS/FAIL/PENDING) | Observaciones |
|---|---|---|---|---|---|---|
| REQ-001 | Inmutabilidad/creación | Solicitud.js | constructor | S01 | PASS | Tests implementados y PASS |
| REQ-002 | Integridad estructural | Solicitud.js | constructor | S02 | PASS | Tests implementados y PASS |
| REQ-003 | Estados válidos | Solicitud.js | constructor | S03 | PASS | Tests implementados y PASS |
| REQ-004 | Transición RECIBIDA → EXPEDIENTE | Solicitud.js | transicionarEstado | S04 | PASS | Tests implementados y PASS |
| REQ-005 | Transición EXPEDIENTE → VEREDICTO | Solicitud.js | transicionarEstado | S05 | PASS | Tests implementados y PASS |
| REQ-006 | Bloqueo de salto | TransicionEstadosPolicy.js | evaluar | S06 | PASS | Tests implementados y PASS |
| REQ-007 | Bloqueo de retroceso | TransicionEstadosPolicy.js | evaluar | S07 | PASS | Tests implementados y PASS |
| REQ-008 | Cierre terminal | TransicionEstadosPolicy.js | evaluar | S08 | PASS | Tests implementados y PASS |
| REQ-009 | Inmutabilidad del contrato | Solicitud.js | set codigoContrato | S09 | PASS | Tests implementados y PASS |
| REQ-010 | Idempotencia | TransicionEstadosPolicy.js | evaluar | S10 | PASS | Tests implementados y PASS |
