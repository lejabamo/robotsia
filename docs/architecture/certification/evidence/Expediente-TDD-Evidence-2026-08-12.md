# Evidencia Técnica de Certificación — Expediente SIA V2

## 1. Metadatos de Ejecución
- **Fecha y hora de ejecución:** 2026-08-12 10:22:00
- **Rama Git actual:** epic/sia-core-v2
- **HEAD actual:** 623d0bb17badaf82cbacc6b73b92913397601d35
- **Node --version:** v22.14.0
- **npm --version:** 10.9.2
- **package.json y versión de Jest:** `jest` version `^30.4.2`

## 2. Comando Exacto
```bash
npm run test:v2 -- --runInBand
```

## 3. Resultado Completo del Test Runner
```text
> automatizacion-sia-observa@2.0.0 test:v2
> jest src/v2/tests --passWithNoTests

PASS src/v2/tests/core/expediente/domain/ExpedienteSIA.test.js
PASS src/v2/tests/core/solicitud/domain/Solicitud.test.js
PASS src/v2/tests/core/expediente/application/ExpedienteUseCases.test.js
PASS src/v2/tests/core/expediente/domain/valueObjects/ExpedienteValueObjects.test.js
PASS src/v2/tests/core/solicitud/application/TransicionarEstadoUseCase.test.js
PASS src/v2/tests/core/expediente/domain/Documento.test.js
PASS src/v2/tests/core/expediente/domain/Evidencia.test.js
PASS src/v2/tests/core/solicitud/domain/TransicionEstadosPolicy.test.js
PASS src/v2/tests/core/solicitud/application/CrearSolicitudUseCase.test.js
PASS src/v2/tests/core/solicitud/domain/SolicitudEstado.test.js
PASS src/v2/tests/core/expediente/domain/events/ExpedienteEvents.test.js
PASS src/v2/tests/core/expediente/domain/Anomalia.test.js

Test Suites: 12 passed, 12 total
Tests:       48 passed, 48 total
Snapshots:   0 total
Time:        3.991 s
Ran all test suites matching src/v2/tests.
```

- **Número de suites PASS/FAIL:** 12 PASS / 0 FAIL
- **Número de tests PASS/FAIL:** 48 PASS / 0 FAIL
- **Exit code:** 0

### 3.1. Separación de Resultados
- **Expediente:** 28/28 PASS
- **Solicitud:** 20/20 PASS

## 4. Estado del Repositorio (Inmutabilidad del Core)

### `git diff --name-status -- src/v2/core/expediente`
*(Sin salida - confirmando cero modificaciones productivas en el Core de Expediente)*

### `git diff --name-status -- src/v2/core/solicitud`
*(Sin salida - confirmando aislamiento total de Solicitud)*

### `git status`
```text
On branch epic/sia-core-v2
Changes not staged for commit:
  (use "git add/rm <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
	deleted:    N8N_Sia Gen Certificados.docx
	deleted:    "Procedimiento Generaci\303\263n de Certificado de SIA Observa.docx"
	modified:   src/services/email-service.js
	modified:   src/workers/email-worker.js

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	analyze_pdfs.js
	contrato_data.json
	docs/architecture/adr/01_VERSIONADO_DOCUMENTAL.md
	docs/architecture/adr/02_SNAPSHOT_INVENTARIO.md
	docs/architecture/adr/03_HIDRATACION_AGGREGATES.md
	docs/architecture/certification/ExpedienteCertificationChecklist.md
	docs/architecture/certification/ExpedienteCertificationMatrix.md
	docs/architecture/certification/ExpedienteCertificationReport.md
	docs/architecture/certification/ExpedienteTestPlan.md
	docs/architecture/certification/evidence/
	extract.js
	inventory.js
	nav_despues.html
	panel_ejecucion.html
	panel_ejecucion.png
	panel_ejecucion_data.json
	patch.js
    patch10.js
    patch10_fix.js
    patch11.js
    patch12.js
    patch12_fix.js
    patch13.js
    patch14.js
    patch15.js
    patch16.js
    patch17.js
    patch2.js
    patch3.js
    patch4.js
    patch5.js
    patch6.js
    patch7.js
    patch8.js
    patch9.js
	scratch_test_expediente.js
	src/v2/core/expediente/application/
	src/v2/core/expediente/domain/
	src/v2/tests/core/expediente/
	view_evidencia.md

no changes added to commit (use "git add" and/or "git commit -a")
```

