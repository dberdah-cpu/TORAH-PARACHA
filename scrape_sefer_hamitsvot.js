#!/usr/bin/env node
// SCRAPER SEFER HAMITSVOT — loubavitch.fr → sefer_hamitsvot.json
// Node v18+. Lancer: node scrape_sefer_hamitsvot.js

const fs = require('fs');

// ID 251523 = Cours 78 = 21 avril 2026 → ID cours 1 = 251446
const BASE_ID  = 251446;
const TOTAL    = 339;

function getUrl(id) {
  return `https://www.loubavitch.fr/etude/etudes-quotidiennes/sefer-hamitsvot/${id}/sefer-hamitsvot?pop=0`;
}

function parse(html) {
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>|<\/li>|<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&rsquo;|&#39;/g, "'")
    .replace(/&laquo;/g, '«').replace(/&raquo;/g, '»')
    .replace(/&amp;/g, '&').replace(/&#[0-9]+;/g, '');

  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  let start = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/\d{2}\.\d{2}\.\d{4}/.test(lines[i])) { start = i + 1; break; }
  }
  let end = lines.length;
  for (let i = start; i < lines.length; i++) {
    if (/Retour en haut|Website design|01 45 26|Siege :|Siège :/.test(lines[i])) { end = i; break; }
  }
  const SKIP = ['Occurrence','Sefer Hamitsvot','Newsletter','Etudes quotidiennes',
    'La Sidra','La Paracha','Menu','Pratique','Etude','Biblioth','Multim','Actualit',
    'Contactez','Faire un don','Loubavitch.fr','Notons que bon nombre','Veuillez noter',
    'Livres du Rambam','Commandez'];
  const result = lines.slice(start, end).filter(l =>
    l.length >= 3 && !SKIP.some(s => l.toLowerCase().includes(s.toLowerCase())) && !l.startsWith('*')
  );
  return result.length ? result.join('\n') : null;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function get(url, retry = 3) {
  for (let i = 0; i < retry; i++) {
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'fr-FR,fr;q=0.9' }
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } catch (e) {
      if (i === retry - 1) throw e;
      process.stdout.write(` [retry]`);
      await sleep(2000);
    }
  }
}

async function main() {
  const out = {
    _source: 'loubavitch.fr', _credit: '© Beth Loubavitch',
    _generated: new Date().toISOString().split('T')[0],
    _base_id: BASE_ID, _ref_id: 251523, _ref_cours: 78, _total: TOTAL
  };

  let ok = 0, fail = [];
  console.log(`📚 Scraping ${TOTAL} cours du Sefer HaMitsvot...\n`);

  for (let cours = 1; cours <= TOTAL; cours++) {
    const id = BASE_ID + cours - 1;
    process.stdout.write(`  Cours ${String(cours).padStart(3)}/${TOTAL} (ID ${id})... `);
    try {
      const html = await get(getUrl(id));
      const txt = parse(html);
      if (txt) { out[String(cours)] = txt; ok++; console.log(`✓`); }
      else { out[String(cours)] = null; fail.push(cours); console.log(`⚠ vide`); }
    } catch(e) {
      out[String(cours)] = null; fail.push(cours); console.log(`✗ ${e.message}`);
    }
    await sleep(700);

    if (cours % 50 === 0) {
      fs.writeFileSync('sefer_hamitsvot.json', JSON.stringify(out, null, 2));
      console.log(`  💾 Sauvegarde intermédiaire (${cours}/${TOTAL})`);
    }
  }

  fs.writeFileSync('sefer_hamitsvot.json', JSON.stringify(out, null, 2));
  const size = Math.round(fs.statSync('sefer_hamitsvot.json').size / 1024);
  console.log(`\n✅ ${ok}/${TOTAL} cours — sefer_hamitsvot.json (${size} KB)`);
  if (fail.length) console.log(`⚠ Échecs cours: ${fail.join(', ')}`);
}

main().catch(e => { console.error('\n❌', e.message); process.exit(1); });
