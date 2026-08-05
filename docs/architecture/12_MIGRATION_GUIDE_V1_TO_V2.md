# 12 - Guía de Migración (Migration Guide V1 -> V2)

Esta guía define exactamente cómo mover las cargas de trabajo desde el diseño "monolítico por scripts" (V1) al marco formal (V2 Clean Architecture) garantizando cero riesgo de regresión de funcionalidad.

## Estrategia General (Estrangulamiento Paralelo)
La estructura V2 coexiste con la V1. Node.js procesa la V1 ignorando la V2. La migración ocurre transcribiendo lógicas sin destruir la carpeta origen hasta que la V2 certifique integración completa.

### 1. Qué Permanece
- Los archivos en disco raíz: `server.js`, `start-all.js`, configuraciones de Docker y `.env`.
- El marco tecnológico base (No cambian las librerías principales de Node).
- Las carpetas locales de volumen (`/app/downloads`, `/app/certificates`).

### 2. Qué Desaparece
- Todos los scripts experimentales transitorios (`patch*.js`, `.html`, `.json`) tirados en la raíz. (Requerirá una limpieza estricta (Purge)).
- Las clases genéricas con alta deuda que mezclan reglas de negocio con inyección de red.

### 3. Qué Migra (Refactorización Adaptativa)
- **`src/playwright/secop-download.js`**:
    - **Destino:** Se transforma en un Adaptador Secundario bajo `src/v2/infrastructure/adapters/secop/`. Pierde autonomía y ahora solo expone un método llamado por el `ExpedienteUseCase`.
- **`src/certificate/generate.js`**:
    - **Destino:** Se rompe en dos pedazos. La lógica de negocio (Fallback de SinNombre) viaja a `src/v2/core/certificacion/`. La manipulación de PizZip viaja a `src/v2/infrastructure/adapters/document_builder/`.
- **`src/queues/queue-manager.js`**:
    - **Destino:** Se transforma en orquestación BullMQ bajo `src/v2/infrastructure/messaging/` llamando activamente a los Casos de Uso V2 en vez de llamar a scripts sueltos.

### 4. Qué NO debe tocarse (Línea Roja Actual)
El módulo experimental de IMAP (`email-service.js` y `email-worker.js`) **NO** debe tocarse ni importarse a la V2 hasta que los dominios subyacentes estén terminados. Este módulo requiere un rediseño total debido a sus vulnerabilidades TLS.

### 5. Orden Estricto de Migración
1.  *(Actual)* Certificación del Dominio **Solicitud**.
2.  Diseño y Certificación del Dominio **Expediente** (Entidades e Interfaces de OCR).
3.  Migración del script Playwright al adaptador.
4.  Diseño y Certificación del Dominio **Certificación**.
5.  Migración del script docxtemplater al adaptador.
6.  Conexión de la capa de mensajería (BullMQ a los Casos de Uso).
7.  Reescribir el Lector IMAP.
8.  Destrucción definitiva de las carpetas V1 legadas.
