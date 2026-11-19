/* ══════════════════════════════════════════════════════════════════
   ¿DRAFTEA MEJOR LA IA QUE UNA TIER LIST? — con el motor, no con su nota

   Medirse con su propia función de evaluación sería hacerse trampas. Así
   que aquí se hace un draft de 18 asientos con tres políticas mezcladas
   en la mesa (6 de cada):

     ia        la de verdad (picks.js)
     estatica  coge siempre la de más nota «de papel» (`base`): una tier list
     azar      cualquiera

   todos construyen con el MISMO constructor (lo que se mide es el draft),
   y después se juegan partidas reales entre mazos de políticas distintas
   con los bots en experto y cada uno con el plan de su mazo.

   Uso: node medir-draft.mjs <semilla> <partidas por cruce>
   ══════════════════════════════════════════════════════════════════ */
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

const semilla = process.argv[2] ?? "medir";
const N = Number(process.argv[3] ?? 20);
const rp02 = JSON.parse(readFileSync("../data/draft/rp02.json", "utf-8"));
const D = prepararDraft(rp02);
const raw = JSON.parse(readFileSync("./out/cards.subset.json", "utf-8"));
const names = JSON.parse(readFileSync("./out/names.subset.json", "utf-8"));
const db = new Map(); for(const k in raw){ const c = raw[k]; db.set(c.code, { ...c, race: BigInt(c.race) }); }

const POL = a => ["ia", "estatica", "azar"][a % 3];
const st = nuevaMesa(rp02, { semilla, humano: null });
const t0 = Date.now();
while(!st.terminado){
  const ia = new Set([...Array(18).keys()].filter(a => POL(a) !== "ia"));
  const { elecciones, registros } = picksDeBots(st, D, { saltar: ia });
  for(const a of ia){
    const sobre = vistaDe(st, a).sobre;
    if(POL(a) === "azar") elecciones[a] = Math.floor(azarDe(`${semilla}|azar|${a}|${st.ronda}|${st.paso}`)() * sobre.length);
    else { let m = 0; sobre.forEach((id, i) => { if(D.cat.get(id).base > D.cat.get(sobre[m]).base) m = i; }); elecciones[a] = m; }
  }
  aplicarPaso(st, rp02, elecciones, registros);
}
console.log(`draft en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
const mazos = [];
for(let a = 0; a < 18; a++){
  const m = construirMazo(poolDe(st, a), D);
  const sinRutaPool = m.sinRuta.length;
  mazos.push({ a, pol: POL(a), m });
  const cs = m.main.map(id => D.cat.get(id)), mons = cs.filter(c => c.esMonstruo);
  const atk = mons.length ? Math.round(mons.reduce((s, c) => s + c.atk, 0) / mons.length) : 0;
  if(process.env.VERBOSO) console.log(`  ${String(a).padStart(2)} ${POL(a).padEnd(8)} ${m.plan.padEnd(8)} nota ${m.total.toFixed(0)} · ${mons.length} monstruos (ATK medio ${atk}, ${mons.filter(c => c.tributos > 0).length} de tributo) · ${cs.filter(c => c.esMagia).length} magias · ${cs.filter(c => c.esTrampa).length} trampas`);
  if(process.env.VERBOSO === "2") console.log("      " + cs.map(c => c.nombre).join(", "));
}

const lib = await X.default({ sync: true });
const deps = { lib, X, GoatDuel, crearCerebro, trivial: makeTrivialResolver(X), generico: makeAutoPlayer(X), db, names, scriptReader };
const res = {};
let cortes = 0, deckouts = 0, total = 0;
const tiempo = Date.now();
const PARES = process.env.PARES ? process.env.PARES.split(",").map(x => x.split("-")) : [["ia", "estatica"], ["ia", "azar"], ["estatica", "azar"]];
for(const [pa, pb] of PARES){
  const A = mazos.filter(x => x.pol === pa), B = mazos.filter(x => x.pol === pb);
  let ga = 0, gb = 0, e = 0;
  for(let i = 0; i < N; i++){
    const x = A[i % A.length], y = B[Math.floor(i / A.length) % B.length];
    const r = await dueloDeBots(deps, { main: x.m.main, plan: x.m.planDuelo }, { main: y.m.main, plan: y.m.planDuelo },
                                { semilla: 1000 + i * 7919, empieza: i % 2 });
    total++; if(r.corte) cortes++; if(r.motivo === 2) deckouts++;
    if(r.gana === "a") ga++; else if(r.gana === "b") gb++; else e++;
  }
  res[`${pa}-${pb}`] = { ga, gb, e };
  const pct = Math.round(100 * ga / Math.max(1, ga + gb));
  console.log(`${pa.padEnd(8)} vs ${pb.padEnd(8)} ${ga}-${gb} (${e} empates) → ${pct} %`);
}
console.log(`${total} partidas en ${((Date.now() - tiempo) / 1000).toFixed(0)} s · cortes técnicos (tope de turnos): ${cortes} · deck-outs: ${deckouts}`);
