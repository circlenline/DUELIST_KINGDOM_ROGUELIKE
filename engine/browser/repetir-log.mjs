/* ════════════════════════════════════════════════════════════════
   REPETIR UNA PARTIDA DEL LOG DE E, EN EL MOTOR, Y PARARSE DONDE HAGA FALTA

   El log del match («Descargar match (notas + log)») lleva la semilla, los
   dos mazos barajados y TODAS las respuestas. Con eso la partida se rehace
   idéntica en el motor (mismo principio que `check-reconstruir.mjs`), y en
   la decisión de la IA que se pida se para y se le vuelve a preguntar:
   a la heurística CON su traza y a la simulación con la suya. Es la forma
   de saber por qué hizo lo que hizo con el cerebro de AHORA, y de
   comprobar que un arreglo cambia de verdad esa jugada.

   Uso:
     node repetir-log.mjs <match.txt> <partida> --lista
         lista las decisiones de la IA: nº, turno, fase, pregunta y respuesta
     node repetir-log.mjs <match.txt> <partida> --en <nº> [--sin-pensar]
         rehace hasta esa decisión y la vuelve a pensar con trazas

   Límites: si el motor pregunta algo que el log no trae en ese orden
   (versiones distintas de scripts o del motor), se para y lo dice. Las
   ventanas de cadena del modo «nunca» no se apuntaban: se contestan
   «no responder», que es lo que hizo el juego.
   ════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";
import * as X from "./out/ocgcore.bundle.js";
import { scriptReader } from "./out/scripts.bundle.js";
import { GoatDuel } from "./src/duel.mjs";
import { makeAutoPlayer } from "./src/autopilot.mjs";
import { makeTrivialResolver } from "./src/trivial.js";
import { crearCerebro } from "./src/ai/brain.js";
import { crearPensador } from "./src/ai/pensar.js";

const args = process.argv.slice(2);
const archivo = args[0], partida = Number(args[1] ?? 1);
const opt = k => { const i = args.indexOf(k); return i < 0 ? null : (args[i+1] ?? true); };
if(args.includes("--mundos")) globalThis.GOAT_PENSAR_MUNDOS = true;   // cada mundo por separado en la traza
if(args.includes("--mundos")) globalThis.GOAT_PENSAR_MUNDOS = true;   // cada mundo por separado en la traza
const LISTA = args.includes("--lista"), EN = Number(opt("--en") ?? 0), SIN_PENSAR = args.includes("--sin-pensar");
if(!archivo){ console.log("uso: node repetir-log.mjs <match.txt> <partida> --lista | --en <nº>"); process.exit(1); }

const raw = JSON.parse(readFileSync("./out/cards.subset.json","utf-8"));
const names = JSON.parse(readFileSync("./out/names.subset.json","utf-8"));
const db = new Map(); for(const k in raw){ const c = raw[k]; db.set(c.code, { ...c, race:BigInt(c.race) }); }
const MAZOS = JSON.parse(readFileSync("../data/mazos.json","utf-8")).filter(m => !m.aviso && m.main.length >= 40)
  .map(m => ({ nombre:m.nombre, main:m.main, extra:m.extra ?? [] }));
const nombre = c => names[c]?.name ?? String(c);

const txt = readFileSync(archivo, "utf-8");
/* Los mazos (con el extra) salen del JSON del match; el orden de robo, del log. */
let registro = null;
{
  const i = txt.indexOf("--- MAZOS (JSON) ---");
  if(i >= 0){
    const desde = txt.indexOf("{", i), hasta = txt.indexOf("\n═", desde);
    try{ registro = JSON.parse(txt.slice(desde, hasta)); }catch(e){}
  }
}
const trozos = txt.split(/═+\nGame (\d+) — log\n═+\n/);
const cuerpos = {}; for(let i = 1; i < trozos.length; i += 2) cuerpos[+trozos[i]] = trozos[i+1];
/* Un log suelto (duelo libre o del Reino) no lleva cabeceras de partida: es la partida 1. */
if(!Object.keys(cuerpos).length) cuerpos[1] = txt;
const cuerpo = cuerpos[partida];
if(!cuerpo){ console.log(`no hay log de la partida ${partida} en ${archivo}`); process.exit(1); }

const SEED = Number(cuerpo.match(/^semilla: (\d+)/m)?.[1]);
const barajados = JSON.parse(cuerpo.match(/^mazos barajados: (.*)$/m)[1]);
const deBig = v => JSON.parse(JSON.stringify(v), (k, x) => typeof x === "string" && /^-?\d+n$/.test(x) ? BigInt(x.slice(0,-1)) : x);

