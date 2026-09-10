// Carica il blocco di funzioni pure marcato dentro index.html e lo valuta.
// Serve a testare la logica senza spezzare il vincolo "index.html e' un file unico".
var fs = require('fs');
var path = require('path');

var START = '// <<<TESTABLE:PROVVIGIONI';
var END   = '// TESTABLE:PROVVIGIONI>>>';

function loadTestable() {
  var file = path.join(__dirname, '..', 'index.html');
  var html = fs.readFileSync(file, 'utf8');
  var i = html.indexOf(START);
  var j = html.indexOf(END);
  if (i < 0 || j < 0) throw new Error('Marcatori TESTABLE:PROVVIGIONI non trovati in index.html');
  if (j < i) throw new Error('Marcatore di chiusura prima di quello di apertura');
  var src = html.slice(i + START.length, j);
  var exported = [
    'provvigioneDovuta',
    'ritagliaProvvigione',
    'trovaProvvigioneProgetto',
    'buildTrattativeChiuse',
    'allocaVoci',
    'attivoIl',
    'personeConRuolo',
    'nomiConRuolo',
    'voceSingolo',
    'nomiDaCompensi'
  ];
  var out = {};
  var fn = new Function('__out', src + '\n;' + exported.map(function(n){
    return '__out.' + n + ' = typeof ' + n + ' === "function" ? ' + n + ' : undefined;';
  }).join('\n'));
  fn(out);
  return out;
}

module.exports = { loadTestable: loadTestable };
