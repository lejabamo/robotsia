const InicializarExpedienteUseCase = require('../../../../core/expediente/application/InicializarExpedienteUseCase');
const IntegrarDocumentoUseCase = require('../../../../core/expediente/application/IntegrarDocumentoUseCase');
const IntegrarDocumentoManualUseCase = require('../../../../core/expediente/application/IntegrarDocumentoManualUseCase');
const RegistrarAnomaliaUseCase = require('../../../../core/expediente/application/RegistrarAnomaliaUseCase');
const IntegrarEvidenciaUseCase = require('../../../../core/expediente/application/IntegrarEvidenciaUseCase');
const ObtenerEstadoCompletitudUseCase = require('../../../../core/expediente/application/ObtenerEstadoCompletitudUseCase');
const ExpedienteSIA = require('../../../../core/expediente/domain/ExpedienteSIA');

// Mock simple de repositorio en memoria para no usar infra
class MockRepository {
    constructor() {
        this.store = new Map();
    }
    async buscarPorId(id) {
        return this.store.get(id) || null;
    }
    async guardar(exp) {
        this.store.set(exp.id, exp);
    }
}

describe('I. Casos de Uso (Application Services)', () => {
    let repo;

    beforeEach(() => {
        repo = new MockRepository();
    });

    test('T-UC-01, T-UC-02, T-UC-05, T-UC-06', async () => {
        const initUC = new InicializarExpedienteUseCase(repo);
        const intDocUC = new IntegrarDocumentoUseCase(repo);
        const getCompUC = new ObtenerEstadoCompletitudUseCase(repo);
        const intDocManUC = new IntegrarDocumentoManualUseCase(repo);

        await initUC.ejecutar('EXP-1', { versionId: 'V1', obligatorios: ['ACTA'], opcionales: [] });
        
        let exp = await repo.buscarPorId('EXP-1');
        expect(exp.inventarioSnapshot).not.toBeNull();

        await intDocUC.ejecutar('EXP-1', { hashFisico: 'H1', storageLocator: 's1', tipoDocumental: 'OPC' });
        
        let est = await getCompUC.ejecutar('EXP-1');
        expect(est.completado).toBe(false);

        await intDocManUC.ejecutar('EXP-1', { hashFisico: 'H2', storageLocator: 's2', tipoDocumental: 'ACTA' });
        est = await getCompUC.ejecutar('EXP-1');
        expect(est.completado).toBe(true);

        exp = await repo.buscarPorId('EXP-1');
        expect(exp.documentos.find(d => d.hashFisico.valor === 'H2').origen.valor).toBe('HUMANO');
    });

    test('T-UC-03, T-UC-04', async () => {
        const initUC = new InicializarExpedienteUseCase(repo);
        const anomUC = new RegistrarAnomaliaUseCase(repo);
        const evidUC = new IntegrarEvidenciaUseCase(repo);

        await initUC.ejecutar('EXP-2', { versionId: 'V1', obligatorios: ['ACTA'], opcionales: [] });
        
        await anomUC.ejecutar('EXP-2', 'ACTA', 'Fallo de red');
        await evidUC.ejecutar('EXP-2', 's3://evid', 'Captura fallo');

        const exp = await repo.buscarPorId('EXP-2');
        expect(exp.anomalias.length).toBe(1);
        expect(exp.evidencias.length).toBe(1);
    });
});
