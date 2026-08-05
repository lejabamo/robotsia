# 09 - Arquitectura de Tiempo de Ejecución (Runtime Architecture)

Análisis de la distribución de carga y tenencia de información mientras el sistema se encuentra operando.

### ¿Qué vive en Memoria (RAM Node.js)?
- Instancias puras de los Aggregate Roots (Ej. Entidades `Solicitud`).
- Diccionarios transitorios de extracción de texto y buffers de plantillas en vuelo.
- *Riesgo mitigado:* No se mantienen archivos PDF completos parseados en arreglos en memoria RAM; se procesan de forma transaccional iterativa.

### ¿Qué vive en Redis?
- Metadatos encolados por BullMQ (IDs de trabajos, reintentos, timestamps).
- Serializaciones JSON exclusivas de los *payloads* de transición de estado.
- Lock distribuido (para evitar condiciones de carrera entre Workers clonados).

### ¿Qué vive en Disco (Filesystem)?
- Los expedientes probatorios en bruto (PDF nativos, PDF escaneados, capturas PNG en `/downloads`).
- El inventario documental estático (mapeos en archivos JSON locales temporales, ej. `panel_ejecucion_data.json`).
- Los certificados finales despachados (`.docx`) y las bases de datos ofimáticas (`.xlsx`).

### ¿Qué vive en Docker?
- Las capas nativas requeridas por el Chromium invisible de Playwright (dependencias de fuentes, x11, libnss, etc.).
- Las definiciones de aislamiento de puertos y red (`docker-compose.yml`).

### Ciclo del Garbage Collector (Node)
El diseño DDD garantiza que al terminar un caso de uso (ej. `GenerarCertificadoUseCase`), la entidad rica (`Certificación`) es eliminada de la memoria una vez que su salida (Word) toca el FileSystem y la `Solicitud` en Redis transiciona a `COMPLETADA`.
