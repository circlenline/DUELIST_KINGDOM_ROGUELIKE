/* ════════════════════════════════════════════════════════════════
   LOS FLOATERS: LO QUE LA IA DA POR HECHO, PREGUNTADO AL MOTOR (19-11)

   E: «la jugada de invocar tu floater y hacer Creature Swap puede ser
   extremadamente potente: robas el monstruo rival y si destruyes tu
   floater intercambiado, sigues teniendo su efecto». Y: «si crashea su
   floater, aunque coma daño, puede buscar una carta que resuelva la
   mesa». La IA cuenta con tres cosas; aquí se comprueba que ocgcore las
   hace así:
     1. Mi Giant Rat, que ahora controla él por Creature Swap, destruida
        en combate por mí: el reclutamiento es MÍO (sale de mi mazo, a mi
        campo).
     2. Mi Giant Rat estrellada contra algo más grande saca otro monstruo
        de mi mazo…
     3. …que todavía puede atacar en esa misma Battle Phase.
   ════════════════════════════════════════════════════════════════ */
import { montar, nombre, X, P, T, L } from "./escenario.mjs";

const R = X.OcgResponseType, IA = X.SelectIdleCMDAction, BA = X.SelectBattleCMDAction;
const pruebas = [];
const comprobar = (t, v, detalle) => { pruebas.push(!!v); console.log(v ? "  ✓" : "  ✗", t, detalle ? `— ${detalle}` : ""); };
const raiz = n => String(n).replace(/\s*\((GOAT|Pre-Errata|Anime)\)\s*$/i, "").trim();
const idx = (lista, nom, jug) => (lista ?? []).findIndex(a => raiz(nombre(a.code)) === nom && (jug == null || a.controller === jug));
const elegir = (m, nom, jug) => ({ type:R.SELECT_CARD, indicies:[Math.max(0, idx(m.selects, nom, jug))] });
const pasarIdle = m => ({ type:R.SELECT_IDLECMD, action: m.to_ep ? IA.TO_EP : IA.TO_BP, index:null });
const aBatalla = { type:R.SELECT_IDLECMD, action:IA.TO_BP, index:null };

console.log("═══ FLOATERS EN EL MOTOR ═══\n");

/* 1 · Creature Swap dando mi Giant Rat y matándola yo */
{
  const e = await montar(
    { monstruos:[{ carta:"Giant Rat", pos:P.FACEUP_ATTACK }, { carta:"Luster Dragon", pos:P.FACEUP_ATTACK }],
      mano:["Creature Swap"], deck:["Exiled Force"] },
    { monstruos:[{ carta:"Blade Knight", pos:P.FACEUP_DEFENSE }] }, { roboInicial:0 });
  let paso = 0, quienRecluta = null;
  await e.correr((m) => {
    const yo = m.player;
    if(e.turnPlayer !== 0) return m.type === T.SELECT_IDLECMD ? pasarIdle(m) : null;
    if(m.type === T.SELECT_IDLECMD){
      if(paso === 0 && !m.to_bp) return pasarIdle(m);
      if(paso === 0){ const i = idx(m.activates, "Creature Swap"); if(i >= 0){ paso = 1; return { type:R.SELECT_IDLECMD, action:IA.SELECT_ACTIVATE, index:i }; } }
      if(paso === 2){ paso = 3; return aBatalla; }
      return pasarIdle(m);
    }
    if(m.type === T.SELECT_CARD){
      if(paso === 1 && yo === 0) return elegir(m, "Giant Rat", 0);
      if(paso === 1 && yo === 1){ paso = 2; return elegir(m, "Blade Knight", 1); }
      if(paso >= 4){ quienRecluta = yo; return { type:R.SELECT_CARD, indicies:[0] }; }
    }
    if(m.type === T.SELECT_BATTLECMD){
      if(paso === 3){ const i = idx(m.attacks, "Luster Dragon"); if(i >= 0){ paso = 4; return { type:R.SELECT_BATTLECMD, action:BA.SELECT_BATTLE, index:i }; } }
      if(paso >= 4) return "PARAR";
    }
    if(m.type === T.SELECT_EFFECTYN || m.type === T.SELECT_YESNO){ if(paso >= 4){ quienRecluta = m.player; return { type:R.SELECT_YESNO, yes:true }; } }
    return null;
  }, 1500);
  const mio = e.campo(0).map(c => raiz(c.nombre));
  comprobar("Creature Swap: me llevo su Blade Knight", mio.includes("Blade Knight"), `mi campo: ${mio.join(", ")}`);
  comprobar("mi Giant Rat, en su campo, destruida por mí: la Rata va a MI cementerio", e.gy(0).some(c => raiz(c.nombre) === "Giant Rat"));
  comprobar("y el reclutamiento es mío: Exiled Force sale de MI mazo a MI campo", mio.includes("Exiled Force"),
            `quien eligió: ${quienRecluta}`);
}

/* 2 y 3 · Crash: Giant Rat contra un 1600, recluta y el reclutado ataca */
{
  const e = await montar(
    { monstruos:[{ carta:"Giant Rat", pos:P.FACEUP_ATTACK }], deck:["Exiled Force"] },
    { monstruos:[{ carta:"Breaker the Magical Warrior", pos:P.FACEUP_ATTACK }] }, { roboInicial:0 });
  let paso = 0, atacaElNuevo = false;
  await e.correr((m) => {
    if(e.turnPlayer !== 0) return m.type === T.SELECT_IDLECMD ? pasarIdle(m) : null;
    if(m.type === T.SELECT_IDLECMD){
      if(paso === 0 && !m.to_bp) return pasarIdle(m);
      if(paso === 0){ paso = 1; return aBatalla; }
      return pasarIdle(m);
    }
    if(m.type === T.SELECT_BATTLECMD){
      if(paso === 1){ const i = idx(m.attacks, "Giant Rat"); if(i >= 0){ paso = 2; return { type:R.SELECT_BATTLECMD, action:BA.SELECT_BATTLE, index:i }; } }
      if(paso === 2){ atacaElNuevo = idx(m.attacks, "Exiled Force") >= 0; return "PARAR"; }
    }
    if(m.type === T.SELECT_CARD) return { type:R.SELECT_CARD, indicies:[0] };
    if(m.type === T.SELECT_EFFECTYN || m.type === T.SELECT_YESNO) return { type:R.SELECT_YESNO, yes:true };
    return null;
  }, 1500);
  const mio = e.campo(0).map(c => raiz(c.nombre));
  comprobar("Giant Rat estrellada contra un 1600: recluta de mi mazo", mio.includes("Exiled Force"), `mi campo: ${mio.join(", ") || "vacío"} · LP ${e.lp[0]}`);
  comprobar("y lo reclutado puede atacar en esa misma Battle Phase", atacaElNuevo);
}

const ok = pruebas.filter(Boolean).length;
console.log(`\n${ok}/${pruebas.length} · ${ok === pruebas.length ? "Todo correcto" : "HAY FALLOS"}`);
process.exit(ok === pruebas.length ? 0 : 1);
