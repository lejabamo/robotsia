class SolicitudEstado {
    constructor(valor) {
        this.valor = valor;
        Object.freeze(this);
    }

    equals(otroEstado) {
        if (!(otroEstado instanceof SolicitudEstado)) return false;
        return this.valor === otroEstado.valor;
    }

    esTerminal() {
        return this.equals(SolicitudEstado.COMPLETADA) || this.equals(SolicitudEstado.FALLIDA);
    }

    toString() {
        return this.valor;
    }

    static fromString(valorString) {
        const estado = Object.values(SolicitudEstado).find(
            e => e instanceof SolicitudEstado && e.valor === valorString
        );
        if (!estado) return null;
        return estado;
    }
}

// Instancias estáticas inmutables (Enum via Value Object)
SolicitudEstado.RECIBIDA = new SolicitudEstado('RECIBIDA');
SolicitudEstado.EN_ESPERA_DE_EXPEDIENTE = new SolicitudEstado('EN_ESPERA_DE_EXPEDIENTE');
SolicitudEstado.EN_ESPERA_DE_VEREDICTO = new SolicitudEstado('EN_ESPERA_DE_VEREDICTO');
SolicitudEstado.COMPLETADA = new SolicitudEstado('COMPLETADA');
SolicitudEstado.FALLIDA = new SolicitudEstado('FALLIDA');

// Congelar la clase para prevenir que se añadan nuevos estados estáticos dinámicamente
Object.freeze(SolicitudEstado);

module.exports = SolicitudEstado;
