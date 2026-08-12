const ExpedienteSIA = require('../domain/ExpedienteSIA');

class InicializarExpedienteUseCase {
    constructor(expedienteRepository) {
        this.expedienteRepository = expedienteRepository;
    }

    async ejecutar(expedienteId, inventarioConfig) {
        let expediente = await this.expedienteRepository.buscarPorId(expedienteId);
        if (!expediente) {
            expediente = new ExpedienteSIA(expedienteId);
        }
        
        expediente.inicializar(
            inventarioConfig.versionId,
            inventarioConfig.obligatorios,
            inventarioConfig.opcionales
        );

        await this.expedienteRepository.guardar(expediente);
        return expediente;
    }
}
module.exports = InicializarExpedienteUseCase;
