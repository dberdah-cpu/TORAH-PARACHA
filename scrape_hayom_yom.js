#!/usr/bin/env node
// SCRAPER HAYOM YOM — loubavitch.fr → hayom_yom.json
// Node v18+ (fetch natif). Lancer: node scrape_hayom_yom.js

const fs = require('fs');

const BASE_ID   = 252618;
const BASE_DATE = new Date('2026-04-20T00:00:00');

const MONTHS = [
  { name: 'Tichri',  days: 30, start: '2025-09-23' },
  { name: 'Hechvan', days: 29, start: '2025-10-23' },
  { name: 'Kislev',  days: 30, start: '2025-11-21' },
  { name: 'Tevet',   days: 29, start: '2025-12-21' },
  { name: 'Chevat',  days: 30, start: '2026-01-20' },
  { name: 'Adar',    days: 29, start: '2026-02-19' },
  { name: 'Nissan',  days: 30, start: '2026-03-20' },
  { name: 'Iyar',    days: 29, start: '2026-04-18' },
  { name: 'Sivan',   days: 30, start: '2026-05-18' },
  { name: 'Tamouz',  days: 29, start: '2026-06-16' },
  { name: 'Av',      days: 30, start: '2026-07-16' },
  { name: 'Eloul',   days: 29, start: '2026-08-14' },
];

function getUrl(id) {
  return `https://www.loubavitch.fr/etude/etudes-quotidiennes/hayom-yom/${id}/hayom-yom?pop=0`;
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
  const SKIP = ['Occurrence','Hayom yom','Newsletter','Etudes quotidiennes',
    'La Sidra','La Paracha','Menu','Pratique','Etude','Bibliotheque','Bibliotheque',
    'Multimedias','Actualites','Contactez','Faire un don','Loubavitch.fr'];
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
    _base_id: BASE_ID, _base_date: '2026-04-20'
  };

  let ok = 0, fail = [];

  for (const m of MONTHS) {
    out[m.name] = { _start_id: BASE_ID + Math.round((new Date(m.start+'T00:00:00') - BASE_DATE) / 86400000) };
    console.log(`\n📅 ${m.name} (${m.days} jours)`);
    const t0 = new Date(m.start + 'T00:00:00');

    for (let d = 1; d <= m.days; d++) {
      const date = new Date(t0); date.setDate(date.getDate() + d - 1);
      const id = BASE_ID + Math.round((date - BASE_DATE) / 86400000);
      process.stdout.write(`  ${m.name} ${d}... `);
      try {
        const html = await get(getUrl(id));
        const txt = parse(html);
        if (txt) { out[m.name][String(d)] = txt; ok++; console.log(`✓`); }
        else { out[m.name][String(d)] = null; fail.push(`${m.name} ${d}`); console.log(`⚠ vide`); }
      } catch(e) {
        out[m.name][String(d)] = null; fail.push(`${m.name} ${d}`); console.log(`✗ ${e.message}`);
      }
      await sleep(700);
    }
    fs.writeFileSync('hayom_yom.json', JSON.stringify(out, null, 2));
    console.log(`  💾 ${m.name} sauvegardé`);
  }

  const size = Math.round(fs.statSync('hayom_yom.json').size / 1024);
  console.log(`\n✅ ${ok}/354 jours — hayom_yom.json (${size} KB)`);
  if (fail.length) console.log(`⚠ Échecs: ${fail.join(', ')}`);
}

main().catch(e => { console.error('\n❌', e.message); process.exit(1); });
