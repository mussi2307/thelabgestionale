var test = require('node:test');
var assert = require('node:assert');
var loadTestable = require('./extract').loadTestable;

var M = loadTestable();

function fixture() {
  return {
    clients: [
      { ID_Cliente: 'c1', NomeCliente: 'Michele', Nome: 'Michele', Cognome: 'Rapper', StatoPipeline: 'CLOSED_WON' },
      { ID_Cliente: 'c2', Nome: 'Anna', Cognome: 'Bianchi', StatoPipeline: 'IN_PRODUCTION' }
    ],
    preventivi: [
      { ID_Preventivo: 'pv1', ID_Cliente: 'c1', NomeCliente: 'Michele', Nome_Bundle: 'Pacchetto REC', Prezzo_Totale: 200, Stato: 'ACCETTATO', ID_Venditore: 'k1', UpdatedAt: '2026-03-10T09:00:00.000Z' },
      { ID_Preventivo: 'pv2', ID_Cliente: 'c2', NomeCliente: 'Anna', Nome_Bundle: 'Mix', Prezzo_Totale: 500, Stato: 'ACCETTATO', ID_Venditore: 'k1', UpdatedAt: '2026-03-11T09:00:00.000Z' },
      { ID_Preventivo: 'pv3', ID_Cliente: 'c1', NomeCliente: 'Michele', Nome_Bundle: 'Video', Prezzo_Totale: 300, Stato: 'INVIATO', ID_Venditore: 'k1', UpdatedAt: '2026-03-12T09:00:00.000Z' }
    ],
    provvigioni: [],
    collaboratori: [
      { ID_Collaboratore: 'k1', Nome: 'Saso', Ruolo: 'Venditore', Modello_Compenso: 'Percentuale_Su_Chiuso', Valore: 10, Data_Inizio: '2000-01-01', Data_Fine: '2099-12-31' }
    ],
    progetti: [
      { ID_Progetto: 'p1', ID_Preventivo_Origine: 'pv1', Acconto: 100, Saldo: 0 }
    ]
  };
}

function run(f) {
  return M.buildTrattativeChiuse(f.clients, f.preventivi, f.provvigioni, f.collaboratori, f.progetti);
}

test('solo preventivi ACCETTATO di clienti CLOSED_WON', function() {
  var rows = run(fixture());
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].ID_Preventivo, 'pv1');
});

test('dovuto calcolato sul lordo, percentuale dal collaboratore', function() {
  var rows = run(fixture());
  assert.strictEqual(rows[0].importoTrattativa, 200);
  assert.strictEqual(rows[0].percentuale, 10);
  assert.strictEqual(rows[0].dovuto, 20);
  assert.strictEqual(rows[0].venditore, 'Saso');
});

test('senza riga di provvigione il corrisposto e zero e la riga e rossa', function() {
  var rows = run(fixture());
  assert.strictEqual(rows[0].corrisposto, 0);
  assert.strictEqual(rows[0].residuo, 20);
  assert.strictEqual(rows[0].rosso, true);
  assert.strictEqual(rows[0].chiusa, false);
});

test('corrisposto pieno toglie il rosso', function() {
  var f = fixture();
  f.provvigioni = [{ ID_Preventivo: 'pv1', ID_Cliente: 'c1', ID_Venditore: 'k1', Nome_Venditore: 'Saso', Percentuale: 10, Importo_Corrisposto: 20, Chiusa: false }];
  var rows = run(f);
  assert.strictEqual(rows[0].corrisposto, 20);
  assert.strictEqual(rows[0].residuo, 0);
  assert.strictEqual(rows[0].rosso, false);
});

test('la spunta toglie il rosso anche con corrisposto parziale', function() {
  var f = fixture();
  f.provvigioni = [{ ID_Preventivo: 'pv1', ID_Cliente: 'c1', ID_Venditore: 'k1', Nome_Venditore: 'Saso', Percentuale: 10, Importo_Corrisposto: 5, Chiusa: true }];
  var rows = run(f);
  assert.strictEqual(rows[0].corrisposto, 5);
  assert.strictEqual(rows[0].residuo, 15);
  assert.strictEqual(rows[0].chiusa, true);
  assert.strictEqual(rows[0].rosso, false);
});

test('Chiusa accetta anche la stringa SI dal foglio', function() {
  var f = fixture();
  f.provvigioni = [{ ID_Preventivo: 'pv1', Nome_Venditore: 'Saso', Percentuale: 10, Importo_Corrisposto: 5, Chiusa: 'SI' }];
  assert.strictEqual(run(f)[0].chiusa, true);
});

test('la percentuale congelata nella riga vince su quella del registro', function() {
  var f = fixture();
  f.provvigioni = [{ ID_Preventivo: 'pv1', Nome_Venditore: 'Saso', Percentuale: 25, Importo_Corrisposto: 0 }];
  f.collaboratori[0].Valore = 10;
  var rows = run(f);
  assert.strictEqual(rows[0].percentuale, 25);
  assert.strictEqual(rows[0].dovuto, 50);
});

