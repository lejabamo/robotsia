class IntegrarEvidenciaUseCase {
    constructor(expedienteRepository) {
        this.expedienteRepository = expedienteRepository;
    }

    async ejecutar(expedienteId, storageLocator, descripcion) {
        const expediente = await this.expedienteRepository.buscarPorId(expedienteId);
        if (!expediente) throw new Error('Expediente no encontrado');

        expediente.adjuntarEvidencia(storageLocator, descripcion);

        await this.expedienteRepository.guardar(expediente);
        return expediente;
    }
}
module.exports = IntegrarEvidenciaUseCase;
