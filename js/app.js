/* ============================================================
   VAR — GOAL-LINE TECHNOLOGY (Cartel Gigante del Estadio)
   app.js
   Sincronización instantánea (<10ms) vía WebSocket nativo (/ws/var-state),
   sin bloqueos CORS desde file:// ni throttling de setInterval en segundo plano,
   con fallback automático a REST (/api/EstadoVAR).
   ============================================================ */

'use strict';

const ESTADOS = {
    idle:  { clase: 'pantalla--idle',  texto: 'ESPERANDO JUGADA...', sub: 'FIFA GOAL-LINE TECHNOLOGY • 240Hz' },
    gol:   { clase: 'pantalla--gol',   texto: '¡GOL CONFIRMADO!',    sub: 'BALÓN CRUZÓ 100% LA LÍNEA DE META' },
    nogol: { clase: 'pantalla--nogol', texto: 'NO ES GOL',           sub: 'EL BALÓN NO CRUZÓ TOTALMENTE LA LÍNEA' },
};

const pantalla  = document.getElementById('pantalla');
const texto     = document.getElementById('texto');
const subtexto  = document.getElementById('subtexto');
const syncBadge = document.getElementById('syncBadge');

function resolverApiBase() {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = (params.get('api') || '').trim();
    if (fromQuery) return fromQuery.replace(/\/+$/, '');

    const fromConfig = (window.GOALLINE_API_URL || '').trim();
    if (fromConfig) return fromConfig.replace(/\/+$/, '');

    return 'http://127.0.0.1:8080';
}

function construirWsUrl(httpBase, path) {
    if (httpBase.startsWith('https://')) return `wss://${httpBase.slice(8)}${path}`;
    if (httpBase.startsWith('http://'))  return `ws://${httpBase.slice(7)}${path}`;
    return `ws://${httpBase}${path}`;
}

const API_BASE = resolverApiBase();
const ENDPOINT_VAR = `${API_BASE}/api/EstadoVAR`;
const WS_VAR_URL = construirWsUrl(API_BASE, '/ws/var-state');

let estadoActualServidor = 'idle';
let ultimoSeqServidor = 0;
let wsConectado = false;
let ws = null;

function actualizarPantalla(estado, detallePersonalizado = null) {
    const config = ESTADOS[estado];
    if (!config) {
        console.warn('[VAR] Estado inválido:', estado);
        return;
    }

    estadoActualServidor = estado;
    pantalla.className = `pantalla ${config.clase}`;
    texto.textContent  = config.texto;
    if (subtexto) {
        subtexto.textContent = detallePersonalizado || config.sub;
    }
}

function formatearTelemetria(payload) {
    if (!payload) return null;
    const partes = [];
    if (typeof payload.velocidad === 'number' && payload.velocidad > 0) {
        partes.push(`${payload.velocidad.toFixed(1)} KM/H`);
    }
    if (typeof payload.porcentajeCruzoLinea === 'number') {
        partes.push(`GLT ${payload.porcentajeCruzoLinea.toFixed(1)}%`);
    }
    if (payload.resultadoDetalle) {
        partes.push(String(payload.resultadoDetalle));
    }
    return partes.length > 0 ? partes.join('  •  ') : null;
}

function aplicarSnapshot(data) {
    if (!data || !data.estado) return;
    const seqNuevo = typeof data.seq === 'number' ? data.seq : 0;
    if (data.estado !== estadoActualServidor || seqNuevo > ultimoSeqServidor || seqNuevo === 0) {
        ultimoSeqServidor = Math.max(ultimoSeqServidor, seqNuevo);
        const sub = data.estado === 'idle' ? null : formatearTelemetria(data);
        actualizarPantalla(data.estado, sub);
    }
}

function setBadge(textoBadge) {
    if (syncBadge) {
        syncBadge.textContent = textoBadge;
    }
}

// ── WebSocket Nativo (/ws/var-state) — instantáneo incluso desde file:// ──
function conectarWebSocket() {
    try {
        ws = new WebSocket(WS_VAR_URL);
    } catch {
        setTimeout(conectarWebSocket, 1500);
        return;
    }

    ws.onopen = () => {
        wsConectado = true;
        setBadge('WS LIVE');
        consultarEstadoBackend();
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            aplicarSnapshot(data);
        } catch {
            // ignorar mensajes no JSON
        }
    };

    ws.onclose = () => {
        wsConectado = false;
        setBadge('RECONECTANDO...');
        setTimeout(conectarWebSocket, 1500);
    };

    ws.onerror = () => {
        ws.close();
    };
}

// ── Polling REST fallback ─────────────────────────────────────────────
async function consultarEstadoBackend() {
    try {
        const respuesta = await fetch(ENDPOINT_VAR, { cache: 'no-store' });
        if (respuesta.ok) {
            const data = await respuesta.json();
            aplicarSnapshot(data);
            if (!wsConectado) {
                setBadge('POLLING LIVE');
            }
        }
    } catch {
        if (!wsConectado) {
            setBadge('BACKEND OFFLINE');
        }
    }
}

setInterval(() => {
    if (!wsConectado) {
        consultarEstadoBackend();
    }
}, 250);

consultarEstadoBackend();
conectarWebSocket();
