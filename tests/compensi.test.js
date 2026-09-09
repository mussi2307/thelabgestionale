var test = require('node:test');
var assert = require('node:assert');
var loadTestable = require('./extract').loadTestable;

var M = loadTestable();

function somma(o) {
  var t = 0;
  Object.keys(o || {}).forEach(function(k){ t += o[k]; });
  return Math.round(t * 100) / 100;
}
function r2(n) { return Math.round(n * 100) / 100; }

// ── Comportamento storico da NON rompere ─────────────────────
// Il denominatore della ripartizione per voce e' la somma delle sole voci
// PARTECIPANTI, non di tutte. Una voce senza operatore ne' compensi non
// diluisce la quota delle altre. E' come si comporta l'app oggi sui ~90
// progetti gia' a sistema: cambiarlo riscriverebbe la contabilita' passata.

test('storico: voce senza operatore non diluisce quella con operatore', function() {
  var voci = [
    { nome: 'A', prezzo: 100, operatore: 'Mussi' },
    { nome: 'B', prezzo: 100, operatore: '' }
  ];
  var a = M.allocaVoci(voci, 100);
  assert.strictEqual(r2(a.Mussi), 100, 'Mussi prende tutto, non la meta');
  assert.strictEqual(somma(a), 100);
});

test('storico: due voci con operatore si ripartiscono in proporzione al prezzo', function() {
  var voci = [
    { nome: 'A', prezzo: 150, operatore: 'Mussi' },
    { nome: 'B', prezzo: 50,  operatore: 'Cream' }
  ];
  var a = M.allocaVoci(voci, 200);
  assert.strictEqual(r2(a.Mussi), 150);
  assert.strictEqual(r2(a.Cream), 50);
  assert.strictEqual(somma(a), 200);
});

test('storico: nessuna voce partecipante restituisce null', function() {
  assert.strictEqual(M.allocaVoci([{ nome: 'A', prezzo: 100, operatore: '' }], 100), null);
  assert.strictEqual(M.allocaVoci([], 100), null);
  assert.strictEqual(M.allocaVoci(null, 100), null);
});

test('storico: voce con prezzo zero non partecipa', function() {
  var voci = [
    { nome: 'A', prezzo: 0,   operatore: 'Mussi' },
    { nome: 'B', prezzo: 100, operatore: 'Cream' }
  ];
  var a = M.allocaVoci(voci, 100);
  assert.strictEqual(r2(a.Cream), 100);
  assert.strictEqual(a.Mussi || 0, 0);
});

test('storico: il campo compenso vale come prezzo quando prezzo manca', function() {
  var a = M.allocaVoci([{ nome: 'A', compenso: 100, operatore: 'Mussi' }], 100);
  assert.strictEqual(r2(a.Mussi), 100);
});

// ── Compensi espliciti ───────────────────────────────────────

test('compensi: una parte al tecnico, il resto allo Studio', function() {
  var voci = [{ nome: 'Registrazione', prezzo: 100, compensi: [{ nome: 'Luca', importo: 30 }] }];
  var a = M.allocaVoci(voci, 100);
  assert.strictEqual(r2(a.Luca), 30);
  assert.strictEqual(r2(a.TheLab), 70);
  assert.strictEqual(somma(a), 100);
});

test('compensi: distribuzione completa non lascia nulla allo Studio', function() {
  var voci = [{ nome: 'Registrazione', prezzo: 100, compensi: [
    { nome: 'Luca', importo: 30 }, { nome: 'Mussi', importo: 70 }
  ] }];
  var a = M.allocaVoci(voci, 100);
  assert.strictEqual(r2(a.Luca), 30);
  assert.strictEqual(r2(a.Mussi), 70);
  assert.strictEqual(a.TheLab || 0, 0);
  assert.strictEqual(somma(a), 100);
});

test('compensi: incasso parziale riduce tutti in proporzione', function() {
  var voci = [{ nome: 'Registrazione', prezzo: 100, compensi: [
    { nome: 'Luca', importo: 30 }, { nome: 'Mussi', importo: 70 }
  ] }];
  var a = M.allocaVoci(voci, 50);
  assert.strictEqual(r2(a.Luca), 15, 'le proporzioni decise si mantengono');
  assert.strictEqual(r2(a.Mussi), 35);
  assert.strictEqual(somma(a), 50);
});

test('compensi: somma superiore al prezzo voce viene scalata, mai sovra-allocata', function() {
  var voci = [{ nome: 'Registrazione', prezzo: 100, compensi: [
    { nome: 'Luca', importo: 80 }, { nome: 'Mussi', importo: 80 }
  ] }];
  var a = M.allocaVoci(voci, 100);
  assert.strictEqual(somma(a), 100, 'non si alloca piu' + ' dell incassato');
  assert.strictEqual(r2(a.Luca), 50, 'scalati in proporzione fra loro');
  assert.strictEqual(r2(a.Mussi), 50);
  assert.strictEqual(a.TheLab || 0, 0);
});

