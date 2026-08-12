class TipoDocumental {
    constructor(codigo) {
        if (!codigo || typeof codigo !== 'string') throw new Error('Código de TipoDocumental inválido');
        this.codigo = codigo;
        Object.freeze(this);
    }
    equals(other) {
        return other instanceof TipoDocumental && this.codigo === other.codigo;
    }
}
module.exports = TipoDocumental;
