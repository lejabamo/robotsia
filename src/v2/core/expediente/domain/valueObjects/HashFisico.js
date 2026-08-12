class HashFisico {
    constructor(valor) {
        if (!valor || typeof valor !== 'string') throw new Error('Hash inválido');
        this.valor = valor;
        Object.freeze(this);
    }
    equals(other) {
        return other instanceof HashFisico && this.valor === other.valor;
    }
}
module.exports = HashFisico;
