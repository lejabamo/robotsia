class ExpedienteEvent {
    constructor(expedienteId, fechaOccurrencia = new Date()) {
        this.expedienteId = expedienteId;
        this.fechaOccurrencia = fechaOccurrencia;
        this.name = this.constructor.name;
    }
}

class ExpedienteInicializado extends ExpedienteEvent {
    constructor(expedienteId, inventarioSnapshot) {
        super(expedienteId);
        this.inventarioSnapshot = inventarioSnapshot;
    }
}
class DocumentoIntegrado extends ExpedienteEvent {
    constructor(expedienteId, documento) {
        super(expedienteId);
        this.documento = documento;
    }
}
class EvidenciaAdjuntada extends ExpedienteEvent {
    constructor(expedienteId, evidencia) {
        super(expedienteId);
        this.evidencia = evidencia;
    }
}
class AnomaliaRegistrada extends ExpedienteEvent {
    constructor(expedienteId, anomalia) {
        super(expedienteId);
        this.anomalia = anomalia;
    }
}
class ExpedienteCompletado extends ExpedienteEvent {}
class ExpedienteBloqueado extends ExpedienteEvent {
    constructor(expedienteId, anomalia) {
        super(expedienteId);
        this.anomalia = anomalia;
    }
}
class VersionDocumentalActualizada extends ExpedienteEvent {
    constructor(expedienteId, documentoAnterior, documentoNuevo) {
        super(expedienteId);
        this.documentoAnterior = documentoAnterior;
        this.documentoNuevo = documentoNuevo;
    }
}
class DocumentoIntegradoManualmente extends ExpedienteEvent {
    constructor(expedienteId, documento) {
        super(expedienteId);
        this.documento = documento;
    }
}

module.exports = {
    ExpedienteInicializado,
    DocumentoIntegrado,
    EvidenciaAdjuntada,
    AnomaliaRegistrada,
    ExpedienteCompletado,
    ExpedienteBloqueado,
    VersionDocumentalActualizada,
    DocumentoIntegradoManualmente
};
