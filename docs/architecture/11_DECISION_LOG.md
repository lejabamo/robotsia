# 11 - Registro de Decisiones (Decision Log / ADRs)

### ADR-001: Nomenclatura Defensiva (Anti-Colisión SECOP)
- **Problema:** SECOP ocasionalmente pierde el nombre original del archivo sirviéndolo como `"download"`, sobreescribiendo indiscriminadamente archivos en el filesystem local.
- **Decisión:** Implementar prefijos y sufijos absolutos obligatorios (`[CódigoContrato]_Doc[i]_[NombreSugerido].pdf`) con un bucle anti-colisión físico local.
- **Justificación:** Salvar el archivo con el nombre real es imposible sin esta inyección.
- **Impacto:** Evita pérdida de evidencia en el Expediente. El código en `secop-download.js` contiene este parche permanentemente.

### ADR-002: Tolerancia a Fallos Suaves (Soft Batch Failures)
- **Problema:** Los documentos de ejecución de SECOP presentan links rotos o timeouts frecuentes de red (ej. 30s).
- **Decisión:** Un error puntual descargando 1 documento de un lote de 20 no debe lanzar una excepción fatal. Se atrapa, se marca el documento como fallido en el inventario, pero la iteración del expediente físico debe completarse a toda costa.
- **Justificación:** Rescatar un expediente parcialmente es infinitamente más valioso para la auditoría que cancelar un trámite entero por una falla exógena.
- **Impacto:** Modifica el concepto de fallo del sistema. La Solicitud no fracasa si falla la red, delega la crisis al Dominio Expediente.

### ADR-003: Idempotencia Silenciosa de Estado
- **Problema:** Un contenedor Node Worker de BullMQ puede colapsar justo después de terminar un trabajo pero antes de avisarle a Redis, causando que se intente procesar la misma Solicitud por segunda vez.
- **Decisión:** Si el caso de uso ordena avanzar a `COMPLETADA` a una Solicitud que ya está `COMPLETADA`, la entidad lo asimila como un No-Op y retorna éxito mudo.
- **Justificación:** Acelera la tolerancia a caídas distribuidas evitando colapsos del worker por Excepciones falsas positivas.
- **Impacto:** Requiere estricta programación defensiva en la entidad (implementado en `TransicionEstadosPolicy`).

### ADR-004: Fallbacks Seguros en Generación Ofimática
- **Problema:** Los PDFs gubernamentales de contratistas naturales frecuentemente ignoran el campo 'Empresa'. Esto colapsa el motor de plantillas de Word, dañando el certificado.
- **Decisión:** Inyectar por defecto cadenas centinela (ej. `'SinNombre'`, `'0'`) antes del binding de `docxtemplater`.
- **Justificación:** El objetivo final es automatizar la mayoría de los campos; un operario prefiere corregir un campo "SinNombre" en Word que hacer un certificado de cero.
- **Impacto:** Afecta directamente la lógica de negocio del futuro Dominio de Certificación.
