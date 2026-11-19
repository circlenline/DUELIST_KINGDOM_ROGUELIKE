/* ════════════════════════════════════════════════════════════════
   EL MODO DE CADENAS «CUANDO TIENE SENTIDO» (src/ventanas.js)

   Con los textos REALES de las cartas (out/names.subset.json) y los tipos
   de la base: que el Waboku no se pregunte en su Main Phase pero sí con un
   ataque declarado o si va a morir, que la Trap Hole salte tras su
   invocación, que la MST se pregunte en su End Phase y no en su Standby…
   ════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";
import { valePreguntar, clasificarCarta } from "./src/ventanas.js";
const NOMBRES = JSON.parse(readFileSync("./out/names.subset.json","utf-8"));
const CARDS = JSON.parse(readFileSync("./out/cards.subset.json","utf-8"));
const porNombre = new Map();
for(const k in NOMBRES) if(!porNombre.has(NOMBRES[k].name)) porNombre.set(NOMBRES[k].name, +k);
const cod = n => { const c = porNombre.get(n); if(!c) throw new Error("no existe "+n); return c; };
const info = code => ({ nombre:NOMBRES[code]?.name, texto:NOMBRES[code]?.desc ?? "", tipo:Number(CARDS[code]?.type ?? 0) });

const pruebas = [];
const ok = (t, v, extra="") => { pruebas.push(!!v); console.log(v ? "  ✓" : "  ✗", t, extra); };
const YO = 0, EL = 1;
const q = (...nombres) => ({ selects: nombres.map((n, i) => ({ code: cod(n), controller:YO, location:8, sequence:i })) });
const pregunta = (cartas, ctx = {}) => valePreguntar(q(...cartas), { yo:YO, turnPlayer:EL, fase:0x4, info, uidEn: s => 100 + s.sequence, ...ctx }).preguntar;

console.log("═══ CLASIFICACIÓN POR TEXTO ═══");
const esperado = { "Waboku":"batalla", "Mirror Force":"batalla", "Sakuretsu Armor":"batalla", "Magic Cylinder":"batalla",
  "Negate Attack":"batalla", "Threatening Roar":"antiAtaque", "Solemn Judgment":"contra", "Magic Jammer":"contra",
  "Trap Hole":"invocacion", "Bottomless Trap Hole":"invocacion", "Torrential Tribute":"invocacion", "Trap Dustshoot":"mano",
  "Mystical Space Typhoon":"general", "Book of Moon":"general", "Scapegoat":"general", "Call of the Haunted":"general",
  "Ring of Destruction":"general", "Dust Tornado":"general" };
for(const [n, e] of Object.entries(esperado)){
  let c; try{ c = clasificarCarta(info(cod(n))); }catch(err){ ok(`${n}: ${err.message}`, false); continue; }
  ok(`${n} → ${e}`, c === e, c !== e ? `(salió ${c})` : "");
}

console.log("\n═══ CUÁNDO PREGUNTA ═══");
ok("Waboku: no en su Main Phase sin nada", !pregunta(["Waboku"]));
ok("Waboku: sí con un ataque suyo declarado", pregunta(["Waboku"], { atacante:{ controller:EL } }));
ok("Waboku: sí si es objetivo (MST encima)", pregunta(["Waboku"], { cadena:[{ controller:EL, code:cod("Mystical Space Typhoon") }], objetivos:new Set([100]) }));
ok("Waboku: sí si viene un Heavy Storm", pregunta(["Waboku"], { cadena:[{ controller:EL, code:cod("Heavy Storm") }] }));
ok("Waboku: no en su End Phase", !pregunta(["Waboku"], { fase:0x200 }));
ok("Mirror Force: no al empezar su Battle Phase sin ataque", !pregunta(["Mirror Force"], { fase:0x8 }));
ok("Threatening Roar: sí al empezar su Battle Phase", pregunta(["Threatening Roar"], { fase:0x8 }));
ok("Trap Hole: sí justo tras su invocación", pregunta(["Trap Hole"], { recienInvocadaRival:true }));
ok("Trap Hole: no en su End Phase", !pregunta(["Trap Hole"], { fase:0x200 }));
ok("Solemn Judgment: sí si activa algo", pregunta(["Solemn Judgment"], { cadena:[{ controller:EL, code:cod("Pot of Greed") }] }));
ok("Solemn Judgment: sí si acaba de invocar", pregunta(["Solemn Judgment"], { recienInvocadaRival:true }));
ok("Solemn Judgment: no en su End Phase", !pregunta(["Solemn Judgment"], { fase:0x200 }));
ok("MST: no en su Standby Phase sin nada", !pregunta(["Mystical Space Typhoon"], { fase:0x2 }));
ok("MST: sí en su End Phase", pregunta(["Mystical Space Typhoon"], { fase:0x200 }));
ok("Scapegoat: sí con un ataque suyo", pregunta(["Scapegoat"], { atacante:{ controller:EL } }));
ok("Book of Moon: sí si activa algo", pregunta(["Book of Moon"], { cadena:[{ controller:EL, code:cod("Snatch Steal") }] }));
ok("Trap Dustshoot: sí en su Draw Phase", pregunta(["Trap Dustshoot"], { fase:0x1 }));
ok("En mi turno, sin cadena ni ataque: no", !pregunta(["Book of Moon","Mystical Space Typhoon"], { turnPlayer:YO }));
ok("En mi turno, si él me responde: sí", pregunta(["Mystical Space Typhoon"], { turnPlayer:YO, cadena:[{ controller:EL, code:cod("Dust Tornado") }] }));
ok("Varias cartas: basta con que una tenga sentido", pregunta(["Waboku","Mystical Space Typhoon"], { fase:0x200 }));
ok("Un disparador desde el cementerio se pregunta siempre", valePreguntar({ selects:[{ code:cod("Sinister Serpent"), controller:YO, location:16, sequence:0 }] },
   { yo:YO, turnPlayer:YO, fase:0x2, info }).preguntar);

const bien = pruebas.filter(Boolean).length;
console.log(`\n${bien}/${pruebas.length} · ${bien === pruebas.length ? "Todo correcto" : "HAY FALLOS"}`);
process.exit(bien === pruebas.length ? 0 : 1);
