/* ============================================================
   VAR — GOAL-LINE TECHNOLOGY
   app.js
   Responsabilidad única: cambiar el estado visual de la pantalla.
   ============================================================ */

'use strict';

/* ── Catálogo de estados posibles ──────────────────────────── */
const ESTADOS = {
    idle:  { clase: 'pantalla--idle',  texto: 'ESPERANDO JUGADA...' },
    gol:   { clase: 'pantalla--gol',   texto: '¡GOL CONFIRMADO!'    },
    nogol: { clase: 'pantalla--nogol', texto: 'NO ES GOL'           },
};

/* ── Referencias al DOM ────────────────────────────────────── */
const pantalla = document.getElementById('pantalla');
const texto    = document.getElementById('texto');

/* ============================================================
   actualizarPantalla(estado)

   Modifica dinámicamente las clases del contenedor principal
   y el texto del único elemento visible.

   Parámetro:
     estado {string}  'idle' | 'gol' | 'nogol'
   ============================================================ */
function actualizarPantalla(estado) {
    const config = ESTADOS[estado];

    if (!config) {
        console.warn('[VAR] Estado inválido:', estado);
        return;
    }

    /* Resetea la clase base y aplica el modificador del nuevo estado.
       Esto dispara la transición del background-color definida en CSS. */
    pantalla.className = `pantalla ${config.clase}`;
    texto.textContent  = config.texto;
}
