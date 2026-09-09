// Test di integrazione: esegue le VERE buildMovimenti() e
// getRevenueAllocationsForProject() di index.html, non delle copie.
// Il blocco <script> principale viene valutato in una sandbox con stub minimi
// di document/window, poi si inietta _s e si chiama la funzione.
//
// Serve perche' i test sulle funzioni pure non coprono il cablaggio: e' li'
// che un errore di firma o un residuo mal propagato passerebbe inosservato.

var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs');
var path = require('path');

function noop() { return undefined; }

function fakeEl() {
  return {
    value: '', textContent: '', innerHTML: '', className: '', style: {},
    classList: { add: noop, remove: noop, contains: function(){ return false; } },
    querySelectorAll: function(){ return []; },
    appendChild: noop, setAttribute: noop, getAttribute: function(){ return null; },
    addEventListener: noop, remove: noop
  };
}

function loadApp() {
  var html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  var blocks = html.match(/<script>([\s\S]*?)<\/script>/g) || [];
  // Il blocco principale e' il piu' grande: contiene tutta la logica.
  var main = blocks.sort(function(a, b) { return b.length - a.length; })[0]
    .replace(/^<script>/, '').replace(/<\/script>$/, '');

  var doc = {
    getElementById: function(){ return null; },
    querySelectorAll: function(){ return []; },
    querySelector: function(){ return null; },
    createElement: fakeEl,
    addEventListener: noop,
    body: fakeEl()
  };
  var sandbox = {
    document: doc,
    window: {},
    console: { log: noop, warn: noop, error: noop },
    fetch: function(){ return Promise.resolve({ json: function(){ return Promise.resolve({}); } }); },
    setTimeout: noop, clearTimeout: noop, setInterval: noop, clearInterval: noop,
    localStorage: { getItem: function(){ return null; }, setItem: noop },
    Chart: function(){ return { destroy: noop }; },
    google: undefined
  };
  sandbox.window = sandbox;

  var out = {};
  var fn = new Function(
    'document','window','console','fetch','setTimeout','clearTimeout',
    'setInterval','clearInterval','localStorage','Chart','__out',
    main + '\n;__out.buildMovimenti=buildMovimenti;'
         + '__out.getRevenueAllocationsForProject=getRevenueAllocationsForProject;'
         + '__out.setState=function(s){_s=s;};'
         + '__out.TEAM_MEMBERS=TEAM_MEMBERS;'
         + '__out.beneficiariRicavi=beneficiariRicavi;'
  );
  fn(sandbox.document, sandbox.window, sandbox.console, sandbox.fetch,
     sandbox.setTimeout, sandbox.clearTimeout, sandbox.setInterval,
     sandbox.clearInterval, sandbox.localStorage, sandbox.Chart, out);
  return out;
}

var App = loadApp();

function statoBase(provvigioni, progetti) {
  return {
    user: { email: 'x@y.z', role: 'admin' },
    clients: [], preventivi: [], interazioni: {},
    projects: progetti,
    provvigioni: provvigioni,
    collaboratori: [{ ID_Collaboratore: 'k1', Nome: 'Saso', Ruolo: 'Venditore', Valore: 10, Data_Inizio: '2000-01-01', Data_Fine: '2099-12-31' }],
    listino: { servizi: [], bundles: [] },
    obiettivi: { studio: 0, mussi: 0 }
  };
}

function progettoBundle(acc, sal) {
  return {
    ID_Progetto: 'p1', ProjectCode: 'PRJ-0001', NomeCliente: 'Michele',
    Servizio: 'Pacchetto REC', ID_Preventivo_Origine: 'pv1',
    Voci_Bundle: [{ nome: 'Registrazione', prezzo: 200, operatore: 'Cream' }],
    Acconto: acc, Data_Acconto: '2026-01-15',
    Saldo: sal, Data_Saldo: '2026-03-15',
    Prezzo_Listino: 200, Stato: 'CHIUSO'
  };
}

function somma(alloc) {
  var t = 0;
  Object.keys(alloc).forEach(function(k){ t += alloc[k]; });
  return Math.round(t * 100) / 100;
}

