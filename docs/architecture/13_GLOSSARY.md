# 13 - Glosario (Ubiquitous Language)

Términos oficiales e indiscutibles para toda la arquitectura V2 de SIA.

- **Solicitud:** Agregado raíz que controla la gobernabilidad, timestamps y avance lógico del trámite de certificación desde una entrada ciudadana/administrativa.
- **Expediente SIA:** Agregado y colección virtual que mantiene agrupada y ordenada toda la evidencia (Documentos, capturas, OCR) extraída remotamente relacionada a un único contrato.
- **Documento:** Pieza atómica física o normalizada de información probatoria. Vive bajo la responsabilidad del Expediente.
- **Evidencia:** Abstracción documental superior; un Documento, volcado HTML o screenshot visual capturado del portal gubernamental.
- **Certificación:** (Dominio) Agregado lógico responsable exclusivamente de tomar el veredicto final cruzando el Expediente frente a reglas normativas institucionales.
- **Certificado (o Certificado Emitido):** Artefacto estático, físico, legal e inmutable que comprueba la resolución tomada tras realizar una certificación.
- **Inventario Documental:** Estructura que detalla cuantitativa y posicionalmente si un documento en particular pudo ser recolectado correctamente en un esfuerzo de scraping.
- **Estado (Value Object):** Ente transicional que previene que la Solicitud adopte fases imposibles en el tiempo.
- **Caso de Uso:** Motor lógico sin estado (Application Service) que enlaza la infraestructura exterior invocando las Entidades Core correspondientes para aplicar cambios persitentes.
- **Dominio Core:** Entorno lógico inmune y aislado de cualquier framework externo, librería ajena o sistema de bases de datos.
- **Adaptador:** Puente técnico. (Ej. Script Playwright que implementa la interfaz requerida por el Core para extraer expedientes).