test('compensi: voci miste, una con compensi e una con operatore', function() {
  var voci = [
    { nome: 'A', prezzo: 100, compensi: [{ nome: 'Luca', importo: 30 }] },
    { nome: 'B', prezzo: 100, operatore: 'Cream' }
  ];
  var a = M.allocaVoci(voci, 200);
  assert.strictEqual(r2(a.Luca), 30);
  assert.strictEqual(r2(a.TheLab), 70, 'il resto della voce A');
  assert.strictEqual(r2(a.Cream), 100, 'la voce B invariata');
  assert.strictEqual(somma(a), 200);
});

test('compensi: una voce con compensi rende partecipante anche senza operatore', function() {
  var voci = [
    { nome: 'A', prezzo: 100, operatore: '', compensi: [{ nome: 'Luca', importo: 40 }] },
    { nome: 'B', prezzo: 100, operatore: '' }
  ];
  var a = M.allocaVoci(voci, 100);
  assert.strictEqual(r2(a.Luca), 40, 'B non partecipa, quindi A prende tutto l incasso');
  assert.strictEqual(r2(a.TheLab), 60);
  assert.strictEqual(somma(a), 100);
});

test('compensi: i compensi vincono sull operatore sulla stessa voce', function() {
  var voci = [{ nome: 'A', prezzo: 100, operatore: 'Mussi', compensi: [{ nome: 'Luca', importo: 40 }] }];
  var a = M.allocaVoci(voci, 100);
  assert.strictEqual(r2(a.Luca), 40);
  assert.strictEqual(r2(a.TheLab), 60);
  assert.strictEqual(a.Mussi || 0, 0, 'l operatore non riceve quando ci sono compensi espliciti');
});

test('compensi: righe senza nome o con importo zero sono ignorate', function() {
  var voci = [{ nome: 'A', prezzo: 100, operatore: 'Mussi', compensi: [
    { nome: '', importo: 50 }, { nome: 'Luca', importo: 0 }, { nome: 'Pana', importo: 25 }
  ] }];
  var a = M.allocaVoci(voci, 100);
  assert.strictEqual(r2(a.Pana), 25);
  assert.strictEqual(r2(a.TheLab), 75);
  assert.strictEqual(a.Luca || 0, 0);
  assert.strictEqual(somma(a), 100);
});

test('compensi: array vuoto equivale a nessun compenso, torna l operatore', function() {
  var a = M.allocaVoci([{ nome: 'A', prezzo: 100, operatore: 'Mussi', compensi: [] }], 100);
  assert.strictEqual(r2(a.Mussi), 100);
  assert.strictEqual(a.TheLab || 0, 0);
});

test('compensi: importi negativi non generano quote negative', function() {
  var voci = [{ nome: 'A', prezzo: 100, operatore: 'Mussi', compensi: [{ nome: 'Luca', importo: -50 }] }];
  var a = M.allocaVoci(voci, 100);
  Object.keys(a).forEach(function(k){ assert.ok(a[k] >= 0, 'quota negativa per ' + k); });
  assert.strictEqual(r2(a.Mussi), 100, 'compenso invalido ignorato, vale l operatore');
});

test('compensi: incassato zero alloca zero a tutti senza esplodere', function() {
  var voci = [{ nome: 'A', prezzo: 100, compensi: [{ nome: 'Luca', importo: 30 }] }];
  var a = M.allocaVoci(voci, 0);
  assert.strictEqual(somma(a), 0);
});

test('invariante: su una batteria di combinazioni la somma resta pari all incassato', function() {
  var prezzi = [50, 100, 333.33];
  var importi = [0, 10, 30, 100, 500];
  var incassi = [0, 25, 100, 200];
  prezzi.forEach(function(p) {
    importi.forEach(function(i) {
      incassi.forEach(function(inc) {
        var voci = [
          { nome: 'A', prezzo: p, compensi: [{ nome: 'Luca', importo: i }] },
          { nome: 'B', prezzo: 100, operatore: 'Cream' }
        ];
        var a = M.allocaVoci(voci, inc);
        var etichetta = 'p=' + p + ' i=' + i + ' inc=' + inc;
        assert.strictEqual(somma(a), r2(inc), etichetta + ': somma != incassato');
        Object.keys(a).forEach(function(k) {
          assert.ok(a[k] >= 0, etichetta + ': quota negativa per ' + k);
        });
      });
    });
  });
});
