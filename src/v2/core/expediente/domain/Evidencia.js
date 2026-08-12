const StorageLocator = require('./valueObjects/StorageLocator');

class Evidencia {
    constructor({ storageLocator, descripcion, fechaGeneracion = new Date() }) {
        this.storageLocator = new StorageLocator(storageLocator);
        this.descripcion = descripcion;
        this.fechaGeneracion = fechaGeneracion;
    }
}
module.exports = Evidencia;
