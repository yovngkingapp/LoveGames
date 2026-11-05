/* games/mahjong.js — Mahjong solitario con generación inversa garantizada. */
(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  //  Definiciones de disposiciones (ASCII por capa)
  // ═══════════════════════════════════════════════════════════════════

  var CAPAS_TORTUGA = [
    { z: 0, yOffset: 0, rows: [
      '      ###      ',
      '    #######    ',
      '  ###########  ',
      '###############',
      '###############',
      '###############',
      '  ###########  ',
      '    #######    ',
      '      ###      '
    ]},
    { z: 1, yOffset: 1, rows: [
      '      ###      ',
      '    #######    ',
      '   #########   ',
      '   #########   ',
      '     #####     ',
      '      ###      '
    ]},
    { z: 2, yOffset: 2, rows: [
      '      ###      ',
      '     #####     ',
      '     #####     ',
      '      ###      '
    ]},
    { z: 3, yOffset: 3, rows: [
      '      ###      ',
      '       #       '
    ]},
    { z: 4, yOffset: 3, rows: [
      '       #       '
    ]}
  ];

  var CAPAS_PIRAMIDE = [
    { z: 0, yOffset: 0, rows: [
      '   ###   ',
      '  #####  ',
      ' ####### ',
      '#########',
      '#########',
      ' ####### ',
      '  #####  '
    ]},
    { z: 1, yOffset: 2, rows: [
      '  #####  ',
      '  #####  ',
      '  #####  ',
      '  #####  '
    ]},
    { z: 2, yOffset: 3, rows: [
      '  #####  ',
      '  #####  '
    ]},
    { z: 3, yOffset: 3, rows: [
      '   ###   ',
      '    #    '
    ]},
    { z: 4, yOffset: 4, rows: [
      '    #    '
    ]}
  ];

  function parseLayout(capas) {
    var tiles = [];
    capas.forEach(function (capa) {
      capa.rows.forEach(function (fila, rIdx) {
        var y = capa.yOffset + rIdx;
        for (var x = 0; x < fila.length; x++) {
          if (fila.charAt(x) === '#') {
            // Coordenadas en medias fichas: cada ficha ocupa 2x2
            tiles.push({ x: x * 2, y: y * 2, z: capa.z });
          }
        }
      });
    });
    return tiles;
  }

  var LAYOUTS = {
    tortuga: { id: 'tortuga', nombre: 'Tortuga', tiles: parseLayout(CAPAS_TORTUGA), total: 144 },
    piramide: { id: 'piramide', nombre: 'Pirámide', tiles: parseLayout(CAPAS_PIRAMIDE), total: 80 }
  };

  // Asserts en tiempo de ejecución
  (function () {
    var t = LAYOUTS.tortuga.tiles.length;
    var p = LAYOUTS.piramide.tiles.length;
    console.assert(t === 144, 'Tortuga debe tener 144 fichas, tiene ' + t);
    console.assert(p === 80 && p % 2 === 0, 'Pirámide debe tener 80 fichas pares, tiene ' + p);
  })();

  // ═══════════════════════════════════════════════════════════════════
  //  Juego de fichas completo (144)
  // ═══════════════════════════════════════════════════════════════════

  function crearJuegoFichas() {
    var pool = [];
    var suits = ['circulos', 'bambues', 'caracteres'];
    var palos = ['c', 'b', 'n'];
    suits.forEach(function (kind, si) {
      for (var v = 1; v <= 9; v++) {
        var group = palos[si] + v;
        for (var cop = 0; cop < 4; cop++) {
          pool.push({ kind: kind, value: v, group: group, matchGroup: group });
        }
      }
    });
    var vientos = [
      { key: 'E', name: 'Este' },
      { key: 'S', name: 'Sur' },
      { key: 'W', name: 'Oeste' },
      { key: 'N', name: 'Norte' }
    ];
    vientos.forEach(function (w) {
      var group = 'w' + w.key;
      for (var cop = 0; cop < 4; cop++) {
        pool.push({ kind: 'wind', value: w.key, group: group, matchGroup: group });
      }
    });
    var dragones = [
      { key: 'R', name: 'Rojo' },
      { key: 'G', name: 'Verde' },
      { key: 'B', name: 'Blanco' }
    ];
    dragones.forEach(function (d) {
      var group = 'd' + d.key;
      for (var cop = 0; cop < 4; cop++) {
        pool.push({ kind: 'dragon', value: d.key, group: group, matchGroup: group });
      }
    });
    for (var f = 1; f <= 4; f++) {
      pool.push({ kind: 'flower', value: f, group: 'flower', matchGroup: 'flower' });
    }
    for (var s = 1; s <= 4; s++) {
      pool.push({ kind: 'season', value: s, group: 'season', matchGroup: 'season' });
    }
    return pool;
  }

  var JUEGO_FICHAS = crearJuegoFichas();
  console.assert(JUEGO_FICHAS.length === 144, 'El juego debe tener 144 fichas');

  // ═══════════════════════════════════════════════════════════════════
  //  Utilidades
  // ═══════════════════════════════════════════════════════════════════

  function formatearTiempo(ms) {
    if (typeof ms !== 'number' || !isFinite(ms) || ms < 0) return '00:00';
    var totalSeg = Math.floor(ms / 1000);
    var s = totalSeg % 60;
    var m = Math.floor(totalSeg / 60) % 60;
    var h = Math.floor(totalSeg / 3600);
    function dos(n) { return (n < 10 ? '0' : '') + n; }
    if (h > 0) return h + ':' + dos(m) + ':' + dos(s);
    return dos(m) + ':' + dos(s);
  }

  function esLibrePos(idx, tablero, removidas) {
    if (removidas[idx]) return false;
    var t = tablero[idx];
    for (var i = 0; i < tablero.length; i++) {
      if (i === idx || removidas[i]) continue;
      var o = tablero[i];
      if (o.z === t.z + 1 && Math.abs(o.x - t.x) < 2 && Math.abs(o.y - t.y) < 2) return false;
    }
    var bloqueadoIzq = false, bloqueadoDer = false;
    for (var j = 0; j < tablero.length; j++) {
      if (j === idx || removidas[j]) continue;
      var o2 = tablero[j];
      if (o2.z !== t.z) continue;
      if (o2.x === t.x - 2 && Math.abs(o2.y - t.y) < 2) bloqueadoIzq = true;
      if (o2.x === t.x + 2 && Math.abs(o2.y - t.y) < 2) bloqueadoDer = true;
    }
    return !(bloqueadoIzq && bloqueadoDer);
  }

  function parejaValida(fa, fb) {
    if (!fa || !fb) return false;
    return fa.matchGroup === fb.matchGroup;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Generación inversa
  // ═══════════════════════════════════════════════════════════════════

  function generarReparto(layout) {
    var positions = layout.tiles;
    var N = positions.length;
    var tablero = positions.map(function (p) {
      return { x: p.x, y: p.y, z: p.z, face: null };
    });
    var removidas = new Array(N).fill(false);

    var poolByGroup = {};
    JUEGO_FICHAS.forEach(function (f) {
      if (!poolByGroup[f.group]) poolByGroup[f.group] = [];
      poolByGroup[f.group].push(f);
    });

    var ordenSolucion = [];
    var maxIter = N * 2 + 100;
    var iter = 0;
    var restantes = N;

    while (restantes > 0 && iter < maxIter) {
      iter++;

      var libres = [];
      for (var i = 0; i < N; i++) {
        if (!removidas[i] && esLibrePos(i, tablero, removidas)) libres.push(i);
      }
      if (libres.length < 2) return null;

      var p1 = Math.floor(Math.random() * libres.length);
      var idx1 = libres[p1];
      libres.splice(p1, 1);
      var p2 = Math.floor(Math.random() * libres.length);
      var idx2 = libres[p2];

      var gruposOk = [];
      Object.keys(poolByGroup).forEach(function (g) {
        if (poolByGroup[g].length >= 2) gruposOk.push(g);
      });
      if (gruposOk.length === 0) return null;
      var grupoElegido = gruposOk[Math.floor(Math.random() * gruposOk.length)];
      var faces = poolByGroup[grupoElegido].splice(0, 2);

      tablero[idx1].face = faces[0];
      tablero[idx2].face = faces[1];

      ordenSolucion.push([idx1, idx2]);
      removidas[idx1] = true;
      removidas[idx2] = true;
      restantes -= 2;
    }

    if (restantes > 0) return null;

    // Verificación: la solución (en el orden en que se generó) es reproducible
    var verificacion = new Array(N).fill(false);
    var ok = true;
    for (var k = 0; k < ordenSolucion.length; k++) {
      var par = ordenSolucion[k];
      if (verificacion[par[0]] || verificacion[par[1]]) { ok = false; break; }
      if (!esLibrePos(par[0], tablero, verificacion)) { ok = false; break; }
      if (!esLibrePos(par[1], tablero, verificacion)) { ok = false; break; }
      if (!parejaValida(tablero[par[0]].face, tablero[par[1]].face)) { ok = false; break; }
      verificacion[par[0]] = true;
      verificacion[par[1]] = true;
    }
    console.assert(ok, 'La solución almacenada debe ser reproducible');

    return tablero;
  }

  function generarConReintentos(layout) {
    for (var intento = 0; intento < 12; intento++) {
      var t = generarReparto(layout);
      if (t) return t;
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Estado
  // ═══════════════════════════════════════════════════════════════════

  var ctxRef = null;
  var rootRef = null;
  var tableroRef = null;
  var fichasDOM = [];
  var intervalo = null;
  var tecladoConectado = false;
  var resizeListener = null;

  var DIFICULTADES = {
    relajado: { id: 'relajado', nombre: 'Relajado', layout: 'piramide', resaltarLibres: true, mezclas: -1, pistasMax: -1 },
    normal: { id: 'normal', nombre: 'Normal', layout: 'tortuga', resaltarLibres: true, mezclas: 3, pistasMax: -1 },
    desafio: { id: 'desafio', nombre: 'Desafío', layout: 'tortuga', resaltarLibres: false, mezclas: 1, pistasMax: 3 }
  };

  var S = {
    dificultad: 'normal',
    layoutId: 'tortuga',
    tablero: null,
    removidas: null,
    seleccionada: -1,
    historial: [],
    mezclasRestantes: 3,
    pistasUsadas: 0,
    pistasMax: -1,
    tiempoMs: 0,
    iniciadoEn: null,
    pausado: false,
    completado: false,
    tamFicha: 40,
    zoom: 1,
    tabActual: -1
  };

  // ═══════════════════════════════════════════════════════════════════
  //  Cronómetro
  // ═══════════════════════════════════════════════════════════════════

  function leerTiempo() {
    if (S.iniciadoEn !== null) return S.tiempoMs + (Date.now() - S.iniciadoEn);
    return S.tiempoMs;
  }

  function iniciarCrono() {
    detenerCrono();
    S.iniciadoEn = Date.now();
    intervalo = setInterval(actualizarReloj, 300);
    actualizarReloj();
  }

  function detenerCrono() {
    if (S.iniciadoEn !== null) {
      S.tiempoMs += Date.now() - S.iniciadoEn;
      S.iniciadoEn = null;
    }
    if (intervalo) { clearInterval(intervalo); intervalo = null; }
  }

  function actualizarReloj() {
    if (!rootRef) return;
    var el = rootRef.querySelector('#mj-tiempo');
    if (el) el.textContent = formatearTiempo(leerTiempo());
  }

  // ═══════════════════════════════════════════════════════════════════
  //  CSS
  // ═══════════════════════════════════════════════════════════════════

  var CSS_MJ = [
    '.mj-wrap{display:flex;flex-direction:column;gap:10px;width:100%;padding:4px;}',
    '.mj-wrap [hidden]{display:none!important;}',
    '.mj-top{display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between;align-items:center;width:100%;}',
    '.mj-panel{display:flex;gap:8px;align-items:center;padding:6px 12px;border-radius:var(--r-control);background:var(--vidrio-fondo-fuerte);border:1px solid var(--vidrio-borde);font-variant-numeric:tabular-nums;color:var(--tinta);font-size:.9rem;min-height:40px;}',
    '.mj-panel b{font-family:var(--fuente-titulo);font-weight:700;font-size:1.05rem;}',
    '.mj-acciones{display:flex;flex-wrap:wrap;gap:6px;align-items:center;}',
    '.mj-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-width:44px;min-height:44px;padding:0 12px;border-radius:var(--r-control);border:1px solid var(--vidrio-borde);background:var(--vidrio-fondo-fuerte);color:var(--tinta);font-family:inherit;font-size:.9rem;font-weight:600;cursor:pointer;}',
    '.mj-btn:hover:not(:disabled){background:var(--capa-fuerte);}',
    '.mj-btn:disabled{opacity:.35;cursor:not-allowed;}',
    '.mj-btn .ico{width:20px;height:20px;}',
    '.mj-board-wrap{position:relative;width:100%;overflow:auto;-webkit-overflow-scrolling:touch;padding:8px;border-radius:var(--r-control);background:var(--capa-suave);border:1px solid var(--vidrio-borde);}',
    '.mj-board{position:relative;margin:0 auto;touch-action:manipulation;user-select:none;-webkit-user-select:none;}',
    '.mj-ficha{position:absolute;background:var(--musgo);border-radius:5px;cursor:pointer;transition:transform 120ms ease,opacity 180ms ease;box-shadow:1px 2px 0 rgba(0,0,0,.15),2px 4px 6px rgba(0,0,0,.2);}',
    'html[data-tema="noche"] .mj-ficha{background:var(--musgo);box-shadow:1px 2px 0 rgba(0,0,0,.4),2px 4px 8px rgba(0,0,0,.5);}',
    '.mj-ficha::after{content:"";position:absolute;top:0;left:0;right:3px;bottom:4px;background:color-mix(in srgb,var(--niebla-2) 92%,var(--ambar) 8%);border-radius:4px;}',
    'html[data-tema="noche"] .mj-ficha::after{background:color-mix(in srgb,var(--niebla-2) 82%,var(--ambar) 18%);}',
    '.mj-ficha .mj-cara{position:absolute;top:0;left:0;right:3px;bottom:4px;z-index:2;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:4px;}',
    '.mj-ficha .mj-cara svg{width:85%;height:85%;display:block;}',
    '.mj-ficha:hover{transform:translateY(-1px);}',
    '.mj-ficha.seleccionada{box-shadow:0 0 0 3px var(--ambar),2px 4px 8px rgba(0,0,0,.3);}',
    '.mj-ficha.pista{box-shadow:0 0 0 3px var(--rosa-ceniza),2px 4px 8px rgba(0,0,0,.3);}',
    '.mj-ficha.quitando{opacity:0;transform:scale(.7) translateY(-10px);pointer-events:none;}',
    '.mj-ficha.rebote{animation:mj-rebote 220ms ease;}',
    '@keyframes mj-rebote{0%,100%{transform:translateX(0);}25%{transform:translateX(-2px);}75%{transform:translateX(2px);}}',
    '.mj-ficha.libre-sugerida::after{background:color-mix(in srgb,var(--niebla-2) 75%,var(--vidrio-mar) 25%);}',
    'html[data-movimiento="reducido"] .mj-ficha{transition:none!important;}',
    'html[data-movimiento="reducido"] .mj-ficha.rebote{animation:none;}',
    '.mj-velo{position:absolute;inset:0;z-index:50;background:rgba(232,236,233,.85);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;font-family:var(--fuente-titulo);font-weight:700;color:var(--tinta);font-size:var(--t-2);border-radius:var(--r-control);}',
    'html[data-tema="noche"] .mj-velo{background:rgba(29,38,35,.85);}',
    '.mj-velo[hidden]{display:none!important;}',
    '@media (max-width:520px){.mj-panel{padding:4px 10px;font-size:.8rem;min-height:36px;}.mj-panel b{font-size:.95rem;}.mj-btn{min-height:40px;padding:0 8px;font-size:.82rem;}}'
  ].join('\n');

  // ═══════════════════════════════════════════════════════════════════
  //  SVG de caras
  // ═══════════════════════════════════════════════════════════════════

  function svgCirculos(n) {
    var color = 'var(--azul)';
    var map = {
      1: [[50, 50, 20]],
      2: [[50, 32, 13], [50, 68, 13]],
      3: [[30, 30, 12], [50, 50, 12], [70, 70, 12]],
      4: [[32, 32, 12], [68, 32, 12], [32, 68, 12], [68, 68, 12]],
      5: [[28, 28, 11], [72, 28, 11], [50, 50, 11], [28, 72, 11], [72, 72, 11]],
      6: [[28, 22, 10], [50, 22, 10], [72, 22, 10], [28, 78, 10], [50, 78, 10], [72, 78, 10]],
      7: [[28, 25, 9], [50, 25, 9], [72, 25, 9], [28, 50, 9], [50, 50, 9], [72, 50, 9], [50, 75, 9]],
      8: [[30, 20, 9], [70, 20, 9], [30, 40, 9], [70, 40, 9], [30, 60, 9], [70, 60, 9], [30, 80, 9], [70, 80, 9]],
      9: [[25, 25, 8], [50, 25, 8], [75, 25, 8], [25, 50, 8], [50, 50, 8], [75, 50, 8], [25, 75, 8], [50, 75, 8], [75, 75, 8]]
    };
    var arr = map[n] || map[1];
    var s = '';
    for (var i = 0; i < arr.length; i++) {
      s += '<circle cx="' + arr[i][0] + '" cy="' + arr[i][1] + '" r="' + arr[i][2] + '" fill="' + color + '"/>';
    }
    return s;
  }

  function svgBambues(n) {
    var color = 'var(--verde)';
    var map = {
      1: [[50, 50, 44, 12]],
      2: [[38, 50, 40, 10], [62, 50, 40, 10]],
      3: [[30, 50, 34, 9], [50, 50, 44, 10], [70, 50, 34, 9]],
      4: [[32, 32, 22, 9], [68, 32, 22, 9], [32, 68, 22, 9], [68, 68, 22, 9]],
      5: [[26, 26, 20, 8], [74, 26, 20, 8], [50, 50, 26, 9], [26, 74, 20, 8], [74, 74, 20, 8]],
      6: [[28, 22, 20, 7], [50, 22, 20, 7], [72, 22, 20, 7], [28, 78, 20, 7], [50, 78, 20, 7], [72, 78, 20, 7]],
      7: [[28, 25, 18, 7], [50, 25, 18, 7], [72, 25, 18, 7], [28, 50, 18, 7], [50, 50, 18, 7], [72, 50, 18, 7], [50, 75, 22, 7]],
      8: [[30, 22, 20, 7], [70, 22, 20, 7], [30, 42, 20, 7], [70, 42, 20, 7], [30, 58, 20, 7], [70, 58, 20, 7], [30, 78, 20, 7], [70, 78, 20, 7]],
      9: [[25, 25, 16, 6], [50, 25, 16, 6], [75, 25, 16, 6], [25, 50, 16, 6], [50, 50, 16, 6], [75, 50, 16, 6], [25, 75, 16, 6], [50, 75, 16, 6], [75, 75, 16, 6]]
    };
    var arr = map[n] || map[1];
    var s = '';
    for (var i = 0; i < arr.length; i++) {
      var x = arr[i][0], y = arr[i][1], h = arr[i][2], w = arr[i][3];
      s += '<rect x="' + (x - w / 2) + '" y="' + (y - h / 2) + '" width="' + w + '" height="' + h + '" rx="' + (w / 2) + '" fill="' + color + '"/>';
      s += '<rect x="' + (x - w / 2) + '" y="' + (y - 1) + '" width="' + w + '" height="2" fill="var(--musgo)"/>';
    }
    return s;
  }

  var CJK_NUM = { 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 7: '七', 8: '八', 9: '九' };

  function svgCaracteres(n) {
    return '<text x="50" y="60" text-anchor="middle" ' +
      'font-family="\'Noto Serif SC\',\'Noto Serif TC\',\'PingFang SC\',\'Microsoft YaHei\',serif" ' +
      'font-size="52" font-weight="600" fill="var(--rosa)">' + CJK_NUM[n] + '</text>';
  }

  function svgViento(key) {
    var map = { E: '東', S: '南', W: '西', N: '北' };
    return '<text x="50" y="62" text-anchor="middle" ' +
      'font-family="\'Noto Serif SC\',\'Noto Serif TC\',\'PingFang SC\',\'Microsoft YaHei\',serif" ' +
      'font-size="50" font-weight="700" fill="var(--azul)">' + map[key] + '</text>';
  }

  function svgDragon(key) {
    if (key === 'R') {
      return '<text x="50" y="62" text-anchor="middle" ' +
        'font-family="\'Noto Serif SC\',\'Noto Serif TC\',\'PingFang SC\',\'Microsoft YaHei\',serif" ' +
        'font-size="52" font-weight="700" fill="var(--error)">中</text>';
    }
    if (key === 'G') {
      return '<text x="50" y="62" text-anchor="middle" ' +
        'font-family="\'Noto Serif SC\',\'Noto Serif TC\',\'PingFang SC\',\'Microsoft YaHei\',serif" ' +
        'font-size="52" font-weight="700" fill="var(--verde)">發</text>';
    }
    return '<rect x="20" y="20" width="60" height="60" rx="6" fill="none" stroke="var(--azul)" stroke-width="4"/>' +
      '<rect x="30" y="30" width="40" height="40" rx="3" fill="none" stroke="var(--azul)" stroke-width="2.5"/>';
  }

  function svgFlor(n) {
    var colores = ['var(--rosa)', 'var(--rosa-ceniza)', 'var(--ambar)', 'var(--rosa)'];
    var c = colores[n - 1] || 'var(--rosa)';
    var s = '';
    for (var i = 0; i < 5; i++) {
      var ang = i * 72 - 90;
      var rad = Math.PI * ang / 180;
      var px = 50 + Math.cos(rad) * 22;
      var py = 50 + Math.sin(rad) * 22;
      s += '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="10" fill="' + c + '"/>';
    }
    s += '<circle cx="50" cy="50" r="8" fill="var(--ambar)"/>';
    return s;
  }

  function svgEstacion(n) {
    var c = 'var(--vidrio-mar)';
    if (n === 1) return '<circle cx="50" cy="50" r="20" fill="' + c + '"/>';
    if (n === 2) return '<rect x="30" y="30" width="40" height="40" rx="4" fill="' + c + '"/>';
    if (n === 3) return '<polygon points="50,25 72,72 28,72" fill="' + c + '"/>';
    return '<polygon points="50,25 75,50 50,75 25,50" fill="' + c + '"/>';
  }

  function faceSVG(face) {
    var k = face.kind, v = face.value, body = '';
    if (k === 'circulos') body = svgCirculos(v);
    else if (k === 'bambues') body = svgBambues(v);
    else if (k === 'caracteres') body = svgCaracteres(v);
    else if (k === 'wind') body = svgViento(v);
    else if (k === 'dragon') body = svgDragon(v);
    else if (k === 'flower') body = svgFlor(v);
    else if (k === 'season') body = svgEstacion(v);
    return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + body + '</svg>';
  }

  function miniaturaMahjong() {
    var svg = '<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">';
    svg += '<rect x="0" y="0" width="120" height="120" rx="16" style="fill:var(--vidrio-mar);opacity:.2"/>';
    function ficha(x, y, w, h, bg, c) {
      svg += '<rect x="' + (x + 2) + '" y="' + (y + 3) + '" width="' + w + '" height="' + h + '" rx="4" style="fill:var(--musgo);opacity:.55"/>';
      svg += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="4" style="fill:' + bg + '"/>';
      if (c === 1) {
        for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) {
          svg += '<circle cx="' + (x + w / 2 + (j - 1) * w / 4) + '" cy="' + (y + h / 2 + (i - 1) * h / 4) + '" r="' + (w / 12) + '" style="fill:var(--azul)"/>';
        }
      } else if (c === 2) {
        svg += '<text x="' + (x + w / 2) + '" y="' + (y + h * 0.7) + '" text-anchor="middle" font-family="\'Noto Serif SC\',serif" font-size="' + (h * 0.65) + '" font-weight="700" style="fill:var(--rosa)">中</text>';
      } else if (c === 3) {
        svg += '<circle cx="' + (x + w / 2) + '" cy="' + (y + h / 2) + '" r="' + (w / 3) + '" style="fill:var(--verde)"/>';
      }
    }
    var bg = 'color-mix(in srgb, var(--niebla-2) 90%, var(--ambar) 10%)';
    ficha(20, 30, 28, 34, bg, 1);
    ficha(46, 24, 28, 34, bg, 2);
    ficha(72, 32, 28, 34, bg, 3);
    ficha(34, 62, 28, 34, bg, 3);
    ficha(60, 58, 28, 34, bg, 1);
    svg += '</svg>';
    return svg;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  UI
  // ═══════════════════════════════════════════════════════════════════

  function crearEstructura(root) {
    root.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.className = 'mj-wrap';

    var top = document.createElement('div');
    top.className = 'mj-top';
    top.innerHTML =
      '<div class="mj-panel">Tiempo <b id="mj-tiempo" class="tnum">00:00</b></div>' +
      '<div class="mj-panel">Pares <b id="mj-pares" class="tnum">0</b></div>' +
      '<div class="mj-panel">Fichas <b id="mj-fichas" class="tnum">0</b></div>' +
      '<div class="mj-acciones">' +
        '<button type="button" class="mj-btn" data-accion="pista" aria-label="Pista">' + icono('pista') + '</button>' +
        '<button type="button" class="mj-btn" data-accion="deshacer" aria-label="Deshacer">' + icono('deshacer') + '</button>' +
        '<button type="button" class="mj-btn" data-accion="mezclar" aria-label="Mezclar">' + icono('mezclar') + '</button>' +
        '<button type="button" class="mj-btn" data-accion="zoom-out" aria-label="Alejar">' + icono('alejar') + '</button>' +
        '<button type="button" class="mj-btn" data-accion="zoom-in" aria-label="Acercar">' + icono('acercar') + '</button>' +
      '</div>';
    wrap.appendChild(top);

    var bw = document.createElement('div');
    bw.className = 'mj-board-wrap';
    bw.id = 'mj-board-wrap';
    var tablero = document.createElement('div');
    tablero.className = 'mj-board';
    tablero.id = 'mj-board';
    bw.appendChild(tablero);
    wrap.appendChild(bw);

    var velo = document.createElement('div');
    velo.className = 'mj-velo';
    velo.id = 'mj-velo';
    velo.hidden = true;
    velo.textContent = 'En pausa';
    bw.appendChild(velo);

    root.appendChild(wrap);
    rootRef = root;
    tableroRef = tablero;
  }

  function icono(nombre) {
    var svg = (ctxRef && ctxRef.iconos && ctxRef.iconos[nombre]) || '';
    return '<span class="ico" aria-hidden="true">' + svg + '</span>';
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Render
  // ═══════════════════════════════════════════════════════════════════

  function calcularBordes() {
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    S.tablero.forEach(function (t) {
      if (t.x < minX) minX = t.x;
      if (t.x > maxX) maxX = t.x;
      if (t.y < minY) minY = t.y;
      if (t.y > maxY) maxY = t.y;
    });
    return { minX: minX, maxX: maxX, minY: minY, maxY: maxY };
  }

  function calcularTamFicha() {
    if (!tableroRef) return 40;
    var b = calcularBordes();
    var cols = (b.maxX - b.minX) / 2 + 1;
    var rows = (b.maxY - b.minY) / 2 + 1;
    var wrap = rootRef.querySelector('#mj-board-wrap');
    if (!wrap) return 40;
    var anchoDisp = wrap.clientWidth - 20;
    var altoDisp = Math.min(window.innerHeight * 0.6, 560);
    var tamPorAncho = anchoDisp / cols;
    var tamPorAlto = altoDisp / rows;
    var tam = Math.min(tamPorAncho, tamPorAlto, 60);
    tam = Math.max(20, tam);
    return Math.floor(tam);
  }

  function renderFichas() {
    if (!tableroRef) return;
    tableroRef.innerHTML = '';
    fichasDOM = [];

    var b = calcularBordes();
    var tam = calcularTamFicha() * S.zoom;
    S.tamFicha = tam;

    var zOffX = tam * 0.08;
    var zOffY = tam * 0.12;

    var maxZ = 0;
    S.tablero.forEach(function (t) { if (t.z > maxZ) maxZ = t.z; });

    var boardW = ((b.maxX - b.minX) / 2 + 1) * tam + maxZ * zOffX + 4;
    var boardH = ((b.maxY - b.minY) / 2 + 1) * tam + maxZ * zOffY + 4;
    tableroRef.style.width = boardW + 'px';
    tableroRef.style.height = boardH + 'px';
    tableroRef.style.padding = '4px';
    tableroRef.style.paddingBottom = (maxZ * zOffY + 8) + 'px';

    S.tablero.forEach(function (t, idx) {
      if (S.removidas[idx]) { fichasDOM[idx] = null; return; }
      var el = document.createElement('div');
      el.className = 'mj-ficha';
      el.setAttribute('role', 'button');
      el.setAttribute('data-i', idx);
      var left = ((t.x - b.minX) / 2) * tam + t.z * zOffX;
      var top = ((t.y - b.minY) / 2) * tam - t.z * zOffY;
      el.style.left = left + 'px';
      el.style.top = top + 'px';
      el.style.width = (tam - 2) + 'px';
      el.style.height = (tam - 2) + 'px';
      el.style.zIndex = String(t.z * 1000 + t.y * 20 + t.x + 10);

      var cara = document.createElement('div');
      cara.className = 'mj-cara';
      cara.innerHTML = faceSVG(t.face);
      el.appendChild(cara);

      var lbl = etiquetaFicha(t.face);
      el.setAttribute('aria-label', lbl + ', capa ' + (t.z + 1));

      if (idx === S.seleccionada) el.classList.add('seleccionada');
      if (idx === S.tabActual) el.classList.add('pista');

      tableroRef.appendChild(el);
      fichasDOM[idx] = el;
    });
  }

  function etiquetaFicha(face) {
    if (!face) return 'ficha';
    var nombres = { circulos: 'círculos', bambues: 'bambúes', caracteres: 'caracteres' };
    if (nombres[face.kind]) return nombres[face.kind] + ' ' + face.value;
    if (face.kind === 'wind') {
      var v = { E: 'este', S: 'sur', W: 'oeste', N: 'norte' };
      return 'viento ' + v[face.value];
    }
    if (face.kind === 'dragon') {
      var d = { R: 'rojo', G: 'verde', B: 'blanco' };
      return 'dragón ' + d[face.value];
    }
    if (face.kind === 'flower') return 'flor ' + face.value;
    if (face.kind === 'season') return 'estación ' + face.value;
    return 'ficha';
  }

  function actualizarStats() {
    if (!rootRef) return;
    var pares = 0;
    for (var i = 0; i < S.removidas.length; i++) if (S.removidas[i]) pares++;
    pares = pares / 2;
    var restantes = S.removidas.length - pares * 2;
    var elPares = rootRef.querySelector('#mj-pares');
    var elFichas = rootRef.querySelector('#mj-fichas');
    if (elPares) elPares.textContent = String(pares);
    if (elFichas) elFichas.textContent = String(restantes);
  }

  function actualizarBotones() {
    if (!rootRef) return;
    var bPista = rootRef.querySelector('[data-accion="pista"]');
    var bDes = rootRef.querySelector('[data-accion="deshacer"]');
    var bMez = rootRef.querySelector('[data-accion="mezclar"]');
    if (bPista) bPista.disabled = S.pistasMax >= 0 && S.pistasUsadas >= S.pistasMax;
    if (bDes) bDes.disabled = S.historial.length === 0;
    if (bMez) bMez.disabled = S.mezclasRestantes === 0;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Lógica
  // ═══════════════════════════════════════════════════════════════════

  function esLibreFicha(idx) {
    return esLibrePos(idx, S.tablero, S.removidas);
  }

  function limpiarPista() {
    if (S.tabActual >= 0 && fichasDOM[S.tabActual]) fichasDOM[S.tabActual].classList.remove('pista');
    S.tabActual = -1;
  }

  function limpiarSeleccion() {
    if (S.seleccionada >= 0 && fichasDOM[S.seleccionada]) fichasDOM[S.seleccionada].classList.remove('seleccionada');
    S.seleccionada = -1;
  }

  function tomarSnapshot() {
    return {
      caras: S.tablero.map(function (t) { return t.face; }),
      removidas: Array.from(S.removidas),
      mezclasRestantes: S.mezclasRestantes,
      pistasUsadas: S.pistasUsadas
    };
  }

  function restaurarSnapshot(snap) {
    S.tablero.forEach(function (t, i) { t.face = snap.caras[i]; });
    S.removidas = Array.from(snap.removidas);
    S.mezclasRestantes = snap.mezclasRestantes;
    S.pistasUsadas = snap.pistasUsadas;
  }

  function intentarSeleccionar(idx) {
    if (S.completado || S.pausado) return;
    if (S.removidas[idx]) return;

    if (!esLibreFicha(idx)) {
      var el = fichasDOM[idx];
      if (el) {
        el.classList.add('rebote');
        setTimeout(function () { if (el) el.classList.remove('rebote'); }, 240);
      }
      return;
    }

    if (S.seleccionada === idx) {
      limpiarSeleccion();
      ctxRef.sfx('toque');
      return;
    }

    if (S.seleccionada >= 0) {
      var prev = S.seleccionada;
      if (parejaValida(S.tablero[prev].face, S.tablero[idx].face)) {
        S.historial.push({ tipo: 'par', snapshotAntes: tomarSnapshot() });
        removerPar(prev, idx);
        return;
      }
    }

    limpiarSeleccion();
    S.seleccionada = idx;
    if (fichasDOM[idx]) fichasDOM[idx].classList.add('seleccionada');
    ctxRef.sfx('toque');
  }

  function removerPar(i, j) {
    S.seleccionada = -1;
    if (fichasDOM[i]) fichasDOM[i].classList.add('quitando');
    if (fichasDOM[j]) fichasDOM[j].classList.add('quitando');
    S.removidas[i] = true;
    S.removidas[j] = true;
    ctxRef.sfx('ok');
    setTimeout(function () {
      if (fichasDOM[i]) { fichasDOM[i].style.display = 'none'; fichasDOM[i].classList.remove('quitando'); }
      if (fichasDOM[j]) { fichasDOM[j].style.display = 'none'; fichasDOM[j].classList.remove('quitando'); }
    }, 200);
    actualizarStats();
    actualizarBotones();
    limpiarPista();
    comprobarVictoria();

    // Aviso de "sin movimientos"
    if (!S.completado && !buscarParDisponible()) {
      ctxRef.toast(S.mezclasRestantes === 0
        ? 'No quedan movimientos. Usa Deshacer o empieza una partida nueva.'
        : 'No quedan movimientos. Toca Mezclar.');
    }
  }

  function comprobarVictoria() {
    if (S.completado) return;
    for (var i = 0; i < S.removidas.length; i++) if (!S.removidas[i]) return;
    S.completado = true;
    detenerCrono();
    var ms = leerTiempo();
    actualizarReloj();
    ctxRef.reportar({ tipo: 'victoria', dificultad: S.dificultad, tiempoMs: ms });
    var dif = DIFICULTADES[S.dificultad];
    var mezclasUsadas = dif.mezclas === -1 ? '∞' : (dif.mezclas - S.mezclasRestantes);
    ctxRef.celebrar({
      titulo: 'Tablero despejado',
      detalle: 'Tiempo: ' + formatearTiempo(ms) + ' · Mezclas usadas: ' + mezclasUsadas
    });
  }

  function buscarParDisponible() {
    var libres = [];
    for (var i = 0; i < S.tablero.length; i++) {
      if (!S.removidas[i] && esLibreFicha(i)) libres.push(i);
    }
    for (var a = 0; a < libres.length; a++) {
      for (var b = a + 1; b < libres.length; b++) {
        if (parejaValida(S.tablero[libres[a]].face, S.tablero[libres[b]].face)) {
          return [libres[a], libres[b]];
        }
      }
    }
    return null;
  }

  function darPista() {
    if (S.completado || S.pausado) return;
    if (S.pistasMax >= 0 && S.pistasUsadas >= S.pistasMax) {
      ctxRef.toast('No quedan pistas');
      return;
    }
    var par = buscarParDisponible();
    if (!par) {
      ctxRef.toast('No hay pares disponibles. Prueba a mezclar.');
      return;
    }
    limpiarPista();
    S.pistasUsadas++;
    S.tabActual = par[0];
    if (fichasDOM[par[0]]) fichasDOM[par[0]].classList.add('pista');
    if (fichasDOM[par[1]]) {
      fichasDOM[par[1]].classList.add('pista');
      setTimeout(function () {
        if (fichasDOM[par[1]]) fichasDOM[par[1]].classList.remove('pista');
        if (fichasDOM[par[0]]) fichasDOM[par[0]].classList.remove('pista');
        if (S.tabActual === par[0]) S.tabActual = -1;
      }, 2600);
    }
    actualizarBotones();
    ctxRef.sfx('toque');
  }

  function deshacer() {
    if (S.completado || S.pausado) return;
    if (!S.historial.length) return;
    var accion = S.historial.pop();
    restaurarSnapshot(accion.snapshotAntes);
    limpiarSeleccion();
    limpiarPista();
    renderFichas();
    actualizarStats();
    actualizarBotones();
    ctxRef.sfx('toque');
  }

  function mezclar() {
    if (S.completado || S.pausado) return;
    if (S.mezclasRestantes === 0) return;

    var carasRestantes = [];
    for (var i = 0; i < S.tablero.length; i++) {
      if (!S.removidas[i]) carasRestantes.push(S.tablero[i].face);
    }
    if (carasRestantes.length % 2 !== 0) return;

    var porGrupo = {};
    carasRestantes.forEach(function (c) {
      if (!porGrupo[c.matchGroup]) porGrupo[c.matchGroup] = [];
      porGrupo[c.matchGroup].push(c);
    });

    var intentos = 0;
    while (intentos < 20) {
      intentos++;
      var nuevo = intentarMezcla(porGrupo);
      if (nuevo) {
        S.historial.push({ tipo: 'mezcla', snapshotAntes: tomarSnapshot() });
        S.tablero.forEach(function (t, idx) {
          if (!S.removidas[idx]) t.face = nuevo[idx];
        });
        if (S.mezclasRestantes > 0) S.mezclasRestantes--;
        limpiarSeleccion();
        limpiarPista();
        renderFichas();
        actualizarBotones();
        ctxRef.sfx('mezclar');
        ctxRef.toast('Mezclado');
        return;
      }
    }
    ctxRef.toast('No se pudo mezclar');
  }

  function intentarMezcla(porGrupo) {
    var copia = {};
    Object.keys(porGrupo).forEach(function (g) {
      copia[g] = porGrupo[g].slice();
    });

    var posicionesLibres = [];
    for (var i = 0; i < S.tablero.length; i++) {
      if (!S.removidas[i]) posicionesLibres.push(i);
    }
    var removidasSim = S.removidas.slice();
    var nuevo = new Array(S.tablero.length);
    S.tablero.forEach(function (t, idx) {
      if (S.removidas[idx]) nuevo[idx] = t.face;
    });

    var iter = 0;
    var restantes = posicionesLibres.length;
    while (restantes > 0 && iter < 500) {
      iter++;
      var libres = [];
      for (var j = 0; j < posicionesLibres.length; j++) {
        var idx = posicionesLibres[j];
        if (!removidasSim[idx] && esLibrePos(idx, S.tablero, removidasSim)) libres.push(idx);
      }
      if (libres.length < 2) return null;

      var p1 = Math.floor(Math.random() * libres.length);
      var i1 = libres[p1];
      libres.splice(p1, 1);
      var p2 = Math.floor(Math.random() * libres.length);
      var i2 = libres[p2];

      var gruposOk = [];
      Object.keys(copia).forEach(function (g) {
        if (copia[g].length >= 2) gruposOk.push(g);
      });
      if (!gruposOk.length) return null;
      var gEleg = gruposOk[Math.floor(Math.random() * gruposOk.length)];
      var f1 = copia[gEleg].splice(0, 1)[0];
      var f2 = copia[gEleg].splice(0, 1)[0];

      nuevo[i1] = f1;
      nuevo[i2] = f2;
      removidasSim[i1] = true;
      removidasSim[i2] = true;
      restantes -= 2;
    }
    if (restantes > 0) return null;
    return nuevo;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Inicio
  // ═══════════════════════════════════════════════════════════════════

  function iniciarNueva(dificultadId) {
    var conf = DIFICULTADES[dificultadId] || DIFICULTADES.normal;
    S.dificultad = conf.id;
    S.layoutId = conf.layout;
    S.mezclasRestantes = conf.mezclas;
    S.pistasMax = conf.pistasMax;
    S.pistasUsadas = 0;
    S.seleccionada = -1;
    S.tabActual = -1;
    S.historial = [];
    S.completado = false;
    S.pausado = false;
    S.tiempoMs = 0;
    S.iniciadoEn = null;
    detenerCrono();

    var velo = rootRef && rootRef.querySelector('#mj-velo');
    if (velo) velo.hidden = true;

    var layout = LAYOUTS[conf.layout];
    var tab = generarConReintentos(layout);
    if (!tab) {
      tab = layout.tiles.map(function (p, i) {
        return { x: p.x, y: p.y, z: p.z, face: JUEGO_FICHAS[i % JUEGO_FICHAS.length] };
      });
    }
    S.tablero = tab;
    S.removidas = new Array(tab.length).fill(false);

    renderFichas();
    actualizarStats();
    actualizarBotones();
    actualizarReloj();
    iniciarCrono();
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Serialización
  // ═══════════════════════════════════════════════════════════════════

  function serializar() {
    if (!S.tablero || S.completado) return null;
    return {
      v: 1,
      dificultad: S.dificultad,
      layoutId: S.layoutId,
      caras: S.tablero.map(function (t) { return t.face; }),
      removidas: Array.from(S.removidas),
      // Solo las últimas 5 jugadas para no inflar el guardado
      historial: S.historial.slice(-5),
      mezclasRestantes: S.mezclasRestantes,
      pistasUsadas: S.pistasUsadas,
      pistasMax: S.pistasMax,
      tiempoMs: leerTiempo(),
      zoom: S.zoom
    };
  }

  function restaurar(estado) {
    if (!estado || !estado.caras) { iniciarNueva('normal'); return false; }
    try {
      var layout = LAYOUTS[estado.layoutId] || LAYOUTS.tortuga;
      S.dificultad = estado.dificultad || 'normal';
      S.layoutId = estado.layoutId || 'tortuga';
      S.tablero = layout.tiles.map(function (p, i) {
        return { x: p.x, y: p.y, z: p.z, face: estado.caras[i] };
      });
      S.removidas = new Uint8Array(estado.removidas.length);
      for (var i = 0; i < estado.removidas.length; i++) S.removidas[i] = estado.removidas[i] ? 1 : 0;
      S.historial = Array.isArray(estado.historial) ? estado.historial.slice() : [];
      S.mezclasRestantes = typeof estado.mezclasRestantes === 'number' ? estado.mezclasRestantes : 3;
      S.pistasUsadas = typeof estado.pistasUsadas === 'number' ? estado.pistasUsadas : 0;
      S.pistasMax = typeof estado.pistasMax === 'number' ? estado.pistasMax : -1;
      S.zoom = typeof estado.zoom === 'number' ? estado.zoom : 1;
      S.seleccionada = -1;
      S.tabActual = -1;
      S.completado = false;
      S.pausado = false;
      S.tiempoMs = typeof estado.tiempoMs === 'number' ? estado.tiempoMs : 0;
      S.iniciadoEn = null;

      var velo = rootRef && rootRef.querySelector('#mj-velo');
      if (velo) velo.hidden = true;

      renderFichas();
      actualizarStats();
      actualizarBotones();
      actualizarReloj();
      iniciarCrono();
      return true;
    } catch (e) {
      iniciarNueva('normal');
      return false;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Eventos
  // ═══════════════════════════════════════════════════════════════════

  function onClick(e) {
    if (S.completado || S.pausado) return;
    var el = e.target.closest && e.target.closest('.mj-ficha');
    if (!el) return;
    var idx = parseInt(el.getAttribute('data-i'), 10);
    if (isNaN(idx)) return;
    intentarSeleccionar(idx);
  }

  function onKeyDown(e) {
    if (e.target && /^(SELECT|INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (!S.tablero || S.pausado || S.completado) return;

    // Flechas para recorrer fichas libres (Tab queda libre para navegar botones)
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      var libres = [];
      for (var i = 0; i < S.tablero.length; i++) {
        if (!S.removidas[i] && esLibreFicha(i)) libres.push(i);
      }
      if (!libres.length) return;
      var pos = libres.indexOf(S.tabActual);
      var paso = e.key === 'ArrowRight' ? 1 : -1;
      if (pos < 0) pos = paso > 0 ? -1 : 0;
      var nuevo = libres[(pos + paso + libres.length) % libres.length];
      limpiarPista();
      S.tabActual = nuevo;
      if (fichasDOM[nuevo]) {
        fichasDOM[nuevo].classList.add('pista');
        try { fichasDOM[nuevo].scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (err) { /* nada */ }
      }
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      if (e.target && /^(BUTTON|A)$/.test(e.target.tagName)) return;
      if (S.tabActual >= 0) {
        e.preventDefault();
        intentarSeleccionar(S.tabActual);
      }
      return;
    }
    if (e.key === 'h' || e.key === 'H') { e.preventDefault(); darPista(); return; }
    if (e.key === 'z' || e.key === 'Z') {
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); deshacer(); }
      return;
    }
  }

  function conectarEventos(root) {
    var board = root.querySelector('#mj-board');
    if (board) board.addEventListener('click', onClick);

    var acciones = root.querySelector('.mj-acciones');
    if (acciones) {
      acciones.addEventListener('click', function (e) {
        var btn = e.target.closest('.mj-btn');
        if (!btn || btn.disabled) return;
        var acc = btn.getAttribute('data-accion');
        if (acc === 'pista') darPista();
        else if (acc === 'deshacer') deshacer();
        else if (acc === 'mezclar') mezclar();
        else if (acc === 'zoom-in') { S.zoom = Math.min(2.5, S.zoom + 0.15); renderFichas(); }
        else if (acc === 'zoom-out') { S.zoom = Math.max(0.7, S.zoom - 0.15); renderFichas(); }
      });
    }

    if (!tecladoConectado) {
      document.addEventListener('keydown', onKeyDown);
      tecladoConectado = true;
    }

    if (resizeListener) window.removeEventListener('resize', resizeListener);
    var tId = null;
    resizeListener = function () {
      if (tId) clearTimeout(tId);
      tId = setTimeout(function () {
        if (S.tablero) renderFichas();
      }, 150);
    };
    window.addEventListener('resize', resizeListener);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Registro
  // ═══════════════════════════════════════════════════════════════════

  Arcade.register({
    id: 'mahjong',
    nombre: 'Mahjong',
    descripcion: 'Empareja fichas iguales y despeja el tablero.',
    dificultades: [
      { id: 'relajado', nombre: 'Relajado' },
      { id: 'normal', nombre: 'Normal' },
      { id: 'desafio', nombre: 'Desafío' }
    ],
    dificultadPorDefecto: 'normal',

    thumbnail: function () { return miniaturaMahjong(); },

    mount: function (root, ctx) {
      ctxRef = ctx;
      ctx.inyectarEstilos(CSS_MJ);
      crearEstructura(root);
      conectarEventos(root);
      iniciarNueva('normal');
    },

    nuevaPartida: function (dificultadId) {
      if (!rootRef) return;
      iniciarNueva(dificultadId || S.dificultad);
    },

    pausar: function () {
      if (S.completado) return;
      S.pausado = true;
      detenerCrono();
      var velo = rootRef && rootRef.querySelector('#mj-velo');
      if (velo) velo.hidden = false;
    },

    reanudar: function () {
      if (S.completado) return;
      S.pausado = false;
      iniciarCrono();
      var velo = rootRef && rootRef.querySelector('#mj-velo');
      if (velo) velo.hidden = true;
    },

    serializar: function () { return serializar(); },

    restaurar: function (estado) { return restaurar(estado); },

    destruir: function () {
      detenerCrono();
      if (tecladoConectado) {
        document.removeEventListener('keydown', onKeyDown);
        tecladoConectado = false;
      }
      if (resizeListener) {
        window.removeEventListener('resize', resizeListener);
        resizeListener = null;
      }
      ctxRef = null;
      rootRef = null;
      tableroRef = null;
      fichasDOM = [];
    }
  });
})();
