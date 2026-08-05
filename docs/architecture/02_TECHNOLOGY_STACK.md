# 02 - Stack Tecnológico (Technology Stack)

Inventario exhaustivo de las tecnologías y herramientas integradas en la solución.

| Nombre | Versión | Dónde se usa | Para qué sirve | Criticidad | Alternativas |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Node.js** | 18.x+ | Global (Runtime) | Motor de ejecución base del sistema backend y orquestación. | CRÍTICA | Deno, Bun |
| **Express** | ^4.x | `src/api/` | Exponer la API REST y servir el Dashboard. | MEDIA | Fastify, NestJS |
| **BullMQ** | ^4.x | `src/queues/` | Gestor robusto de colas, reintentos e idempotencia. | ALTA | RabbitMQ, Kafka |
| **Redis** | ^7.x | Docker (DB) | Persistencia en memoria para los estados y locks de BullMQ. | CRÍTICA | Memcached |
| **Playwright** | ^1.x | `src/playwright/` | Motor de automatización y scraping web sin cabeza (Headless). | CRÍTICA | Puppeteer, Selenium |
| **Playwright Extra** | - | `secop-download.js` | Envoltura extensible para inyectar plugins en Playwright. | ALTA | N/A |
| **Stealth Plugin** | - | `secop-download.js` | Evasión de bloqueos antibot y WAF en la plataforma gubernamental. | ALTA | N/A |
| **Docxtemplater** | ^3.x | `src/certificate/` | Motor de inyección de variables en plantillas `.docx`. | ALTA | PDF-Lib (Si fuera directo a PDF) |
| **Pizzip** | ^3.x | `src/certificate/` | Gestión de compresión ZIP requerida nativamente por Docxtemplater. | MEDIA | Adm-zip |
| **XLSX** | ^0.x | `src/certificate/` | Generación y lectura de asientos/registros en hojas de cálculo (Auditoría). | ALTA | ExcelJS |
| **IMAP / Mailparser** | - | `src/services/` | Escucha de bandejas de entrada para ingestión de nuevas solicitudes. | ALTA | Webhooks nativos, Graph API (O365) |
| **Docker** | ^24.x | Entorno de despliegue | Contenerización del proyecto, aislando las dependencias del SO anfitrión. | CRÍTICA | Podman |
| **Node FS** | Nativo | `src/playwright/` | Lectura/Escritura de los Expedientes descargados y certificados. | CRÍTICA | S3 API (MinIO) |