let ME = null;
const preguntas = [];           // [{ msg, resp, linea, turno, fase }]
const lineas = cuerpo.split("\n");
lineas.forEach((l, n) => {
  const m = l.match(/^\[\s*\d+ms\] T(\d+) (\S+)\s+(.*?)\s*(evento|ia|tú_eliges|auto|sorteo) · (.*)$/);
  if(!m) return;
  const [, t, , fase, kind, datos] = m;
  let d; try{ d = JSON.parse(datos); }catch(e){ return; }
  if(kind === "sorteo"){ ME = d.empiezasTu ? 0 : 1; return; }
  if(kind === "evento"){
    if(d.t === "prompt") preguntas.push({ msg:d.msg, resp:null, linea:n, turno:+t, fase:fase.trim() });
    return;
  }
  if(d.respuesta === undefined) return;
  const ult = [...preguntas].reverse().find(p => !p.resp);
  if(!ult) return;
  ult.resp = d.respuesta === "no responder" ? { type:X.OcgResponseType.SELECT_CHAIN, index:null } : deBig(d.respuesta);
  ult.quien = kind; ult.accion = d.accion;
});
const IAL = 1 - ME;
const extraDe = lado => (lado === ME ? registro?.mio?.extra : registro?.ia?.extra) ?? [];
const deck = lado => lado === ME ? barajados.tu : barajados.rival;

const lib = await X.default({ sync:true });
const duel = new GoatDuel({ lib, X, cardDb:db, scriptReader, onEvent: () => {} });
await duel.create({ deck0:deck(0), deck1:deck(1), extra0:extraDe(0), extra1:extraDe(1),
                    /* «rng: v2»: semilla mezclada (desde la 1.2). Sin la línea, un log viejo. */
                    seed: /^rng: v2/m.test(cuerpo) ? GoatDuel.semillaMotor(SEED) : [BigInt(SEED), 7n, 13n, 29n] });
let trazar = false;
const cerebro = crearCerebro({ X, duel, db, names, nivel:"experto", yo:IAL,
  log: d => { if(trazar) console.log("   ·", d.msg, d.valor != null ? JSON.stringify(d.valor) : "", d.puntos != null ? `(${d.puntos})` : ""); } });
const pensador = crearPensador({ X, crearLib: () => X.default({ sync:true }), GoatDuel, crearCerebro, db, names,
  scriptReader, mazosMeta: MAZOS, mundos: 12, maxCandidatos: 6,
  traza: t => console.log("   ~", JSON.stringify(t)) }).conPilotos(makeTrivialResolver(X), makeAutoPlayer(X));

const T = X.OcgMessageType, MSG = Object.fromEntries(Object.entries(T).map(([k,v]) => [v,k]));
const corto = r => JSON.stringify(r, (k,x) => typeof x === "bigint" ? String(x)+"n" : x);
const describir = (q, r) => {
  if(!r) return "—";
  const lista = { 1:"summons", 2:"special_summons", 3:"monster_sets", 4:"spell_sets", 5:"activates" }[r.action]
             ?? (r.action === 2 && q.type === T.SELECT_IDLECMD ? "pos_changes" : null);
  if(q.type === T.SELECT_IDLECMD){
    const campo = ["summons","special_summons","pos_changes","monster_sets","spell_sets","activates"][r.action];
    if(r.index != null && campo) return `${campo} ${nombre(q[campo]?.[r.index]?.code)}`;
    return ["","","","","","","a batalla","terminar"][r.action] || corto(r);
  }
  if(q.type === T.SELECT_BATTLECMD){
    if(r.action === 1) return `ataca con ${nombre(q.attacks?.[r.index]?.code)}`;
    if(r.action === 0) return `activa ${nombre(q.chains?.[r.index]?.code)}`;
    return r.action === 2 ? "a Main 2" : "terminar";
  }
  if(q.type === T.SELECT_CHAIN) return r.index == null ? "no responder" : `encadena ${nombre(q.selects?.[r.index]?.code)}`;
  if(q.type === T.SELECT_CARD) return `elige ${(r.indicies ?? []).map(i => nombre(q.selects?.[i]?.code)).join(", ")}`;
  return corto(r);
};

