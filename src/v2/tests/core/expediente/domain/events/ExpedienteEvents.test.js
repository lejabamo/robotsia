const { ExpedienteInicializado } = require('../../../../../core/expediente/domain/events/ExpedienteEvents');
const InventarioSnapshot = require('../../../../../core/expediente/domain/valueObjects/InventarioSnapshot');

describe('I. Eventos', () => {
    test('Eventos son inmutables y en pasado', () => {
        const ev = new ExpedienteInicializado('E-123', new InventarioSnapshot('V1', [], []));
        expect(ev.expedienteId).toBe('E-123');
        expect(ev.fechaOccurrencia).toBeInstanceOf(Date);
        expect(ev.name).toBe('ExpedienteInicializado');
    });
});
