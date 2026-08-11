const TransicionarEstadoUseCase = require('../../../../core/solicitud/application/TransicionarEstadoUseCase');

describe('TransicionarEstadoUseCase', () => {
    it('debe exponer el método ejecutar', () => {
        const useCase = new TransicionarEstadoUseCase();
        expect(typeof useCase.ejecutar).toBe('function');
    });
});
