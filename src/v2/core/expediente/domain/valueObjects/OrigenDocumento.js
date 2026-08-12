class OrigenDocumento {
    static MAQUINA = new OrigenDocumento('MAQUINA');
    static HUMANO = new OrigenDocumento('HUMANO');

    constructor(valor) {
        this.valor = valor;
        Object.freeze(this);
    }
}
module.exports = OrigenDocumento;
