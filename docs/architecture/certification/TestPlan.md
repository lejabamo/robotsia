# Plantilla: Test Plan

**Propósito:** Definir el alcance, riesgos y estructura de ejecución antes de la redacción de código TDD. Obliga al arquitecto a validar mentalmente el flujo completo de certificación antes de su implementación física.

## 1. Objetivo
Certificar el Aggregate Root Solicitud mediante la ejecución y superación del 100% de sus invariantes y pruebas unitarias, demostrando aislamiento y funcionalidad pura.

## 2. Alcance
Dominio Solicitud y sus Casos de Uso (`CrearSolicitudUseCase`, `TransicionarEstadoUseCase`). Excluye explícitamente todo componente externo (BullMQ, Redis, Playwright, BD, Filesystem, Docker, Red).

## 3. Casos a ejecutar
S01 a S10 y Pruebas de Robustez (R1-R3). Comprenden: Creación, Rechazo de Nulos, Máquina de Estados Legal/Ilegal, Idempotencia, Terminales e Inmutabilidad.

## 4. Orden de ejecución
1. Entidad y Valor (Solicitud y SolicitudEstado)
2. Políticas (TransicionEstadosPolicy)
3. Casos de Uso (Application Services)

## 5. Dependencias
Node.js (v18+) y framework Jest. Operación In-Memory, sin dependencias externas de I/O.

## 6. Riesgos
Ninguno estructural. El diseño ya desacopló el dominio del reloj del sistema mediante inyección explícita de fechas de transición.

## 7. Resultado esperado
20 tests implementados. 20 PASS. 0 FAIL. Aprobación absoluta de la Matriz y Reporte de Certificación.
