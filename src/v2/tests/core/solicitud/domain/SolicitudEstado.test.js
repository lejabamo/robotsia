const SolicitudEstado = require('../../../../core/solicitud/domain/SolicitudEstado');

describe('SolicitudEstado', () => {
    it('debe contener estados estáticos inmutables', () => {
        expect(SolicitudEstado.RECIBIDA.valor).toBe('RECIBIDA');
        expect(SolicitudEstado.COMPLETADA.valor).toBe('COMPLETADA');
    });
});
