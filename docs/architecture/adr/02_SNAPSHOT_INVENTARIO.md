# ADR: Snapshot Inmutable del Inventario Documental por Expediente

## Contexto
Las normativas y requerimientos documentales del SIA cambian con el tiempo. Si el Inventario Documental se asocia al Expediente mediante una relación por referencia (ForeignKey a una tabla maestra), cualquier cambio futuro en las reglas alteraría retrospectivamente el estado de completitud de los expedientes antiguos (lo que antes estaba completo, podría amanecer "Incompleto" retroactivamente).

## Decisión
Se implementa el patrón de *Snapshot Inmutable*. 
Al inicializarse un `ExpedienteSIA`, se inyecta un `InventarioSnapshot` (Value Object profundo) que encapsula todas las reglas obligatorias y opcionales vigentes en el momento exacto T0.
Ese Snapshot queda "congelado" dentro del Aggregate y no puede mutar.

## Consecuencias
- **Positivas:** 100% de reproducibilidad histórica y determinismo en el cálculo de completitud. Inmunidad ante cambios regulatorios retrospectivos.
- **Negativas:** Desnormalización de datos (el JSON/estructura del inventario se guarda repetitivamente en cada Expediente instanciado, ocupando más espacio de almacenamiento).
