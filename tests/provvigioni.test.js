var test = require('node:test');
var assert = require('node:assert');
var loadTestable = require('./extract').loadTestable;

var M = loadTestable();

test('provvigioneDovuta: 10% su 200 fa 20', function() {
  assert.strictEqual(M.provvigioneDovuta(200, 10), 20);
});

test('provvigioneDovuta: arrotonda al centesimo', function() {
  assert.strictEqual(M.provvigioneDovuta(333.33, 7.5), 25);
});

test('provvigioneDovuta: percentuale o importo assenti danno 0', function() {
  assert.strictEqual(M.provvigioneDovuta(200, 0), 0);
  assert.strictEqual(M.provvigioneDovuta(0, 10), 0);
  assert.strictEqual(M.provvigioneDovuta(null, null), 0);
  assert.strictEqual(M.provvigioneDovuta('', ''), 0);
});

test('ritagliaProvvigione: il residuo sta tutto dentro il movimento', function() {
  var r = M.ritagliaProvvigione(100, 10);
  assert.strictEqual(r.quotaVenditore, 10);
  assert.strictEqual(r.restante, 90);
  assert.strictEqual(r.residuoDopo, 0);
});

test('ritagliaProvvigione: il residuo sconfina oltre il movimento', function() {
  var r = M.ritagliaProvvigione(100, 120);
  assert.strictEqual(r.quotaVenditore, 100);
  assert.strictEqual(r.restante, 0);
  assert.strictEqual(r.residuoDopo, 20);
});

test('ritagliaProvvigione: nessun residuo lascia il movimento intatto', function() {
  var r = M.ritagliaProvvigione(100, 0);
  assert.strictEqual(r.quotaVenditore, 0);
  assert.strictEqual(r.restante, 100);
  assert.strictEqual(r.residuoDopo, 0);
});

test('ritagliaProvvigione: non produce mai numeri negativi', function() {
  var r = M.ritagliaProvvigione(-50, -10);
  assert.strictEqual(r.quotaVenditore, 0);
  assert.ok(r.restante >= 0);
  assert.ok(r.residuoDopo >= 0);
});

test('waterfall completa: 200 di trattativa, 10 corrisposti, acconto poi saldo', function() {
  var residuo = 10;
  var acc = M.ritagliaProvvigione(100, residuo);
  residuo = acc.residuoDopo;
  var sal = M.ritagliaProvvigione(100, residuo);
  assert.strictEqual(acc.quotaVenditore, 10);
  assert.strictEqual(acc.restante, 90);
  assert.strictEqual(sal.quotaVenditore, 0);
  assert.strictEqual(sal.restante, 100);
  assert.strictEqual(acc.quotaVenditore + sal.quotaVenditore, 10);
  assert.strictEqual(acc.restante + sal.restante, 190);
});

test('waterfall: 120 corrisposti sconfinano dall acconto al saldo', function() {
  var residuo = 120;
  var acc = M.ritagliaProvvigione(100, residuo);
  residuo = acc.residuoDopo;
  var sal = M.ritagliaProvvigione(100, residuo);
  assert.strictEqual(acc.quotaVenditore, 100);
  assert.strictEqual(acc.restante, 0);
  assert.strictEqual(sal.quotaVenditore, 20);
  assert.strictEqual(sal.restante, 80);
  assert.strictEqual(acc.quotaVenditore + sal.quotaVenditore, 120);
});

test('trovaProvvigioneProgetto: aggancia il progetto al preventivo di origine', function() {
  var prj = { ID_Preventivo_Origine: 'pv1' };
  var rows = [{ ID_Preventivo: 'pv1', Nome_Venditore: 'Saso', Importo_Corrisposto: 10 }];
  var r = M.trovaProvvigioneProgetto(prj, rows);
  assert.deepStrictEqual(r, { nome: 'Saso', residuo: 10 });
});

test('trovaProvvigioneProgetto: null se corrisposto e zero', function() {
  var prj = { ID_Preventivo_Origine: 'pv1' };
  var rows = [{ ID_Preventivo: 'pv1', Nome_Venditore: 'Saso', Importo_Corrisposto: 0 }];
  assert.strictEqual(M.trovaProvvigioneProgetto(prj, rows), null);
});

test('trovaProvvigioneProgetto: null se il progetto non viene da un preventivo', function() {
  assert.strictEqual(M.trovaProvvigioneProgetto({}, [{ID_Preventivo:'pv1',Nome_Venditore:'Saso',Importo_Corrisposto:10}]), null);
});

test('trovaProvvigioneProgetto: null se manca il nome del venditore', function() {
  var prj = { ID_Preventivo_Origine: 'pv1' };
  var rows = [{ ID_Preventivo: 'pv1', Nome_Venditore: '', Importo_Corrisposto: 10 }];
  assert.strictEqual(M.trovaProvvigioneProgetto(prj, rows), null);
});

test('trovaProvvigioneProgetto: tollera lista vuota o non array', function() {
  var prj = { ID_Preventivo_Origine: 'pv1' };
  assert.strictEqual(M.trovaProvvigioneProgetto(prj, []), null);
  assert.strictEqual(M.trovaProvvigioneProgetto(prj, null), null);
});
