/* ══════════════════════════════════════════════════════════════════
   LAS 101 CARTAS DE RP02 EN EL MOTOR

   1. Cada carta tiene datos y script (o es un monstruo normal sin efecto).
   2. Guardian Sphinx: su efecto es de Invocación por Volteo. Volteada por
      un ataque o por Book of Taiyou NO devuelve nada (brief de E, §8 y
      prueba 8). Se pregunta AL MOTOR, no a la IA.
   3. Duelos de bots con mazos al azar de las 101 (también las malas y
      las injugables): ningún error de Lua, ningún duelo atascado; y se
      separa el deck-out (lo declara el motor) del corte técnico.

   Uso: node check-draft-cartas.mjs [partidas]     (desde engine/browser/)
   ══════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";
import { montar, X, P, T, nombre } from "./escenario.mjs";
import { scriptReader } from "./out/scripts.bundle.js";
import { GoatDuel } from "./src/duel.mjs";
import { makeAutoPlayer } from "./src/autopilot.mjs";
import { makeTrivialResolver } from "./src/trivial.js";
import { crearCerebro } from "./src/ai/brain.js";
import { dueloDeBots } from "./src/draft/duelos.js";
import { azarDe } from "./src/draft/azar.js";

const R = X.OcgResponseType, IA = X.SelectIdleCMDAction, BA = X.SelectBattleCMDAction;
const rp02 = JSON.parse(readFileSync("../data/draft/rp02.json", "utf-8"));
const raw = JSON.parse(readFileSync("./out/cards.subset.json", "utf-8"));
const names = JSON.parse(readFileSync("./out/names.subset.json", "utf-8"));
const pruebas = [];
const ok = (t, v, d = "") => { pruebas.push([t, !!v]); console.log(v ? "  ✓" : "  ✗", t, d ? `— ${d}` : ""); };

console.log("═══ 1 · DATOS Y SCRIPT DE LAS 101 ═══");
{
  const sinDatos = rp02.cartas.filter(c => !raw[c.id] || !names[c.id]);
  const sinScript = rp02.cartas.filter(c => !scriptReader(`c${c.id}.lua`) && !((c.tipo & 16) && !(c.tipo & 32)) );
  ok("las 101 tienen datos en el motor", !sinDatos.length, sinDatos.map(c => c.nombre).join(", "));
  ok("todas las que tienen efecto llevan su script", !sinScript.length, sinScript.map(c => c.nombre).join(", "));
  ok("las fichas de Gorz e Insect Queen tienen datos", !!raw[44330099] && !!raw[91512836]);
}

console.log("\n═══ 2 · GUARDIAN SPHINX: SOLO LA INVOCACIÓN POR VOLTEO DEVUELVE ═══");
const pasar = m => {
  if(m.type === T.SELECT_IDLECMD) return { type:R.SELECT_IDLECMD, action: m.to_ep ? IA.TO_EP : IA.TO_BP, index:null };
  if(m.type === T.SELECT_BATTLECMD) return { type:R.SELECT_BATTLECMD, action: m.to_ep ? BA.TO_EP : BA.TO_M2, index:null };
  if(m.type === T.SELECT_CHAIN) return { type:R.SELECT_CHAIN, index:null };
  return null;
};
{ /* a) Flip Summon */
  const e = await montar({ monstruos:[{ carta:"Guardian Sphinx", pos:P.FACEDOWN_DEFENSE }] },
                         { monstruos:[{ carta:"Gemini Elf", pos:P.FACEUP_ATTACK }] });
  let hecho = false;
  await e.correr(m => {
    if(m.type === T.SELECT_IDLECMD && m.player === 0){
      if(hecho) return "PARAR";
      const i = (m.pos_changes ?? m.repositions ?? []).findIndex(c => nombre(c.code) === "Guardian Sphinx");
      if(i >= 0){ hecho = true; return { type:R.SELECT_IDLECMD, action:IA.SELECT_POS_CHANGE, index:i }; }
    }
    if(m.type === T.SELECT_EFFECTYN || m.type === T.SELECT_YESNO) return { type:m.type === T.SELECT_YESNO ? R.SELECT_YESNO : R.SELECT_EFFECTYN, yes:true };
    return null;
  }, 300);
  ok("Invocación por Volteo: el campo rival vuelve a la mano", hecho && !e.campo(1).length && e.mano(1).some(c => c.nombre === "Gemini Elf"),
     `campo rival: ${e.campo(1).map(c => c.nombre).join(", ") || "vacío"}`);
}
{ /* b) volteada por un ataque */
  const e = await montar({ monstruos:[{ carta:"Guardian Sphinx", pos:P.FACEDOWN_DEFENSE }] },
                         { monstruos:[{ carta:"Gemini Elf", pos:P.FACEUP_ATTACK }] });
  let atacado = false, turnoRival = false;
  await e.correr(m => {
    if(m.player === 1) turnoRival = true;
    if(m.type === T.SELECT_BATTLECMD && m.player === 1){
      if(!atacado && (m.attacks ?? []).length){ atacado = true; return { type:R.SELECT_BATTLECMD, action:BA.SELECT_BATTLE, index:0 }; }
      return "PARAR";
    }
    if(m.type === T.SELECT_CARD && m.player === 1) return null;
    if(m.type === T.SELECT_IDLECMD && m.player === 1) return atacado ? "PARAR" : { type:R.SELECT_IDLECMD, action:IA.TO_BP, index:null };
    return pasar(m);
  }, 600);
  const sph = e.campo(0).find(c => c.nombre === "Guardian Sphinx");
  ok("volteada por un ataque: no devuelve nada", atacado && e.campo(1).some(c => c.nombre === "Gemini Elf") && sph && (sph.pos & P.FACEUP_DEFENSE),
     `atacada ${atacado}, campo rival: ${e.campo(1).map(c => c.nombre).join(", ") || "vacío"}`);
}
{ /* c) Book of Taiyou */
  const e = await montar({ monstruos:[{ carta:"Guardian Sphinx", pos:P.FACEDOWN_DEFENSE }], mano:["Book of Taiyou"] },
                         { monstruos:[{ carta:"Gemini Elf", pos:P.FACEUP_ATTACK }] });
  let usado = false;
  await e.correr(m => {
    if(m.type === T.SELECT_IDLECMD && m.player === 0){
      if(usado) return "PARAR";
      const i = (m.activates ?? []).findIndex(c => nombre(c.code) === "Book of Taiyou");
      if(i >= 0){ usado = true; return { type:R.SELECT_IDLECMD, action:IA.SELECT_ACTIVATE, index:i }; }
    }
    return m.type === T.SELECT_CHAIN ? { type:R.SELECT_CHAIN, index:null } : null;
  }, 300);
  const sph = e.campo(0).find(c => c.nombre === "Guardian Sphinx");
  ok("volteada por Book of Taiyou: boca arriba en ataque y no devuelve nada", usado && sph && (sph.pos & P.FACEUP_ATTACK) && e.campo(1).some(c => c.nombre === "Gemini Elf"),
     `campo rival: ${e.campo(1).map(c => c.nombre).join(", ") || "vacío"}`);
}