test('scenario Michele: 200 incassati, 20 a Saso, 180 a Cream', function() {
  App.setState(statoBase(
    [{ ID_Preventivo: 'pv1', Nome_Venditore: 'Saso', Percentuale: 10, Importo_Corrisposto: 20 }],
    [progettoBundle(100, 100)]
  ));
  var movs = App.buildMovimenti();
  assert.strictEqual(movs.length, 2, 'devono esserci acconto e saldo');

  var tot = {};
  movs.forEach(function(m) {
    // Ogni movimento allocato per intero, mai piu' ne' meno del suo importo
    assert.strictEqual(somma(m.allocazioni), m.importo,
      'movimento ' + m.tipo + ': allocazioni ' + somma(m.allocazioni) + ' != importo ' + m.importo);
    Object.keys(m.allocazioni).forEach(function(k) {
      assert.ok(m.allocazioni[k] >= 0, 'quota negativa per ' + k + ' nel movimento ' + m.tipo);
      tot[k] = (tot[k] || 0) + m.allocazioni[k];
    });
  });

  assert.strictEqual(Math.round(tot.Saso * 100) / 100, 20, 'Saso deve ricevere 20');
  assert.strictEqual(Math.round(tot.Cream * 100) / 100, 180, 'Cream deve ricevere 180');
  assert.strictEqual(somma(tot), 200, 'il totale studio deve restare 200');
});

test('la provvigione intacca per prima l acconto', function() {
  App.setState(statoBase(
    [{ ID_Preventivo: 'pv1', Nome_Venditore: 'Saso', Percentuale: 10, Importo_Corrisposto: 20 }],
    [progettoBundle(100, 100)]
  ));
  var movs = App.buildMovimenti();
  var acc = movs.filter(function(m){ return m.tipo === 'ACCONTO'; })[0];
  var sal = movs.filter(function(m){ return m.tipo === 'SALDO'; })[0];
  assert.strictEqual(acc.allocazioni.Saso, 20, 'tutta la provvigione esce dall acconto');
  assert.strictEqual(acc.allocazioni.Cream, 80);
  assert.strictEqual(sal.allocazioni.Saso || 0, 0, 'il saldo non deve essere intaccato');
  assert.strictEqual(sal.allocazioni.Cream, 100);
});

test('provvigione che sconfina sul saldo', function() {
  App.setState(statoBase(
    [{ ID_Preventivo: 'pv1', Nome_Venditore: 'Saso', Percentuale: 60, Importo_Corrisposto: 120 }],
    [progettoBundle(100, 100)]
  ));
  var movs = App.buildMovimenti();
  var acc = movs.filter(function(m){ return m.tipo === 'ACCONTO'; })[0];
  var sal = movs.filter(function(m){ return m.tipo === 'SALDO'; })[0];
  assert.strictEqual(acc.allocazioni.Saso, 100);
  assert.strictEqual(acc.allocazioni.Cream, 0);
  assert.strictEqual(sal.allocazioni.Saso, 20);
  assert.strictEqual(sal.allocazioni.Cream, 80);
  assert.strictEqual(somma(acc.allocazioni) + somma(sal.allocazioni), 200);
});

test('senza provvigione il comportamento storico e identico', function() {
  App.setState(statoBase([], [progettoBundle(100, 100)]));
  var movs = App.buildMovimenti();
  var tot = {};
  movs.forEach(function(m) {
    assert.strictEqual(somma(m.allocazioni), m.importo);
    Object.keys(m.allocazioni).forEach(function(k){ tot[k] = (tot[k]||0) + m.allocazioni[k]; });
  });
  assert.strictEqual(tot.Cream, 200, 'tutto all operatore della voce, come prima');
  assert.strictEqual(tot.Saso || 0, 0);
});

test('progetto senza preventivo di origine non riceve provvigioni', function() {
  var prj = progettoBundle(100, 100);
  delete prj.ID_Preventivo_Origine;
  App.setState(statoBase(
    [{ ID_Preventivo: 'pv1', Nome_Venditore: 'Saso', Percentuale: 10, Importo_Corrisposto: 20 }],
    [prj]
  ));
  var movs = App.buildMovimenti();
  var tot = {};
  movs.forEach(function(m){ Object.keys(m.allocazioni).forEach(function(k){ tot[k]=(tot[k]||0)+m.allocazioni[k]; }); });
  assert.strictEqual(tot.Saso || 0, 0);
  assert.strictEqual(tot.Cream, 200);
});

test('fallback su Assegnato_A e su TheLab resta intatto con la provvigione', function() {
  var prj = progettoBundle(100, 100);
  prj.Voci_Bundle = [];
  prj.Assegnato_A = 'Mussi, Pana';
  App.setState(statoBase(
    [{ ID_Preventivo: 'pv1', Nome_Venditore: 'Saso', Percentuale: 10, Importo_Corrisposto: 20 }],
    [prj]
  ));
  var movs = App.buildMovimenti();
  var tot = {};
  movs.forEach(function(m) {
    assert.strictEqual(somma(m.allocazioni), m.importo);
    Object.keys(m.allocazioni).forEach(function(k){ tot[k]=(tot[k]||0)+m.allocazioni[k]; });
  });
  assert.strictEqual(Math.round(tot.Saso*100)/100, 20);
  assert.strictEqual(Math.round(tot.Mussi*100)/100, 90, '180 diviso fra i due assegnatari');
  assert.strictEqual(Math.round(tot.Pana*100)/100, 90);
  assert.strictEqual(somma(tot), 200);
});

