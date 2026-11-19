/* Dos mesas con los MISMOS sobres (el generador de producto no depende de
   los picks): una entera de IA y otra entera de tier list (o al azar).
   Se enfrentan sus mazos. Sin «regalos» entre políticas vecinas.
   Uso: node medir-mesas.mjs <semilla> <partidas> [estatica|azar] */
import { readFileSync } from "node:fs";
import * as X from "./out/ocgcore.bundle.js";
import { scriptReader } from "./out/scripts.bundle.js";
import { GoatDuel } from "./src/duel.mjs";
import { makeAutoPlayer } from "./src/autopilot.mjs";
import { makeTrivialResolver } from "./src/trivial.js";
import { crearCerebro } from "./src/ai/brain.js";
import { prepararDraft, construirMazo, picksDeBots } from "./src/draft/draft.js";
import { nuevaMesa, aplicarPaso, vistaDe, poolDe } from "./src/draft/mesa.js";
import { dueloDeBots } from "./src/draft/duelos.js";
import { azarDe } from "./src/draft/azar.js";
const semilla = process.argv[2] ?? "s", N = Number(process.argv[3] ?? 200), rival = process.argv[4] ?? "estatica";
const rp02 = JSON.parse(readFileSync("../data/draft/rp02.json", "utf-8"));
const D = prepararDraft(rp02);
const raw = JSON.parse(readFileSync("./out/cards.subset.json", "utf-8"));
const names = JSON.parse(readFileSync("./out/names.subset.json", "utf-8"));
const db = new Map(); for(const k in raw){ const c = raw[k]; db.set(c.code, { ...c, race: BigInt(c.race) }); }
function mesa(pol){
  const st = nuevaMesa(rp02, { semilla, humano:null });
  while(!st.terminado){
    if(pol === "ia"){ const { elecciones, registros } = picksDeBots(st, D); aplicarPaso(st, rp02, elecciones, registros); continue; }
    const el = {};
    for(let a = 0; a < 18; a++){ const s = vistaDe(st, a).sobre;
      if(pol === "azar") el[a] = Math.floor(azarDe(`${semilla}|az|${a}|${st.ronda}|${st.paso}`)() * s.length);
      else { let m = 0; s.forEach((id, i) => { if(D.cat.get(id).base > D.cat.get(s[m]).base) m = i; }); el[a] = m; } }
    aplicarPaso(st, rp02, el, {});
  }
  return [...Array(18).keys()].map(a => { const m = construirMazo(poolDe(st, a), D); return { main:m.main, plan:m.planDuelo }; });
}
const A = mesa("ia"), B = mesa(rival);
const lib = await X.default({ sync:true });
const deps = { lib, X, GoatDuel, crearCerebro, trivial: makeTrivialResolver(X), generico: makeAutoPlayer(X), db, names, scriptReader };
let g = 0, p = 0;
for(let i = 0; i < N; i++){
  const r = await dueloDeBots(deps, A[i % 18], B[(i * 7 + 3) % 18], { semilla: 300 + i * 17, empieza: i % 2 });
  if(r.gana === "a") g++; else if(r.gana === "b") p++;
}
console.log(`mesa IA vs mesa ${rival}: ${g}-${p} → ${Math.round(100 * g / (g + p))} %`);
