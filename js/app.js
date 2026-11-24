/* ============================================================
   VAR — GOAL-LINE TECHNOLOGY (Cartel Gigante del Estadio)
   app.js
   Sincronización instantánea vía SignalR (/goalHub) con fallback
   automático a polling REST (/api/EstadoVAR).
   URL configurable para Local, Docker Compose y Azure Static Web Apps.
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

    return 'http://localhost:8080';
}

const API_BASE = resolverApiBase();
const ENDPOINT_VAR = `${API_BASE}/api/EstadoVAR`;
const HUB_URL = `${API_BASE}/goalHub`;

let estadoActualServidor = 'idle';
let signalrConectado = false;

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

function setBadge(textoBadge) {
    if (syncBadge) {
        syncBadge.textContent = textoBadge;
    }
}

// ── SignalR (tiempo real <50ms) ───────────────────────────────────────
function iniciarSignalR() {
    if (!window.signalR) {
        setBadge('MODO POLLING');
        return;
    }

    const connection = new window.signalR.HubConnectionBuilder()
        .withUrl(HUB_URL)
        .withAutomaticReconnect()
        .build();

    connection.on('EstadoVARActualizado', (data) => {
        if (!data || !data.estado) return;
        const sub = data.estado === 'idle' ? null : formatearTelemetria(data);
        actualizarPantalla(data.estado, sub);
    });

    connection.on('NuevoDisparo', (disparo) => {
        if (!disparo) return;
        const estado = disparo.fueGol ? 'gol' : 'nogol';
        actualizarPantalla(estado, formatearTelemetria(disparo));
    });

    connection.onreconnecting(() => {
        signalrConectado = false;
        setBadge('RECONECTANDO...');
    });

    connection.onreconnected(() => {
        signalrConectado = true;
        setBadge('SIGNALR LIVE');
        consultarEstadoBackend();
    });

    connection.onclose(() => {
        signalrConectado = false;
        setBadge('MODO POLLING');
    });

    connection.start()
        .then(() => {
            signalrConectado = true;
            setBadge('SIGNALR LIVE');
        })
        .catch(() => {
            signalrConectado = false;
            setBadge('MODO POLLING');
        });
}

// ── Polling REST fallback ─────────────────────────────────────────────
async function consultarEstadoBackend() {
    try {
        const respuesta = await fetch(ENDPOINT_VAR, { cache: 'no-store' });
        if (respuesta.ok) {
            const data = await respuesta.json();
            if (data.estado && data.estado !== estadoActualServidor) {
                actualizarPantalla(data.estado);
            }
            if (!signalrConectado) {
                setBadge('POLLING LIVE');
            }
        }
    } catch {
        if (!signalrConectado) {
            setBadge('BACKEND OFFLINE');
        }
    }
}

// Polling rápido cuando SignalR no está conectado; chequeo suave de respaldo si sí lo está
setInterval(() => {
    if (!signalrConectado) {
        consultarEstadoBackend();
    }
}, 250);

setInterval(() => {
    if (signalrConectado) {
        consultarEstadoBackend();
    }
}, 2500);

consultarEstadoBackend();
iniciarSignalR();
