const CrearSolicitudUseCase = require('../../../../core/solicitud/application/CrearSolicitudUseCase');

describe('CrearSolicitudUseCase', () => {
    it('debe exponer el método ejecutar', () => {
        const useCase = new CrearSolicitudUseCase();
        expect(typeof useCase.ejecutar).toBe('function');
    });
});
