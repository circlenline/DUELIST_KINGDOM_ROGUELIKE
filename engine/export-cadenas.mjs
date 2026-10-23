/* ══════════════════════════════════════════════════════════════════
   LOS TEXTOS DE LAS OPCIONES DE CADA CARTA (str1…str16 de la base)

   Reddit, 05-10: «Vampire Lord's options after dealing damage only say
   Option 1-3 rather than Monster, Spell, or Trap». Cuando una carta
   pregunta «¿qué opción?», el motor manda descripciones: (código << 20)
   | índice, que remiten a str1…str16 de esa carta en la base. Sin esos
   textos dentro del juego, la interfaz solo podía poner «Opción N».

   Saca, para cada carta del pool (y su alias), sus cadenas no vacías a
   `data/pool_strings.json`. Uso (desde engine/, Node 22+):
     node --experimental-sqlite export-cadenas.mjs
   ══════════════════════════════════════════════════════════════════ */
import { DatabaseSync } from "node:sqlite";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const RAIZ = "../BabelCDB-master/BabelCDB-master/";
const bases = ["goat-entries.cdb", "cards.cdb"].map(f => RAIZ + f).filter(existsSync);
const pool = JSON.parse(readFileSync("data/goat-pool.json", "utf-8")).map(Number);
const cards = JSON.parse(readFileSync("data/pool_cards.json", "utf-8"));
const quiero = new Set(pool);
for(const c of pool){ const a = cards[c]?.alias ?? cards[c]?.[1]; if(a) quiero.add(Number(a)); }
const salida = {};
const cols = Array.from({ length:16 }, (_, i) => "str" + (i + 1));
for(const b of bases){
  const db = new DatabaseSync(b, { readOnly:true });
  const q = db.prepare(`select id, ${cols.join(",")} from texts where id = ?`);
  for(const code of quiero){
    if(salida[code]) continue;
    const r = q.get(code); if(!r) continue;
    const s = {};
    cols.forEach((k, i) => { const t = (r[k] ?? "").trim(); if(t) s[i] = t; });
    if(Object.keys(s).length) salida[code] = s;
  }
}
writeFileSync("data/pool_strings.json", JSON.stringify(salida));
console.log(`pool_strings.json: ${Object.keys(salida).length} cartas con textos de opción · ${(JSON.stringify(salida).length/1024).toFixed(0)} KB`);
