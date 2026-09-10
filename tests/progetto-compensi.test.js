var test = require('node:test');
var assert = require('node:assert');
var M = require('./extract').loadTestable();

// ── voceSingolo: il progetto SINGOLO diventa una voce sola ───
// Cosi' allocaVoci() lo gestisce senza logica nuova: una lista da un
// elemento e' un caso perfettamente normale per lei.

test('voceSingolo: usa il prezzo di listino come peso', function() {
  var v = M.voceSingolo('Registrazione 2 ore', { Prezzo_Listino: 200, Acconto: 50, Saldo: 0 }, [{ nome: 'Luca', importo: 50 }]);
  assert.strictEqual(v.nome, 'Registrazione 2 ore');
  assert.strictEqual(v.prezzo, 200);
  assert.deepStrictEqual(v.compensi, [{ nome: 'Luca', importo: 50 }]);
});

test('voceSingolo: senza prezzo di listino ripiega su acconto piu saldo', function() {
  var v = M.voceSingolo('Mix', { Prezzo_Listino: 0, Acconto: 70, Saldo: 30 }, []);
  assert.strictEqual(v.prezzo, 100, 'senza listino il peso e cio che e stato incassato');
});

test('voceSingolo: listino a zero e nessun incasso da peso zero', function() {
  var v = M.voceSingolo('Mix', {}, []);
  assert.strictEqual(v.prezzo, 0);
});

test('voceSingolo: compensi assenti danno lista vuota, non undefined', function() {
  var v = M.voceSingolo('Mix', { Prezzo_Listino: 100 }, null);
  assert.deepStrictEqual(v.compensi, []);
});

test('voceSingolo: una voce sintetica si alloca come qualsiasi altra', function() {
  var v = M.voceSingolo('Registrazione', { Prezzo_Listino: 200 }, [
    { nome: 'Cream', importo: 150 }, { nome: 'Luca', importo: 50 }
  ]);
  var a = M.allocaVoci([v], 200);
  assert.strictEqual(Math.round(a.Cream * 100) / 100, 150);
  assert.strictEqual(Math.round(a.Luca * 100) / 100, 50);
  assert.strictEqual(a.TheLab || 0, 0);
});

// ── nomiDaCompensi: Assegnato_A si deriva, non si compila ────

test('nomiDaCompensi: raccoglie i nomi da tutte le voci', function() {
  var voci = [
    { nome: 'A', prezzo: 100, compensi: [{ nome: 'Cream', importo: 60 }, { nome: 'Luca', importo: 40 }] },
    { nome: 'B', prezzo: 100, compensi: [{ nome: 'Mussi', importo: 100 }] }
  ];
  assert.deepStrictEqual(M.nomiDaCompensi(voci), ['Cream','Luca','Mussi']);
});

test('nomiDaCompensi: niente duplicati fra voci diverse', function() {
  var voci = [
    { nome: 'A', prezzo: 100, compensi: [{ nome: 'Cream', importo: 60 }] },
    { nome: 'B', prezzo: 100, compensi: [{ nome: 'Cream', importo: 40 }] }
  ];
  assert.deepStrictEqual(M.nomiDaCompensi(voci), ['Cream']);
});

test('nomiDaCompensi: ignora righe senza nome o con importo zero', function() {
  var voci = [{ nome: 'A', prezzo: 100, compensi: [
    { nome: '', importo: 50 }, { nome: 'Luca', importo: 0 }, { nome: 'Pana', importo: 25 }
  ] }];
  assert.deepStrictEqual(M.nomiDaCompensi(voci), ['Pana']);
});

test('nomiDaCompensi: senza compensi ricade sugli operatori delle voci', function() {
  var voci = [
    { nome: 'A', prezzo: 100, operatore: 'Cream' },
    { nome: 'B', prezzo: 100, operatore: 'Mussi' }
  ];
  assert.deepStrictEqual(M.nomiDaCompensi(voci), ['Cream','Mussi'],
    'un progetto senza compensi deve comunque popolare Assegnato_A');
});

test('nomiDaCompensi: compensi e operatori convivono senza duplicare', function() {
  var voci = [
    { nome: 'A', prezzo: 100, operatore: 'Cream', compensi: [{ nome: 'Luca', importo: 40 }] },
    { nome: 'B', prezzo: 100, operatore: 'Cream' }
  ];
  assert.deepStrictEqual(M.nomiDaCompensi(voci), ['Cream','Luca']);
});

test('nomiDaCompensi: lista vuota o nulla non esplode', function() {
  assert.deepStrictEqual(M.nomiDaCompensi([]), []);
  assert.deepStrictEqual(M.nomiDaCompensi(null), []);
});

test('nomiDaCompensi: TheLab non finisce fra gli assegnatari', function() {
  var voci = [{ nome: 'A', prezzo: 100, compensi: [{ nome: 'TheLab', importo: 50 }, { nome: 'Luca', importo: 50 }] }];
  assert.deepStrictEqual(M.nomiDaCompensi(voci), ['Luca'],
    'lo Studio e l entita residuale, non una persona assegnata');
});

// ── Percorso completo: SINGOLO con compensi in contabilita ───

test('SINGOLO: Cream 150 e Luca 50 su un incasso di 200', function() {
  var prj = {
    Tipo: 'SINGOLO', Servizio: 'Registrazione 2 ore',
    Prezzo_Listino: 200, Acconto: 100, Saldo: 100,
    Voci_Bundle: [ M.voceSingolo('Registrazione 2 ore', { Prezzo_Listino: 200 }, [
      { nome: 'Cream', importo: 150, data: '' },
      { nome: 'Luca',  importo: 50,  data: '2026-04-15' }
    ]) ]
  };
  // Acconto e saldo si allocano separatamente, come fa buildMovimenti
  var tot = {};
  [100, 100].forEach(function(imp) {
    var a = M.allocaVoci(prj.Voci_Bundle, imp);
    var s = 0;
    Object.keys(a).forEach(function(k){ s += a[k]; tot[k] = (tot[k]||0) + a[k]; });
    assert.strictEqual(Math.round(s*100)/100, imp, 'ogni movimento allocato per intero');
  });
  assert.strictEqual(Math.round(tot.Cream*100)/100, 150);
  assert.strictEqual(Math.round(tot.Luca*100)/100, 50);
  assert.strictEqual(tot.TheLab || 0, 0);
});

test('SINGOLO: la data del compenso non altera gli importi', function() {
  var senzaData = [{ nome: 'Luca', importo: 50 }];
  var conData   = [{ nome: 'Luca', importo: 50, data: '2026-04-15' }];
  var a = M.allocaVoci([M.voceSingolo('X', { Prezzo_Listino: 200 }, senzaData)], 200);
  var b = M.allocaVoci([M.voceSingolo('X', { Prezzo_Listino: 200 }, conData)], 200);
  assert.deepStrictEqual(a, b, 'la data e una nota, non incide sul calcolo');
});

test('SINGOLO senza compensi: nessuna voce, si ricade sul comportamento storico', function() {
  assert.strictEqual(M.allocaVoci([], 200), null, 'null fa scattare il fallback Assegnato_A');
});
