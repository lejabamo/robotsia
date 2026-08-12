const Documento = require('./Documento');
const Evidencia = require('./Evidencia');
const Anomalia = require('./Anomalia');
const HashFisico = require('./valueObjects/HashFisico');
const InventarioSnapshot = require('./valueObjects/InventarioSnapshot');
const OrigenDocumento = require('./valueObjects/OrigenDocumento');
const {
    ExpedienteCerradoException,
    HashDuplicadoException
} = require('./exceptions/ExpedienteExceptions');
const {
    ExpedienteInicializado,
    DocumentoIntegrado,
    EvidenciaAdjuntada,
    AnomaliaRegistrada,
    ExpedienteCompletado,
    ExpedienteBloqueado,
    VersionDocumentalActualizada,
    DocumentoIntegradoManualmente
} = require('./events/ExpedienteEvents');

class ExpedienteSIA {
    #documentos = [];
    #evidencias = [];
    #anomalias = [];

    constructor(id) {
        if (!id) throw new Error('Expediente requiere un ID');
        this.id = id;
        this.inventarioSnapshot = null;
        this.bloqueado = false;
        this.domainEvents = [];
    }

    get documentos() { return [...this.#documentos]; }
    get evidencias() { return [...this.#evidencias]; }
    get anomalias() { return [...this.#anomalias]; }

    inicializar(versionId, obligatorios, opcionales) {
        if (this.inventarioSnapshot) {
            throw new Error('Expediente ya fue inicializado');
        }
        this.inventarioSnapshot = new InventarioSnapshot(versionId, obligatorios, opcionales);
        this.domainEvents.push(new ExpedienteInicializado(this.id, this.inventarioSnapshot));
    }

    esCompleto() {
        if (!this.inventarioSnapshot) return false;
        return this.obtenerFaltantes().length === 0;
    }

    integrarDocumento(hashFisicoStr, storageLocatorStr, tipoDocumentalStr, origenStr, fechaIntegracion = new Date()) {
        if (this.esCompleto()) throw new ExpedienteCerradoException('Expediente está completado, no admite más documentos');
        if (!this.inventarioSnapshot) throw new Error('Expediente no ha sido inicializado');

        const hash = new HashFisico(hashFisicoStr);
        
        // Idempotencia absoluta
        const existeMismoHash = this.#documentos.find(d => d.hashFisico.equals(hash));
        if (existeMismoHash) return; // NO-OP, Idempotencia (No dispara eventos superfluos)

        const nuevoDocumento = new Documento({
            hashFisico: hashFisicoStr,
            storageLocator: storageLocatorStr,
            tipoDocumental: tipoDocumentalStr,
            origen: origenStr,
            fechaIntegracion
        });

        // Versionado no destructivo (Colisión de Slot)
        const documentoPrevioVigente = this.#documentos.find(d => 
            d.esVigente() && d.tipoDocumental.equals(nuevoDocumento.tipoDocumental)
        );

        if (documentoPrevioVigente) {
            documentoPrevioVigente.marcarComoObsoleto();
            this.domainEvents.push(new VersionDocumentalActualizada(this.id, documentoPrevioVigente, nuevoDocumento));
        }

        this.#documentos.push(nuevoDocumento);
        
        if (nuevoDocumento.origen.valor === OrigenDocumento.HUMANO.valor) {
            this.domainEvents.push(new DocumentoIntegradoManualmente(this.id, nuevoDocumento));
        } else {
            this.domainEvents.push(new DocumentoIntegrado(this.id, nuevoDocumento));
        }

        // Evaluar completitud dinámicamente post-integración
        if (this.esCompleto()) {
            const yaEmitido = this.domainEvents.some(e => e instanceof ExpedienteCompletado);
            if (!yaEmitido) {
                this.domainEvents.push(new ExpedienteCompletado(this.id));
            }
        }
    }

    adjuntarEvidencia(storageLocatorStr, descripcion) {
        const evidencia = new Evidencia({ storageLocator: storageLocatorStr, descripcion });
        this.#evidencias.push(evidencia);
        this.domainEvents.push(new EvidenciaAdjuntada(this.id, evidencia));
    }

    registrarAnomalia(tipoDocumentalAfectadoStr, descripcion) {
        const anomalia = new Anomalia({ tipoDocumentalAfectado: tipoDocumentalAfectadoStr, descripcion });
        this.#anomalias.push(anomalia);
        this.domainEvents.push(new AnomaliaRegistrada(this.id, anomalia));

        if (anomalia.tipoDocumentalAfectado && this.inventarioSnapshot.esObligatorio(anomalia.tipoDocumentalAfectado.codigo)) {
            this.bloqueado = true;
            this.domainEvents.push(new ExpedienteBloqueado(this.id, anomalia));
        }
    }

    obtenerFaltantes() {
        if (!this.inventarioSnapshot) return [];
        const vigentes = this.#documentos.filter(d => d.esVigente()).map(d => d.tipoDocumental.codigo);
        return this.inventarioSnapshot.obligatorios.filter(obl => !vigentes.includes(obl));
    }

    clearDomainEvents() {
        this.domainEvents = [];
    }
}
module.exports = ExpedienteSIA;