console.log("\n═══ 3 · DUELOS CON LAS 101, A MAZOS AL AZAR ═══");
{
  const N = Number(process.argv[2] ?? 60);
  const db = new Map(); for(const k in raw){ const c = raw[k]; db.set(c.code, { ...c, race: BigInt(c.race) }); }
  const lib = await X.default({ sync:true });
  const deps = { lib, X, GoatDuel, crearCerebro, trivial: makeTrivialResolver(X), generico: makeAutoPlayer(X), db, names, scriptReader };
  const ids = rp02.cartas.map(c => c.id);
  const usadas = new Set(), conError = new Map();
  let cortes = 0, deckouts = 0, lp = 0, atascos = 0, errores = 0;
  for(let i = 0; i < N; i++){
    const r = azarDe(`cartas|${i}`);
    /* cada carta sale al menos una vez: los primeros mazos recorren la lista */
    const mazo = k => Array.from({ length:20 }, (_, j) => i < 10 ? ids[(i * 40 + k * 20 + j) % ids.length] : ids[Math.floor(r() * ids.length)]);
    const a = mazo(0), b = mazo(1);
    a.concat(b).forEach(x => usadas.add(x));
    const res = await dueloDeBots(deps, { main:a }, { main:b }, { semilla: 7000 + i, empieza: i % 2, maxTurnos: 60 });
    if(res.corte) cortes++; else if(res.motivo === 2) deckouts++; else lp++;
    if(!res.corte && res.gana === null) atascos++;
    if(res.errores.length){ errores += res.errores.length;
      for(const t of res.errores.slice(0, 3)) conError.set(t.slice(0, 90), (conError.get(t.slice(0, 90)) ?? 0) + 1); }
  }
  ok(`las 101 cartas han salido en algún duelo`, usadas.size === 101, `${usadas.size}`);
  ok(`${N} duelos sin errores de Lua`, errores === 0, [...conError].slice(0, 4).map(([t, n]) => `${n}× ${t}`).join(" | "));
  ok("ninguno se queda sin respuesta", atascos === 0);
  console.log(`     fin por LP: ${lp} · deck-out (lo declara el motor): ${deckouts} · corte técnico (60 turnos, por LP): ${cortes}`);
}

const fallos = pruebas.filter(p => !p[1]);
console.log(`\n${fallos.length ? "✗" : "✓"} check-draft-cartas: ${pruebas.length - fallos.length}/${pruebas.length}`);
process.exit(fallos.length ? 1 : 0);
