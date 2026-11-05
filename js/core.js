/* core.js — núcleo del portal: rutas, ajustes, sonido, récords y anfitrión de juegos. */
(function () {
  'use strict';

  var CFG = window.CONFIG || {};
  var PREFIJO = CFG.PREFIJO || 'yaj:';
  var ESQUEMA = typeof CFG.ESQUEMA === 'number' ? CFG.ESQUEMA : 1;

  /* ───────────────────────────  Utilidades  ─────────────────────────── */
  function $(sel, raiz) { return (raiz || document).querySelector(sel); }
  function $$(sel, raiz) {
    return Array.prototype.slice.call((raiz || document).querySelectorAll(sel));
  }
  function esc(t) {
    return String(t === null || t === undefined ? '' : t)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function dos(n) { return (n < 10 ? '0' : '') + n; }

  function formatoTiempo(ms) {
    if (typeof ms !== 'number' || !isFinite(ms) || ms < 0) return '—';
    var total = Math.floor(ms / 1000);
    var s = total % 60;
    var m = Math.floor(total / 60) % 60;
    var h = Math.floor(total / 3600);
    if (h > 0) return h + ':' + dos(m) + ':' + dos(s);
    return dos(m) + ':' + dos(s);
  }

  /* ───────────────────────────  Almacenamiento  ─────────────────────────── */
  var almacen = {
    leer: function (clave, porDefecto) {
      try {
        var bruto = window.localStorage.getItem(PREFIJO + clave);
        if (bruto === null) return porDefecto;
        var sobre = JSON.parse(bruto);
        if (!sobre || sobre.v !== ESQUEMA) return porDefecto;
        return sobre.d === undefined ? porDefecto : sobre.d;
      } catch (e) {
        return porDefecto;
      }
    },
    escribir: function (clave, valor) {
      try {
        window.localStorage.setItem(PREFIJO + clave, JSON.stringify({ v: ESQUEMA, d: valor }));
        return true;
      } catch (e) {
        return false;
      }
    },
    borrar: function (clave) {
      try { window.localStorage.removeItem(PREFIJO + clave); } catch (e) { /* sin persistencia */ }
    },
    borrarTodo: function () {
      try {
        var claves = [];
        for (var i = 0; i < window.localStorage.length; i++) {
          var k = window.localStorage.key(i);
          if (k && k.indexOf(PREFIJO) === 0) claves.push(k);
        }
        claves.forEach(function (k) { window.localStorage.removeItem(k); });
      } catch (e) { /* sin persistencia */ }
    }
  };

  /* ───────────────────────────  Iconos  ─────────────────────────── */
  var TRAZO = 'fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"';

  var Iconos = {
    inicio: '<svg viewBox="0 0 24 24" ' + TRAZO + ' aria-hidden="true"><path d="M4 10.6 12 4l8 6.6"/><path d="M6.5 9.8V19a1 1 0 0 0 1 1h3v-5h3v5h3a1 1 0 0 0 1-1V9.8"/></svg>',
    volver: '<svg viewBox="0 0 24 24" ' + TRAZO + ' aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    pausa: '<svg viewBox="0 0 24 24" ' + TRAZO + ' aria-hidden="true"><path d="M9 5v14"/><path d="M15 5v14"/></svg>',
    reanudar: '<svg viewBox="0 0 24 24" ' + TRAZO + ' aria-hidden="true"><path d="M8 5.5 18.5 12 8 18.5z"/></svg>',
    deshacer: '<svg viewBox="0 0 24 24" ' + TRAZO + ' aria-hidden="true"><path d="M4 10h10a5 5 0 0 1 0 10h-4"/><path d="M8 6l-4 4 4 4"/></svg>',
    rehacer: '<svg viewBox="0 0 24 24" ' + TRAZO + ' aria-hidden="true"><path d="M20 10H10a5 5 0 0 0 0 10h4"/><path d="M16 6l4 4-4 4"/></svg>',
    pista: '<svg viewBox="0 0 24 24" ' + TRAZO + ' aria-hidden="true"><path d="M9.5 18h5"/><path d="M10.5 21h3"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1.1 1.2 1.1 2h5c0-.8.5-1.5 1.1-2A6 6 0 0 0 12 3z"/></svg>',
    bandera: '<svg viewBox="0 0 24 24" ' + TRAZO + ' aria-hidden="true"><path d="M6 21V4"/><path d="M6 4.5h10l-1.8 3.5L16 11.5H6"/></svg>',
    reiniciar: '<svg viewBox="0 0 24 24" ' + TRAZO + ' aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4.5V10h-5.5"/></svg>',
    ajustes: '<svg viewBox="0 0 24 24" ' + TRAZO + ' aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 14.6a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.1a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-1-1.4 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.4-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 1 1.4 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1z"/></svg>',
    trofeo: '<svg viewBox="0 0 24 24" ' + TRAZO + ' aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 5H5.5v1a3 3 0 0 0 3 3"/><path d="M16 5h2.5v1a3 3 0 0 1-3 3"/><path d="M12 13v4"/><path d="M8.5 21h7"/><path d="M10 21c0-1.7.8-2.8 2-4 1.2 1.2 2 2.3 2 4"/></svg>',
    sol: '<svg viewBox="0 0 24 24" ' + TRAZO + ' aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2"/><path d="M12 19.5v2"/><path d="M4.6 4.6 6 6"/><path d="M18 18l1.4 1.4"/><path d="M2.5 12h2"/><path d="M19.5 12h2"/><path d="M4.6 19.4 6 18"/><path d="M18 6l1.4-1.4"/></svg>',
    luna: '<svg viewBox="0 0 24 24" ' + TRAZO + ' aria-hidden="true"><path d="M20 14.4A8.5 8.5 0 0 1 9.6 4a8.5 8.5 0 1 0 10.4 10.4z"/></svg>',
    sonido: '<svg viewBox="0 0 24 24" ' + TRAZO + ' aria-hidden="true"><path d="M4 9.5v5h3l5 4V5.5l-5 4z"/><path d="M16 9a4.5 4.5 0 0 1 0 6"/><path d="M18.6 6.4a8.5 8.5 0 0 1 0 11.2"/></svg>',
    silencio: '<svg viewBox="0 0 24 24" ' + TRAZO + ' aria-hidden="true"><path d="M4 9.5v5h3l5 4V5.5l-5 4z"/><path d="M16 9.5l5 5"/><path d="M21 9.5l-5 5"/></svg>',
    estrella: '<svg viewBox="0 0 24 24" ' + TRAZO + ' aria-hidden="true"><path d="M12 3.6l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.5 9.8l5.9-.9z"/></svg>',
    lapiz: '<svg viewBox="0 0 24 24" ' + TRAZO + ' aria-hidden="true"><path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/></svg>',
    borrar: '<svg viewBox="0 0 24 24" ' + TRAZO + ' aria-hidden="true"><path d="M4.5 15.5 12 8l6.5 6.5-4 4H8.5z"/><path d="M9.5 21H20"/></svg>',
    mezclar: '<svg viewBox="0 0 24 24" ' + TRAZO + ' aria-hidden="true"><path d="M4 7h3.6l7 10H20"/><path d="M17 4l3 3-3 3"/><path d="M4 17h3.6"/><path d="M17 14l3 3-3 3"/></svg>',
    acercar: '<svg viewBox="0 0 24 24" ' + TRAZO + ' aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.4-4.4"/><path d="M11 8.5v5"/><path d="M8.5 11h5"/></svg>',
    alejar: '<svg viewBox="0 0 24 24" ' + TRAZO + ' aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.4-4.4"/><path d="M8.5 11h5"/></svg>'
  };

  function svgIcono(nombre) {
    return '<span class="ico" aria-hidden="true">' + (Iconos[nombre] || Iconos.estrella) + '</span>';
  }

  /* ───────────────────────────  API pública de juegos  ─────────────────────────── */
  var Arcade = window.Arcade = window.Arcade || {};
  Arcade.juegos = {};
  Arcade.register = function (def) {
    if (!def || !def.id || typeof def.mount !== 'function') return;
    Arcade.juegos[def.id] = def;
  };

  /* ───────────────────────────  Estado de la aplicación  ─────────────────────────── */
  var estadoApp = {
    vista: 'inicio',
    juego: null,
    juegoId: null,
    ctx: null,
    dificultad: null,
    pausado: false,
    partidaTerminada: false,
    temporizador: 0,
    oyentesAjustes: []
  };

  /* ───────────────────────────  Ajustes  ─────────────────────────── */
  var ajustesCrudos = { tema: 'auto', sonido: false, vibracion: true, movimientoReducido: 'auto' };
  var ajustesEfectivos = { sonido: false, vibracion: true, movimientoReducido: false, tema: 'claro' };

  function mq(consulta) {
    try { return window.matchMedia ? window.matchMedia(consulta) : null; } catch (e) { return null; }
  }

  function cargarAjustes() {
    var guardado = almacen.leer('ajustes', null);
    var base = { tema: 'auto', sonido: false, vibracion: true, movimientoReducido: 'auto' };
    if (guardado && typeof guardado === 'object') {
      if (['claro', 'noche', 'auto'].indexOf(guardado.tema) >= 0) base.tema = guardado.tema;
      if (typeof guardado.sonido === 'boolean') base.sonido = guardado.sonido;
      if (typeof guardado.vibracion === 'boolean') base.vibracion = guardado.vibracion;
      if (['auto', 'si', 'no'].indexOf(guardado.movimientoReducido) >= 0) {
        base.movimientoReducido = guardado.movimientoReducido;
      }
    }
    ajustesCrudos = base;
    recalcularAjustes();
  }

  function guardarAjustes() {
    almacen.escribir('ajustes', {
      tema: ajustesCrudos.tema,
      sonido: ajustesCrudos.sonido,
      vibracion: ajustesCrudos.vibracion,
      movimientoReducido: ajustesCrudos.movimientoReducido
    });
  }

  function recalcularAjustes() {
    var oscuro = mq('(prefers-color-scheme: dark)');
    var quieto = mq('(prefers-reduced-motion: reduce)');

    var noche = ajustesCrudos.tema === 'noche' || (ajustesCrudos.tema === 'auto' && !!(oscuro && oscuro.matches));
    var reducido = ajustesCrudos.movimientoReducido === 'si' ||
      (ajustesCrudos.movimientoReducido === 'auto' && !!(quieto && quieto.matches));

    ajustesEfectivos.tema = noche ? 'noche' : 'claro';
    ajustesEfectivos.sonido = !!ajustesCrudos.sonido;
    ajustesEfectivos.vibracion = !!ajustesCrudos.vibracion;
    ajustesEfectivos.movimientoReducido = reducido;

    var raiz = document.documentElement;
    raiz.setAttribute('data-tema', ajustesEfectivos.tema);
    raiz.setAttribute('data-movimiento', reducido ? 'reducido' : 'normal');
    raiz.style.colorScheme = noche ? 'dark' : 'light';

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', noche ? '#1D2623' : '#E8ECE9');

    actualizarBotonTema();
  }

  function avisarAjustes() {
    var lista = estadoApp.oyentesAjustes || [];
    for (var i = 0; i < lista.length; i++) {
      try { lista[i](ajustesEfectivos); } catch (e) { /* el juego falla en silencio */ }
    }
  }

  function actualizarBotonTema() {
    var b = $('#btn-tema');
    if (!b) return;
    var noche = ajustesEfectivos.tema === 'noche';
    b.innerHTML = svgIcono(noche ? 'sol' : 'luna') + '<span>' + (noche ? 'Modo claro' : 'Modo noche') + '</span>';
    b.setAttribute('aria-label', noche ? 'Cambiar a modo claro' : 'Cambiar a modo noche');
    b.setAttribute('aria-pressed', noche ? 'true' : 'false');
  }

  function alternarTema() {
    ajustesCrudos.tema = ajustesEfectivos.tema === 'noche' ? 'claro' : 'noche';
    guardarAjustes();
    recalcularAjustes();
    avisarAjustes();
    if (estadoApp.vista === 'ajustes') navegar();
  }

  /* ───────────────────────────  Sonido y vibración  ─────────────────────────── */
  var audioCtx = null;

  function contextoAudio() {
    if (audioCtx) return audioCtx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    } catch (e) {
      audioCtx = null;
    }
    return audioCtx;
  }

  function tono(ac, freq, cuando, dur, tipo, vol) {
    var osc = ac.createOscillator();
    var gan = ac.createGain();
    osc.type = tipo || 'sine';
    osc.frequency.setValueAtTime(freq, cuando);
    gan.gain.setValueAtTime(0.0001, cuando);
    gan.gain.exponentialRampToValueAtTime(vol, cuando + 0.012);
    gan.gain.exponentialRampToValueAtTime(0.0001, cuando + dur);
    osc.connect(gan);
    gan.connect(ac.destination);
    osc.start(cuando);
    osc.stop(cuando + dur + 0.03);
  }

  var PATRONES = {
    toque: [[660, 0, 0.08, 'triangle', 0.05]],
    ok: [[523, 0, 0.1, 'sine', 0.07], [784, 0.09, 0.14, 'sine', 0.06]],
    error: [[210, 0, 0.16, 'square', 0.04], [157, 0.1, 0.18, 'square', 0.035]],
    victoria: [
      [523.25, 0, 0.14, 'sine', 0.07],
      [659.25, 0.12, 0.14, 'sine', 0.07],
      [783.99, 0.24, 0.18, 'sine', 0.07],
      [1046.5, 0.38, 0.32, 'sine', 0.06]
    ],
    derrota: [
      [392, 0, 0.18, 'sine', 0.055],
      [311, 0.16, 0.22, 'sine', 0.055],
      [233, 0.34, 0.36, 'sine', 0.05]
    ]
  };

  function sfx(nombre) {
    if (!ajustesEfectivos.sonido) return;
    var ac = contextoAudio();
    if (!ac) return;
    try {
      if (ac.state === 'suspended') ac.resume();
      var patron = PATRONES[nombre] || PATRONES.toque;
      var t0 = ac.currentTime + 0.01;
      for (var i = 0; i < patron.length; i++) {
        var n = patron[i];
        tono(ac, n[0], t0 + n[1], n[2], n[3], n[4]);
      }
    } catch (e) { /* audio no disponible */ }
  }

  function vibrar(patron) {
    if (!ajustesEfectivos.vibracion) return;
    try {
      if (navigator.vibrate) navigator.vibrate(patron);
    } catch (e) { /* sin vibración */ }
  }

  /* ───────────────────────────  Avisos  ─────────────────────────── */
  function toast(texto) {
    var raiz = $('#toast-raiz');
    if (!raiz) return;
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = String(texto);
    raiz.appendChild(el);
    window.requestAnimationFrame(function () { el.classList.add('visible'); });
    window.setTimeout(function () {
      el.classList.remove('visible');
      window.setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 220);
    }, 2400);
  }

  /* ───────────────────────────  Modales  ─────────────────────────── */
  var modalActual = null;
  var focoPrevio = null;

  function cerrarModal() {
    if (modalActual && modalActual.parentNode) modalActual.parentNode.removeChild(modalActual);
    modalActual = null;
    document.body.classList.remove('con-modal');
    if (focoPrevio && typeof focoPrevio.focus === 'function') {
      try { focoPrevio.focus(); } catch (e) { /* nada */ }
    }
    focoPrevio = null;
  }

  function abrirModal(op) {
    op = op || {};
    cerrarModal();

    var raiz = $('#modal-raiz');
    if (!raiz) return;

    focoPrevio = document.activeElement;

    var capa = document.createElement('div');
    capa.className = 'modal-capa';
    capa.setAttribute('role', 'dialog');
    capa.setAttribute('aria-modal', 'true');
    capa.setAttribute('aria-labelledby', 'modal-titulo');

    var html = '<div class="modal vidrio">';
    html += '<h2 class="modal-titulo" id="modal-titulo">' + esc(op.titulo || '') + '</h2>';
    if (op.detalle) html += '<p class="modal-detalle">' + esc(op.detalle) + '</p>';
    if (op.frase) html += '<p class="modal-frase">' + esc(op.frase) + '</p>';
    html += '<div class="modal-acciones"></div>';
    html += '</div>';
    capa.innerHTML = html;

    var zona = $('.modal-acciones', capa);
    var acciones = op.acciones || [];
    acciones.forEach(function (a) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn' + (a.primario ? ' btn-primario' : '');
      b.textContent = a.texto;
      b.addEventListener('click', function () { a.accion(); });
      zona.appendChild(b);
    });

    raiz.appendChild(capa);
    document.body.classList.add('con-modal');
    modalActual = capa;

    var primero = $('button', zona);
    if (primero) {
      try { primero.focus(); } catch (e) { /* nada */ }
    }

    if (op.confeti) lanzarConfeti();
  }

  /* ───────────────────────────  Confeti sobrio  ─────────────────────────── */
  function lanzarConfeti() {
    if (ajustesEfectivos.movimientoReducido) return;

    var colores = ['#86B3AC', '#D2A8A4', '#D3AE63', '#7DA66B', '#5F8DB3'];
    var canvas = document.createElement('canvas');
    canvas.className = 'confeti';
    document.body.appendChild(canvas);

    var ctx2d = canvas.getContext('2d');
    if (!ctx2d) {
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      return;
    }

    function ajustar() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    ajustar();
    window.addEventListener('resize', ajustar);

    var piezas = [];
    for (var i = 0; i < 70; i++) {
      piezas.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * canvas.height * 0.5,
        w: 5 + Math.random() * 5,
        h: 8 + Math.random() * 8,
        vy: 1.6 + Math.random() * 2.6,
        vx: -0.8 + Math.random() * 1.6,
        giro: Math.random() * Math.PI * 2,
        vGiro: -0.08 + Math.random() * 0.16,
        color: colores[Math.floor(Math.random() * colores.length)]
      });
    }

    var inicio = performance.now();
    var cuadro = 0;

    function bucle(ahora) {
      var t = ahora - inicio;
      ctx2d.clearRect(0, 0, canvas.width, canvas.height);

      for (var i = 0; i < piezas.length; i++) {
        var p = piezas[i];
        p.x += p.vx;
        p.y += p.vy;
        p.giro += p.vGiro;
        ctx2d.save();
        ctx2d.translate(p.x, p.y);
        ctx2d.rotate(p.giro);
        ctx2d.fillStyle = p.color;
        ctx2d.globalAlpha = t > 1500 ? Math.max(0, 1 - (t - 1500) / 500) : 1;
        ctx2d.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx2d.restore();
      }

      if (t < 2000) {
        cuadro = window.requestAnimationFrame(bucle);
      } else {
        window.cancelAnimationFrame(cuadro);
        window.removeEventListener('resize', ajustar);
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      }
    }

    cuadro = window.requestAnimationFrame(bucle);
  }

  /* ───────────────────────────  Récords y partidas  ─────────────────────────── */
  function leerRecords() {
    var r = almacen.leer('records', null);
    return (r && typeof r === 'object') ? r : {};
  }

  function leerUltimas() {
    var u = almacen.leer('ultimas', null);
    return (u && typeof u === 'object') ? u : {};
  }

  function guardarUltimaDificultad(idJuego, idDif) {
    if (!idJuego || !idDif) return;
    var u = leerUltimas();
    u[idJuego] = idDif;
    almacen.escribir('ultimas', u);
  }

  function registroVacio() {
    return { mejorTiempoMs: null, mejorPuntaje: null, jugadas: 0, ganadas: 0 };
  }

  function reportar(datos) {
    datos = datos || {};
    var id = estadoApp.juegoId;
    if (!id) return;

    var dif = datos.dificultad || estadoApp.dificultad || 'normal';
    var recs = leerRecords();
    if (!recs[id]) recs[id] = {};
    if (!recs[id][dif]) recs[id][dif] = registroVacio();

    var r = recs[id][dif];
    var tipo = datos.tipo;

    if (tipo === 'victoria' || tipo === 'derrota' || tipo === 'fin') r.jugadas += 1;

    if (tipo === 'victoria') {
      r.ganadas += 1;
      if (typeof datos.tiempoMs === 'number' && isFinite(datos.tiempoMs) && datos.tiempoMs > 0) {
        if (r.mejorTiempoMs === null || datos.tiempoMs < r.mejorTiempoMs) r.mejorTiempoMs = datos.tiempoMs;
      }
    }

    if (typeof datos.puntaje === 'number' && isFinite(datos.puntaje)) {
      if (r.mejorPuntaje === null || datos.puntaje > r.mejorPuntaje) r.mejorPuntaje = datos.puntaje;
    }

    almacen.escribir('records', recs);
    guardarUltimaDificultad(id, dif);

    /* La partida terminó: ya no hay nada que continuar. */
    almacen.borrar('partida');
    estadoApp.partidaTerminada = true;

    if (tipo === 'victoria') { sfx('victoria'); vibrar([18, 60, 18]); }
    else if (tipo === 'derrota') { sfx('derrota'); vibrar(60); }
  }

  function leerPartidaGuardada() {
    var p = almacen.leer('partida', null);
    if (!p || !p.juegoId || !p.estado) return null;
    return p;
  }

  function guardarPartida() {
    var def = estadoApp.juego;
    if (!def || estadoApp.partidaTerminada) return;

    var estado = null;
    try {
      estado = typeof def.serializar === 'function' ? def.serializar() : null;
    } catch (e) {
      estado = null;
    }
    if (!estado) return;

    var reg = {
      juegoId: def.id,
      dificultad: estado.dificultad || estadoApp.dificultad || 'normal',
      tiempoMs: typeof estado.tiempoMs === 'number' ? estado.tiempoMs : 0,
      puntaje: typeof estado.puntaje === 'number' ? estado.puntaje : null,
      guardadoEn: Date.now(),
      estado: estado
    };

    almacen.escribir('partida', reg);
    guardarUltimaDificultad(def.id, reg.dificultad);
  }

  function iniciarAutoguardado() {
    detenerAutoguardado();
    estadoApp.temporizador = window.setInterval(guardarPartida, 5000);
  }

  function detenerAutoguardado() {
    if (estadoApp.temporizador) {
      window.clearInterval(estadoApp.temporizador);
      estadoApp.temporizador = 0;
    }
  }

  /* ───────────────────────────  Celebración  ─────────────────────────── */
  function fraseVictoria() {
    var lista = CFG.MENSAJES_VICTORIA || [];
    if (!lista.length) return '¡Muy bien!';
    return lista[Math.floor(Math.random() * lista.length)];
  }

  function celebrar(datos) {
    datos = datos || {};
    abrirModal({
      titulo: datos.titulo || '¡Ganaste!',
      detalle: datos.detalle || '',
      frase: fraseVictoria(),
      confeti: true,
      acciones: [
        {
          texto: 'Jugar otra vez',
          primario: true,
          accion: function () {
            cerrarModal();
            nuevaPartidaActual();
          }
        },
        {
          texto: 'Volver al inicio',
          accion: function () {
            cerrarModal();
            location.hash = '#/inicio';
          }
        }
      ]
    });
  }

  function nuevaPartidaActual() {
    var def = estadoApp.juego;
    if (!def) return;
    estadoApp.partidaTerminada = false;
    estadoApp.pausado = false;
    actualizarBotonPausa();
    var capa = $('#pausa-capa');
    if (capa) capa.hidden = true;
    try {
      if (typeof def.nuevaPartida === 'function') def.nuevaPartida(estadoApp.dificultad);
    } catch (e) { /* el juego decide */ }
  }

  /* ───────────────────────────  Contexto de juego  ─────────────────────────── */
  function inyectarEstilos(id, css) {
    var previos = document.querySelectorAll('style[data-juego="' + id + '"]');
    Array.prototype.forEach.call(previos, function (s) {
      if (s.parentNode) s.parentNode.removeChild(s);
    });
    if (!css) return;
    var estilo = document.createElement('style');
    estilo.setAttribute('data-juego', id);
    estilo.textContent = String(css);
    document.head.appendChild(estilo);
  }

  function crearCtx(def) {
    var oyentes = [];
    estadoApp.oyentesAjustes = oyentes;

    return {
      guardar: function (clave, valor) {
        almacen.escribir('juego:' + def.id + ':' + clave, valor);
      },
      leer: function (clave, porDefecto) {
        return almacen.leer('juego:' + def.id + ':' + clave, porDefecto);
      },
      ajustes: ajustesEfectivos,
      alCambiarAjustes: function (fn) {
        if (typeof fn === 'function') oyentes.push(fn);
      },
      sfx: sfx,
      reportar: reportar,
      celebrar: celebrar,
      toast: toast,
      inyectarEstilos: function (css) { inyectarEstilos(def.id, css); },
      iconos: Iconos,
      volverAlInicio: function () { location.hash = '#/inicio'; }
    };
  }

  /* ───────────────────────────  Navegación  ─────────────────────────── */
  var ITEMS_NAV = [
    { id: 'inicio', texto: 'Inicio', icono: 'inicio', href: '#/inicio' },
    { id: 'records', texto: 'Récords', icono: 'trofeo', href: '#/records' },
    { id: 'ajustes', texto: 'Ajustes', icono: 'ajustes', href: '#/ajustes' }
  ];

  function renderNav() {
    var nav = $('#nav');
    var inf = $('#inferior');

    var htmlNav = ITEMS_NAV.map(function (it) {
      return '<a href="' + it.href + '" data-nav="' + it.id + '">' +
        svgIcono(it.icono) + '<span>' + esc(it.texto) + '</span></a>';
    }).join('');

    var htmlInf = ITEMS_NAV.map(function (it) {
      return '<a href="' + it.href + '" data-nav="' + it.id + '">' +
        svgIcono(it.icono) + '<span>' + esc(it.texto) + '</span></a>';
    }).join('');

    if (nav) nav.innerHTML = htmlNav;
    if (inf) inf.innerHTML = htmlInf;
  }

  function marcarNav(vista) {
    $$('[data-nav]').forEach(function (a) {
      if (a.getAttribute('data-nav') === vista) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  function parsearHash() {
    var h = (location.hash || '').replace(/^#/, '');
    if (h.charAt(0) === '/') h = h.slice(1);
    var partes = h.split('/').filter(function (x) { return x !== ''; });
    if (!partes.length) return { vista: 'inicio' };
    var primera = partes[0];
    if (primera === 'juego') return { vista: 'juego', id: partes[1] || '' };
    if (primera === 'records') return { vista: 'records' };
    if (primera === 'ajustes') return { vista: 'ajustes' };
    return { vista: 'inicio' };
  }

  var navegando = false;

  function navegar() {
    if (navegando) return;
    navegando = true;
    try {
      cerrarModal();
      desmontarJuego();

      var r = parsearHash();
      estadoApp.vista = r.vista;
      marcarNav(r.vista);

      var vista = $('#vista');
      if (!vista) return;
      vista.innerHTML = '';

      if (r.vista === 'juego') vistaJuego(vista, r.id);
      else if (r.vista === 'records') vistaRecords(vista);
      else if (r.vista === 'ajustes') vistaAjustes(vista);
      else vistaInicio(vista);

      tituloDocumento(r);
      window.scrollTo(0, 0);
    } finally {
      navegando = false;
    }
  }

  function tituloDocumento(r) {
    var base = CFG.NOMBRE_SITIO || 'Juegos';
    if (r.vista === 'juego') {
      var def = Arcade.juegos[r.id];
      document.title = (def ? def.nombre : 'Juego') + ' — ' + base;
    } else if (r.vista === 'records') {
      document.title = 'Récords — ' + base;
    } else if (r.vista === 'ajustes') {
      document.title = 'Ajustes — ' + base;
    } else {
      document.title = base;
    }
  }

  /* ───────────────────────────  Desmontaje de juego  ─────────────────────────── */
  function desmontarJuego() {
    var def = estadoApp.juego;
    if (!def) return;

    guardarPartida();
    detenerAutoguardado();

    try {
      if (typeof def.destruir === 'function') def.destruir();
    } catch (e) { /* nada */ }

    var estilos = document.querySelectorAll('style[data-juego="' + def.id + '"]');
    Array.prototype.forEach.call(estilos, function (s) {
      if (s.parentNode) s.parentNode.removeChild(s);
    });

    estadoApp.oyentesAjustes = [];
    estadoApp.juego = null;
    estadoApp.ctx = null;
    estadoApp.juegoId = null;
    estadoApp.pausado = false;
    estadoApp.partidaTerminada = false;
  }

  /* ───────────────────────────  Pausa  ─────────────────────────── */
  function actualizarBotonPausa() {
    var btn = $('#btn-pausa');
    if (!btn) return;
    if (estadoApp.pausado) {
      btn.innerHTML = svgIcono('reanudar');
      btn.setAttribute('aria-label', 'Reanudar');
    } else {
      btn.innerHTML = svgIcono('pausa');
      btn.setAttribute('aria-label', 'Pausar');
    }
  }

  function alternarPausa(forzar) {
    var def = estadoApp.juego;
    if (!def) return;
    var activar = typeof forzar === 'boolean' ? forzar : !estadoApp.pausado;
    if (activar === estadoApp.pausado) return;

    estadoApp.pausado = activar;

    try {
      if (activar && typeof def.pausar === 'function') def.pausar();
      if (!activar && typeof def.reanudar === 'function') def.reanudar();
    } catch (e) { /* el juego decide */ }

    var capa = $('#pausa-capa');
    if (capa) capa.hidden = !activar;
    actualizarBotonPausa();
  }

  /* ───────────────────────────  Miniaturas de respaldo  ─────────────────────────── */
  function miniaturaGenerica(id) {
    var semilla = 0;
    var clave = String(id || 'juego');
    for (var i = 0; i < clave.length; i++) semilla += clave.charCodeAt(i);

    var tintes = ['--azul', '--verde', '--rosa', '--amarillo'];
    var fondos = ['--vidrio-mar', '--rosa-ceniza', '--ambar', '--piedra'];
    var tinte = tintes[semilla % 4];
    var fondo = fondos[(semilla + 1) % 4];

    return '<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<rect x="0" y="0" width="120" height="100" rx="18" style="fill:var(' + fondo + ');opacity:.35"/>' +
      '<circle cx="46" cy="52" r="26" style="fill:var(' + tinte + ');opacity:.75"/>' +
      '<rect x="64" y="34" width="32" height="32" rx="10" style="fill:var(--niebla-2);opacity:.85"/>' +
      '<rect x="70" y="40" width="20" height="20" rx="6" style="fill:var(' + tinte + ');opacity:.45"/>' +
      '</svg>';
  }

  /* ───────────────────────────  Datos para las tarjetas  ─────────────────────────── */
  function mejorMarcaGlobal(idJuego) {
    var recs = leerRecords();
    var porDif = recs[idJuego];
    if (!porDif) return '';
    var mejorT = null;
    var mejorP = null;
    Object.keys(porDif).forEach(function (d) {
      var r = porDif[d];
      if (!r) return;
      if (typeof r.mejorTiempoMs === 'number' && (mejorT === null || r.mejorTiempoMs < mejorT)) mejorT = r.mejorTiempoMs;
      if (typeof r.mejorPuntaje === 'number' && (mejorP === null || r.mejorPuntaje > mejorP)) mejorP = r.mejorPuntaje;
    });
    if (mejorT !== null) return formatoTiempo(mejorT);
    if (mejorP !== null) return mejorP + ' puntos';
    return '';
  }

  function nombreDificultad(idJuego, idDif) {
    if (!idDif) return '';
    var def = Arcade.juegos[idJuego];
    if (def && def.dificultades) {
      for (var i = 0; i < def.dificultades.length; i++) {
        if (def.dificultades[i].id === idDif) return def.dificultades[i].nombre;
      }
    }
    return idDif;
  }

  /* ───────────────────────────  Vista: inicio  ─────────────────────────── */
  function tarjetaContinuar(guardada) {
    var def = Arcade.juegos[guardada.juegoId];
    var entrada = null;
    (CFG.JUEGOS || []).forEach(function (j) { if (j.id === guardada.juegoId) entrada = j; });
    var nombre = def ? def.nombre : (entrada ? entrada.nombre : guardada.juegoId);
    var difNombre = nombreDificultad(guardada.juegoId, guardada.dificultad);

    var h = '<a class="continuar vidrio" href="#/juego/' + esc(guardada.juegoId) + '">';
    h += '<span class="continuar-texto">';
    h += '<span class="continuar-etiqueta">Seguir jugando</span>';
    h += '<span class="continuar-nombre">' + esc(nombre) + '</span>';
    h += '<span class="continuar-meta">';
    if (difNombre) h += '<span>' + esc(difNombre) + '</span>';
    h += '<span class="tiempo">' + formatoTiempo(guardada.tiempoMs) + '</span>';
    h += '</span></span>';
    h += '<span class="btn btn-primario">Continuar</span>';
    h += '</a>';
    return h;
  }

  function tarjetaJuego(entrada) {
    var def = Arcade.juegos[entrada.id];
    var disponible = !!def;
    var nombre = def ? def.nombre : (entrada.nombre || entrada.id);
    var descripcion = def ? (def.descripcion || '') : (entrada.descripcion || '');

    var mini = '';
    if (def && typeof def.thumbnail === 'function') {
      try { mini = def.thumbnail() || ''; } catch (e) { mini = ''; }
    }
    if (!mini) mini = miniaturaGenerica(entrada.id);

    var marca = mejorMarcaGlobal(entrada.id);
    var ultimas = leerUltimas();
    var ultimaNombre = ultimas[entrada.id] ? nombreDificultad(entrada.id, ultimas[entrada.id]) : '';

    var etiqueta = disponible ? 'a' : 'div';
    var h = '<' + etiqueta + ' class="tarjeta vidrio' + (disponible ? '' : ' es-proximamente') + '"' +
      (disponible ? ' href="#/juego/' + esc(entrada.id) + '"' : '') + '>';

    h += '<span class="miniatura">' + mini + '</span>';
    h += '<span class="cuerpo">';
    h += '<span class="tarjeta-nombre">' + esc(nombre) + '</span>';
    h += '<span class="tarjeta-desc">' + esc(descripcion) + '</span>';
    h += '<span class="tarjeta-meta">';
    h += '<span>' + (marca ? 'Mejor: ' + esc(marca) : 'Sin récord todavía') + '</span>';
    if (ultimaNombre) h += '<span>Última: ' + esc(ultimaNombre) + '</span>';
    h += '</span>';
    h += '<span class="btn btn-primario tarjeta-btn">' + (disponible ? 'Jugar' : 'Próximamente') + '</span>';
    h += '</span></' + etiqueta + '>';

    return h;
  }

  function vistaInicio(contenedor) {
    var guardada = leerPartidaGuardada();

    var h = '<section class="inicio">';
    h += '<header class="saludo">';
    h += '<h1 class="saludo-titulo">Hola, ' + esc(CFG.DESTINATARIA || 'Yajaira') + '</h1>';
    h += '<p class="saludo-texto">' + esc(CFG.SUBTITULO || '') + '</p>';
    h += '</header>';

    if (guardada) h += tarjetaContinuar(guardada);

    h += '<div class="seccion-cabecera"><h2 class="seccion-titulo">Juegos</h2></div>';
    h += '<div class="rejilla">';
    (CFG.JUEGOS || []).forEach(function (j) { h += tarjetaJuego(j); });
    h += '</div>';
    h += '</section>';

    contenedor.innerHTML = h;
  }

  /* ───────────────────────────  Vista: juego  ─────────────────────────── */
  function vistaJuego(contenedor, id) {
    var def = Arcade.juegos[id];

    if (!def) {
      contenedor.innerHTML =
        '<section class="estado-vacio vidrio">' +
          '<h1 class="seccion-titulo">Ese juego todavía no está listo</h1>' +
          '<p class="texto-suave">Vuelve al inicio para ver los juegos disponibles.</p>' +
          '<a class="btn btn-primario" href="#/inicio">Ir al inicio</a>' +
        '</section>';
      return;
    }

    var difs = (def.dificultades && def.dificultades.length)
      ? def.dificultades
      : [{ id: 'normal', nombre: 'Normal' }];

    var guardada = leerPartidaGuardada();
    var difInicial = (guardada && guardada.juegoId === id && guardada.dificultad)
      ? guardada.dificultad
      : (def.dificultadPorDefecto || difs[0].id);

    var existe = difs.some(function (d) { return d.id === difInicial; });
    if (!existe) difInicial = difs[0].id;

    var opciones = difs.map(function (d) {
      return '<option value="' + esc(d.id) + '"' + (d.id === difInicial ? ' selected' : '') + '>' +
        esc(d.nombre) + '</option>';
    }).join('');

    contenedor.innerHTML =
      '<div class="pantalla-juego">' +
        '<header class="barra-juego vidrio">' +
          '<a class="btn-icono" href="#/inicio" aria-label="Volver al inicio">' + svgIcono('volver') + '</a>' +
          '<h1 class="titulo-juego">' + esc(def.nombre) + '</h1>' +
          '<label class="oculto" for="sel-dificultad">Dificultad</label>' +
          '<select id="sel-dificultad" class="selector">' + opciones + '</select>' +
          '<button type="button" class="btn-icono" id="btn-pausa" aria-label="Pausar">' + svgIcono('pausa') + '</button>' +
          '<button type="button" class="btn-icono" id="btn-nueva" aria-label="Nueva partida">' + svgIcono('reiniciar') + '</button>' +
        '</header>' +
        '<div class="area-juego" id="area-juego">' +
          '<div class="pausa-capa" id="pausa-capa" hidden>' +
            '<div class="pausa-panel vidrio">' +
              '<p class="pausa-titulo">En pausa</p>' +
              '<button type="button" class="btn btn-primario" id="btn-reanudar">Reanudar</button>' +
            '</div>' +
          '</div>' +
          '<div class="juego-root" id="juego-root"></div>' +
        '</div>' +
      '</div>';

    var root = $('#juego-root', contenedor);
    var selDif = $('#sel-dificultad', contenedor);
    var btnPausa = $('#btn-pausa', contenedor);
    var btnNueva = $('#btn-nueva', contenedor);
    var btnReanudar = $('#btn-reanudar', contenedor);
    var capaPausa = $('#pausa-capa', contenedor);

    estadoApp.juego = def;
    estadoApp.juegoId = id;
    estadoApp.dificultad = difInicial;
    estadoApp.pausado = false;
    estadoApp.partidaTerminada = false;

    var ctx = crearCtx(def);
    estadoApp.ctx = ctx;

    try {
      def.mount(root, ctx);
    } catch (e) {
      root.innerHTML = '<p class="aviso">Este juego no pudo cargarse. Prueba con otra partida.</p>';
    }

    /* Restaurar o empezar de cero */
    var restaurada = false;
    if (guardada && guardada.juegoId === id && guardada.estado && typeof def.restaurar === 'function') {
      try {
        def.restaurar(guardada.estado);
        restaurada = true;
      } catch (e) {
        restaurada = false;
      }
    }

    if (!restaurada) {
      try {
        if (typeof def.nuevaPartida === 'function') def.nuevaPartida(difInicial);
      } catch (e) { /* el juego decide */ }
    } else {
      toast('Partida recuperada');
    }

    guardarUltimaDificultad(id, difInicial);
    iniciarAutoguardado();

    /* Selector de dificultad */
    if (selDif) {
      selDif.addEventListener('change', function () {
        var nueva = selDif.value;
        estadoApp.dificultad = nueva;
        estadoApp.partidaTerminada = false;
        estadoApp.pausado = false;
        if (capaPausa) capaPausa.hidden = true;
        actualizarBotonPausa();
        guardarUltimaDificultad(id, nueva);
        try {
          if (typeof def.nuevaPartida === 'function') def.nuevaPartida(nueva);
        } catch (e) { /* el juego decide */ }
        sfx('toque');
      });
    }

    if (btnPausa) {
      btnPausa.addEventListener('click', function () {
        alternarPausa();
      });
    }

    if (btnNueva) {
      btnNueva.addEventListener('click', function () {
        nuevaPartidaActual();
        sfx('toque');
        toast('Partida nueva');
      });
    }

    if (btnReanudar) {
      btnReanudar.addEventListener('click', function () {
        alternarPausa(false);
      });
    }
  }

  /* ───────────────────────────  Vista: récords  ─────────────────────────── */
  function dificultadesPara(def, porDif) {
    if (def && def.dificultades && def.dificultades.length) return def.dificultades.slice();
    var ids = porDif ? Object.keys(porDif) : [];
    return ids.map(function (id) { return { id: id, nombre: id }; });
  }

  function vistaRecords(contenedor) {
    var recs = leerRecords();

    var h = '<section class="records">';
    h += '<header class="seccion-cabecera">';
    h += '<h1 class="seccion-titulo">Récords</h1>';
    h += '<p class="texto-suave">Tus mejores marcas, guardadas en este dispositivo.</p>';
    h += '</header>';
    h += '<div class="lista-records">';

    (CFG.JUEGOS || []).forEach(function (entrada) {
      var def = Arcade.juegos[entrada.id];
      var nombre = def ? def.nombre : (entrada.nombre || entrada.id);
      var porDif = recs[entrada.id] || {};
      var difs = dificultadesPara(def, porDif);

      h += '<article class="panel-records vidrio">';
      h += '<h2>' + esc(nombre) + '</h2>';

      if (!difs.length) {
        h += '<p class="vacio-panel">Todavía no hay partidas jugadas.</p>';
      } else {
        difs.forEach(function (d) {
          var r = porDif[d.id] || registroVacio();
          h += '<div class="fila-record">';
          h += '<span class="fila-dif">' + esc(d.nombre || d.id) + '</span>';
          h += '<span class="dato"><b>' + (r.mejorTiempoMs !== null ? formatoTiempo(r.mejorTiempoMs) : '—') + '</b><small>Mejor tiempo</small></span>';
          h += '<span class="dato"><b>' + (r.mejorPuntaje !== null ? r.mejorPuntaje : '—') + '</b><small>Mejor puntaje</small></span>';
          h += '<span class="dato"><b>' + r.jugadas + '</b><small>Jugadas</small></span>';
          h += '<span class="dato"><b>' + r.ganadas + '</b><small>Ganadas</small></span>';
          h += '</div>';
        });
      }

      h += '</article>';
    });

    h += '</div></section>';
    contenedor.innerHTML = h;
  }

  /* ───────────────────────────  Vista: ajustes  ─────────────────────────── */
  function filaSegmento(titulo, ayuda, clave, opciones, valorActual) {
    var h = '<div class="ajuste">';
    h += '<div class="ajuste-texto"><span>' + esc(titulo) + '</span><small>' + esc(ayuda) + '</small></div>';
    h += '<div class="segmento" role="group" aria-label="' + esc(titulo) + '">';
    opciones.forEach(function (o) {
      h += '<button type="button" data-clave="' + esc(clave) + '" data-valor="' + esc(o.valor) + '" ' +
        'aria-pressed="' + (o.valor === valorActual ? 'true' : 'false') + '">' + esc(o.texto) + '</button>';
    });
    h += '</div></div>';
    return h;
  }

  function filaInterruptor(titulo, ayuda, clave, activo) {
    var h = '<div class="ajuste">';
    h += '<div class="ajuste-texto"><span>' + esc(titulo) + '</span><small>' + esc(ayuda) + '</small></div>';
    h += '<button type="button" class="interruptor" role="switch" data-clave="' + esc(clave) + '" ' +
      'aria-checked="' + (activo ? 'true' : 'false') + '" aria-label="' + esc(titulo) + '"></button>';
    h += '</div>';
    return h;
  }

  function vistaAjustes(contenedor) {
    var h = '<section class="ajustes">';
    h += '<header class="seccion-cabecera">';
    h += '<h1 class="seccion-titulo">Ajustes</h1>';
    h += '<p class="texto-suave">Todo se guarda en este dispositivo.</p>';
    h += '</header>';

    h += '<div class="panel-ajustes vidrio">';
    h += filaSegmento('Tema', 'Cómo se ve el sitio', 'tema', [
      { valor: 'claro', texto: 'Claro' },
      { valor: 'noche', texto: 'Noche' },
      { valor: 'auto', texto: 'Automático' }
    ], ajustesCrudos.tema);
    h += filaInterruptor('Sonido', 'Efectos al jugar', 'sonido', ajustesCrudos.sonido);
    h += filaInterruptor('Vibración', 'En móviles compatibles', 'vibracion', ajustesCrudos.vibracion);
    h += filaSegmento('Movimiento reducido', 'Menos animaciones', 'movimientoReducido', [
      { valor: 'auto', texto: 'Automático' },
      { valor: 'si', texto: 'Sí' },
      { valor: 'no', texto: 'No' }
    ], ajustesCrudos.movimientoReducido);
    h += '</div>';

    h += '<div class="panel-peligro vidrio">';
    h += '<div><h2>Borrar mis datos</h2><p>Se borran los récords, las partidas guardadas y tus preferencias.</p></div>';
    h += '<button type="button" class="btn btn-peligro" id="btn-borrar">Borrar mis datos</button>';
    h += '</div>';

    h += '</section>';
    contenedor.innerHTML = h;

    /* Segmentos */
    $$('.segmento button', contenedor).forEach(function (b) {
      b.addEventListener('click', function () {
        var clave = b.getAttribute('data-clave');
        var valor = b.getAttribute('data-valor');
        ajustesCrudos[clave] = valor;

        var grupo = b.parentNode;
        $$('button', grupo).forEach(function (x) {
          x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
        });

        guardarAjustes();
        recalcularAjustes();
        avisarAjustes();
        sfx('toque');
      });
    });

    /* Interruptores */
    $$('.interruptor', contenedor).forEach(function (b) {
      b.addEventListener('click', function () {
        var clave = b.getAttribute('data-clave');
        var nuevo = b.getAttribute('aria-checked') !== 'true';
        ajustesCrudos[clave] = nuevo;
        b.setAttribute('aria-checked', nuevo ? 'true' : 'false');
        guardarAjustes();
        recalcularAjustes();
        avisarAjustes();
        if (clave === 'sonido' && nuevo) sfx('ok');
        if (clave === 'vibracion' && nuevo) vibrar(30);
      });
    });

    /* Borrar datos con confirmación */
    var btnBorrar = $('#btn-borrar', contenedor);
    if (btnBorrar) {
      btnBorrar.addEventListener('click', function () {
        abrirModal({
          titulo: 'Borrar mis datos',
          detalle: 'Se borrarán los récords, las partidas guardadas y tus preferencias. No se puede deshacer.',
          acciones: [
            { texto: 'Cancelar', accion: cerrarModal },
            {
              texto: 'Borrar todo',
              primario: true,
              accion: function () {
                almacen.borrarTodo();
                ajustesCrudos = { tema: 'auto', sonido: false, vibracion: true, movimientoReducido: 'auto' };
                recalcularAjustes();
                avisarAjustes();
                cerrarModal();
                toast('Datos borrados');
                navegar();
              }
            }
          ]
        });
      });
    }
  }

  /* ───────────────────────────  Eventos globales  ─────────────────────────── */
  function conectarEventosGlobales() {
    window.addEventListener('hashchange', navegar);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modalActual) {
        cerrarModal();
      }
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden && estadoApp.juego) {
        guardarPartida();
        alternarPausa(true);
      }
    });

    window.addEventListener('pagehide', function () {
      if (estadoApp.juego) guardarPartida();
    });

    var btnTema = $('#btn-tema');
    if (btnTema) btnTema.addEventListener('click', alternarTema);

    /* Preferencias del sistema en vivo */
    var oscuro = mq('(prefers-color-scheme: dark)');
    if (oscuro && oscuro.addEventListener) {
      oscuro.addEventListener('change', function () {
        if (ajustesCrudos.tema === 'auto') {
          recalcularAjustes();
          avisarAjustes();
          if (estadoApp.vista === 'ajustes') navegar();
        }
      });
    }

    var quieto = mq('(prefers-reduced-motion: reduce)');
    if (quieto && quieto.addEventListener) {
      quieto.addEventListener('change', function () {
        if (ajustesCrudos.movimientoReducido === 'auto') {
          recalcularAjustes();
          avisarAjustes();
        }
      });
    }
  }

  /* ───────────────────────────  Arranque  ─────────────────────────── */
  function iniciar() {
    cargarAjustes();
    renderNav();

    var marca = $('#marca-texto');
    if (marca) marca.textContent = CFG.NOMBRE_SITIO || 'Juegos';

    var pie = $('#pie');
    if (pie) pie.textContent = CFG.FIRMA || '';

    conectarEventosGlobales();
    navegar();
  }

  if (document.readyState === 'complete') {
    iniciar();
  } else {
    document.addEventListener('DOMContentLoaded', iniciar);
  }
})();
