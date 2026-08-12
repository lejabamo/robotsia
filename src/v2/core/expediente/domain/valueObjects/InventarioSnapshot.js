const { InventarioInvalidoException } = require('../exceptions/ExpedienteExceptions');

class InventarioSnapshot {
    constructor(versionId, obligatorios, opcionales) {
        if (!versionId) throw new InventarioInvalidoException('Falta versión de inventario');
        if (!Array.isArray(obligatorios) || !Array.isArray(opcionales)) {
            throw new InventarioInvalidoException('Las listas de inventario deben ser arrays');
        }
        
        this.versionId = versionId;
        this.obligatorios = obligatorios; // Array de strings (códigos de TipoDocumental)
        this.opcionales = opcionales;     // Array de strings

        Object.freeze(this);
        Object.freeze(this.obligatorios);
        Object.freeze(this.opcionales);
    }

    esObligatorio(tipoCodigo) {
        return this.obligatorios.includes(tipoCodigo);
    }
}
module.exports = InventarioSnapshot;
