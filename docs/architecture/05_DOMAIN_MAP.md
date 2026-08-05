# 05 - Mapa de Dominios (Domain Map)

La Arquitectura V2 utiliza Diseño Orientado al Dominio (DDD). A continuación se explican las delimitaciones teóricas (Bounded Contexts) implementadas.

## 1. Solicitud (Core Domain)
Es la entidad central (Aggregate Root) transaccional.
- **Misión:** Gobernar el ciclo de vida de la transacción. Asegurar transiciones de estado legales y rastrear tiempos de actualización.
- **Exclusiones:** No conoce el filesystem. No procesa archivos. No aplica reglas de aprobación legal.

## 2. Expediente SIA (Supporting Domain)
Agregado encargado de albergar la verdad material.
- **Misión:** Agrupar y representar el conjunto de pruebas y evidencias (Documentos físicos, extracciones de texto, metadata web) recuperadas del mundo exterior.
- **Exclusiones:** No sabe en qué etapa va el flujo de trabajo (Solicitud). No toma decisiones ofimáticas sobre plantillas.

## 3. Certificación (Core Domain)
Motor de reglas de negocio institucional.
- **Misión:** Evaluar el conocimiento del `Expediente SIA` y aplicar invariantes de negocio (ej. validación de naturaleza jurídica vs natural) para dictaminar el cumplimiento.
- **Exclusiones:** No descarga archivos. No extrae texto por OCR. Solo consume diccionarios normalizados.

---

### Conceptos Complementarios de DDD en V2

- **Documento:** Entidad hija (o Value Object si es inmutable) de `Expediente`. Representa un archivo específico o su texto plano extraído.
- **Certificado:** El artefacto tangible emitido. Hija de `Certificación`.
- **Casos de Uso (Capa de Aplicación):** Orquestadores sin lógica pura de negocio. Llaman a Repositorios para cargar Agregados, disparan un comando en el Agregado y guardan de vuelta.
- **Eventos:** Mecanismos de bajo acoplamiento para comunicar a los dominios (ej. `ExpedienteConsolidado`).
- **Puertos:** Interfaces requeridas por el Core (ej. `IExpedienteRepository`, `IDocumentExtractor`).
- **Adaptadores:** Clases externas que implementan los Puertos usando librerías físicas (Playwright, BullMQ).
