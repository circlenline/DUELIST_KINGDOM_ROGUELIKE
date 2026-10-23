/* ════════════════════════════════════════════════════════════════
   UN TRIBUTO QUE VALE POR DOS (Reddit, 05-10)

   LaSonicSkins: «Double Coston also doesn't work with the double
   tribute». Se pregunta al motor qué manda al invocar un OSCURO de nivel
   7 con Double Coston en la mesa, y que con SOLO la Coston la invocación
   sale. La interfaz (main.js) y el bot (brain.js) cuentan ya tributos,
   no cartas: `release_param` de cada una.
   ════════════════════════════════════════════════════════════════ */
import { montar, nombre, X, T } from "./escenario.mjs";
const R = X.OcgResponseType, IA = X.SelectIdleCMDAction;
let fallos = 0;
const ok = (t, v, d = "") => { if(!v) fallos++; console.log(v ? "  ✓" : "  ✗", t, d ? `— ${d}` : ""); };
console.log("═══ TRIBUTOS QUE VALEN POR DOS ═══\n");
async function probar(elegir){
  const e = await montar({ monstruos:[{ carta:"Double Coston", pos:0x1 }, { carta:"Mystical Elf", pos:0x1 }], mano:["Dark Magician"] }, {});
  let pregunta = null, paso = 0;
  await e.correr(m => {
    if(m.type === T.SELECT_IDLECMD && m.player === 0){
      if(paso === 0){ paso = 1; const i = (m.summons ?? []).findIndex(s => /^Dark Magician/.test(nombre(s.code)));
        if(i < 0) return "PARAR"; return { type:R.SELECT_IDLECMD, action:IA.SELECT_SUMMON, index:i }; }
      return "PARAR";
    }
    if(m.type === T.SELECT_TRIBUTE && m.player === 0){
      pregunta ??= m;
      const idx = elegir(m); return { type:R.SELECT_TRIBUTE, indicies:idx };
    }
    return null;
  }, 300);
  return { e, pregunta };
}
const coston = m => (m.selects ?? []).findIndex(s => /^Double Coston/.test(nombre(s.code)));
{ const { e, pregunta } = await probar(m => [coston(m)]);
  const c = pregunta?.selects?.[coston(pregunta)];
  ok("el motor pide 2 tributos y dice que Double Coston vale 2", pregunta?.min === 2 && c?.release_param === 2,
     pregunta ? `min ${pregunta.min} · max ${pregunta.max} · ${pregunta.selects.map(s => nombre(s.code) + "=" + s.release_param).join(", ")}` : "sin pregunta");
  ok("con solo Double Coston, Dark Magician sale y el Elfo se queda", e.campo(0).some(x => /^Dark Magician/.test(x.nombre)) && e.campo(0).some(x => /Mystical Elf/.test(x.nombre)),
     e.campo(0).map(x => x.nombre).join(", ")); }
console.log(`\n${fallos ? "FALLA: " + fallos : "Todo correcto"}`);
process.exit(fallos ? 1 : 0);
