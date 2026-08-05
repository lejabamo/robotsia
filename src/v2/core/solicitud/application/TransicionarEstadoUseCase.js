const Solicitud = require('../domain/Solicitud');

class TransicionarEstadoUseCase {
    /**
     * Orquesta el cambio de estado inyectando el tiempo para mantener la entidad pura.
     */
    ejecutar(solicitud, nuevoEstado, fechaTransicion) {
        if (!(solicitud instanceof Solicitud)) {
            throw new Error("El caso de uso requiere una instancia válida de la entidad Solicitud.");
        }

        const fecha = fechaTransicion || new Date();

        // El caso de uso delega la validación de la transición a la política interna de la entidad.
        solicitud.transicionarEstado(nuevoEstado, fecha);
        
        return solicitud;
    }
}

module.exports = TransicionarEstadoUseCase;