test('nessun operatore: il netto va allo studio, la provvigione al venditore', function() {
  var prj = progettoBundle(100, 100);
  prj.Voci_Bundle = [];
  App.setState(statoBase(
    [{ ID_Preventivo: 'pv1', Nome_Venditore: 'Saso', Percentuale: 10, Importo_Corrisposto: 20 }],
    [prj]
  ));
  var movs = App.buildMovimenti();
  var tot = {};
  movs.forEach(function(m){ Object.keys(m.allocazioni).forEach(function(k){ tot[k]=(tot[k]||0)+m.allocazioni[k]; }); });
  assert.strictEqual(Math.round(tot.Saso*100)/100, 20);
  assert.strictEqual(Math.round(tot.TheLab*100)/100, 180);
  assert.strictEqual(somma(tot), 200);
});

test('corrisposto superiore all incassato: si alloca solo cio che esiste', function() {
  App.setState(statoBase(
    [{ ID_Preventivo: 'pv1', Nome_Venditore: 'Saso', Percentuale: 10, Importo_Corrisposto: 50 }],
    [progettoBundle(30, 0)]
  ));
  var movs = App.buildMovimenti();
  var tot = {};
  movs.forEach(function(m) {
    assert.strictEqual(somma(m.allocazioni), m.importo);
    Object.keys(m.allocazioni).forEach(function(k) {
      assert.ok(m.allocazioni[k] >= 0, 'quota negativa per ' + k);
      tot[k] = (tot[k]||0) + m.allocazioni[k];
    });
  });
  assert.strictEqual(tot.Saso, 30, 'allocabile solo quanto incassato');
  assert.strictEqual(tot.Cream, 0);
  assert.strictEqual(somma(tot), 30);
});

test('nessun movimento porta mai una quota negativa, su una batteria di casi', function() {
  var combinazioni = [];
  [0, 15, 100, 200].forEach(function(a) {
    [0, 50, 100, 200].forEach(function(s) {
      [0, 5, 20, 120, 300].forEach(function(c) {
        combinazioni.push([a, s, c]);
      });
    });
  });
  combinazioni.forEach(function(k) {
    var a = k[0], s = k[1], c = k[2];
    App.setState(statoBase(
      c > 0 ? [{ ID_Preventivo: 'pv1', Nome_Venditore: 'Saso', Percentuale: 10, Importo_Corrisposto: c }] : [],
      [progettoBundle(a, s)]
    ));
    var movs = App.buildMovimenti();
    var totAlloc = 0;
    movs.forEach(function(m) {
      assert.strictEqual(somma(m.allocazioni), m.importo,
        'caso a=' + a + ' s=' + s + ' c=' + c + ': movimento ' + m.tipo + ' sbilanciato');
      Object.keys(m.allocazioni).forEach(function(x) {
        assert.ok(m.allocazioni[x] >= 0,
          'caso a=' + a + ' s=' + s + ' c=' + c + ': quota negativa per ' + x);
      });
      totAlloc += somma(m.allocazioni);
    });
    assert.strictEqual(Math.round(totAlloc * 100) / 100, a + s,
      'caso a=' + a + ' s=' + s + ' c=' + c + ': totale allocato != incassato');
  });
});

test('beneficiariRicavi include i venditori esterni a TEAM_MEMBERS', function() {
  App.setState(statoBase([], [progettoBundle(100, 100)]));
  var b = App.beneficiariRicavi();
  App.TEAM_MEMBERS.forEach(function(m) {
    assert.ok(b.indexOf(m) !== -1, 'manca l operatore fisso ' + m);
  });
  assert.ok(b.indexOf('Saso') !== -1, 'il venditore Saso deve comparire fra i beneficiari');
});

test('beneficiariRicavi non duplica chi e sia operatore sia venditore', function() {
  var st = statoBase([], [progettoBundle(100, 100)]);
  st.collaboratori = [{ ID_Collaboratore: 'k2', Nome: 'Mussi', Ruolo: 'Venditore', Valore: 10, Data_Inizio: '2000-01-01', Data_Fine: '2099-12-31' }];
  App.setState(st);
  var b = App.beneficiariRicavi();
  var n = b.filter(function(x){ return x === 'Mussi'; }).length;
  assert.strictEqual(n, 1, 'Mussi non deve comparire due volte');
});

test('beneficiariRicavi esclude i venditori con Data_Fine passata', function() {
  var st = statoBase([], [progettoBundle(100, 100)]);
  st.collaboratori = [{ ID_Collaboratore: 'k3', Nome: 'Uscito', Ruolo: 'Venditore', Valore: 10, Data_Inizio: '2000-01-01', Data_Fine: '2020-01-01' }];
  App.setState(st);
  assert.ok(App.beneficiariRicavi().indexOf('Uscito') === -1, 'un venditore chiuso non deve comparire nei selettori');
});

