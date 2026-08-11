const Solicitud = require('../../../../core/solicitud/domain/Solicitud');
const SolicitudEstado = require('../../../../core/solicitud/domain/SolicitudEstado');
const {
    ParametroFaltanteException,
    EstadoInvalidoException,
    TransicionIlegalException,
    EntidadInmutableException
} = require('../../../../core/solicitud/domain/exceptions/SolicitudExceptions');

describe('S01 - Instanciación Feliz', () => {
    it('debe crear correctamente una Solicitud, quedar en RECIBIDA y conservar sus datos', () => {
        const solicitud = new Solicitud({
            id: '123',
            codigoContrato: 'X',
            origenPeticion: 'API',
            estado: 'RECIBIDA'
        });

        expect(solicitud).toBeInstanceOf(Solicitud);
        expect(solicitud.id).toBe('123');
        expect(solicitud.codigoContrato).toBe('X');
        expect(solicitud.origenPeticion).toBe('API');
        expect(solicitud.estado.valor).toBe('RECIBIDA');
    });
});

describe('S02 - Rechazo de atributos obligatorios', () => {
    it('debe lanzar ParametroFaltanteException si no hay id', () => {
        expect(() => new Solicitud({ codigoContrato: 'X', origenPeticion: 'API' }))
            .toThrow(ParametroFaltanteException);
    });

    it('debe lanzar ParametroFaltanteException si no hay codigoContrato', () => {
        expect(() => new Solicitud({ id: '123', origenPeticion: 'API' }))
            .toThrow(ParametroFaltanteException);
    });

    it('debe lanzar ParametroFaltanteException si no hay origenPeticion', () => {
        expect(() => new Solicitud({ id: '123', codigoContrato: 'X' }))
            .toThrow(ParametroFaltanteException);
    });
});

describe('S03 - Estado ilegal', () => {
    it('debe lanzar EstadoInvalidoException al hidratar con estado INVENTADO', () => {
        expect(() => new Solicitud({
            id: '123',
            codigoContrato: 'X',
            origenPeticion: 'API',
            estado: 'INVENTADO'
        })).toThrow(EstadoInvalidoException);
    });
});

describe('S04 - Avance a Expediente', () => {
    it('debe permitir transición de RECIBIDA a EN_ESPERA_DE_EXPEDIENTE y actualizar fecha', () => {
        const solicitud = new Solicitud({ id: '1', codigoContrato: 'X', origenPeticion: 'A', estado: 'RECIBIDA' });
        const fechaInyectada = new Date('2026-01-01T10:00:00Z');
        
        solicitud.transicionarEstado('EN_ESPERA_DE_EXPEDIENTE', fechaInyectada);
        
        expect(solicitud.estado.valor).toBe('EN_ESPERA_DE_EXPEDIENTE');
        expect(solicitud.fechaActualizacion).toBe(fechaInyectada);
    });
});

describe('S05 - Avance a Certificación', () => {
    it('debe permitir transición de EN_ESPERA_DE_EXPEDIENTE a EN_ESPERA_DE_VEREDICTO', () => {
        const solicitud = new Solicitud({ id: '1', codigoContrato: 'X', origenPeticion: 'A', estado: 'EN_ESPERA_DE_EXPEDIENTE' });
        const fecha = new Date();
        
        solicitud.transicionarEstado('EN_ESPERA_DE_VEREDICTO', fecha);
        
        expect(solicitud.estado.valor).toBe('EN_ESPERA_DE_VEREDICTO');
    });
});

describe('S06 - Salto ilegal', () => {
    it('debe lanzar TransicionIlegalException al intentar saltar de RECIBIDA a COMPLETADA', () => {
        const solicitud = new Solicitud({ id: '1', codigoContrato: 'X', origenPeticion: 'A', estado: 'RECIBIDA' });
        
        expect(() => solicitud.transicionarEstado('COMPLETADA', new Date()))
            .toThrow(TransicionIlegalException);
    });
});

