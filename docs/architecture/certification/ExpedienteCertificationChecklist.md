# Certification Checklist — Expediente SIA

**Propósito:** Proveer un cuestionario estricto para declarar formalmente que el dominio Expediente está certificado tras la ejecución de TDD.

## Definition of Done (DoD)

- [x] **Cobertura Crítica:** Todos los escenarios críticos de la Matriz (E-INV-01 a E-INV-10) fueron implementados y pasan exitosamente (PASS).
- [x] **Cero Fallos:** No existen tests fallidos ni flakey tests en la suite completa `src/v2/tests/core/expediente`.
- [x] **Inmutabilidad Productiva:** El código funcional de `src/v2/core/expediente/` NO fue alterado o relajado artificialmente para encajar con los tests.
- [x] **Pureza del Core Garantizada:** No se importaron librerías de infraestructura (`fs`, `playwright`, `bullmq`) ni en el dominio ni en los mocks lógicos.
- [x] **Aislamiento de Dominios:** La carpeta `src/v2/core/solicitud/` permanece 100% intacta.
- [x] **Evidencia Reproducible:** La salida de Jest (`npm run test:v2 -- --runInBand`) es consistente y reproducible sin dependencias de I/O temporal.
- [x] **Completitud Documental:** Matrix, Test Plan y Checklist están verificados y el Certification Report futuro contendrá los resultados reales de consola.

**VEREDICTO ACTUAL:** CERTIFICABLE — EVIDENCIA COMPLETADA — PENDIENTE DE COMMIT
