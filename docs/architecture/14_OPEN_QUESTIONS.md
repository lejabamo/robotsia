# 14 - Preguntas y Definiciones Pendientes (Open Questions)

Este documento registra ambigüedades funcionales y arquitectónicas críticas que requieren resolución directiva o funcional a medida que avanza la migración V2.

## Prioridad ALTA (Bloqueantes a corto plazo)

1.  **Dicotomía de Evidencia vs. Documento:** Si una extracción de Playwright falla pero genera un screenshot HTML, ¿esto cuenta formalmente como *Documento* en el inventario o solo como log de traza? Esta definición afecta drásticamente el modelo del agregado `Expediente`.
2.  **Manejo Crítico IMAP (Conexiones Corporativas):** El código heredado en V1 apaga la verificación de certificados (`tls: { rejectUnauthorized: false }`). En una arquitectura de producción estricta, ¿exigiremos validación de certificados internos o migraremos hacia OAuth2 / APIs de Graph en reemplazo del protocolo IMAP crudo?

## Prioridad MEDIA (Impactan la escalabilidad del sistema)

3.  **Tolerancia Ofimática:** Al generar el certificado, el sistema V1 asume valores mudos o "SinNombre" (ADR-004). Cuando un humano revise este archivo en Excel o Word, ¿qué indicador se utiliza para diferenciar un archivo *100% puro* vs uno *Generado de forma defensiva* para evitar reprocesos innecesarios?
4.  **Límite de Volumen OCR:** Los documentos que requieren OCR asíncrono para texto no nativo pueden saturar la CPU del contenedor. ¿Será la normalización semántica delegada a un adaptador síncrono local (Tesseract.js) o a un orquestador externo/cloud?

## Prioridad BAJA (Mejoras post-V2)

5.  **Notificación Inversa:** Tras crear con éxito el archivo XLSX/DOCX (Certificado emitido), ¿cómo y quién notificará asíncronamente al ciudadano original que mandó el correo? (Posiblemente un nuevo Dominio de Despacho).