let k = 0, nIA = 0;
for(let paso = 0; paso < 20000 && !duel.finished; paso++){
  const q = await duel.run();
  if(!q || duel.finished) break;
  let p = preguntas[k];
  /* El modo «nunca» contestaba solo sin apuntar la pregunta ni la respuesta. */
  if(q.type === T.SELECT_CHAIN && q.player === ME && (!p || p.msg.type !== q.type || p.msg.player !== q.player)){
    duel.respond({ type:X.OcgResponseType.SELECT_CHAIN, index:null }); continue;
  }
  if(!p || p.msg.type !== q.type || p.msg.player !== q.player){
    console.log(`✗ se desvía en la pregunta ${k}: el motor pide ${MSG[q.type]} al ${q.player}, el log tenía ${p ? MSG[p.msg.type]+" al "+p.msg.player : "nada"} (T${duel.turnCount})`);
    process.exit(2);
  }
  let r = p.resp ?? (q.type === T.SELECT_CHAIN ? { type:X.OcgResponseType.SELECT_CHAIN, index:null } : null);
  if(!r){ console.log(`✗ la pregunta ${k} (${MSG[q.type]}) no tiene respuesta en el log`); process.exit(2); }
  if(q.player === IAL){
    nIA++;
    const decision = [T.SELECT_IDLECMD, T.SELECT_BATTLECMD, T.SELECT_CHAIN, T.SELECT_CARD, T.SELECT_EFFECTYN].includes(q.type);
    if(LISTA && decision)
      console.log(`${String(nIA).padStart(4)}  T${p.turno} ${p.fase.padEnd(14)} ${MSG[q.type].padEnd(16)} → ${describir(q, r)}`);
    if(nIA === EN){
      console.log(`══ decisión ${nIA} · T${p.turno} ${p.fase} · ${MSG[q.type]} · el log hizo: ${describir(q, r)}`);
      console.log(`   LP ${duel.lp?.[IAL]} (IA) / ${duel.lp?.[ME]} (E)`);
      const mesa = lado => (duel.zones[lado][4] ?? []).map(c => c ? `${nombre(c.code)} ${c.position & 0xa ? "tapada" : ""}${c.position & 0xc ? "DEF" : "ATK"} ${c.atkReal ?? "?"}/${c.defReal ?? "?"}` : "·").join(" | ");
      console.log(`   mesa IA: ${mesa(IAL)}`);
      console.log(`   mesa E : ${mesa(ME)}   · backrow E ${(duel.zones[ME][8] ?? []).filter(Boolean).length} · mano E ${(duel.zones[ME][2] ?? []).length}`);
      console.log(`   mano IA: ${(duel.zones[IAL][2] ?? []).map(c => nombre(c.code)).join(", ")} · mazo IA ${(duel.zones[IAL][1] ?? []).length} · mazo E ${(duel.zones[ME][1] ?? []).length}`);
      if(q.type === T.SELECT_BATTLECMD)
        console.log("   atacantes que ofrece el motor:", (q.attacks ?? []).map(a => `${nombre(a.code)}@${a.sequence} → espejo: ${nombre(duel.resolve(a, a.code)?.code)}`).join(", "));
      trazar = true;
      const h = cerebro(q, 0);
      trazar = false;
      console.log(`── heurística ahora: ${describir(q, h)}`);
      const plan = cerebro.ultimoPlan?.() ?? [];
      if(plan.length) console.log("   plan:", plan.slice(0, 8).map(x => `${x.action}/${x.index}=${(+x.puntos).toFixed(2)}${x.firme ? "F" : ""}${x.seguro ? "S" : ""}`).join("  "));
      if(plan.length && process.env.PLAN_POR) for(const x of plan.slice(0,8)) console.log(`     ${x.action}/${x.index}=${(+x.puntos).toFixed(2)}  ${x.por ?? ""}`);
      /* --por: cada opción con su motivo (lo que la traza no enseña de las
         que no ganaron). */
      if(args.includes("--por")) for(const x of plan) console.log(`     ${x.action}/${x.index} ${(+x.puntos).toFixed(2)}  ${x.por ?? ""}`);
      if(!SIN_PENSAR){
        let s = null;
        if(q.type === T.SELECT_IDLECMD) s = await pensador.pensarIdle(duel, IAL, q, cerebro, { semilla:(SEED*131 + duel.turnCount*17) >>> 0 });
        else if(q.type === T.SELECT_CHAIN) s = await pensador.pensarCadena(duel, IAL, q, cerebro, { semilla:(SEED*211 + duel.turnCount*29) >>> 0 });
        else if(q.type === T.SELECT_BATTLECMD) s = await pensador.pensarBatalla(duel, IAL, q, cerebro, { semilla:(SEED*197 + duel.turnCount*23) >>> 0, primeraDelTurno:true });
        console.log(`── simulación ahora: ${s ? describir(q, s) : "(no cambia la heurística)"}`);
      }
      process.exit(0);
    }
    try{ cerebro(q, 0); cerebro.anotar?.(q, r); }catch(e){}
  } else if(q.type === T.SELECT_IDLECMD) pensador.verIdle?.(duel, q);
  duel.respond(r); k++;
}
console.log(LISTA ? `(${nIA} preguntas a la IA; la partida se rehízo hasta el final)` : `no llegó a la decisión ${EN} (hay ${nIA})`);
process.exit(0);
