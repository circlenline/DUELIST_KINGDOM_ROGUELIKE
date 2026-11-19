/* ¿Construye mejor el constructor que «las 20 de más nota»? Mismos pools
   (un draft de 18 bots con la IA), dos formas de construir, partidas reales.
   Uso: node medir-constructor.mjs <semilla> <partidas> */
import { readFileSync } from "node:fs";
import * as X from "./out/ocgcore.bundle.js";
import { scriptReader } from "./out/scripts.bundle.js";
import { GoatDuel } from "./src/duel.mjs";
import { makeAutoPlayer } from "./src/autopilot.mjs";
import { makeTrivialResolver } from "./src/trivial.js";
import { crearCerebro } from "./src/ai/brain.js";
import { prepararDraft, construirMazo, avanzar } from "./src/draft/draft.js";
import { nuevaMesa, poolDe } from "./src/draft/mesa.js";
import { dueloDeBots } from "./src/draft/duelos.js";
const semilla = process.argv[2] ?? "c", N = Number(process.argv[3] ?? 100);
const rp02 = JSON.parse(readFileSync("../data/draft/rp02.json", "utf-8"));
const D = prepararDraft(rp02);
const raw = JSON.parse(readFileSync("./out/cards.subset.json", "utf-8"));
const names = JSON.parse(readFileSync("./out/names.subset.json", "utf-8"));
const db = new Map(); for(const k in raw){ const c = raw[k]; db.set(c.code, { ...c, race: BigInt(c.race) }); }
const st = nuevaMesa(rp02, { semilla, humano:null }); while(!st.terminado) avanzar(st, D, null);
const bueno = [], ingenuo = [];
for(let a = 0; a < 18; a++){
  const ids = poolDe(st, a);
  const m = construirMazo(ids, D); bueno.push({ main:m.main, plan: process.env.SINPLAN ? null : m.planDuelo });
  const top = [...ids].sort((x, y) => D.cat.get(y).base - D.cat.get(x).base).slice(0, 20);
  ingenuo.push({ main: top, plan: null });
}
const lib = await X.default({ sync:true });
const deps = { lib, X, GoatDuel, crearCerebro, trivial: makeTrivialResolver(X), generico: makeAutoPlayer(X), db, names, scriptReader };
let g = 0, p = 0;
for(let i = 0; i < N; i++){
  const a = i % 18, b = (a + 1 + Math.floor(i / 18)) % 18;      // el mismo pool nunca contra sí mismo
  const r = await dueloDeBots(deps, bueno[a], ingenuo[b], { semilla: 500 + i * 13, empieza: i % 2 });
  if(r.gana === "a") g++; else if(r.gana === "b") p++;
}
console.log(`constructor vs top-20 por nota: ${g}-${p} → ${Math.round(100 * g / (g + p))} %`);
