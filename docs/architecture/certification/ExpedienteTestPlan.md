# Test Plan — Expediente SIA

## 1. Alcance
Certificar el Aggregate Root `ExpedienteSIA`, Entidades, Value Objects y Use Cases a través de TDD, validando el comportamiento puro en memoria.

## 2. Inventario de Escenarios TDD (Cobertura Funcional)

### A. Inicialización
- **T-INIT-01:** Expediente inicializado correctamente con ID e Inventario (Emite ExpedienteInicializado).
- **T-INIT-02:** Excepción si se intenta re-inicializar un ExpedienteSIA existente.
- **T-INIT-03:** Snapshot profundo es inmutable ante mutaciones de arreglos externos.
- **T-INIT-04:** Excepciones al inyectar parámetros inválidos en VOs de inicialización.

### B. Documentos & Value Objects
- **T-DOC-01:** Documento instanciado con todos sus VOs correctamente en estado VIGENTE.
- **T-DOC-02:** Falla al crear HashFisico o TipoDocumental con inputs inválidos.
- **T-DOC-03 (W1/W2/W3):** Idempotencia: reintegrar el mismo HashFisico resulta en NO-OP (0 eventos, sin duplicados).
- **T-DOC-04:** Identidad origen: diferenciación entre origen MAQUINA y origen HUMANO al instanciar.

### C. Slots & Versionado
- **T-SLOT-01:** Primer documento ocupa el Slot lógico como VIGENTE.
- **T-SLOT-02 (W5):** Integrar documento con mismo TipoDocumental pero distinto Hash muta el anterior a OBSOLETO y asume VIGENTE.
- **T-SLOT-03:** El agregado emite el evento `VersionDocumentalActualizada` preservando la historia.
- **T-SLOT-04:** Invariante asegurada: El agregado nunca retiene 2 documentos VIGENTES del mismo TipoDocumental simultáneamente.

### D. Completitud Derivada
- **T-COMP-01:** Expediente inicia con `esCompleto() === false`.
- **T-COMP-02:** Documento opcional integrado NO altera el estado de completitud.
- **T-COMP-03:** Integración del último obligatorio cambia estado derivado y emite una única vez `ExpedienteCompletado`.
- **T-COMP-04:** La completitud obedece exclusivamente a las reglas congeladas en el `InventarioSnapshot`.

### E. Cierre Hermético
- **T-CLOSE-01:** Integrar un nuevo documento en expediente completado arroja `ExpedienteCerradoException`.
- **T-CLOSE-02:** Integrar nueva versión de un documento existente tras el cierre arroja `ExpedienteCerradoException`.
- **T-CLOSE-03:** Adjuntar Evidencia en expediente completado es permitido.
- **T-CLOSE-04:** Registrar Anomalía en expediente completado es permitido.

### F. Anomalías
- **T-ANOM-01:** Registrar anomalía sobre documento opcional no bloquea el expediente, emite `AnomaliaRegistrada`.
- **T-ANOM-02 (W4):** Registrar anomalía sobre documento obligatorio cambia estado a bloqueado y emite `ExpedienteBloqueado`.

### G. Evidencias
- **T-EVID-01:** Adjuntar evidencia agrega a la colección privada y emite `EvidenciaAdjuntada`.

### H. Encapsulamiento
- **T-ENCAP-01:** Modificar el array retornado por `expediente.documentos` no altera la colección interna del Aggregate.
- **T-ENCAP-02:** El agregado carece de setters públicos directos para sus colecciones internas.

### I. Casos de Uso (Application Services)
- **T-UC-01:** `InicializarExpedienteUseCase` orquesta IExpedienteRepository exitosamente.
- **T-UC-02:** `IntegrarDocumentoUseCase` delega inserción origen MAQUINA y persiste.
- **T-UC-03:** `RegistrarAnomaliaUseCase` delega y persiste.
- **T-UC-04:** `IntegrarEvidenciaUseCase` delega y persiste.
- **T-UC-05:** `ObtenerEstadoCompletitudUseCase` retorna DTO con cálculo dinámico correcto.
- **T-UC-06 (W6/W7):** `IntegrarDocumentoManualUseCase` fuerza la inyección origen HUMANO.

## 3. Resiliencia & Límites del Dominio
- W1/W2/W3 (Caídas / Reintentos redundantes): El dominio está protegido por la Idempotencia (T-DOC-03).
- W4 (Falla irrecuperable de SECOP): Soportado delegando el flujo a T-ANOM-02.
- W5 (Versión corregida publicada por SECOP): El dominio versiona orgánicamente sin perder evidencia (T-SLOT-02).

## 4. Estructura Física Proyectada
```text
src/v2/tests/core/expediente/
├── domain/
│   ├── ExpedienteSIA.test.js
│   ├── Documento.test.js
│   ├── Anomalia.test.js
│   ├── Evidencia.test.js
│   ├── valueObjects/
│   │   └── ExpedienteValueObjects.test.js
│   └── events/
│       └── ExpedienteEvents.test.js
└── application/
    └── ExpedienteUseCases.test.js
```
*(Se consolida VOs y Use Cases en un archivo o se separan según complejidad durante la codificación).*
