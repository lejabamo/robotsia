const TransicionEstadosPolicy = require('../../../../core/solicitud/domain/services/TransicionEstadosPolicy');

describe('TransicionEstadosPolicy', () => {
    it('debe exponer el método estático evaluar', () => {
        expect(typeof TransicionEstadosPolicy.evaluar).toBe('function');
    });
});
