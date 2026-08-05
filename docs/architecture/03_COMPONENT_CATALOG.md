# 03 - Catálogo de Componentes (Component Catalog)

Inventario de componentes del sistema, priorizando las piezas orgánicas que conforman la solución transicional actual.

### 1. Motor de Descarga (SECOP)
- **Nombre:** `secop-download.js`
- **Responsabilidad:** Automatización web para navegar a los contratos, listar documentos y descargar el expediente físico evadiendo bloqueos.
- **Entradas:** Código de Contrato, Estado de Ejecución.
- **Salidas:** Archivos PDF locales persistidos (`[Contrato]_Doc[i]_[Nombre]`).
- **Dependencias:** Playwright, FS.
- **Estado:** V1 (Certificado Core) -> Futuro Adaptador V2.
- **Riesgo:** Alto (Sensible a latencias de red y cambios en el DOM gubernamental).

### 2. Generador Documental
- **Nombre:** `generate.js`
- **Responsabilidad:** Inyectar el diccionario de variables (nombres, fechas, dictamen) en plantillas estáticas ofimáticas. Aplica lógica defensiva (`SinNombre`).
- **Entradas:** Diccionario de hechos normalizado.
- **Salidas:** Archivo físico DOCX final y asiento XLSX.
- **Dependencias:** Docxtemplater, PizZip, XLSX.
- **Estado:** V1 (Certificado Core) -> Futuro Adaptador V2.
- **Riesgo:** Medio.

### 3. Orquestador de Cola (Máquina de Estados)
- **Nombre:** `queue-manager.js`
- **Responsabilidad:** Coordinar el flujo asíncrono y los reintentos. Garantiza que las tareas no se repitan si el estado es el mismo (idempotencia).
- **Entradas:** Payload del mensaje BullMQ.
- **Salidas:** Llamadas lógicas a otros componentes. Actualización de estado en Redis.
- **Dependencias:** BullMQ, Redis.
- **Estado:** V1 (Certificado Core) -> Futuro Adaptador de Infraestructura V2.
- **Riesgo:** Crítico (El fallo aquí atasca la solicitud entera).

### 4. Lector de Bandejas
- **Nombre:** `email-service.js` / `email-worker.js`
- **Responsabilidad:** Escuchar, descargar y parsear el asunto y cuerpo de peticiones por email.
- **Entradas:** Credenciales IMAP.
- **Salidas:** Payload plano con el Código del Contrato a evaluar.
- **Dependencias:** IMAP, Mailparser, TLS config.
- **Estado:** Experimental / Inestable.
- **Riesgo:** Alto.

### 5. Aggregate Root (Solicitud)
- **Nombre:** Dominio `Solicitud`
- **Responsabilidad:** Gobernabilidad estricta del ciclo de vida (Estados, Idempotencia, Inmutabilidad de la petición).
- **Entradas:** Comandos de dominio (Crear, Transicionar).
- **Salidas:** Entidad persistible en estado seguro.
- **Dependencias:** Ninguna (Dominio puro en Vanilla JS).
- **Estado:** V2 (Implementado, Pendiente Certificación).
- **Riesgo:** Bajo (Cero dependencias externas).
