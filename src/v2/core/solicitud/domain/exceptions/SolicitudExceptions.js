class SolicitudDomainException extends Error {
    constructor(mensaje) {
        super(mensaje);
        this.name = this.constructor.name;
    }
}

class EstadoInvalidoException extends SolicitudDomainException {
    constructor(estado) {
        super(`El estado proporcionado es inválido o no reconocido: ${estado}`);
    }
}

class TransicionIlegalException extends SolicitudDomainException {
    constructor(estadoOrigen, estadoDestino) {
        super(`Transición ilegal: No se permite cambiar de [${estadoOrigen}] a [${estadoDestino}].`);
    }
}

class EntidadInmutableException extends SolicitudDomainException {
    constructor(motivo) {
        super(`Violación de Invariante: La entidad no puede modificarse. Motivo: ${motivo}`);
    }
}

class ParametroFaltanteException extends SolicitudDomainException {
    constructor(parametro) {
        super(`El parámetro obligatorio '${parametro}' no fue proporcionado.`);
    }
}

module.exports = {
    SolicitudDomainException,
    EstadoInvalidoException,
    TransicionIlegalException,
    EntidadInmutableException,
    ParametroFaltanteException
};
