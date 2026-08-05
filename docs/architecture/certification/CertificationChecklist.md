# Plantilla: Certification Checklist

**Propósito:** Proveer un cuestionario binario estricto para declarar formalmente que un dominio está certificado. No se evalúan métricas porcentuales genéricas de cobertura, sino el blindaje funcional de las reglas del dominio.

## Criterios Binarios de Aprobación

- [ ] **Diseño del Dominio:** Todas las invariantes y reglas de transición fueron implementadas y validadas explícitamente en el diseño. (PASS/FAIL)
- [ ] **Aislamiento Técnico:** El dominio es puramente lógico, no requiere contenedor Docker, base de datos ni importa librerías externas (Node FS, etc). (PASS/FAIL)
- [ ] **Cobertura Invariante:** El 100% de las invariantes mapeadas poseen al menos un test unitario que demuestra su protección. (PASS/FAIL)
- [ ] **Idempotencia Garantizada:** Las operaciones transicionales repetidas hacia un mismo estado funcionan como operaciones silenciosas sin alterar la inmutabilidad de fechas o datos. (PASS/FAIL)
- [ ] **Excepciones Semánticas:** El dominio arroja excepciones tipificadas del dominio (ej. `TransicionIlegalException`), erradicando los `Error` genéricos. (PASS/FAIL)
- [ ] **Bloqueo Terminal:** Los estados terminales (COMPLETADA, FALLIDA) rechazan invariablemente cualquier comando de modificación bajo cualquier vector. (PASS/FAIL)
- [ ] **Completitud Documental:** La matriz de certificación (Certification Matrix) se encuentra completamente en estado PASS. (PASS/FAIL)

**VEREDICTO ARQUITECTÓNICO FINAL:** [CERTIFICADO / PENDIENTE / RECHAZADO]