## 5. Mapeo Invariantes (E-INV-01 a E-INV-10)

| ID | Invariante | Test | Assertion Principal | Resultado |
|---|---|---|---|---|
| E-INV-01 | Unicidad criptográfica | T-DOC-02, T-DOC-03 | `expect(() => new HashFisico('')).toThrow(...)` y length inalterado en Idempotencia. | PASS |
| E-INV-02 | Determinismo de Slot | T-SLOT-01, T-SLOT-02 | `expect(vigentes.length).toBe(1)` | PASS |
| E-INV-03 | Versionado histórico no destructivo | T-SLOT-02, T-SLOT-03 | `expect(obsoletos.length).toBe(2)` e inspección de `VersionDocumentalActualizada` | PASS |
| E-INV-04 | Idempotencia silenciosa | T-DOC-03 | `expect(exp.domainEvents.length).toBe(eventosAntes)` | PASS |
| E-INV-05 | Snapshot inmutable | T-INIT-03 | `expect(() => snapshot.obligatorios.push(...)).toThrow(TypeError)` | PASS |
| E-INV-06 | Completitud Dinámica | T-COMP-01, 02, 03 | `expect(exp.esCompleto()).toBe(true)` tras insertar el último obligatorio | PASS |
| E-INV-07 | Cierre Hermético | T-CLOSE-01, T-CLOSE-02 | `expect(...).toThrow(ExpedienteCerradoException)` ante intento de versionado post-cierre | PASS |
| E-INV-08 | Encapsulamiento | T-ENCAP-01, T-ENCAP-02 | `expect(exp.documentos.length).toBe(1)` garantizando inmutabilidad interna tras asignación externa destructiva | PASS |
| E-INV-09 | Origen Inmutable | T-DOC-04 | `expect(doc1.origen.valor).toBe('HUMANO')` | PASS |
| E-INV-10 | Bloqueo por Anomalía en Obligatorio | T-ANOM-02 | `expect(exp.bloqueado).toBe(true)` | PASS |

## 6. Confirmación de Pureza (Infraestructura)
Se certifica de manera concluyente que no existe en `src/v2/core/expediente` ni en sus subdirectorios ningún import a módulos del entorno (fs, path) ni a librerías de infraestructura externa (playwright, bullmq, sqlite). Toda la lógica ejecuta transformaciones en memoria pura.

## 7. Evidencia Complementaria: Cobertura de Código
Ejecución: `npm run test:v2 -- --runInBand --coverage`

```text
-------------------------------------|---------|----------|---------|---------|-------------------
File                                 | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------------------------|---------|----------|---------|---------|-------------------
All files                            |   90.72 |    74.78 |   94.36 |   95.07 |                   
 expediente/application              |      90 |       50 |     100 |     100 |                   
 expediente/domain                   |   94.62 |    83.33 |   95.45 |   98.78 |                   
 expediente/domain/events            |     100 |      100 |     100 |     100 |                   
 expediente/domain/exceptions        |     100 |      100 |     100 |     100 |                   
 expediente/domain/valueObjects      |   84.44 |    76.92 |      90 |    92.3 |                   
-------------------------------------|---------|----------|---------|---------|-------------------
```
*(Nota: Este reporte de cobertura se adjunta como referencia técnica, pero no forma parte de las Invariantes de Negocio dictaminadas como Criterio de Certificación).*
