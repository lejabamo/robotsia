# ADR: Resolución de Colisiones Documentales mediante Versionado Histórico y Vigencia

## Contexto
Durante el proceso de recuperación de documentos desde SECOP, es posible que el mismo documento lógico (por ejemplo, "Acta de Inicio") se publique múltiples veces con diferentes versiones físicas (borradores, correcciones, firmas). 
Esto genera una colisión conceptual si el Inventario Documental dicta que solo existe un slot para dicho tipo documental.

## Decisión
Se establece una separación estricta entre la **Identidad Física** (`HashFisico`) y la **Identidad de Negocio** (`TipoDocumental` / Slot).
Cuando un documento ingresa al dominio con un `HashFisico` nuevo pero apuntando a un `TipoDocumental` obligatorio que ya estaba satisfecho, se aplica la estrategia de Versionado No Destructivo:
- El documento antiguo NO se elimina, pasando al estado `OBSOLETO / HISTORICO`.
- El nuevo documento ingresa en estado `VIGENTE`.
- Se emite el evento de dominio `VersionDocumentalActualizada` para permitir la auditoría de este cambio.

## Consecuencias
- **Positivas:** La evidencia histórica nunca desaparece silenciosamente. Trazabilidad absoluta de los cambios en SECOP. Mantenemos compatibilidad con un modelo inmutable.
- **Negativas:** La agregación `Expediente` crecerá en tamaño si existen muchas versiones de un mismo documento. Los consumidores de la vista (Dashboard) deberán filtrar por `estadoVigencia === 'VIGENTE'` explícitamente.