test('inSospeso e il corrisposto non ancora coperto dagli incassi', function() {
  var f = fixture();
  f.provvigioni = [{ ID_Preventivo: 'pv1', Nome_Venditore: 'Saso', Percentuale: 10, Importo_Corrisposto: 20 }];
  f.progetti = [{ ID_Progetto: 'p1', ID_Preventivo_Origine: 'pv1', Acconto: 15, Saldo: 0 }];
  assert.strictEqual(run(f)[0].inSospeso, 5);
});

test('incassi sufficienti azzerano inSospeso', function() {
  var f = fixture();
  f.provvigioni = [{ ID_Preventivo: 'pv1', Nome_Venditore: 'Saso', Percentuale: 10, Importo_Corrisposto: 20 }];
  f.progetti = [{ ID_Progetto: 'p1', ID_Preventivo_Origine: 'pv1', Acconto: 100, Saldo: 100 }];
  assert.strictEqual(run(f)[0].inSospeso, 0);
});

test('preventivo senza progetto collegato e segnalato', function() {
  var f = fixture();
  f.progetti = [];
  assert.strictEqual(run(f)[0].senzaProgetto, true);
});

test('vendita diretta senza venditore ha dovuto zero e non e rossa', function() {
  var f = fixture();
  f.preventivi[0].ID_Venditore = '';
  var rows = run(f);
  assert.strictEqual(rows[0].venditore, '');
  assert.strictEqual(rows[0].dovuto, 0);
  assert.strictEqual(rows[0].rosso, false);
});

test('data chiusura da UpdatedAt, fallback su CreatedAt', function() {
  assert.strictEqual(run(fixture())[0].data, '2026-03-10');
  var f2 = fixture();
  delete f2.preventivi[0].UpdatedAt;
  f2.preventivi[0].CreatedAt = '2026-01-05T08:00:00.000Z';
  assert.strictEqual(run(f2)[0].data, '2026-01-05');
});

test('ordinamento per data decrescente', function() {
  var f = fixture();
  f.clients.push({ ID_Cliente: 'c3', Nome: 'Luca', Cognome: 'Verdi', StatoPipeline: 'CLOSED_WON' });
  f.preventivi.push({ ID_Preventivo: 'pv4', ID_Cliente: 'c3', NomeCliente: 'Luca', Nome_Bundle: 'Master', Prezzo_Totale: 100, Stato: 'ACCETTATO', ID_Venditore: 'k1', UpdatedAt: '2026-05-01T09:00:00.000Z' });
  var rows = run(f);
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(rows[0].ID_Preventivo, 'pv4');
  assert.strictEqual(rows[1].ID_Preventivo, 'pv1');
});

test('un cliente che ricompra genera due righe', function() {
  var f = fixture();
  f.preventivi[2].Stato = 'ACCETTATO';
  var rows = run(f);
  assert.strictEqual(rows.length, 2);
  assert.deepStrictEqual(rows.map(function(r){ return r.ID_Preventivo; }).sort(), ['pv1','pv3']);
});

test('nome cliente ricostruito da Nome e Cognome se NomeCliente manca', function() {
  var f = fixture();
  delete f.preventivi[0].NomeCliente;
  assert.strictEqual(run(f)[0].cliente, 'Michele Rapper');
});

test('tollera argomenti null senza esplodere', function() {
  assert.deepStrictEqual(M.buildTrattativeChiuse(null, null, null, null, null), []);
});

// ── Invariante contabile ─────────────────────────────────────
// La somma delle allocazioni di un movimento deve sempre essere pari
// all'importo del movimento: e' cio' che tiene fermo il Totale Studio.

test('invariante: la waterfall non altera il totale incassato', function() {
  var casi = [
    { acconto: 100, saldo: 100, corrisposto: 10 },
    { acconto: 100, saldo: 100, corrisposto: 120 },
    { acconto: 100, saldo: 100, corrisposto: 0 },
    { acconto: 0,   saldo: 200, corrisposto: 20 },
    { acconto: 15,  saldo: 0,   corrisposto: 20 },
    { acconto: 200, saldo: 0,   corrisposto: 200 }
  ];
  casi.forEach(function(c) {
    var residuo = c.corrisposto;
    var totVend = 0, totRest = 0;
    [c.acconto, c.saldo].forEach(function(imp) {
      if (imp <= 0) return;
      var r = M.ritagliaProvvigione(imp, residuo);
      residuo = r.residuoDopo;
      totVend += r.quotaVenditore;
      totRest += r.restante;
    });
    assert.strictEqual(totVend + totRest, c.acconto + c.saldo,
      'caso ' + JSON.stringify(c) + ': somma allocazioni diversa dall incassato');
    assert.ok(totVend >= 0 && totRest >= 0, 'caso ' + JSON.stringify(c) + ': quota negativa');
    assert.ok(totVend <= c.corrisposto, 'caso ' + JSON.stringify(c) + ': allocato piu del corrisposto');
  });
});
