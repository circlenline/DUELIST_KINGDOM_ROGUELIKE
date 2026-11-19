/* ══════════════════════════════════════════════════════════════════
   CALIBRAR LAS NOTAS CON PARTIDAS — qué cartas de RP02 ganan duelos

   Las notas `base` de src/draft/cartas.js son hipótesis (el brief de E lo
   dice así). Aquí se juegan miles de duelos entre mazos de 20 al azar de
   las 101 (unos 12 monstruos y 8 magias/trampas, sin copias limitadas) con
   los bots en experto, y se apunta qué llevaba cada uno y quién ganó. Con
   eso `ajustar-notas.py` estima cuánto suma cada carta a ganar
   (regresión logística sobre la diferencia de copias) y propone notas.

   Uso: node calibrar-draft.mjs <desde> <cuantas> >> calibracion.jsonl
   ══════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";
import * as X from "./out/ocgcore.bundle.js";
import { scriptReader } from "./out/scripts.bundle.js";
import { GoatDuel } from "./src/duel.mjs";
import { makeAutoPlayer } from "./src/autopilot.mjs";
import { makeTrivialResolver } from "./src/trivial.js";
import { crearCerebro } from "./src/ai/brain.js";
import { dueloDeBots } from "./src/draft/duelos.js";
import { azarDe } from "./src/draft/azar.js";
const desde = Number(process.argv[2] ?? 0), cuantas = Number(process.argv[3] ?? 1000);
const rp02 = JSON.parse(readFileSync("../data/draft/rp02.json", "utf-8"));
const raw = JSON.parse(readFileSync("./out/cards.subset.json", "utf-8"));
const names = JSON.parse(readFileSync("./out/names.subset.json", "utf-8"));
const db = new Map(); for(const k in raw){ const c = raw[k]; db.set(c.code, { ...c, race: BigInt(c.race) }); }
const lib = await X.default({ sync:true });
const deps = { lib, X, GoatDuel, crearCerebro, trivial: makeTrivialResolver(X), generico: makeAutoPlayer(X), db, names, scriptReader };
const mon = rp02.cartas.filter(c => c.tipo & 1).map(c => c.id), mt = rp02.cartas.filter(c => !(c.tipo & 1)).map(c => c.id);
for(let i = desde; i < desde + cuantas; i++){
  const r = azarDe(`calibrar|${i}`);
  const mazo = () => { const nm = 10 + Math.floor(r() * 5);
    return [...Array.from({ length:nm }, () => mon[Math.floor(r() * mon.length)]),
            ...Array.from({ length:20 - nm }, () => mt[Math.floor(r() * mt.length)])]; };
  const a = mazo(), b = mazo();
  const res = await dueloDeBots(deps, { main:a }, { main:b }, { semilla: 90000 + i, empieza: i % 2, maxTurnos: 60 });
  process.stdout.write(JSON.stringify({ i, a, b, gana: res.gana, empieza: i % 2, corte: res.corte, turnos: res.turnos }) + "\n");
}
