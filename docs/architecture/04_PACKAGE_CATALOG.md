# 04 - Catálogo de Paquetes (Package Catalog)

Mapa de distribución de directorios a alto nivel, marcando la separación estricta entre el código legado y la nueva visión arquitectónica.

## Árbol V2 (Clean Architecture)

| Paquete | Contenido | Tipo | Depende de | Estado |
| :--- | :--- | :--- | :--- | :--- |
| `src/v2/core/solicitud/` | Dominio y Application Services para gobernar el flujo de vida. | Core | Nada | Implementado |
| `src/v2/core/expediente/` | Entidades para normalización y tenencia de pruebas OCR. | Core | Nada | Planeado |
| `src/v2/core/certificacion/` | Reglas de negocio para tomar la decisión legal oficial. | Core | Expediente | Planeado |
| `src/v2/infrastructure/adapters/` | Implementación física de puertos (Playwright, Docx). | Infra | Core | Esqueleto |
| `src/v2/infrastructure/messaging/` | Instanciación de BullMQ acoplada a los Casos de Uso. | Infra | Core | Esqueleto |

## Árbol V1 (Legacy Monolítico) - *Próximo a desaparecer*

| Paquete | Contenido | Tipo | Depende de | Estado |
| :--- | :--- | :--- | :--- | :--- |
| `src/playwright/` | Lógica de recolección en portal gubernamental. | Legacy / Infra | FS | Congelado V1 |
| `src/certificate/` | Lógica combinada de reglas de negocio y motor de plantillas. | Legacy | FS | Congelado V1 |
| `src/queues/` | Inicialización y eventos crudos de la cola. | Legacy / Infra | Redis | Congelado V1 |
| `src/workers/` | Consumidores acoplados a la lógica de red. | Legacy | Infra | Experimental |
| `src/services/` | Lector directo por IMAP. | Legacy / Infra | Red Local | Experimental |
| `src/api/` | Endpoints de inyección manual Express. | Legacy / Infra | Servicios | Activo |
| `src/dashboard/` | Archivos de vista (UI/React o EJS). | Legacy / UI | API | Activo |
