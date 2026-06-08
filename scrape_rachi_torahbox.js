// ═══════════════════════════════════════════════════════════
// SCRIPT DE SCRAPING RACHI - Torah-Box
// À coller dans la console du navigateur sur torah-box.com
// ═══════════════════════════════════════════════════════════
//
// UTILISATION :
// 1. Va sur https://www.torah-box.com/torah-pdf/torah/nombres/13.html
// 2. Ouvre la console (F12 → Console)
// 3. Colle ce script et appuie sur Entrée
// 4. Le JSON se télécharge automatiquement
//
// Pour scraper plusieurs chapitres d'un coup :
//   scrapeChapters('nombres', [13, 14, 15], 'Shelach')
//   scrapeChapters('nombres', [16, 17, 18], 'Korach')
//   scrapeChapters('nombres', [19, 21, 22], 'Chukat')
//   etc.
// ═══════════════════════════════════════════════════════════

function parseCurrentPage() {
  var results = {};
  var currentVerse = null;
  var currentTitle = null;
  var currentText = '';

  // Récupérer tout le contenu de la page
  var main = document.querySelector('.article-content') ||
             document.querySelector('main') ||
             document.querySelector('.content') ||
             document.body;

  var walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, null, false);
  var nodes = [];
  var node;
  while(node = walker.nextNode()) {
    var text = node.textContent.trim();
    if(text) nodes.push({text: text, parent: node.parentElement});
  }

  function saveVerse() {
    if(currentVerse && currentTitle && currentText.trim()) {
      if(!results[currentVerse]) results[currentVerse] = [];
      results[currentVerse].push(currentTitle + ' : ' + currentText.trim());
    }
  }

  nodes.forEach(function(n) {
    var text = n.text;

    // Stopper au footer
    if(text.includes('Newsletter Torah-Box') || text.includes('Soyez le premier')) return;

    // Verset: "13,2"
    if(/^\d{1,3},\d{1,3}$/.test(text)) {
      saveVerse();
      var parts = text.split(',');
      currentVerse = parts[0] + ':' + parts[1];
      currentTitle = null;
      currentText = '';
      return;
    }

    // Titre Rachi (balise strong ou b)
    if(n.parent && (n.parent.tagName === 'STRONG' || n.parent.tagName === 'B') && currentVerse) {
      saveVerse();
      currentTitle = text;
      currentText = '';
      return;
    }

    // Texte du commentaire
    if(currentVerse && currentTitle && text.length > 5) {
      var skip = ['[', '!', 'http', '>', '<'].some(function(c){ return text.startsWith(c); });
      if(!skip && !['STRONG','B','H1','H2','H3','H4','NAV','HEADER','FOOTER'].includes(n.parent.tagName)) {
        currentText += (currentText ? ' ' : '') + text;
      }
    }
  });
  saveVerse();

  // Simplifier : joindre les commentaires par verset
  var simplified = {};
  Object.keys(results).forEach(function(v) {
    simplified[v] = results[v].join(' • ');
  });

  return simplified;
}

async function scrapeChapters(book, chapters, parashaName) {
  var allRachi = {};
  var baseUrl = 'https://www.torah-box.com/torah-pdf/torah/' + book + '/';

  for(var i = 0; i < chapters.length; i++) {
    var chap = chapters[i];
    console.log('[Scraping] Chapitre', chap, '...');

    // Charger la page dans un iframe invisible
    var iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = baseUrl + chap + '.html';
    document.body.appendChild(iframe);

    await new Promise(function(resolve) {
      iframe.onload = function() {
        try {
          var iDoc = iframe.contentDocument || iframe.contentWindow.document;
          var main = iDoc.querySelector('.article-content') ||
                     iDoc.querySelector('main') || iDoc.body;

          var results = {};
          var currentVerse = null;
          var currentTitle = null;
          var currentText = '';

          function saveV() {
            if(currentVerse && currentTitle && currentText.trim()) {
              if(!results[currentVerse]) results[currentVerse] = [];
              results[currentVerse].push(currentTitle + ' : ' + currentText.trim());
            }
          }

          var walker = iDoc.createTreeWalker(main, NodeFilter.SHOW_TEXT, null, false);
          var node;
          while(node = walker.nextNode()) {
            var t = node.textContent.trim();
            if(!t) continue;
            if(t.includes('Newsletter Torah-Box')) break;
            if(/^\d{1,3},\d{1,3}$/.test(t)) {
              saveV();
              var p = t.split(',');
              currentVerse = p[0]+':'+p[1];
              currentTitle = null; currentText = '';
            } else if(node.parentElement && (node.parentElement.tagName==='STRONG'||node.parentElement.tagName==='B') && currentVerse) {
              saveV(); currentTitle = t; currentText = '';
            } else if(currentVerse && currentTitle && t.length > 5) {
              var skip = ['[','!','http'].some(function(c){return t.startsWith(c);});
              var skipTags = ['STRONG','B','H1','H2','H3','H4','NAV','HEADER','FOOTER','A'];
              if(!skip && !skipTags.includes(node.parentElement.tagName)) {
                currentText += (currentText?' ':'') + t;
              }
            }
          }
          saveV();

          Object.keys(results).forEach(function(v) {
            allRachi[v] = results[v].join(' • ');
          });
          console.log('[Scraping] Chapitre', chap, '→', Object.keys(results).length, 'versets avec Rachi');
        } catch(e) {
          console.warn('[Scraping] Erreur chapitre', chap, e);
        }
        iframe.remove();
        setTimeout(resolve, 500); // délai entre requêtes
      };
      iframe.onerror = function() { iframe.remove(); resolve(); };
    });
  }

  var output = {};
  output[parashaName] = allRachi;

  // Télécharger le JSON
  var blob = new Blob([JSON.stringify(output, null, 2)], {type: 'application/json'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'rachi_' + parashaName.toLowerCase() + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();

  console.log('[Scraping] ✅ Terminé !', Object.keys(allRachi).length, 'versets total pour', parashaName);
  console.log('Fichier rachi_' + parashaName.toLowerCase() + '.json téléchargé');
  return output;
}

// Scraper la page courante uniquement
function scrapeCurrentPage(parashaName) {
  var r = parseCurrentPage();
  var output = {};
  output[parashaName || 'unknown'] = r;
  var blob = new Blob([JSON.stringify(output, null, 2)], {type: 'application/json'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'rachi_' + (parashaName || 'chapter').toLowerCase() + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  console.log('✅', Object.keys(r).length, 'versets Rachi extraits');
  return r;
}

// ═══════════════════════
// COMMANDES DISPONIBLES :
// ═══════════════════════
// scrapeCurrentPage('Shelach')      → scrape la page courante
// scrapeChapters('nombres', [13,14,15], 'Shelach')   → scrape plusieurs chapitres
// scrapeChapters('nombres', [16,17,18], 'Korach')
// scrapeChapters('nombres', [19,20,21,22], 'Chukat')  // 19=Houkat 22=Balak
// scrapeChapters('nombres', [22,23,24,25], 'Balak')
// scrapeChapters('nombres', [25,26,27,28,29,30], 'Pinchas')
// scrapeChapters('nombres', [30,31,32], 'Matot')
// scrapeChapters('nombres', [33,34,35,36], 'Masei')
// scrapeChapters('deuteronome', [1,2,3], 'Devarim')
// etc.
// ═══════════════════════

console.log('✅ Script Rachi chargé !');
console.log('Exemple: scrapeChapters("nombres", [13,14,15], "Shelach")');
