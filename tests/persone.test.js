var test = require('node:test');
var assert = require('node:assert');
var M = require('./extract').loadTestable();

var RUOLI = [
  { ID_Persona: 'p1', Nome: 'Mussi',  Ruolo: 'Team',      Valore: 0,  Data_Inizio: '2000-01-01', Data_Fine: '2099-12-31' },
  { ID_Persona: 'p1', Nome: 'Mussi',  Ruolo: 'Fonico',    Valore: 50, Data_Inizio: '2000-01-01', Data_Fine: '2099-12-31' },
  { ID_Persona: 'p1', Nome: 'Mussi',  Ruolo: 'Venditore', Valore: 10, Data_Inizio: '2000-01-01', Data_Fine: '2099-12-31' },
  { ID_Persona: 'p2', Nome: 'Saso',   Ruolo: 'Team',      Valore: 0,  Data_Inizio: '2000-01-01', Data_Fine: '2099-12-31' },
  { ID_Persona: 'p2', Nome: 'Saso',   Ruolo: 'Venditore', Valore: 12, Data_Inizio: '2000-01-01', Data_Fine: '2099-12-31' },
  { ID_Persona: 'p3', Nome: 'Luca',   Ruolo: 'Fonico',    Valore: 40, Data_Inizio: '2026-01-01', Data_Fine: '2026-10-01' },
  { ID_Persona: 'p4', Nome: 'Futuro', Ruolo: 'Fonico',    Valore: 30, Data_Inizio: '2027-01-01', Data_Fine: '2099-12-31' }
];

test('attivoIl: dentro la finestra', function() {
  assert.strictEqual(M.attivoIl({ Data_Inizio: '2026-01-01', Data_Fine: '2026-10-01' }, '2026-05-01'), true);
});

test('attivoIl: gli estremi sono inclusi', function() {
  var r = { Data_Inizio: '2026-01-01', Data_Fine: '2026-10-01' };
  assert.strictEqual(M.attivoIl(r, '2026-01-01'), true);
  assert.strictEqual(M.attivoIl(r, '2026-10-01'), true);
});

test('attivoIl: fuori dalla finestra', function() {
  var r = { Data_Inizio: '2026-01-01', Data_Fine: '2026-10-01' };
  assert.strictEqual(M.attivoIl(r, '2025-12-31'), false);
  assert.strictEqual(M.attivoIl(r, '2026-10-02'), false);
});

test('attivoIl: date assenti valgono finestra aperta', function() {
  assert.strictEqual(M.attivoIl({}, '2026-05-01'), true);
  assert.strictEqual(M.attivoIl({ Data_Inizio: '', Data_Fine: '' }, '2026-05-01'), true);
});

test('attivoIl: tollera timestamp ISO completi', function() {
  assert.strictEqual(M.attivoIl({ Data_Inizio: '2026-01-01T10:00:00.000Z', Data_Fine: '2026-10-01T00:00:00.000Z' }, '2026-05-01'), true);
});

test('attivoIl: record nullo non e mai attivo', function() {
  assert.strictEqual(M.attivoIl(null, '2026-05-01'), false);
});

test('personeConRuolo: filtra per ruolo e per data', function() {
  var f = M.personeConRuolo(RUOLI, 'Fonico', '2026-05-01');
  assert.deepStrictEqual(f.map(function(r){ return r.Nome; }).sort(), ['Luca','Mussi']);
});

test('personeConRuolo: un fonico chiuso sparisce dal giorno dopo', function() {
  assert.ok(M.nomiConRuolo(RUOLI, 'Fonico', '2026-10-01').indexOf('Luca') !== -1, 'l ultimo giorno e ancora dentro');
  assert.ok(M.nomiConRuolo(RUOLI, 'Fonico', '2026-10-02').indexOf('Luca') === -1, 'il giorno dopo e fuori');
});

test('personeConRuolo: un ruolo non ancora iniziato non compare', function() {
  assert.ok(M.nomiConRuolo(RUOLI, 'Fonico', '2026-05-01').indexOf('Futuro') === -1);
  assert.ok(M.nomiConRuolo(RUOLI, 'Fonico', '2027-06-01').indexOf('Futuro') !== -1);
});

test('personeConRuolo: la stessa persona compare in piu ruoli', function() {
  assert.ok(M.nomiConRuolo(RUOLI, 'Team', '2026-05-01').indexOf('Mussi') !== -1);
  assert.ok(M.nomiConRuolo(RUOLI, 'Fonico', '2026-05-01').indexOf('Mussi') !== -1);
  assert.ok(M.nomiConRuolo(RUOLI, 'Venditore', '2026-05-01').indexOf('Mussi') !== -1);
});

test('nomiConRuolo: nomi unici e ordinati, niente vuoti', function() {
  var doppi = RUOLI.concat([{ ID_Persona: 'p9', Nome: 'Mussi', Ruolo: 'Team', Data_Inizio: '', Data_Fine: '' },
                            { ID_Persona: 'p8', Nome: '',      Ruolo: 'Team', Data_Inizio: '', Data_Fine: '' }]);
  var n = M.nomiConRuolo(doppi, 'Team', '2026-05-01');
  assert.deepStrictEqual(n, ['Mussi','Saso']);
});

test('personeConRuolo: lista vuota o nulla non esplode', function() {
  assert.deepStrictEqual(M.personeConRuolo(null, 'Team', '2026-05-01'), []);
  assert.deepStrictEqual(M.nomiConRuolo([], 'Team', '2026-05-01'), []);
});

test('personeConRuolo: senza data usa oggi', function() {
  var sempre = [{ Nome: 'X', Ruolo: 'Team', Data_Inizio: '2000-01-01', Data_Fine: '2099-12-31' }];
  assert.deepStrictEqual(M.nomiConRuolo(sempre, 'Team'), ['X']);
});
