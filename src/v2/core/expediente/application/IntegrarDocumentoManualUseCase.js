const OrigenDocumento = require('../domain/valueObjects/OrigenDocumento');

class IntegrarDocumentoManualUseCase {
    constructor(expedienteRepository) {
        this.expedienteRepository = expedienteRepository;
    }

    async ejecutar(expedienteId, payload) {
        const expediente = await this.expedienteRepository.buscarPorId(expedienteId);
        if (!expediente) throw new Error('Expediente no encontrado');

        expediente.integrarDocumento(
            payload.hashFisico,
            payload.storageLocator,
            payload.tipoDocumental,
            OrigenDocumento.HUMANO.valor
        );

        await this.expedienteRepository.guardar(expediente);
        return expediente;
    }
}
module.exports = IntegrarDocumentoManualUseCase;
