# ADR: Patrón Data Mapper e Hidratación de Aggregados

## Contexto
El Aggregate `ExpedienteSIA` ha sido diseñado con pureza de dominio utilizando clases complejas anidadas (Entidades, Value Objects congelados, campos privados `#`). Sin embargo, al persistir la información en un repositorio (Base de Datos Relacional, NoSQL, o caché como Redis vía BullMQ), el estado se serializa típicamente a texto plano o JSON simple.
Una deserialización ingenua (e.g. `JSON.parse`) destruiría la cadena de prototipos, perdiendo el acceso a métodos vitales como `esVigente()`, `equals()` o las reglas de inmutabilidad nativa (`Object.freeze`).

## Decisión
Se delega 100% a la capa de **Infraestructura** la responsabilidad de hidratar y reconstruir el objeto (Separación de Preocupaciones). 
El Repositorio físico que implemente la interfaz `IExpedienteRepository` utilizará el patrón **Data Mapper**. Al invocar `buscarPorId`, la infraestructura mapeará los diccionarios simples instanciando explícitamente `new ExpedienteSIA(...)`, restaurando cada colección invocando `new Documento(...)`, y reconstruyendo sus correspondientes Value Objects internos de forma transparente para el dominio.

## Clasificación
**Infraestructura / Futuro**
No afecta el código del Core. Queda registrado como responsabilidad obligatoria y diseño futuro para el Adaptador del Repositorio cuando se proceda a implementar persistencia.
