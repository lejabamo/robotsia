const SolicitudEstado = require('../SolicitudEstado');
const { 
    TransicionIlegalException, 
    EntidadInmutableException 
} = require('../exceptions/SolicitudExceptions');

class TransicionEstadosPolicy {
    /**
     * Evalúa si una transición de estado es válida, legal o si es ignorada por idempotencia.
     * Lanza excepciones semánticas si las reglas del dominio son violadas.
     * 
     * @param {SolicitudEstado} estadoActual 
     * @param {SolicitudEstado} nuevoEstado 
     * @returns {boolean} True si la transición debe aplicarse, False si es un No-Op (Idempotencia)
     */
    static evaluar(estadoActual, nuevoEstado) {
        // Invariante 4: Idempotencia
        if (estadoActual.equals(nuevoEstado)) {
            return false; // No-Op
        }

        // Invariante 5 y 6: Protección de estados terminales
        if (estadoActual.esTerminal()) {
            throw new EntidadInmutableException(`El estado actual [${estadoActual.toString()}] es terminal y no admite cambios.`);
        }

        // Invariante 3: Rutas de transición legales
        const transicionesValidas = new Map([
            [SolicitudEstado.RECIBIDA.valor, [SolicitudEstado.EN_ESPERA_DE_EXPEDIENTE.valor, SolicitudEstado.FALLIDA.valor]],
            [SolicitudEstado.EN_ESPERA_DE_EXPEDIENTE.valor, [SolicitudEstado.EN_ESPERA_DE_VEREDICTO.valor, SolicitudEstado.FALLIDA.valor]],
            [SolicitudEstado.EN_ESPERA_DE_VEREDICTO.valor, [SolicitudEstado.COMPLETADA.valor, SolicitudEstado.FALLIDA.valor]]
        ]);

        const permitidos = transicionesValidas.get(estadoActual.valor) || [];
        if (!permitidos.includes(nuevoEstado.valor)) {
            throw new TransicionIlegalException(estadoActual.toString(), nuevoEstado.toString());
        }

        return true; // Transición legal que debe aplicarse
    }
}

module.exports = TransicionEstadosPolicy;
