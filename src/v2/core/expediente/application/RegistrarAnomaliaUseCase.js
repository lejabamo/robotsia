class RegistrarAnomaliaUseCase {
    constructor(expedienteRepository) {
        this.expedienteRepository = expedienteRepository;
    }

    async ejecutar(expedienteId, tipoDocumentalAfectado, descripcion) {
        const expediente = await this.expedienteRepository.buscarPorId(expedienteId);
        if (!expediente) throw new Error('Expediente no encontrado');

        expediente.registrarAnomalia(tipoDocumentalAfectado, descripcion);

        await this.expedienteRepository.guardar(expediente);
        return expediente;
    }
}
module.exports = RegistrarAnomaliaUseCase;
