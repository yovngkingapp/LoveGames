/* games/sudoku.js — Sudoku con generación por técnicas lógicas, notas, pistas y guardado. */
(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  //  Utilidades compartidas por el generador y la interfaz
  // ═══════════════════════════════════════════════════════════════════

  var PEERS = (function () {
    var r = [];
    for (var i = 0; i < 81; i++) {
      var f = Math.floor(i / 9), c = i % 9;
      var set = {};
      for (var k = 0; k < 9; k++) { set[f * 9 + k] = true; set[k * 9 + c] = true; }
      var bf = Math.floor(f / 3) * 3, bc = Math.floor(c / 3) * 3;
      for (var ff = 0; ff < 3; ff++) for (var cc = 0; cc < 3; cc++) set[(bf + ff) * 9 + (bc + cc)] = true;
      delete set[i];
      r.push(Object.keys(set).map(Number));
    }
    return r;
  })();

  var UNITS = (function () {
    var r = [], f, c, ff, cc, b, bf, bc, u;
    for (f = 0; f < 9; f++) { u = []; for (c = 0; c < 9; c++) u.push(f * 9 + c); r.push(u); }
    for (c = 0; c < 9; c++) { u = []; for (f = 0; f < 9; f++) u.push(f * 9 + c); r.push(u); }
    for (b = 0; b < 9; b++) {
      bf = Math.floor(b / 3) * 3; bc = (b % 3) * 3; u = [];
      for (ff = 0; ff < 3; ff++) for (cc = 0; cc < 3; cc++) u.push((bf + ff) * 9 + (bc + cc));
      r.push(u);
    }
    return r;
  })();

  function contarBits(m) { var c = 0; while (m) { m &= m - 1; c++; } return c; }
  function bitACifra(b) { for (var v = 1; v <= 9; v++) if (b === (1 << (v - 1))) return v; return 0; }

  function formatearTiempo(ms) {
    if (typeof ms !== 'number' || !isFinite(ms) || ms < 0) return '00:00';
    var s = Math.floor(ms / 1000) % 60;
    var m = Math.floor(ms / 60000) % 60;
    var h = Math.floor(ms / 3600000);
    function dos(n) { return (n < 10 ? '0' : '') + n; }
    if (h > 0) return h + ':' + dos(m) + ':' + dos(s);
    return dos(m) + ':' + dos(s);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  GENERADOR DE PUZZLES (autocontenido, se envía al Web Worker)
  // ═══════════════════════════════════════════════════════════════════

  function generarPuzzleCompleto(dificultad) {
    'use strict';

    // ─── Precomputar ───
    var PEERS_L = [];
    var UNITS_L = [];
    (function () {
      var i, f, c, b, ff, cc, bf, bc;
      for (i = 0; i < 81; i++) {
        f = Math.floor(i / 9); c = i % 9;
        var set = {};
        for (var k = 0; k < 9; k++) { set[f * 9 + k] = true; set[k * 9 + c] = true; }
        bf = Math.floor(f / 3) * 3; bc = Math.floor(c / 3) * 3;
        for (ff = 0; ff < 3; ff++) for (cc = 0; cc < 3; cc++) set[(bf + ff) * 9 + (bc + cc)] = true;
        delete set[i];
        PEERS_L[i] = Object.keys(set).map(Number);
      }
      for (f = 0; f < 9; f++) { var u = []; for (c = 0; c < 9; c++) u.push(f * 9 + c); UNITS_L.push(u); }
      for (c = 0; c < 9; c++) { var u2 = []; for (f = 0; f < 9; f++) u2.push(f * 9 + c); UNITS_L.push(u2); }
      for (b = 0; b < 9; b++) {
        bf = Math.floor(b / 3) * 3; bc = (b % 3) * 3; var u3 = [];
        for (ff = 0; ff < 3; ff++) for (cc = 0; cc < 3; cc++) u3.push((bf + ff) * 9 + (bc + cc));
        UNITS_L.push(u3);
      }
    })();

    function contarBitsL(m) { var c = 0; while (m) { m &= m - 1; c++; } return c; }
    function bitACifraL(b) { for (var v = 1; v <= 9; v++) if (b === (1 << (v - 1))) return v; return 0; }

    // ─── Generar tablero completo ───
    function generarCompleto() {
      var tablero = new Int8Array(81);
      var filas = new Int32Array(9), cols = new Int32Array(9), cajas = new Int32Array(9);
      function rec(i) {
        if (i === 81) return true;
        var f = Math.floor(i / 9), c = i % 9;
        var b = Math.floor(f / 3) * 3 + Math.floor(c / 3);
        var usado = filas[f] | cols[c] | cajas[b];
        var disponibles = (~usado) & 0x1FF;
        var lista = [];
        for (var v = 1; v <= 9; v++) if (disponibles & (1 << (v - 1))) lista.push(v);
        for (var k = lista.length - 1; k > 0; k--) {
          var j = Math.floor(Math.random() * (k + 1));
          var t = lista[k]; lista[k] = lista[j]; lista[j] = t;
        }
        for (var n = 0; n < lista.length; n++) {
          var val = lista[n], bit = 1 << (val - 1);
          tablero[i] = val;
          filas[f] |= bit; cols[c] |= bit; cajas[b] |= bit;
          if (rec(i + 1)) return true;
          tablero[i] = 0;
          filas[f] &= ~bit; cols[c] &= ~bit; cajas[b] &= ~bit;
        }
        return false;
      }
      rec(0);
      return tablero;
    }

    // ─── Contar soluciones con MRV, límite ───
    function contarSoluciones(orig, limite) {
      var tablero = new Int8Array(orig);
      var filas = new Int32Array(9), cols = new Int32Array(9), cajas = new Int32Array(9);
      for (var i = 0; i < 81; i++) {
        if (tablero[i]) {
          var bit = 1 << (tablero[i] - 1);
          var f = Math.floor(i / 9), c = i % 9;
          var b = Math.floor(f / 3) * 3 + Math.floor(c / 3);
          filas[f] |= bit; cols[c] |= bit; cajas[b] |= bit;
        }
      }
      var cuenta = 0;
      function rec() {
        var mejorIdx = -1, mejorMask = 0, mejorN = 10;
        for (var i = 0; i < 81; i++) {
          if (tablero[i]) continue;
          var f = Math.floor(i / 9), c = i % 9;
          var b = Math.floor(f / 3) * 3 + Math.floor(c / 3);
          var usado = filas[f] | cols[c] | cajas[b];
          var mask = (~usado) & 0x1FF;
          var n = contarBitsL(mask);
          if (n === 0) return;
          if (n < mejorN) { mejorN = n; mejorMask = mask; mejorIdx = i; if (n === 1) break; }
        }
        if (mejorIdx === -1) { cuenta++; return; }
        var f2 = Math.floor(mejorIdx / 9), c2 = mejorIdx % 9;
        var b2 = Math.floor(f2 / 3) * 3 + Math.floor(c2 / 3);
        var m = mejorMask;
        while (m) {
          var bit = m & -m; m ^= bit;
          tablero[mejorIdx] = bitACifraL(bit);
          filas[f2] |= bit; cols[c2] |= bit; cajas[b2] |= bit;
          rec();
          tablero[mejorIdx] = 0;
          filas[f2] &= ~bit; cols[c2] &= ~bit; cajas[b2] &= ~bit;
          if (cuenta >= limite) return;
        }
      }
      rec();
      return cuenta;
    }

    // ─── Quitar celdas manteniendo solución única ───
    function quitarHasta(solucion, objetivo) {
      var puzzle = new Int8Array(solucion);
      var orden = [];
      for (var i = 0; i < 81; i++) orden.push(i);
      for (var k = 80; k > 0; k--) {
        var j = Math.floor(Math.random() * (k + 1));
        var t = orden[k]; orden[k] = orden[j]; orden[j] = t;
      }
      var actuales = 81;
      for (var k = 0; k < 81 && actuales > objetivo; k++) {
        var idx = orden[k], orig = puzzle[idx];
        puzzle[idx] = 0;
        if (contarSoluciones(puzzle, 2) !== 1) puzzle[idx] = orig;
        else actuales--;
      }
      return puzzle;
    }

    // ─── Candidatos ───
    function actualizarCandidatos(t, cand) {
      for (var i = 0; i < 81; i++) {
        if (t[i]) { cand[i] = 0; continue; }
        var usado = 0;
        var ps = PEERS_L[i];
        for (var k = 0; k < ps.length; k++) { var v = t[ps[k]]; if (v) usado |= 1 << (v - 1); }
        cand[i] = (~usado) & 0x1FF;
      }
    }

    function colocar(t, cand, i, v) {
      t[i] = v; cand[i] = 0;
      var bit = 1 << (v - 1), ps = PEERS_L[i];
      for (var k = 0; k < ps.length; k++) cand[ps[k]] &= ~bit;
    }

    // ─── Técnicas ───
    function singleDesnudo(t, cand) {
      for (var i = 0; i < 81; i++) {
        if (t[i] === 0 && contarBitsL(cand[i]) === 1) {
          colocar(t, cand, i, bitACifraL(cand[i])); return true;
        }
      }
      return false;
    }

    function singleOculto(t, cand) {
      for (var u = 0; u < UNITS_L.length; u++) {
        var unit = UNITS_L[u];
        for (var v = 1; v <= 9; v++) {
          var bit = 1 << (v - 1), celda = -1, cuenta = 0;
          for (var k = 0; k < 9; k++) {
            var i = unit[k];
            if (t[i] === 0 && (cand[i] & bit)) { cuenta++; celda = i; if (cuenta > 1) break; }
          }
          if (cuenta === 1) { colocar(t, cand, celda, v); return true; }
        }
      }
      return false;
    }

    function parejaDesnuda(t, cand) {
      for (var u = 0; u < UNITS_L.length; u++) {
        var unit = UNITS_L[u];
        for (var a = 0; a < 9; a++) {
          var ia = unit[a];
          if (t[ia] !== 0 || contarBitsL(cand[ia]) !== 2) continue;
          for (var b = a + 1; b < 9; b++) {
            var ib = unit[b];
            if (t[ib] !== 0 || cand[ib] !== cand[ia]) continue;
            var mask = cand[ia], cambio = false;
            for (var k = 0; k < 9; k++) {
              var i = unit[k];
              if (i !== ia && i !== ib && t[i] === 0 && (cand[i] & mask)) { cand[i] &= ~mask; cambio = true; }
            }
            if (cambio) return true;
          }
        }
      }
      return false;
    }

    function parejaOculta(t, cand) {
      for (var u = 0; u < UNITS_L.length; u++) {
        var unit = UNITS_L[u];
        for (var v1 = 1; v1 <= 8; v1++) {
          var b1 = 1 << (v1 - 1), c1 = [];
          for (var k = 0; k < 9; k++) { var i = unit[k]; if (t[i] === 0 && (cand[i] & b1)) c1.push(i); }
          if (c1.length !== 2) continue;
          for (var v2 = v1 + 1; v2 <= 9; v2++) {
            var b2 = 1 << (v2 - 1), c2 = [];
            for (var k2 = 0; k2 < 9; k2++) { var i2 = unit[k2]; if (t[i2] === 0 && (cand[i2] & b2)) c2.push(i2); }
            if (c2.length !== 2) continue;
            if (c1[0] === c2[0] && c1[1] === c2[1]) {
              var mask = b1 | b2, cambio = false;
              for (var p = 0; p < 2; p++) if (cand[c1[p]] !== mask) { cand[c1[p]] = mask; cambio = true; }
              if (cambio) return true;
            }
          }
        }
      }
      return false;
    }

    function puntero(t, cand) {
      for (var b = 0; b < 9; b++) {
        var bf = Math.floor(b / 3) * 3, bc = (b % 3) * 3;
        for (var v = 1; v <= 9; v++) {
          var bit = 1 << (v - 1), celdas = [];
          for (var ff = 0; ff < 3; ff++) for (var cc = 0; cc < 3; cc++) {
            var i = (bf + ff) * 9 + (bc + cc);
            if (t[i] === 0 && (cand[i] & bit)) celdas.push(i);
          }
          if (celdas.length < 2) continue;
          var fila = Math.floor(celdas[0] / 9), mismaF = true;
          for (var k = 1; k < celdas.length; k++) if (Math.floor(celdas[k] / 9) !== fila) { mismaF = false; break; }
          if (mismaF) {
            var cambio = false;
            for (var c = 0; c < 9; c++) {
              if (c >= bc && c < bc + 3) continue;
              var ii = fila * 9 + c;
              if (t[ii] === 0 && (cand[ii] & bit)) { cand[ii] &= ~bit; cambio = true; }
            }
            if (cambio) return true;
          }
          var col = celdas[0] % 9, mismaC = true;
          for (var k2 = 1; k2 < celdas.length; k2++) if (celdas[k2] % 9 !== col) { mismaC = false; break; }
          if (mismaC) {
            var cambio2 = false;
            for (var f = 0; f < 9; f++) {
              if (f >= bf && f < bf + 3) continue;
              var ii2 = f * 9 + col;
              if (t[ii2] === 0 && (cand[ii2] & bit)) { cand[ii2] &= ~bit; cambio2 = true; }
            }
            if (cambio2) return true;
          }
        }
      }
      return false;
    }

    function lineaCaja(t, cand) {
      for (var f = 0; f < 9; f++) {
        for (var v = 1; v <= 9; v++) {
          var bit = 1 << (v - 1), celdas = [];
          for (var c = 0; c < 9; c++) { var i = f * 9 + c; if (t[i] === 0 && (cand[i] & bit)) celdas.push(i); }
          if (celdas.length < 2) continue;
          var b0 = Math.floor((celdas[0] % 9) / 3), misma = true;
          for (var k = 1; k < celdas.length; k++) if (Math.floor((celdas[k] % 9) / 3) !== b0) { misma = false; break; }
          if (misma) {
            var bf = Math.floor(f / 3) * 3, bc = b0 * 3, cambio = false;
            for (var ff = 0; ff < 3; ff++) {
              if (bf + ff === f) continue;
              for (var cc = 0; cc < 3; cc++) {
                var ii = (bf + ff) * 9 + (bc + cc);
                if (t[ii] === 0 && (cand[ii] & bit)) { cand[ii] &= ~bit; cambio = true; }
              }
            }
            if (cambio) return true;
          }
        }
      }
      for (var c2 = 0; c2 < 9; c2++) {
        for (var v2 = 1; v2 <= 9; v2++) {
          var bit2 = 1 << (v2 - 1), cs = [];
          for (var f2 = 0; f2 < 9; f2++) { var i2 = f2 * 9 + c2; if (t[i2] === 0 && (cand[i2] & bit2)) cs.push(i2); }
          if (cs.length < 2) continue;
          var b2 = Math.floor(Math.floor(cs[0] / 9) / 3), misma2 = true;
          for (var k2 = 1; k2 < cs.length; k2++) if (Math.floor(Math.floor(cs[k2] / 9) / 3) !== b2) { misma2 = false; break; }
          if (misma2) {
            var bf2 = b2 * 3, bc2 = Math.floor(c2 / 3) * 3, cambio2 = false;
            for (var cc2 = 0; cc2 < 3; cc2++) {
              if (bc2 + cc2 === c2) continue;
              for (var ff2 = 0; ff2 < 3; ff2++) {
                var ii2 = (bf2 + ff2) * 9 + (bc2 + cc2);
                if (t[ii2] === 0 && (cand[ii2] & bit2)) { cand[ii2] &= ~bit2; cambio2 = true; }
              }
            }
            if (cambio2) return true;
          }
        }
      }
      return false;
    }

    function trio(t, cand) {
      for (var u = 0; u < UNITS_L.length; u++) {
        var unit = UNITS_L[u], lista = [];
        for (var k = 0; k < 9; k++) {
          var i = unit[k];
          if (t[i] === 0) {
            var n = contarBitsL(cand[i]);
            if (n === 2 || n === 3) lista.push(i);
          }
        }
        for (var a = 0; a < lista.length; a++) for (var b = a + 1; b < lista.length; b++) for (var c = b + 1; c < lista.length; c++) {
          var ia = lista[a], ib = lista[b], ic = lista[c];
          var mask = cand[ia] | cand[ib] | cand[ic];
          if (contarBitsL(mask) !== 3) continue;
          var cambio = false;
          for (var k2 = 0; k2 < 9; k2++) {
            var ii = unit[k2];
            if (ii !== ia && ii !== ib && ii !== ic && t[ii] === 0 && (cand[ii] & mask)) { cand[ii] &= ~mask; cambio = true; }
          }
          if (cambio) return true;
        }
      }
      return false;
    }

    function xWing(t, cand) {
      for (var v = 1; v <= 9; v++) {
        var bit = 1 << (v - 1);
        var filas = [];
        for (var f = 0; f < 9; f++) {
          var cols = [];
          for (var c = 0; c < 9; c++) { var i = f * 9 + c; if (t[i] === 0 && (cand[i] & bit)) cols.push(c); }
          if (cols.length === 2) filas.push({ f: f, cols: cols });
        }
        for (var a = 0; a < filas.length; a++) for (var b = a + 1; b < filas.length; b++) {
          if (filas[a].cols[0] === filas[b].cols[0] && filas[a].cols[1] === filas[b].cols[1]) {
            var c1 = filas[a].cols[0], c2 = filas[a].cols[1], cambio = false;
            for (var f2 = 0; f2 < 9; f2++) {
              if (f2 === filas[a].f || f2 === filas[b].f) continue;
              var i1 = f2 * 9 + c1, i2 = f2 * 9 + c2;
              if (t[i1] === 0 && (cand[i1] & bit)) { cand[i1] &= ~bit; cambio = true; }
              if (t[i2] === 0 && (cand[i2] & bit)) { cand[i2] &= ~bit; cambio = true; }
            }
            if (cambio) return true;
          }
        }
        var colsD = [];
        for (var c3 = 0; c3 < 9; c3++) {
          var fs = [];
          for (var f3 = 0; f3 < 9; f3++) { var i3 = f3 * 9 + c3; if (t[i3] === 0 && (cand[i3] & bit)) fs.push(f3); }
          if (fs.length === 2) colsD.push({ c: c3, fs: fs });
        }
        for (var a2 = 0; a2 < colsD.length; a2++) for (var b2 = a2 + 1; b2 < colsD.length; b2++) {
          if (colsD[a2].fs[0] === colsD[b2].fs[0] && colsD[a2].fs[1] === colsD[b2].fs[1]) {
            var f1 = colsD[a2].fs[0], f2b = colsD[a2].fs[1], cambio2 = false;
            for (var c4 = 0; c4 < 9; c4++) {
              if (c4 === colsD[a2].c || c4 === colsD[b2].c) continue;
              var i4 = f1 * 9 + c4, i5 = f2b * 9 + c4;
              if (t[i4] === 0 && (cand[i4] & bit)) { cand[i4] &= ~bit; cambio2 = true; }
              if (t[i5] === 0 && (cand[i5] & bit)) { cand[i5] &= ~bit; cambio2 = true; }
            }
            if (cambio2) return true;
          }
        }
      }
      return false;
    }

    function yWing(t, cand) {
      var pivotes = [];
      for (var i = 0; i < 81; i++) if (t[i] === 0 && contarBitsL(cand[i]) === 2) pivotes.push(i);
      for (var p = 0; p < pivotes.length; p++) {
        var piv = pivotes[p], pm = cand[piv], ps = PEERS_L[piv];
        for (var j = 0; j < ps.length; j++) {
          var jc = ps[j];
          if (t[jc] !== 0 || contarBitsL(cand[jc]) !== 2) continue;
          var comp = cand[jc] & pm;
          if (contarBitsL(comp) !== 1) continue;
          var zb = cand[jc] & ~comp;
          for (var k = j + 1; k < ps.length; k++) {
            var kc = ps[k];
            if (t[kc] !== 0 || contarBitsL(cand[kc]) !== 2) continue;
            var compK = cand[kc] & pm;
            if (contarBitsL(compK) !== 1 || compK === comp) continue;
            if ((cand[kc] & ~compK) !== zb) continue;
            var cambio = false;
            for (var m = 0; m < 81; m++) {
              if (t[m] !== 0 || m === jc || m === kc || m === piv) continue;
              var mp = PEERS_L[m], veJ = false, veK = false;
              for (var q = 0; q < mp.length; q++) {
                if (mp[q] === jc) veJ = true;
                if (mp[q] === kc) veK = true;
                if (veJ && veK) break;
              }
              if (veJ && veK && (cand[m] & zb)) { cand[m] &= ~zb; cambio = true; }
            }
            if (cambio) return true;
          }
        }
      }
      return false;
    }

    function swordfish(t, cand) {
      for (var v = 1; v <= 9; v++) {
        var bit = 1 << (v - 1);
        var filas = [];
        for (var f = 0; f < 9; f++) {
          var cols = [];
          for (var c = 0; c < 9; c++) { var i = f * 9 + c; if (t[i] === 0 && (cand[i] & bit)) cols.push(c); }
          if (cols.length >= 2 && cols.length <= 3) filas.push({ f: f, cols: cols });
        }
        for (var a = 0; a < filas.length; a++) for (var b = a + 1; b < filas.length; b++) for (var c = b + 1; c < filas.length; c++) {
          var u = {};
          [filas[a], filas[b], filas[c]].forEach(function (r) { r.cols.forEach(function (cc) { u[cc] = true; }); });
          var colsU = Object.keys(u).map(Number);
          if (colsU.length !== 3) continue;
          var cambio = false;
          for (var f2 = 0; f2 < 9; f2++) {
            if (f2 === filas[a].f || f2 === filas[b].f || f2 === filas[c].f) continue;
            for (var q = 0; q < 3; q++) {
              var i2 = f2 * 9 + colsU[q];
              if (t[i2] === 0 && (cand[i2] & bit)) { cand[i2] &= ~bit; cambio = true; }
            }
          }
          if (cambio) return true;
        }
        var colsD = [];
        for (var c3 = 0; c3 < 9; c3++) {
          var fs = [];
          for (var f3 = 0; f3 < 9; f3++) { var i3 = f3 * 9 + c3; if (t[i3] === 0 && (cand[i3] & bit)) fs.push(f3); }
          if (fs.length >= 2 && fs.length <= 3) colsD.push({ c: c3, fs: fs });
        }
        for (var a2 = 0; a2 < colsD.length; a2++) for (var b2 = a2 + 1; b2 < colsD.length; b2++) for (var c4 = b2 + 1; c4 < colsD.length; c4++) {
          var u2 = {};
          [colsD[a2], colsD[b2], colsD[c4]].forEach(function (r) { r.fs.forEach(function (ff) { u2[ff] = true; }); });
          var fsU = Object.keys(u2).map(Number);
          if (fsU.length !== 3) continue;
          var cambio2 = false;
          for (var c5 = 0; c5 < 9; c5++) {
            if (c5 === colsD[a2].c || c5 === colsD[b2].c || c5 === colsD[c4].c) continue;
            for (var q2 = 0; q2 < 3; q2++) {
              var i4 = fsU[q2] * 9 + c5;
              if (t[i4] === 0 && (cand[i4] & bit)) { cand[i4] &= ~bit; cambio2 = true; }
            }
          }
          if (cambio2) return true;
        }
      }
      return false;
    }

    // ─── Solver lógico con escalado ───
    function resolverLogico(puzzle, maxNivel) {
      var tablero = new Int8Array(puzzle);
      var cand = new Int16Array(81);
      actualizarCandidatos(tablero, cand);
      var nivelUsado = 0;
      while (true) {
        var resuelto = true;
        for (var i = 0; i < 81; i++) if (tablero[i] === 0) { resuelto = false; break; }
        if (resuelto) return { resuelto: true, nivel: nivelUsado };
        if (singleDesnudo(tablero, cand)) { if (nivelUsado < 1) nivelUsado = 1; continue; }
        if (singleOculto(tablero, cand)) { if (nivelUsado < 1) nivelUsado = 1; continue; }
        if (maxNivel >= 2) {
          if (parejaDesnuda(tablero, cand)) { if (nivelUsado < 2) nivelUsado = 2; continue; }
          if (parejaOculta(tablero, cand)) { if (nivelUsado < 2) nivelUsado = 2; continue; }
          if (puntero(tablero, cand)) { if (nivelUsado < 2) nivelUsado = 2; continue; }
          if (lineaCaja(tablero, cand)) { if (nivelUsado < 2) nivelUsado = 2; continue; }
        }
        if (maxNivel >= 3) {
          if (trio(tablero, cand)) { if (nivelUsado < 3) nivelUsado = 3; continue; }
          if (xWing(tablero, cand)) { if (nivelUsado < 3) nivelUsado = 3; continue; }
        }
        if (maxNivel >= 4) {
          if (yWing(tablero, cand)) { if (nivelUsado < 4) nivelUsado = 4; continue; }
          if (swordfish(tablero, cand)) { if (nivelUsado < 4) nivelUsado = 4; continue; }
        }
        return { resuelto: false, nivel: nivelUsado };
      }
    }

    function clasificar(puzzle) {
      var r = resolverLogico(puzzle, 4);
      return r.resuelto ? r.nivel : 4;
    }

    function agregarHastaFacil(puzzle, solucion) {
      var p = new Int8Array(puzzle), vacias = [];
      for (var i = 0; i < 81; i++) if (p[i] === 0) vacias.push(i);
      for (var k = vacias.length - 1; k > 0; k--) {
        var j = Math.floor(Math.random() * (k + 1));
        var t = vacias[k]; vacias[k] = vacias[j]; vacias[j] = t;
      }
      for (var m = 0; m < vacias.length; m++) {
        if (clasificar(p) === 1) return p;
        p[vacias[m]] = solucion[vacias[m]];
      }
      return p;
    }

    // ─── Generador principal ───
    function generarPuzzle(dif) {
      var NIVELES = { facil: 1, medio: 2, dificil: 3, experto: 4 };
      var RANGOS = { facil: [42, 50], medio: [32, 40], dificil: [26, 32], experto: [22, 28] };
      var INTENTOS = { facil: 20, medio: 20, dificil: 30, experto: 50 };
      var nivelDeseado = NIVELES[dif] || 2;
      var rango = RANGOS[dif] || RANGOS.medio;
      var intentosMax = INTENTOS[dif] || 20;
      var mejor = null, mejorNivel = 0;

      for (var intento = 0; intento < intentosMax; intento++) {
        var pistas = rango[0] + Math.floor(Math.random() * (rango[1] - rango[0] + 1));
        var solucion = generarCompleto();
        var puzzle = quitarHasta(solucion, pistas);
        if (contarSoluciones(puzzle, 2) !== 1) continue;
        var nivel = clasificar(puzzle);
        if (nivel === nivelDeseado) {
          if (nivelDeseado <= 3) {
            var r = resolverLogico(puzzle, nivelDeseado);
            console.assert(r.resuelto, 'Solver lógico debe resolver nivel ' + dif);
          }
          return { puzzle: Array.from(puzzle), solucion: Array.from(solucion), dificultad: dif, nivel: nivel };
        }
        if (nivelDeseado === 1 && nivel > 1) {
          var aj = agregarHastaFacil(puzzle, solucion);
          if (clasificar(aj) === 1) return { puzzle: Array.from(aj), solucion: Array.from(solucion), dificultad: dif, nivel: 1 };
        }
        if (nivel < nivelDeseado && nivel > mejorNivel) {
          mejorNivel = nivel;
          mejor = { puzzle: Array.from(puzzle), solucion: Array.from(solucion), dificultad: dif, nivel: nivel };
        }
      }
      if (mejor) return mejor;
      var sol = generarCompleto();
      var puz = quitarHasta(sol, 45);
      return { puzzle: Array.from(puz), solucion: Array.from(sol), dificultad: dif, nivel: clasificar(puz) };
    }

    return generarPuzzle(dificultad);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Estilos del juego (se inyectan con ctx.inyectarEstilos)
  // ═══════════════════════════════════════════════════════════════════

  var CSS_SUDOKU = [
    '.sdk-wrap{display:flex;flex-direction:column;gap:12px;align-items:center;padding:4px;width:100%;max-width:560px;margin:0 auto;}',
    '.sdk-info{display:flex;gap:22px;justify-content:center;align-items:baseline;font-size:.95rem;color:var(--tinta-suave);}',
    '.sdk-etq{font-size:.8rem;}',
    '.sdk-tnum{font-variant-numeric:tabular-nums;color:var(--tinta);font-family:var(--fuente-titulo);}',
    '.sdk-board-wrap{width:100%;max-width:500px;}',
    '.sdk-board{display:grid;grid-template-columns:repeat(9,1fr);aspect-ratio:1;width:100%;border:2px solid var(--tinta-suave);border-radius:var(--r-control);overflow:hidden;background:var(--vidrio-fondo-fuerte);}',
    '.sdk-celda{position:relative;display:grid;place-items:center;aspect-ratio:1;font-size:clamp(1rem,3.4vw,1.5rem);font-weight:500;color:var(--tinta);cursor:pointer;user-select:none;-webkit-user-select:none;border-right:1px solid var(--piedra);border-bottom:1px solid var(--piedra);min-width:0;min-height:0;}',
    '.sdk-celda:nth-child(9n){border-right:none;}',
    '.sdk-celda:nth-last-child(-n+9){border-bottom:none;}',
    '.sdk-celda.borde-der{border-right:2px solid var(--tinta-suave);}',
    '.sdk-celda.borde-abajo{border-bottom:2px solid var(--tinta-suave);}',
    '.sdk-celda.dado{color:var(--tinta);font-weight:700;}',
    '.sdk-celda.jugada{color:var(--musgo);}',
    '.sdk-celda.seleccionada{background:rgba(134,179,172,.28);box-shadow:inset 0 0 0 2px var(--musgo);}',
    '.sdk-celda.resaltada{background:var(--capa-suave);}',
    '.sdk-celda.mismo-numero{background:rgba(134,179,172,.18);}',
    '.sdk-celda.conflicto{color:var(--error)!important;}',
    '.sdk-valor{line-height:1;}',
    '.sdk-notas{position:absolute;inset:2px;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);font-size:.5em;font-weight:500;color:var(--tinta-suave);pointer-events:none;}',
    '.sdk-notas span{display:flex;align-items:center;justify-content:center;font-variant-numeric:tabular-nums;}',
    '.sdk-pad{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;width:100%;max-width:500px;}',
    '.sdk-tecla{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:48px;border-radius:var(--r-control);border:1px solid var(--vidrio-borde);background:var(--vidrio-fondo-fuerte);color:var(--tinta);font-family:var(--fuente-titulo);font-size:1.25rem;font-weight:600;cursor:pointer;padding:4px;transition:background 100ms ease;}',
    '.sdk-tecla:hover{background:var(--capa-fuerte);}',
    '.sdk-tecla:active{background:var(--capa-suave);}',
    '.sdk-tecla:disabled{opacity:.35;cursor:not-allowed;}',
    '.sdk-tecla .sdk-num{line-height:1;font-variant-numeric:tabular-nums;}',
    '.sdk-tecla .sdk-restantes{font-size:.6rem;font-weight:400;color:var(--tinta-suave);font-variant-numeric:tabular-nums;min-height:.8em;}',
    '.sdk-tecla.sdk-accion .ico{width:22px;height:22px;}',
    '.sdk-tecla.sdk-modo.activo{background:var(--musgo);color:var(--niebla-2);border-color:transparent;}',
    '.sdk-tecla.sdk-modo.activo .ico{color:var(--niebla-2);}',
    '.sdk-ajustes{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;}',
    '.sdk-ajuste{min-height:36px;padding:6px 14px;border-radius:var(--r-pastilla);border:1px solid var(--vidrio-borde);background:var(--capa-suave);color:var(--tinta-suave);font-size:.82rem;font-weight:500;cursor:pointer;}',
    '.sdk-ajuste.activo{background:var(--musgo);color:var(--niebla-2);border-color:transparent;}',
    '.sdk-preparando{display:flex;flex-direction:column;align-items:center;gap:18px;padding:48px 20px;color:var(--tinta-suave);font-size:var(--t-2);}',
    '.sdk-preparando[hidden]{display:none;}',
    '.sdk-spinner{width:32px;height:32px;border:3px solid var(--capa-suave);border-top-color:var(--musgo);border-radius:50%;animation:sdk-girar 800ms linear infinite;}',
    '@keyframes sdk-girar{to{transform:rotate(360deg);}}',
    '@keyframes sdk-pulso{0%,100%{background-color:transparent;}40%{background-color:rgba(134,179,172,.5);}}',
    '.sdk-celda.pulso{animation:sdk-pulso 600ms ease;}',
    '.sdk-wrap.pausado .sdk-board-wrap,.sdk-wrap.pausado .sdk-pad,.sdk-wrap.pausado .sdk-info,.sdk-wrap.pausado .sdk-ajustes{visibility:hidden;}',
    'html[data-movimiento="reducido"] .sdk-celda.pulso{animation:none;}',
    'html[data-movimiento="reducido"] .sdk-spinner{animation:none;}',
    '@media (prefers-reduced-motion:reduce){.sdk-celda.pulso{animation:none;}.sdk-spinner{animation:none;}}',
    '@media (max-width:520px){.sdk-tecla{min-height:44px;font-size:1.1rem;}.sdk-tecla.sdk-accion .ico{width:20px;height:20px;}}'
  ].join('\n');

  // ═══════════════════════════════════════════════════════════════════
  //  Estado del juego
  // ═══════════════════════════════════════════════════════════════════

  var ctxRef = null;
  var rootRef = null;
  var celdas = [];
  var tecladoConectado = false;
  var intervaloReloj = null;

  var S = {
    puzzle: null,
    solucion: null,
    tablero: null,
    notas: new Uint16Array(81),
    dificultad: 'medio',
    pistas: 0,
    historial: [],
    rehacer: [],
    seleccionada: -1,
    modo: 'escribir',
    ajustes: { errores: false, autoNotas: true },
    pausado: false,
    completado: false,
    completadas: new Set(),
    worker: null,
    generando: false,
    generacionId: 0
  };

  var cronometro = {
    acumulado: 0,
    iniciadoEn: null,
    leer: function () {
      if (this.iniciadoEn === null) return this.acumulado;
      return this.acumulado + (Date.now() - this.iniciadoEn);
    },
    iniciar: function () { if (this.iniciadoEn === null) this.iniciadoEn = Date.now(); },
    pausar: function () {
      if (this.iniciadoEn !== null) {
        this.acumulado += Date.now() - this.iniciadoEn;
        this.iniciadoEn = null;
      }
    },
    reset: function () { this.acumulado = 0; this.iniciadoEn = null; }
  };

  function iniciarIntervaloReloj() {
    if (intervaloReloj) return;
    intervaloReloj = setInterval(function () {
      if (!rootRef || S.pausado) return;
      var el = document.getElementById('sdk-reloj');
      if (el) el.textContent = formatearTiempo(cronometro.leer());
    }, 500);
  }

  function detenerIntervaloReloj() {
    if (intervaloReloj) { clearInterval(intervaloReloj); intervaloReloj = null; }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Construcción de la interfaz
  // ═══════════════════════════════════════════════════════════════════

  function icono(nombre) {
    var svg = (ctxRef && ctxRef.iconos && ctxRef.iconos[nombre]) || '';
    return '<span class="ico" aria-hidden="true">' + svg + '</span>';
  }

  function construirPadHTML() {
    var html = '';
    for (var v = 1; v <= 9; v++) {
      html += '<button type="button" class="sdk-tecla" data-valor="' + v + '" aria-label="' + v + '">' +
        '<span class="sdk-num">' + v + '</span>' +
        '<span class="sdk-restantes" data-restantes="' + v + '"></span></button>';
    }
    html += '<button type="button" class="sdk-tecla sdk-borrar" data-accion="borrar" aria-label="Borrar">' + icono('borrar') + '</button>';
    html += '<button type="button" class="sdk-tecla sdk-accion" data-accion="deshacer" aria-label="Deshacer">' + icono('deshacer') + '</button>';
    html += '<button type="button" class="sdk-tecla sdk-accion" data-accion="rehacer" aria-label="Rehacer">' + icono('rehacer') + '</button>';
    html += '<button type="button" class="sdk-tecla sdk-accion sdk-modo" data-accion="modo" aria-pressed="false" aria-label="Modo notas">' + icono('lapiz') + '</button>';
    html += '<button type="button" class="sdk-tecla sdk-accion" data-accion="pista" aria-label="Pista">' + icono('pista') + '</button>';
    return html;
  }

  function crearEstructura(root) {
    root.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.className = 'sdk-wrap';

    var info = document.createElement('div');
    info.className = 'sdk-info';
    info.innerHTML = '<span class="sdk-dato"><span class="sdk-etq">Tiempo</span> <b id="sdk-reloj" class="sdk-tnum">00:00</b></span>' +
      '<span class="sdk-dato"><span class="sdk-etq">Pistas</span> <b id="sdk-pistas" class="sdk-tnum">0</b></span>';
    wrap.appendChild(info);

    var boardWrap = document.createElement('div');
    boardWrap.className = 'sdk-board-wrap';
    var board = document.createElement('div');
    board.className = 'sdk-board';
    board.setAttribute('role', 'grid');
    board.setAttribute('aria-label', 'Tablero de Sudoku');
    boardWrap.appendChild(board);
    wrap.appendChild(boardWrap);

    var pad = document.createElement('div');
    pad.className = 'sdk-pad';
    pad.innerHTML = construirPadHTML();
    wrap.appendChild(pad);

    var ajustes = document.createElement('div');
    ajustes.className = 'sdk-ajustes';
    ajustes.innerHTML =
      '<button type="button" class="sdk-ajuste" data-clave="errores" aria-pressed="false">Mostrar errores</button>' +
      '<button type="button" class="sdk-ajuste" data-clave="autoNotas" aria-pressed="true">Limpiar notas al colocar</button>';
    wrap.appendChild(ajustes);

    var prep = document.createElement('div');
    prep.className = 'sdk-preparando';
    prep.innerHTML = '<p>Preparando tu tablero</p><span class="sdk-spinner"></span>';
    wrap.appendChild(prep);

    root.appendChild(wrap);
    rootRef = root;
    celdas = [];
  }

  function mostrarPreparando(visible) {
    if (!rootRef) return;
    var q = function (s) { return rootRef.querySelector(s); };
    var prep = q('.sdk-preparando'), bw = q('.sdk-board-wrap'), pad = q('.sdk-pad'), info = q('.sdk-info'), aj = q('.sdk-ajustes');
    if (prep) prep.hidden = !visible;
    if (bw) bw.hidden = visible;
    if (pad) pad.hidden = visible;
    if (info) info.hidden = visible;
    if (aj) aj.hidden = visible;
  }

  function renderTablero() {
    if (!rootRef) return;
    var board = rootRef.querySelector('.sdk-board');
    if (!board) return;
    board.innerHTML = '';
    celdas = [];
    for (var i = 0; i < 81; i++) {
      var celda = document.createElement('div');
      celda.className = 'sdk-celda';
      celda.setAttribute('role', 'gridcell');
      celda.setAttribute('data-i', i);
      var f = Math.floor(i / 9), c = i % 9;
      if (c === 2 || c === 5) celda.classList.add('borde-der');
      if (f === 2 || f === 5) celda.classList.add('borde-abajo');
      var val = document.createElement('span');
      val.className = 'sdk-valor';
      celda.appendChild(val);
      var notas = document.createElement('div');
      notas.className = 'sdk-notas';
      for (var k = 0; k < 9; k++) notas.appendChild(document.createElement('span'));
      celda.appendChild(notas);
      board.appendChild(celda);
      celdas.push(celda);
    }
  }

  // ─── Actualización de celdas ───
  function actualizarCelda(i) {
    if (!celdas[i] || !S.tablero || !S.puzzle) return;
    var c = celdas[i];
    var val = c.querySelector('.sdk-valor');
    var valor = S.tablero[i];
    val.textContent = valor ? valor : '';
    c.classList.toggle('dado', S.puzzle[i] !== 0);
    c.classList.toggle('jugada', S.puzzle[i] === 0 && valor !== 0);

    var notasDiv = c.querySelector('.sdk-notas');
    var nmask = S.notas ? (S.notas[i] || 0) : 0;
    var mostrar = (valor === 0 && nmask !== 0);
    notasDiv.style.display = mostrar ? '' : 'none';
    if (mostrar) {
      var ns = notasDiv.children;
      for (var k = 0; k < 9; k++) ns[k].textContent = (nmask & (1 << k)) ? (k + 1) : '';
    }

    var f = Math.floor(i / 9) + 1, col = (i % 9) + 1, desc;
    if (valor) desc = 'Fila ' + f + ', columna ' + col + ', valor ' + valor;
    else if (nmask) desc = 'Fila ' + f + ', columna ' + col + ', vacía, con notas';
    else desc = 'Fila ' + f + ', columna ' + col + ', vacía';
    if (i === S.seleccionada) desc += ', seleccionada';
    c.setAttribute('aria-label', desc);
  }

  function actualizarResaltado() {
    if (!S.tablero) return;
    var sel = S.seleccionada;
    var selVal = sel >= 0 ? S.tablero[sel] : 0;
    var sf = sel >= 0 ? Math.floor(sel / 9) : -1;
    var sc = sel >= 0 ? sel % 9 : -1;
    var sb = sel >= 0 ? Math.floor(sf / 3) * 3 + Math.floor(sc / 3) : -1;
    for (var i = 0; i < 81; i++) {
      var c = celdas[i];
      if (!c) continue;
      var f = Math.floor(i / 9), col = i % 9;
      var b = Math.floor(f / 3) * 3 + Math.floor(col / 3);
      var esSel = i === sel;
      var esRes = sel >= 0 && !esSel && (f === sf || col === sc || b === sb);
      var esMismo = sel >= 0 && !esSel && selVal !== 0 && S.tablero[i] === selVal;
      c.classList.toggle('seleccionada', esSel);
      c.classList.toggle('resaltada', esRes);
      c.classList.toggle('mismo-numero', esMismo);
    }
  }

  function actualizarErrores() {
    if (!S.tablero) return;
    var mostrarError = S.ajustes.errores;
    for (var i = 0; i < 81; i++) {
      var c = celdas[i];
      if (!c) continue;
      var v = S.tablero[i], conflicto = false;
      if (v !== 0) {
        var ps = PEERS[i];
        for (var k = 0; k < ps.length; k++) if (S.tablero[ps[k]] === v) { conflicto = true; break; }
      }
      var err = mostrarError && v !== 0 && S.solucion && v !== S.solucion[i];
      c.classList.toggle('conflicto', conflicto || err);
    }
  }

  function actualizarPad() {
    if (!rootRef || !S.tablero) return;
    var cuenta = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (var i = 0; i < 81; i++) if (S.tablero[i]) cuenta[S.tablero[i]]++;
    for (var v = 1; v <= 9; v++) {
      var btn = rootRef.querySelector('.sdk-tecla[data-valor="' + v + '"]');
      if (!btn) continue;
      var rest = 9 - cuenta[v];
      var el = btn.querySelector('.sdk-restantes');
      if (el) el.textContent = rest > 0 ? rest : '';
      btn.disabled = rest <= 0;
    }
    var bDes = rootRef.querySelector('[data-accion="deshacer"]');
    var bRe = rootRef.querySelector('[data-accion="rehacer"]');
    if (bDes) bDes.disabled = S.historial.length === 0;
    if (bRe) bRe.disabled = S.rehacer.length === 0;
    var bModo = rootRef.querySelector('[data-accion="modo"]');
    if (bModo) {
      bModo.setAttribute('aria-pressed', S.modo === 'notas' ? 'true' : 'false');
      bModo.classList.toggle('activo', S.modo === 'notas');
    }
    var bErr = rootRef.querySelector('.sdk-ajuste[data-clave="errores"]');
    var bAuto = rootRef.querySelector('.sdk-ajuste[data-clave="autoNotas"]');
    if (bErr) {
      bErr.setAttribute('aria-pressed', S.ajustes.errores ? 'true' : 'false');
      bErr.classList.toggle('activo', S.ajustes.errores);
    }
    if (bAuto) {
      bAuto.setAttribute('aria-pressed', S.ajustes.autoNotas ? 'true' : 'false');
      bAuto.classList.toggle('activo', S.ajustes.autoNotas);
    }
  }

  function actualizarPistasTxt() {
    if (!rootRef) return;
    var el = rootRef.querySelector('#sdk-pistas');
    if (el) el.textContent = String(S.pistas);
    var r = rootRef.querySelector('#sdk-reloj');
    if (r) r.textContent = formatearTiempo(cronometro.leer());
  }

  function actualizarTodo() {
    for (var i = 0; i < 81; i++) actualizarCelda(i);
    actualizarResaltado();
    actualizarErrores();
    actualizarPad();
    actualizarPistasTxt();
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Lógica de juego
  // ═══════════════════════════════════════════════════════════════════

  function seleccionar(i) {
    if (S.pausado || S.completado || !S.tablero) return;
    S.seleccionada = i;
    actualizarResaltado();
    for (var k = 0; k < 81; k++) actualizarCelda(k);
  }

  function jugada(valor) {
    if (S.pausado || S.completado || !S.tablero || !S.puzzle) return;
    var i = S.seleccionada;
    if (i < 0) { ctxRef.toast('Toca una celda primero'); return; }
    if (S.puzzle[i] !== 0) return;

    var cambios = [];

    if (valor === 0) {
      if (S.tablero[i] === 0 && S.notas[i] === 0) return;
      cambios.push({ i: i, vA: S.tablero[i], nA: S.notas[i], vD: 0, nD: 0 });
      S.tablero[i] = 0;
      S.notas[i] = 0;
    } else if (S.modo === 'notas') {
      if (S.tablero[i] !== 0) return;
      var bitN = 1 << (valor - 1);
      var nA = S.notas[i];
      S.notas[i] ^= bitN;
      cambios.push({ i: i, vA: 0, nA: nA, vD: 0, nD: S.notas[i] });
    } else {
      if (S.tablero[i] === valor) return;
      cambios.push({ i: i, vA: 0, nA: S.notas[i], vD: valor, nD: 0 });
      S.tablero[i] = valor;
      S.notas[i] = 0;
      if (S.ajustes.autoNotas) {
        var bit = 1 << (valor - 1), ps = PEERS[i];
        for (var k = 0; k < ps.length; k++) {
          var p = ps[k];
          if (S.tablero[p] === 0 && (S.notas[p] & bit)) {
            cambios.push({ i: p, vA: 0, nA: S.notas[p], vD: 0, nD: S.notas[p] & ~bit });
            S.notas[p] &= ~bit;
          }
        }
      }
    }

    if (!cambios.length) return;
    S.historial.push(cambios);
    if (S.historial.length > 300) S.historial.shift();
    S.rehacer = [];

    ctxRef.sfx(valor === 0 ? 'toque' : 'ok');
    despuesDeCambio(cambios);
  }

  function despuesDeCambio(cambios) {
    for (var k = 0; k < cambios.length; k++) actualizarCelda(cambios[k].i);
    actualizarResaltado();
    actualizarErrores();
    actualizarPad();
    comprobarUnidadesCompletas();
    comprobarVictoria();
  }

  function deshacer() {
    if (S.pausado || S.completado || !S.tablero) return;
    if (!S.historial.length) return;
    var cambios = S.historial.pop();
    S.rehacer.push(cambios);
    for (var k = cambios.length - 1; k >= 0; k--) {
      S.tablero[cambios[k].i] = cambios[k].vA;
      S.notas[cambios[k].i] = cambios[k].nA;
    }
    for (var k2 = 0; k2 < cambios.length; k2++) actualizarCelda(cambios[k2].i);
    recalcularCompletadas();
    actualizarResaltado();
    actualizarErrores();
    actualizarPad();
    ctxRef.sfx('toque');
  }

  function rehacerAccion() {
    if (S.pausado || S.completado || !S.tablero) return;
    if (!S.rehacer.length) return;
    var cambios = S.rehacer.pop();
    S.historial.push(cambios);
    for (var k = 0; k < cambios.length; k++) {
      S.tablero[cambios[k].i] = cambios[k].vD;
      S.notas[cambios[k].i] = cambios[k].nD;
    }
    for (var k2 = 0; k2 < cambios.length; k2++) actualizarCelda(cambios[k2].i);
    recalcularCompletadas();
    actualizarResaltado();
    actualizarErrores();
    actualizarPad();
    ctxRef.sfx('toque');
  }

  function recalcularCompletadas() {
    S.completadas = new Set();
    for (var u = 0; u < UNITS.length; u++) {
      var unit = UNITS[u], lleno = true;
      for (var k = 0; k < 9; k++) if (S.tablero[unit[k]] === 0) { lleno = false; break; }
      if (!lleno) continue;
      var visto = 0, valido = true;
      for (var k2 = 0; k2 < 9; k2++) {
        var v = S.tablero[unit[k2]], bit = 1 << (v - 1);
        if (visto & bit) { valido = false; break; }
        visto |= bit;
      }
      if (valido) S.completadas.add(u);
    }
  }

  function comprobarUnidadesCompletas() {
    if (!S.tablero) return;
    for (var u = 0; u < UNITS.length; u++) {
      if (S.completadas.has(u)) continue;
      var unit = UNITS[u], lleno = true;
      for (var k = 0; k < 9; k++) if (S.tablero[unit[k]] === 0) { lleno = false; break; }
      if (!lleno) continue;
      var visto = 0, valido = true;
      for (var k2 = 0; k2 < 9; k2++) {
        var v = S.tablero[unit[k2]], bit = 1 << (v - 1);
        if (visto & bit) { valido = false; break; }
        visto |= bit;
      }
      if (!valido) continue;
      S.completadas.add(u);
      if (!ctxRef.ajustes.movimientoReducido) {
        for (var m = 0; m < 9; m++) {
          var c = celdas[unit[m]];
          if (!c) continue;
          c.classList.remove('pulso');
          void c.offsetWidth;
          c.classList.add('pulso');
        }
      }
    }
  }

  function comprobarVictoria() {
    if (S.completado || !S.solucion) return;
    for (var i = 0; i < 81; i++) if (S.tablero[i] !== S.solucion[i]) return;
    S.completado = true;
    cronometro.pausar();
    detenerIntervaloReloj();
    var ms = cronometro.leer();
    actualizarPistasTxt();
    ctxRef.reportar({ tipo: 'victoria', dificultad: S.dificultad, tiempoMs: ms });
    ctxRef.celebrar({
      titulo: 'Sudoku resuelto',
      detalle: 'Tiempo: ' + formatearTiempo(ms) + ' · Pistas: ' + S.pistas
    });
  }

  function colocarDirecto(i, v) {
    var modoAntes = S.modo;
    S.modo = 'escribir';
    S.seleccionada = i;
    jugada(v);
    S.modo = modoAntes;
  }

  function darPista() {
    if (S.pausado || S.completado || !S.tablero || !S.solucion) return;
    var tab = new Int8Array(S.tablero);
    var cand = new Int16Array(81);
    for (var i = 0; i < 81; i++) {
      if (tab[i]) { cand[i] = 0; continue; }
      var usado = 0, ps = PEERS[i];
      for (var k = 0; k < ps.length; k++) { var v = tab[ps[k]]; if (v) usado |= 1 << (v - 1); }
      cand[i] = (~usado) & 0x1FF;
    }

    // 1. Single desnudo
    for (var a = 0; a < 81; a++) {
      if (tab[a] === 0 && contarBits(cand[a]) === 1) {
        var vv = bitACifra(cand[a]);
        var ff = Math.floor(a / 9) + 1, cc = (a % 9) + 1;
        colocarDirecto(a, vv);
        S.pistas++;
        actualizarPistasTxt();
        ctxRef.toast('En la fila ' + ff + ', columna ' + cc + ', solo cabe el ' + vv);
        return;
      }
    }

    // 2. Single oculto
    for (var u = 0; u < UNITS.length; u++) {
      var unit = UNITS[u];
      for (var v2 = 1; v2 <= 9; v2++) {
        var bit = 1 << (v2 - 1), celda = -1, cuenta = 0;
        for (var k2 = 0; k2 < 9; k2++) {
          var idx = unit[k2];
          if (tab[idx] === 0 && (cand[idx] & bit)) { cuenta++; celda = idx; if (cuenta > 1) break; }
        }
        if (cuenta === 1) {
          var desc;
          if (u < 9) desc = 'En la fila ' + (u + 1) + ', el ' + v2 + ' solo cabe en una celda.';
          else if (u < 18) desc = 'En la columna ' + (u - 9 + 1) + ', el ' + v2 + ' solo cabe en una celda.';
          else desc = 'En una caja, el ' + v2 + ' solo cabe en una celda.';
          colocarDirecto(celda, v2);
          S.pistas++;
          actualizarPistasTxt();
          ctxRef.toast(desc);
          return;
        }
      }
    }

    // 3. Fallback: revelar del solution
    var vacias = [];
    for (var m = 0; m < 81; m++) if (S.tablero[m] === 0) vacias.push(m);
    if (!vacias.length) return;
    var idx2 = vacias[Math.floor(Math.random() * vacias.length)];
    var vv2 = S.solucion[idx2];
    colocarDirecto(idx2, vv2);
    S.pistas++;
    actualizarPistasTxt();
    ctxRef.toast('Aquí va el ' + vv2 + '.');
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Generación asíncrona (Web Worker vía Blob)
  // ═══════════════════════════════════════════════════════════════════

  function detenerWorker() {
    if (S.worker) {
      try { S.worker.terminate(); } catch (e) { /* nada */ }
      S.worker = null;
    }
  }

  function cancelarGeneracion() {
    S.generacionId++;
    detenerWorker();
    S.generando = false;
  }

  function aplicarResultado(r) {
    if (!r || !r.puzzle || !r.solucion) {
      ctxRef.toast('No se pudo generar el tablero');
      return;
    }
    S.puzzle = new Int8Array(r.puzzle);
    S.solucion = new Int8Array(r.solucion);
    S.tablero = new Int8Array(r.puzzle);
    S.notas = new Uint16Array(81);
    S.historial = [];
    S.rehacer = [];
    S.seleccionada = -1;
    S.completado = false;
    S.completadas = new Set();
    S.pistas = 0;
    cronometro.reset();
    cronometro.iniciar();
    iniciarIntervaloReloj();
    renderTablero();
    actualizarTodo();
  }

  function generarAsync(dificultad) {
    var miId = ++S.generacionId;
    S.generando = true;

    function exito(r) {
      if (miId !== S.generacionId) return;
      S.generando = false;
      aplicarResultado(r);
      mostrarPreparando(false);
    }
    function fracaso() {
      if (miId !== S.generacionId) return;
      S.generando = false;
      try {
        var r = generarPuzzleCompleto(dificultad);
        aplicarResultado(r);
        mostrarPreparando(false);
      } catch (e) {
        mostrarPreparando(false);
        ctxRef.toast('No se pudo generar el tablero');
      }
    }

    if (window.Worker) {
      try {
        var fuente = generarPuzzleCompleto.toString();
        var codigo = 'var generarPuzzle = ' + fuente + ';\n' +
          'self.onmessage = function(e){ try { var r = generarPuzzle(e.data.dificultad); self.postMessage({ok:true, resultado:r}); } catch(err){ self.postMessage({ok:false, error:String(err)}); } };';
        var blob = new Blob([codigo], { type: 'application/javascript' });
        var url = URL.createObjectURL(blob);
        var worker = new Worker(url);
        URL.revokeObjectURL(url);
        S.worker = worker;
        worker.onmessage = function (e) {
          if (miId !== S.generacionId) return;
          if (e.data && e.data.ok) exito(e.data.resultado);
          else fracaso();
          detenerWorker();
        };
        worker.onerror = function () {
          if (miId !== S.generacionId) return;
          fracaso();
          detenerWorker();
        };
        worker.postMessage({ dificultad: dificultad });
        return;
      } catch (e) { /* fallback */ }
    }

    setTimeout(function () {
      if (miId !== S.generacionId) return;
      fracaso();
    }, 30);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Ajustes del juego
  // ═══════════════════════════════════════════════════════════════════

  function guardarAjustesJuego() {
    if (!ctxRef) return;
    ctxRef.guardar('ajustesJuego', { errores: S.ajustes.errores, autoNotas: S.ajustes.autoNotas });
  }

  function cargarAjustesJuego() {
    if (!ctxRef) return;
    var g = ctxRef.leer('ajustesJuego', null);
    if (g) {
      S.ajustes.errores = !!g.errores;
      S.ajustes.autoNotas = g.autoNotas !== false;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Serialización
  // ═══════════════════════════════════════════════════════════════════

  function serializar() {
    if (!S.puzzle || !S.solucion || S.completado) return null;
    return {
      v: 1,
      puzzle: Array.from(S.puzzle),
      solucion: Array.from(S.solucion),
      tablero: Array.from(S.tablero),
      notas: Array.from(S.notas),
      historial: S.historial.slice(),
      rehacer: S.rehacer.slice(),
      tiempoMs: cronometro.leer(),
      pistas: S.pistas,
      dificultad: S.dificultad,
      completadas: S.completadas ? Array.from(S.completadas) : [],
      ajustes: { errores: !!S.ajustes.errores, autoNotas: S.ajustes.autoNotas !== false }
    };
  }

  function restaurar(estado) {
    if (!estado || !estado.puzzle || !estado.solucion) return false;
    try {
      S.puzzle = new Int8Array(estado.puzzle);
      S.solucion = new Int8Array(estado.solucion);
      S.tablero = new Int8Array(estado.tablero);
      S.notas = new Uint16Array(estado.notas);
      S.historial = Array.isArray(estado.historial) ? estado.historial.slice() : [];
      S.rehacer = Array.isArray(estado.rehacer) ? estado.rehacer.slice() : [];
      S.pistas = typeof estado.pistas === 'number' ? estado.pistas : 0;
      S.dificultad = estado.dificultad || 'medio';
      S.completadas = new Set(Array.isArray(estado.completadas) ? estado.completadas : []);
      S.completado = false;
      S.pausado = false;
      S.seleccionada = -1;
      S.modo = 'escribir';
      if (estado.ajustes) {
        S.ajustes.errores = !!estado.ajustes.errores;
        S.ajustes.autoNotas = estado.ajustes.autoNotas !== false;
      }
      cronometro.reset();
      cronometro.acumulado = typeof estado.tiempoMs === 'number' ? estado.tiempoMs : 0;
      cronometro.iniciadoEn = Date.now();
      iniciarIntervaloReloj();
      renderTablero();
      actualizarTodo();
      mostrarPreparando(false);
      if (rootRef) {
        var wrap = rootRef.querySelector('.sdk-wrap');
        if (wrap) wrap.classList.remove('pausado');
      }
      return true;
    } catch (e) { return false; }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Eventos
  // ═══════════════════════════════════════════════════════════════════

  function teclaGlobal(e) {
    if (!rootRef || !S.tablero || S.pausado || S.completado) return;
    var k = e.key;
    if (k >= '1' && k <= '9') { e.preventDefault(); jugada(parseInt(k, 10)); return; }
    if (k === 'Backspace' || k === 'Delete' || k === '0') { e.preventDefault(); jugada(0); return; }
    if (k === 'n' || k === 'N') { e.preventDefault(); S.modo = S.modo === 'notas' ? 'escribir' : 'notas'; actualizarPad(); ctxRef.sfx('toque'); return; }
    if (k === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) { e.preventDefault(); deshacer(); return; }
    if ((k === 'y' && (e.ctrlKey || e.metaKey)) || (k === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey)) { e.preventDefault(); rehacerAccion(); return; }
    if (k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowRight') {
      e.preventDefault();
      var i = S.seleccionada;
      if (i < 0) i = 0;
      else {
        var f = Math.floor(i / 9), c = i % 9;
        if (k === 'ArrowUp') f = (f + 8) % 9;
        if (k === 'ArrowDown') f = (f + 1) % 9;
        if (k === 'ArrowLeft') c = (c + 8) % 9;
        if (k === 'ArrowRight') c = (c + 1) % 9;
        i = f * 9 + c;
      }
      seleccionar(i);
    }
  }

  function conectarEventos(root) {
    var board = root.querySelector('.sdk-board');
    if (board) {
      board.addEventListener('click', function (e) {
        var celda = e.target.closest('.sdk-celda');
        if (!celda) return;
        seleccionar(parseInt(celda.getAttribute('data-i'), 10));
      });
    }

    var pad = root.querySelector('.sdk-pad');
    if (pad) {
      pad.addEventListener('click', function (e) {
        var btn = e.target.closest('.sdk-tecla');
        if (!btn || btn.disabled) return;
        if (btn.hasAttribute('data-valor')) {
          jugada(parseInt(btn.getAttribute('data-valor'), 10));
        } else if (btn.hasAttribute('data-accion')) {
          var acc = btn.getAttribute('data-accion');
          if (acc === 'borrar') jugada(0);
          else if (acc === 'deshacer') deshacer();
          else if (acc === 'rehacer') rehacerAccion();
          else if (acc === 'modo') { S.modo = S.modo === 'notas' ? 'escribir' : 'notas'; actualizarPad(); ctxRef.sfx('toque'); }
          else if (acc === 'pista') darPista();
        }
      });
    }

    var ajustes = root.querySelector('.sdk-ajustes');
    if (ajustes) {
      ajustes.addEventListener('click', function (e) {
        var btn = e.target.closest('.sdk-ajuste');
        if (!btn) return;
        var clave = btn.getAttribute('data-clave');
        if (clave === 'errores') S.ajustes.errores = !S.ajustes.errores;
        if (clave === 'autoNotas') S.ajustes.autoNotas = !S.ajustes.autoNotas;
        guardarAjustesJuego();
        actualizarPad();
        actualizarErrores();
        ctxRef.sfx('toque');
      });
    }

    if (!tecladoConectado) {
      document.addEventListener('keydown', teclaGlobal);
      tecladoConectado = true;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Miniatura
  // ═══════════════════════════════════════════════════════════════════

  function miniaturaSudoku() {
    var svg = '<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">';
    svg += '<rect x="0" y="0" width="120" height="120" rx="16" style="fill:var(--vidrio-mar);opacity:.2"/>';
    var tam = 11, off = (120 - 9 * tam) / 2;
    for (var i = 0; i <= 9; i++) {
      var x = off + i * tam, y = off + i * tam;
      var gr = (i % 3 === 0) ? 1.6 : 0.6;
      var op = (i % 3 === 0) ? 0.7 : 0.35;
      svg += '<line x1="' + x + '" y1="' + off + '" x2="' + x + '" y2="' + (off + 9 * tam) + '" style="stroke:var(--musgo);stroke-opacity:' + op + '" stroke-width="' + gr + '"/>';
      svg += '<line x1="' + off + '" y1="' + y + '" x2="' + (off + 9 * tam) + '" y2="' + y + '" style="stroke:var(--musgo);stroke-opacity:' + op + '" stroke-width="' + gr + '"/>';
    }
    var digitos = [
      [0, 0, 5], [0, 2, 3], [0, 6, 8],
      [1, 4, 1], [1, 7, 9],
      [2, 3, 7], [2, 8, 2],
      [3, 1, 6], [3, 5, 4],
      [4, 0, 9], [4, 4, 2], [4, 8, 7],
      [5, 2, 8], [5, 6, 3],
      [6, 0, 3], [6, 5, 7],
      [7, 1, 4], [7, 4, 1],
      [8, 2, 9], [8, 6, 5], [8, 8, 6]
    ];
    for (var k = 0; k < digitos.length; k++) {
      var d = digitos[k];
      var px = off + d[1] * tam + tam / 2;
      var py = off + d[0] * tam + tam / 2 + 2.5;
      svg += '<text x="' + px + '" y="' + py + '" text-anchor="middle" font-family="Bricolage Grotesque, system-ui, sans-serif" font-size="8" font-weight="600" style="fill:var(--tinta)">' + d[2] + '</text>';
    }
    svg += '</svg>';
    return svg;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Registro del juego
  // ═══════════════════════════════════════════════════════════════════

  Arcade.register({
    id: 'sudoku',
    nombre: 'Sudoku',
    descripcion: 'Completa la cuadrícula sin repetir números en filas, columnas ni cajas.',
    dificultades: [
      { id: 'facil', nombre: 'Fácil' },
      { id: 'medio', nombre: 'Medio' },
      { id: 'dificil', nombre: 'Difícil' },
      { id: 'experto', nombre: 'Experto' }
    ],
    dificultadPorDefecto: 'medio',

    thumbnail: function () { return miniaturaSudoku(); },

    mount: function (root, ctx) {
      ctxRef = ctx;
      ctx.inyectarEstilos(CSS_SUDOKU);
      crearEstructura(root);
      conectarEventos(root);
      mostrarPreparando(true);
    },

    nuevaPartida: function (dificultadId) {
      if (!rootRef) return;
      var validas = ['facil', 'medio', 'dificil', 'experto'];
      if (validas.indexOf(dificultadId) < 0) dificultadId = 'medio';
      cancelarGeneracion();
      S.dificultad = dificultadId;
      S.pistas = 0;
      S.historial = [];
      S.rehacer = [];
      S.seleccionada = -1;
      S.modo = 'escribir';
      S.pausado = false;
      S.completado = false;
      S.completadas = new Set();
      S.puzzle = null;
      S.solucion = null;
      S.tablero = null;
      S.notas = new Uint16Array(81);
      cargarAjustesJuego();
      cronometro.reset();
      cronometro.iniciar();
      iniciarIntervaloReloj();
      var wrap = rootRef.querySelector('.sdk-wrap');
      if (wrap) wrap.classList.remove('pausado');
      mostrarPreparando(true);
      generarAsync(dificultadId);
    },

    pausar: function () {
      if (S.completado) return;
      S.pausado = true;
      cronometro.pausar();
      detenerIntervaloReloj();
      if (rootRef) {
        var wrap = rootRef.querySelector('.sdk-wrap');
        if (wrap) wrap.classList.add('pausado');
      }
      actualizarPistasTxt();
    },

    reanudar: function () {
      if (S.completado) return;
      S.pausado = false;
      cronometro.iniciar();
      iniciarIntervaloReloj();
      if (rootRef) {
        var wrap = rootRef.querySelector('.sdk-wrap');
        if (wrap) wrap.classList.remove('pausado');
      }
    },

    serializar: function () { return serializar(); },

    restaurar: function (estado) { return restaurar(estado); },

    destruir: function () {
      cancelarGeneracion();
      detenerIntervaloReloj();
      if (tecladoConectado) {
        document.removeEventListener('keydown', teclaGlobal);
        tecladoConectado = false;
      }
      ctxRef = null;
      rootRef = null;
      celdas = [];
    }
  });
})();
