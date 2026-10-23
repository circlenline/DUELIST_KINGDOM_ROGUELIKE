/* ════════════════════════════════════════════════════════════════
   LA MONEDA TIENE DOS CARAS (Reddit, 10-10)

   SundaeOk7647: «With fairy box it will always come out Tails». Con la
   semilla de antes ([SEED,7,13,29]) salía cruz 60 de 60. Aquí se tira la
   moneda de Fairy Box con 60 semillas pasadas por `GoatDuel.semillaMotor`
   y se pide que las caras queden entre el 30 % y el 70 %.
   ════════════════════════════════════════════════════════════════ */
import { montar, X, T } from "./escenario.mjs";
import { GoatDuel } from "./src/duel.mjs";
const R = X.OcgResponseType, IA = X.SelectIdleCMDAction;
async function tirar(semilla){
  const e = await montar({ monstruos:[{ carta:"Luster Dragon", pos:1 }] },
                         { mt:[{ carta:"Fairy Box", pos:1 }] }, { seed:semilla });
  let n = 0;
  await e.correr(m => {
    if(m.type === T.SELECT_IDLECMD && m.player === 0)
      return { type:R.SELECT_IDLECMD, action: m.to_bp ? IA.TO_BP : IA.TO_EP, index:null };
    if(m.type === T.SELECT_BATTLECMD && m.player === 0){
      if(n++ > 0) return "PARAR";
      return { type:R.SELECT_BATTLECMD, action:1, index:m.attacks.findIndex(a => a.can_direct) };
    }
    return null;
  }, 400);
  return e.tipos(T.TOSS_COIN).flatMap(m => m.results);
}
let caras = 0, total = 0, viejas = 0, totalViejas = 0;
for(let s = 1; s <= 60; s++){
  for(const r of await tirar(GoatDuel.semillaMotor(s * 7919))){ total++; if(r) caras++; }
  for(const r of await tirar([BigInt(s * 7919), 7n, 13n, 29n])){ totalViejas++; if(r) viejas++; }
}
console.log("═══ LA MONEDA ═══\n");
console.log(`  semilla vieja: ${viejas} caras de ${totalViejas} (el fallo)`);
const bien = total >= 50 && caras / total > 0.3 && caras / total < 0.7;
console.log(`  ${bien ? "✓" : "✗"} semilla mezclada: ${caras} caras de ${total}`);
console.log(`\n${bien ? "Todo correcto" : "FALLA"}`);
process.exit(bien ? 0 : 1);
