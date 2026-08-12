const EstadoVigenciaDocumento = require('./valueObjects/EstadoVigenciaDocumento');
const HashFisico = require('./valueObjects/HashFisico');
const StorageLocator = require('./valueObjects/StorageLocator');
const TipoDocumental = require('./valueObjects/TipoDocumental');
const OrigenDocumento = require('./valueObjects/OrigenDocumento');

class Documento {
    constructor({ hashFisico, storageLocator, tipoDocumental, origen, fechaIntegracion = new Date() }) {
        this.hashFisico = new HashFisico(hashFisico);
        this.storageLocator = new StorageLocator(storageLocator);
        this.tipoDocumental = new TipoDocumental(tipoDocumental);
        this.origen = origen instanceof OrigenDocumento ? origen : new OrigenDocumento(origen);
        this.fechaIntegracion = fechaIntegracion;
        
        this.estadoVigencia = EstadoVigenciaDocumento.VIGENTE;
    }

    marcarComoObsoleto() {
        this.estadoVigencia = EstadoVigenciaDocumento.OBSOLETO;
    }

    esVigente() {
        return this.estadoVigencia === EstadoVigenciaDocumento.VIGENTE;
    }
}
module.exports = Documento;
