/* ════════════════════════════════════════════════════════════════
   UN MONSTRUO QUE DEBE ATACAR (Reddit, 05-10)

   Honest_Mids: «the opponent entered battle phase and must attack into
   Mobius due to Berserk Gorilla's eff but he refused to attack at all
   and the game is at a standstill». Aquí se comprueba lo que el motor
   pregunta en ese caso —una Battle Phase SIN salida a Main Phase 2 ni a
   End Phase— y, en el banco (familia «reddit 05-10»), que el bot ataca
   cuando no le dejan pasar.
   ════════════════════════════════════════════════════════════════ */
import { montar, nombre, X, T } from "./escenario.mjs";
const R = X.OcgResponseType, IA = X.SelectIdleCMDAction;
let fallos = 0;
const ok = (t, v, d = "") => { if(!v) fallos++; console.log(v ? "  ✓" : "  ✗", t, d ? `— ${d}` : ""); };
console.log("═══ OBLIGADO A ATACAR ═══\n");
const e = await montar({ monstruos:[{ carta:"Berserk Gorilla", pos:0x1 }] },
                       { monstruos:[{ carta:"Mobius the Frost Monarch", pos:0x1 }] });
let pregunta = null;
await e.correr(m => {
  if(m.type === T.SELECT_IDLECMD)
    return { type:R.SELECT_IDLECMD, action: (m.player === 0 && m.to_bp) ? IA.TO_BP : IA.TO_EP, index:null };
  if(m.type === T.SELECT_BATTLECMD && m.player === 0){ pregunta = m; return "PARAR"; }
  return null;
}, 600);
ok("el motor le pregunta la Battle Phase al dueño del Gorilla", !!pregunta);
ok("y no le deja pasar ni a Main Phase 2 ni a End Phase", pregunta && !pregunta.to_m2 && !pregunta.to_ep,
   pregunta ? `to_m2 ${pregunta.to_m2} · to_ep ${pregunta.to_ep} · ataques ${(pregunta.attacks ?? []).map(a => nombre(a.code)).join(", ")}` : "");
console.log(`\n${fallos ? "FALLA: " + fallos : "Todo correcto"}`);
process.exit(fallos ? 1 : 0);
