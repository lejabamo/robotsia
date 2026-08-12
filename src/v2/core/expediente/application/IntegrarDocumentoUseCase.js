const OrigenDocumento = require('../domain/valueObjects/OrigenDocumento');

class IntegrarDocumentoUseCase {
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
            OrigenDocumento.MAQUINA.valor
        );

        await this.expedienteRepository.guardar(expediente);
        return expediente;
    }
}
module.exports = IntegrarDocumentoUseCase;
