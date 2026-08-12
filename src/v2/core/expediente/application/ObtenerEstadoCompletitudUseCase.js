class ObtenerEstadoCompletitudUseCase {
    constructor(expedienteRepository) {
        this.expedienteRepository = expedienteRepository;
    }

    async ejecutar(expedienteId) {
        const expediente = await this.expedienteRepository.buscarPorId(expedienteId);
        if (!expediente) throw new Error('Expediente no encontrado');

        const faltantes = expediente.obtenerFaltantes();
        return {
            completado: expediente.esCompleto(),
            bloqueado: expediente.bloqueado,
            faltantes: faltantes
        };
    }
}
module.exports = ObtenerEstadoCompletitudUseCase;