// ── Compensi espliciti, end-to-end ───────────────────────────

function progettoConCompensi(acc, sal) {
  return {
    ID_Progetto: 'p2', ProjectCode: 'PRJ-0002', NomeCliente: 'Michele',
    Servizio: 'Pacchetto REC', ID_Preventivo_Origine: 'pv1',
    Voci_Bundle: [
      { nome: 'Registrazione', prezzo: 100, operatore: 'Mussi',
        compensi: [{ nome: 'Luca', importo: 40 }, { nome: 'Mussi', importo: 60 }] },
      { nome: 'Mix', prezzo: 100, operatore: 'Cream' }
    ],
    Acconto: acc, Data_Acconto: '2026-01-15',
    Saldo: sal, Data_Saldo: '2026-03-15',
    Prezzo_Listino: 200, Stato: 'CHIUSO'
  };
}

function statoConTecnico(provvigioni, progetti) {
  var st = statoBase(provvigioni, progetti);
  st.collaboratori = st.collaboratori.concat([
    { ID_Collaboratore: 'k9', Nome: 'Luca', Ruolo: 'Tecnico_Occasionale', Valore: 40, Data_Inizio: '2000-01-01', Data_Fine: '2099-12-31' }
  ]);
  return st;
}

test('compensi end-to-end: provvigione e compensi convivono senza sbilanciare', function() {
  App.setState(statoConTecnico(
    [{ ID_Preventivo: 'pv1', Nome_Venditore: 'Saso', Percentuale: 10, Importo_Corrisposto: 20 }],
    [progettoConCompensi(100, 100)]
  ));
  var movs = App.buildMovimenti();
  var tot = {};
  movs.forEach(function(m) {
    assert.strictEqual(somma(m.allocazioni), m.importo,
      'movimento ' + m.tipo + ' sbilanciato');
    Object.keys(m.allocazioni).forEach(function(k) {
      assert.ok(m.allocazioni[k] >= 0, 'quota negativa per ' + k);
      tot[k] = (tot[k] || 0) + m.allocazioni[k];
    });
  });
  assert.strictEqual(Math.round(tot.Saso*100)/100, 20, 'provvigione al venditore');
  assert.strictEqual(Math.round(tot.Luca*100)/100, 36, 'tecnico occasionale');
  assert.strictEqual(Math.round(tot.Mussi*100)/100, 54);
  assert.strictEqual(Math.round(tot.Cream*100)/100, 90);
  assert.strictEqual(somma(tot), 200, 'il totale studio resta 200');
});

test('compensi end-to-end: il residuo di voce va allo Studio', function() {
  var prj = progettoConCompensi(200, 0);
  prj.Voci_Bundle[0].compensi = [{ nome: 'Luca', importo: 30 }];
  App.setState(statoConTecnico([], [prj]));
  var tot = {};
  App.buildMovimenti().forEach(function(m) {
    assert.strictEqual(somma(m.allocazioni), m.importo);
    Object.keys(m.allocazioni).forEach(function(k){ tot[k]=(tot[k]||0)+m.allocazioni[k]; });
  });
  assert.strictEqual(Math.round(tot.Luca*100)/100, 30);
  assert.strictEqual(Math.round(tot.TheLab*100)/100, 70, 'il resto della voce A');
  assert.strictEqual(Math.round(tot.Cream*100)/100, 100);
  assert.strictEqual(somma(tot), 200);
});

test('compensi end-to-end: incasso parziale mantiene le proporzioni decise', function() {
  App.setState(statoConTecnico([], [progettoConCompensi(100, 0)]));
  var tot = {};
  App.buildMovimenti().forEach(function(m) {
    Object.keys(m.allocazioni).forEach(function(k){ tot[k]=(tot[k]||0)+m.allocazioni[k]; });
  });
  assert.strictEqual(Math.round(tot.Luca*100)/100, 20, 'meta incassato, meta compenso');
  assert.strictEqual(Math.round(tot.Mussi*100)/100, 30);
  assert.strictEqual(Math.round(tot.Cream*100)/100, 50);
  assert.strictEqual(somma(tot), 100);
});

test('un tecnico occasionale compare fra i beneficiari disegnati', function() {
  App.setState(statoConTecnico([], [progettoConCompensi(100, 100)]));
  var b = App.beneficiariRicavi();
  assert.ok(b.indexOf('Luca') !== -1, 'il tecnico occasionale deve essere disegnato');
  assert.ok(b.indexOf('Saso') !== -1, 'il venditore pure');
});
