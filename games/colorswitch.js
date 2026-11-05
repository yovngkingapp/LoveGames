/* games/colorswitch.js — Color Switch infinito con física fija y obstáculos. */
(function () {
  'use strict';

  var W_LOGICAL = 360;
  var PASO = 1 / 120;

  var DIFICULTADES = {
    tranquilo: { id: 'tranquilo', nombre: 'Tranquilo', gravedad: 1100, impulso: 620, rotacion: 0.9, separacion: 500 },
    normal: { id: 'normal', nombre: 'Normal', gravedad: 1500, impulso: 700, rotacion: 1.3, separacion: 520 },
    intenso: { id: 'intenso', nombre: 'Intenso', gravedad: 1900, impulso: 780, rotacion: 1.8, separacion: 540 }
  };

  var COL = ['#5F8DB3', '#7DA66B', '#D98E93', '#E0B34D'];
  var PATRON = [[], [6, 4], [2, 4], [10, 4]];

  var ctxRef = null, rootRef = null, wrapRef = null, canvasRef = null, ctx2d = null;
  var H_LOGICAL = 640, escala = 1;
  var rafId = null, tecladoConectado = false, resizeObs = null;
  var timeouts = [];

  var S = {
    estado: 'listo',
    dificultad: 'normal',
    camY: 0,
    puntaje: 0,
    mejor: 0,
    bola: { x: 180, y: 0, vy: 0, color: 0, r: 11 },
    obstaculos: [],
    switches: [],
    particulas: [],
    trail: [],
    tiempoJuego: 0,
    finTiempo: 0,
    ultimoTs: 0,
    acumulador: 0,
    pausaCountdown: 0
  };

  function movReducido() {
    return !!(ctxRef && ctxRef.ajustes && ctxRef.ajustes.movimientoReducido);
  }

  function cargarColores() {
    try {
      var cs = getComputedStyle(document.documentElement);
      var a = cs.getPropertyValue('--azul').trim();
      var v = cs.getPropertyValue('--verde').trim();
      var r = cs.getPropertyValue('--rosa').trim();
      var m = cs.getPropertyValue('--amarillo').trim();
      if (a) COL[0] = a;
      if (v) COL[1] = v;
      if (r) COL[2] = r;
      if (m) COL[3] = m;
    } catch (e) { /* fallback */ }
  }

  var CSS = [
    '.cs-wrap{display:flex;flex-direction:column;width:100%;height:100%;min-height:0;position:relative;}',
    '.cs-wrap [hidden]{display:none!important;}',
    '.cs-canvas-wrap{flex:1;position:relative;overflow:hidden;border-radius:var(--r-control);touch-action:none;user-select:none;-webkit-user-select:none;min-height:280px;}',
    '.cs-canvas{display:block;width:100%;height:100%;touch-action:none;-webkit-tap-highlight-color:transparent;}',
    '.cs-hud{position:absolute;top:8px;left:8px;right:8px;display:flex;gap:8px;justify-content:space-between;pointer-events:none;z-index:10;}',
    '.cs-pill{padding:6px 14px;border-radius:var(--r-pastilla);background:var(--vidrio-fondo-fuerte);border:1px solid var(--vidrio-borde);font-family:var(--fuente-titulo);font-weight:600;font-size:.85rem;color:var(--tinta);font-variant-numeric:tabular-nums;display:flex;gap:6px;align-items:baseline;}',
    '.cs-pill b{font-size:1.05rem;font-weight:700;}',
    '.cs-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:20;padding:16px;}',
    '.cs-overlay-texto{padding:14px 24px;border-radius:var(--r-pastilla);background:var(--vidrio-fondo-fuerte);border:1px solid var(--vidrio-borde);font-family:var(--fuente-titulo);font-weight:700;font-size:1.1rem;color:var(--tinta);text-align:center;}',
    '.cs-countdown{font-family:var(--fuente-titulo);font-weight:700;font-size:5rem;color:var(--tinta);text-shadow:0 2px 8px rgba(0,0,0,.15);}',
    '.cs-fin-panel{padding:24px 28px;border-radius:var(--r-panel);background:var(--vidrio-fondo-fuerte);border:1px solid var(--vidrio-borde);box-shadow:0 12px 32px rgba(0,0,0,.15);text-align:center;max-width:100%;}',
    '.cs-fin-panel h2{font-family:var(--fuente-titulo);font-size:1.4rem;margin:0 0 10px;color:var(--tinta);font-weight:700;}',
    '.cs-fin-panel p{margin:4px 0;color:var(--tinta-suave);font-size:.95rem;}',
    '.cs-fin-panel p b{color:var(--tinta);font-size:1.2rem;font-variant-numeric:tabular-nums;}',
    '.cs-fin-botones{display:flex;flex-direction:column;gap:8px;margin-top:14px;}',
    '.cs-btn-primario{padding:12px 24px;border-radius:var(--r-control);background:var(--musgo);color:#fff;border:0;font-family:inherit;font-weight:700;font-size:1rem;cursor:pointer;min-height:44px;}',
    '.cs-btn-primario:hover{background:#43584B;}',
    '.cs-fin-difs{display:flex;gap:6px;margin-top:12px;justify-content:center;flex-wrap:wrap;}',
    '.cs-fin-difs button{padding:8px 14px;border-radius:var(--r-pastilla);border:1px solid var(--vidrio-borde);background:var(--capa-suave);color:var(--tinta-suave);font-family:inherit;font-size:.85rem;cursor:pointer;min-height:36px;}',
    '.cs-fin-difs button:hover{background:var(--capa-fuerte);}',
    '.cs-fin-difs button.activo{background:var(--musgo);color:#fff;border-color:transparent;}',
    '@media (prefers-reduced-motion:reduce){.cs-countdown{font-size:3rem;}}'
  ].join('\n');

  // ══════════════ SETUP ══════════════
  function setupCanvas() {
    if (!wrapRef || !canvasRef) return false;
    var rect = wrapRef.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return false;
    var dpr = window.devicePixelRatio || 1;
    canvasRef.width = Math.round(rect.width * dpr);
    canvasRef.height = Math.round(rect.height * dpr);
    canvasRef.style.width = rect.width + 'px';
    canvasRef.style.height = rect.height + 'px';
    ctx2d = canvasRef.getContext('2d');
    H_LOGICAL = 360 * rect.height / rect.width;
    escala = dpr * rect.width / 360;
    return true;
  }

  // ══════════════ FONDO ══════════════
  function dibujarFondo() {
    var esNoche = document.documentElement.getAttribute('data-tema') === 'noche';
    var g = ctx2d.createRadialGradient(W_LOGICAL / 2, H_LOGICAL / 2, 40, W_LOGICAL / 2, H_LOGICAL / 2, W_LOGICAL * 0.95);
    if (esNoche) {
      g.addColorStop(0, '#2A3531');
      g.addColorStop(1, '#1D2623');
    } else {
      g.addColorStop(0, '#F3F6F4');
      g.addColorStop(1, '#DDE4E0');
    }
    ctx2d.fillStyle = g;
    ctx2d.fillRect(0, 0, W_LOGICAL, H_LOGICAL);
  }

  // ══════════════ OBSTÁCULOS ══════════════
  function elegirTipo(idx, puntaje) {
    if (idx < 2) return 'ring';
    var pool = ['ring', 'ring'];
    if (puntaje >= 2) pool.push('doble');
    if (puntaje >= 4) pool.push('cross');
    if (puntaje >= 8) pool.push('bars');
    if (puntaje >= 14) pool.push('square');
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function shuffle4() {
    var a = [0, 1, 2, 3];
    for (var i = 3; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function generarObstaculo(idx) {
    var dif = DIFICULTADES[S.dificultad];
    var y = -380 - idx * dif.separacion;
    var tipo = elegirTipo(idx, S.puntaje);
    var perm = shuffle4();

    var obs = {
      idx: idx,
      tipo: tipo,
      x: 180,
      y: y,
      rot: Math.random() * Math.PI * 2,
      velRot: (Math.random() < 0.5 ? 1 : -1) * dif.rotacion * (0.9 + Math.random() * 0.2),
      segmentos: perm,
      estrellaRecogida: false,
      radio: 80,
      grosor: 14,
      radioInterior: 55,
      segmentosInterior: null,
      rotInterior: 0,
      velRotInterior: 0,
      lado: 130,
      brazoAncho: 20,
      brazoLargo: 80,
      barColores: null,
      barFase: 0
    };

    if (tipo === 'doble') {
      obs.segmentosInterior = shuffle4();
      obs.rotInterior = Math.random() * Math.PI * 2;
      obs.velRotInterior = -obs.velRot * 0.8;
    }
    if (tipo === 'bars') {
      obs.barColores = shuffle4();
      obs.barFase = Math.random() * Math.PI * 2;
    }

    S.obstaculos.push(obs);

    var sw = {
      x: 180,
      y: y + 300,
      radio: 20,
      grosor: 5,
      rot: Math.random() * Math.PI * 2,
      velRot: 0.6,
      fired: false
    };
    S.switches.push(sw);
  }

  function asegurarObstaculos() {
    var minY = S.camY - H_LOGICAL * 1.5;
    var seguro = 0;
    while ((S.obstaculos.length === 0 || S.obstaculos[S.obstaculos.length - 1].y > minY) && seguro < 50) {
      generarObstaculo(S.obstaculos.length);
      seguro++;
    }
  }

  // ══════════════ FÍSICA ══════════════
  function pasoFisica(dt) {
    var dif = DIFICULTADES[S.dificultad];
    S.tiempoJuego += dt;

    S.bola.vy += dif.gravedad * dt;
    S.bola.y += S.bola.vy * dt;

    for (var i = 0; i < S.obstaculos.length; i++) {
      var o = S.obstaculos[i];
      o.rot += o.velRot * dt;
      if (o.tipo === 'doble') o.rotInterior += o.velRotInterior * dt;
    }
    for (var j = 0; j < S.switches.length; j++) {
      S.switches[j].rot += S.switches[j].velRot * dt;
    }

    var screenY = S.bola.y - S.camY;
    if (screenY < H_LOGICAL * 0.3) {
      S.camY = S.bola.y - H_LOGICAL * 0.3;
    }

    asegurarObstaculos();

    for (var k = 0; k < S.switches.length; k++) {
      var sw = S.switches[k];
      if (sw.fired) continue;
      var dx = S.bola.x - sw.x;
      var dy = S.bola.y - sw.y;
      if (dx * dx + dy * dy < sw.radio * sw.radio) {
        sw.fired = true;
        var nuevo;
        do { nuevo = Math.floor(Math.random() * 4); } while (nuevo === S.bola.color);
        S.bola.color = nuevo;
        ctxRef.sfx('ok');
      }
    }

    if (chequearColision()) { perder(); return; }

    for (var m = 0; m < S.obstaculos.length; m++) {
      var ob = S.obstaculos[m];
      if (ob.estrellaRecogida) continue;
      if (Math.abs(S.bola.x - ob.x) < 26 && Math.abs(S.bola.y - ob.y) < 26) {
        ob.estrellaRecogida = true;
        S.puntaje++;
        ctxRef.sfx('ok');
        actualizarUI();
      }
    }

    if (!movReducido()) {
      S.trail.push({ x: S.bola.x, y: S.bola.y });
      if (S.trail.length > 10) S.trail.shift();
    }

    if (S.bola.y - S.camY > H_LOGICAL + 30) {
      perder();
    }
  }

  // ══════════════ COLISIONES ══════════════
  function colisionAnillo(o, radio, grosor, segmentos, rot) {
    var dx = S.bola.x - o.x;
    var dy = S.bola.y - o.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (Math.abs(dist - radio) >= grosor / 2 + S.bola.r) return false;
    if (dy < 0) return false;
    var ang = Math.atan2(dy, dx);
    var rel = ((ang - rot) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    var seg = Math.floor(rel / (Math.PI / 2)) % 4;
    return segmentos[seg] !== S.bola.color;
  }

  function colisionCruz(o) {
    var dx = S.bola.x - o.x;
    var dy = S.bola.y - o.y;
    var cos = Math.cos(-o.rot);
    var sin = Math.sin(-o.rot);
    var lx = dx * cos - dy * sin;
    var ly = dx * sin + dy * cos;
    var hw = o.brazoAncho / 2 + S.bola.r;
    var L = o.brazoLargo + S.bola.r;
    if (Math.abs(lx) < hw && ly > 0 && ly < L) {
      return o.segmentos[0] !== S.bola.color;
    }
    return false;
  }

  function colisionCuadrado(o) {
    var dx = S.bola.x - o.x;
    var dy = S.bola.y - o.y;
    var cos = Math.cos(-o.rot);
    var sin = Math.sin(-o.rot);
    var lx = dx * cos - dy * sin;
    var ly = dx * sin + dy * cos;
    var L = o.lado / 2;
    if (Math.abs(ly - L) < o.grosor / 2 + S.bola.r && Math.abs(lx) < L + S.bola.r) {
      if (ly > 0) return o.segmentos[0] !== S.bola.color;
    }
    return false;
  }

  function colisionBarras(o) {
    var offset = Math.sin(S.tiempoJuego * 1.5 + o.barFase) * 60;
    for (var fila = 0; fila < 2; fila++) {
      var y = o.y - fila * 50;
      if (Math.abs(S.bola.y - y) < 10 + S.bola.r) {
        var rel = S.bola.x - offset;
        var idx = Math.floor(rel / 90);
        idx = ((idx % 4) + 4) % 4;
        if (o.barColores[idx] !== S.bola.color) return true;
      }
    }
    return false;
  }

  function chequearColision() {
    for (var i = 0; i < S.obstaculos.length; i++) {
      var o = S.obstaculos[i];
      if (Math.abs(S.bola.y - o.y) > 200) continue;
      if (o.tipo === 'ring' || o.tipo === 'doble') {
        if (colisionAnillo(o, o.radio, o.grosor, o.segmentos, o.rot)) return true;
        if (o.tipo === 'doble' && colisionAnillo(o, o.radioInterior, o.grosor, o.segmentosInterior, o.rotInterior)) return true;
      } else if (o.tipo === 'cross') {
        if (colisionCruz(o)) return true;
      } else if (o.tipo === 'square') {
        if (colisionCuadrado(o)) return true;
      } else if (o.tipo === 'bars') {
        if (colisionBarras(o)) return true;
      }
    }
    return false;
  }

  // ══════════════ RENDER ══════════════
  function dibujarAnillo(cx, cy, r, gr, segs, rot, opacidad) {
    ctx2d.save();
    ctx2d.globalAlpha = opacidad;
    ctx2d.lineWidth = gr;
    ctx2d.lineCap = 'butt';
    for (var i = 0; i < 4; i++) {
      var a0 = rot + i * Math.PI / 2;
      var a1 = a0 + Math.PI / 2;
      ctx2d.setLineDash(PATRON[segs[i]]);
      ctx2d.strokeStyle = COL[segs[i]];
      ctx2d.beginPath();
      ctx2d.arc(cx, cy, r, a0, a1);
      ctx2d.stroke();
    }
    ctx2d.setLineDash([]);
    ctx2d.restore();
  }

  function dibujarCruz(o) {
    ctx2d.save();
    ctx2d.translate(o.x, o.y);
    ctx2d.rotate(o.rot);
    var hw = o.brazoAncho / 2;
    var L = o.brazoLargo;
    var brazos = [
      { color: o.segmentos[0], x: -hw, y: 0, w: hw * 2, h: L },
      { color: o.segmentos[1], x: 0, y: -hw, w: L, h: hw * 2 },
      { color: o.segmentos[2], x: -L, y: -hw, w: L, h: hw * 2 },
      { color: o.segmentos[3], x: -hw, y: -L, w: hw * 2, h: L }
    ];
    for (var i = 0; i < 4; i++) {
      var b = brazos[i];
      ctx2d.setLineDash(PATRON[b.color]);
      ctx2d.fillStyle = COL[b.color];
      ctx2d.fillRect(b.x, b.y, b.w, b.h);
    }
    ctx2d.setLineDash([]);
    ctx2d.restore();
  }

  function dibujarCuadrado(o) {
    ctx2d.save();
    ctx2d.translate(o.x, o.y);
    ctx2d.rotate(o.rot);
    var L = o.lado, g = o.grosor;
    var barras = [
      { x: -L / 2, y: L / 2 - g, w: L, h: g, color: o.segmentos[0] },
      { x: L / 2 - g, y: -L / 2, w: g, h: L, color: o.segmentos[1] },
      { x: -L / 2, y: -L / 2, w: L, h: g, color: o.segmentos[2] },
      { x: -L / 2, y: -L / 2, w: g, h: L, color: o.segmentos[3] }
    ];
    for (var i = 0; i < 4; i++) {
      var b = barras[i];
      ctx2d.setLineDash(PATRON[b.color]);
      ctx2d.fillStyle = COL[b.color];
      ctx2d.fillRect(b.x, b.y, b.w, b.h);
    }
    ctx2d.setLineDash([]);
    ctx2d.restore();
  }

  function dibujarBarras(o) {
    var offset = Math.sin(S.tiempoJuego * 1.5 + o.barFase) * 60;
    for (var fila = 0; fila < 2; fila++) {
      var y = o.y - fila * 50;
      for (var i = 0; i < 4; i++) {
        var x = i * 90 + offset;
        var colorIdx = o.barColores[i];
        ctx2d.setLineDash(PATRON[colorIdx]);
        ctx2d.fillStyle = COL[colorIdx];
        ctx2d.fillRect(x, y - 10, 90, 20);
      }
    }
    ctx2d.setLineDash([]);
  }

  function dibujarEstrella(x, y, r) {
    ctx2d.save();
    ctx2d.translate(x, y);
    ctx2d.rotate(S.tiempoJuego * 1.5);
    ctx2d.fillStyle = '#E0B34D';
    ctx2d.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx2d.lineWidth = 1;
    ctx2d.beginPath();
    for (var i = 0; i < 10; i++) {
      var ang = i * Math.PI / 5 - Math.PI / 2;
      var rad = i % 2 === 0 ? r : r * 0.45;
      var px = Math.cos(ang) * rad;
      var py = Math.sin(ang) * rad;
      if (i === 0) ctx2d.moveTo(px, py);
      else ctx2d.lineTo(px, py);
    }
    ctx2d.closePath();
    ctx2d.fill();
    ctx2d.stroke();
    ctx2d.restore();
  }

  function dibujarSwitch(sw) {
    ctx2d.save();
    ctx2d.lineWidth = sw.grosor;
    for (var i = 0; i < 4; i++) {
      var a0 = sw.rot + i * Math.PI / 2;
      var a1 = a0 + Math.PI / 2;
      ctx2d.strokeStyle = COL[i];
      ctx2d.beginPath();
      ctx2d.arc(sw.x, sw.y, sw.radio, a0, a1);
      ctx2d.stroke();
    }
    ctx2d.fillStyle = 'rgba(255,255,255,0.18)';
    ctx2d.beginPath();
    ctx2d.arc(sw.x, sw.y, sw.radio - sw.grosor - 1, 0, Math.PI * 2);
    ctx2d.fill();
    ctx2d.restore();
  }

  function dibujarObstaculo(o) {
    if (o.tipo === 'ring' || o.tipo === 'doble') {
      dibujarAnillo(o.x, o.y, o.radio, o.grosor, o.segmentos, o.rot, 1);
      if (o.tipo === 'doble') dibujarAnillo(o.x, o.y, o.radioInterior, o.grosor, o.segmentosInterior, o.rotInterior, 0.85);
      if (!o.estrellaRecogida) dibujarEstrella(o.x, o.y, 9);
    } else if (o.tipo === 'cross') {
      dibujarCruz(o);
      if (!o.estrellaRecogida) dibujarEstrella(o.x, o.y, 9);
    } else if (o.tipo === 'square') {
      dibujarCuadrado(o);
      if (!o.estrellaRecogida) dibujarEstrella(o.x, o.y, 9);
    } else if (o.tipo === 'bars') {
      dibujarBarras(o);
      if (!o.estrellaRecogida) dibujarEstrella(o.x, o.y, 9);
    }
  }

  function dibujarBola(ts) {
    if (S.estado === 'fin') return;
    var x = S.bola.x;
    var y = S.bola.y;
    if (S.estado === 'listo') {
      y += Math.sin(ts / 400) * 6;
    }
    ctx2d.save();
    if (!movReducido() && S.trail.length > 0) {
      for (var i = 0; i < S.trail.length; i++) {
        var tr = S.trail[i];
        var al = (i / S.trail.length) * 0.28;
        ctx2d.globalAlpha = al;
        ctx2d.fillStyle = COL[S.bola.color];
        ctx2d.beginPath();
        ctx2d.arc(tr.x, tr.y, S.bola.r * (0.4 + 0.6 * i / S.trail.length), 0, Math.PI * 2);
        ctx2d.fill();
      }
      ctx2d.globalAlpha = 1;
    }
    ctx2d.fillStyle = COL[S.bola.color];
    ctx2d.beginPath();
    ctx2d.arc(x, y, S.bola.r, 0, Math.PI * 2);
    ctx2d.fill();
    ctx2d.fillStyle = '#fff';
    if (S.bola.color === 0) {
      ctx2d.fillRect(x - 4, y - 1.5, 8, 3);
    } else if (S.bola.color === 1) {
      ctx2d.fillRect(x - 1.5, y - 4, 3, 8);
    } else if (S.bola.color === 2) {
      ctx2d.beginPath();
      ctx2d.arc(x, y, 3, 0, Math.PI * 2);
      ctx2d.fill();
    } else {
      ctx2d.strokeStyle = '#fff';
      ctx2d.lineWidth = 2;
      ctx2d.beginPath();
      ctx2d.moveTo(x - 3, y - 3);
      ctx2d.lineTo(x + 3, y + 3);
      ctx2d.moveTo(x + 3, y - 3);
      ctx2d.lineTo(x - 3, y + 3);
      ctx2d.stroke();
    }
    ctx2d.restore();
  }

  function render(ts) {
    if (!ctx2d) return;
    ctx2d.setTransform(escala, 0, 0, escala, 0, 0);
    dibujarFondo();

    ctx2d.save();
    ctx2d.translate(0, -S.camY);

    for (var i = 0; i < S.obstaculos.length; i++) {
      var o = S.obstaculos[i];
      var sy = o.y - S.camY;
      if (sy < -200 || sy > H_LOGICAL + 200) continue;
      dibujarObstaculo(o);
    }
    for (var j = 0; j < S.switches.length; j++) {
      var sw = S.switches[j];
      var sy2 = sw.y - S.camY;
      if (sy2 < -100 || sy2 > H_LOGICAL + 100) continue;
      dibujarSwitch(sw);
    }

    dibujarBola(ts);

    for (var k = 0; k < S.particulas.length; k++) {
      var p = S.particulas[k];
      var al = 1 - p.t / p.vida;
      if (al <= 0) continue;
      ctx2d.globalAlpha = al;
      ctx2d.fillStyle = p.color;
      ctx2d.beginPath();
      ctx2d.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx2d.fill();
    }
    ctx2d.globalAlpha = 1;
    ctx2d.restore();
  }

  // ══════════════ LOOP ══════════════
  function loop(ts) {
    if (!ctxRef) return;
    var realDt = S.ultimoTs ? (ts - S.ultimoTs) / 1000 : 0;
    if (realDt > 0.1) realDt = 0.1;
    if (realDt < 0) realDt = 0;
    S.ultimoTs = ts;

    if (S.estado === 'jugando') {
      S.acumulador += realDt;
      while (S.acumulador >= PASO) {
        pasoFisica(PASO);
        S.acumulador -= PASO;
        if (S.estado !== 'jugando') break;
      }
    }

    for (var i = S.particulas.length - 1; i >= 0; i--) {
      var p = S.particulas[i];
      p.t += realDt;
      p.x += p.vx * realDt;
      p.y += p.vy * realDt;
      p.vy += 280 * realDt;
      if (p.t >= p.vida) S.particulas.splice(i, 1);
    }

    render(ts);
    rafId = requestAnimationFrame(loop);
  }

  function arrancarLoop() {
    if (rafId) return;
    S.ultimoTs = 0;
    rafId = requestAnimationFrame(loop);
  }

  function detenerLoop() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  // ══════════════ JUEGO ══════════════
  function cargarMejor() {
    if (!ctxRef) return;
    var m = ctxRef.leer('mejor:' + S.dificultad, 0);
    S.mejor = (typeof m === 'number' && m > 0) ? m : 0;
  }

  function reiniciar() {
    detenerLoop();
    for (var i = 0; i < timeouts.length; i++) clearTimeout(timeouts[i]);
    timeouts = [];

    S.estado = 'listo';
    S.camY = -H_LOGICAL * 0.85;
    S.puntaje = 0;
    S.bola = { x: 180, y: 0, vy: 0, color: 0, r: 11 };
    S.obstaculos = [];
    S.switches = [];
    S.particulas = [];
    S.trail = [];
    S.tiempoJuego = 0;
    S.ultimoTs = 0;
    S.acumulador = 0;
    S.pausaCountdown = 0;

    asegurarObstaculos();
    actualizarUI();
    arrancarLoop();
  }

  function iniciarJuego() {
    if (S.estado !== 'listo') return;
    S.estado = 'jugando';
    S.puntaje = 0;
    S.tiempoJuego = 0;
    S.ultimoTs = 0;
    S.acumulador = 0;
    var dif = DIFICULTADES[S.dificultad];
    S.bola.vy = -dif.impulso;
    ctxRef.sfx('toque');
    actualizarUI();
  }

  function saltar() {
    if (S.estado !== 'jugando') return;
    var dif = DIFICULTADES[S.dificultad];
    S.bola.vy = -dif.impulso;
    ctxRef.sfx('toque');
  }

  function perder() {
    if (S.estado === 'fin') return;
    S.estado = 'fin';
    S.finTiempo = Date.now();

    if (!movReducido()) {
      for (var i = 0; i < 24; i++) {
        var ang = Math.random() * Math.PI * 2;
        var vel = 80 + Math.random() * 180;
        S.particulas.push({
          x: S.bola.x,
          y: S.bola.y,
          vx: Math.cos(ang) * vel,
          vy: Math.sin(ang) * vel,
          t: 0,
          vida: 0.8 + Math.random() * 0.5,
          color: COL[S.bola.color]
        });
      }
    }

    ctxRef.sfx('derrota');
    try {
      if (ctxRef.ajustes && ctxRef.ajustes.vibracion && navigator.vibrate) navigator.vibrate(60);
    } catch (e) { /* nada */ }

    try { ctxRef.reportar({ tipo: 'fin', dificultad: S.dificultad, puntaje: S.puntaje }); } catch (e) { /* nada */ }

    var nuevoRecord = S.puntaje > S.mejor && S.puntaje > 0;
    if (S.puntaje > S.mejor) {
      S.mejor = S.puntaje;
      try { ctxRef.guardar('mejor:' + S.dificultad, S.mejor); } catch (e) { /* nada */ }
    }

    actualizarUI();

    if (nuevoRecord) {
      try { ctxRef.celebrar({ titulo: 'Nuevo récord', detalle: 'Puntaje: ' + S.puntaje }); } catch (e) { /* nada */ }
    }
  }

  // ══════════════ UI ══════════════
  function crearEstructura(root) {
    root.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.className = 'cs-wrap';

    var cw = document.createElement('div');
    cw.className = 'cs-canvas-wrap';

    var hud = document.createElement('div');
    hud.className = 'cs-hud';
    hud.innerHTML =
      '<div class="cs-pill">Puntos <b class="cs-puntaje">0</b></div>' +
      '<div class="cs-pill">Mejor <b class="cs-mejor">0</b></div>';
    cw.appendChild(hud);

    var canvas = document.createElement('canvas');
    canvas.className = 'cs-canvas';
    cw.appendChild(canvas);

    var overlayListo = document.createElement('div');
    overlayListo.className = 'cs-overlay cs-overlay-listo';
    overlayListo.innerHTML = '<div class="cs-overlay-texto">Toca para empezar</div>';
    cw.appendChild(overlayListo);

    var overlayCont = document.createElement('div');
    overlayCont.className = 'cs-overlay cs-overlay-countdown';
    overlayCont.hidden = true;
    overlayCont.innerHTML = '<div class="cs-countdown">3</div>';
    cw.appendChild(overlayCont);

    var overlayFin = document.createElement('div');
    overlayFin.className = 'cs-overlay cs-overlay-fin';
    overlayFin.hidden = true;
    overlayFin.innerHTML =
      '<div class="cs-fin-panel">' +
        '<h2>Fin del juego</h2>' +
        '<p>Puntaje: <b class="cs-fin-puntaje">0</b></p>' +
        '<p>Mejor: <b class="cs-fin-mejor">0</b></p>' +
        '<div class="cs-fin-botones">' +
          '<button type="button" class="cs-btn-primario" data-accion="reiniciar">Jugar otra vez</button>' +
        '</div>' +
        '<div class="cs-fin-difs">' +
          '<button type="button" data-dif="tranquilo">Tranquilo</button>' +
          '<button type="button" data-dif="normal">Normal</button>' +
          '<button type="button" data-dif="intenso">Intenso</button>' +
        '</div>' +
      '</div>';
    cw.appendChild(overlayFin);

    wrap.appendChild(cw);
    root.appendChild(wrap);

    rootRef = root;
    wrapRef = cw;
    canvasRef = canvas;
  }

  function actualizarUI() {
    if (!rootRef) return;
    var ol = rootRef.querySelector('.cs-overlay-listo');
    var oc = rootRef.querySelector('.cs-overlay-countdown');
    var of = rootRef.querySelector('.cs-overlay-fin');
    if (ol) ol.hidden = S.estado !== 'listo';
    if (oc) oc.hidden = S.estado !== 'contando';
    if (of) of.hidden = S.estado !== 'fin';

    var cd = rootRef.querySelector('.cs-countdown');
    if (cd) cd.textContent = String(Math.max(1, S.pausaCountdown));

    var ep = rootRef.querySelector('.cs-puntaje');
    var em = rootRef.querySelector('.cs-mejor');
    if (ep) ep.textContent = String(S.puntaje);
    if (em) em.textContent = String(S.mejor);

    if (S.estado === 'fin') {
      var fp = rootRef.querySelector('.cs-fin-puntaje');
      var fm = rootRef.querySelector('.cs-fin-mejor');
      if (fp) fp.textContent = String(S.puntaje);
      if (fm) fm.textContent = String(S.mejor);
      var btns = rootRef.querySelectorAll('.cs-fin-difs button');
      for (var i = 0; i < btns.length; i++) {
        btns[i].classList.toggle('activo', btns[i].getAttribute('data-dif') === S.dificultad);
      }
    }
  }

  // ══════════════ EVENTOS ══════════════
  function alTocar(e) {
    if (e) {
      if (e.target && e.target.closest && e.target.closest('button')) return;
      if (e.cancelable) e.preventDefault();
    }
    if (S.estado === 'listo') {
      iniciarJuego();
    } else if (S.estado === 'jugando') {
      saltar();
    } else if (S.estado === 'fin') {
      if (Date.now() - S.finTiempo < 600) return;
      reiniciar();
    }
  }

  function onKeyDown(e) {
    if (e.target && /^(SELECT|INPUT|TEXTAREA|BUTTON|A)$/.test(e.target.tagName)) return;
    var esJump = e.key === ' ' || e.key === 'ArrowUp' || e.code === 'Space';
    if (!esJump) return;
    e.preventDefault();
    alTocar(null);
  }

  function conectarEventos() {
    if (!wrapRef) return;
    var handler = function (e) { alTocar(e); };
    wrapRef.addEventListener('pointerdown', handler);
    wrapRef._pointerHandler = handler;

    if (!tecladoConectado) {
      document.addEventListener('keydown', onKeyDown);
      tecladoConectado = true;
    }

    var overlayFin = rootRef.querySelector('.cs-overlay-fin');
    if (overlayFin) {
      overlayFin.addEventListener('click', function (e) {
        var btn = e.target.closest('button');
        if (!btn) return;
        if (btn.getAttribute('data-accion') === 'reiniciar') {
          reiniciar();
        } else if (btn.hasAttribute('data-dif')) {
          var d = btn.getAttribute('data-dif');
          if (DIFICULTADES[d]) {
            S.dificultad = d;
            cargarMejor();
            reiniciar();
          }
        }
      });
    }

    try {
      resizeObs = new ResizeObserver(function () {
        if (!ctxRef) return;
        var ok = setupCanvas();
        if (ok) render(performance.now());
      });
      resizeObs.observe(wrapRef);
    } catch (e) { /* sin ResizeObserver */ }
  }

  // ══════════════ REGISTRO ══════════════
  Arcade.register({
    id: 'colorswitch',
    nombre: 'Color Switch',
    descripcion: 'Cruza los aros al ritmo justo.',
    dificultades: [
      { id: 'tranquilo', nombre: 'Tranquilo' },
      { id: 'normal', nombre: 'Normal' },
      { id: 'intenso', nombre: 'Intenso' }
    ],
    dificultadPorDefecto: 'normal',

    thumbnail: function () {
      return '<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<rect x="0" y="0" width="120" height="120" rx="16" style="fill:var(--vidrio-mar);opacity:.2"/>' +
        '<circle cx="60" cy="60" r="34" fill="none" stroke="var(--azul)" stroke-width="6" stroke-dasharray="0 53.4"/>' +
        '<circle cx="60" cy="60" r="34" fill="none" stroke="var(--verde)" stroke-width="6" stroke-dasharray="53.4 53.4" stroke-dashoffset="-53.4"/>' +
        '<circle cx="60" cy="60" r="34" fill="none" stroke="var(--rosa)" stroke-width="6" stroke-dasharray="53.4 53.4" stroke-dashoffset="-106.8"/>' +
        '<circle cx="60" cy="60" r="34" fill="none" stroke="var(--amarillo)" stroke-width="6" stroke-dasharray="53.4 53.4" stroke-dashoffset="-160.2"/>' +
        '<circle cx="60" cy="90" r="8" style="fill:var(--rosa)"/>' +
        '<path d="M60 78 L60 70" stroke="var(--musgo)" stroke-width="2" stroke-linecap="round"/>' +
        '</svg>';
    },

    mount: function (root, ctx) {
      ctxRef = ctx;
      ctx.inyectarEstilos(CSS);
      crearEstructura(root);
      cargarColores();
      var ok = setupCanvas();
      conectarEventos();
      cargarMejor();
      if (ok) {
        reiniciar();
      } else {
        S.estado = 'listo';
        actualizarUI();
        // Intentar de nuevo cuando haya dimensiones
        var tid = setTimeout(function () {
          if (setupCanvas()) {
            cargarMejor();
            reiniciar();
          }
        }, 80);
        timeouts.push(tid);
      }
    },

    nuevaPartida: function (dificultadId) {
      if (!rootRef) return;
      if (dificultadId && DIFICULTADES[dificultadId]) {
        S.dificultad = dificultadId;
      }
      cargarMejor();
      if (!ctx2d) {
        if (!setupCanvas()) { actualizarUI(); return; }
      }
      reiniciar();
    },

    pausar: function () {
      if (S.estado !== 'jugando') return;
      S.estado = 'pausado';
      detenerLoop();
    },

    reanudar: function () {
      if (S.estado !== 'pausado') return;
      S.estado = 'contando';
      S.pausaCountdown = 3;
      actualizarUI();
      var paso = function () {
        S.pausaCountdown--;
        actualizarUI();
        if (S.pausaCountdown <= 0) {
          S.estado = 'jugando';
          S.ultimoTs = 0;
          S.acumulador = 0;
          actualizarUI();
          arrancarLoop();
        } else {
          timeouts.push(setTimeout(paso, 700));
        }
      };
      timeouts.push(setTimeout(paso, 700));
    },

    serializar: function () { return null; },

    restaurar: function () { return false; },

    destruir: function () {
      detenerLoop();
      for (var i = 0; i < timeouts.length; i++) clearTimeout(timeouts[i]);
      timeouts = [];
      if (tecladoConectado) {
        document.removeEventListener('keydown', onKeyDown);
        tecladoConectado = false;
      }
      if (resizeObs) {
        try { resizeObs.disconnect(); } catch (e) { /* nada */ }
        resizeObs = null;
      }
      if (wrapRef && wrapRef._pointerHandler) {
        wrapRef.removeEventListener('pointerdown', wrapRef._pointerHandler);
        wrapRef._pointerHandler = null;
      }
      ctxRef = null;
      rootRef = null;
      wrapRef = null;
      canvasRef = null;
      ctx2d = null;
    }
  });
})();
