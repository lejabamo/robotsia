const TipoDocumental = require('./valueObjects/TipoDocumental');

class Anomalia {
    constructor({ tipoDocumentalAfectado, descripcion, fechaRegistro = new Date() }) {
        this.tipoDocumentalAfectado = tipoDocumentalAfectado ? new TipoDocumental(tipoDocumentalAfectado) : null;
        this.descripcion = descripcion;
        this.fechaRegistro = fechaRegistro;
    }
}
module.exports = Anomalia;
