# Certification Matrix — Expediente SIA

**Propósito:** Garantizar trazabilidad bidireccional entre los requisitos del dominio Expediente y su cobertura TDD.

| ID | Regla de Negocio / Invariante | Archivo Responsable | Método Responsable | Riesgo Regresión | Severidad | Estado |
|---|---|---|---|---|---|---|
| E-INV-01 | Unicidad Criptográfica (Hash único) | ExpedienteSIA.js | integrarDocumento | Medio | CRÍTICA | PASS |
| E-INV-02 | Determinismo de Slot (1 VIGENTE max) | ExpedienteSIA.js | integrarDocumento | Alto | CRÍTICA | PASS |
| E-INV-03 | Versionado Histórico No Destructivo | ExpedienteSIA.js | integrarDocumento | Alto | IMPORTANTE | PASS |
| E-INV-04 | Idempotencia Silenciosa | ExpedienteSIA.js | integrarDocumento | Bajo | IMPORTANTE | PASS |
| E-INV-05 | Snapshot Inmutable | InventarioSnapshot.js | constructor | Medio | CRÍTICA | PASS |
| E-INV-06 | Completitud Derivada Dinámica | ExpedienteSIA.js | esCompleto | Alto | CRÍTICA | PASS |
| E-INV-07 | Cierre Hermético Post-Completitud | ExpedienteSIA.js | integrarDocumento | Medio | CRÍTICA | PASS |
| E-INV-08 | Encapsulamiento de Colecciones | ExpedienteSIA.js | getters privados | Alto | IMPORTANTE | PASS |
| E-INV-09 | Origen Inmutable de Documento | Documento.js | constructor | Bajo | IMPORTANTE | PASS |
| E-INV-10 | Bloqueo por Anomalía en Obligatorio | ExpedienteSIA.js | registrarAnomalia | Medio | IMPORTANTE | PASS |
