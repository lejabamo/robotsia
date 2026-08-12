class ExpedienteException extends Error {
    constructor(mensaje) {
        super(mensaje);
        this.name = this.constructor.name;
    }
}

class HashDuplicadoException extends ExpedienteException {}
class ExpedienteCerradoException extends ExpedienteException {}
class InventarioInvalidoException extends ExpedienteException {}
class DocumentoInvalidoException extends ExpedienteException {}

module.exports = {
    ExpedienteException,
    HashDuplicadoException,
    ExpedienteCerradoException,
    InventarioInvalidoException,
    DocumentoInvalidoException
};
