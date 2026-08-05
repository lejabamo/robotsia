const Solicitud = require('../domain/Solicitud');
const SolicitudEstado = require('../domain/SolicitudEstado');

class CrearSolicitudUseCase {
    /**
     * Orquesta la creación de una nueva Solicitud aislando a la entidad de la infraestructura (como el reloj del sistema).
     */
    ejecutar({ id, codigoContrato, origenPeticion, fechaActual }) {
        // Obtenemos la fecha actual desde el exterior (Inversión de Control)
        // Si no se provee, el caso de uso la asume, protegiendo a la entidad.
        const fecha = fechaActual || new Date();

        const nuevaSolicitud = new Solicitud({
            id: id,
            codigoContrato: codigoContrato,
            origenPeticion: origenPeticion,
            estado: SolicitudEstado.RECIBIDA,
            fechaCreacion: fecha,
            fechaActualizacion: fecha
        });
        
        return nuevaSolicitud;
    }
}

module.exports = CrearSolicitudUseCase;
