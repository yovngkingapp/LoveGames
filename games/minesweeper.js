/* games/minesweeper.js — Buscaminas clásico, minas tras el primer clic. */
(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  //  Constantes
  // ═══════════════════════════════════════════════════════════════════

  var DIFICULTADES = {
    principiante: { id: 'principiante', nombre: 'Principiante', cols: 9, filas: 9, minas: 10 },
    intermedio: { id: 'intermedio', nombre: 'Intermedio', cols: 16, filas: 16, minas: 40 },
    experto: { id: 'experto', nombre: 'Experto', cols: 30, filas: 16, minas: 99 }
  };

  var CERRADA = 0, ABIERTA = 1, BANDERA = 2, DUDA = 3;

  var SVG_MINA = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M12 3 L13.8 10.2 L21 12 L13.8 13.8 L12 21 L10.2 13.8 L3 12 L10.2 10.2 Z" fill="currentColor"/>' +
    '</svg>';

  var SVG_BANDERA = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M7 3 v18" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>' +
    '<path d="M7 4 h9 l-2 3 2 3 H7 Z" fill="currentColor"/>' +
    '</svg>';

  // ═══════════════════════════════════════════════════════════════════
  //  Estado del módulo
  // ═══════════════════════════════════════════════════════════════════

  var ctxRef = null;
  var rootRef = null;
  var celdasDOM = [];
  var intervaloCronometro = null;
  var resizeListener = null;
  var tecladoConectado = false;
  var lp = { timer: null, resetTimer: null, startX: 0, startY: 0, consumed: false, ultimo: 0 };

  var S = {
    dificultad: 'principiante',
    cols: 9, filas: 9, minas: 10,
    tablero: null,
    estado: null,
    primeraJugada: false,
    perdido: false,
    ganado: false,
    minaPisada: -1,
    banderas: 0,
    abiertas: 0,
    tamCelda: 32,
    transposicion: false,
    seleccionada: -1,
    tiempoMs: 0,
    iniciadoEn: null,
    ajustes: { apertura: false, marcas: false, modoBandera: false }
  };

  // ═══════════════════════════════════════════════════════════════════
  //  Utilidades
  // ═══════════════════════════════════════════════════════════════════

  function formatearTiempo(ms) {
    if (typeof ms !== 'number' || !isFinite(ms) || ms < 0) return '00:00';
    var s = Math.floor(ms / 1000) % 60;
    var m = Math.floor(ms / 60000) % 60;
    var h = Math.floor(ms / 3600000);
    function dos(n) { return (n < 10 ? '0' : '') + n; }
    if (h > 0) return h + ':' + dos(m) + ':' + dos(s);
    return dos(m) + ':' + dos(s);
  }

  function vecinosDe(i) {
    var f = Math.floor(i / S.cols), c = i % S.cols;
    var vs = [];
    for (var df = -1; df <= 1; df++) {
      for (var dc = -1; dc <= 1; dc++) {
        if (df === 0 && dc === 0) continue;
        var nf = f + df, nc = c + dc;
        if (nf >= 0 && nf < S.filas && nc >= 0 && nc < S.cols) vs.push(nf * S.cols + nc);
      }
    }
    return vs;
  }

  function calcularTransposicion() {
    if (S.dificultad !== 'experto') return false;
    try {
      return !!(window.matchMedia && window.matchMedia('(max-width: 639px) and (orientation: portrait)').matches);
    } catch (e) { return false; }
  }

  function visualCols() { return S.transposicion ? S.filas : S.cols; }
  function visualFilas() { return S.transposicion ? S.cols : S.filas; }

  function indiceLogico(vr, vc) {
    if (S.transposicion) return vc * S.cols + vr;
    return vr * S.cols + vc;
  }

  function posVisual(i) {
    var lr = Math.floor(i / S.cols), lc = i % S.cols;
    if (S.transposicion) return { vr: lc, vc: lr };
    return { vr: lr, vc: lc };
  }

  function icono(nombre) {
    var svg = (ctxRef && ctxRef.iconos && ctxRef.iconos[nombre]) || '';
    return '<span class="ico" aria-hidden="true">' + svg + '</span>';
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Cronómetro
  // ═══════════════════════════════════════════════════════════════════

  function leerTiempo() {
    if (S.iniciadoEn !== null) return Date.now() - S.iniciadoEn;
    return S.tiempoMs;
  }

  function iniciarCronometro() {
    detenerCronometro();
    S.iniciadoEn = Date.now() - S.tiempoMs;
    intervaloCronometro = setInterval(actualizarReloj, 300);
    actualizarReloj();
  }

  function detenerCronometro() {
    if (S.iniciadoEn !== null) {
      S.tiempoMs = Date.now() - S.iniciadoEn;
      S.iniciadoEn = null;
    }
    if (intervaloCronometro) {
      clearInterval(intervaloCronometro);
      intervaloCronometro = null;
    }
  }

  function actualizarReloj() {
    if (!rootRef) return;
    var el = rootRef.querySelector('#msw-tiempo');
    if (el) el.textContent = formatearTiempo(leerTiempo());
  }

  // ═══════════════════════════════════════════════════════════════════
  //  CSS del juego
  // ═══════════════════════════════════════════════════════════════════

  var CSS_MSW = [
    '.msw-wrap{display:flex;flex-direction:column;gap:10px;width:100%;max-width:100%;align-items:center;padding:4px;}',
    '.msw-wrap [hidden]{display:none!important;}',
    '.msw-top{display:flex;gap:8px;align-items:center;justify-content:space-between;width:100%;max-width:100%;flex-wrap:wrap;}',
    '.msw-panel{display:flex;gap:8px;align-items:center;padding:8px 14px;border-radius:var(--r-control);background:var(--vidrio-fondo-fuerte);border:1px solid var(--vidrio-borde);font-variant-numeric:tabular-nums;font-family:var(--fuente-titulo);font-weight:700;font-size:1.05rem;color:var(--tinta);min-height:44px;}',
    '.msw-panel .ico{color:var(--tinta-suave);}',
    '.msw-acciones{display:flex;gap:6px;flex-wrap:wrap;align-items:center;justify-content:center;}',
    '.msw-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-width:44px;min-height:44px;padding:0 12px;border-radius:var(--r-control);border:1px solid var(--vidrio-borde);background:var(--vidrio-fondo-fuerte);color:var(--tinta);font-family:inherit;font-size:.9rem;font-weight:600;cursor:pointer;transition:background 100ms ease;}',
    '.msw-btn:hover:not(:disabled){background:var(--capa-fuerte);}',
    '.msw-btn:disabled{opacity:.35;cursor:not-allowed;}',
    '.msw-btn.activo{background:var(--musgo);color:#F6F9F7;border-color:transparent;}',
    '.msw-btn.activo .ico{color:#F6F9F7;}',
    '.msw-board-wrap{max-width:100%;max-height:70dvh;overflow:auto;padding:8px;border-radius:var(--r-control);background:var(--capa-suave);border:1px solid var(--vidrio-borde);-webkit-overflow-scrolling:touch;}',
    '.msw-board{--msw-tam:32px;display:grid;gap:1px;user-select:none;-webkit-user-select:none;touch-action:manipulation;margin:0 auto;width:max-content;}',
    '.msw-celda{width:var(--msw-tam);height:var(--msw-tam);display:grid;place-items:center;font-family:var(--fuente-titulo);font-weight:700;font-size:calc(var(--msw-tam) * .42);line-height:1;cursor:pointer;border-radius:3px;background:var(--piedra);color:var(--tinta);box-shadow:inset 1px 1px 0 rgba(255,255,255,.5),inset -1px -1px 0 rgba(0,0,0,.12);padding:0;border:0;}',
    'html[data-tema="noche"] .msw-celda{background:var(--piedra-oscura);box-shadow:inset 1px 1px 0 rgba(255,255,255,.14),inset -1px -1px 0 rgba(0,0,0,.35);color:var(--tinta);}',
    '.msw-celda:hover:not(.abierta):not(.mina):not(.mina-pisada):not(.bandera-mala){background:var(--niebla);}',
    'html[data-tema="noche"] .msw-celda:hover:not(.abierta):not(.mina):not(.mina-pisada):not(.bandera-mala){background:var(--piedra);}',
    '.msw-celda.abierta{background:var(--niebla-2);box-shadow:inset 0 0 0 1px var(--piedra-oscura);cursor:default;}',
    'html[data-tema="noche"] .msw-celda.abierta{background:var(--niebla);box-shadow:inset 0 0 0 1px var(--musgo);}',
    '.msw-celda.abierta:hover{background:var(--niebla-2);}',
    'html[data-tema="noche"] .msw-celda.abierta:hover{background:var(--niebla);}',
    '.msw-celda.foco{outline:2px solid var(--musgo);outline-offset:-2px;position:relative;z-index:1;}',
    'html[data-tema="noche"] .msw-celda.foco{outline-color:#9FD6BE;}',
    '.msw-celda .msw-num{font-weight:700;font-size:inherit;line-height:1;}',
    '.msw-celda.num-1 .msw-num{color:color-mix(in srgb, var(--azul) 55%, #000);}',
    '.msw-celda.num-2 .msw-num{color:color-mix(in srgb, var(--verde) 55%, #000);}',
    '.msw-celda.num-3 .msw-num{color:color-mix(in srgb, var(--rosa) 60%, #000);}',
    '.msw-celda.num-4 .msw-num{color:var(--musgo);}',
    '.msw-celda.num-5 .msw-num{color:color-mix(in srgb, var(--ambar) 55%, #000);}',
    '.msw-celda.num-6 .msw-num{color:color-mix(in srgb, var(--vidrio-mar) 55%, #000);}',
    '.msw-celda.num-7 .msw-num{color:var(--tinta);}',
    '.msw-celda.num-8 .msw-num{color:var(--tinta-suave);}',
    'html[data-tema="noche"] .msw-celda.num-1 .msw-num{color:color-mix(in srgb, var(--azul) 55%, #fff);}',
    'html[data-tema="noche"] .msw-celda.num-2 .msw-num{color:color-mix(in srgb, var(--verde) 50%, #fff);}',
    'html[data-tema="noche"] .msw-celda.num-3 .msw-num{color:color-mix(in srgb, var(--rosa) 55%, #fff);}',
    'html[data-tema="noche"] .msw-celda.num-4 .msw-num{color:color-mix(in srgb, var(--musgo) 45%, #fff);}',
    'html[data-tema="noche"] .msw-celda.num-5 .msw-num{color:color-mix(in srgb, var(--ambar) 65%, #fff);}',
    'html[data-tema="noche"] .msw-celda.num-6 .msw-num{color:color-mix(in srgb, var(--vidrio-mar) 55%, #fff);}',
    'html[data-tema="noche"] .msw-celda.num-7 .msw-num{color:var(--tinta);}',
    'html[data-tema="noche"] .msw-celda.num-8 .msw-num{color:var(--tinta-suave);}',
    '.msw-celda.con-bandera{color:var(--tinta);}',
    '.msw-celda.con-duda{color:var(--tinta-suave);}',
    '.msw-celda svg{width:70%;height:70%;display:block;}',
    '.msw-celda.mina{background:var(--rosa-ceniza);color:var(--tinta);}',
    'html[data-tema="noche"] .msw-celda.mina{background:color-mix(in srgb, var(--rosa-ceniza) 60%, var(--niebla-2));color:var(--tinta);}',
    '.msw-celda.mina-pisada{background:var(--error);color:#FFF;}',
    '.msw-celda.bandera-mala{background:var(--error);color:#FFF;}',
    '.msw-ajustes{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;width:100%;}',
    '.msw-ajuste{min-height:36px;padding:6px 14px;border-radius:var(--r-pastilla);border:1px solid var(--vidrio-borde);background:var(--capa-suave);color:var(--tinta-suave);font-family:inherit;font-size:.82rem;font-weight:500;cursor:pointer;}',
    '.msw-ajuste.activo{background:var(--musgo);color:var(--niebla-2);border-color:transparent;}',
    'html[data-tema="noche"] .msw-ajuste.activo{color:#F6F9F7;}',
    '@media (max-width:520px){.msw-panel{padding:6px 10px;font-size:.95rem;min-height:40px;}.msw-btn{min-height:40px;padding:0 10px;font-size:.85rem;}.msw-board-wrap{max-height:65dvh;}}'
  ].join('\n');

  // ═══════════════════════════════════════════════════════════════════
  //  Construcción de la interfaz
  // ═══════════════════════════════════════════════════════════════════

  function construirEstructura(root) {
    root.innerHTML = '';

    var wrap = document.createElement('div');
    wrap.className = 'msw-wrap';

    // Barra superior
    var top = document.createElement('div');
    top.className = 'msw-top';
    top.innerHTML =
      '<div class="msw-panel" aria-label="Minas restantes">' +
        icono('bandera') +
        '<b id="msw-contador" class="tnum">10</b>' +
      '</div>' +
      '<div class="msw-acciones">' +
        '<button type="button" class="msw-btn" data-accion="modo" aria-pressed="false" aria-label="Modo bandera">' + icono('bandera') + '</button>' +
        '<button type="button" class="msw-btn" data-accion="nueva" aria-label="Nueva partida">' + icono('reiniciar') + '</button>' +
        '<button type="button" class="msw-btn" data-accion="alejar" aria-label="Alejar">' + icono('alejar') + '</button>' +
        '<button type="button" class="msw-btn" data-accion="acercar" aria-label="Acercar">' + icono('acercar') + '</button>' +
      '</div>' +
      '<div class="msw-panel" aria-label="Tiempo">' +
        '<b id="msw-tiempo" class="tnum">00:00</b>' +
      '</div>';
    wrap.appendChild(top);

    // Tablero
    var boardWrap = document.createElement('div');
    boardWrap.className = 'msw-board-wrap';
    var board = document.createElement('div');
    board.className = 'msw-board';
    board.setAttribute('role', 'grid');
    board.setAttribute('aria-label', 'Tablero de buscaminas');
    boardWrap.appendChild(board);
    wrap.appendChild(boardWrap);

    // Ajustes
    var ajustes = document.createElement('div');
    ajustes.className = 'msw-ajustes';
    ajustes.innerHTML =
      '<button type="button" class="msw-ajuste" data-clave="apertura" aria-pressed="false">Primer clic con apertura</button>' +
      '<button type="button" class="msw-ajuste" data-clave="marcas" aria-pressed="false">Marcas ?</button>';
    wrap.appendChild(ajustes);

    root.appendChild(wrap);
    rootRef = root;
  }

  // ─── Render del tablero ───
  function renderTablero() {
    var board = rootRef.querySelector('.msw-board');
    if (!board) return;
    board.innerHTML = '';
    var total = S.cols * S.filas;
    celdasDOM = new Array(total);

    var vc = visualCols(), vf = visualFilas();
    board.style.gridTemplateColumns = 'repeat(' + vc + ', var(--msw-tam))';
    board.style.setProperty('--msw-tam', S.tamCelda + 'px');

    for (var vr = 0; vr < vf; vr++) {
      for (var c2 = 0; c2 < vc; c2++) {
        var i = indiceLogico(vr, c2);
        var el = document.createElement('div');
        el.className = 'msw-celda';
        el.setAttribute('role', 'gridcell');
        el.setAttribute('data-i', i);
        el.setAttribute('tabindex', '-1');
        board.appendChild(el);
        celdasDOM[i] = el;
      }
    }
  }

  // ─── Actualización de una celda ───
  function actualizarCeldaDOM(i) {
    var el = celdasDOM[i];
    if (!el) return;
    var est = S.estado ? S.estado[i] : CERRADA;
    var f = Math.floor(i / S.cols) + 1;
    var c = (i % S.cols) + 1;
    var baseLabel = 'Fila ' + f + ', columna ' + c;

    el.className = 'msw-celda';
    if (i === S.seleccionada) el.classList.add('foco');

    // Si la partida está perdida, mostrar el tablero completo
    if (S.perdido && S.tablero) {
      if (i === S.minaPisada) {
        el.classList.add('mina-pisada');
        el.innerHTML = SVG_MINA;
        el.setAttribute('aria-label', baseLabel + ', mina pisada');
        return;
      }
      if (S.tablero[i] === -1 && est !== BANDERA) {
        el.classList.add('mina');
        el.innerHTML = SVG_MINA;
        el.setAttribute('aria-label', baseLabel + ', mina');
        return;
      }
      if (S.tablero[i] !== -1 && est === BANDERA) {
        el.classList.add('bandera-mala');
        el.innerHTML = SVG_BANDERA;
        el.setAttribute('aria-label', baseLabel + ', bandera incorrecta');
        return;
      }
    }

    if (est === ABIERTA) {
      el.classList.add('abierta');
      var v = S.tablero ? S.tablero[i] : 0;
      if (v === -1) {
        el.classList.add('mina');
        el.innerHTML = SVG_MINA;
        el.setAttribute('aria-label', baseLabel + ', mina');
      } else if (v > 0) {
        el.classList.add('num-' + v);
        el.innerHTML = '<span class="msw-num">' + v + '</span>';
        el.setAttribute('aria-label', baseLabel + ', ' + v);
      } else {
        el.setAttribute('aria-label', baseLabel + ', vacía');
      }
      return;
    }
    if (est === BANDERA) {
      el.classList.add('con-bandera');
      el.innerHTML = SVG_BANDERA;
      el.setAttribute('aria-label', baseLabel + ', con bandera');
      return;
    }
    if (est === DUDA) {
      el.classList.add('con-duda');
      el.innerHTML = '<span class="msw-num">?</span>';
      el.setAttribute('aria-label', baseLabel + ', con duda');
      return;
    }
    el.setAttribute('aria-label', baseLabel + ', cerrada');
  }

  function actualizarTodo() {
    if (!S.estado) return;
    for (var i = 0; i < S.estado.length; i++) actualizarCeldaDOM(i);
    actualizarContador();
    actualizarBotones();
  }

  function actualizarContador() {
    if (!rootRef) return;
    var el = rootRef.querySelector('#msw-contador');
    if (el) el.textContent = String(S.minas - S.banderas);
  }

  function actualizarBotones() {
    if (!rootRef) return;
    var bModo = rootRef.querySelector('[data-accion="modo"]');
    if (bModo) {
      bModo.classList.toggle('activo', S.ajustes.modoBandera);
      bModo.setAttribute('aria-pressed', S.ajustes.modoBandera ? 'true' : 'false');
      bModo.setAttribute('aria-label', S.ajustes.modoBandera ? 'Modo revelar' : 'Modo bandera');
    }
    var bAlejar = rootRef.querySelector('[data-accion="alejar"]');
    var bAcercar = rootRef.querySelector('[data-accion="acercar"]');
    if (bAlejar) bAlejar.disabled = S.tamCelda <= 22;
    if (bAcercar) bAcercar.disabled = S.tamCelda >= 44;
    var aAp = rootRef.querySelector('.msw-ajuste[data-clave="apertura"]');
    var aMa = rootRef.querySelector('.msw-ajuste[data-clave="marcas"]');
    if (aAp) {
      aAp.classList.toggle('activo', S.ajustes.apertura);
      aAp.setAttribute('aria-pressed', S.ajustes.apertura ? 'true' : 'false');
    }
    if (aMa) {
      aMa.classList.toggle('activo', S.ajustes.marcas);
      aMa.setAttribute('aria-pressed', S.ajustes.marcas ? 'true' : 'false');
    }
  }

  function actualizarSeleccion(anterior, actual) {
    if (anterior >= 0 && celdasDOM[anterior]) celdasDOM[anterior].classList.remove('foco');
    if (actual >= 0 && celdasDOM[actual]) {
      celdasDOM[actual].classList.add('foco');
      try { celdasDOM[actual].scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) { /* nada */ }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Lógica del juego
  // ═══════════════════════════════════════════════════════════════════

  function colocarMinas(excluirIdx, excluirVecinos) {
    var total = S.cols * S.filas;
    var excluir = {};
    excluir[excluirIdx] = true;
    if (excluirVecinos) {
      var vs = vecinosDe(excluirIdx);
      for (var k = 0; k < vs.length; k++) excluir[vs[k]] = true;
    }

    var candidatos = [];
    for (var i = 0; i < total; i++) if (!excluir[i]) candidatos.push(i);

    for (var k2 = candidatos.length - 1; k2 > 0; k2--) {
      var j = Math.floor(Math.random() * (k2 + 1));
      var t = candidatos[k2]; candidatos[k2] = candidatos[j]; candidatos[j] = t;
    }

    var minas = Math.min(S.minas, candidatos.length);
    for (var m = 0; m < minas; m++) S.tablero[candidatos[m]] = -1;

    for (var i2 = 0; i2 < total; i2++) {
      if (S.tablero[i2] === -1) continue;
      var count = 0;
      var vs2 = vecinosDe(i2);
      for (var k3 = 0; k3 < vs2.length; k3++) if (S.tablero[vs2[k3]] === -1) count++;
      S.tablero[i2] = count;
    }
  }

  function revelarCascada(idx) {
    var pila = [idx];
    while (pila.length) {
      var i = pila.pop();
      if (S.estado[i] === ABIERTA || S.estado[i] === BANDERA) continue;
      S.estado[i] = ABIERTA;
      S.abiertas++;
      actualizarCeldaDOM(i);
      if (S.tablero[i] === 0) {
        var vs = vecinosDe(i);
        for (var k = 0; k < vs.length; k++) {
          var n = vs[k];
          if (S.estado[n] !== ABIERTA && S.estado[n] !== BANDERA) pila.push(n);
        }
      }
    }
  }

  function revelar(idx) {
    if (S.perdido || S.ganado || !S.tablero) return;
    if (S.estado[idx] === ABIERTA || S.estado[idx] === BANDERA) return;

    if (!S.primeraJugada) {
      S.primeraJugada = true;
      colocarMinas(idx, S.ajustes.apertura);
      iniciarCronometro();
    }

    if (S.tablero[idx] === -1) {
      S.perdido = true;
      S.minaPisada = idx;
      S.estado[idx] = ABIERTA;
      S.abiertas++;
      detenerCronometro();
      finalizarDerrota();
      return;
    }

    revelarCascada(idx);
    comprobarVictoria();
  }

  function chord(idx) {
    if (S.perdido || S.ganado) return;
    if (S.estado[idx] !== ABIERTA) return;
    var num = S.tablero[idx];
    if (num <= 0) return;
    var vs = vecinosDe(idx);
    var flags = 0;
    for (var k = 0; k < vs.length; k++) if (S.estado[vs[k]] === BANDERA) flags++;
    if (flags !== num) return;

    for (var k2 = 0; k2 < vs.length; k2++) {
      var n = vs[k2];
      if (S.estado[n] === BANDERA || S.estado[n] === ABIERTA) continue;
      if (S.tablero[n] === -1) {
        S.perdido = true;
        S.minaPisada = n;
        S.estado[n] = ABIERTA;
        S.abiertas++;
        detenerCronometro();
        finalizarDerrota();
        return;
      }
      revelarCascada(n);
    }
    comprobarVictoria();
  }

  function toggleBandera(idx) {
    if (S.perdido || S.ganado || !S.estado) return;
    if (S.estado[idx] === ABIERTA) return;

    if (S.estado[idx] === CERRADA) {
      S.estado[idx] = BANDERA;
      S.banderas++;
    } else if (S.estado[idx] === BANDERA) {
      if (S.ajustes.marcas) {
        S.estado[idx] = DUDA;
      } else {
        S.estado[idx] = CERRADA;
      }
      S.banderas--;
    } else if (S.estado[idx] === DUDA) {
      S.estado[idx] = CERRADA;
    }

    actualizarCeldaDOM(idx);
    actualizarContador();
    ctxRef.sfx('toque');
    try { if (ctxRef.ajustes.vibracion && navigator.vibrate) navigator.vibrate(20); } catch (e) { /* nada */ }
  }

  function clickCelda(idx) {
    if (S.perdido || S.ganado) return;

    var est = S.estado[idx];
    if (est === ABIERTA) { chord(idx); return; }
    if (S.ajustes.modoBandera) { toggleBandera(idx); return; }
    revelar(idx);
  }

  function comprobarVictoria() {
    if (S.ganado || S.perdido) return;
    if (S.abiertas === S.cols * S.filas - S.minas) {
      S.ganado = true;
      detenerCronometro();
      for (var i = 0; i < S.cols * S.filas; i++) {
        if (S.tablero[i] === -1 && S.estado[i] !== BANDERA) {
          S.estado[i] = BANDERA;
          S.banderas++;
          actualizarCeldaDOM(i);
        }
      }
      actualizarContador();
      ctxRef.sfx('victoria');
      var ms = leerTiempo();
      ctxRef.reportar({ tipo: 'victoria', dificultad: S.dificultad, tiempoMs: ms });
      ctxRef.celebrar({
        titulo: 'Tablero despejado',
        detalle: 'Tiempo: ' + formatearTiempo(ms)
      });
    }
  }

  function finalizarDerrota() {
    var ms = leerTiempo();
    actualizarTodo();
    ctxRef.sfx('derrota');
    try { if (ctxRef.ajustes.vibracion && navigator.vibrate) navigator.vibrate([40, 40, 40]); } catch (e) { /* nada */ }
    ctxRef.toast('Pisaste una mina. Toca Nueva partida para intentarlo otra vez.');
    ctxRef.reportar({ tipo: 'derrota', dificultad: S.dificultad, tiempoMs: ms });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Ajustes
  // ═══════════════════════════════════════════════════════════════════

  function guardarAjustes() {
    if (!ctxRef) return;
    ctxRef.guardar('ajustes', {
      apertura: S.ajustes.apertura,
      marcas: S.ajustes.marcas,
      modoBandera: S.ajustes.modoBandera
    });
  }

  function cargarAjustes() {
    if (!ctxRef) return;
    var g = ctxRef.leer('ajustes', null);
    if (g) {
      S.ajustes.apertura = !!g.apertura;
      S.ajustes.marcas = !!g.marcas;
      // modoBandera es de la sesión: siempre arranca apagado.
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Serialización
  // ═══════════════════════════════════════════════════════════════════

  function serializar() {
    if (!S.primeraJugada || S.perdido || S.ganado) return null;
    return {
      v: 1,
      dificultad: S.dificultad,
      tablero: Array.from(S.tablero),
      estado: Array.from(S.estado),
      banderas: S.banderas,
      abiertas: S.abiertas,
      tiempoMs: leerTiempo(),
      ajustes: { apertura: S.ajustes.apertura, marcas: S.ajustes.marcas }
    };
  }

  function restaurar(estado) {
    if (!estado || !estado.tablero || !estado.estado) {
      iniciarNueva(S.dificultad || 'principiante');
      return false;
    }
    try {
      var conf = DIFICULTADES[estado.dificultad];
      if (!conf) { iniciarNueva('principiante'); return false; }
      S.dificultad = conf.id;
      S.cols = conf.cols;
      S.filas = conf.filas;
      S.minas = conf.minas;
      S.tablero = new Int8Array(estado.tablero);
      S.estado = new Uint8Array(estado.estado);
      S.primeraJugada = true;
      S.perdido = false;
      S.ganado = false;
      S.minaPisada = -1;
      S.banderas = typeof estado.banderas === 'number' ? estado.banderas : 0;
      S.abiertas = typeof estado.abiertas === 'number' ? estado.abiertas : 0;
      S.tiempoMs = typeof estado.tiempoMs === 'number' ? estado.tiempoMs : 0;
      S.seleccionada = -1;
      if (estado.ajustes) {
        S.ajustes.apertura = !!estado.ajustes.apertura;
        S.ajustes.marcas = !!estado.ajustes.marcas;
      }
      S.transposicion = calcularTransposicion();
      renderTablero();
      actualizarTodo();
      iniciarCronometro();
      return true;
    } catch (e) {
      iniciarNueva('principiante');
      return false;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Iniciar partida
  // ═══════════════════════════════════════════════════════════════════

  function iniciarNueva(dificultadId) {
    var conf = DIFICULTADES[dificultadId];
    if (!conf) conf = DIFICULTADES.principiante;

    S.dificultad = conf.id;
    S.cols = conf.cols;
    S.filas = conf.filas;
    S.minas = conf.minas;
    var total = S.cols * S.filas;
    S.tablero = new Int8Array(total);
    S.estado = new Uint8Array(total);
    S.primeraJugada = false;
    S.perdido = false;
    S.ganado = false;
    S.minaPisada = -1;
    S.banderas = 0;
    S.abiertas = 0;
    S.tiempoMs = 0;
    S.iniciadoEn = null;
    S.seleccionada = -1;
    S.transposicion = calcularTransposicion();

    detenerCronometro();
    actualizarReloj();
    renderTablero();
    actualizarTodo();
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Eventos
  // ═══════════════════════════════════════════════════════════════════

  // ─── Teclado ───
  function teclaGlobal(e) {
    if (e.target && /^(SELECT|INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (!rootRef || !S.tablero || S.perdido || S.ganado) return;
    var k = e.key;

    if ((k === 'Enter' || k === ' ') && e.target && /^(BUTTON|A)$/.test(e.target.tagName)) return;

    if (k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowRight') {
      e.preventDefault();
      mover(k);
      return;
    }
    if (k === 'Enter' || k === ' ') {
      e.preventDefault();
      if (S.seleccionada >= 0) clickCelda(S.seleccionada);
      return;
    }
    if (k === 'f' || k === 'F') {
      e.preventDefault();
      if (S.seleccionada >= 0) toggleBandera(S.seleccionada);
      return;
    }
  }

  function mover(dir) {
    if (S.seleccionada < 0) {
      var anterior = S.seleccionada;
      S.seleccionada = 0;
      actualizarSeleccion(anterior, 0);
      return;
    }
    var p = posVisual(S.seleccionada);
    var vf = visualFilas(), vc = visualCols();
    var nvr = p.vr, nvc = p.vc;
    if (dir === 'ArrowUp') nvr = (p.vr + vf - 1) % vf;
    if (dir === 'ArrowDown') nvr = (p.vr + 1) % vf;
    if (dir === 'ArrowLeft') nvc = (p.vc + vc - 1) % vc;
    if (dir === 'ArrowRight') nvc = (p.vc + 1) % vc;
    var nuevo = indiceLogico(nvr, nvc);
    var anterior2 = S.seleccionada;
    S.seleccionada = nuevo;
    actualizarSeleccion(anterior2, nuevo);
  }

  // ─── Pulsación larga ───
  function onTouchStart(e) {
    var celda = e.target.closest && e.target.closest('.msw-celda');
    if (!celda) return;
    var i = parseInt(celda.getAttribute('data-i'), 10);
    if (isNaN(i)) return;
    lp.startX = e.touches[0].clientX;
    lp.startY = e.touches[0].clientY;
    clearTimeout(lp.timer);
    clearTimeout(lp.resetTimer);
    lp.consumed = false;
    lp.timer = setTimeout(function () {
      lp.timer = null;
      lp.consumed = true;
      lp.ultimo = Date.now();
      toggleBandera(i);
    }, 350);
  }

  function onTouchMove(e) {
    if (!lp.timer) return;
    var dx = Math.abs(e.touches[0].clientX - lp.startX);
    var dy = Math.abs(e.touches[0].clientY - lp.startY);
    if (dx > 12 || dy > 12) {
      clearTimeout(lp.timer);
      lp.timer = null;
      lp.consumed = true;
      clearTimeout(lp.resetTimer);
      lp.resetTimer = setTimeout(function () { lp.consumed = false; }, 300);
    }
  }

  function onTouchEnd() {
    clearTimeout(lp.timer);
    lp.timer = null;
  }

  function onClick(e) {
    if (lp.consumed) {
      lp.consumed = false;
      clearTimeout(lp.resetTimer);
      return;
    }
    var celda = e.target.closest && e.target.closest('.msw-celda');
    if (!celda) return;
    var i = parseInt(celda.getAttribute('data-i'), 10);
    if (isNaN(i)) return;
    clickCelda(i);
  }

  function onContextMenu(e) {
    e.preventDefault();
    if (Date.now() - lp.ultimo < 1000) return;
    var celda = e.target.closest && e.target.closest('.msw-celda');
    if (!celda) return;
    var i = parseInt(celda.getAttribute('data-i'), 10);
    if (isNaN(i)) return;
    toggleBandera(i);
  }

  function conectarEventos(root) {
    var board = root.querySelector('.msw-board');
    if (!board) return;

    board.addEventListener('click', onClick);
    board.addEventListener('contextmenu', onContextMenu);
    board.addEventListener('touchstart', onTouchStart, { passive: true });
    board.addEventListener('touchmove', onTouchMove, { passive: true });
    board.addEventListener('touchend', onTouchEnd, { passive: true });
    board.addEventListener('touchcancel', onTouchEnd, { passive: true });

    // Botones y ajustes
    var top = root.querySelector('.msw-top');
    if (top) {
      top.addEventListener('click', function (e) {
        var btn = e.target.closest('.msw-btn');
        if (!btn) return;
        var accion = btn.getAttribute('data-accion');
        if (accion === 'modo') {
          S.ajustes.modoBandera = !S.ajustes.modoBandera;
          guardarAjustes();
          actualizarBotones();
          ctxRef.sfx('toque');
        } else if (accion === 'nueva') {
          iniciarNueva(S.dificultad);
          ctxRef.sfx('toque');
        } else if (accion === 'alejar') {
          cambiarZoom(-2);
        } else if (accion === 'acercar') {
          cambiarZoom(2);
        }
      });
    }

    var ajustes = root.querySelector('.msw-ajustes');
    if (ajustes) {
      ajustes.addEventListener('click', function (e) {
        var btn = e.target.closest('.msw-ajuste');
        if (!btn) return;
        var clave = btn.getAttribute('data-clave');
        if (clave === 'apertura') S.ajustes.apertura = !S.ajustes.apertura;
        else if (clave === 'marcas') S.ajustes.marcas = !S.ajustes.marcas;
        guardarAjustes();
        actualizarBotones();
        ctxRef.sfx('toque');
      });
    }

    if (!tecladoConectado) {
      document.addEventListener('keydown', teclaGlobal);
      tecladoConectado = true;
    }

    // Reacción a rotación o cambio de tamaño: reconsiderar transposición
    if (resizeListener) window.removeEventListener('resize', resizeListener);
    resizeListener = function () {
      if (S.dificultad !== 'experto') return;
      var nuevo = calcularTransposicion();
      if (nuevo !== S.transposicion) {
        S.transposicion = nuevo;
        renderTablero();
        actualizarTodo();
        if (S.seleccionada >= 0 && celdasDOM[S.seleccionada]) celdasDOM[S.seleccionada].classList.add('foco');
      }
    };
    window.addEventListener('resize', resizeListener);
  }

  function cambiarZoom(delta) {
    S.tamCelda = Math.max(22, Math.min(44, S.tamCelda + delta));
    if (rootRef) {
      var board = rootRef.querySelector('.msw-board');
      if (board) board.style.setProperty('--msw-tam', S.tamCelda + 'px');
    }
    actualizarBotones();
    ctxRef.sfx('toque');
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Miniatura
  // ═══════════════════════════════════════════════════════════════════

  function miniaturaBuscaminas() {
    var svg = '<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">';
    svg += '<rect x="0" y="0" width="120" height="120" rx="16" style="fill:var(--piedra);opacity:.45"/>';
    var tam = 13, off = (120 - 8 * tam) / 2;
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var x = off + c * tam, y = off + r * tam;
        var abierta = (r + c) % 3 === 0 && r < 5;
        var fill = abierta ? 'var(--niebla-2)' : 'var(--piedra)';
        svg += '<rect x="' + (x + 0.5) + '" y="' + (y + 0.5) + '" width="' + (tam - 1) + '" height="' + (tam - 1) + '" rx="2" style="fill:' + fill + '"/>';
      }
    }
    // Una mina
    var mx = off + 3 * tam + tam / 2, my = off + 2 * tam + tam / 2;
    svg += '<path d="M' + mx + ' ' + (my - 5) + ' L' + (mx + 1.4) + ' ' + (my - 1.5) + ' L' + (mx + 5) + ' ' + my + ' L' + (mx + 1.4) + ' ' + (my + 1.5) + ' L' + mx + ' ' + (my + 5) + ' L' + (mx - 1.4) + ' ' + (my + 1.5) + ' L' + (mx - 5) + ' ' + my + ' L' + (mx - 1.4) + ' ' + (my - 1.5) + ' Z" style="fill:var(--error)"/>';
    // Una bandera
    var bx = off + 5 * tam + tam / 2, by = off + 5 * tam + tam / 2;
    svg += '<path d="M' + (bx - 3) + ' ' + (by - 5) + ' v10" stroke="var(--tinta)" stroke-width="1.6" stroke-linecap="round" fill="none"/>';
    svg += '<path d="M' + (bx - 3) + ' ' + (by - 5) + ' h6 l-1.5 2 1.5 2 h-6 Z" style="fill:var(--musgo)"/>';
    svg += '</svg>';
    return svg;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Registro del juego
  // ═══════════════════════════════════════════════════════════════════

  Arcade.register({
    id: 'minesweeper',
    nombre: 'Buscaminas',
    descripcion: 'Despeja el campo sin pisar ninguna mina.',
    dificultades: [
      { id: 'principiante', nombre: 'Principiante' },
      { id: 'intermedio', nombre: 'Intermedio' },
      { id: 'experto', nombre: 'Experto' }
    ],
    dificultadPorDefecto: 'principiante',

    thumbnail: function () { return miniaturaBuscaminas(); },

    mount: function (root, ctx) {
      ctxRef = ctx;
      ctx.inyectarEstilos(CSS_MSW);
      construirEstructura(root);
      cargarAjustes();
      conectarEventos(root);
      actualizarBotones();
    },

    nuevaPartida: function (dificultadId) {
      if (!rootRef) return;
      iniciarNueva(dificultadId || S.dificultad);
    },

    pausar: function () {
      if (S.primeraJugada && !S.ganado && !S.perdido) detenerCronometro();
    },

    reanudar: function () {
      if (S.primeraJugada && !S.ganado && !S.perdido) iniciarCronometro();
    },

    serializar: function () { return serializar(); },

    restaurar: function (estado) { return restaurar(estado); },

    destruir: function () {
      detenerCronometro();
      clearTimeout(lp.timer);
      clearTimeout(lp.resetTimer);
      lp.timer = null;
      lp.resetTimer = null;
      if (tecladoConectado) {
        document.removeEventListener('keydown', teclaGlobal);
        tecladoConectado = false;
      }
      if (resizeListener) {
        window.removeEventListener('resize', resizeListener);
        resizeListener = null;
      }
      ctxRef = null;
      rootRef = null;
      celdasDOM = [];
    }
  });
})();
