const SolicitudEstado = require('./SolicitudEstado');
const TransicionEstadosPolicy = require('./services/TransicionEstadosPolicy');
const { 
    EstadoInvalidoException, 
    EntidadInmutableException, 
    ParametroFaltanteException 
} = require('./exceptions/SolicitudExceptions');

class Solicitud {
    #codigoContrato;

    constructor({ id, codigoContrato, origenPeticion, estado, fechaCreacion, fechaActualizacion }) {
        if (!id) throw new ParametroFaltanteException("id");
        if (!codigoContrato) throw new ParametroFaltanteException("codigoContrato");
        if (!origenPeticion) throw new ParametroFaltanteException("origenPeticion");
        
        // Desacoplamos del reloj del sistema obligando a inyectar las fechas, o asumiendo el momento de creación
        this.fechaCreacion = fechaCreacion;
        this.fechaActualizacion = fechaActualizacion;

        // Invariante 2: No estados inválidos
        const estadoInstancia = estado instanceof SolicitudEstado ? estado : SolicitudEstado.fromString(estado);
        if (!estadoInstancia) {
            throw new EstadoInvalidoException(estado);
        }

        this.id = id;
        this.#codigoContrato = codigoContrato;
        this.origenPeticion = origenPeticion;
        this.estado = estadoInstancia;
    }

    // Invariante 1: Setter lanza excepción semántica
    get codigoContrato() {
        return this.#codigoContrato;
    }

    set codigoContrato(value) {
        throw new EntidadInmutableException("El codigoContrato de la Solicitud no puede modificarse una vez creada.");
    }

    /**
     * Aplica un cambio de estado si las políticas del dominio lo permiten.
     * @param {string|SolicitudEstado} nuevoEstado 
     * @param {Date} fechaTransicion - Inyectado para desacoplar del reloj del sistema.
     */
    transicionarEstado(nuevoEstado, fechaTransicion) {
        if (!fechaTransicion) {
            throw new ParametroFaltanteException("fechaTransicion");
        }

        const estadoDestinoInstancia = nuevoEstado instanceof SolicitudEstado ? nuevoEstado : SolicitudEstado.fromString(nuevoEstado);
        if (!estadoDestinoInstancia) {
            throw new EstadoInvalidoException(nuevoEstado);
        }

        // Delegamos las reglas de Invariante 3, 4, 5 y 6 al policy
        const requiereAplicar = TransicionEstadosPolicy.evaluar(this.estado, estadoDestinoInstancia);

        if (requiereAplicar) {
            this.estado = estadoDestinoInstancia;
            this.fechaActualizacion = fechaTransicion;
        }
    }
}

module.exports = Solicitud;
