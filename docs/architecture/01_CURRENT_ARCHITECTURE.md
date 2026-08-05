# 01 - Arquitectura Actual (Current Architecture)

## ¿Qué es el proyecto?
El Sistema Integrado de Automatización (SIA) es un motor robótico (RPA) y de reglas de negocio diseñado para orquestar la evaluación, recolección de evidencia documental desde plataformas gubernamentales (SECOP II) y generación automática de certificados oficiales de cumplimiento para contratistas.

## Objetivo
Automatizar de extremo a extremo el flujo de certificación, eliminando la carga operativa manual mediante un Pipeline Documental que extrae texto, normaliza hechos y emite veredictos legales.

## Estado Actual
El proyecto se encuentra en plena transición arquitectónica (Migración V1 a V2). Se cuenta con un núcleo funcional certificado que opera bajo un modelo heredado (V1), coexistiendo físicamente con la nueva estructura limpia orientada al dominio (V2) recién inicializada en la rama `epic/sia-core-v2`.

## Inventario Arquitectónico
- **Qué funciona:** Descarga de expedientes desde SECOP, orquestación de tareas en colas, generación de documentos Word/Excel con plantillas, transiciones idempotentes básicas.
- **Qué está certificado:** El núcleo funcional V1 (`secop-download.js`, `generate.js`, `queue-manager.js`).
- **Qué está congelado:** El código fuente original de la V1 bajo el tag `v1-core-validated`.
- **Qué está experimental:** El módulo de integración IMAP (Recepción de correo electrónico) debido a bloqueos de consultas `UNSEEN` y configuraciones TLS.
- **Qué pertenece a V1:** Los directorios raíz legados (`src/api`, `src/playwright`, `src/queues`, `src/services`, `src/workers`, `src/certificate`).
- **Qué pertenece a V2:** La nueva capa de Dominio, Aplicación e Infraestructura bajo `src/v2/`. Actualmente cuenta con el Aggregate Root `Solicitud` 100% implementado bajo estándares DDD.

## Riesgos Actuales
- Dependencia transitoria en componentes V1 sin aislamiento estricto de I/O.
- El módulo de correos (puerta de entrada) carece de fiabilidad en redes corporativas complejas.
- Sobrecarga potencial en memoria si la evidencia (PDFs nativos y OCR) fluye a través de la cola de mensajería (mitigado por el nuevo diseño de Expediente SIA).

## Próximos Pasos
Implementar y certificar los siguientes dominios (`Expediente` y `Certificacion`) en la arquitectura V2, refactorizando gradualmente los módulos legados V1 hacia adaptadores hexagonales puros.