describe('S07 - Retroceso ilegal', () => {
    it('debe lanzar TransicionIlegalException al retroceder de EN_ESPERA_DE_VEREDICTO a EN_ESPERA_DE_EXPEDIENTE', () => {
        const solicitud = new Solicitud({ id: '1', codigoContrato: 'X', origenPeticion: 'A', estado: 'EN_ESPERA_DE_VEREDICTO' });
        
        expect(() => solicitud.transicionarEstado('EN_ESPERA_DE_EXPEDIENTE', new Date()))
            .toThrow(TransicionIlegalException);
    });
});

describe('S08 - Estados terminales', () => {
    it('debe lanzar EntidadInmutableException al modificar desde COMPLETADA', () => {
        const solicitud = new Solicitud({ id: '1', codigoContrato: 'X', origenPeticion: 'A', estado: 'COMPLETADA' });
        
        expect(() => solicitud.transicionarEstado('RECIBIDA', new Date()))
            .toThrow(EntidadInmutableException);
            
        expect(solicitud.estado.valor).toBe('COMPLETADA');
    });

    it('debe lanzar EntidadInmutableException al modificar desde FALLIDA', () => {
        const solicitud = new Solicitud({ id: '1', codigoContrato: 'X', origenPeticion: 'A', estado: 'FALLIDA' });
        
        expect(() => solicitud.transicionarEstado('RECIBIDA', new Date()))
            .toThrow(EntidadInmutableException);
            
        expect(solicitud.estado.valor).toBe('FALLIDA');
    });
});

describe('S09 - Contrato inmutable', () => {
    it('debe lanzar EntidadInmutableException al intentar cambiar el contrato y verificar que no cambia', () => {
        const solicitud = new Solicitud({ id: '1', codigoContrato: 'CONT-001', origenPeticion: 'API', estado: 'RECIBIDA' });
        
        expect(() => {
            solicitud.codigoContrato = 'CONT-999';
        }).toThrow(EntidadInmutableException);
        
        expect(solicitud.codigoContrato).toBe('CONT-001');
    });
});

describe('S10 - Idempotencia', () => {
    it('no debe lanzar error, debe mantener RECIBIDA y no modificar fechaActualizacion si transiciona al mismo estado', () => {
        const fechaOriginal = new Date('2026-01-01T00:00:00Z');
        const solicitud = new Solicitud({ id: '1', codigoContrato: 'X', origenPeticion: 'A', estado: 'RECIBIDA', fechaActualizacion: fechaOriginal });
        
        solicitud.transicionarEstado('RECIBIDA', new Date('2026-12-31T00:00:00Z'));
        
        expect(solicitud.estado.valor).toBe('RECIBIDA');
        expect(solicitud.fechaActualizacion).toBe(fechaOriginal);
    });
});

describe('Pruebas Adicionales de Robustez', () => {
    it('R1 - Estado inválido durante una transición lanza excepción', () => {
        const solicitud = new Solicitud({ id: '1', codigoContrato: 'X', origenPeticion: 'A', estado: 'RECIBIDA' });
        expect(() => solicitud.transicionarEstado('FALSO', new Date())).toThrow(EstadoInvalidoException);
    });

    it('R2 - Transiciones válidas completas (flujo normal)', () => {
        const solicitud = new Solicitud({ id: '1', codigoContrato: 'X', origenPeticion: 'A', estado: 'RECIBIDA' });
        solicitud.transicionarEstado('EN_ESPERA_DE_EXPEDIENTE', new Date());
        expect(solicitud.estado.valor).toBe('EN_ESPERA_DE_EXPEDIENTE');
        solicitud.transicionarEstado('EN_ESPERA_DE_VEREDICTO', new Date());
        expect(solicitud.estado.valor).toBe('EN_ESPERA_DE_VEREDICTO');
        solicitud.transicionarEstado('COMPLETADA', new Date());
        expect(solicitud.estado.valor).toBe('COMPLETADA');
    });

    it('R3 - La fecha de transición debe ser exactamente la fecha inyectada', () => {
        const solicitud = new Solicitud({ id: '1', codigoContrato: 'X', origenPeticion: 'A', estado: 'RECIBIDA' });
        const manualDate = new Date('2026-08-11T12:00:00Z');
        solicitud.transicionarEstado('EN_ESPERA_DE_EXPEDIENTE', manualDate);
        expect(solicitud.fechaActualizacion).toBe(manualDate);
    });
});
