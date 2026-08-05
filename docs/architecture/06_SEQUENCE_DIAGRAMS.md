# 06 - Diagramas de Secuencia (Sequence Diagrams)

*Nota: Los diagramas Mermaid se procesan automáticamente en visualizadores de Markdown.*

### Caso 1: Flujo Completo Ideal (V2 Vision)

```mermaid
sequenceDiagram
    participant IMAP as Correo / IMAP (Adaptador)
    participant Solicitud as Dominio: Solicitud
    participant BullMQ as Cola / Orquestador
    participant Playwright as Adaptador: Playwright
    participant Expediente as Dominio: Expediente
    participant Certificacion as Dominio: Certificación
    
    IMAP->>Solicitud: Comando: CrearSolicitud
    Solicitud->>BullMQ: Evento: SolicitudCreada (RECIBIDA)
    BullMQ->>Playwright: Comando: ExtraerEvidencia
    Playwright-->>Expediente: Construir Lote (PDFs)
    Expediente->>Expediente: Comando: ExtraerTexto (OCR/PDF-Parse)
    Expediente->>BullMQ: Evento: ExpedienteConsolidado
    BullMQ->>Solicitud: Comando: Transicionar (EN_ESPERA_DE_VEREDICTO)
    BullMQ->>Certificacion: Comando: EvaluarExpediente
    Certificacion->>Certificacion: Aplicar Reglas de Negocio
    Certificacion-->>Certificacion: Generar Word / Excel
    Certificacion->>BullMQ: Evento: CertificadoEmitido
    BullMQ->>Solicitud: Comando: Transicionar (COMPLETADA)
```

### Caso 2: Reintento por caída de red

```mermaid
sequenceDiagram
    participant BullMQ as Cola
    participant Playwright as Adaptador SECOP
    participant Solicitud as Dominio: Solicitud
    
    BullMQ->>Playwright: ExtraerEvidencia (Intento 1)
    Playwright--xBullMQ: Error: Timeout
    BullMQ->>BullMQ: Esperar Backoff Exponencial
    BullMQ->>Playwright: ExtraerEvidencia (Intento 2)
    Playwright-->>BullMQ: Éxito
    BullMQ->>Solicitud: Avanzar Estado
```

### Caso 3: Fallo de descarga individual (Soft Batch Failure)

```mermaid
sequenceDiagram
    participant Playwright as Motor SECOP
    participant FS as FileSystem
    
    Playwright->>Playwright: Iterar documentos (1..3)
    Playwright->>FS: Guardar Doc 1 (Éxito)
    Playwright--xFS: Error Descargando Doc 2 (URL rota)
    Playwright->>Playwright: Atrapar error (No abortar)
    Playwright->>FS: Guardar Doc 3 (Éxito)
    Playwright-->>Playwright: Devolver Inventario: [OK, FALLO, OK]
```

### Caso 4: Idempotencia

```mermaid
sequenceDiagram
    participant Cola as BullMQ
    participant Solicitud as Entidad: Solicitud
    
    Cola->>Solicitud: transicionarEstado('EN_ESPERA_DE_VEREDICTO')
    Note right of Solicitud: Estado actual: EN_ESPERA_DE_VEREDICTO
    Solicitud-->>Cola: No-Op (Silencioso, sin errores)
    Cola->>Cola: Marcar Job como completado
```

### Caso 5: Generación de Certificado (Defensiva)

```mermaid
sequenceDiagram
    participant Expediente as Expediente (Hechos)
    participant Cert as Dominio: Certificación
    participant Docx as Adaptador: Docxtemplater
    
    Expediente->>Cert: Enviar Hechos (nit=null, nombre=null)
    Cert->>Cert: Asignar Fallbacks ('SinNombre')
    Cert->>Docx: Inyectar Diccionario
    Docx-->>Cert: Buffer (Word finalizado)
```
