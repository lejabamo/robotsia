# 10 - Flujo de Datos (Data Flow)

El ciclo vital de la información cruza distintas fases de transformación, desde que nace como una intención desestructurada hasta que se solidifica en un documento legal.

### 1. Ingestión (Correo)
- **Dato Crudo:** Asunto y cuerpo de un email.
- **Flujo:** Un Worker IMAP lee la bandeja, extrae mediante expresiones regulares o filtros un ID de Contrato (`codigoContrato`).
- **Punto de Salida:** Comando JSON despachado al Caso de Uso `CrearSolicitud`.

### 2. Gobernabilidad (Solicitud)
- **Transformación:** El ID asume la forma de un Aggregate Root (Entidad viva) con metadatos de estado (En espera de expediente).
- **Flujo:** Redis guarda la Solicitud. BullMQ encola el requerimiento de extracción web.

### 3. Recuperación Externa (Expediente y Documentos)
- **Dato Crudo:** Páginas HTML renderizadas en SECOP y links de descarga.
- **Flujo:** Playwright inyecta el `codigoContrato`, navega, busca el botón, intercepta los streams de descarga y los vuelca al disco duro local (`/downloads`).
- **Punto de Salida:** Un lote físico (Carpetas con PDFs) y un inventario (JSON local con el mapeo).

### 4. Normalización Semántica (Texto y Variables)
- **Transformación:** El Expediente físico pasa a ser digital lógico.
- **Flujo:** Módulos de OCR o Parseo PDF escanean la carpeta, convierten binarios en cadenas de texto, aplican algoritmos heurísticos para extraer "Hechos" (Nombre del Contratista, Valores, Porcentaje de ejecución).
- **Punto de Salida:** Diccionario JSON unificado estructurado para la Certificación.

### 5. Consolidación Legal (Certificación)
- **Transformación:** Los Hechos de Texto se filtran a través de reglas condicionales estandarizadas institucionales.
- **Flujo:** Se descartan nulos (`'SinNombre'`), se calculan veredictos lógicos.
- **Punto de Salida:** Se inyecta el JSON sanitizado directamente contra un binario Word (Docxtemplater) o CSV/Excel (XLSX).

### 6. Archivo (Emisión Final al Dashboard)
- **Flujo:** El Word sellado se almacena. La API actualiza el tablero de control, el estado vuelve a `COMPLETADA` y los datos finales están listos para despacho (por correo o UI).
