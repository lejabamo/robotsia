class EstadoVigenciaDocumento {
    static VIGENTE = new EstadoVigenciaDocumento('VIGENTE');
    static OBSOLETO = new EstadoVigenciaDocumento('OBSOLETO');

    constructor(valor) {
        this.valor = valor;
        Object.freeze(this);
    }
    
    static fromString(val) {
        if (val === 'VIGENTE') return EstadoVigenciaDocumento.VIGENTE;
        if (val === 'OBSOLETO') return EstadoVigenciaDocumento.OBSOLETO;
        throw new Error(`Estado de vigencia no soportado: ${val}`);
    }
}
module.exports = EstadoVigenciaDocumento;
