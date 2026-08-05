# 15 - Plan de Ruta Futuro (Future Roadmap)

Hoja de ruta estratégica enfocada en la cristalización de la Arquitectura Hexagonal y la liberación final de la automatización en un entorno productivo resiliente.

## Fase 1: Consolidación de Cimientos V2 (Actual)
*   [x] Inventario arquitectónico exhaustivo.
*   [x] Estabilización e inmovilización temporal (Congelamiento V1).
*   [x] Habilitación y Certificación oficial documental para desarrollo V2.
*   [x] Diseño e implementación del Core Aggregate `Solicitud`.

## Fase 2: Estrangulamiento del Núcleo V1 (Core Migration)
*   [ ] Escribir y validar Pruebas Unitarias del Dominio `Solicitud` bajo TDD.
*   [ ] Implementar el Dominio `Expediente SIA` y migrar el motor asíncrono de Playwright a un *Adaptador Secundario*.
*   [ ] Implementar el Dominio `Certificación` y extraer las reglas de negocio atascadas en `generate.js` al entorno agnóstico, aislando a Docxtemplater como un *Adaptador Secundario*.

## Fase 3: Modernización de Capas de Borde (Edge Infrastructure)
*   [ ] Rediseño de los *Driven Adapters* de escucha (Colas). Migrar la lógica de BullMQ V1 para invocar exclusivamente *Casos de Uso V2*.
*   [ ] Rediseño absoluto del lector IMAP inestable, incorporando políticas TLS estrictas, seguridad y trazabilidad completa del origen (`origenPeticion`).

## Fase 4: Limpieza, Monitoreo y Release 1.0 (Go-Live Readiness)
*   [ ] Ejecutar purga de código legacy (`patch*.js` y código estático antiguo en `/src/api`, `/src/playwright`, etc).
*   [ ] Despliegue de tablero en caliente (Dashboard V2) para consumo visual por operarios humanos de las entidades V2 puras asimiladas desde Redis.
*   [ ] Release 1.0 Candidate.
