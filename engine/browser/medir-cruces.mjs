/* ════════════════════════════════════════════════════════════════
   LA TABLA DE CRUCES 20×20 PARA EL TORNEO SUIZO

   En un torneo de 32, la ronda tiene 16 mesas y E juega una. Jugar las
   otras quince Bo3 entre bots en el navegador sería eterno, así que se
   resuelven con esta tabla: la probabilidad de que el mazo A gane UNA
   partida al mazo B, medida aquí con la IA en experto en los dos lados,
   alternando quién empieza. El torneo tira los dados con la semilla.

   Uso:  node medir-cruces.mjs [partidas por cruce=100] [trozo=0] [trozos=1]
         escribe ../data/cruces-<trozo>.json; `unir-cruces.mjs` los junta.
   ════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync } from "node:fs";
import * as X from "./out/ocgcore.bundle.js";
import { scriptReader } from "./out/scripts.bundle.js";
import { GoatDuel } from "./src/duel.mjs";
import { makeAutoPlayer } from "./src/autopilot.mjs";
import { makeTrivialResolver } from "./src/trivial.js";
import { crearCerebro } from "./src/ai/brain.js";

const N = Number(process.argv[2] ?? 100);
const TROZO = Number(process.argv[3] ?? 0), TROZOS = Number(process.argv[4] ?? 1);

const raw = JSON.parse(readFileSync("./out/cards.subset.json","utf-8"));
const names = JSON.parse(readFileSync("./out/names.subset.json","utf-8"));
const db = new Map(); for(const k in raw){ const c = raw[k]; db.set(c.code, { ...c, race:BigInt(c.race) }); }
const trivial = makeTrivialResolver(X), generico = makeAutoPlayer(X);
const MAZOS = JSON.parse(readFileSync("../data/mazos.json","utf-8")).filter(m => !m.aviso && m.main.length >= 40);

const rng = s => { let x = s>>>0 || 1; return () => { x^=x<<13; x^=x>>>17; x^=x<<5; return ((x>>>0)%100000)/100000; }; };
const barajar = (a,r) => { const b=[...a]; for(let i=b.length-1;i>0;i--){ const j=(r()*(i+1))|0; [b[i],b[j]]=[b[j],b[i]]; } return b; };

async function partida(A, B, semilla){
  const lib = await X.default({ sync:true });
  const duel = new GoatDuel({ lib, X, cardDb:db, scriptReader, onEvent:()=>{} });
  const r = rng(semilla);
  await duel.create({ deck0:barajar(A.main,r), deck1:barajar(B.main,r),
    extra0:A.extra ?? [], extra1:B.extra ?? [], seed:[BigInt(semilla),7n,13n,29n] });
  const c = { 0:crearCerebro({ X, duel, db, names, nivel:"experto", yo:0 }),
              1:crearCerebro({ X, duel, db, names, nivel:"experto", yo:1 }) };
  let ganador = null;
  const orig = duel.emit.bind(duel);
  duel.emit = (t,d) => { if(t==="win") ganador = d.player; orig(t,d); };
  for(let paso=0; paso<9000 && !duel.finished; paso++){
    const q = await duel.run();
    if(!q || duel.finished) break;
    let i=0, resp=null;
    while(i<8 && !resp){ resp = trivial(q) ?? c[q.player]?.(q,i) ?? generico(q,i); i++; }
    if(!resp) break;
    duel.respond(resp);
    if(duel.turnCount > 60) break;
  }
  return ganador;
}

const pares = [];
for(let i=0;i<MAZOS.length;i++) for(let j=i+1;j<MAZOS.length;j++) pares.push([i,j]);
const mios = pares.filter((_, k) => k % TROZOS === TROZO);
const salida = { n:N, mazos:MAZOS.map(m => m.nombre), cruces:{} };
/* Si el trozo ya estaba empezado con los mismos mazos y el mismo N, se
   sigue donde se quedó: una tanda cortada a medias no se repite entera. */
try{
  const previo = JSON.parse(readFileSync(`../data/cruces-${TROZO}.json`, "utf-8"));
  if(previo.n === N && JSON.stringify(previo.mazos) === JSON.stringify(salida.mazos)) Object.assign(salida.cruces, previo.cruces);
}catch(_){}
const t0 = Date.now();
for(const [i,j] of mios){
  if(salida.cruces[`${i}-${j}`]) continue;
  let gi = 0, tablas = 0;
  for(let k=0;k<N;k++){
    /* Se alterna el asiento: en el motor el jugador 0 no siempre empieza,
       pero así ningún mazo hereda una ventaja del lado. */
    const iEnCero = k % 2 === 0;
    const g = await partida(iEnCero ? MAZOS[i] : MAZOS[j], iEnCero ? MAZOS[j] : MAZOS[i], 7000 + i*977 + j*131 + k*7919);
    if(g == null) tablas++;
    else if((g === 0) === iEnCero) gi++;
  }
  salida.cruces[`${i}-${j}`] = { gana: gi, tablas, n: N };
  writeFileSync(`../data/cruces-${TROZO}.json`, JSON.stringify(salida));
  process.stderr.write(`${MAZOS[i].nombre} vs ${MAZOS[j].nombre}: ${gi}/${N} (${tablas} tablas) · ${((Date.now()-t0)/60000).toFixed(1)} min\n`);
}
