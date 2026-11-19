/* ════════════════════════════════════════════════════════════════
   BANCO DE POSICIONES — la vara para medir si la IA juega bien.

   POR QUÉ HACE FALTA.

   El marcador bot contra bot no sirve para esto. Da 50% haga lo que
   haga: dos bots igual de malos se reparten las partidas, y la jugada
   CORRECTA a veces mide peor que la codiciosa porque el rival tampoco
   te castiga por regalar cartas. Lleva toda la sesión pasando: cada
   tanda de cambios mide 49-52% contra la anterior, suba o baje la
   calidad de juego.

   Esto es lo que usan los motores de ajedrez desde los 80: un conjunto
   de posiciones fijas con la jugada buena conocida, y una nota. Aquí
   cada posición sale de un misplay REAL —los logs de E y los reportes
   de la gente de Reddit—, no de lo que a mí me parezca.

   Uso:
     node banco.mjs                       el cerebro actual
     node banco.mjs /tmp/viejo/…/browser  para comparar dos versiones
     node banco.mjs --fallos              solo lo que falla

   Cada posición vale 1 punto si acierta, 0.5 si hace algo aceptable y
   0 si no. La nota es sobre 100 y se desglosa por familia, porque lo
   interesante no es el total sino DÓNDE falla.
   ════════════════════════════════════════════════════════════════ */
import { mesa, ref, cod, L, P, MT, R, IA, BA, X, DB, NOMBRES,
         preguntaIdle, preguntaBatalla, preguntaCadena, preguntaObjetivo,
         preguntaSiNo, preguntaPosicion, queHizo } from "./banco-tablero.mjs";

/* OJO: process.argv[0] es la ruta de node y empieza por "/", así que
   buscar "el primer argumento que parezca una ruta" cogía /usr/bin/node.
   Los argumentos de verdad empiezan en el índice 2. */
const ruta = process.argv.slice(2).find(a=>!a.startsWith("--")) ?? "./src/ai/brain.js";
const destino = ruta.endsWith(".js") ? ruta : ruta.replace(/\/$/,"")+"/src/ai/brain.js";
const { crearCerebro } = await import(destino);
const soloFallos = process.argv.includes("--fallos");

const FICHA = 73915052;      // Sheep Token
const pensar = (duel, nivel="experto") =>
  crearCerebro({ X, duel, db:DB, names:NOMBRES, nivel, yo:0, log: process.env.BANCO_TRAZA ? (o=>console.log("      ·",o.msg, JSON.stringify(o.valor??""))) : null });

/* ── el catálogo ──
   familia · qué situación es · el tablero · la pregunta · cómo se puntúa.
   `bien` devuelve 1, `regular` 0.5, cualquier otra cosa 0.
   `de` es de dónde salió: log de E, reporte de Reddit, o guía. */
const POSICIONES = [];
const pos = (familia, titulo, de, montar) => POSICIONES.push({familia, titulo, de, montar});

/* ══════════════ 1. NO DISPARARSE EN EL PIE ══════════════
   La familia más numerosa y la que más se reporta. */

pos("no dispararse en el pie", "Heavy Storm con su propia Snatch Steal puesta",
    "reporte de E", () => {
  const d = mesa({ mios:{ mano:["Heavy Storm"], mt:[{carta:"Snatch Steal", pos:P.ATK}],
                          campo:["Airknight Parshath"] },
                   suyos:{ mt:["Sakuretsu Armor","Mirror Force"] } });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]] }),
           bien: r => r?.action !== IA.SELECT_ACTIVATE };
});

pos("no dispararse en el pie", "Heavy Storm sin nada propio que perder",
    "control: no puede quedarse mudo", () => {
  const d = mesa({ mios:{ mano:["Heavy Storm"], campo:["Airknight Parshath"] },
                   suyos:{ mt:["Sakuretsu Armor","Mirror Force","Torrential Tribute"] } });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]] }),
           bien: r => r?.action === IA.SELECT_ACTIVATE };
});

/* ══ EL CASO DE PEGASUS, SACADO DEL LOG DE E ══
   `[328029ms] T8 rival · {"msg":"activar Heavy Storm","puntos":1.3}` — con
   tres mágicas suyas colocadas y una sola del rival. La heurística vieja
   contaba CARTAS ("¿tiene el rival backrow? pues adelante"); ahora compara
   VALOR, y volarse tres por una no sale a cuenta. */
pos("no dispararse en el pie", "Heavy Storm con tres cartas propias contra una del rival",
    "log de E contra Pegasus, T8", () => {
  const d = mesa({ mios:{ mano:["Heavy Storm"],
                          mt:["Sakuretsu Armor","Solemn Judgment","Book of Moon"] },
                   suyos:{ mt:["Sakuretsu Armor"] } });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]] }),
           bien: r => r?.action !== IA.SELECT_ACTIVATE };
});

/* Y el reverso, para que no se quede muda: tres suyas contra una mía sí
   es una tormenta buena. Un veto sin su contraejemplo acaba en una IA que
   nunca juega la carta. */
pos("no dispararse en el pie", "Heavy Storm con una propia contra tres del rival",
    "control del caso anterior", () => {
  const d = mesa({ mios:{ mano:["Heavy Storm"], mt:["Book of Moon"] },
                   suyos:{ mt:["Sakuretsu Armor","Solemn Judgment","Mirror Force"] } });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]] }),
           bien: r => r?.action === IA.SELECT_ACTIVATE };
});

pos("no dispararse en el pie", "MST sin backrow rival: el único objetivo es el suyo",
    "AyeRye, Reddit", () => {
  const d = mesa({ mios:{ mt:["Mystical Space Typhoon","Torrential Tribute"] },
                   suyos:{}, turnPlayer:1 });
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]),
           bien: r => r?.index == null };
});

pos("no dispararse en el pie", "Skull Lair con el rival sin monstruos",
    "log de E, partida 6", () => {
  const d = mesa({ mios:{ mt:["Skull Lair"], campo:["Airknight Parshath"],
                          gy:["Sangan","Magician of Faith"] },
                   suyos:{ mt:["Mirror Force"] }, turnPlayer:1 });
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]),
           bien: r => r?.index == null };
});

pos("no dispararse en el pie", "Raigeki Break sin nada del rival",
    "log de E, partida 2", () => {
  const d = mesa({ mios:{ mt:["Raigeki Break"], mano:["Sangan"],
                          campo:["Airknight Parshath"] },
                   suyos:{}, turnPlayer:1 });
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]),
           bien: r => r?.index == null };
});

pos("no dispararse en el pie", "Torrential Tribute sobre su propia invocación",
    "reporte de E", () => {
  const d = mesa({ mios:{ mt:["Torrential Tribute"],
                          campo:["Airknight Parshath","Breaker the Magical Warrior"] },
                   suyos:{ campo:["Sangan"] }, turnPlayer:0 });
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]),
           bien: r => r?.index == null };
});

pos("no dispararse en el pie", "Solemn Judgment sobre su propia carta",
    "log del 10 de agosto", () => {
  const d = mesa({ mios:{ mt:["Solemn Judgment"] }, turnPlayer:0 });
  d.cadena = [{ code:cod("Trap Dustshoot"), controller:0, uid:999 }];
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]),
           bien: r => r?.index == null };
});

pos("no dispararse en el pie", "Ring of Destruction que también le mata a él",
    "log de E, partida 6", () => {
  const d = mesa({ mios:{ mano:["Ring of Destruction"] },
                   suyos:{ campo:["Airknight Parshath"] }, lp:[1500,1500] });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]] }),
           bien: r => r?.action !== IA.SELECT_ACTIVATE };
});

pos("no dispararse en el pie", "destruir M/T elige la del rival aunque la suya valga más",
    "reporte de E", () => {
  const d = mesa({ mios:{ mt:[{carta:"Snatch Steal", pos:P.ATK}] },
                   suyos:{ mt:[{carta:"Sakuretsu Armor", pos:P.ATK}] } });
  return { d, q: preguntaObjetivo([d.zones[0][L.SZONE][0], d.zones[1][L.SZONE][0]]),
           bien: r => r?.indicies?.[0] === 1 };
});

pos("no dispararse en el pie", "Book of Moon ya puesta y solo su monstruo como objetivo",
    "reporte de E", () => {
  const d = mesa({ mios:{ mt:["Book of Moon"],
                          campo:["Dekoichi the Battlechanted Locomotive"] },
                   suyos:{ campo:[{carta:"Magician of Faith", pos:P.TAPADA}] } });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.SZONE][0]] }),
           bien: r => r?.action !== IA.SELECT_ACTIVATE };
});

pos("no dispararse en el pie", "Book of Moon encadenada a su propia invocación",
    "escáner: 234 veces en 300 partidas", () => {
  const d = mesa({ mios:{ mt:["Book of Moon"], campo:["Asura Priest"] },
                   suyos:{}, turnPlayer:0 });
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]),
           bien: r => r?.index == null };
});

/* ══════════════ 2. NO MALGASTAR ══════════════ */

pos("no malgastar", "Snatch Steal sobre una ficha de Scapegoat",
    "reporte de E", () => {
  const d = mesa({ mios:{ mano:["Snatch Steal"] }, suyos:{} });
  d.zones[1][L.MZONE][0] = { uid:900, code:FICHA, controller:1,
                             location:L.MZONE, sequence:0, position:P.ATK };
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]] }),
           bien: r => r?.action !== IA.SELECT_ACTIVATE };
});

pos("no malgastar", "Snatch Steal sobre un Airknight sí vale",
    "control", () => {
  const d = mesa({ mios:{ mano:["Snatch Steal"] },
                   suyos:{ campo:["Airknight Parshath"] } });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]] }),
           bien: r => r?.action === IA.SELECT_ACTIVATE };
});

pos("no malgastar", "remoción sobre una ficha",
    "reporte de E", () => {
  const d = mesa({ mios:{ mano:["Smashing Ground"] }, suyos:{} });
  d.zones[1][L.MZONE][0] = { uid:901, code:FICHA, controller:1,
                             location:L.MZONE, sequence:0, position:P.ATK };
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]] }),
           bien: r => r?.action !== IA.SELECT_ACTIVATE };
});

pos("no malgastar", "remoción sobre un muro de 2000 en defensa",
    "goatformat: los muros se comen tu remoción", () => {
  const d = mesa({ mios:{ mano:["Smashing Ground"] },
                   suyos:{ campo:[{carta:"Gravekeeper's Spy", pos:P.DEF}] } });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]] }),
           bien: r => r?.action !== IA.SELECT_ACTIVATE };
});

pos("no malgastar", "Thunder Dragon sin copias en el mazo",
    "reporte de E", () => {
  const d = mesa({ mios:{ mano:["Thunder Dragon"],
                          gy:["Thunder Dragon","Thunder Dragon"] },
                   mazoMio:["Thunder Dragon","Thunder Dragon","Thunder Dragon"] });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]],
                                coloca:[d.zones[0][L.HAND][0]] }),
           bien: r => r?.action !== IA.SELECT_ACTIVATE };
});

pos("no malgastar", "Thunder Dragon con copias sí se activa",
    "control", () => {
  const d = mesa({ mios:{ mano:["Thunder Dragon"] },
                   mazoMio:["Thunder Dragon","Thunder Dragon","Thunder Dragon"] });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]],
                                coloca:[d.zones[0][L.HAND][0]] }),
           bien: r => r?.action === IA.SELECT_ACTIVATE };
});

pos("no malgastar", "Sakuretsu Armor contra un atacante de 300",
    "goatformat: guárdala para lo que duele", () => {
  const d = mesa({ mios:{ mt:["Sakuretsu Armor"] },
                   suyos:{ campo:["Sinister Serpent"] }, turnPlayer:1, fase:0x10 });
  const atk = d.zones[1][L.MZONE][0];
  d.atacante = { uid:atk.uid, code:atk.code, controller:1 };
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]),
           bien: r => r?.index == null };
});

pos("no malgastar", "Sakuretsu Armor contra un Airknight sí",
    "control", () => {
  const d = mesa({ mios:{ mt:["Sakuretsu Armor"] },
                   suyos:{ campo:["Airknight Parshath"] }, turnPlayer:1, fase:0x10 });
  const atk = d.zones[1][L.MZONE][0];
  d.atacante = { uid:atk.uid, code:atk.code, controller:1 };
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]),
           bien: r => r?.index === 0 };
});

pos("no malgastar", "Solemn Judgment: media vida por un Book of Moon",
    "goatformat: solo por lo que decide la partida", () => {
  const d = mesa({ mios:{ mt:["Solemn Judgment"] }, turnPlayer:1 });
  d.cadena = [{ code:cod("Book of Moon"), controller:1, uid:999 }];
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]),
           bien: r => r?.index == null };
});

pos("no malgastar", "Solemn Judgment sí por un Black Luster Soldier",
    "control", () => {
  const d = mesa({ mios:{ mt:["Solemn Judgment"] }, turnPlayer:1 });
  d.cadena = [{ code:cod("Black Luster Soldier - Envoy of the Beginning"),
                controller:1, uid:999 }];
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]),
           bien: r => r?.index === 0 };
});

pos("no malgastar", "Hand of Nephthys con el Phoenix ya en el campo",
    "TheBlackbird95, Reddit", () => {
  const d = mesa({ mios:{ mt:[{carta:"Hand of Nephthys", pos:P.ATK}],
                          campo:["Magician of Faith","Sacred Phoenix of Nephthys"] },
                   mazoMio:["Sacred Phoenix of Nephthys"] });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.SZONE][0]] }),
           bien: r => r?.action !== IA.SELECT_ACTIVATE };
});

pos("no malgastar", "Premature Burial por un monstruo de 300 de ataque",
    "goatformat: reanimar basura es tirar la carta", () => {
  const d = mesa({ mios:{ mano:["Premature Burial"], gy:["Magician of Faith"] },
                   suyos:{ campo:["Airknight Parshath"] } });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]] }),
           bien: r => r?.action !== IA.SELECT_ACTIVATE };
});

/* ══════════════ 3. COMBATE ══════════════ */

const ataqueContra = (mio, suyo, extra={}) => () => {
  const d = mesa({ mios:{ campo:[mio] }, suyos:{ campo:[suyo] }, ...extra });
  return { d, q: preguntaBatalla([d.zones[0][L.MZONE][0]]) };
};

pos("combate", "no ataca a Spirit Reaper, que no muere en combate",
    "goatformat", () => ({ ...ataqueContra("Airknight Parshath","Spirit Reaper")(),
      bien: r => r?.action !== BA.SELECT_BATTLE }));

pos("combate", "no se lanza contra D.D. Warrior Lady",
    "goatformat: destierra a los dos", () => ({
      ...ataqueContra("Airknight Parshath","D.D. Warrior Lady")(),
      bien: r => r?.action !== BA.SELECT_BATTLE }));

pos("combate", "sí ataca a un Breaker de 1600",
    "control", () => ({ ...ataqueContra("Airknight Parshath","Breaker the Magical Warrior")(),
      bien: r => r?.action === BA.SELECT_BATTLE }));

pos("combate", "sí ataca a una Gravekeeper's Spy boca arriba EN ATAQUE",
    "medido: marcarla como peligrosa costaba 2 puntos", () => ({
      ...ataqueContra("Airknight Parshath",{carta:"Gravekeeper's Spy", pos:P.ATK})(),
      bien: r => r?.action === BA.SELECT_BATTLE }));

pos("combate", "no ataca a una Spy de 2000 en DEFENSA",
    "mx4WAYNE_styles, Reddit", () => ({
      ...ataqueContra("Airknight Parshath",{carta:"Gravekeeper's Spy", pos:P.DEF})(),
      bien: r => r?.action !== BA.SELECT_BATTLE }));

/* ══ LAS TAPADAS · las dos caras de la misma apuesta ══
   E, dos turnos seguidos del log 19-14-58: «no ataca a mi monstruo en
   defensa con sus monstruos, entonces por qué los deja en ataque?».
   Tenía un Magician of Faith tapado y enfrente un Flying Kamakiri de
   1400. El umbral era `atk > 1600` a ojo; la tabla medida dice que 1400
   se lleva el 61% de lo que se coloca tapado en este formato.
   Van las DOS: sin el contraejemplo, "ataca siempre a las tapadas" pasa
   el test igual de bien y es otra forma de jugar mal. */
pos("combate", "sí ataca a una tapada con 1400 de ataque",
    "reporte de E, log 19-14-58 T10 y T11: la apuesta es del 61%", () => ({
      ...ataqueContra("Flying Kamakiri #1",
                      {carta:"Magician of Faith", pos:P.TAPADA})(),
      bien: r => r?.action === BA.SELECT_BATTLE }));

pos("combate", "pero NO con 900",
    "con 900 la apuesta baja al 44%: es tirar el monstruo", () => ({
      ...ataqueContra("Cyber Jar",
                      {carta:"Magician of Faith", pos:P.TAPADA})(),
      bien: r => r?.action !== BA.SELECT_BATTLE }));

pos("combate", "Thousand-Eyes Restrict ataca con lo que ha absorbido",
    "reporte de E: no atacaba nunca con él", () => {
  const d = mesa({ mios:{ campo:[{carta:"Thousand-Eyes Restrict", atkReal:1900, defReal:1500}] },
                   suyos:{ campo:["Magician of Faith"] } });
  return { d, q: preguntaBatalla([d.zones[0][L.MZONE][0]]),
           bien: r => r?.action === BA.SELECT_BATTLE };
});

pos("combate", "…y sin absorber nada no se suicida",
    "control", () => {
  const d = mesa({ mios:{ campo:[{carta:"Thousand-Eyes Restrict", atkReal:0, defReal:0}] },
                   suyos:{ campo:["Airknight Parshath"] } });
  return { d, q: preguntaBatalla([d.zones[0][L.MZONE][0]]),
           bien: r => r?.action !== BA.SELECT_BATTLE };
});

pos("combate", "ataca primero con el grande para forzarle el Scapegoat",
    "goatformat, 40 common mistakes", () => {
  const d = mesa({ mios:{ campo:["Airknight Parshath","Sinister Serpent"] }, suyos:{} });
  return { d, q: preguntaBatalla([d.zones[0][L.MZONE][0], d.zones[0][L.MZONE][1]]),
           bien: r => r?.action===BA.SELECT_BATTLE && r?.index===0,
           regular: r => r?.action===BA.SELECT_BATTLE };
});

pos("combate", "D.D. Warrior Lady no se destierra ganando limpio",
    "log de E, partida 4", () => {
  const d = mesa({ mios:{ campo:["D.D. Warrior Lady"] },
                   suyos:{ campo:["Magician of Faith"] } });
  return { d, q: preguntaSiNo(cod("D.D. Warrior Lady")), bien: r => r?.yes === false };
});

pos("combate", "…pero sí contra un Black Luster Soldier",
    "control", () => {
  const d = mesa({ mios:{ campo:["D.D. Warrior Lady"] },
                   suyos:{ campo:["Black Luster Soldier - Envoy of the Beginning"] } });
  return { d, q: preguntaSiNo(cod("D.D. Warrior Lady")), bien: r => r?.yes === true };
});

/* ══════════════ 4. TEMPO Y POSICIÓN ══════════════ */

pos("tempo", "no invoca de frente delante de algo más grande",
    "reporte de E", () => {
  const d = mesa({ mios:{ mano:["Dekoichi the Battlechanted Locomotive"] },
                   suyos:{ campo:["Airknight Parshath"] } });
  const c = d.zones[0][L.HAND][0];
  return { d, q: preguntaIdle({ invoca:[c], coloca:[c] }),
           bien: r => r?.action === IA.SELECT_MONSTER_SET };
});

pos("tempo", "una ficha de Scapegoat nunca pasa a ataque",
    "reporte de E", () => {
  const d = mesa({ mios:{}, suyos:{} });
  d.zones[0][L.MZONE][0] = { uid:910, code:FICHA, controller:0,
                             location:L.MZONE, sequence:0, position:P.DEF };
  return { d, q: preguntaIdle({ giros:[d.zones[0][L.MZONE][0]] }),
           bien: r => r?.action !== IA.SELECT_POS_CHANGE };
});

pos("tempo", "no invoca Asura Priest en un turno sin Battle Phase",
    "TheBlackbird95, Reddit", () => {
  const d = mesa({ mios:{ mano:["Asura Priest"] }, suyos:{} });
  const c = d.zones[0][L.HAND][0];
  return { d, q: preguntaIdle({ invoca:[c], coloca:[c], bp:false }),
           bien: r => r?.action !== IA.SELECT_SUMMON };
});

pos("tempo", "con Battle Phase y campo vacío sí lo invoca",
    "control", () => {
  const d = mesa({ mios:{ mano:["Asura Priest"] }, suyos:{} });
  const c = d.zones[0][L.HAND][0];
  return { d, q: preguntaIdle({ invoca:[c], coloca:[c], bp:true }),
           bien: r => r?.action === IA.SELECT_SUMMON };
});

pos("tempo", "Scapegoat no se quema en la Main Phase 1 del rival",
    "goatformat: encadénala en la End Phase", () => {
  const d = mesa({ mios:{ mt:["Scapegoat"] }, turnPlayer:1, fase:0x4 });
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), bien: r => r?.index == null };
});

pos("tempo", "Scapegoat sí en la End Phase del rival si en mi turno uso las fichas",
    "control (19-11: con Metamorphosis en la mano, las fichas tienen trabajo)", () => {
  const d = mesa({ mios:{ mt:["Scapegoat"], mano:["Metamorphosis"] }, turnPlayer:1, fase:0x200 });
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), bien: r => r?.index === 0 };
});
pos("tempo", "…pero sin uso para las fichas, Scapegoat espera al ataque directo",
    "E, 19-11: «no espera a que haga un ataque directo o a que destruya la carta»", () => {
  const d = mesa({ mios:{ mt:["Scapegoat"], mano:["Sangan (GOAT)"] }, suyos:{ campo:["Breaker the Magical Warrior"] }, turnPlayer:1, fase:0x200, turno:4 });
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), bien: r => r?.index == null };
});
pos("tempo", "…y con un monstruo colocado no se atasca la mesa con cuatro fichas",
    "E, 19-11: «atasca la mesa… si solo tiene 4 tokens y 1 monstruo set»", () => {
  const d = mesa({ mios:{ mt:["Scapegoat"], campo:[{ carta:"Sangan (GOAT)", pos:P.TAPADA|P.DEF }], mano:["Breaker the Magical Warrior"] },
                   suyos:{ campo:["Blade Knight"] }, turnPlayer:1, fase:0x200, turno:4 });
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), bien: r => r?.index == null };
});
pos("tempo", "…y con un monarca en la mano y sin tributos, sí en la End Phase",
    "control: la End Phase esquiva el «no puedes invocar este turno»", () => {
  const d = mesa({ mios:{ mt:["Scapegoat"], mano:["Zaborg the Thunder Monarch"] }, suyos:{ campo:["Blade Knight"] }, turnPlayer:1, fase:0x200, turno:4 });
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), bien: r => r?.index === 0 };
});

/* ══════════════ 5. A QUÉ APUNTAR PRIMERO ══════════════ */

pos("prioridades", "la remoción va al Jinzo antes que al Airknight",
    "goatformat: los candados primero", () => {
  const d = mesa({ mios:{ mano:["Smashing Ground"] },
                   suyos:{ campo:["Jinzo","Airknight Parshath"] } });
  return { d, q: preguntaObjetivo(d.zones[1][L.MZONE].filter(Boolean)),
           bien: r => r?.indicies?.[0] === 0 };
});

pos("prioridades", "Breaker rompe el Premature Burial, no una tapada cualquiera",
    "log de E, partida 6, turno 12", () => {
  const d = mesa({ mios:{ campo:["Breaker the Magical Warrior"] },
                   suyos:{ mt:[{carta:"Premature Burial", pos:P.ATK},
                               {carta:"Sakuretsu Armor", pos:P.TAPADA}],
                           campo:["Jinzo"] } });
  return { d, q: preguntaObjetivo(d.zones[1][L.SZONE].filter(Boolean)),
           bien: r => r?.indicies?.[0] === 0 };
});

pos("prioridades", "Thousand-Eyes absorbe el mayor, no una tapada",
    "check-cartas: tapado se queda con 0 de ataque", () => {
  const d = mesa({ mios:{ campo:["Thousand-Eyes Restrict"] },
                   suyos:{ campo:[{carta:"Magician of Faith", pos:P.TAPADA},
                                  "Airknight Parshath"] } });
  return { d, q: preguntaObjetivo(d.zones[1][L.MZONE].filter(Boolean)),
           bien: r => r?.indicies?.[0] === 1 };
});

pos("prioridades", "no descarta la carta con la que gana la partida",
    "guías de mazo: las claves no son coste", () => {
  const d = mesa({ mios:{ mano:["Black Luster Soldier - Envoy of the Beginning",
                                "Sinister Serpent"] },
                   mazoMio:["Scapegoat","Metamorphosis","Tsukuyomi","Scapegoat"] });
  return { d, q: { type:MT.SELECT_CARD, player:0, can_cancel:false, min:1, max:1,
                   selects: d.zones[0][L.HAND].map(ref) },
           bien: r => r?.indicies?.[0] === 1 };
});

/* ══════════════ 6. REMATAR ══════════════ */

pos("rematar", "Ring of Destruction remata cuando solo le mata a él",
    "control", () => {
  const d = mesa({ mios:{ mano:["Ring of Destruction"] },
                   suyos:{ campo:["Airknight Parshath"] }, lp:[8000,1500] });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]] }),
           bien: r => r?.action === IA.SELECT_ACTIVATE };
});

pos("rematar", "con el rival a 1200 y un 1900 delante, quita el bloqueador",
    "reporte de E: guardaba la remoción", () => {
  const d = mesa({ mios:{ mano:["Smashing Ground"], campo:["Airknight Parshath"] },
                   suyos:{ campo:["Breaker the Magical Warrior"] }, lp:[8000,1200] });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]] }),
           bien: r => r?.action === IA.SELECT_ACTIVATE };
});

/* ══════════════ 7. LAS QUE NO HE PROGRAMADO ══════════════
   Las de arriba salen de misplays ya arreglados: son una red de
   seguridad, no un examen. Estas son decisiones de Goat sacadas de las
   guías para las que NO hay ningún caso escrito en el cerebro. Aquí es
   donde se ve de verdad si juega o si acierta de memoria. Que fallen
   varias es lo esperado y es el trabajo que queda. */

/* OJO: aquí puse Breaker y la posición estaba mal planteada. Breaker
   rompe una tapada al invocarse, así que contra dos M/T colocadas es
   justo lo que hay que hacer. Con un cuerpo sin efecto sí aplica la
   regla de no sobreextender. */
pos("sin programar", "no invoca en un campo lleno con dos tapadas suyas sin ver Torrential",
    "goatformat: no le regales el Torrential", () => {
  const d = mesa({ mios:{ mano:["Berserk Gorilla"],
                          campo:["Airknight Parshath","Asura Priest"] },
                   suyos:{ mt:[{carta:"Torrential Tribute"},{carta:"Mirror Force"}] } });
  const c = d.zones[0][L.HAND][0];
  return { d, q: preguntaIdle({ invoca:[c], coloca:[c] }),
           bien: r => r?.action !== IA.SELECT_SUMMON };
});

pos("sin programar", "Graceful Charity sin descarte gratis: mejor esperar",
    "goatformat: guárdala para el Sinister Serpent", () => {
  const d = mesa({ mios:{ mano:["Graceful Charity","Airknight Parshath",
                                "Black Luster Soldier - Envoy of the Beginning"] },
                   /* El mazo importa: sin una lista reconocible, el plan es
                      "Beatdown sin piezas" y cavar SÍ es lo correcto. Con un
                      Goat Control de verdad, la guía dice guardarla. */
                   mazoMio:["Scapegoat","Scapegoat","Metamorphosis","Metamorphosis",
                            "Tsukuyomi","Tsukuyomi","Sangan","Magician of Faith"], turno:2 });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]] }),
           bien: r => r?.action !== IA.SELECT_ACTIVATE };
});

pos("sin programar", "Metamorphosis gasta la ficha, no el Airknight",
    "goatformat: la ficha es el combustible", () => {
  const d = mesa({ mios:{ campo:["Airknight Parshath"] },
                   suyos:{ campo:["Jinzo"] } });
  d.zones[0][L.MZONE][1] = { uid:920, code:FICHA, controller:0,
                             location:L.MZONE, sequence:1, position:P.DEF };
  return { d, q: { type:MT.SELECT_CARD, player:0, can_cancel:false, min:1, max:1,
                   selects: d.zones[0][L.MZONE].filter(Boolean).map(ref) },
           bien: r => r?.indicies?.[0] === 1 };
});

pos("sin programar", "Scapegoat en respuesta a un ataque, no solo en la End Phase",
    "goatformat: corta el ataque", () => {
  const d = mesa({ mios:{ mt:["Scapegoat"] },
                   suyos:{ campo:["Airknight Parshath"] }, turnPlayer:1, fase:0x10 });
  const atk = d.zones[1][L.MZONE][0];
  d.atacante = { uid:atk.uid, code:atk.code, controller:1 };
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), bien: r => r?.index === 0 };
});

pos("sin programar", "Book of Moon corta el ataque del monstruo grande",
    "goatformat: su uso principal", () => {
  const d = mesa({ mios:{ mt:["Book of Moon"], campo:["Magician of Faith"] },
                   suyos:{ campo:["Black Luster Soldier - Envoy of the Beginning"] },
                   turnPlayer:1, fase:0x10 });
  const atk = d.zones[1][L.MZONE][0];
  d.atacante = { uid:atk.uid, code:atk.code, controller:1 };
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), bien: r => r?.index === 0 };
});

pos("sin programar", "no ataca con todo teniendo él dos tapadas y yendo por delante",
    "goatformat: no te comas el Mirror Force", () => {
  const d = mesa({ mios:{ campo:["Airknight Parshath","Asura Priest",
                                 "Breaker the Magical Warrior"] },
                   suyos:{ mt:[{carta:"Mirror Force"},{carta:"Sakuretsu Armor"}] },
                   lp:[8000,7000] });
  const r0 = d.zones[0][L.MZONE].filter(Boolean);
  /* 20-09: con el contexto estratégico el primer ataque lo declara el
     cebo (Asura Priest) y no el Airknight: «Lessons of the Game» —cebar
     las trampas con lo barato—. Contra Sakuretsu es mejor; contra Mirror
     Force da igual quién empiece. Las dos cosas valen aquí. */
  return { d, q: preguntaBatalla(r0),
           bien: r => r?.action===BA.SELECT_BATTLE && (r?.index===0 || r?.index===1),
           regular: r => r?.action !== BA.SELECT_BATTLE };
});

pos("sin programar", "Sinister Serpent se queda en la mano, no se coloca",
    "goatformat: vale más en la mano", () => {
  const d = mesa({ mios:{ mano:["Sinister Serpent"] },
                   suyos:{ campo:["Airknight Parshath"] } });
  const c = d.zones[0][L.HAND][0];
  return { d, q: preguntaIdle({ invoca:[c], coloca:[c] }),
           bien: r => r?.action !== IA.SELECT_MONSTER_SET && r?.action !== IA.SELECT_SUMMON };
});

pos("sin programar", "Nobleman of Crossout va a la tapada, no se guarda",
    "goatformat: destierra a los flip", () => {
  const d = mesa({ mios:{ mano:["Nobleman of Crossout"] },
                   suyos:{ campo:[{carta:"Magician of Faith", pos:P.TAPADA}] } });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]] }),
           bien: r => r?.action === IA.SELECT_ACTIVATE };
});

pos("sin programar", "ataca directo con el campo rival vacío",
    "lo más básico", () => {
  const d = mesa({ mios:{ campo:["Airknight Parshath"] }, suyos:{} });
  return { d, q: preguntaBatalla([d.zones[0][L.MZONE][0]]),
           bien: r => r?.action === BA.SELECT_BATTLE };
});

pos("sin programar", "Tsukuyomi tumba al monstruo grande del rival",
    "goatformat: apaga y prepara el Nobleman", () => {
  const d = mesa({ mios:{ mano:["Tsukuyomi"] },
                   suyos:{ campo:["Black Luster Soldier - Envoy of the Beginning"] } });
  const c = d.zones[0][L.HAND][0];
  return { d, q: preguntaIdle({ invoca:[c], coloca:[c] }),
           bien: r => r?.action === IA.SELECT_SUMMON };
});

pos("sin programar", "no tributa el Airknight teniendo una ficha",
    "goatformat: los tributos salen de lo barato", () => {
  const d = mesa({ mios:{ campo:["Airknight Parshath"] } });
  d.zones[0][L.MZONE][1] = { uid:921, code:FICHA, controller:0,
                             location:L.MZONE, sequence:1, position:P.DEF };
  return { d, q: { type:MT.SELECT_TRIBUTE, player:0, can_cancel:false, min:1, max:1,
                   selects: d.zones[0][L.MZONE].filter(Boolean).map(c=>({...ref(c), release_param:1})) },
           bien: r => r?.indicies?.[0] === 1 };
});

pos("sin programar", "Delinquent Duo en el turno 1 con la mano llena",
    "goatformat: el mejor momento es pronto", () => {
  const d = mesa({ mios:{ mano:["Delinquent Duo"] }, suyos:{}, turno:2 });
  d.zones[1][L.HAND] = ["Sangan","Sangan","Sangan","Sangan","Sangan"].map((n,i)=>
    ({ uid:930+i, code:cod(n), controller:1, location:L.HAND, sequence:i, position:1 }));
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]] }),
           bien: r => r?.action === IA.SELECT_ACTIVATE };
});

/* ══════════════ 8. ELEGIR ENTRE VARIAS JUGADAS BUENAS ══════════════
   Aquí es donde las constantes se rompen. Las familias de arriba
   preguntan "¿juego esta carta o no?", y para eso basta un umbral. Estas
   preguntan "¿CUÁL primero?", y para responder hay que poder comparar
   cosas distintas —robar dos cartas contra matarle un 1900— en la misma
   moneda. Es justo lo que no se puede hacer con un número inventado por
   acción, y para lo que existe `valorar.js`. */

pos("elegir la mejor", "Pot of Greed antes de comprometer nada",
    "goatformat: roba primero, decides con más información", () => {
  const d = mesa({ mios:{ mano:["Pot of Greed","Smashing Ground"],
                          campo:["Airknight Parshath"] },
                   suyos:{ campo:["Breaker the Magical Warrior"] },
                   mazoMio:["Scapegoat","Metamorphosis","Tsukuyomi","Scapegoat","Sangan"] });
  const [pot, smash] = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ activa:[pot, smash] }),
           bien: r => r?.action===IA.SELECT_ACTIVATE && r?.index===0,
           regular: r => r?.action===IA.SELECT_ACTIVATE };
});

pos("elegir la mejor", "Snatch Steal antes que Smashing Ground sobre el mismo gordo",
    "robar es +1, destruir es 1-por-1", () => {
  const d = mesa({ mios:{ mano:["Smashing Ground","Snatch Steal"] },
                   suyos:{ campo:["Black Luster Soldier - Envoy of the Beginning"] } });
  const [smash, snatch] = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ activa:[smash, snatch] }),
           bien: r => r?.action===IA.SELECT_ACTIVATE && r?.index===1,
           regular: r => r?.action===IA.SELECT_ACTIVATE };
});

pos("elegir la mejor", "Heavy Storm antes de invocar, no después",
    "goatformat: limpia el Torrential primero", () => {
  const d = mesa({ mios:{ mano:["Heavy Storm","Berserk Gorilla"] },
                   suyos:{ mt:["Torrential Tribute","Mirror Force","Sakuretsu Armor"] } });
  const [storm, gorila] = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ activa:[storm], invoca:[gorila], coloca:[gorila] }),
           bien: r => r?.action===IA.SELECT_ACTIVATE };
});

pos("elegir la mejor", "con el rival a 1000 y campo vacío, a la batalla",
    "no hay nada que preparar: se acaba ya", () => {
  const d = mesa({ mios:{ mano:["Pot of Greed"], campo:["Airknight Parshath"] },
                   suyos:{}, lp:[8000,1000],
                   mazoMio:["Scapegoat","Metamorphosis","Tsukuyomi"] });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]] }),
           bien: r => r?.action===IA.TO_BP,
           regular: r => r?.action===IA.SELECT_ACTIVATE };
});

pos("elegir la mejor", "quitar el monstruo grande antes que el pequeño",
    "la remoción va a lo que más duele", () => {
  const d = mesa({ mios:{ mano:["Smashing Ground"] },
                   suyos:{ campo:["Sinister Serpent",
                                  "Black Luster Soldier - Envoy of the Beginning"] } });
  return { d, q: preguntaObjetivo(d.zones[1][L.MZONE].filter(Boolean)),
           bien: r => r?.indicies?.[0] === 1 };
});

pos("elegir la mejor", "Delinquent Duo antes que Graceful sin descarte",
    "goatformat: Duo pronto, Graceful cuando haya con qué", () => {
  const d = mesa({ mios:{ mano:["Delinquent Duo","Graceful Charity",
                                "Airknight Parshath","Breaker the Magical Warrior"] },
                   suyos:{}, turno:2,
                   mazoMio:["Scapegoat","Scapegoat","Metamorphosis","Metamorphosis",
                            "Tsukuyomi","Tsukuyomi","Sangan","Magician of Faith"] });
  d.zones[1][L.HAND] = ["Sangan","Sangan","Sangan","Sangan","Sangan"].map((n,i)=>
    ({ uid:940+i, code:cod(n), controller:1, location:L.HAND, sequence:i, position:1 }));
  const [duo, graceful] = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ activa:[duo, graceful] }),
           bien: r => r?.action===IA.SELECT_ACTIVATE && r?.index===0 };
});

pos("elegir la mejor", "no cambia un Black Luster por un 1900",
    "guías: las piezas de victoria no se cambian", () => {
  const d = mesa({ mios:{ campo:["Black Luster Soldier - Envoy of the Beginning"] },
                   suyos:{ campo:["Airknight Parshath"] },
                   mazoMio:["Scapegoat","Scapegoat","Metamorphosis","Metamorphosis",
                            "Tsukuyomi","Tsukuyomi"] });
  /* 3000 contra 1900: le gana. Debe atacar. El control es que la regla de
     "no cambies tus piezas" no se pase de frenada. */
  return { d, q: preguntaBatalla([d.zones[0][L.MZONE][0]]),
           bien: r => r?.action === BA.SELECT_BATTLE };
});

pos("elegir la mejor", "prefiere el objetivo que le deja sin plan",
    "goatformat: los candados primero", () => {
  const d = mesa({ mios:{ mano:["Mystical Space Typhoon"] },
                   suyos:{ mt:[{carta:"Sakuretsu Armor", pos:P.ATK},
                               {carta:"Snatch Steal", pos:P.ATK}] } });
  return { d, q: preguntaObjetivo(d.zones[1][L.SZONE].filter(Boolean)),
           bien: r => r?.indicies?.[0] === 1 };
});

/* ══════════════ 9. LAS NUEVE PARTIDAS DEL 15 DE AGOSTO ══════════════
   Cada una es un misplay que E describió jugando, con la jugada que él
   habría hecho. Son las más valiosas del banco: vienen con la alternativa
   correcta, no solo con "esto está mal". */

pos("partidas del 15", "un monstruo robado tiene que atacar: al acabar el turno se va",
    "partida 1, turnos 5 y 8", () => {
  /* Mind Control roba hasta la End Phase. Si no lo usas, se lo devuelves
     intacto: hay que meterlo en combate aunque muera. */
  const d = mesa({ mios:{ campo:["Thunder Dragon"] },
                   suyos:{ campo:["Breaker the Magical Warrior"] },
                   mazoMio:["Scapegoat","Metamorphosis","Tsukuyomi"] });
  d.decklist = { 0:[cod("Scapegoat"),cod("Metamorphosis")], 1:[cod("Thunder Dragon")] };
  return { d, q: preguntaBatalla([d.zones[0][L.MZONE][0]]),
           bien: r => r?.action === BA.SELECT_BATTLE };
});

pos("partidas del 15", "Thousand-Eyes Restrict sin nada boca arriba que absorber",
    "partidas 2 y 8: se activaba con un 3.0 fijo", () => {
  const d = mesa({ mios:{ campo:["Thousand-Eyes Restrict"] },
                   suyos:{ campo:[{carta:"Magician of Faith", pos:P.TAPADA}] } });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.MZONE][0]] }),
           bien: r => r?.action !== IA.SELECT_ACTIVATE };
});

pos("partidas del 15", "…pero con un monstruo grande boca arriba, sí",
    "control", () => {
  const d = mesa({ mios:{ campo:["Thousand-Eyes Restrict"] },
                   suyos:{ campo:["Black Luster Soldier - Envoy of the Beginning"] } });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.MZONE][0]] }),
           bien: r => r?.action === IA.SELECT_ACTIVATE };
});

pos("partidas del 15", "Dust Tornado sobre una mágica que ya se está resolviendo",
    "partidas 6 y 8: destruirla no la niega", () => {
  const d = mesa({ mios:{ mt:["Dust Tornado"] },
                   suyos:{ mt:[{carta:"Nobleman of Crossout", pos:P.ATK}] },
                   turnPlayer:1 });
  d.cadena = [{ code:cod("Nobleman of Crossout"), controller:1, uid:998 }];
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]),
           bien: r => r?.index == null };
});

pos("partidas del 15", "…pero sobre una Snatch Steal ya puesta, sí",
    "control: ahí sí quita algo", () => {
  const d = mesa({ mios:{ mt:["Dust Tornado"] },
                   suyos:{ mt:[{carta:"Snatch Steal", pos:P.ATK}] },
                   turnPlayer:1 });
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]),
           bien: r => r?.index === 0 };
});

pos("partidas del 15", "no activa un segundo Wall of Revealing Light",
    "partida 9, turno 10: una basta y cuesta 1000 más", () => {
  const d = mesa({ mios:{ mano:["Wall of Revealing Light"],
                          mt:[{carta:"Wall of Revealing Light", pos:P.ATK}] },
                   suyos:{ campo:["Airknight Parshath"] }, lp:[5000,8000] });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]],
                                colocaMT:[d.zones[0][L.HAND][0]] }),
           bien: r => r?.action !== IA.SELECT_ACTIVATE };
});

pos("partidas del 15", "Spirit Reaper va en defensa, no en ataque",
    "partida 4: en ataque le regalas daño gratis", () => {
  const d = mesa({ mios:{ campo:[{carta:"Spirit Reaper", pos:P.ATK}] },
                   suyos:{ campo:["Airknight Parshath"] } });
  return { d, q: preguntaIdle({ giros:[d.zones[0][L.MZONE][0]] }),
           bien: r => r?.action === IA.SELECT_POS_CHANGE };
});

pos("partidas del 15", "ataca con lo que le gana a lo que ya ha visto",
    "partida 5, turnos 7 y 10: no atacó con Wicked Worm Beast", () => {
  const d = mesa({ mios:{ campo:["The Wicked Worm Beast"] },
                   suyos:{ campo:[{carta:"Magician of Faith", pos:P.ATK}] } });
  return { d, q: preguntaBatalla([d.zones[0][L.MZONE][0]]),
           bien: r => r?.action === BA.SELECT_BATTLE };
});

pos("partidas del 15", "Ring of Destruction se guarda si no hace falta ya",
    "partida 7, turno 7: iba por delante y la gastó", () => {
  const d = mesa({ mios:{ mano:["Ring of Destruction"],
                          campo:["Airknight Parshath","Asura Priest"] },
                   suyos:{ campo:["Magician of Faith"] }, lp:[8000,8000] });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]] }),
           bien: r => r?.action !== IA.SELECT_ACTIVATE };
});

pos("partidas del 15", "Book of Moon no se gasta en un monstruo pequeño",
    "partida 9, turnos 13 y 23", () => {
  const d = mesa({ mios:{ mt:["Book of Moon"], campo:["Airknight Parshath"] },
                   suyos:{ campo:["Sinister Serpent"] }, turnPlayer:1, fase:0x10 });
  const atk = d.zones[1][L.MZONE][0];
  d.atacante = { uid:atk.uid, code:atk.code, controller:1 };
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]),
           bien: r => r?.index == null };
});

/* ══════════════ 10. LAS DIEZ PARTIDAS DEL 18 DE AGOSTO ══════════════
   Diez logs seguidos con sus turnos señalados. No son quince casos
   sueltos: son SIETE sistemas, y cada posición de aquí abajo dice a cuál
   pertenece. Si mañana alguien toca uno, esto dice cuál se rompió.
   ═══════════════════════════════════════════════════════════════════ */

/* ── A · EL EVALUADOR DE POSICIÓN ──
   Cinco reportes distintos, una sola causa: para agacharse se exigía
   `def > atk`, y Sangan es 1000/600. */
/* ══ UNA JUGADA DOMINADA NO DEPENDE DEL ESTILO DEL MAZO ══
   E, log 19-46-02 T4: «invoca en ataque contra mi monstruo de 3000».
   Archfiend Soldier de 1900 puesto de frente delante de un Black Luster
   Soldier: no puede atacar, muere seguro y encima regala 1.100 de daño.
   El freno existía pero lo escalaba `agresivo` y se quedaba en nada.
   Aquí no hay nada que sopesar: colocarlo es el mismo cuerpo sin regalar
   nada. */
/* ══ EL COSTE DE UN EFECTO SE PAGA CON LO QUE GANA ══
   E, log 20-56-49, turnos 12 y 16: el bot invocó un Cannon Soldier y se
   tributó a SÍ MISMO por 500 de daño. Las dos veces. `lectura.js` cobra
   1.0 por cualquier "Tribute" mire lo que mire el tablero, así que dar
   una ficha de Scapegoat y dar el 1400 que acabas de invocar valían
   igual — y quedarte sin la máquina de quemar, también.
   Van las TRES: el caso que falla, la jugada BUENA del formato (fichas
   de Scapegoat, que es para lo que se juega la carta) y el letal, que
   manda por encima de todo lo demás. Sin las dos últimas, "no actives
   nunca Cannon Soldier" pasaría el test igual de bien. */
pos("prioridades", "no se tributa a sí mismo por 500 de daño",
    "reporte de E, log 20-56-49 T12 y T16", () => {
  const d = mesa({ mios:{ campo:["Cannon Soldier"] }, lp:[8000,8000] });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.MZONE][0]] }),
           bien: r => r?.action !== IA.SELECT_ACTIVATE };
});

pos("prioridades", "…pero con una ficha que gastar y el rival a 1200, sí quema",
    "Cannon Soldier + Scapegoat es LA jugada de la carta cuando acorta la partida",
    () => {
  /* Con el rival a 8.000 esto NO es jugada y el contraejemplo estaba mal
     planteado: 500 sobre 8.000 es un 6% y la ficha vale más bloqueando.
     A 1.200 la cuenta cambia sola, que es justo lo que se quería: que la
     decisión salga de los números y no de una constante. */
  const d = mesa({ mios:{ campo:["Cannon Soldier"] }, lp:[8000,1200] });
  /* La ficha se pone a mano: `mesa` monta cartas del pool y una ficha de
     Scapegoat no lo es (mismo patrón que las posiciones de "no
     malgastar"). */
  d.zones[0][L.MZONE][1] = { uid:910, code:FICHA, controller:0,
                             location:L.MZONE, sequence:1, position:P.DEF };
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.MZONE][0]] }),
           bien: r => r?.action === IA.SELECT_ACTIVATE };
});

pos("rematar", "y si los 500 matan, se tributa a sí mismo sin dudarlo",
    "el coste deja de importar cuando cierra la partida", () => {
  const d = mesa({ mios:{ campo:["Cannon Soldier"] }, lp:[8000,400] });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.MZONE][0]] }),
           bien: r => r?.action === IA.SELECT_ACTIVATE };
});

pos("posición", "no invoca de frente contra algo que le gana seguro",
    "reporte de E, log 19-46-02 T4: 1900 delante de un 3000", () => {
  const d = mesa({ mios:{ mano:["Archfiend Soldier"] },
                   suyos:{ campo:["Black Luster Soldier - Envoy of the Beginning"] } });
  const c = d.zones[0][L.HAND][0];
  return { d, q: preguntaIdle({ invoca:[c], coloca:[c] }),
           bien: r => r?.action === IA.SELECT_MONSTER_SET };
});

/* ══ LEVANTARSE PARA LLEVARSE UN COMBATE ══
   E, log 19-14-58 T16: «podría haber atacado al pájaro, sabía que solo
   tenía 1000 de defensa». El bot tenía una Lady Ninja Yae (1100/200)
   AGACHADA y enfrente un Sonic Bird en defensa con 1000: levantarla y
   atacar era una carta gratis. Como E pegaba más fuerte que 1100,
   saltaba `posicionSegura` y se quedaba abajo — con la Battle Phase
   vacía, `attacks: []` en el log.
   El contraejemplo va debajo: sin nada que matar, el veto tiene razón. */
pos("posición", "se levanta si al levantarse se lleva un combate",
    "reporte de E, log 19-14-58 T16", () => {
  const d = mesa({ mios:{ campo:[{carta:"Lady Ninja Yae", pos:P.DEF}] },
                   suyos:{ campo:[{carta:"Sonic Bird (GOAT)", pos:P.DEF},
                                  {carta:"Airknight Parshath", pos:P.ATK}] } });
  return { d, q: preguntaIdle({ giros:[d.zones[0][L.MZONE][0]], bp:true }),
           bien: r => r?.action === IA.SELECT_POS_CHANGE };
});

pos("posición", "…pero no se levanta solo para que se la coman",
    "sin combate que ganar, el veto de posicionSegura tiene razón", () => {
  const d = mesa({ mios:{ campo:[{carta:"Lady Ninja Yae", pos:P.DEF}] },
                   suyos:{ campo:[{carta:"Airknight Parshath", pos:P.ATK}] } });
  return { d, q: preguntaIdle({ giros:[d.zones[0][L.MZONE][0]], bp:true }),
           bien: r => r?.action !== IA.SELECT_POS_CHANGE };
});

/* ══ EL QUE SE AGACHA ES EL QUE MENOS PIERDE AGACHÁNDOSE ══
   E lo describió con el Goblin Attack Force: 2300 de ataque y 0 de
   defensa, o sea que agachado se muere contra cualquier cosa y encima
   renuncias a sus 2300. Si hay otro monstruo que en defensa AGUANTA, es
   ese el que tiene que girar.
   AVISO: no he encontrado esta jugada en ninguno de los logs —el Goblin
   solo sale en el lote del 18 y nunca se gira—, así que la posición
   viene de la regla, no de una partida. */
pos("posición", "gira el que aguanta agachado, no el de 0 de defensa",
    "descrito por E; el Goblin es 2300/0 y la Spy 1200/2000", () => {
  const d = mesa({ mios:{ campo:[{carta:"Goblin Attack Force", pos:P.ATK},
                                 {carta:"Gravekeeper's Spy (GOAT)", pos:P.ATK}] },
                   suyos:{ campo:[{carta:"Airknight Parshath", pos:P.ATK}] } });
  const goblin = d.zones[0][L.MZONE][0], spy = d.zones[0][L.MZONE][1];
  return { d, q: preguntaIdle({ giros:[goblin, spy], bp:false }),
           bien: r => r?.action === IA.SELECT_POS_CHANGE && r?.index === 1 };
});

pos("posición", "Sangan de frente contra La Jinn: se agacha",
    "log 18-35-22, turno 5", () => {
  const d = mesa({ mios:{ campo:[{carta:"Sangan (GOAT)", pos:P.ATK}] },
                   suyos:{ campo:[{carta:"La Jinn the Mystical Genie of the Lamp", pos:P.ATK}] } });
  return { d, q: preguntaIdle({ giros:[d.zones[0][L.MZONE][0]], bp:false }),
           bien: r => r?.action === IA.SELECT_POS_CHANGE };
});

pos("posición", "Spirit Reaper no se queda en ataque cobrando daño",
    "log 19-30-16, turnos 1 y 5", () => {
  const d = mesa({ mios:{ campo:[{carta:"Spirit Reaper (GOAT)", pos:P.ATK}] },
                   suyos:{ campo:[{carta:"Luster Dragon", pos:P.ATK}] } });
  return { d, q: preguntaIdle({ giros:[d.zones[0][L.MZONE][0]], bp:false }),
           bien: r => r?.action === IA.SELECT_POS_CHANGE };
});

pos("posición", "Gearfried delante de un 3000: a defensa",
    "nota de E sin log", () => {
  const d = mesa({ mios:{ campo:[{carta:"Gearfried the Iron Knight (GOAT)", pos:P.ATK}] },
                   suyos:{ campo:[{carta:"Blue-Eyes White Dragon", pos:P.ATK}] } });
  return { d, q: preguntaIdle({ giros:[d.zones[0][L.MZONE][0]], bp:false }),
           bien: r => r?.action === IA.SELECT_POS_CHANGE };
});

/* Y su contraejemplo: un veto sin contraejemplo acaba en una IA que se
   pasa la partida agachada. Si gana el combate, se queda de frente. */
pos("posición", "pero si gana el combate se queda de frente",
    "control del caso anterior", () => {
  const d = mesa({ mios:{ campo:[{carta:"Luster Dragon", pos:P.ATK}] },
                   suyos:{ campo:[{carta:"Sangan (GOAT)", pos:P.ATK}] } });
  return { d, q: preguntaIdle({ giros:[d.zones[0][L.MZONE][0]], bp:false }),
           bien: r => r?.action !== IA.SELECT_POS_CHANGE };
});

/* ── B · CARTAS QUE QUIEREN ENTRAR BOCA ABAJO ── */
pos("posición", "Man-Eater Bug se coloca, no se invoca de frente",
    "log 18-35-22, turno 16", () => {
  const d = mesa({ mios:{ mano:["Man-Eater Bug"] },
                   suyos:{ campo:[{carta:"Luster Dragon", pos:P.ATK}] } });
  const c = d.zones[0][L.HAND][0];
  return { d, q: preguntaIdle({ invoca:[c], coloca:[c] }),
           bien: r => r?.action === IA.SELECT_MONSTER_SET };
});

pos("posición", "Black Dragon's Chick tampoco entra de frente",
    "log 21-12-59, turno 5", () => {
  const d = mesa({ mios:{ mano:["Black Dragon's Chick"] },
                   suyos:{ campo:[{carta:"Luster Dragon", pos:P.ATK}] } });
  const c = d.zones[0][L.HAND][0];
  return { d, q: preguntaIdle({ invoca:[c], coloca:[c] }),
           bien: r => r?.action === IA.SELECT_MONSTER_SET };
});

/* ── C · REACTIVAS CON CONDICIÓN, NO CON VENTANA ── */
pos("no malgastar", "Waboku no se activa en tu propia Main Phase",
    "logs 18-20-40 T6 y 21-12-59 T21", () => {
  const d = mesa({ mios:{ mt:[{carta:"Waboku", pos:P.TAPADA}],
                          campo:[{carta:"Axe Raider", pos:P.ATK}] },
                   suyos:{ campo:[{carta:"Luster Dragon", pos:P.ATK}] },
                   turnPlayer:0 });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.SZONE][0]] }),
           bien: r => r?.action !== IA.SELECT_ACTIVATE };
});

/* E, 17-09: «hizo Book of Moon a su propio bicho». Con el rival solo con
   fichas de Scapegoat boca arriba, Book of Moon no tiene objetivo suyo
   (una ficha no se puede tapar) y el único legal es un monstruo propio. */
pos("no dispararse en el pie", "Book of Moon con el rival solo con ovejas",
    "E, 2026-09-17", () => {
  const d = mesa({ mios:{ mt:[{carta:"Book of Moon", pos:P.TAPADA}], campo:["Breaker the Magical Warrior"] },
                   suyos:{ campo:["Sheep Token","Sheep Token","Sheep Token"] }, turnPlayer:1, fase:0x1 });
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), bien: r => r?.index == null };
});

pos("no dispararse en el pie", "Ring of Destruction con todo lo suyo tapado",
    "auditor 2026-09-17: el único objetivo era propio", () => {
  const d = mesa({ mios:{ mano:["Ring of Destruction"], campo:["Magical Merchant","Tribe-Infecting Virus"] },
                   suyos:{ campo:[{carta:"Airknight Parshath", pos:P.TAPADA}] } });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]] }), bien: r => r?.action !== IA.SELECT_ACTIVATE };
});

/* E, primer turno de prueba del 16-09: el bot jugó DOS Waboku en el mismo
   turno. El efecto dura todo el turno; la segunda es una carta tirada. */
pos("no malgastar", "segunda Waboku en el mismo turno, no",
    "E, prueba del 2026-09-16", () => {
  const d = mesa({ mios:{ mt:[{carta:"Waboku", pos:P.TAPADA},{carta:"Waboku", pos:P.TAPADA}],
                          campo:[{carta:"Sangan", pos:P.ATK}] },
                   suyos:{ campo:[{carta:"Luster Dragon", pos:P.ATK},{carta:"Airknight Parshath", pos:P.ATK}] },
                   turnPlayer:1, fase:0x10, lp:[1500,8000] });
  const [a1, a2] = d.zones[1][L.MZONE];
  const [w1, w2] = d.zones[0][L.SZONE];
  return { d,
    previo: cerebro => {
      d.atacante = { uid:a1.uid, code:a1.code, controller:1 };
      const r1 = cerebro(preguntaCadena([w1, w2]), 0);
      if(r1?.index == null) throw new Error("la primera Waboku tampoco se activó: la posición no mide lo que dice");
      d.zones[0][L.SZONE][0] = null;                      // la primera ya resolvió
      d.atacante = { uid:a2.uid, code:a2.code, controller:1 };
    },
    q: preguntaCadena([w2]),
    bien: r => r?.index == null };
});

pos("no malgastar", "Just Desserts por 500 puntos se guarda",
    "log 18-20-40, turno 3", () => {
  const d = mesa({ mios:{ mt:[{carta:"Just Desserts", pos:P.TAPADA}] },
                   suyos:{ campo:[{carta:"Luster Dragon", pos:P.ATK}] },
                   turnPlayer:1, lp:[8000,8000] });
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]),
           bien: r => r?.index == null };
});

pos("rematar", "pero Just Desserts que MATA se activa",
    "contraejemplo del anterior", () => {
  const d = mesa({ mios:{ mt:[{carta:"Just Desserts", pos:P.TAPADA}] },
                   suyos:{ campo:[{carta:"Luster Dragon", pos:P.ATK},
                                  {carta:"Battle Ox", pos:P.ATK},
                                  {carta:"Axe Raider", pos:P.ATK}] },
                   turnPlayer:1, lp:[8000,1200] });
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]),
           bien: r => r?.index != null };
});

/* ── D · UNA MÁGICA NORMAL NO SE COLOCA SI SE PUEDE JUGAR ── */
pos("no malgastar", "Reinforcement of the Army se juega, no se coloca",
    "log 21-12-59, turno 1", () => {
  /* Con un monstruo que invocar: sin invocación disponible, guardarlo es
     lo que hacen los pros (examen 14-11, `buscadorGuarda`). */
  const d = mesa({ mios:{ mano:["Reinforcement of the Army (GOAT)", "Blade Knight"] } });
  /* OJO: un buscador con el mazo VACÍO no consigue nada, y la IA hace
     bien en no jugarlo. `mesa` no monta el mazo, así que hay que llenarlo
     a mano o el test mide lo contrario de lo que cree medir. */
  d.zones[0][L.DECK].push({ code:cod("Axe Raider"), uid:900, controller:0,
                            location:L.DECK, sequence:0, position:P.TAPADA });
  d.zones[0][L.DECK].push({ code:cod("Battle Ox"), uid:901, controller:0,
                            location:L.DECK, sequence:1, position:P.TAPADA });
  const c = d.zones[0][L.HAND][0], spy = d.zones[0][L.HAND][1];
  return { d, q: preguntaIdle({ activa:[c], colocaMT:[c], coloca:[spy], invoca:[spy] }),
           bien: r => r?.action === IA.SELECT_ACTIVATE,
           regular: r => r?.action !== IA.SELECT_SPELL_SET };
});

/* ── E · EL TRIBUTO TIENE QUE SALIR A CUENTA ── */
pos("tempo", "no tributar Dark Magician por algo peor",
    "log 19-59-23, turno 13", () => {
  const d = mesa({ mios:{ campo:[{carta:"Dark Magician", pos:P.ATK}],
                          mano:["Summoned Skull"] },
                   suyos:{} });
  const c = d.zones[0][L.HAND][0];
  return { d, q: preguntaIdle({ invoca:[c] }),
           /* Summoned Skull (2500) por Dark Magician (2500) no gana nada
              y encima pierde un cuerpo: cualquier cosa menos invocar. */
           bien: r => r?.action !== IA.SELECT_SUMMON };
});

pos("tempo", "atacar con Goblin Attack Force antes de tributarlo",
    "log 21-12-59, turno 3", () => {
  const d = mesa({ mios:{ campo:[{carta:"Goblin Attack Force", pos:P.ATK}],
                          mano:["Summoned Skull"] },
                   suyos:{} });
  const c = d.zones[0][L.HAND][0];
  return { d, q: preguntaIdle({ invoca:[c], bp:true }),
           /* Con el campo rival vacío, el Goblin de 2300 pega directo: se
              ataca primero y se tributa en la Main Phase 2. */
           bien: r => r?.action !== IA.SELECT_SUMMON };
});

/* ── F · LO QUE YA HE VISTO, LO RECUERDO ──
   Los dos casos opuestos, que es lo que los hace una pareja: la memoria
   tiene que servir para NO atacar y para SÍ atacar. */
pos("combate", "no atacar una defensa que sé que no puedo romper",
    "log 20-08-11, turno 14", () => {
  const d = mesa({ mios:{ campo:[{carta:"Axe Raider", pos:P.ATK}] },
                   suyos:{ campo:[{carta:"Giant Soldier of Stone", pos:P.DEF}] } });
  /* Se ve boca arriba una vez —así entra en la memoria— y luego se tapa. */
  const cerebroPrevio = pensar(d);
  cerebroPrevio(preguntaIdle({}), 0);
  d.zones[1][L.MZONE][0].position = P.TAPADA;
  return { d, q: preguntaBatalla([d.zones[0][L.MZONE][0]]),
           bien: r => r?.action !== BA.SELECT_BATTLE };
});

pos("combate", "y sí atacar una defensa que sé que sí puedo romper",
    "log 20-13-52, turno 10", () => {
  const d = mesa({ mios:{ campo:[{carta:"Summoned Skull", pos:P.ATK}] },
                   suyos:{ campo:[{carta:"Sangan (GOAT)", pos:P.DEF}] } });
  const cerebroPrevio = pensar(d);
  cerebroPrevio(preguntaIdle({}), 0);
  d.zones[1][L.MZONE][0].position = P.TAPADA;
  return { d, q: preguntaBatalla([d.zones[0][L.MZONE][0]]),
           bien: r => r?.action === BA.SELECT_BATTLE };
});

/* ── G · ¿PUEDO GANAR ESTE TURNO? ── */
pos("rematar", "con el campo rival vacío y daño de sobra, ataca con todo",
    "log 20-08-11, turno 10", () => {
  const d = mesa({ mios:{ campo:[{carta:"Axe Raider", pos:P.ATK},
                                 {carta:"Battle Ox", pos:P.ATK}] },
                   suyos:{}, lp:[8000, 2000] });
  return { d, q: preguntaBatalla([d.zones[0][L.MZONE][0], d.zones[0][L.MZONE][1]]),
           bien: r => r?.action === BA.SELECT_BATTLE };
});

/* ── B · ATACAR HACIA ARRIBA CUANDO EL EFECTO LO PAGA ── */
pos("combate", "Hyper Hammerhead ataca hacia arriba para rebotar la amenaza",
    "log 19-33-51, turno 5", () => {
  const d = mesa({ mios:{ campo:[{carta:"Hyper Hammerhead", pos:P.ATK}] },
                   suyos:{ campo:[{carta:"Blue-Eyes White Dragon", pos:P.ATK}] },
                   lp:[8000,8000] });
  return { d, q: preguntaBatalla([d.zones[0][L.MZONE][0]]),
           bien: r => r?.action === BA.SELECT_BATTLE };
});

pos("combate", "pero no se suicida si el rebote no compensa",
    "contraejemplo del anterior", () => {
  const d = mesa({ mios:{ campo:[{carta:"Hyper Hammerhead", pos:P.ATK}] },
                   suyos:{ campo:[{carta:"Blue-Eyes White Dragon", pos:P.ATK}] },
                   lp:[900,8000] });
  return { d, q: preguntaBatalla([d.zones[0][L.MZONE][0]]),
           bien: r => r?.action !== BA.SELECT_BATTLE };
});

/* ══════════════════════════════════════════════════════════════════
   EL PRIMER BO3 DE E (torneo, 18-09) · Zombie contra Monarch

   Cuatro de las jugadas que apuntó, una posición cada una. No salen de
   una regla bonita: salen de lo que vio en la mesa.
   ══════════════════════════════════════════════════════════════════ */

/* «turno 14 magician of faith en atk es raro». Buscado en el banco: el
   bot NO lo invoca de frente en ninguna posición que se le monte —eso ya
   estaba bien—, así que la carta llegó ahí REVIVIDA, que es lo que pasa
   justo en la nota de al lado. Un volteo sacado del cementerio entra
   boca arriba: no voltea nada y es un cuerpo de 300.
   (El freno de invocar volteos de frente también se ha reforzado en
   `brain.js`, pero no se le pone posición porque no he conseguido
   reproducir el fallo: sería una comprobación que aprueba sola.) */
pos("elegir la mejor", "no revive el volteo: fuera del cementerio no voltea nada",
    "notas de E, Bo3 1 partida 2 T14: Magician of Faith en ataque", () => {
  const d = mesa({ mios:{ mt:[{carta:"Premature Burial", pos:P.ATK}],
                          gy:["Magician of Faith","Nimble Momonga (GOAT)"] } });
  const gy = d.zones[0][L.GRAVE];
  return { d, q: preguntaObjetivo([gy[0], gy[1]]),
           bien: r => r?.type === R.SELECT_CARD && r?.indicies?.[0] === 1 };
});

/* «premature burial a monstruo pequeño, encima a serpent, que vuelve a
   la mano ella sola». Ochocientos LP y la carta entera por un cuerpo de
   300 que iba a volver gratis a la mano en la Standby. En el cementerio
   había un Airknight. */
pos("elegir la mejor", "reanima el que pega, no el que vale por estar en la mano",
    "notas de E, Bo3 1 partida 2: Premature Burial sobre el Sinister Serpent", () => {
  const d = mesa({ mios:{ mt:[{carta:"Premature Burial", pos:P.ATK}],
                          gy:["Sinister Serpent","Nimble Momonga (GOAT)"] } });
  const gy = d.zones[0][L.GRAVE];
  return { d, q: preguntaObjetivo([gy[0], gy[1]]),
           bien: r => r?.type === R.SELECT_CARD && r?.indicies?.[0] === 1 };
});

/* «la invocación de Thousand-Eyes Restrict sin nada en mi campo es algo
   extraña». El TER no puede atacar y además impide atacar al resto: con
   el campo rival vacío la jugada solo cierra el campo propio.
   La ficha se monta con `atkReal:0` porque el banco no tiene fichas de
   Scapegoat; lo que importa es que el material sea gratis. */
pos("no malgastar", "no hace el Thousand-Eyes si no hay nada que absorber",
    "notas de E, Bo3 1 partida 2: TER con mi campo vacío", () => {
  const d = mesa({ mios:{ mt:["Metamorphosis"],
                          campo:[{carta:"Sangan", pos:P.DEF, atkReal:0, defReal:0}],
                          extra:["Thousand-Eyes Restrict"] } });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.SZONE][0]] }),
           bien: r => r?.action !== IA.SELECT_ACTIVATE };
});

pos("no malgastar", "…pero sí en cuanto hay algo boca arriba que absorber",
    "contraejemplo del anterior: es LA jugada del formato", () => {
  const d = mesa({ mios:{ mt:["Metamorphosis"],
                          campo:[{carta:"Sangan", pos:P.DEF, atkReal:0, defReal:0}],
                          extra:["Thousand-Eyes Restrict"] },
                   suyos:{ campo:[{carta:"Airknight Parshath", pos:P.ATK}] } });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.SZONE][0]] }),
           bien: r => r?.action === IA.SELECT_ACTIVATE };
});

/* «invocar un flip monster en atk y atacar sabiendo el efecto de
   Injection Fairy Lily creo que es misplay». Lily tiene 400 impresos y
   pega con 3400 pagando 2000 LP. Atacarla con un 1900 es regalar el
   monstruo. */
pos("combate", "no le ataca a la Injection Fairy Lily pudiendo ella pagar",
    "notas de E, Bo3 1 partida 3 T11", () => {
  const d = mesa({ mios:{ campo:[{carta:"Archfiend Soldier", pos:P.ATK}] },
                   suyos:{ campo:[{carta:"Injection Fairy Lily (GOAT)", pos:P.ATK}] },
                   lp:[8000,8000] });
  return { d, q: preguntaBatalla([d.zones[0][L.MZONE][0]]),
           bien: r => r?.action !== BA.SELECT_BATTLE };
});

pos("combate", "…pero sí cuando no le llegan los 2000 para pagar",
    "contraejemplo: con 1900 LP la Lily es lo que pone", () => {
  const d = mesa({ mios:{ campo:[{carta:"Archfiend Soldier", pos:P.ATK}] },
                   suyos:{ campo:[{carta:"Injection Fairy Lily (GOAT)", pos:P.ATK}] },
                   lp:[8000,1900] });
  return { d, q: preguntaBatalla([d.zones[0][L.MZONE][0]]),
           bien: r => r?.action === BA.SELECT_BATTLE };
});

/* ══════════════════════════════════════════════════════════════════
   EL SEGUNDO BO3 DE E (torneo 2, 18-09)
   ══════════════════════════════════════════════════════════════════ */

/* «turno 4 book of moon gastado para nada. puedo voltear de nuevo. lo
   mismo en turno 8». Lo encadenaba en la DRAW PHASE del rival contra el
   monstruo más grande del campo: girarlo ahí no cuesta nada, se vuelve a
   voltear en la Main Phase y ataca igual. */
pos("no malgastar", "no quema el Book of Moon en la Draw Phase del rival",
    "notas de E, torneo 2 ronda 1 partida 1 T4 y T8", () => {
  const d = mesa({ mios:{ mt:[{carta:"Book of Moon", pos:P.TAPADA}] },
                   suyos:{ campo:[{carta:"Ryu Kokki", pos:P.ATK}] },
                   turnPlayer:1, fase:0x1 });
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]),
           bien: r => r?.index == null };
});

pos("no malgastar", "…pero sí contra un ataque declarado",
    "contraejemplo: ahí el ataque se cae y el monstruo se queda tumbado", () => {
  const d = mesa({ mios:{ mt:[{carta:"Book of Moon", pos:P.TAPADA}],
                          campo:[{carta:"Magician of Faith", pos:P.DEF}] },
                   suyos:{ campo:[{carta:"Ryu Kokki", pos:P.ATK}] },
                   turnPlayer:1, fase:0x8 });
  d.atacante = d.zones[1][L.MZONE][0];
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]),
           bien: r => r?.index === 0 };
});

/* «turno 9 sinister serpent en atk? por que». Porque el freno solo valía
   cuando no podía atacar, y con el campo rival vacío sí podía: gastaba la
   invocación del turno para hacer 300 de daño con la carta cuyo valor es
   estar en la mano. */
pos("no malgastar", "no invoca el Sinister Serpent para pegar 300",
    "notas de E, torneo 1 (18-09) partida 1 T9", () => {
  const d = mesa({ mios:{ mano:["Sinister Serpent"] }, lp:[8000,8000] });
  const serp = d.zones[0][L.HAND][0];
  return { d, q: preguntaIdle({ invoca:[serp], coloca:[serp] }),
           bien: r => r?.action !== IA.SELECT_SUMMON };
});

pos("rematar", "…pero si con sus 300 gana la partida, se invoca",
    "contraejemplo: el coste deja de importar cuando cierra", () => {
  const d = mesa({ mios:{ mano:["Sinister Serpent"] }, lp:[8000,300] });
  const serp = d.zones[0][L.HAND][0];
  return { d, q: preguntaIdle({ invoca:[serp], coloca:[serp] }),
           bien: r => r?.action === IA.SELECT_SUMMON };
});

/* «cuando tenga que descartar cartas por efecto del vampire lord, hay que
   descartar las peores cartas, nunca algo como graceful charity o pot of
   greed». La lista venía del MAZO —zona oculta— y la regla genérica decía
   "de una zona oculta se coge lo mejor", que es cierto cuando el que
   busca es mi Sangan y justo al revés cuando me lo impone una carta suya. */
pos("elegir la mejor", "lo que me obliga a mandar una carta suya, con lo que menos duela",
    "notas de E, torneo 1 (18-09): Vampire Lord", () => {
  const d = mesa({ mios:{ mazo:[] }, suyos:{ campo:[{carta:"Vampire Lord", pos:P.ATK}] } });
  /* La cadena tiene el Vampire Lord SUYO resolviéndose: es él quien me
     obliga. La lista es de mi mazo (location 1). */
  d.cadena = [{ code:cod("Vampire Lord"), controller:1 }];
  const mazo = [{carta:"Pot of Greed"},{carta:"Graceful Charity"},{carta:"Sinister Serpent"}]
    .map((x,i) => ({ uid:900+i, code:cod(x.carta), controller:0, owner:0,
                     location:L.DECK, sequence:i, position:P.TAPADA }));
  for(const c of mazo){ d.zones[0][L.DECK].push(c); d.cards.set(c.uid, c); }
  return { d, q: preguntaObjetivo(mazo, 1, 1),
           bien: r => r?.type === R.SELECT_CARD && r?.indicies?.[0] === 2 };
});

pos("elegir la mejor", "…pero lo que busco YO en el mazo, lo mejor",
    "contraejemplo: sin cadena suya, buscar es ganar", () => {
  const d = mesa({ mios:{ campo:[{carta:"Sangan", pos:P.ATK}] } });
  const mazo = [{carta:"Sinister Serpent"},{carta:"Magician of Faith"},{carta:"Tribe-Infecting Virus"}]
    .map((x,i) => ({ uid:920+i, code:cod(x.carta), controller:0, owner:0,
                     location:L.DECK, sequence:i, position:P.TAPADA }));
  for(const c of mazo){ d.zones[0][L.DECK].push(c); d.cards.set(c.uid, c); }
  return { d, q: preguntaObjetivo(mazo, 1, 1),
           bien: r => r?.type === R.SELECT_CARD && r?.indicies?.[0] !== 0 };
});

/* ══ EL ATRIBUTO QUE LE FALTA AL CHAOS (guía §5.1, patrón P11) ══
   Su cementerio solo tiene DARK. Matarle el LIGHT es regalarle la mitad
   del coste de un Black Luster Soldier; matarle el DARK no le da nada
   nuevo. A igualdad de todo lo demás, se elige el que no le sirve. */
pos("no dispararse en el pie", "no le mata el LIGHT si es lo que le falta para el Chaos",
    "guía de E, §5.1 y P11", () => {
  const d = mesa({ suyos:{ campo:[{carta:"Blade Knight", pos:P.ATK, atkReal:1800, defReal:1000},
                                  {carta:"Archfiend Soldier", pos:P.ATK, atkReal:1800, defReal:1000}],
                           gy:["Archfiend Soldier","Mad Dog of Darkness"] } });
  /* El Chaos VISTO va a las desterradas: en el cementerio contaría como
     LIGHT y taparía justo el hueco que la posición quiere probar. */
  const bls = { uid:960, code:cod("Black Luster Soldier - Envoy of the Beginning"),
                controller:1, owner:1, location:L.REMOVED, sequence:0, position:P.ATK };
  d.zones[1][L.REMOVED].push(bls); d.cards.set(bls.uid, bls);
  const suyos = d.zones[1][L.MZONE];
  return { d, q: preguntaObjetivo([suyos[0], suyos[1]]),
           bien: r => r?.type === R.SELECT_CARD && r?.indicies?.[0] === 1 };
});

pos("no dispararse en el pie", "…pero con los dos atributos ya en su cementerio, da igual",
    "contraejemplo: no hay nada que regalar", () => {
  const d = mesa({ suyos:{ campo:[{carta:"Blade Knight", pos:P.ATK, atkReal:1800, defReal:1000},
                                  {carta:"Archfiend Soldier", pos:P.ATK, atkReal:1800, defReal:1000}],
                           gy:["Archfiend Soldier","D.D. Warrior Lady"] } });
  const suyos = d.zones[1][L.MZONE];
  return { d, q: preguntaObjetivo([suyos[0], suyos[1]]),
           bien: r => r?.type === R.SELECT_CARD && (r?.indicies?.[0] === 0 || r?.indicies?.[0] === 1) };
});

/* «turno 1 set snatch steal? riesgo de perderla y no aporta nada mas que
   bait». Una mágica lenta se activa igual desde la mano: colocarla no
   adelanta nada y la deja a tiro de Heavy Storm, MST y Dust Tornado. */
pos("no malgastar", "no coloca una mágica lenta por costumbre",
    "notas de E, torneo 2 (18-09) partida 2 T1", () => {
  const d = mesa({ mios:{ mano:["Snatch Steal"] } });
  return { d, q: preguntaIdle({ colocaMT:[d.zones[0][L.HAND][0]] }),
           bien: r => r?.action !== IA.SELECT_SPELL_SET };
});

pos("no malgastar", "…y sí coloca la trampa, que sin estar puesta no sirve",
    "contraejemplo del anterior", () => {
  const d = mesa({ mios:{ mano:["Sakuretsu Armor"] } });
  return { d, q: preguntaIdle({ colocaMT:[d.zones[0][L.HAND][0]] }),
           bien: r => r?.action === IA.SELECT_SPELL_SET };
});

/* ══════════════════════════════════════════════════════════════════
   EL BO3 DEL 18-09 POR LA TARDE (Zombie contra Goat Control y Chaos Turbo)
   ══════════════════════════════════════════════════════════════════ */

/* «turno 2 book of moon no me interrumpe el cambiarte el monstruo con
   creature swap». Creature Swap no selecciona: boca abajo se cambia igual. */
pos("no malgastar", "no responde a Creature Swap con Book of Moon",
    "notas de E, 18-09 tarde, Chaos Turbo partida 2 T2", () => {
  const d = mesa({ mios:{ mt:[{carta:"Book of Moon", pos:P.TAPADA}],
                          campo:[{carta:"Breaker the Magical Warrior", pos:P.ATK}] },
                   suyos:{ campo:[{carta:"Vampire Lord", pos:P.ATK}] },
                   turnPlayer:1, fase:0x4 });
  d.cadena = [{ code:cod("Creature Swap"), controller:1 }];
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), bien: r => r?.index == null };
});

/* «turno 12 book of moon a una carta que estaba en defensa ya». */
pos("no malgastar", "Book of Moon no apunta a lo que ya está en defensa",
    "notas de E, 18-09 tarde, Goat Control partida 2 T12", () => {
  const d = mesa({ mios:{ mt:[{carta:"Book of Moon", pos:P.TAPADA}] },
                   suyos:{ campo:[{carta:"Gravekeeper's Spy (GOAT)", pos:P.DEF}] },
                   turnPlayer:1, fase:0x4 });
  d.cadena = [{ code:cod("Pot of Greed"), controller:1 }];
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), bien: r => r?.index == null };
});

/* «turno 1 el soul release no aporta nada». */
pos("no malgastar", "no juega Soul Release con su cementerio vacío",
    "notas de E, 18-09 tarde, Chaos Turbo partida 2 T1", () => {
  const d = mesa({ mios:{ mano:["Soul Release"] } });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]] }),
           bien: r => r?.action !== IA.SELECT_ACTIVATE };
});

pos("no malgastar", "…pero sí con un Chaos y su combustible esperando",
    "contraejemplo: ahí le quita la partida", () => {
  const d = mesa({ mios:{ mano:["Soul Release"] },
                   suyos:{ gy:["Black Luster Soldier - Envoy of the Beginning",
                               "Archfiend Soldier","Blade Knight","Sinister Serpent"] } });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]] }),
           bien: r => r?.action === IA.SELECT_ACTIVATE };
});

/* «el bottomless traphole probablemente era mejor usarlo en el vamp, no
   esperar a un tribute summon. hay que jugarlo dependiendo de la mesa». */
pos("combate", "Bottomless Trap Hole al Vampire Lord que acaba de salir",
    "notas de E, 18-09 tarde, Chaos Turbo partida 2", () => {
  const d = mesa({ mios:{ mt:[{carta:"Bottomless Trap Hole", pos:P.TAPADA}] },
                   suyos:{ campo:[{carta:"Vampire Lord", pos:P.ATK}] },
                   turnPlayer:1, fase:0x4 });
  const vamp = d.zones[1][L.MZONE][0];
  d.ultimaInvocada = { uid: vamp.uid, turno: d.turnCount, kind:"normal" };
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), bien: r => r?.index === 0 };
});

pos("no malgastar", "…y no se gasta en algo que no cambia la mesa",
    "contraejemplo: un 1600 sin efecto delante de mi 1900", () => {
  const d = mesa({ mios:{ mt:[{carta:"Bottomless Trap Hole", pos:P.TAPADA}],
                          campo:[{carta:"Archfiend Soldier", pos:P.ATK}] },
                   suyos:{ campo:[{carta:"Blade Knight", pos:P.ATK}] },
                   turnPlayer:1, fase:0x4 });
  const bk = d.zones[1][L.MZONE][0];
  d.ultimaInvocada = { uid: bk.uid, turno: d.turnCount, kind:"normal" };
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), bien: r => r?.index == null };
});

/* ══════════════════════════════════════════════════════════════════
   CASOS DE VALIDACIÓN DE LA GUÍA (Casos_validacion_GOAT.json)
   Los estratégicos que la IA decide —los de reglas los decide el motor—.
   ══════════════════════════════════════════════════════════════════ */

/* C23 · Mirror Force ante un atacante letal: no se espera a dos. */
pos("combate", "C23 · Mirror Force contra un solo atacante que me mata",
    "guía, caso C23 / patrón P01", () => {
  const d = mesa({ mios:{ mt:[{carta:"Mirror Force", pos:P.TAPADA}] },
                   suyos:{ campo:[{carta:"Archfiend Soldier", pos:P.ATK}] },
                   lp:[1500,8000], turnPlayer:1, fase:0x8 });
  d.atacante = d.zones[1][L.MZONE][0];
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), bien: r => r?.index === 0 };
});

/* C25 · Preparar Call of the Haunted con un turno de antelación. */
pos("tempo", "C25 · coloca Call of the Haunted en la Main 2 con algo que revivir",
    "guía, caso C25 / patrón P12", () => {
  const d = mesa({ mios:{ mano:["Call of the Haunted"], gy:["Ryu Kokki"] }, fase:0x100 });
  return { d, q: preguntaIdle({ colocaMT:[d.zones[0][L.HAND][0]], bp:false }),
           bien: r => r?.action === IA.SELECT_SPELL_SET };
});

/* C29 · BLS gana atacando: 2000 + 3000 directos contra 5000. Desterrar
   con su efecto le quita el ataque y deja la partida viva. */
pos("rematar", "C29 · BLS ataca para ganar en vez de desterrar",
    "guía, caso C29 / patrón P05", () => {
  const d = mesa({ mios:{ campo:[{carta:"Black Luster Soldier - Envoy of the Beginning", pos:P.ATK}] },
                   suyos:{ campo:[{carta:"Nimble Momonga (GOAT)", pos:P.ATK}] },
                   lp:[8000,5000] });
  const bls = d.zones[0][L.MZONE][0];
  return { d, q: preguntaIdle({ activa:[bls], bp:true }),
           bien: r => r?.action !== IA.SELECT_ACTIVATE };
});

pos("tempo", "C29 contra · sin letal y con una D.D. Warrior Lady delante, destierra",
    "contraejemplo: pegarle a la Lady es perder el BLS", () => {
  const d = mesa({ mios:{ campo:[{carta:"Black Luster Soldier - Envoy of the Beginning", pos:P.ATK}] },
                   suyos:{ campo:[{carta:"D.D. Warrior Lady", pos:P.ATK}] },
                   lp:[8000,8000] });
  const bls = d.zones[0][L.MZONE][0];
  return { d, q: preguntaIdle({ activa:[bls], bp:true }),
           bien: r => r?.action === IA.SELECT_ACTIVATE };
});

/* C22 · Absorber a su Jinzo le devuelve sus trampas (P08, P16, V14).
   Tiene dos colocadas y yo ninguna: su Jinzo le ata más a él que a mí. */
pos("no dispararse en el pie", "C22 · el TER no absorbe al Jinzo que le apaga sus trampas",
    "guía, caso C22 / patrones P08 y P16", () => {
  const d = mesa({ mios:{ campo:[{carta:"Thousand-Eyes Restrict", pos:P.ATK}] },
                   suyos:{ campo:[{carta:"Jinzo", pos:P.ATK}, {carta:"Airknight Parshath", pos:P.ATK}],
                           mt:["Mirror Force","Sakuretsu Armor"] } });
  d.cadena = [{ code:cod("Thousand-Eyes Restrict"), controller:0 }];
  const s2 = d.zones[1][L.MZONE];
  return { d, q: preguntaObjetivo([s2[0], s2[1]]),
           bien: r => r?.type === R.SELECT_CARD && r?.indicies?.[0] === 1 };
});

pos("no dispararse en el pie", "C22 contra · sin trampas suyas, el Jinzo es el mejor objetivo",
    "contraejemplo: no hay nada que soltarle", () => {
  const d = mesa({ mios:{ campo:[{carta:"Thousand-Eyes Restrict", pos:P.ATK}] },
                   suyos:{ campo:[{carta:"Jinzo", pos:P.ATK}, {carta:"Airknight Parshath", pos:P.ATK}] } });
  d.cadena = [{ code:cod("Thousand-Eyes Restrict"), controller:0 }];
  const s2 = d.zones[1][L.MZONE];
  return { d, q: preguntaObjetivo([s2[0], s2[1]]),
           bien: r => r?.type === R.SELECT_CARD && r?.indicies?.[0] === 0 };
});

/* C11, del lado de la IA: con el rival solo con tapadas, el único objetivo
   legal del Chaos Sorcerer es EL PROPIO Sorcerer (está boca arriba). Lo
   comprobó check-reglas-guia preguntándole al motor. Activarlo es
   desterrarse a sí mismo. */
pos("no dispararse en el pie", "C11 · Chaos Sorcerer no se activa si solo hay tapadas enfrente",
    "guía C11: el motor ofrece la activación, pero el único objetivo es él mismo", () => {
  const d = mesa({ mios:{ campo:[{carta:"Chaos Sorcerer", pos:P.ATK}] },
                   suyos:{ campo:[{carta:"Magician of Faith", pos:P.TAPADA}] } });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.MZONE][0]], bp:true }),
           bien: r => r?.action !== IA.SELECT_ACTIVATE };
});


/* ══ GUÍA P04 · la posición del Chaos Sorcerer que va a desterrar ══ */
pos("posición", "P04 · Chaos Sorcerer que va a desterrar, en defensa contra reclutadores",
    "guía P04", () => {
  const d = mesa({ mios:{ campo:["Sangan"], gy:["Mystic Tomato"] },
                   suyos:{ campo:[{carta:"Airknight Parshath", pos:P.ATK}], mano:["Mystic Tomato","Sangan"],
                           mt:["Mirror Force"] } });
  return { d, q: preguntaPosicion("Chaos Sorcerer"),
           bien: r => r?.position === 0x4 };
});
pos("posición", "P04 contra · lo que queda tras el destierro lo mata en defensa: ataque",
    "guía P04", () => {
  const d = mesa({ mios:{ campo:["Sangan"] },
                   suyos:{ campo:[{carta:"Jinzo", pos:P.ATK},{carta:"Vampire Lord", pos:P.ATK}] } });
  return { d, q: preguntaPosicion("Chaos Sorcerer"),
           bien: r => r?.position === 0x1 };
});


/* ══ GUÍA P03 · el motor antes que su producto ══ */
pos("elegir la mejor", "P03 · Exiled Force al Magician of Faith que el rival re-tapa con Book of Moon",
    "guía P03", () => {
  const d = mesa({ mios:{ campo:[{carta:"Exiled Force", pos:P.ATK}] },
                   suyos:{ campo:[{carta:"Magician of Faith", pos:P.DEF}, {carta:"Breaker the Magical Warrior", pos:P.ATK}],
                           gy:["Book of Moon","Graceful Charity"] } });
  d.cadena = [{ code:cod("Exiled Force"), controller:0 }];
  const s2 = d.zones[1][L.MZONE];
  return { d, q: preguntaObjetivo([s2[0], s2[1]]),
           bien: r => r?.type === R.SELECT_CARD && r?.indicies?.[0] === 0 };
});
pos("elegir la mejor", "P03 contra · sin forma de re-taparlo, el cuerpo que pega",
    "guía P03", () => {
  const d = mesa({ mios:{ campo:[{carta:"Exiled Force", pos:P.ATK}] },
                   suyos:{ campo:[{carta:"Magician of Faith", pos:P.DEF}, {carta:"Breaker the Magical Warrior", pos:P.ATK}],
                           gy:["Graceful Charity"] } });
  d.cadena = [{ code:cod("Exiled Force"), controller:0 }];
  const s2 = d.zones[1][L.MZONE];
  return { d, q: preguntaObjetivo([s2[0], s2[1]]),
           bien: r => r?.type === R.SELECT_CARD && r?.indicies?.[0] === 1 };
});
pos("no dispararse en el pie", "Book of Moon no tumba el Magician of Faith del rival: se lo regala otra vez",
    "guía P03", () => {
  const d = mesa({ mios:{ campo:[{carta:"Sangan", pos:P.ATK}] },
                   suyos:{ campo:[{carta:"Magician of Faith", pos:P.ATK}, {carta:"Spirit Reaper", pos:P.ATK}] } });
  d.cadena = [{ code:cod("Book of Moon"), controller:0 }];
  const s2 = d.zones[1][L.MZONE];
  return { d, q: preguntaObjetivo([s2[0], s2[1]]),
           bien: r => r?.type === R.SELECT_CARD && r?.indicies?.[0] === 1 };
});


/* ══ GUÍA P10 / C24 · no liberar una mesa bloqueada ══ */
const mesaCandado = (suMazo, miMazo) => {
  const d = mesa({ mios:{ campo:[{carta:"Airknight Parshath", pos:P.ATK}] },
                   suyos:{ campo:[{carta:"Sheep Token",pos:P.DEF},{carta:"Sheep Token",pos:P.DEF},
                                  {carta:"Sheep Token",pos:P.DEF},{carta:"Sheep Token",pos:P.DEF},
                                  {carta:"Sangan",pos:P.DEF}], mano:["Sangan"] } });
  d.zones[1][L.DECK] = Array.from({length:suMazo}, ()=>({ code:0 }));
  d.zones[0][L.DECK] = Array.from({length:miMazo}, ()=>({ code:0 }));
  return d;
};
pos("tempo", "C24 · su mesa llena de fichas y su mazo a 3: no se le abre una zona",
    "guía C24 / P10", () => {
  const d = mesaCandado(3, 12);
  return { d, q: preguntaBatalla([d.zones[0][L.MZONE][0]]),
           bien: r => r?.type === R.SELECT_BATTLECMD && r?.action !== BA.SELECT_BATTLE };
});
pos("tempo", "C24 contra · mismo candado pero mazos iguales: se ataca",
    "guía C24 / P10", () => {
  const d = mesaCandado(12, 12);
  return { d, q: preguntaBatalla([d.zones[0][L.MZONE][0]]),
           bien: r => r?.type === R.SELECT_BATTLECMD && r?.action === BA.SELECT_BATTLE };
});


/* ══ Asura Priest se guarda para limpiar ══ */
pos("no malgastar", "Asura Priest no se gasta contra un solo Sangan: hay otro que invocar",
    "notas de E / guía (Scapegoat)", () => {
  const d = mesa({ mios:{ mano:["Asura Priest","Breaker the Magical Warrior"] },
                   suyos:{ campo:[{carta:"Sangan", pos:P.ATK}], mano:["Scapegoat","Sangan","Mirror Force"] } });
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ invoca:[h[0], h[1]] }),
           bien: r => !(r?.action === IA.SELECT_SUMMON && r?.index === 0) };
});
pos("no malgastar", "Asura contra · tres cuerpos pequeños: ahora sí limpia",
    "notas de E / guía (Scapegoat)", () => {
  const d = mesa({ mios:{ mano:["Asura Priest","Gearfried the Iron Knight"] },
                   suyos:{ campo:[{carta:"Sheep Token",pos:P.DEF},{carta:"Sheep Token",pos:P.DEF},{carta:"Sheep Token",pos:P.DEF}] } });
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ invoca:[h[0], h[1]] }),
           bien: r => r?.action === IA.SELECT_SUMMON && r?.index === 0 };
});


/* ══ E, 19-09 · dos Spellbinding Circle sobre el mismo monstruo ══ */
const mesaAtadura = (otros=[{carta:"Sangan", pos:P.ATK}]) => {
  const d = mesa({ mios:{ mt:[{carta:"Spellbinding Circle", pos:P.ATK},{carta:"Spellbinding Circle", pos:P.TAPADA}] },
                   suyos:{ campo:[{carta:"Skilled Dark Magician", pos:P.ATK}, ...otros] }, turnPlayer:0 });
  d.zones[0][L.SZONE][0].vinculadoA = d.zones[1][L.MZONE][0].uid;
  return d;
};
pos("no malgastar", "La segunda Spellbinding Circle no apunta al que ya está atado",
    "E, 19-09 (Weevil)", () => {
  const d = mesaAtadura();
  const s2 = d.zones[1][L.MZONE];
  return { d,
    previo: cerebro => cerebro.anotar?.({ type:MT.SELECT_IDLECMD, activates:[ref(d.zones[0][L.SZONE][1])] },
                                      { type:R.SELECT_IDLECMD, action:IA.SELECT_ACTIVATE, index:0 }),
    q: preguntaObjetivo([s2[0], s2[1]]),
    bien: r => r?.type === R.SELECT_CARD && r?.indicies?.[0] === 1 };
});
pos("no malgastar", "Con todo lo suyo ya atado, la segunda Spellbinding no se activa",
    "E, 19-09 (Weevil)", () => {
  const d = mesaAtadura([]);
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.SZONE][1]] }),
           bien: r => r?.action !== IA.SELECT_ACTIVATE };
});

/* ══ E, 19-09 · Howling Insect saca un Man-Eater Bug ══ */
pos("elegir la mejor", "Howling Insect no saca un volteo: del mazo entra boca arriba",
    "E, 19-09 (Weevil)", () => {
  const d = mesa({ mios:{ gy:["Howling Insect"] }, suyos:{ campo:[{carta:"Sangan", pos:P.ATK}] } });
  d.cadena = [{ code:cod("Howling Insect"), controller:0 }];
  const deMazo = (nom, i) => ({ code:cod(nom), controller:0, location:L.DECK, sequence:i, position:0 });
  const q = { type:MT.SELECT_CARD, player:0, can_cancel:false, min:1, max:1,
              selects:[deMazo("Man-Eater Bug",0), deMazo("Howling Insect",1), deMazo("Pinch Hopper",2)] };
  return { d, q, bien: r => r?.type === R.SELECT_CARD && r?.indicies?.[0] !== 0 };
});


/* ══ E, torneo del 19-09 (tarde) ══ */
pos("no malgastar", "Mirror Force con un Royal Decree boca arriba: negada, no se activa",
    "E, 19-09 (Goat Control, p2)", () => {
  const d = mesa({ mios:{ mt:[{carta:"Mirror Force", pos:P.TAPADA}] },
                   suyos:{ campo:[{carta:"Vampire Lord", pos:P.ATK},{carta:"Sangan", pos:P.ATK}],
                           mt:[{carta:"Royal Decree", pos:P.ATK}] }, turnPlayer:1, fase:0x10 });
  d.atacante = d.zones[1][L.MZONE][0];
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]),
           bien: r => r?.index == null };
});
pos("no malgastar", "Royal Decree contra · sin Decree, Mirror Force sí",
    "E, 19-09 (Goat Control, p2)", () => {
  const d = mesa({ mios:{ mt:[{carta:"Mirror Force", pos:P.TAPADA}] },
                   suyos:{ campo:[{carta:"Vampire Lord", pos:P.ATK},{carta:"Sangan", pos:P.ATK}] }, turnPlayer:1, fase:0x10 });
  d.atacante = d.zones[1][L.MZONE][0];
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]),
           bien: r => r?.index === 0 };
});
pos("no malgastar", "Heavy Storm suyo: el Scapegoat se encadena antes de perderlo",
    "E, 19-09 (Horus, p2)", () => {
  const d = mesa({ mios:{ mt:[{carta:"Scapegoat", pos:P.TAPADA},{carta:"Sakuretsu Armor", pos:P.TAPADA}] },
                   suyos:{ campo:[{carta:"Tribe-Infecting Virus", pos:P.ATK}], mano:["Sangan","Giant Rat"] },
                   turnPlayer:1 });
  d.cadena = [{ code:cod("Heavy Storm"), controller:1, uid:990 }];
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]),
           bien: r => r?.index === 0 };
});
pos("elegir la mejor", "Heavy Storm suyo: mejor Ring of Destruction que Book of Moon",
    "E, 19-09 (Chaos Turbo, p3)", () => {
  const d = mesa({ mios:{ mt:[{carta:"Book of Moon", pos:P.TAPADA},{carta:"Ring of Destruction", pos:P.TAPADA}] },
                   suyos:{ campo:[{carta:"Giant Rat", pos:P.ATK}], mano:["Sangan","Heavy Storm"] },
                   turnPlayer:1, lp:[8000,6000] });
  d.cadena = [{ code:cod("Heavy Storm"), controller:1, uid:990 }];
  const mt = d.zones[0][L.SZONE];
  return { d, q: preguntaCadena([mt[0], mt[1]]),
           bien: r => r?.index === 1 };
});
pos("no malgastar", "Book of Moon en su Main Phase no para nada: lo vuelve a voltear",
    "E, 19-09 (Chaos Turbo, p1)", () => {
  const d = mesa({ mios:{ mt:[{carta:"Book of Moon", pos:P.TAPADA}], campo:[{carta:"Night Assailant", pos:P.DEF}] },
                   suyos:{ campo:[{carta:"Ryu Kokki", pos:P.ATK}], mano:["Mystic Swordsman LV2"] }, turnPlayer:1 });
  d.cadena = [{ code:cod("Reinforcement of the Army"), controller:1, uid:991 }];
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]),
           bien: r => r?.index == null };
});
pos("no malgastar", "Thunder Dragon no se coloca (ni con tributo): es descarte y combustible",
    "E, 19-09 (Chaos Turbo, p1)", () => {
  const d = mesa({ mios:{ mano:["Thunder Dragon","Mystic Tomato"], campo:[{carta:"Gravekeeper's Spy", pos:P.DEF}] },
                   suyos:{ campo:[{carta:"Mystic Swordsman LV2", pos:P.ATK}] } });
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ invoca:[h[0], h[1]], coloca:[h[0], h[1]], activa:[h[0]] }),
           /* La heurística ya no lo hacía; lo hacía la SIMULACIÓN, que solo
              descarta lo que la heurística veta (< 0.15). Así que se mira
              que invocarlo o colocarlo quede vetado, no solo que no se elija. */
           bien: (r, cb) => !((r?.action === IA.SELECT_SUMMON || r?.action === IA.SELECT_MONSTER_SET) && r?.index === 0)
                 && (cb.ultimoPlan?.() ?? []).filter(x => (x.action === IA.SELECT_SUMMON || x.action === IA.SELECT_MONSTER_SET) && x.index === 0)
                                          .every(x => x.puntos < 0.15) };
});
pos("tempo", "Breaker rompe la tapada ANTES de ir a la batalla",
    "E, 19-09 (Chaos Turbo, p1)", () => {
  const d = mesa({ mios:{ campo:[{carta:"Breaker the Magical Warrior", pos:P.ATK}] },
                   suyos:{ campo:[{carta:"Giant Rat", pos:P.DEF}], mt:[{carta:"Sakuretsu Armor", pos:P.TAPADA}] } });
  /* Y con margen: la simulación solo cambia la jugada de la heurística
     si la supera por mucho, así que romper primero tiene que valer
     claramente más que ir a la batalla. */
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.MZONE][0]], bp:true }),
           bien: (r, cb) => r?.action === IA.SELECT_ACTIVATE
                 && ((cb.ultimoPlan?.() ?? []).find(x => x.action === IA.SELECT_ACTIVATE)?.puntos ?? 0) >= 3.5 };
});
pos("no malgastar", "Con tres tapadas y su Heavy Storm sin salir, la cuarta no se coloca",
    "E, 19-09 (Horus, p2)", () => {
  const d = mesa({ mios:{ mano:["Sakuretsu Armor"],
                          mt:[{carta:"Scapegoat",pos:P.TAPADA},{carta:"Torrential Tribute",pos:P.TAPADA},{carta:"Mystical Space Typhoon",pos:P.TAPADA}] },
                   suyos:{ mano:["Sangan","Giant Rat","Heavy Storm","Tribe-Infecting Virus","Nobleman of Crossout"] } });
  return { d, q: preguntaIdle({ colocaMT:[d.zones[0][L.HAND][0]], bp:false }),
           bien: r => r?.action !== IA.SELECT_SPELL_SET };
});


/* ══ E, torneo del 19-09 (noche) ══ */
const vetadoEnPlan = (cb, accion, indice=0) =>
  (cb.ultimoPlan?.() ?? []).filter(x => x.action === accion && x.index === indice).every(x => x.puntos < 0.15)
  && (cb.ultimoPlan?.() ?? []).some(x => x.action === accion && x.index === indice);
pos("no dispararse en el pie", "Chaos Sorcerer sin nada suyo boca arriba: se desterraría a sí mismo",
    "E, 19-09 (Chaos Turbo, p1)", () => {
  /* En la partida lo hizo la SIMULACIÓN: la heurística lo vetaba, pero
     lo vetado no entraba en el plan y pensar.js lo daba por «sin nota». */
  const d = mesa({ mios:{ campo:[{carta:"Chaos Sorcerer", pos:P.ATK}] },
                   suyos:{ mt:["Sakuretsu Armor"], mano:["Sangan"] } });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.MZONE][0]], bp:true }),
           bien: (r, cb) => r?.action !== IA.SELECT_ACTIVATE && vetadoEnPlan(cb, IA.SELECT_ACTIVATE) };
});
pos("no malgastar", "Solemn Judgment no se encadena para salvarse a sí mismo de una MST",
    "E, 19-09 (Cat Control, p1)", () => {
  const d = mesa({ mios:{ mt:[{carta:"Solemn Judgment", pos:P.TAPADA}], campo:[{carta:"The Wicked Worm Beast", pos:P.TAPADA|P.DEF}] },
                   suyos:{ campo:[{carta:"Giant Rat", pos:P.ATK}], mano:["Exiled Force"] }, turnPlayer:1, lp:[4800,4400] });
  const sol = d.zones[0][L.SZONE][0];
  d.cadena = [{ code:cod("Mystical Space Typhoon"), controller:1, uid:992 }];
  d.objetivosCadena = new Set([sol.uid]);
  return { d, q: preguntaCadena([sol]), bien: r => r?.index == null };
});
pos("no malgastar", "Ring of Destruction no se gasta en un Sangan (ni la simulación)",
    "E, 19-09 (Cat Control, p2)", () => {
  const d = mesa({ mios:{ mt:[{carta:"Ring of Destruction", pos:P.TAPADA}], campo:[{carta:"Gyaku-Gire Panda", pos:P.TAPADA|P.DEF}] },
                   suyos:{ campo:[{carta:"Sangan", pos:P.ATK}] } });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.SZONE][0]], bp:true }),
           bien: (r, cb) => r?.action !== IA.SELECT_ACTIVATE && vetadoEnPlan(cb, IA.SELECT_ACTIVATE) };
});
pos("no dispararse en el pie", "Heavy Storm que se lleva dos mías por una suya: vetado también para la simulación",
    "E, 19-09 (Cat Control, p2)", () => {
  const d = mesa({ mios:{ mano:["Heavy Storm"], campo:[{carta:"Gyaku-Gire Panda",pos:P.ATK}],
                          mt:[{carta:"Torrential Tribute",pos:P.TAPADA},{carta:"Solemn Judgment",pos:P.TAPADA}] },
                   suyos:{ mt:[{carta:"Ring of Destruction",pos:P.TAPADA}], mano:["Giant Rat","Book of Moon"] } });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]], bp:true }),
           bien: (r, cb) => r?.action !== IA.SELECT_ACTIVATE && vetadoEnPlan(cb, IA.SELECT_ACTIVATE) };
});
pos("no malgastar", "Call of the Haunted en mi turno para sacar algo que no pega: se guarda",
    "E, 19-09 (Emissary, p1)", () => {
  const d = mesa({ mios:{ mt:[{carta:"Call of the Haunted", pos:P.TAPADA}], gy:["Sonic Duck"], mano:["Metamorphosis"] },
                   suyos:{ campo:[{carta:"Ryu Kokki", pos:P.ATK}] } });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.SZONE][0]], bp:true }),
           bien: (r, cb) => r?.action !== IA.SELECT_ACTIVATE && vetadoEnPlan(cb, IA.SELECT_ACTIVATE) };
});
pos("no malgastar", "No se tributa para colocar un Airknight que el Ryu Kokki rompe igual",
    "E, 19-09 (Emissary, p1)", () => {
  const d = mesa({ mios:{ mano:["Airknight Parshath"], campo:[{carta:"Sonic Duck", pos:P.ATK}] },
                   suyos:{ campo:[{carta:"Ryu Kokki", pos:P.ATK}] } });
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ coloca:[h[0]], bp:true }),
           bien: (r, cb) => r?.action !== IA.SELECT_MONSTER_SET && vetadoEnPlan(cb, IA.SELECT_MONSTER_SET) };
});
pos("tempo", "Primero ataca el Airknight y luego el TER: el TER no deja atacar a los míos",
    "E, 19-09 (Emissary, p2)", () => {
  const d = mesa({ mios:{ mano:["Metamorphosis","Book of Moon"],
                          campo:[{carta:"Airknight Parshath", pos:P.ATK},{carta:"Sheep Token", pos:P.DEF},
                                 {carta:"Sheep Token", pos:P.DEF},{carta:"Sheep Token", pos:P.DEF}],
                          extra:["Thousand-Eyes Restrict"] },
                   suyos:{ campo:[{carta:"Sangan", pos:P.ATK}], mano:["Heavy Storm","Snatch Steal","Book of Moon"] } });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]], bp:true }),
           bien: r => r?.action !== IA.SELECT_ACTIVATE };
});
pos("no malgastar", "Compulsory Evacuation Device no se gasta en un monstruo recién colocado",
    "E, 19-09 (Gravekeeper, p1)", () => {
  const d = mesa({ mios:{ mt:[{carta:"Compulsory Evacuation Device", pos:P.TAPADA}] },
                   suyos:{ campo:[{carta:"Spirit Reaper", pos:P.TAPADA|P.DEF}] }, turnPlayer:1 });
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), bien: r => r?.index == null };
});
pos("no malgastar", "Compulsory Evacuation Device sí contra el Ryu Kokki tributado que me pega",
    "E, 19-09 (Gravekeeper, p2)", () => {
  const d = mesa({ mios:{ mt:[{carta:"Compulsory Evacuation Device", pos:P.TAPADA}], campo:[{carta:"Gravekeeper's Spear Soldier", pos:P.ATK}] },
                   suyos:{ campo:[{carta:"Ryu Kokki", pos:P.ATK}] }, turnPlayer:1 });
  d.ultimaInvocada = { uid:d.zones[1][L.MZONE][0].uid, turno:d.turnCount, kind:"normal" };
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), bien: r => r?.index === 0 };
});
pos("no malgastar", "Con Royal Decree, la simulación de la cadena tampoco puede elegir Ring",
    "E, 19-09 (Emissary, p2)", () => {
  const d = mesa({ mios:{ mt:[{carta:"Ring of Destruction", pos:P.TAPADA}] },
                   suyos:{ campo:[{carta:"Pyramid Turtle", pos:P.ATK}], mt:[{carta:"Royal Decree", pos:P.ATK}] }, turnPlayer:1, fase:0x10 });
  d.atacante = d.zones[1][L.MZONE][0];
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]),
           bien: (r, cb) => r?.index == null && (cb.puntosCadena?.() ?? []).some(x => x.index === 0 && x.p <= -1) };
});

/* ══════════════ TORNEO DEL 20-09 (10:23) ══════════════
   Tres matches tras el contexto estratégico. Cada posición es un turno
   concreto de los logs; todas fallan en b0a0275. */
pos("cadena", "Book of Moon a lo que su propia Book of Moon ya tumba: no",
    "E, 20-09 R1 p1 T4", () => {
  const d = mesa({ mios:{ mt:[{carta:"Book of Moon",pos:P.TAPADA}] },
                   suyos:{ campo:[{carta:"Pyramid Turtle",pos:P.ATK}], mano:["Tribe-Infecting Virus"] },
                   turnPlayer:1, fase:0x8 });
  const t = d.zones[1][L.MZONE][0];
  d.atacante = { uid:t.uid, code:t.code, controller:1 };
  d.cadena = [{ code:cod("Ring of Destruction"), controller:0, uid:998 },
              { code:cod("Book of Moon"), controller:1, uid:999 }];
  d.objetivosCadena = new Set([t.uid]);
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), bien: r => r?.index == null };
});
pos("fusiones", "segundo TER con uno ya puesto que para todo: no",
    "E, 20-09 R1 p1 T13", () => {
  const d = mesa({ mios:{ mano:["Metamorphosis"], extra:["Thousand-Eyes Restrict","Thousand-Eyes Restrict"],
                          campo:[{carta:"Thousand-Eyes Restrict",pos:P.ATK}] },
                   suyos:{ campo:[{carta:"Ryu Kokki",pos:P.ATK},{carta:"Kycoo the Ghost Destroyer",pos:P.ATK}], mano:["Premature Burial"] }, lp:[1200,6000], turno:13 });
  d.zones[0][L.MZONE][1] = { uid:902, code:FICHA, controller:0, owner:0, location:L.MZONE, sequence:1, position:P.DEF };
  d.cards.set(902, d.zones[0][L.MZONE][1]);
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]], bp:true }),
           bien: r => r?.action !== IA.SELECT_ACTIVATE };
});
pos("fusiones", "Metamorphosis sin nada boca arriba que absorber, material caro: vetada",
    "E, 20-09 R2 p1 T4", () => {
  const d = mesa({ mios:{ mano:["Metamorphosis"], extra:["Thousand-Eyes Restrict"],
                          campo:[{carta:"D.D. Warrior Lady",pos:P.ATK},{carta:"Magician of Faith",pos:P.ATK}] },
                   suyos:{ campo:[{carta:"Gravekeeper's Spy",pos:P.TAPADA|P.DEF}], mano:["Sangan","Kycoo the Ghost Destroyer","Nobleman of Crossout"] }, turno:4 });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]], bp:true }),
           bien: (r, cb) => r?.action !== IA.SELECT_ACTIVATE
                 && ((cb.ultimoPlan?.() ?? []).find(x => x.action === IA.SELECT_ACTIVATE)?.puntos ?? 0) < 0.15 };
});
pos("cadena", "Trap Dustshoot en su Draw Phase con cuatro cartas: ahora",
    "E, 20-09 R1 p1 T18", () => {
  const d = mesa({ mios:{ mt:[{carta:"Trap Dustshoot",pos:P.TAPADA}] },
                   suyos:{ mano:["Sangan","Pot of Greed","Kycoo the Ghost Destroyer","Mirror Force"] },
                   turnPlayer:1, fase:0x1, turno:18 });
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), bien: r => r?.index === 0 };
});
pos("objetivos", "Trap Dustshoot: de su mano se devuelve lo mejor (BLS), no lo peor",
    "E, 20-09 R2 p1 T9", () => {
  const d = mesa({ suyos:{ mano:["Sinister Serpent","Black Luster Soldier - Envoy of the Beginning","Gravekeeper's Spy"] }, turno:9 });
  d.cadena = [{ code:cod("Trap Dustshoot"), controller:0, uid:999 }];
  const h = d.zones[1][L.HAND];
  h.forEach((c,i)=>{ c.location = L.HAND; c.sequence = i; });
  return { d, q: preguntaObjetivo(h), bien: r => (r?.indicies ?? [])[0] === 1 };
});
pos("combate", "atacar a lo que gano, no a la tapada que sé que me rebota (D.D. Warrior Lady)",
    "E, 20-09 R1 p2 T9", () => {
  const d = mesa({ mios:{ campo:[{carta:"Tsukuyomi",pos:P.ATK}] },
                   suyos:{ campo:[{carta:"Pyramid Turtle",pos:P.ATK},{carta:"D.D. Warrior Lady",pos:P.ATK,dueño:0},
                                  {carta:"Mystic Swordsman LV2",pos:P.ATK}] }, turno:9, fase:0x8 });
  const cb0 = pensar(d); cb0(preguntaIdle({}), 0);
  d.zones[1][L.MZONE][1].position = P.TAPADA|P.DEF;
  const m = d.zones[1][L.MZONE];
  return { d, previo: cb => { cb(preguntaIdle({}),0); cb(preguntaBatalla([d.zones[0][L.MZONE][0]]),0); },
           q: preguntaObjetivo([m[0],m[1],m[2]]), bien: r => (r?.indicies ?? [])[0] === 2 };
});
pos("tempo", "TER en la Main 1 si tras absorber puede pegar (y la simulación no lo cambia)",
    "E, 20-09 R1 p2 T11", () => {
  const d = mesa({ mios:{ campo:[{carta:"Thousand-Eyes Restrict",pos:P.ATK}] },
                   suyos:{ campo:[{carta:"Vampire Lord",pos:P.ATK},{carta:"Pyramid Turtle",pos:P.ATK}] }, lp:[200,5000], turno:11 });
  const t = d.zones[0][L.MZONE][0];
  return { d, q: preguntaIdle({ activa:[t], bp:true }),
           bien: (r, cb) => r?.action === IA.SELECT_ACTIVATE && !!(cb.ultimoPlan?.() ?? [])[0]?.seguro };
});
pos("tempo", "voltear el Chaos Sorcerer tapado aunque antes se propuso y no se hizo",
    "E, 20-09 R2 p1 T18", () => {
  const T = P.TAPADA|P.DEF;
  const d = mesa({ mios:{ campo:[{carta:"Chaos Sorcerer",pos:T},{carta:"Tsukuyomi",pos:T}] },
                   suyos:{ campo:[{carta:"Gravekeeper's Spy",pos:P.ATK},{carta:"Sinister Serpent",pos:T}], mano:["Book of Moon"] }, lp:[3000,5000], turno:18 });
  const m = d.zones[0][L.MZONE];
  const q = preguntaIdle({ giros:[m[0],m[1]], bp:true });
  /* Dos turnos en los que la heurística propuso el giro y la simulación
     jugó otra cosa: no cuentan como giros hechos. */
  return { d, q, previo: cb => { for(let k=0;k<3;k++){ cb(q,0); cb.anotar(q, { type:R.SELECT_IDLECMD, action:IA.TO_BP, index:null }); } },
           bien: r => r?.action === IA.SELECT_POS_CHANGE && r?.index === 0 };
});
pos("recursos", "siete cartas tras Pot of Greed: se bajan trampas y monstruo, Heavy Storm no se coloca",
    "E, 20-09 R2 p2 T1", () => {
  const d = mesa({ mios:{ mano:["Sakuretsu Armor","Mirror Force","Dekoichi the Battlechanted Locomotive","Heavy Storm","Nobleman of Crossout","Metamorphosis","Dekoichi the Battlechanted Locomotive"] },
                   suyos:{ mano:["Sangan","Pot of Greed","Breaker the Magical Warrior","Raigeki Break","Kycoo the Ghost Destroyer"] }, turno:1 });
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ colocaMT:[h[0],h[1],h[3],h[4],h[5]], coloca:[h[2],h[6]], invoca:[h[2],h[6]], bp:false }),
           bien: (r, cb) => ((cb.ultimoPlan?.() ?? []).find(x => x.action === IA.SELECT_SPELL_SET && x.index === 2)?.puntos ?? 9) < 0.15 };
});
pos("recursos", "Graceful Charity con BLS: un DARK y el Thunder Dragon muerto, no dos DARK",
    "E, 20-09 R3 p1 T1", () => {
  const d = mesa({ mios:{ mano:["Black Luster Soldier - Envoy of the Beginning","Thunder Dragon","Thunder Dragon","Breaker the Magical Warrior","Mystic Tomato","Night Assailant"],
                          gy:["Thunder Dragon","Pot of Greed"] }, turno:1,
                   mazoMio:["Thunder Dragon","Thunder Dragon","Thunder Dragon","Sangan","Sangan","Mirror Force"] });
  d.cadena = [{ code:cod("Graceful Charity"), controller:0, uid:999 }];
  const h = d.zones[0][L.HAND];
  const q = { type:MT.SELECT_CARD, player:0, can_cancel:false, min:2, max:2, selects:h.map(ref) };
  return { d, q, bien: r => { const ix = r?.indicies ?? [];
      return ix.some(i => i === 1 || i === 2) && ix.filter(i => i === 4 || i === 5).length === 1 && !ix.includes(0); } };
});
pos("cadena", "Raigeki Break contra un Heavy Storm que ya se resuelve y nada más suyo: no",
    "E, 20-09 R3 p1 T2", () => {
  const d = mesa({ mios:{ mt:[{carta:"Raigeki Break",pos:P.TAPADA},{carta:"Book of Moon",pos:P.TAPADA}], mano:["Thunder Dragon"] },
                   suyos:{ mt:[{carta:"Heavy Storm",pos:P.ATK}], mano:["Asura Priest","Sakuretsu Armor","Scapegoat"] },
                   turnPlayer:1, fase:0x4, turno:2 });
  const hs = d.zones[1][L.SZONE][0];
  d.cadena = [{ code:hs.code, controller:1, uid:hs.uid }];
  d.objetivosCadena = new Set();
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), bien: r => r?.index == null };
});
pos("tempo", "campo rival vacío: levantar los Gravekeeper's Spy y pegar",
    "E, 20-09 R3 p3 T15", () => {
  const d = mesa({ mios:{ campo:[{carta:"Gravekeeper's Spy",pos:P.DEF},{carta:"Gravekeeper's Spy",pos:P.DEF}], mt:[{carta:"Bottomless Trap Hole",pos:P.TAPADA}], mano:["Heavy Storm"] },
                   suyos:{ mano:["Delinquent Duo","Tsukuyomi","Chaos Sorcerer"] }, lp:[4200,5800], turno:15 });
  const m = d.zones[0][L.MZONE];
  return { d, q: preguntaIdle({ giros:[m[0],m[1]], bp:true }), bien: r => r?.action === IA.SELECT_POS_CHANGE };
});
pos("objetivos", "Book of Moon: al que ataca, no a mi monstruo que me robó con Snatch Steal",
    "E, 20-09 R1 p2 T6 (ruling: boca abajo, Snatch Steal se va y el monstruo se queda con él)", () => {
  const d = mesa({ mios:{ mt:[{carta:"Book of Moon",pos:P.TAPADA}] },
                   suyos:{ campo:[{carta:"D.D. Warrior Lady",pos:P.ATK,dueño:0},{carta:"Pyramid Turtle",pos:P.ATK}],
                           mt:[{carta:"Snatch Steal",pos:P.ATK}] }, turnPlayer:1, fase:0x8, turno:6 });
  const m = d.zones[1][L.MZONE];
  d.atacante = { uid:m[1].uid, code:m[1].code, controller:1 };
  const bom = d.zones[0][L.SZONE][0];
  d.cadena = [{ code:bom.code, controller:0, uid:bom.uid }];
  return { d, q: preguntaObjetivo([m[0], m[1]]), bien: r => (r?.indicies ?? [])[0] === 1 };
});

/* ══════════════ TORNEO DEL 25-09 ══════════════
   Cinco matches contra experto (logs de las rondas 4 y 5; las tres
   primeras se recargaron). Cada posición es un turno concreto del log,
   repetido con `repetir-log.mjs`. Fallan en d9d68a7 salvo el control
   de Threatening Roar con el ataque ya declarado (esa ya la guardaba). */
const mazoDe = (d, lista) => {       // el mazo que le queda: N cartas y su composición
  d.decklist[0] = lista.map(cod);
  d.zones[0][L.DECK] = lista.map((n, i) => ({ uid:5000+i, code:cod(n), controller:0, owner:0, location:L.DECK, sequence:i, position:P.TAPADA }));
};
pos("rematar", "letal jugando los ataques: DMoC y Blowback contra la Injection Fairy Lily a 3800",
    "E, 25-09 R4 p1 T3", () => {
  const d = mesa({ mios:{ campo:[{carta:"Dark Magician of Chaos",pos:P.ATK},{carta:"Blowback Dragon",pos:P.ATK}] },
                   suyos:{ campo:[{carta:"Injection Fairy Lily",pos:P.ATK}], mt:["Royal Decree","Call of the Haunted"], mano:["Sangan","Sangan","Sangan"] },
                   lp:[6200,3800], turno:3, fase:0x8 });
  const m = d.zones[0][L.MZONE];
  return { d, q: preguntaBatalla([m[0], m[1]]), bien: r => r?.action === BA.SELECT_BATTLE };
});
pos("recursos", "Reasoning con DMoC, Jinzo y Sacred Crane en mesa, sin batalla y 13 cartas en el mazo: no",
    "E, 25-09 R4 p1 T1", () => {
  const d = mesa({ mios:{ campo:[{carta:"Dark Magician of Chaos",pos:P.ATK},{carta:"Jinzo",pos:P.ATK},{carta:"Sacred Crane",pos:P.ATK}],
                          mano:["Reasoning","Monster Gate","Ceasefire","Lightning Vortex"] }, turno:1 });
  mazoDe(d, ["Sacred Crane","Magical Marionette","Dimension Fusion","Graceful Charity","Metamorphosis","Giant Trunade",
             "Brain Control","Monster Reincarnation","Card Destruction","Call of the Haunted","Heavy Storm","Premature Burial","Scapegoat"]);
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ activa:[h[0]], colocaMT:[h[2]], bp:false }),
           bien: (r, cb) => !(r?.action === IA.SELECT_ACTIVATE && r?.index === 0)
                 && ((cb.ultimoPlan?.() ?? []).find(x => x.action === IA.SELECT_ACTIVATE && x.index === 0)?.puntos ?? 9) < 0.8 };
});
pos("recursos", "Monster Gate con 5 cartas en el mazo: vetado (ni la simulación)",
    "E, 25-09 R4 p1 T1", () => {
  const d = mesa({ mios:{ campo:[{carta:"Dark Magician of Chaos",pos:P.ATK},{carta:"Magical Marionette",pos:P.ATK}],
                          mano:["Monster Gate","Lightning Vortex"] }, turno:1 });
  mazoDe(d, ["Sacred Crane","Giant Trunade","Heavy Storm","Premature Burial","Scapegoat"]);
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ activa:[h[0]], bp:false }),
           bien: (r, cb) => r?.action !== IA.SELECT_ACTIVATE
                 && ((cb.ultimoPlan?.() ?? []).find(x => x.action === IA.SELECT_ACTIVATE)?.puntos ?? 9) < 0.15 };
});
pos("recursos", "Card Destruction no tira dos Chaos Sorcerer con LIGHT y DARK en el cementerio",
    "E, 25-09 R5 p1 T10", () => {
  const d = mesa({ mios:{ mano:["Chaos Sorcerer","Chaos Sorcerer","Card Destruction"], campo:[{carta:"Mystic Tomato",pos:P.ATK}],
                          gy:["Thunder Dragon","Thunder Dragon","Thunder Dragon","Magician of Faith","Night Assailant","Gravekeeper's Spy"] },
                   suyos:{ campo:[{carta:"Ryu Kokki",pos:P.ATK},{carta:"Giant Rat",pos:P.ATK}], mt:["Royal Decree"], mano:["Sangan","Sangan"] },
                   lp:[3000,4000], turno:10 });
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ activa:[h[2]], especial:[h[0], h[1]] }),
           bien: (r, cb) => r?.action !== IA.SELECT_ACTIVATE
                 && ((cb.ultimoPlan?.() ?? []).find(x => x.action === IA.SELECT_ACTIVATE)?.puntos ?? 9) < 0.15 };
});
pos("recursos", "Raigeki Break con BLS y dos Chaos Sorcerer sin DARK en el cementerio: se descarta un Chaos Sorcerer",
    "E, 25-09 R5 p1 T3", () => {
  const d = mesa({ mios:{ mano:["Black Luster Soldier - Envoy of the Beginning","Magician of Faith","Chaos Sorcerer","Chaos Sorcerer"],
                          gy:["Thunder Dragon","Thunder Dragon","Thunder Dragon","Graceful Charity"] }, turno:3, turnPlayer:1 });
  d.cadena = [{ code:cod("Breaker the Magical Warrior"), controller:1, uid:998 }, { code:cod("Raigeki Break"), controller:0, uid:999 }];
  const h = d.zones[0][L.HAND];
  const q = { type:MT.SELECT_CARD, player:0, can_cancel:false, min:1, max:1, selects:h.map(ref) };
  return { d, q, bien: r => [2,3].includes((r?.indicies ?? [])[0]) };
});
pos("no malgastar", "Night Assailant no se voltea para destruir un Sangan (floater)",
    "E, 25-09 R5 p1 T4", () => {
  const d = mesa({ mios:{ campo:[{carta:"Night Assailant",pos:P.TAPADA|P.DEF}], mano:["Chaos Sorcerer","Black Luster Soldier - Envoy of the Beginning"],
                          gy:["Thunder Dragon","Thunder Dragon"] },
                   suyos:{ campo:[{carta:"Sangan",pos:P.DEF}], mt:["Ring of Destruction"], mano:["Sangan","Sangan"] }, turno:4 });
  const m = d.zones[0][L.MZONE];
  return { d, q: preguntaIdle({ giros:[m[0]], bp:true }), bien: r => r?.action !== IA.SELECT_POS_CHANGE };
});
pos("no malgastar", "Night Assailant contra · con un Airknight enfrente sí se voltea",
    "control del anterior", () => {
  const d = mesa({ mios:{ campo:[{carta:"Night Assailant",pos:P.TAPADA|P.DEF}] },
                   suyos:{ campo:[{carta:"Airknight Parshath",pos:P.ATK}], mano:["Sangan"] }, turno:4 });
  const m = d.zones[0][L.MZONE];
  return { d, q: preguntaIdle({ giros:[m[0]], bp:true }), bien: r => r?.action === IA.SELECT_POS_CHANGE };
});
pos("posición", "Night Assailant de 200 en ataque con una tapada suya y cartas en su mano: a defensa",
    "E, 25-09 R5 p1 T6", () => {
  const d = mesa({ mios:{ campo:[{carta:"Night Assailant",pos:P.ATK}] },
                   suyos:{ campo:[{carta:"Giant Rat",pos:P.TAPADA|P.DEF}], mt:["Ring of Destruction"], mano:["Sangan","Sangan","Sangan"] }, turno:6 });
  const m = d.zones[0][L.MZONE];
  return { d, q: preguntaIdle({ giros:[m[0]], bp:true }), bien: r => r?.action === IA.SELECT_POS_CHANGE };
});
pos("cadena", "Book of Moon no para un Breaker que se estrella contra mi Gravekeeper's Spy tapado",
    "E, 25-09 R5 p3 T3", () => {
  const d = mesa({ mios:{ campo:[{carta:"Gravekeeper's Spy",pos:P.TAPADA|P.DEF}], mt:[{carta:"Book of Moon",pos:P.TAPADA}] },
                   suyos:{ campo:[{carta:"Breaker the Magical Warrior",pos:P.ATK},{carta:"Pyramid Turtle",pos:P.ATK}] },
                   turnPlayer:1, fase:0x8, turno:3 });
  const b = d.zones[1][L.MZONE][0], spy = d.zones[0][L.MZONE][0];
  d.atacante = { uid:b.uid, code:b.code, controller:1 };
  d.objetivoAtaque = { uid:spy.uid, code:spy.code, controller:0 };
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), bien: r => r?.index == null };
});
pos("objetivos", "Book of Moon a mi Night Assailant que ataca la Giant Rat: se voltea y la destruye sin que busque",
    "E, 25-09 R5 p1 T5 (idea de E; ruling en check-rulings-2509)", () => {
  const d = mesa({ mios:{ campo:[{carta:"Night Assailant",pos:P.ATK}] },
                   suyos:{ campo:[{carta:"Giant Rat",pos:P.ATK}] }, turnPlayer:1, fase:0x8, turno:5 });
  const na = d.zones[0][L.MZONE][0], rata = d.zones[1][L.MZONE][0];
  d.atacante = { uid:rata.uid, code:rata.code, controller:1 };
  d.objetivoAtaque = { uid:na.uid, code:na.code, controller:0 };
  d.cadena = [{ code:cod("Book of Moon"), controller:0, uid:999 }];
  return { d, q: preguntaObjetivo([na, rata]), bien: r => (r?.indicies ?? [])[0] === 0 };
});
pos("objetivos", "Trap Dustshoot: el Kycoo que puede bajar, no el Vampire Lord que no tiene con qué tributar",
    "E, 25-09 R5 p2 T2", () => {
  const d = mesa({ suyos:{ mano:["Vampire Lord","Kycoo the Ghost Destroyer","Graceful Charity","Delinquent Duo","Book of Moon","Creature Swap"] }, turno:2, turnPlayer:1, fase:0x1 });
  d.cadena = [{ code:cod("Trap Dustshoot"), controller:0, uid:999 }];
  const h = d.zones[1][L.HAND];
  return { d, q: preguntaObjetivo([h[0], h[1]]), bien: r => (r?.indicies ?? [])[0] === 1 };
});
pos("no malgastar", "Magician of Faith no se invoca de frente para pegar 300: se coloca",
    "E, 25-09 R5 p2 T5", () => {
  const d = mesa({ mios:{ mano:["Magician of Faith","Sinister Serpent"], campo:[{carta:"Kycoo the Ghost Destroyer",pos:P.ATK}],
                          gy:["Heavy Storm","Card Destruction","Graceful Charity"] },
                   suyos:{ mano:["Ryu Kokki"] }, lp:[8000,7000], turno:5 });
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ invoca:[h[0]], coloca:[h[0]] }),
           bien: (r, cb) => r?.action !== IA.SELECT_SUMMON
                 && !!(cb.ultimoPlan?.() ?? []).find(x => x.action === IA.SELECT_SUMMON)?.firme };
});
pos("combate", "Gravekeeper's Spy no se cambia por una Pyramid Turtle: le saca un Ryu Kokki",
    "E, 25-09 R5 p3 T4", () => {
  const d = mesa({ mios:{ campo:[{carta:"Gravekeeper's Spy",pos:P.ATK}] },
                   suyos:{ campo:[{carta:"Pyramid Turtle",pos:P.ATK}], mano:["Premature Burial","Ryu Kokki"] }, turno:4, fase:0x8 });
  return { d, q: preguntaBatalla([d.zones[0][L.MZONE][0]]), bien: r => r?.action !== BA.SELECT_BATTLE };
});
pos("no malgastar", "BLS con un solo par LIGHT+DARK contra dos tapadas, sin ir por detrás: se guarda",
    "E, 25-09 R5 p1 T8", () => {
  const d = mesa({ mios:{ mano:["Black Luster Soldier - Envoy of the Beginning","Chaos Sorcerer","Chaos Sorcerer","Mystic Tomato"],
                          campo:[{carta:"Gravekeeper's Spy",pos:P.DEF}],
                          gy:["Thunder Dragon","Thunder Dragon","Thunder Dragon","Magician of Faith","Night Assailant","Graceful Charity","Raigeki Break"] },
                   suyos:{ campo:[{carta:"Giant Rat",pos:P.ATK},{carta:"Pyramid Turtle",pos:P.ATK}], mt:["Ring of Destruction","Book of Moon"], mano:["Snatch Steal","Sangan"] },
                   lp:[6000,7200], turno:8 });
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ especial:[h[0], h[1], h[2]], coloca:[h[3]] }), bien: r => r?.action !== IA.SELECT_SPECIAL_SUMMON };
});
pos("cadena", "Wall of Revealing Light no se encadena a su Heavy Storm: pagaría para nada",
    "E, 25-09 R2 p2 T4 (nota de E)", () => {
  const d = mesa({ mios:{ mt:[{carta:"Wall of Revealing Light",pos:P.TAPADA},{carta:"Gravity Bind",pos:P.ATK}], campo:[{carta:"Des Lacooda",pos:P.TAPADA|P.DEF}] },
                   suyos:{ mt:[{carta:"Heavy Storm",pos:P.ATK}], mano:["Sangan","Sangan"] }, turnPlayer:1, fase:0x4, turno:4 });
  const hs = d.zones[1][L.SZONE][0];
  d.cadena = [{ code:hs.code, controller:1, uid:hs.uid }];
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), bien: r => r?.index == null };
});
pos("cadena", "Threatening Roar con el ataque ya declarado no lo para: no se gasta",
    "E, 25-09 R2 p1 T4 (nota de E)", () => {
  const d = mesa({ mios:{ mt:[{carta:"Threatening Roar",pos:P.TAPADA}], campo:[{carta:"Des Lacooda",pos:P.TAPADA|P.DEF}] },
                   suyos:{ campo:[{carta:"Vampire Lord",pos:P.ATK}] }, turnPlayer:1, fase:0x8, turno:4 });
  const a = d.zones[1][L.MZONE][0], dl = d.zones[0][L.MZONE][0];
  d.atacante = { uid:a.uid, code:a.code, controller:1 };
  d.objetivoAtaque = { uid:dl.uid, code:dl.code, controller:0 };
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), bien: r => r?.index == null };
});
pos("cadena", "Threatening Roar contra · al entrar en su Battle Phase con dos atacantes: ahora",
    "control del anterior", () => {
  const d = mesa({ mios:{ mt:[{carta:"Threatening Roar",pos:P.TAPADA}] },
                   suyos:{ campo:[{carta:"Vampire Lord",pos:P.ATK},{carta:"Kycoo the Ghost Destroyer",pos:P.ATK}] }, lp:[3500,8000], turnPlayer:1, fase:0x8, turno:4 });
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), bien: r => r?.index === 0 };
});
pos("elegir la mejor", "Wall of Revealing Light: se pagan 3000",
    "E, 25-09 R2 (nota de E)", () => {
  const d = mesa({ mios:{ mano:["Wall of Revealing Light"] }, suyos:{ campo:[{carta:"Vampire Lord",pos:P.ATK}] }, turno:6 });
  const h = d.zones[0][L.HAND];
  const opciones = [1000,2000,3000,4000,5000,6000,7000];
  return { d, previo: cb => cb.anotar(preguntaIdle({ activa:[h[0]] }), { type:R.SELECT_IDLECMD, action:IA.SELECT_ACTIVATE, index:0 }),
           q: { type:MT.ANNOUNCE_NUMBER, player:0, options:opciones.map(BigInt) },
           bien: r => opciones[r?.value] === 3000 };
});
pos("tempo", "PACMAN: Des Lacooda boca arriba se re-tapa en la Main Phase 2",
    "E, 25-09 R2 (nota de E)", () => {
  const d = mesa({ mios:{ campo:[{carta:"Des Lacooda",pos:P.ATK}] }, suyos:{ campo:[{carta:"Vampire Lord",pos:P.ATK}], mano:["Sangan"] },
                   turno:6, fase:0x100 });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.MZONE][0]], bp:false }), bien: r => r?.action === IA.SELECT_ACTIVATE };
});

pos("posición", "el segundo Gravekeeper's Spy no se levanta: lo que se gana ya lo cubren los de frente",
    "E, 25-09 R5 p3 T4", () => {
  const d = mesa({ mios:{ campo:[{carta:"Dekoichi the Battlechanted Locomotive",pos:P.ATK},{carta:"Gravekeeper's Spy",pos:P.ATK},{carta:"Gravekeeper's Spy",pos:P.DEF}] },
                   suyos:{ campo:[{carta:"Breaker the Magical Warrior",pos:P.DEF},{carta:"Pyramid Turtle",pos:P.ATK}], mano:["Ryu Kokki","Premature Burial"] }, turno:4 });
  const m = d.zones[0][L.MZONE];
  return { d, q: preguntaIdle({ giros:[m[2]], bp:true }), bien: r => r?.action !== IA.SELECT_POS_CHANGE };
});
pos("posición", "Gravekeeper's Spy contra · con un solo atacante de frente y dos combates que ganar, sí se levanta",
    "control del anterior", () => {
  const d = mesa({ mios:{ campo:[{carta:"Dekoichi the Battlechanted Locomotive",pos:P.ATK},{carta:"Gravekeeper's Spy",pos:P.DEF}] },
                   suyos:{ campo:[{carta:"Breaker the Magical Warrior",pos:P.DEF},{carta:"Sangan",pos:P.ATK}], mano:["Ryu Kokki"] }, turno:4 });
  const m = d.zones[0][L.MZONE];
  return { d, q: preguntaIdle({ giros:[m[1]], bp:true }), bien: r => r?.action === IA.SELECT_POS_CHANGE };
});

/* ══ E, torneo del 26-09 (tres Bo3 contra Zombie Goat Control, Cat Control y Empty Jar) ══
   Cada una falla en 7e77a1a. */
const LISTA_EMPTY_JAR = ["Serial Spell","Spell Reproduction","Book of Taiyou","The Shallow Grave",
                         "Mind Control","Reload","Card Destruction","Morphing Jar","Upstart Goblin"];
pos("prioridades", "el plan sale del mazo aunque el cerebro nazca antes que el duelo",
    "E, 26-09: siete partidas con «plan: Beatdown» (main.js crea el cerebro antes de duel.create)", () => {
  const d = mesa({ mios:{ mano:["Pot of Greed"] } });
  d.decklist = { 0:[], 1:[] };
  return { d, previo: () => { d.decklist[0] = LISTA_EMPTY_JAR.map(cod); },
           q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]] }),
           bien: (r, cb) => cb.plan?.() === "Empty Jar" };
});
pos("tempo", "el Breaker que tumbó un Book of Moon se voltea ANTES de la batalla si tiene combate",
    "E, 26-09 R1 p1 T4: «¿no podía haberlo invocado por volteo antes de la Battle Phase?»", () => {
  const d = mesa({ mios:{ campo:[{carta:"Breaker the Magical Warrior", pos:P.TAPADA}] },
                   suyos:{ campo:[{carta:"Breaker the Magical Warrior", pos:P.ATK},{carta:"Vampire Lord", pos:P.TAPADA}] }, turno:4 });
  return { d, q: preguntaIdle({ giros:[d.zones[0][L.MZONE][0]], bp:true }),
           bien: r => r?.action === IA.SELECT_POS_CHANGE };
});
pos("tempo", "…y no se voltea si boca arriba no gana nada",
    "control del anterior", () => {
  const d = mesa({ mios:{ campo:[{carta:"Breaker the Magical Warrior", pos:P.TAPADA}] },
                   suyos:{ campo:[{carta:"Vampire Lord", pos:P.ATK}] }, turno:4 });
  return { d, q: preguntaIdle({ giros:[d.zones[0][L.MZONE][0]], bp:true }),
           bien: r => r?.action !== IA.SELECT_POS_CHANGE };
});
pos("recursos", "delante de dos atacantes, el muro no es el Asura Priest",
    "E, 26-09 R1 p1 T6", () => {
  const d = mesa({ mios:{ mano:["Asura Priest","Blade Knight","Sangan"] },
                   suyos:{ campo:[{carta:"Vampire Lord", pos:P.ATK},{carta:"Kycoo the Ghost Destroyer", pos:P.ATK}],
                           mano:["Sangan","Heavy Storm","Scapegoat"] }, turno:6 });
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ invoca:h, coloca:h, bp:true }),
           bien: r => r?.action === IA.SELECT_MONSTER_SET && r?.index !== 0 };
});
pos("recursos", "Rescue Cat no se coloca de muro teniendo un Sangan",
    "E, 26-09 R2 (la colocó tres veces)", () => {
  const d = mesa({ mios:{ mano:["Rescue Cat","Sangan"] },
                   suyos:{ campo:[{carta:"Ryu Kokki", pos:P.ATK}], mano:["Pyramid Turtle","Book of Life","Snatch Steal"] }, turno:6 });
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ coloca:h, bp:true }),
           bien: r => !(r?.action === IA.SELECT_MONSTER_SET && r?.index === 0) };
});
pos("no malgastar", "Mind Control en la Main Phase 2: lo robado no ataca ni se tributa",
    "E, 26-09 R3 p2: «jugar Mind Control para no pegar… no merece la pena nunca»", () => {
  const d = mesa({ mios:{ mano:["Mind Control"] },
                   suyos:{ campo:[{carta:"Vampire Lord", pos:P.ATK}] }, fase:0x100 });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]], bp:false }),
           bien: (r, cb) => r?.action !== IA.SELECT_ACTIVATE && vetadoEnPlan(cb, IA.SELECT_ACTIVATE) };
});
pos("no malgastar", "…ni en la Main Phase 1 si quitarle el monstruo no abre nada",
    "E, 26-09 R3 p2 T3 (robó una Giant Rat y terminó sin batalla)", () => {
  const d = mesa({ mios:{ mano:["Mind Control"] },
                   suyos:{ campo:[{carta:"Giant Rat", pos:P.ATK}] } });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]], bp:true }),
           bien: (r, cb) => r?.action !== IA.SELECT_ACTIVATE && vetadoEnPlan(cb, IA.SELECT_ACTIVATE) };
});
pos("rematar", "Mind Control le quita el único muro y el golpe es letal",
    "contraejemplo del anterior", () => {
  const d = mesa({ mios:{ mano:["Mind Control"], campo:[{carta:"Airknight Parshath", pos:P.ATK}] },
                   suyos:{ campo:[{carta:"Big Shield Gardna", pos:P.DEF}] }, lp:[8000,1900] });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]], bp:true }),
           bien: r => r?.action === IA.SELECT_ACTIVATE };
});
pos("elegir la mejor", "Tribe-Infecting Virus mata a la Giant Rat por efecto: en combate flota",
    "E, 26-09 R2 p2 T2: «¿no es mejor activar el efecto para que no se dispare mi Giant Rat?»", () => {
  const d = mesa({ mios:{ campo:[{carta:"Tribe-Infecting Virus", pos:P.ATK}], mano:["Nobleman of Crossout","Rescue Cat"] },
                   suyos:{ campo:[{carta:"Giant Rat", pos:P.ATK}], mano:["Pyramid Turtle","Book of Moon","Snatch Steal"] } });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.MZONE][0]], bp:true }),
           bien: r => r?.action === IA.SELECT_ACTIVATE };
});
pos("no malgastar", "…pero no gasta el descarte en un Sangan, que flota muera como muera",
    "control del anterior", () => {
  const d = mesa({ mios:{ campo:[{carta:"Tribe-Infecting Virus", pos:P.ATK}], mano:["Nobleman of Crossout","Rescue Cat"] },
                   suyos:{ campo:[{carta:"Sangan", pos:P.ATK}], mano:["Pyramid Turtle","Book of Moon","Snatch Steal"] } });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.MZONE][0]], bp:true }),
           bien: r => r?.action !== IA.SELECT_ACTIVATE };
});
pos("recursos", "con 8 cartas en la mano, la Sakuretsu se coloca, y sin votación",
    "E, 26-09 R3 p2 T3: «es mejor colocarla que descartarla al final del turno»", () => {
  const d = mesa({ mios:{ mano:["Sakuretsu Armor","Mystic Tomato","Mystic Tomato","Upstart Goblin","Upstart Goblin",
                                "Book of Taiyou","The Shallow Grave","Card Destruction"] },
                   suyos:{ campo:[{carta:"Giant Rat", pos:P.ATK}], mano:["Sangan","Heavy Storm"] } });
  return { d, q: preguntaIdle({ colocaMT:[d.zones[0][L.HAND][0]], bp:false }),
           bien: (r, cb) => r?.action === IA.SELECT_SPELL_SET
                 && (cb.ultimoPlan?.() ?? []).some(x => x.action === IA.SELECT_SPELL_SET && x.index === 0 && x.seguro) };
});
pos("sin programar", "Empty Jar: Serial Spell se encadena a su propio Card Destruction",
    "E, 26-09 R3 p1 T3 (el combo del mazo; «no me encadeno a mi propia carta» se lo comía)", () => {
  const d = mesa({ mios:{ mt:[{carta:"Serial Spell", pos:P.TAPADA}], mano:["Giant Trunade","Reload"] },
                   suyos:{ mano:["Sangan","Heavy Storm","Scapegoat","Book of Moon","Pot of Greed"] },
                   mazoMio: LISTA_EMPTY_JAR });
  d.cadena = [{ code:cod("Card Destruction"), controller:0, uid:998 }];
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]),
           bien: r => r?.index === 0 };
});
pos("recursos", "Pot of Greed con 3 cartas en el mazo: me deja a un robo de perder",
    "E, 26-09 R3 p1 (la IA se quedó con 3 cartas de mazo en el turno 7)", () => {
  const d = mesa({ mios:{ mano:["Pot of Greed"] }, suyos:{ campo:[{carta:"Giant Rat", pos:P.ATK}] } });
  ["Mystic Tomato","Sangan","Reload"].forEach((n, i) => {
    const c = { code:cod(n), uid:900+i, controller:0, location:L.DECK, sequence:i, position:P.TAPADA };
    d.zones[0][L.DECK].push(c); d.cards.set(c.uid, c);
  });
  ["Giant Rat","Sangan","Pyramid Turtle","Ryu Kokki","Vampire Lord","Book of Life","Snatch Steal","Heavy Storm","Scapegoat","Mirror Force"].forEach((n, i) => {
    const c = { code:cod(n), uid:950+i, controller:1, location:L.DECK, sequence:i, position:P.TAPADA };
    d.zones[1][L.DECK].push(c); d.cards.set(c.uid, c);
  });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]], bp:true }),
           bien: r => r?.action !== IA.SELECT_ACTIVATE };
});

/* ══════════════ REPLAYS DE TORNEO (GFCEU 2026, 29-09) ══════════════
   De aquí en adelante las posiciones salen de replays de DuelingBook de
   jugadores de torneo (engine/replays/), comparados con lo que hace la IA
   en las mismas situaciones (comparar-replays.mjs). No son la jugada
   «correcta» por decreto: son hábitos que repiten casi todos los
   jugadores y que la IA no tenía, con la regla del juego que los explica. */

/* Oddisee (Warrior) contra Evil Barl Waite, final, duelo 3, T15: Evil
   coloca Nobleman en su Main Phase 2 y pasa; Oddisee le tira la MST en
   la End Phase. Lo colocado este turno no puede encadenarse. */
pos("replays de torneo", "MST en la End Phase del rival a lo que acaba de colocar",
    "GFCEU 2026, final, duelo 3, T15", () => {
  const d = mesa({ mios:{ mano:["Mystical Space Typhoon"] },
                   suyos:{ mt:[{carta:"Nobleman of Crossout",pos:P.TAPADA,puesta:15}] },
                   turnPlayer:1, fase:0x200, turno:15 });
  return { d, q: preguntaCadena([d.zones[0][L.HAND][0]]), bien: r => r?.index === 0 };
});
pos("replays de torneo", "…y la MST va a la recién colocada, no a la que ya tuvo un turno",
    "GFCEU 2026, regla de la End Phase", () => {
  const d = mesa({ suyos:{ mt:[{carta:"Sakuretsu Armor",pos:P.TAPADA,puesta:12},{carta:"Nobleman of Crossout",pos:P.TAPADA,puesta:15}] },
                   turnPlayer:1, fase:0x200, turno:15 });
  d.cadena = [{ code:cod("Mystical Space Typhoon"), controller:0, uid:998 }];
  const s = d.zones[1][L.SZONE];
  return { d, q: preguntaObjetivo([s[0], s[1]]), bien: r => (r?.indicies ?? [])[0] === 1 };
});
pos("replays de torneo", "Dust Tornado colocada, en la End Phase del rival, a lo que acaba de colocar",
    "GFCEU 2026: 60 % de las Dust Tornado de torneo van ahí", () => {
  const d = mesa({ mios:{ mt:[{carta:"Dust Tornado",pos:P.TAPADA,puesta:12}] },
                   suyos:{ mt:[{carta:"Mirror Force",pos:P.TAPADA,puesta:13}] },
                   turnPlayer:1, fase:0x200, turno:13 });
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), bien: r => r?.index === 0 };
});
pos("replays de torneo", "…pero si lo suyo lleva puesto desde otro turno, la End Phase no tiene nada de especial",
    "control: sin esto la MST se tiraría en cada End Phase", () => {
  const d = mesa({ mios:{ mano:["Mystical Space Typhoon"] },
                   suyos:{ mt:[{carta:"Mirror Force",pos:P.TAPADA,puesta:10}] },
                   turnPlayer:1, fase:0x200, turno:13 });
  return { d, q: preguntaCadena([d.zones[0][L.HAND][0]]), bien: r => r?.index == null };
});
pos("replays de torneo", "…ni en su Main Phase: todavía puede colocar más",
    "control", () => {
  const d = mesa({ mios:{ mano:["Mystical Space Typhoon"] },
                   suyos:{ mt:[{carta:"Mirror Force",pos:P.TAPADA,puesta:13}] },
                   turnPlayer:1, fase:0x4, turno:13 });
  return { d, q: preguntaCadena([d.zones[0][L.HAND][0]]), bien: r => r?.index == null };
});

/* Dekoichi (volteo: roba una carta) con el campo rival vacío: 17 de 19
   veces los jugadores lo colocan. De frente pega 1400 una vez y se queda
   sin su robo; colocado, el robo llega igual cuando lo volteen o lo ataquen. */
pos("replays de torneo", "Dekoichi con su campo vacío: se coloca (el robo vale más que 1400 de daño)",
    "GFCEU 2026: 17 de 19 veces colocado con el campo rival vacío", () => {
  const d = mesa({ mios:{ mano:["Dekoichi the Battlechanted Locomotive","Pot of Greed"] },
                   suyos:{ mt:[{carta:"Mirror Force",pos:P.TAPADA,puesta:5}], mano:["Sangan","Heavy Storm","Book of Moon"] }, turno:6 });
  const c = d.zones[0][L.HAND][0];
  return { d, q: preguntaIdle({ invoca:[c], coloca:[c], bp:true }), bien: r => r?.action === IA.SELECT_MONSTER_SET };
});
pos("replays de torneo", "…salvo que con esos 1400 remate",
    "control", () => {
  const d = mesa({ mios:{ mano:["Dekoichi the Battlechanted Locomotive"] }, suyos:{}, lp:[8000,1400], turno:6 });
  const c = d.zones[0][L.HAND][0];
  return { d, q: preguntaIdle({ invoca:[c], coloca:[c], bp:true }), bien: r => r?.action === IA.SELECT_SUMMON };
});
/* Sangan: 32 de 41 colocado. Con el campo rival vacío, 9 de 12. */
pos("replays de torneo", "Sangan con su campo vacío: se coloca",
    "GFCEU 2026: 9 de 12 veces colocado con el campo rival vacío", () => {
  const d = mesa({ mios:{ mano:["Sangan","Pot of Greed"] },
                   suyos:{ mt:[{carta:"Sakuretsu Armor",pos:P.TAPADA,puesta:5}], mano:["Breaker the Magical Warrior","Heavy Storm","Book of Moon"] }, turno:6 });
  const c = d.zones[0][L.HAND][0];
  return { d, q: preguntaIdle({ invoca:[c], coloca:[c], bp:true }), bien: r => r?.action === IA.SELECT_MONSTER_SET };
});
pos("replays de torneo", "Sangan delante de un Blade Knight: se coloca",
    "GFCEU 2026", () => {
  const d = mesa({ mios:{ mano:["Sangan"] }, suyos:{ campo:[{carta:"Blade Knight",pos:P.ATK}] }, turno:6 });
  const c = d.zones[0][L.HAND][0];
  return { d, q: preguntaIdle({ invoca:[c], coloca:[c], bp:true }), bien: r => r?.action === IA.SELECT_MONSTER_SET };
});
/* Sinister Serpent: los jugadores lo COLOCAN de muro (45 de 55 veces que
   lo bajan): si lo destruyen vuelve a la mano en mi Standby, así que es un
   bloqueo gratis cada turno. Nunca de frente. */
pos("replays de torneo", "Sinister Serpent de muro con mi campo vacío y un Blade Knight enfrente",
    "GFCEU 2026: Serpent colocado 45 de 55 veces", () => {
  const d = mesa({ mios:{ mano:["Sinister Serpent","Heavy Storm"] }, suyos:{ campo:[{carta:"Blade Knight",pos:P.ATK}] }, turno:7 });
  const c = d.zones[0][L.HAND][0];
  return { d, q: preguntaIdle({ invoca:[c], coloca:[c], bp:true }), bien: r => r?.action === IA.SELECT_MONSTER_SET };
});
pos("replays de torneo", "…pero si tengo otro monstruo que colocar, ese va antes y el Serpent se queda",
    "control", () => {
  const d = mesa({ mios:{ mano:["Sinister Serpent","Gravekeeper's Spy"] }, suyos:{ campo:[{carta:"Blade Knight",pos:P.ATK}] }, turno:7 });
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ invoca:[h[0],h[1]], coloca:[h[0],h[1]], bp:true }), bien: r => r?.action === IA.SELECT_MONSTER_SET && r.index === 1 };
});
pos("replays de torneo", "…y de frente, nunca",
    "control (E, 18-09: «turno 9 sinister serpent en atk?»)", () => {
  const d = mesa({ mios:{ mano:["Sinister Serpent"] }, suyos:{}, turno:9 });
  const c = d.zones[0][L.HAND][0];
  return { d, q: preguntaIdle({ invoca:[c], coloca:[c], bp:true }), bien: r => r?.action !== IA.SELECT_SUMMON };
});

pos("replays de torneo", "…ni se levanta después para pegar 300 con su campo vacío",
    "control (E, 18-09: «turno 9 sinister serpent en atk?»)", () => {
  const d = mesa({ mios:{ campo:[{carta:"Sinister Serpent",pos:P.TAPADA|P.DEF}] }, suyos:{}, turno:9 });
  const c = d.zones[0][L.MZONE][0];
  return { d, q: preguntaIdle({ giros:[c], bp:true }), bien: r => r?.action !== IA.SELECT_POS_CHANGE };
});

/* Turno 1 del que empieza, sin batalla: los jugadores guardan los
   atacantes (Breaker 0 %, TIV 0 %) y bajan backrow o un muro. */
pos("replays de torneo", "turno 1: Breaker no sale de frente (no ataca ni tiene nada que romper)",
    "GFCEU 2026: la IA 14 %, los jugadores 0 %", () => {
  const d = mesa({ mios:{ mano:["Breaker the Magical Warrior","Blade Knight","Mirror Force","Scapegoat","Pot of Greed","Heavy Storm"] }, suyos:{}, turno:1 });
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ invoca:[h[0],h[1]], coloca:[h[0],h[1]], colocaMT:[h[2],h[3]], bp:false }),
           bien: r => r?.action !== IA.SELECT_SUMMON };
});
pos("replays de torneo", "turno 1: Tsukuyomi tampoco (no hay nada que tumbar y vuelve a la mano)",
    "GFCEU 2026: la IA 9 %, los jugadores 0 %", () => {
  const d = mesa({ mios:{ mano:["Tsukuyomi","Sakuretsu Armor","Graceful Charity","Book of Moon","Snatch Steal","Nobleman of Crossout"] }, suyos:{}, turno:1 });
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ invoca:[h[0]], coloca:[h[0]], colocaMT:[h[1],h[3]], bp:false }),
           bien: r => r?.action !== IA.SELECT_SUMMON };
});
pos("replays de torneo", "turno 1: D.D. Warrior Lady sí puede salir de frente (disuade)",
    "control: los jugadores lo hacen (10 % de los turnos 1)", () => {
  const d = mesa({ mios:{ mano:["D.D. Warrior Lady","Sakuretsu Armor","Pot of Greed"] }, suyos:{}, turno:1 });
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ invoca:[h[0]], coloca:[h[0]], bp:false }),
           bien: r => r?.action === IA.SELECT_SUMMON, regular: r => r?.action === IA.SELECT_MONSTER_SET };
});
pos("replays de torneo", "…y con batalla, el Breaker sí sale",
    "control", () => {
  const d = mesa({ mios:{ mano:["Breaker the Magical Warrior"] }, suyos:{}, turno:3 });
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ invoca:[h[0]], coloca:[h[0]], bp:true }), bien: r => r?.action === IA.SELECT_SUMMON };
});

/* ══════════════ LA PRIORIDAD (01-10) ══════════════
   Ver check-prioridad.mjs: tras invocar, el jugador del turno puede usar
   un efecto de ignición antes de que el rival responda; si lo pasa, el
   rival responde en ESA ventana y ya no hay otra. */
const recienInvocado = (d, c, kind = "normal") => { d.ultimaInvocada = { uid:c.uid, turno:d.turnCount, kind }; return d; };
const BLS = "Black Luster Soldier - Envoy of the Beginning";
pos("prioridad", "BLS recién invocado: el destierro con prioridad, antes de que le respondan",
    "goatformat, «6 Facts About Priority»; E, 01-10", () => {
  const d = mesa({ mios:{ campo:[BLS] }, suyos:{ campo:["Airknight Parshath"], mt:["Ring of Destruction","Book of Moon"] }, turno:6 });
  recienInvocado(d, d.zones[0][L.MZONE][0], "special");
  return { d, q: preguntaCadena([d.zones[0][L.MZONE][0]]), bien: r => r?.index === 0 };
});
pos("prioridad", "Tribe-Infecting Virus recién invocado contra dos Guerreros: el efecto con prioridad",
    "goatformat, Basic Mechanics: «before Player B can activate Book of Moon»", () => {
  const d = mesa({ mios:{ campo:["Tribe-Infecting Virus"], mano:["Sangan","Heavy Storm"] },
                   suyos:{ campo:["Blade Knight","D.D. Warrior Lady"], mt:["Book of Moon"] }, turno:6 });
  recienInvocado(d, d.zones[0][L.MZONE][0]);
  return { d, q: preguntaCadena([d.zones[0][L.MZONE][0]]), bien: r => r?.index === 0 };
});
pos("prioridad", "…pero si el efecto no compensa, no se usa (TIV contra una sola ficha)",
    "control", () => {
  const d = mesa({ mios:{ campo:["Tribe-Infecting Virus"], mano:["Breaker the Magical Warrior"] },
                   suyos:{ campo:[{carta:"Sheep Token",pos:P.DEF}] }, turno:6 });
  recienInvocado(d, d.zones[0][L.MZONE][0]);
  return { d, q: preguntaCadena([d.zones[0][L.MZONE][0]]), bien: r => r?.index == null };
});
pos("prioridad", "TIV: declara el tipo que le quita más a él y menos a mí (Hada, no Guerrero)",
    "E, 01-10: el tipo lo declaraba el piloto genérico (el primero de la lista)", () => {
  const d = mesa({ mios:{ campo:["Tribe-Infecting Virus","D.D. Warrior Lady"] },
                   suyos:{ campo:["Airknight Parshath","Blade Knight"] }, turno:6 });
  return { d, q: { type: MT.ANNOUNCE_RACE, player:0, count:1, available: 0x1FFFFFn },
           bien: r => (r?.races ?? []).map(Number)[0] === 0x4 };
});
pos("prioridad", "TIV: contra dos Guerreros y sin Guerreros míos, Guerrero",
    "control", () => {
  const d = mesa({ mios:{ campo:["Tribe-Infecting Virus","Breaker the Magical Warrior"] },
                   suyos:{ campo:["Blade Knight","D.D. Warrior Lady"] }, turno:6 });
  return { d, q: { type: MT.ANNOUNCE_RACE, player:0, count:1, available: 0x1FFFFFn },
           bien: r => (r?.races ?? []).map(Number)[0] === 0x1 };
});
pos("prioridad", "TIV en la Main Phase: no se activa si el único tipo suyo me cuesta más a mí",
    "control: ahora se valora el tipo entero, no un objetivo", () => {
  const d = mesa({ mios:{ campo:["Tribe-Infecting Virus","Blade Knight","D.D. Warrior Lady"], mano:["Sangan"] },
                   suyos:{ campo:["Exiled Force"] }, turno:6 });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.MZONE][0]], bp:true }), bien: r => r?.action !== IA.SELECT_ACTIVATE };
});
pos("prioridad", "el rival invoca BLS y me pasa la ventana: Book of Moon ahora (después ya no lo para)",
    "goatformat: una sola ventana para responder a la invocación", () => {
  const d = mesa({ mios:{ campo:["Breaker the Magical Warrior"], mt:["Book of Moon"] }, suyos:{ campo:[BLS] }, turnPlayer:1, turno:7 });
  recienInvocado(d, d.zones[1][L.MZONE][0], "special");
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), bien: r => r?.index === 0 };
});
pos("prioridad", "…y el Book of Moon va al BLS recién invocado, no a otro",
    "objetivo", () => {
  const d = mesa({ mios:{ campo:["Breaker the Magical Warrior"] }, suyos:{ campo:["Airknight Parshath", BLS] }, turnPlayer:1, turno:7 });
  recienInvocado(d, d.zones[1][L.MZONE][1], "special");
  d.cadena = [{ code:cod("Book of Moon"), controller:0, uid:997 }];
  const z = d.zones[1][L.MZONE];
  return { d, q: preguntaObjetivo([z[0], z[1]]), bien: r => (r?.indicies ?? [])[0] === 1 };
});
pos("prioridad", "el rival invoca Chaos Sorcerer y me pasa la ventana: Ring ahora",
    "replays del GFCEU 2026: Ring es la respuesta más repetida a la invocación", () => {
  const d = mesa({ mios:{ campo:["Breaker the Magical Warrior"], mt:["Ring of Destruction"] }, suyos:{ campo:["Chaos Sorcerer"] }, turnPlayer:1, turno:7 });
  recienInvocado(d, d.zones[1][L.MZONE][0], "special");
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), bien: r => r?.index === 0 };
});
pos("prioridad", "…pero un Blade Knight recién invocado no tiene nada que usar: la Book of Moon espera",
    "control (Book of Moon en su Main Phase: -1)", () => {
  const d = mesa({ mios:{ campo:["Breaker the Magical Warrior"], mt:["Book of Moon"] }, suyos:{ campo:["Blade Knight"] }, turnPlayer:1, turno:7 });
  recienInvocado(d, d.zones[1][L.MZONE][0]);
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), bien: r => r?.index == null };
});
pos("prioridad", "…ni un Chaos Sorcerer que no tiene nada mío boca arriba que desterrar",
    "control", () => {
  const d = mesa({ mios:{ campo:[{carta:"Gravekeeper's Spy",pos:P.TAPADA|P.DEF}], mt:["Book of Moon"] }, suyos:{ campo:["Chaos Sorcerer"] }, turnPlayer:1, turno:7 });
  recienInvocado(d, d.zones[1][L.MZONE][0], "special");
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), bien: r => r?.index == null };
});

pos("replays de torneo", "Magician of Faith con el cementerio sin mágicas: se guarda",
    "replays 01-10: colocada con una mágica en el cementerio en 182 de 191 casos", () => {
  const d = mesa({ mios:{ mano:["Magician of Faith","Sakuretsu Armor","Book of Moon"] }, suyos:{}, turno:1 });
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ invoca:[h[0]], coloca:[h[0]], colocaMT:[h[1]], bp:false }),
           bien: r => r?.action !== IA.SELECT_MONSTER_SET && r?.action !== IA.SELECT_SUMMON };
});
pos("replays de torneo", "…y con un Pot of Greed ya en el cementerio, se coloca",
    "control", () => {
  const d = mesa({ mios:{ mano:["Magician of Faith"], gy:["Pot of Greed"] }, suyos:{}, turno:3 });
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ invoca:[h[0]], coloca:[h[0]], bp:true }), bien: r => r?.action === IA.SELECT_MONSTER_SET };
});

/* ══════════════ TORNEO DEL 02-10 (Bo3 contra los meta) ══════════════
   Cinco Bo3 de E con su Zombie: Goat Control, Library FTK (dos veces),
   Warrior y Zombie Goat Control. Cada posición falla en 4e0a72e. */
const enMazo = (d, nombres, p = 0) => nombres.map((n, i) => {
  const c = { uid: 9000 + p*100 + i, code: cod(n), controller:p, owner:p, location:L.DECK, sequence:i, position:0 };
  d.zones[p][L.DECK].push(c); d.cards.set(c.uid, c); return c; });
const BUSCA = ["Dark Mimic LV1","Sinister Serpent","D.D. Warrior Lady","Tsukuyomi","Magician of Faith"];

pos("torneo 02-10", "Sangan busca Magician of Faith con Pot of Greed y Heavy Storm en el cementerio",
    "E, 02-10 (Goat Control, p1, T3): «seguro que hay mejores cartas que buscar con Sangan que el cofre»", () => {
  const d = mesa({ mios:{ campo:[{carta:"Airknight Parshath",pos:P.TAPADA|P.DEF}], gy:["Sangan","Pot of Greed","Heavy Storm"],
                          mano:["Nobleman of Crossout","Metamorphosis"] },
                   suyos:{ mt:["Book of Moon"] }, turno:5 });
  const deck = enMazo(d, BUSCA);
  d.cadena = [{ code:cod("Sangan"), controller:0, uid:997 }];
  return { d, q: preguntaObjetivo(deck), bien: r => (r?.indicies ?? [])[0] === 4 };
});
pos("torneo 02-10", "…y contra un Ryu Kokki de frente, sin mágicas que recuperar, D.D. Warrior Lady",
    "control", () => {
  const d = mesa({ mios:{ gy:["Sangan"] }, suyos:{ campo:["Ryu Kokki"] }, turno:5 });
  const deck = enMazo(d, BUSCA);
  d.cadena = [{ code:cod("Sangan"), controller:0, uid:997 }];
  return { d, q: preguntaObjetivo(deck), bien: r => (r?.indicies ?? [])[0] === 2 };
});
pos("torneo 02-10", "turno 1 sin batalla: Breaker no sale aunque empate con colocar trampas",
    "E, 02-10 (Warrior, p1, T1): Creature Swap se llevó el Breaker y rompió la Mirror Force", () => {
  const d = mesa({ mios:{ mano:["Sinister Serpent","Magician of Faith","Mirror Force","Torrential Tribute","Breaker the Magical Warrior"],
                          mt:["Scapegoat"] }, suyos:{}, turno:1 });
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ invoca:[h[0],h[1],h[4]], coloca:[h[0],h[1],h[4]], colocaMT:[h[2],h[3]], bp:false }),
           bien: r => r?.action !== IA.SELECT_SUMMON };
});
pos("torneo 02-10", "Asura Priest no ataca a la Pyramid Turtle: le sacaría un Ryu Kokki y Asura se va a la mano",
    "E, 02-10 (Goat Control, p2, T4): «matarme la Pyramid Turtle abre la puerta a Ryu Kokki o Vampire Lord gratis»", () => {
  const d = mesa({ mios:{ campo:["Asura Priest"] }, suyos:{ campo:["Pyramid Turtle"] }, lp:[6700,6200], turno:4 });
  return { d, q: preguntaBatalla([d.zones[0][L.MZONE][0]]), bien: r => r?.action !== BA.SELECT_BATTLE };
});
pos("torneo 02-10", "…pero a la Giant Rat sí (lo que saca no le gana)",
    "control", () => {
  const d = mesa({ mios:{ campo:["Asura Priest"] }, suyos:{ campo:["Giant Rat"] }, lp:[6700,6200], turno:4 });
  return { d, q: preguntaBatalla([d.zones[0][L.MZONE][0]]), bien: r => r?.action === BA.SELECT_BATTLE };
});
pos("torneo 02-10", "Sinister Serpent tapado no se voltea contra un Kycoo tapado",
    "E, 02-10 (Goat Control, p3, T27): «¿por qué flippea la serpiente?»", () => {
  const d = mesa({ mios:{ campo:[{carta:"Sinister Serpent",pos:P.TAPADA|P.DEF}] },
                   suyos:{ campo:[{carta:"Kycoo the Ghost Destroyer",pos:P.TAPADA|P.DEF}] }, turno:27 });
  return { d, q: preguntaIdle({ giros:[d.zones[0][L.MZONE][0]], bp:true }), bien: r => r?.action !== IA.SELECT_POS_CHANGE };
});
pos("torneo 02-10", "Scapegoat no sale al entrar él en batalla si tengo un monstruo",
    "E, 02-10 (Warrior, p1, T2): «cuando vaya a pegarte directamente, ahí sí»", () => {
  const d = mesa({ mios:{ campo:["Giant Rat"], mt:["Scapegoat"] }, suyos:{ campo:["Breaker the Magical Warrior"] },
                   turnPlayer:1, fase:0x8, turno:2 });
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), bien: r => r?.index == null };
});
pos("torneo 02-10", "…y sí contra el ataque directo declarado",
    "control", () => {
  const d = mesa({ mios:{ mt:["Scapegoat"] }, suyos:{ campo:["Breaker the Magical Warrior"] }, turnPlayer:1, fase:0x8, turno:2 });
  const atk = d.zones[1][L.MZONE][0];
  d.atacante = { uid:atk.uid, code:atk.code, controller:1 };
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), bien: r => r?.index === 0 };
});
pos("torneo 02-10", "Book of Moon no va a un Spirit Reaper ya en defensa cuando el atacante ya murió",
    "E, 02-10 (Warrior, p2, T4): «no tiene sentido hacer Book of Moon a algo que ya he puesto yo en defensa»", () => {
  const d = mesa({ mios:{ mt:["Book of Moon"] }, suyos:{ campo:[{carta:"Spirit Reaper",pos:P.DEF}] }, turnPlayer:1, fase:0x8, turno:4 });
  d.atacante = { uid:4242, code:cod("D.D. Warrior Lady"), controller:1 };   // destruida por la Sakuretsu
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), bien: r => r?.index == null };
});
pos("torneo 02-10", "Book of Moon no salva un Sinister Serpent tapado (vuelve solo a la mano)",
    "E, 02-10 (Goat Control, p3, T12 y T26)", () => {
  const d = mesa({ mios:{ campo:[{carta:"Sinister Serpent",pos:P.TAPADA|P.DEF}], mt:["Book of Moon"] },
                   suyos:{ campo:["Kycoo the Ghost Destroyer"] }, turnPlayer:1, fase:0x8, turno:12 });
  const atk = d.zones[1][L.MZONE][0];
  d.atacante = { uid:atk.uid, code:atk.code, controller:1 };
  d.objetivoAtaque = { uid:d.zones[0][L.MZONE][0].uid, code:d.zones[0][L.MZONE][0].code, controller:0 };
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), bien: r => r?.index == null };
});
pos("torneo 02-10", "…ni una ficha de Scapegoat",
    "E, 02-10 (Zombie, p2, T6)", () => {
  const d = mesa({ mios:{ campo:[{carta:"Sheep Token",pos:P.DEF},{carta:"Sheep Token",pos:P.DEF}], mt:["Book of Moon"] },
                   suyos:{ campo:["D.D. Warrior Lady"] }, turnPlayer:1, fase:0x8, turno:6 });
  const atk = d.zones[1][L.MZONE][0];
  d.atacante = { uid:atk.uid, code:atk.code, controller:1 };
  d.objetivoAtaque = { uid:d.zones[0][L.MZONE][0].uid, code:d.zones[0][L.MZONE][0].code, controller:0 };
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), bien: r => r?.index == null };
});
pos("torneo 02-10", "Sakuretsu se guarda ante un Spirit Reaper (mano vacía) con una Lily detrás",
    "E, 02-10 (Warrior, p2, T6): «la Sakuretsu hay que guardársela para Lily»", () => {
  const d = mesa({ mios:{ mt:["Sakuretsu Armor"] }, suyos:{ campo:["Spirit Reaper","Injection Fairy Lily"] },
                   lp:[6700,6000], turnPlayer:1, fase:0x8, turno:6 });
  const atk = d.zones[1][L.MZONE][0];
  d.atacante = { uid:atk.uid, code:atk.code, controller:1 };
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), bien: r => r?.index == null };
});
pos("torneo 02-10", "…y se usa contra la Lily (pega con 3400)",
    "control", () => {
  const d = mesa({ mios:{ mt:["Sakuretsu Armor"] }, suyos:{ campo:["Injection Fairy Lily"] },
                   lp:[6700,6000], turnPlayer:1, fase:0x8, turno:6 });
  const atk = d.zones[1][L.MZONE][0];
  d.atacante = { uid:atk.uid, code:atk.code, controller:1 };
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), bien: r => r?.index === 0 };
});
pos("torneo 02-10", "BLS destierra a la Lily, no al Ryu Kokki (la Lily es la única que le pasa por encima)",
    "E, 02-10 (Zombie, p2, T22)", () => {
  const d = mesa({ mios:{ campo:["Black Luster Soldier - Envoy of the Beginning"] },
                   suyos:{ campo:["Vampire Lord","Injection Fairy Lily","Ryu Kokki"], mt:["Royal Decree"] },
                   lp:[1600,4500], turno:21 });
  d.cadena = [{ code:cod("Black Luster Soldier - Envoy of the Beginning"), controller:0, uid:d.zones[0][L.MZONE][0].uid }];
  const s = d.zones[1][L.MZONE];
  return { d, q: preguntaObjetivo([s[0], s[1], s[2]]), bien: r => (r?.indicies ?? [])[0] === 1 };
});
pos("torneo 02-10", "Creature Swap con mi único monstruo bueno: no (él me daría su peor)",
    "E, 02-10 (Zombie, p2, T24): «¿Creature Swap y me das tu Vampire Lord? vaya misplay»", () => {
  const d = mesa({ mios:{ campo:[{carta:"Vampire Lord",pos:P.DEF}], mano:["Creature Swap","Magician of Faith"] },
                   suyos:{ campo:["Vampire Lord","Injection Fairy Lily",{carta:"Giant Rat",pos:P.TAPADA|P.DEF}] },
                   lp:[1200,2500], turno:23 });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]], bp:true }), bien: r => r?.action !== IA.SELECT_ACTIVATE };
});
pos("torneo 02-10", "…con una ficha que darle y nada flojo suyo, sí",
    "control", () => {
  const d = mesa({ mios:{ campo:[{carta:"Sheep Token",pos:P.DEF}], mano:["Creature Swap"] },
                   suyos:{ campo:["Vampire Lord"] }, turno:9 });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]], bp:true }), bien: r => r?.action === IA.SELECT_ACTIVATE };
});
pos("torneo 02-10", "Snatch Steal no se gasta en una Pyramid Turtle",
    "E, 02-10 (Zombie, p1, T10): el log decía «la guardo» y la jugó; la Turtle murió y le sacó un Ryu Kokki", () => {
  const d = mesa({ mios:{ mano:["Snatch Steal","Sinister Serpent"], campo:[{carta:"Sinister Serpent",pos:P.TAPADA|P.DEF}] },
                   suyos:{ campo:["Pyramid Turtle"] }, lp:[6000,5150], turno:10 });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]], bp:true }), bien: r => r?.action !== IA.SELECT_ACTIVATE };
});
pos("torneo 02-10", "no se tributa el Thousand-Eyes Restrict para colocar un Airknight (las fichas no se tributan)",
    "E, 02-10 (Goat Control, p3, T5)", () => {
  const d = mesa({ mios:{ campo:[{carta:"Thousand-Eyes Restrict",pos:P.TAPADA|P.DEF},{carta:"Sheep Token",pos:P.DEF},{carta:"Sheep Token",pos:P.DEF},{carta:"Sheep Token",pos:P.DEF}],
                          mano:["Airknight Parshath","Nobleman of Crossout"] },
                   suyos:{ campo:["Injection Fairy Lily"], mt:["Book of Moon"] }, turno:5 });
  const c = d.zones[0][L.HAND][0];
  return { d, q: preguntaIdle({ invoca:[c], coloca:[c], bp:true }), bien: r => r?.action !== IA.SELECT_MONSTER_SET && r?.action !== IA.SELECT_SUMMON };
});
pos("torneo 02-10", "Call of the Haunted no se activa en mi Main Phase 2 para un Blade Knight que ya no pega",
    "E, 02-10 (Zombie, p1, T4): «¿por qué no en la Battle Phase? te da un ataque más»", () => {
  const d = mesa({ mios:{ mt:["Call of the Haunted"], gy:["Blade Knight"], campo:["Tribe-Infecting Virus"] }, suyos:{}, fase:0x100, turno:4 });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.SZONE][0]], bp:false }), bien: r => r?.action !== IA.SELECT_ACTIVATE };
});
pos("torneo 02-10", "…sí en su End Phase (listo para pegar en mi turno)",
    "replays del GFCEU 2026: Call en el turno rival 35 % (la IA 0 %)", () => {
  const d = mesa({ mios:{ mt:["Call of the Haunted"], gy:["Blade Knight"] }, suyos:{ campo:["Giant Rat"] }, turnPlayer:1, fase:0x200, turno:5 });
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), bien: r => r?.index === 0 };
});
pos("torneo 02-10", "…y al entrar yo en batalla, un atacante más",
    "control", () => {
  const d = mesa({ mios:{ mt:["Call of the Haunted"], gy:["Blade Knight"], campo:["Tribe-Infecting Virus"] }, suyos:{}, fase:0x8, turno:6 });
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), bien: r => r?.index === 0 };
});
pos("torneo 02-10", "Library FTK: Archfiend's Oath no se usa a ciegas",
    "E, 02-10 (Library FTK, R2 y R3): pagó 500 por turno hasta quedarse a 100", () => {
  const d = mesa({ mios:{ mt:[{carta:"Archfiend's Oath",pos:P.ATK}], mano:["Toon Table of Contents"] }, suyos:{ campo:["Kycoo the Ghost Destroyer"] }, lp:[4700,8000], turno:3 });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.SZONE][0]], bp:true }), bien: r => r?.action !== IA.SELECT_ACTIVATE };
});
pos("torneo 02-10", "…pero con la carta de arriba a la vista (Convulsion), es un robo por 500",
    "goatformat.com/library-ftk", () => {
  const d = mesa({ mios:{ mt:[{carta:"Archfiend's Oath",pos:P.ATK},{carta:"Convulsion of Nature",pos:P.ATK}] }, suyos:{}, lp:[6000,8000], turno:5 });
  d.cimaMazo = { 0: cod("Black Pendant"), 1: null };
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.SZONE][0]], bp:true }), bien: r => r?.action === IA.SELECT_ACTIVATE };
});
pos("torneo 02-10", "…y declara la carta que ve arriba",
    "goatformat.com/library-ftk", () => {
  const d = mesa({ mios:{ mt:[{carta:"Archfiend's Oath",pos:P.ATK}] }, suyos:{}, turno:5, mazoMio:["Royal Magical Library","Royal Magical Library","Royal Magical Library","Black Pendant"] });
  d.cimaMazo = { 0: cod("Black Pendant"), 1: null };
  d.cadena = [{ code:cod("Archfiend's Oath"), controller:0, uid:d.zones[0][L.SZONE][0].uid }];
  /* Los opcodes de verdad de Archfiend's Oath: «no del Extra Deck». */
  return { d, q: { type: MT.ANNOUNCE_CARD, player:0, opcodes: [0x4802040n, 0x4000010200000000n, 0x4000000700000000n] },
           bien: r => r?.card === cod("Black Pendant") };
});
pos("torneo 02-10", "Library FTK: la Royal Magical Library no se coloca (boca abajo no carga contadores)",
    "E, 02-10 (Library FTK, R2 p1, T1)", () => {
  const d = mesa({ mios:{ mano:["Royal Magical Library","Upstart Goblin","Toon Table of Contents"] }, suyos:{}, turno:1, mazoMio:["Toon World","Toon World"] });
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ invoca:[h[0]], coloca:[h[0]], activa:[h[1],h[2]], bp:false }), bien: r => r?.action !== IA.SELECT_MONSTER_SET };
});
pos("torneo 02-10", "Library FTK: Toon World no se paga por un Toon Table of Contents (no es un Toon)",
    "E, 02-10 (Library FTK, R3 p2, T1)", () => {
  const d = mesa({ mios:{ mano:["Toon World","Toon Table of Contents"] }, suyos:{}, turno:1 });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]], bp:false }), bien: r => r?.action !== IA.SELECT_ACTIVATE };
});
pos("torneo 02-10", "Library FTK: Reversal Quiz sin saber qué hay arriba, nunca",
    "goatformat.com/library-ftk", () => {
  const d = mesa({ mios:{ mano:["Reversal Quiz","Upstart Goblin"], campo:["Royal Magical Library"] }, suyos:{}, lp:[400,8000], turno:7 });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]], bp:false }), bien: r => r?.action !== IA.SELECT_ACTIVATE };
});
pos("torneo 02-10", "…y con la de arriba a la vista, Black Pendant en la mesa y la vida a 500: el cierre",
    "goatformat.com/library-ftk", () => {
  const d = mesa({ mios:{ mano:["Reversal Quiz"], campo:["Royal Magical Library"], mt:[{carta:"Black Pendant",pos:P.ATK},{carta:"Convulsion of Nature",pos:P.ATK}] },
                   suyos:{}, lp:[400,8000], turno:7 });
  d.cimaMazo = { 0: cod("Upstart Goblin"), 1: null };
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]], bp:false }), bien: r => r?.action === IA.SELECT_ACTIVATE };
});


/* ══════════════ EL REINO DEL 03-10 (una run entera de E) ══════════════
   Cinco logs del modo historia, todos con la IA en experto y mazos del
   Reino. Cada posición falla en la versión del 02-10. */
pos("reino 03-10", "Spellbinding Circle antes de girar a defensa (atado, ya no pega)",
    "E, 03-10 (Weevil, T4): «¿para qué pone los monstruos en defensa si ya sabe que va a hacer Spellbinding Circle?»", () => {
  const d = mesa({ mios:{ campo:["Insect Knight"], mt:["Spellbinding Circle"] }, suyos:{ campo:["Goblin Attack Force"] }, turno:4 });
  return { d, q: preguntaIdle({ giros:[d.zones[0][L.MZONE][0]], activa:[d.zones[0][L.SZONE][0]], bp:true }),
           bien: r => r?.action === IA.SELECT_ACTIVATE };
});
pos("reino 03-10", "Man-Eater Bug sacado del mazo (Insect Imitation) sale boca abajo",
    "E, 03-10 (Weevil, T11): «Insect Imitation para sacar Man-Eater Bug… pierdes todo el valor volteándose»", () => {
  const d = mesa({ mios:{}, suyos:{ campo:["Goblin Attack Force"] }, turno:12 });
  return { d, q: preguntaPosicion("Man-Eater Bug", 0x1|0x8), bien: r => r?.position === 0x8 };
});
pos("reino 03-10", "Spellbinding Circle no se gasta en un Baby Dragon que ya le ganan",
    "E, 03-10 (Weevil, T14): «Spellbinding Circle a mi monstruo pequeño no aporta nada»", () => {
  /* Como en el log: la primera Spellbinding ya ata al Goblin Attack Force. */
  const d = mesa({ mios:{ campo:["Neo Bug",{carta:"Insect Knight",pos:P.DEF}], mt:["Spellbinding Circle","Spellbinding Circle"] },
                   suyos:{ campo:["Baby Dragon","Goblin Attack Force"] }, turno:14 });
  const atadura = d.zones[0][L.SZONE][0];
  atadura.position = 0x1; atadura.vinculadoA = d.zones[1][L.MZONE][1].uid;
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.SZONE][1]], bp:true }), bien: r => r?.action !== IA.SELECT_ACTIVATE };
});
pos("reino 03-10", "en la Main Phase 2 no se voltea a ataque «para pegar»",
    "E, 03-10 (Weevil, T26 y T30): «¿por qué le da la vuelta a los monstruos en la Main 2?»", () => {
  const d = mesa({ mios:{ campo:[{carta:"Basic Insect",pos:P.TAPADA|P.DEF},"Killer Needle"] }, suyos:{}, turno:26, fase:0x100 });
  return { d, q: preguntaIdle({ giros:[d.zones[0][L.MZONE][0]], bp:false }), bien: r => r?.action !== IA.SELECT_POS_CHANGE };
});
pos("reino 03-10", "un monstruo de 0 de ATK no se voltea a ataque",
    "E, 03-10 (Weevil, T26): «encima ha puesto un monstruo con 0 de ATK en ataque por ningún motivo»", () => {
  const d = mesa({ mios:{ campo:[{carta:"Cocoon of Evolution",pos:P.TAPADA|P.DEF}] }, suyos:{}, turno:30 });
  return { d, q: preguntaIdle({ giros:[d.zones[0][L.MZONE][0]], bp:true }), bien: r => r?.action !== IA.SELECT_POS_CHANGE };
});
pos("reino 03-10", "…pero un Basic Insect con el campo rival vacío y batalla por delante, sí",
    "control", () => {
  const d = mesa({ mios:{ campo:[{carta:"Basic Insect",pos:P.TAPADA|P.DEF}] }, suyos:{}, turno:26 });
  return { d, q: preguntaIdle({ giros:[d.zones[0][L.MZONE][0]], bp:true }), bien: r => r?.action === IA.SELECT_POS_CHANGE };
});
pos("reino 03-10", "Reinforcements condenada sin nada mío boca arriba: no se le da al rival",
    "E, 03-10 (PaniK, T10): «¿Reinforcements a mi monstruo?» (en respuesta a su Heavy Storm)", () => {
  const d = mesa({ mios:{ campo:[{carta:"Giant Germ",pos:P.DEF},{carta:"Newdoria",pos:P.TAPADA|P.DEF}], mt:["Reinforcements","Sakuretsu Armor"] },
                   suyos:{ campo:["Shining Angel"] }, turnPlayer:1, turno:10 });
  d.cadena = [{ code:cod("Heavy Storm"), controller:1, uid:999 }];
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), bien: r => r?.index == null };
});
pos("reino 03-10", "Reinforcements: el objetivo es mi monstruo, no el suyo",
    "E, 03-10 (Weevil, T44): Reinforcements a su Little-Winguard", () => {
  const d = mesa({ mios:{ campo:["Neo Bug"], mt:["Reinforcements"] }, suyos:{ campo:["Little-Winguard"] }, turno:44 });
  d.cadena = [{ code:cod("Reinforcements"), controller:0, uid:d.zones[0][L.SZONE][0].uid }];
  return { d, q: preguntaObjetivo([d.zones[0][L.MZONE][0], d.zones[1][L.MZONE][0]]), bien: r => (r?.indicies ?? [])[0] === 0 };
});
pos("reino 03-10", "Aqua Madoor (1200/2000) en el turno 1 se coloca",
    "E, 03-10 (Mako, T1): «Aqua Madoor es un monstruo defensivo, ¿por qué lo invoca en ataque?»", () => {
  const d = mesa({ mios:{ mano:["Aqua Madoor","7 Colored Fish"] }, suyos:{}, turno:1 });
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ invoca:[h[0],h[1]], coloca:[h[0],h[1]], bp:false }),
           bien: r => !(r?.action === IA.SELECT_SUMMON && r?.index === 0) };
});
pos("reino 03-10", "Waboku no sale al entrar él en batalla: se espera al ataque",
    "E, 03-10 (Ghost Kaiba, T2): Waboku sin ataque declarado y luego Book of Moon", () => {
  const d = mesa({ mios:{ campo:[{carta:"Battle Ox",pos:P.TAPADA|P.DEF}], mt:["Waboku","Book of Moon"] },
                   suyos:{ campo:["Gearfried the Iron Knight"] }, turnPlayer:1, turno:2, fase:0x8 });
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), bien: r => r?.index == null };
});
pos("reino 03-10", "con Waboku ya activo este turno, Book of Moon al atacante sobra",
    "E, 03-10 (Ghost Kaiba, T2): «al haber hecho ya Waboku, el Book of Moon es overkill»", () => {
  const d = mesa({ mios:{ campo:[{carta:"Battle Ox",pos:P.TAPADA|P.DEF}], mt:["Waboku","Book of Moon"] },
                   suyos:{ campo:["Gearfried the Iron Knight"] }, turnPlayer:1, turno:2, fase:0x8 });
  const atk = d.zones[1][L.MZONE][0];
  d.atacante = { uid:atk.uid, code:atk.code, controller:1 };
  d.objetivoAtaque = { uid:d.zones[0][L.MZONE][0].uid, code:d.zones[0][L.MZONE][0].code, controller:0 };
  return { d, previo: cb => cb(preguntaCadena([d.zones[0][L.SZONE][0]]), 0),
           q: preguntaCadena([d.zones[0][L.SZONE][1]]), bien: r => r?.index == null };
});
pos("reino 03-10", "Solemn Judgment a la invocación por tributo de Mobius (le barrería la Solemn)",
    "E, 03-10 (T5): «igual merece la pena Solemn Judgment a mi Mobius: había opción de que destruyese el Judgment»", () => {
  const d = mesa({ mios:{ mt:["Solemn Judgment","Mystical Space Typhoon","Reinforcements"] },
                   suyos:{ campo:["Mobius the Frost Monarch"] }, lp:[6600,7700], turnPlayer:1, turno:5 });
  recienInvocado(d, d.zones[1][L.MZONE][0]);
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), bien: r => r?.index === 0 };
});
pos("reino 03-10", "…pero no a un Gearfried de nivel 4",
    "control", () => {
  const d = mesa({ mios:{ mt:["Solemn Judgment"], campo:["Archfiend Soldier"] },
                   suyos:{ campo:["Gearfried the Iron Knight"] }, lp:[6600,7700], turnPlayer:1, turno:5 });
  recienInvocado(d, d.zones[1][L.MZONE][0]);
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), bien: r => r?.index == null };
});
pos("reino 03-10", "Breaker se invoca de frente para romper su tapada antes de atacar",
    "E, 03-10 (T10): «¿por qué invoca a Breaker boca abajo? Así pierde el efecto de ganar el contador»", () => {
  /* Como en el log: el Mobius que le robé con Creature Swap, atado por su Spellbinding. */
  const d = mesa({ mios:{ campo:["Mobius the Frost Monarch","Slate Warrior"], mt:["Reinforcements","Ring of Destruction"], mano:["Breaker the Magical Warrior","Smashing Ground"] },
                   suyos:{ mt:["Widespread Ruin","Spellbinding Circle"] }, lp:[4200,7600], turno:10 });
  const sc = d.zones[1][L.SZONE][1]; sc.position = 0x1; sc.vinculadoA = d.zones[0][L.MZONE][0].uid;
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ invoca:[h[0]], coloca:[h[0]], colocaMT:[h[1]], bp:true }),
           bien: r => r?.action === IA.SELECT_SUMMON && r?.index === 0 };
});
/* ══ Reddit, día 2 (05-10) ══ */
pos("reddit 05-10", "Berserk Gorilla obligado a atacar: si no se puede pasar de fase, se ataca",
    "Honest_Mids: «must attack into Mobius due to Berserk Gorilla's eff but he refused to attack and the game is at a standstill»", () => {
  const d = mesa({ mios:{ campo:["Berserk Gorilla"] }, suyos:{ campo:["Mobius the Frost Monarch"] }, turno:6 });
  const q = { ...preguntaBatalla([d.zones[0][L.MZONE][0]]), to_m2:false, to_ep:false };
  return { d, q, bien: r => r?.type === R.SELECT_BATTLECMD && r?.action === BA.SELECT_BATTLE };
});
pos("reddit 05-10", "…y con la fase libre, el Gorilla no se estrella contra Mobius",
    "control: sin obligación, 2000 contra 2400 no se ataca", () => {
  const d = mesa({ mios:{ campo:["Berserk Gorilla"] }, suyos:{ campo:["Mobius the Frost Monarch"] }, turno:6 });
  return { d, q: preguntaBatalla([d.zones[0][L.MZONE][0]]), bien: r => r?.action !== BA.SELECT_BATTLE };
});
pos("reddit 05-10", "Breaker no rompe un Call of the Haunted boca arriba sin monstruo",
    "GeometryFan100: «destroyed my Call of the Haunted (not equipped to anything)… the AI gained nothing»", () => {
  const d = mesa({ mios:{ campo:["Breaker the Magical Warrior"] },
                   suyos:{ campo:[{carta:"Mystical Elf", pos:P.DEF}], mt:[{carta:"Call of the Haunted", pos:P.ATK}] }, turno:6 });
  const b = d.zones[0][L.MZONE][0];
  return { d, q: preguntaIdle({ activa:[b], bp:true }), bien: r => !(r?.action === IA.SELECT_ACTIVATE) };
});
pos("reddit 05-10", "…y si hay que elegir, rompe la tapada antes que el Call of the Haunted muerto",
    "mismo caso, eligiendo objetivo", () => {
  const d = mesa({ mios:{ campo:["Breaker the Magical Warrior"] },
                   suyos:{ mt:[{carta:"Call of the Haunted", pos:P.ATK}, "Mirror Force"] }, turno:6 });
  const [coth, tapada] = d.zones[1][L.SZONE];
  d.cadena = [{ code:d.zones[0][L.MZONE][0].code, controller:0, uid:d.zones[0][L.MZONE][0].uid }];
  return { d, q: preguntaObjetivo([coth, tapada]), bien: r => r?.indicies?.[0] === 1 };
});
pos("reddit 05-10", "con su Waboku ya resuelta no se ataca (ni daño ni destrucción este turno)",
    "GeometryFan100: «I activated Waboku… The AI still decided to attack me with every monster»", () => {
  const d = mesa({ mios:{ campo:["Jinzo","Airknight Parshath"] },
                   suyos:{ campo:[{carta:"Sangan", pos:P.ATK}], mt:["Mirror Force"] }, turno:6 });
  d.resueltasTurno = { turno:6, lista:[{ code:cod("Waboku"), controller:1 }] };
  return { d, q: preguntaBatalla(d.zones[0][L.MZONE].filter(Boolean)), bien: r => r?.action !== BA.SELECT_BATTLE };
});
pos("reddit 05-10", "…sin Waboku, el mismo tablero se ataca",
    "control", () => {
  const d = mesa({ mios:{ campo:["Jinzo","Airknight Parshath"] },
                   suyos:{ campo:[{carta:"Sangan", pos:P.ATK}] }, turno:6 });
  return { d, q: preguntaBatalla(d.zones[0][L.MZONE].filter(Boolean)), bien: r => r?.action === BA.SELECT_BATTLE };
});
pos("reddit 05-10", "Double Coston vale dos tributos: se tributa solo ella",
    "LaSonicSkins: «Double Coston also doesn't work with the double tribute»", () => {
  const d = mesa({ mios:{ campo:["Double Coston","Mystical Elf","Sangan"], mano:["Dark Magician"] }, turno:6 });
  const [dc, elfo, sangan] = d.zones[0][L.MZONE];
  const q = { type: MT.SELECT_TRIBUTE, player:0, can_cancel:false, min:2, max:2,
              selects:[{...ref(dc), release_param:2}, {...ref(elfo), release_param:1}, {...ref(sangan), release_param:1}] };
  return { d, q, bien: r => r?.type === R.SELECT_TRIBUTE && r.indicies?.length === 1 && r.indicies[0] === 0 };
});
/* ══ GitHub y Reddit, Build 1.0 (04-10 a 18-10) ══ */
pos("github 18-10", "con el campo rival vacío, los de defensa se levantan para el letal",
    "Jekzie (Reddit): «keeps them in defense even if he can attack and win the duel because my field is completely empty»", () => {
  const d = mesa({ mios:{ campo:[{carta:"Sangan", pos:P.DEF},{carta:"Mystic Tomato", pos:P.DEF}] }, lp:[8000, 2000], turno:7 });
  return { d, q: preguntaIdle({ giros:d.zones[0][L.MZONE].filter(Boolean), bp:true }),
           bien: r => r?.action === IA.SELECT_POS_CHANGE };
});
pos("github 18-10", "Forest antes de atacar, aunque su campo esté vacío",
    "GitHub #5 (Weevil): «played a monster, attacked with it and then played a field spell that boosted it»", () => {
  const d = mesa({ mios:{ campo:["Neo Bug"], mano:["Forest"] }, turno:4 });
  const f = d.zones[0][L.HAND][0];
  return { d, q: preguntaIdle({ activa:[f], colocaMT:[f], bp:true }), bien: r => r?.action === IA.SELECT_ACTIVATE };
});
pos("github 18-10", "…y Forest no, si sube más a los suyos que a los míos",
    "control", () => {
  const d = mesa({ mios:{ campo:["Neo Bug"], mano:["Forest"] },
                   suyos:{ campo:["Gyaku-Gire Panda","Gazelle the King of Mythical Beasts"] }, turno:4 });
  const f = d.zones[0][L.HAND][0];
  return { d, q: preguntaIdle({ activa:[f], colocaMT:[f], bp:true }), bien: r => r?.action !== IA.SELECT_ACTIVATE };
});
pos("github 18-10", "Rescue Cat en el turno 1 sin Wicked Worm Beast ni tributo: no se usa",
    "GitHub #17: «AI was playing rescue cat first turn and resolved to summon two Pandas»", () => {
  const d = mesa({ mios:{ campo:["Rescue Cat"], mano:["Sakuretsu Armor"] }, turno:1,
                   mazoMio:["Gyaku-Gire Panda","Gyaku-Gire Panda","Milus Radiant","Pot of Greed"] });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.MZONE][0]], bp:false }), bien: r => r?.action !== IA.SELECT_ACTIVATE };
});
pos("github 18-10", "…con The Wicked Worm Beast en el mazo, sí",
    "control: es el +1 de Cat Control", () => {
  const d = mesa({ mios:{ campo:["Rescue Cat"], mano:["Sakuretsu Armor"] }, turno:1,
                   mazoMio:["The Wicked Worm Beast","Gyaku-Gire Panda","Milus Radiant","Pot of Greed"] });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.MZONE][0]], bp:false }), bien: r => r?.action === IA.SELECT_ACTIVATE };
});
pos("github 18-10", "sin nada que ataque, no se entra en la Battle Phase",
    "GitHub #13: «the AI was going through all phases even though it had only set cards»", () => {
  const d = mesa({ mios:{ campo:[{carta:"Sangan", pos:P.TAPADA}], mt:["Sakuretsu Armor"] },
                   suyos:{ campo:["Breaker the Magical Warrior"] }, turno:6 });
  return { d, q: preguntaIdle({ bp:true }), bien: r => r?.action === IA.TO_EP };
});
pos("github 18-10", "si el que ataca es mi monstruo robado, Book of Moon no tumba al que ya atacó",
    "GitHub #15: «Book of Moon on the first monster which already attacked»", () => {
  const d = mesa({ mios:{ mt:["Book of Moon"] },
                   suyos:{ campo:["D.D. Warrior Lady", { carta:"Don Zaloog", dueño:0 }] },
                   turnPlayer:1, fase:0x8, turno:3 });
  const [lady, zaloog] = d.zones[1][L.MZONE];
  lady.atacoTurno = 3; zaloog.atacoTurno = 3;
  d.atacante = { uid:zaloog.uid, code:zaloog.code, controller:1 };
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), bien: r => r?.index == null };
});
/* ══ ESTRATEGIA 01-11 · el documento de E sobre decisiones estratégicas ══
   Cada posición sale de un caso del documento («Goat Format Simulator —
   Strategic AI Decision-Making Improvements») y las que no son control
   fallan con la versión del 18-10. */
const relinquished = ({ lp = [8000, 8000], equipo = true } = {}) => {
  const d = mesa({ mios:{ campo:["Luster Dragon"] },
                   suyos:{ campo:[{ carta:"Relinquished", atkReal:0, defReal:0 }],
                           mt: equipo ? [{ carta:"Magician of Faith", pos:P.ATK }] : [] }, lp, turno:7 });
  const r = d.zones[1][L.MZONE][0];
  if(equipo){ const e = d.zones[1][L.SZONE][0]; e.equipadoA = r.uid; r.equipado = true; e.owner = 0; }
  return d;
};
pos("estrategia 01-11", "Relinquished 0/0 con un monstruo absorbido: no se ataca (se rompe el equipo, él se queda y absorbe otro)",
    "E, §3 caso A: «La IA parece centrarse en el ATK actual y no en el resultado completo»", () => {
  const d = relinquished();
  return { d, q: preguntaBatalla([d.zones[0][L.MZONE][0]]), bien: r => r?.action !== BA.SELECT_BATTLE };
});
pos("estrategia 01-11", "…sin equipo, el mismo Relinquished de 0 muere: se ataca",
    "control", () => {
  const d = relinquished({ equipo:false });
  return { d, q: preguntaBatalla([d.zones[0][L.MZONE][0]]), bien: r => r?.action === BA.SELECT_BATTLE };
});
pos("estrategia 01-11", "…y con equipo, si el daño le remata, se ataca igual",
    "control: «puede ser correcto si el daño permite cerrar la partida»", () => {
  const d = relinquished({ lp:[8000, 1800] });
  return { d, q: preguntaBatalla([d.zones[0][L.MZONE][0]]), bien: r => r?.action === BA.SELECT_BATTLE };
});
pos("estrategia 01-11", "dos Gravekeeper's Spy agachadas delante de Sangan y un 1900: no se levantan",
    "E, §5: «Los Spies pierden la protección de sus 2000 DEF… el rival obtiene el efecto de Sangan»", () => {
  const d = mesa({ mios:{ campo:[{carta:"Gravekeeper's Spy", pos:P.DEF},{carta:"Gravekeeper's Spy", pos:P.DEF}] },
                   suyos:{ campo:["Sangan","Luster Dragon"] }, turno:6 });
  return { d, q: preguntaIdle({ giros:d.zones[0][L.MZONE].filter(Boolean), bp:true }),
           bien: r => r?.action !== IA.SELECT_POS_CHANGE };
});
pos("estrategia 01-11", "…con el Sangan solo enfrente, sí se levanta a matarlo",
    "control: «cuándo adoptar una posición agresiva es mejor que mantener una defensa estable»", () => {
  const d = mesa({ mios:{ campo:[{carta:"Gravekeeper's Spy", pos:P.DEF}] }, suyos:{ campo:["Sangan"] }, turno:6 });
  return { d, q: preguntaIdle({ giros:[d.zones[0][L.MZONE][0]], bp:true }), bien: r => r?.action === IA.SELECT_POS_CHANGE };
});
pos("estrategia 01-11", "una Spy ya de frente no ataca al Sangan si luego no podría agacharse ante el 1900",
    "E, §5: «comparar el estado actual con el estado previsto al finalizar el turno»", () => {
  const d = mesa({ mios:{ campo:["Gravekeeper's Spy"] }, suyos:{ campo:["Sangan","Luster Dragon"] }, turno:6 });
  return { d, q: preguntaBatalla([d.zones[0][L.MZONE][0]]), bien: r => r?.action !== BA.SELECT_BATTLE };
});
pos("estrategia 01-11", "…pero si entró este turno (no puede agacharse de todas formas), atacar no le cuesta nada",
    "control", () => {
  const d = mesa({ mios:{ campo:["Gravekeeper's Spy"] }, suyos:{ campo:["Sangan","Luster Dragon"] }, turno:6 });
  d.zones[0][L.MZONE][0].entroTurno = 6;
  return { d, q: preguntaBatalla([d.zones[0][L.MZONE][0]]), bien: r => r?.action === BA.SELECT_BATTLE };
});
const cannon = (cuenta, lpRival, mano = []) => {
  const d = mesa({ mios:{ mt:[{ carta:"Wave-Motion Cannon", pos:P.ATK }], mano },
                   suyos:{ campo:["Luster Dragon"] }, lp:[8000, lpRival], turno:9 });
  d.zones[0][L.SZONE][0].cuenta = { clase:"turnos", valor:cuenta };
  return d;
};
pos("estrategia 01-11", "Wave-Motion Cannon de 1000 con el rival a 2800 y sin cartas para quitarla: se espera",
    "E, §10.2: «Activarla demasiado pronto para obtener una cantidad insignificante de daño»", () => {
  const d = cannon(1, 2800);
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.SZONE][0]], bp:false }), bien: r => r?.action !== IA.SELECT_ACTIVATE };
});
pos("estrategia 01-11", "Wave-Motion Cannon de 4000 con el rival a 3500: se cobra (es letal)",
    "E, §10.2: «Si Cannon puede causar 3000 y el rival tiene 2800 LP, utilizarla es mejor que esperar»", () => {
  const d = cannon(4, 3500);
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.SZONE][0]], bp:false }), bien: r => r?.action === IA.SELECT_ACTIVATE };
});
pos("estrategia 01-11", "Wave-Motion Cannon de 3000 sin letal, pero el rival con cinco cartas en la mano y dos tapadas: se cobra",
    "E, §10.2: «esperar demasiados turnos buscando el máximo valor y perderla frente a removal»", () => {
  const d = cannon(3, 7000);
  d.zones[1][L.HAND].push(...[1,2,3,4,5].map(() => ({ uid:9000+Math.random(), code:cod("Mystical Elf"), controller:1, owner:1, location:L.HAND })));
  for(const k of [0,1]){ const c = { uid:9100+k, code:cod("Mirror Force"), controller:1, owner:1, location:L.SZONE, sequence:k, position:P.TAPADA }; d.zones[1][L.SZONE][k] = c; d.cards.set(c.uid, c); }
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.SZONE][0]], bp:false }), bien: r => r?.action === IA.SELECT_ACTIVATE };
});
pos("estrategia 01-11", "…la misma Cannon de 3000 con el rival sin mano ni tapadas: se espera a que sume",
    "control: «si el rival tiene 7000 LP y existe un bloqueo relativamente estable, puede merecer la pena acumular»", () => {
  const d = cannon(3, 7000);
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.SZONE][0]], bp:false }), bien: r => r?.action !== IA.SELECT_ACTIVATE };
});
pos("estrategia 01-11", "Lava Golem sin nada que lo frene, contra Sangan y Mystic Tomato: no se le regala un 3000",
    "E, §10.5: «Entregar Lava Golem a un rival sin disponer de ningún mecanismo de defensa puede ser una jugada muy negativa»", () => {
  const d = mesa({ mios:{ mano:["Lava Golem"] }, suyos:{ campo:["Sangan","Mystic Tomato"] }, turno:6 });
  return { d, q: preguntaIdle({ especial:[d.zones[0][L.HAND][0]], bp:false }), bien: r => r?.action !== IA.SELECT_SPECIAL_SUMMON };
});
pos("estrategia 01-11", "…con Gravity Bind boca arriba y Jinzo + Airknight enfrente, sí",
    "control: «hacerlo mientras Gravity Bind bloquea sus ataques puede proporcionar una ventaja importante»", () => {
  const d = mesa({ mios:{ mano:["Lava Golem"], mt:[{ carta:"Gravity Bind", pos:P.ATK }] },
                   suyos:{ campo:["Jinzo","Airknight Parshath"] }, turno:6 });
  return { d, q: preguntaIdle({ especial:[d.zones[0][L.HAND][0]], bp:false }), bien: r => r?.action === IA.SELECT_SPECIAL_SUMMON };
});
pos("estrategia 01-11", "Stealth Bird tapado detrás de Gravity Bind: se voltea (1000 de daño)",
    "E, §10.3: «No debe tratarlo simplemente como un monstruo de estadísticas débiles»", () => {
  const d = mesa({ mios:{ campo:[{ carta:"Stealth Bird", pos:P.TAPADA }], mt:[{ carta:"Gravity Bind", pos:P.ATK }] },
                   suyos:{ campo:["Luster Dragon"] }, turno:6 });
  return { d, q: preguntaIdle({ giros:[d.zones[0][L.MZONE][0]], bp:false }), bien: r => r?.action === IA.SELECT_POS_CHANGE };
});
pos("estrategia 01-11", "Ojama Trio colocada, en una ventana cualquiera del rival: no se activa",
    "E, §10.4: «No debe utilizar Ojama Trio automáticamente solo porque pueda hacerlo»", () => {
  const d = mesa({ mios:{ mt:["Ojama Trio"] }, suyos:{ campo:["Luster Dragon"] }, turnPlayer:1, turno:6 });
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), bien: r => r?.index == null };
});
pos("estrategia 01-11", "Ojama Trio + Just Desserts con letal: Just Desserts va primero (debajo en la cadena)",
    "E, §10.4: «orden correcto de activación y resolución»", () => {
  const d = mesa({ mios:{ mt:["Ojama Trio","Just Desserts"] }, suyos:{ campo:["Luster Dragon"] }, lp:[8000, 2000], turnPlayer:1, turno:6 });
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0], d.zones[0][L.SZONE][1]]), bien: r => r?.index === 1 };
});
pos("estrategia 01-11", "…y con Just Desserts ya en la cadena, Ojama Trio encima (resuelve antes y Desserts cuenta cuatro)",
    "E, §10.4", () => {
  const d = mesa({ mios:{ mt:["Ojama Trio", { carta:"Just Desserts", pos:P.ATK }] }, suyos:{ campo:["Luster Dragon"] }, lp:[8000, 2000], turnPlayer:1, turno:6 });
  d.cadena = [{ code:cod("Just Desserts"), controller:0 }];
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), bien: r => r?.index === 0 };
});
pos("estrategia 01-11", "MST: la Wave-Motion Cannon del rival con 3 turnos antes que una tapada",
    "E, §11: «Eliminar fuentes de daño recurrente»", () => {
  const d = mesa({ mios:{ mano:["Mystical Space Typhoon"] },
                   suyos:{ mt:[{ carta:"Wave-Motion Cannon", pos:P.ATK }, "Mirror Force"] }, turno:9 });
  d.zones[1][L.SZONE][0].cuenta = { clase:"turnos", valor:3 };
  d.cadena = [{ code:cod("Mystical Space Typhoon"), controller:0 }];
  return { d, q: preguntaObjetivo(d.zones[1][L.SZONE].filter(Boolean)), bien: r => r?.indicies?.[0] === 0 };
});
/* ══════════════ PROS 14-11: lo que salió del examen contra los replays ══════════════
   `examen-replays.mjs` pone a la IA en las mismas posiciones que 323 duelos
   de top cut (mundial y nationals). Cada regla de abajo sale de una
   diferencia que se repetía; cada una lleva su contraejemplo. */
const mazoGuerreros = d => { ["Exiled Force","D.D. Warrior Lady","Blade Knight","Sangan (GOAT)","Pot of Greed","Mirror Force",
  "Exiled Force","Blade Knight","Gravekeeper's Spy (GOAT)","Book of Moon","Nobleman of Crossout (GOAT)","Heavy Storm"].forEach((n,k) =>
  d.zones[0][L.DECK].push({ code:cod(n), uid:950+k, controller:0, location:L.DECK, sequence:k, position:P.TAPADA })); };
pos("pros 14-11", "Graceful Charity antes de invocar (robar antes de comprometerse)",
    "examen 14-11: Graceful, 73 de 238 posiciones invocando o colocando antes", () => {
  const d = mesa({ mios:{ mano:["Graceful Charity","Breaker the Magical Warrior","Sangan (GOAT)","Thunder Dragon (GOAT)"] },
                   suyos:{ campo:[{carta:"Gravekeeper's Spy (GOAT)", pos:P.TAPADA|P.DEF}] }, turno:5 });
  mazoGuerreros(d);
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ activa:[h[0]], colocaMT:[h[0]], invoca:[h[1],h[2]], coloca:[h[1],h[2]] }),
           bien: r => r?.action === IA.SELECT_ACTIVATE && r.index === 0 };
});
pos("pros 14-11", "…pero sin carta que robe, se invoca como siempre",
    "contraejemplo", () => {
  const d = mesa({ mios:{ mano:["Breaker the Magical Warrior","Sangan (GOAT)"] },
                   suyos:{ campo:[{carta:"Gravekeeper's Spy (GOAT)", pos:P.TAPADA|P.DEF}] }, turno:5 });
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ invoca:[h[0],h[1]], coloca:[h[0],h[1]] }),
           bien: r => r?.action === IA.SELECT_SUMMON || r?.action === IA.SELECT_MONSTER_SET };
});
pos("pros 14-11", "Reinforcement of the Army se guarda con la invocación ya gastada",
    "examen 14-11: sin invocación, la IA lo activaba en el 79 % de las posiciones y los pros en el 18 %", () => {
  const d = mesa({ mios:{ mano:["Reinforcement of the Army (GOAT)","Sakuretsu Armor"],
                          campo:[{carta:"Breaker the Magical Warrior", pos:P.ATK}] }, turno:5 });
  mazoGuerreros(d);
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ activa:[h[0]], colocaMT:[h[0],h[1]] }),
           bien: r => !(r?.action === IA.SELECT_ACTIVATE && r.index === 0) };
});
pos("pros 14-11", "…y con la invocación libre, se busca primero el guerrero",
    "contraejemplo", () => {
  const d = mesa({ mios:{ mano:["Reinforcement of the Army (GOAT)","Sakuretsu Armor","Sangan (GOAT)"] }, turno:5,
                   suyos:{ campo:[{carta:"Gravekeeper's Spy (GOAT)", pos:P.TAPADA|P.DEF}] } });
  mazoGuerreros(d);
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ activa:[h[0]], colocaMT:[h[0],h[1]], invoca:[h[2]], coloca:[h[2]] }),
           bien: r => r?.action === IA.SELECT_ACTIVATE && r.index === 0 };
});
pos("pros 14-11", "batalla entera: el 1400 a la Spy que se ve, el 2400 a la tapada",
    "examen 14-11: «mismo objetivo, otro atacante»", () => {
  const d = mesa({ mios:{ campo:[{carta:"Ryu Kokki", pos:P.ATK},{carta:"Giant Rat", pos:P.ATK}] },
                   suyos:{ campo:[{carta:"Gravekeeper's Spy (GOAT)", pos:P.ATK},{carta:"Sangan (GOAT)", pos:P.TAPADA|P.DEF}] },
                   turno:7, fase:0x8 });
  const m = d.zones[0][L.MZONE];
  return { d, q: preguntaBatalla([m[0], m[1]]), bien: r => r?.action === BA.SELECT_BATTLE && r.index === 1 };
});
pos("pros 14-11", "…y el objetivo que se fija es la Spy, no la tapada",
    "examen 14-11", () => {
  const d = mesa({ mios:{ campo:[{carta:"Ryu Kokki", pos:P.ATK},{carta:"Giant Rat", pos:P.ATK}] },
                   suyos:{ campo:[{carta:"Gravekeeper's Spy (GOAT)", pos:P.ATK},{carta:"Sangan (GOAT)", pos:P.TAPADA|P.DEF}] },
                   turno:7, fase:0x8 });
  const m = d.zones[0][L.MZONE], s = d.zones[1][L.MZONE];
  return { d, previo: cb => { const r = cb(preguntaBatalla([m[0], m[1]]), 0); if(r?.index !== 1) throw new Error("no atacó con la Giant Rat: la posición no mide lo que dice"); },
           q: preguntaObjetivo([s[0], s[1]]), bien: r => (r?.indicies ?? [])[0] === 0 };
});
pos("pros 14-11", "…con dos objetivos boca arriba que caen, el fuerte va al grande (como siempre)",
    "contraejemplo", () => {
  const d = mesa({ mios:{ campo:[{carta:"Ryu Kokki", pos:P.ATK},{carta:"Kycoo the Ghost Destroyer", pos:P.ATK}] },
                   suyos:{ campo:[{carta:"Blade Knight", pos:P.ATK},{carta:"Vampire Lord", pos:P.ATK}] },
                   turno:7, fase:0x8 });
  const m = d.zones[0][L.MZONE], s = d.zones[1][L.MZONE];
  return { d, previo: cb => { cb(preguntaBatalla([m[0], m[1]]), 0); },
           q: preguntaObjetivo([s[0], s[1]]),
           bien: r => true, regular: r => true };
});
pos("pros 14-11", "Heavy Storm antes de invocar al Breaker (limpiar antes de comprometerse)",
    "examen 14-11: Heavy Storm, 68 de 148 posiciones invocando antes", () => {
  const d = mesa({ mios:{ mano:["Heavy Storm","Breaker the Magical Warrior","Sangan (GOAT)"] },
                   suyos:{ mt:["Mirror Force","Torrential Tribute"], mano:["Sangan (GOAT)","Pot of Greed"] }, turno:5 });
  mazoGuerreros(d);
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ activa:[h[0]], colocaMT:[h[0]], invoca:[h[1],h[2]], coloca:[h[1],h[2]] }),
           bien: r => r?.action === IA.SELECT_ACTIVATE && r.index === 0 };
});
const LISTA_ZOMBIE = ["Pyramid Turtle","Pyramid Turtle","Ryu Kokki","Ryu Kokki","Vampire Lord","Book of Life","Book of Life",
  "Spirit Reaper","Creature Swap","Snatch Steal","Mirror Force","Sangan"];
pos("pros 14-11", "Ryu Kokki (carta clave del plan) ataca a una tapada que cae seguro",
    "examen 14-11: el freno de `planBatalla` era para lo que puede matarlo", () => {
  const d = mesa({ mios:{ campo:[{carta:"Ryu Kokki", pos:P.ATK}] }, mazoMio:LISTA_ZOMBIE,
                   suyos:{ campo:[{carta:"Gravekeeper's Spy (GOAT)", pos:P.TAPADA|P.DEF}], mano:["Sangan (GOAT)","Pot of Greed","Heavy Storm"] },
                   turno:3, fase:0x8 });
  return { d, q: preguntaBatalla([d.zones[0][L.MZONE][0]]), bien: r => r?.action === BA.SELECT_BATTLE };
});
pos("pros 14-11", "…pero no se estrella contra un 2400 boca arriba que lo iguala",
    "contraejemplo", () => {
  const d = mesa({ mios:{ campo:[{carta:"Ryu Kokki", pos:P.ATK}] }, mazoMio:LISTA_ZOMBIE,
                   suyos:{ campo:[{carta:"Mobius the Frost Monarch", pos:P.ATK}] }, turno:3, fase:0x8 });
  return { d, q: preguntaBatalla([d.zones[0][L.MZONE][0]]), bien: r => r?.action !== BA.SELECT_BATTLE, regular: r => true };
});
pos("pros 14-11", "con su Wave-Motion Cannon cargada a 3000 y 3500 LP, la MST va ya",
    "incremento 21 §5: el reloj no contaba la Cannon del rival", () => {
  const d = mesa({ mios:{ mano:["Mystical Space Typhoon","Sangan (GOAT)"] },
                   suyos:{ mt:[{ carta:"Wave-Motion Cannon", pos:P.ATK }], mano:["Pot of Greed","Sangan (GOAT)"] }, lp:[3500, 8000], turno:9 });
  d.zones[1][L.SZONE][0].cuenta = { clase:"turnos", valor:3 };
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ activa:[h[0]], colocaMT:[h[0]], invoca:[h[1]], coloca:[h[1]] }),
           bien: r => r?.action === IA.SELECT_ACTIVATE && r.index === 0 };
});
pos("pros 14-11", "Exiled Force se invoca, no se coloca (su efecto es boca arriba)",
    "examen 14-11: los pros la invocan en 89 de 94 casos", () => {
  const d = mesa({ mios:{ mano:["Exiled Force","Don Zaloog","Dust Tornado"] },
                   suyos:{ campo:[{carta:"Tribe-Infecting Virus", pos:P.ATK}], mt:["Solemn Judgment"], mano:["Sangan (GOAT)"] }, lp:[5400,3850], turno:10 });
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ invoca:[h[0],h[1]], coloca:[h[0],h[1]], colocaMT:[h[2]] }),
           bien: r => !(r?.action === IA.SELECT_MONSTER_SET && r.index === 0) };
});
/* E, 14-11, sobre el examen: «a veces colocan mágicas o trampas de farol, y
   a veces acaban el turno con trampas en la mano, todo para protegerse del
   removal del rival… jugar el backrow y los recursos progresivamente…
   esas invocaciones muchas veces se harán por tempo». */
pos("pros 14-11", "de farol: con el backrow vacío, el Nobleman sin objetivo va boca abajo",
    "E, 14-11: «a veces colocan mágicas de farol»", () => {
  const d = mesa({ mios:{ mano:["Nobleman of Crossout (GOAT)","Pot of Greed"], campo:[{carta:"Breaker the Magical Warrior", pos:P.ATK}] },
                   suyos:{ campo:[{carta:"Sangan (GOAT)", pos:P.ATK}], mano:["Sangan (GOAT)","Pot of Greed","Heavy Storm"] }, turno:5 });
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ colocaMT:[h[0]], bp:false }), bien: r => r?.action === IA.SELECT_SPELL_SET };
});
pos("pros 14-11", "…pero con algo ya puesto no hay farol que valga",
    "contraejemplo", () => {
  const d = mesa({ mios:{ mano:["Nobleman of Crossout (GOAT)"], campo:[{carta:"Breaker the Magical Warrior", pos:P.ATK}], mt:["Sakuretsu Armor"] },
                   suyos:{ campo:[{carta:"Sangan (GOAT)", pos:P.ATK}], mano:["Sangan (GOAT)","Pot of Greed","Heavy Storm"] }, turno:5 });
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ colocaMT:[h[0]], bp:false }), bien: r => r?.action !== IA.SELECT_SPELL_SET };
});
pos("pros 14-11", "poco a poco: con una trampa puesta y su mano llena, la segunda se guarda",
    "E, 14-11: «sin comprometer hasta que el riesgo es menor»", () => {
  const d = mesa({ mios:{ mano:["Mirror Force"], mt:["Sakuretsu Armor"], campo:[{carta:"Gravekeeper's Spy (GOAT)", pos:P.TAPADA|P.DEF}] },
                   suyos:{ mano:["Sangan (GOAT)","Pot of Greed","Heavy Storm","Snatch Steal","Mystical Space Typhoon"] }, turno:4 });
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ colocaMT:[h[0]], bp:false }), bien: r => r?.action !== IA.SELECT_SPELL_SET };
});
pos("pros 14-11", "…y con el rival sin mano, se baja",
    "contraejemplo", () => {
  const d = mesa({ mios:{ mano:["Mirror Force"], mt:["Sakuretsu Armor"], campo:[{carta:"Gravekeeper's Spy (GOAT)", pos:P.TAPADA|P.DEF}] },
                   suyos:{ mano:["Sangan (GOAT)"] }, turno:4 });
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ colocaMT:[h[0]], bp:false }), bien: r => r?.action === IA.SELECT_SPELL_SET };
});
pos("pros 14-11", "por tempo: D.D. Warrior Lady de frente delante de un Chaos Sorcerer",
    "E, 14-11: «muchas veces se harán por tempo»", () => {
  const d = mesa({ mios:{ mano:["D.D. Warrior Lady"] },
                   suyos:{ campo:[{carta:"Chaos Sorcerer", pos:P.ATK}], mano:["Sangan (GOAT)","Pot of Greed"] }, turno:6 });
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ invoca:[h[0]], coloca:[h[0]] }), bien: r => r?.action === IA.SELECT_SUMMON };
});
/* E, 14-11: «Snatch Steal y Tribe son cartas super importantes que cambian
   la partida, han de guardarse para esos momentos». */
pos("pros 14-11", "Snatch Steal no se gasta en un Gravekeeper's Spy en defensa",
    "examen 14-11: 53 Snatch Steal de la IA contra una Spy agachada", () => {
  const d = mesa({ mios:{ mano:["Snatch Steal","Sangan (GOAT)"] },
                   suyos:{ campo:[{carta:"Gravekeeper's Spy (GOAT)", pos:P.DEF}], mano:["Pot of Greed","Sangan (GOAT)"] }, turno:6 });
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ activa:[h[0]], invoca:[h[1]], coloca:[h[1]] }),
           bien: r => !(r?.action === IA.SELECT_ACTIVATE && r.index === 0) };
});
pos("pros 14-11", "…y sí en su Black Luster Soldier",
    "contraejemplo", () => {
  const d = mesa({ mios:{ mano:["Snatch Steal","Sangan (GOAT)"] },
                   suyos:{ campo:[{carta:"Black Luster Soldier - Envoy of the Beginning", pos:P.ATK}], mano:["Pot of Greed","Sangan (GOAT)"] }, turno:6 });
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ activa:[h[0]], invoca:[h[1]], coloca:[h[1]] }),
           bien: r => r?.action === IA.SELECT_ACTIVATE && r.index === 0 };
});
pos("pros 14-11", "Tribe-Infecting Virus no sale de cuerpo sin nada boca arriba que destruir",
    "examen 14-11: 252 Virus invocados así donde los pros no", () => {
  const d = mesa({ mios:{ mano:["Tribe-Infecting Virus","Sangan (GOAT)","Gravekeeper's Spy (GOAT)"] },
                   suyos:{ campo:[{carta:"Sangan (GOAT)", pos:P.TAPADA|P.DEF}], mano:["Pot of Greed","Sangan (GOAT)"] }, turno:5 });
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ invoca:[h[0],h[1],h[2]], coloca:[h[0],h[1],h[2]] }),
           bien: r => ![IA.SELECT_SUMMON, IA.SELECT_MONSTER_SET].includes(r?.action) || r.index !== 0 };
});
pos("pros 14-11", "…y sí contra dos guerreros boca arriba",
    "contraejemplo", () => {
  const d = mesa({ mios:{ mano:["Tribe-Infecting Virus","Sangan (GOAT)","Gravekeeper's Spy (GOAT)"] },
                   suyos:{ campo:[{carta:"Blade Knight", pos:P.ATK},{carta:"Exiled Force", pos:P.ATK}], mano:["Pot of Greed"] }, turno:5 });
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ invoca:[h[0],h[1],h[2]], coloca:[h[0],h[1],h[2]] }),
           bien: r => r?.action === IA.SELECT_SUMMON && r.index === 0 };
});
/* E, 14-11 (noche): «sigue haciendo cosas raras, como con BLS, haciendo el
   efecto a sus propios monstruos… o Tsukuyomi a sí misma sin aportar nada». */
pos("pros 14-11", "BLS no destierra con su campo vacío (el único objetivo sería mío)",
    "E, 14-11: «BLS haciendo el efecto a sus propios monstruos»", () => {
  const d = mesa({ mios:{ campo:[{carta:"Black Luster Soldier - Envoy of the Beginning (GOAT)", pos:P.ATK},{carta:"Breaker the Magical Warrior", pos:P.ATK}] },
                   suyos:{ mt:["Mirror Force"], mano:["Pot of Greed"] }, turno:9 });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.MZONE][0]] }), bien: r => r?.action !== IA.SELECT_ACTIVATE };
});
pos("pros 14-11", "…pero sí destierra su tapada",
    "contraejemplo", () => {
  const d = mesa({ mios:{ campo:[{carta:"Black Luster Soldier - Envoy of the Beginning (GOAT)", pos:P.ATK}] },
                   suyos:{ campo:[{carta:"Sangan (GOAT)", pos:P.TAPADA|P.DEF}], mano:["Pot of Greed"] }, turno:9 });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.MZONE][0]] }), bien: r => r?.action === IA.SELECT_ACTIVATE };
});
pos("pros 14-11", "…y con un 1600 boca arriba y nada tapado atrás, BLS ataca en vez de desterrar",
    "BLS mata en combate y ataca otra vez", () => {
  const d = mesa({ mios:{ campo:[{carta:"Black Luster Soldier - Envoy of the Beginning (GOAT)", pos:P.ATK}] },
                   suyos:{ campo:[{carta:"Blade Knight", pos:P.ATK}], mano:["Pot of Greed"] }, turno:9 });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.MZONE][0]] }), bien: r => r?.action !== IA.SELECT_ACTIVATE };
});
pos("pros 14-11", "Tsukuyomi sin nada que tumbar no se invoca (se tumbaría a sí misma)",
    "E, 14-11: «Tsukuyomi a sí misma sin aportar nada»", () => {
  const d = mesa({ mios:{ mano:["Tsukuyomi","Sangan (GOAT)"] },
                   suyos:{ campo:[{carta:"Sheep Token", pos:P.DEF},{carta:"Sheep Token", pos:P.DEF}], mano:["Pot of Greed"] }, turno:8 });
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ invoca:[h[0],h[1]], coloca:[h[0],h[1]] }),
           bien: r => !(r?.action === IA.SELECT_SUMMON && r.index === 0) };
});
pos("pros 14-11", "…y con su Breaker boca arriba, sí",
    "contraejemplo", () => {
  const d = mesa({ mios:{ mano:["Tsukuyomi","Sangan (GOAT)"] },
                   suyos:{ campo:[{carta:"Breaker the Magical Warrior", pos:P.ATK}], mano:["Pot of Greed"] }, turno:8 });
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ invoca:[h[0],h[1]], coloca:[h[0],h[1]] }),
           bien: r => r?.action === IA.SELECT_SUMMON && r.index === 0 };
});
/* ══════════════ LAS LLAVES DEL TABLERO (19-11) ══════════════
   E: «la IA sigue overestimating o underestimating cartas como
   Thousand-Eyes Restrict o Relinquished… tiene respuestas en mano (Book
   of Moon, trampas, Tsukuyomi, Chaos) pero escoge limpiar otro monstruo,
   porque ve que Relinquished es un 0/0 y no lee el efecto». */
const resolviendo = (d, nombre, quien = 0) => { d.cadena = [{ code: cod(nombre), controller: quien }]; return d; };
pos("llaves 19-11", "Chaos Sorcerer destierra el Relinquished de 0, no el Luster Dragon",
    "E, 19-11: «escoge limpiar otro monstruo»", () => {
  const d = resolviendo(mesa({ mios:{ campo:["Chaos Sorcerer"] },
                   suyos:{ campo:["Luster Dragon", { carta:"Relinquished", atkReal:0, defReal:0 }] }, turno:8 }), "Chaos Sorcerer");
  return { d, q: preguntaObjetivo(d.zones[1][L.MZONE].filter(Boolean)), bien: r => r?.indicies?.[0] === 1 };
});
pos("llaves 19-11", "…y el TER que absorbió un 1400 antes que un Airknight de 1900",
    "el TER no me deja atacar ni cambiar de posición", () => {
  const d = resolviendo(mesa({ mios:{ campo:["Chaos Sorcerer"] },
                   suyos:{ campo:["Airknight Parshath", { carta:"Thousand-Eyes Restrict", atkReal:1400, defReal:1400 }] }, turno:8 }), "Chaos Sorcerer");
  return { d, q: preguntaObjetivo(d.zones[1][L.MZONE].filter(Boolean)), bien: r => r?.indicies?.[0] === 1 };
});
pos("llaves 19-11", "Book of Moon en mi turno: a su Relinquished, no a su 1900",
    "Book of Moon le rompe el equipo y no vuelve a absorber hasta voltear", () => {
  const d = resolviendo(mesa({ mios:{ campo:["Breaker the Magical Warrior"] },
                   suyos:{ campo:["Luster Dragon", { carta:"Relinquished", atkReal:1600, defReal:1600 }] }, turno:8 }), "Book of Moon");
  return { d, q: preguntaObjetivo(d.zones[1][L.MZONE].filter(Boolean)), bien: r => r?.indicies?.[0] === 1 };
});
pos("llaves 19-11", "Book of Moon se activa en mi Main 1 contra su Relinquished",
    "E, 19-11: «lo más lógico suele ser limpiarlas para poder avanzar el game state»", () => {
  const d = mesa({ mios:{ mano:["Book of Moon"], campo:["Breaker the Magical Warrior"] },
                   suyos:{ campo:[{ carta:"Relinquished", atkReal:1600, defReal:1600 }], mano:["Pot of Greed"] }, turno:8 });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]] }), bien: r => r?.action === IA.SELECT_ACTIVATE };
});
pos("llaves 19-11", "Smashing Ground no se guarda delante de un Relinquished de 0",
    "la reserva medía el ATK (umbral 1600) y la llave no llegaba", () => {
  const d = mesa({ mios:{ mano:["Smashing Ground"] },
                   suyos:{ campo:[{ carta:"Relinquished", atkReal:0, defReal:0 }], mano:["Pot of Greed","Sangan (GOAT)"] }, turno:8 });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]] }), bien: r => r?.action === IA.SELECT_ACTIVATE };
});
pos("llaves 19-11", "mi TER me cierra el letal: Book of Moon a mi TER y a pegar",
    "E, 19-11: «darle la vuelta con Book of Moon, pegar con cosas y en Main 2 voltear el TER»", () => {
  const d = mesa({ mios:{ mano:["Book of Moon"],
                          campo:[{ carta:"Thousand-Eyes Restrict", atkReal:1500, defReal:1500 }, "Luster Dragon"] },
                   suyos:{ mano:["Pot of Greed"] }, lp:[8000,1800], turno:9 });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]] }), bien: r => r?.action === IA.SELECT_ACTIVATE };
});
pos("llaves 19-11", "…pero por 1900 de daño no se tumba su propio TER",
    "contraejemplo: «depende de la situación»", () => {
  const d = mesa({ mios:{ mano:["Book of Moon"],
                          campo:[{ carta:"Thousand-Eyes Restrict", atkReal:1500, defReal:1500 }, "Luster Dragon"] },
                   suyos:{ mano:["Pot of Greed"] }, lp:[8000,8000], turno:9 });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]] }), bien: r => r?.action !== IA.SELECT_ACTIVATE };
});
pos("llaves 19-11", "mi TER tumbado en la Main 2: se voltea para absorber otra vez",
    "E, 19-11: «en main 2 voltear el TER y hacer su efecto»", () => {
  const d = mesa({ mios:{ campo:[{ carta:"Thousand-Eyes Restrict", pos:P.TAPADA|P.DEF }, "Luster Dragon"] },
                   suyos:{ campo:["Airknight Parshath"] }, turno:9, fase:0x100 });
  return { d, q: preguntaIdle({ giros:[d.zones[0][L.MZONE][0]], bp:false }), bien: r => r?.action === IA.SELECT_POS_CHANGE };
});
pos("llaves 19-11", "…pero en la Main 1 con un atacante libre, espera (el TER le cerraría el ataque)",
    "control", () => {
  const d = mesa({ mios:{ campo:[{ carta:"Thousand-Eyes Restrict", pos:P.TAPADA|P.DEF }, "Luster Dragon"] },
                   suyos:{ campo:["Sangan (GOAT)"] }, turno:9 });
  return { d, q: preguntaIdle({ giros:[d.zones[0][L.MZONE][0]], bp:true }), bien: r => r?.action !== IA.SELECT_POS_CHANGE };
});
pos("llaves 19-11", "Ring of Destruction contra su Relinquished con equipo, aunque mi 1900 «le gane»",
    "atacándolo se rompe el equipo y me devuelve el daño: no se mata en combate", () => {
  const d = mesa({ mios:{ mt:["Ring of Destruction"], campo:["Luster Dragon"] },
                   suyos:{ campo:[{ carta:"Relinquished", atkReal:1600, defReal:1600 }], mano:["Pot of Greed","Sangan (GOAT)"] }, turno:8 });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.SZONE][0]] }), bien: r => r?.action === IA.SELECT_ACTIVATE };
});
pos("llaves 19-11", "…y contra su TER: con él boca arriba no ataca nadie",
    "E, 19-11", () => {
  const d = mesa({ mios:{ mt:["Ring of Destruction"], campo:["Luster Dragon"] },
                   suyos:{ campo:[{ carta:"Thousand-Eyes Restrict", atkReal:1500, defReal:1500 }], mano:["Pot of Greed","Sangan (GOAT)"] }, turno:8 });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.SZONE][0]] }), bien: r => r?.action === IA.SELECT_ACTIVATE };
});
/* ══════════════ BOOK OF MOON Y TSUKUYOMI (19-11) ══════════════
   E: «la IA tiene que entender mucho mejor el alto value de Tsukuyomi y
   Book of Moon… clásico plan contra Kycoo: invocas Tsukuyomi, efecto al
   Kycoo, en defensa Tsukuyomi lo destruye en battle phase; la IA gastaría
   un recurso más como Nobleman of Crossout». */
const recuerda = (d, carta) => {          // la IA vio esa carta boca arriba antes de que la tumbaran
  d.__memoriaIA ??= { 0:new Map(), 1:new Map() };
  const dt = DB.get(carta.code);
  d.__memoriaIA[0].set(carta.uid, { code:carta.code, nombre:NOMBRES[carta.code]?.name, datos:dt, atk:dt?.attack, def:dt?.defense });
  return d;
};
pos("tsukuyomi 19-11", "Kycoo tumbado por mi Tsukuyomi: no se gasta Nobleman, lo mata Tsukuyomi pegando",
    "E, 19-11: «la IA gastaría un recurso más como Nobleman of Crossout»", () => {
  const d = mesa({ mios:{ mano:["Nobleman of Crossout"], campo:["Tsukuyomi"] },
                   suyos:{ campo:[{ carta:"Kycoo the Ghost Destroyer", pos:P.TAPADA|P.DEF }], mano:["Pot of Greed"] }, turno:8 });
  d.zones[0][L.MZONE][0].entroTurno = 8; recuerda(d, d.zones[1][L.MZONE][0]);
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]] }), bien: r => r?.action !== IA.SELECT_ACTIVATE };
});
pos("tsukuyomi 19-11", "…pero contra una tapada que no conozco, Nobleman sí",
    "contraejemplo", () => {
  const d = mesa({ mios:{ mano:["Nobleman of Crossout"], campo:["Tsukuyomi"] },
                   suyos:{ campo:[{ carta:"Kycoo the Ghost Destroyer", pos:P.TAPADA|P.DEF }], mano:["Pot of Greed"] }, turno:8 });
  d.zones[0][L.MZONE][0].entroTurno = 8;
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]] }), bien: r => r?.action === IA.SELECT_ACTIVATE };
});
pos("tsukuyomi 19-11", "contra su Kycoo boca arriba, Tsukuyomi sale",
    "el plan clásico", () => {
  const d = mesa({ mios:{ mano:["Tsukuyomi","Nobleman of Crossout"] },
                   suyos:{ campo:["Kycoo the Ghost Destroyer"], mano:["Pot of Greed"] }, turno:8 });
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ invoca:[h[0]], coloca:[h[0]], activa:[h[1]] }), bien: r => r?.action === IA.SELECT_SUMMON && r.index === 0 };
});
pos("tsukuyomi 19-11", "Tsukuyomi nunca se tumba a sí misma si hay otro objetivo, aunque sea mío",
    "E, 19-11: «NUNCA quiero ver que la IA juega Tsukuyomi y se hace el efecto sobre sí misma»", () => {
  const d = resolviendo(mesa({ mios:{ campo:["Tsukuyomi","Luster Dragon"] }, suyos:{}, turno:8 }), "Tsukuyomi");
  return { d, q: preguntaObjetivo(d.zones[0][L.MZONE].filter(Boolean)), bien: r => r?.indicies?.[0] === 1 };
});
pos("tsukuyomi 19-11", "Tsukuyomi recién invocada + Creature Swap: le doy el espíritu y me quedo su monstruo",
    "E, 19-11: «es como robarle un monstruo al rival sin darle nada a cambio»", () => {
  const d = mesa({ mios:{ mano:["Creature Swap"], campo:["Tsukuyomi"] },
                   suyos:{ campo:[{ carta:"Kycoo the Ghost Destroyer", pos:P.TAPADA|P.DEF }], mano:["Pot of Greed"] }, turno:8 });
  d.zones[0][L.MZONE][0].entroTurno = 8; recuerda(d, d.zones[1][L.MZONE][0]);
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]], bp:false }), bien: r => r?.action === IA.SELECT_ACTIVATE };
});
pos("tsukuyomi 19-11", "…y al resolverla, lo que doy es la Tsukuyomi",
    "vuelve a mi mano en la End Phase", () => {
  const d = resolviendo(mesa({ mios:{ campo:["Luster Dragon","Tsukuyomi"] },
                   suyos:{ campo:["Kycoo the Ghost Destroyer"] }, turno:8 }), "Creature Swap");
  d.zones[0][L.MZONE][1].entroTurno = 8;
  return { d, q: preguntaObjetivo(d.zones[0][L.MZONE].filter(Boolean)), bien: r => r?.indicies?.[0] === 1 };
});
pos("tsukuyomi 19-11", "…pero no para llevarme un Sinister Serpent",
    "contraejemplo: «solo cuando tenga sentido por el estado del tablero»", () => {
  const d = mesa({ mios:{ mano:["Creature Swap"], campo:["Tsukuyomi"] },
                   suyos:{ campo:["Sinister Serpent"], mano:["Pot of Greed"] }, turno:8 });
  d.zones[0][L.MZONE][0].entroTurno = 8;
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]], bp:false }), bien: r => r?.action !== IA.SELECT_ACTIVATE };
});
pos("tsukuyomi 19-11", "Asura Priest limpia y luego Creature Swap por su monstruo (vuelve a mi mano)",
    "E, 19-11: «usarla para limpiar un scapegoat y luego tradearla por el monstruo restante»", () => {
  const d = mesa({ mios:{ mano:["Creature Swap"], campo:["Asura Priest"] },
                   suyos:{ campo:["Breaker the Magical Warrior"], mano:["Pot of Greed"] }, turno:8, fase:0x100 });
  d.zones[0][L.MZONE][0].entroTurno = 8; d.zones[0][L.MZONE][0].atacoTurno = 8;
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]], bp:false }), bien: r => r?.action === IA.SELECT_ACTIVATE };
});
pos("tsukuyomi 19-11", "Tsukuyomi a mi Magician of Faith con Pot of Greed en el cementerio",
    "E, 19-11: «Magician of Faith u otros volteos con mucho value»", () => {
  const d = mesa({ mios:{ mano:["Tsukuyomi"], campo:["Magician of Faith"], gy:["Pot of Greed"] }, suyos:{ mano:["Pot of Greed"] }, turno:8 });
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ invoca:[h[0]], coloca:[h[0]] }), bien: r => r?.action === IA.SELECT_SUMMON && r.index === 0 };
});
/* 19-11: midiendo los mazos nuevos con tres Solemn contra Beastdown. */
pos("llaves 19-11", "Solemn Judgment no se paga contra un Delinquent Duo si después me matan",
    "media vida delante de 3700 por turno", () => {
  const d = resolviendo(mesa({ mios:{ mt:["Solemn Judgment"] },
                   suyos:{ campo:["Berserk Gorilla","Enraged Battle Ox"], mano:["Pot of Greed"] }, lp:[4000,8000], turnPlayer:1, turno:8 }), "Delinquent Duo", 1);
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), bien: r => r?.index == null };
});
pos("llaves 19-11", "…y sin presión, a 8000, sí",
    "contraejemplo", () => {
  const d = resolviendo(mesa({ mios:{ mt:["Solemn Judgment"] }, suyos:{ mano:["Pot of Greed"] }, lp:[8000,8000], turnPlayer:1, turno:8 }), "Delinquent Duo", 1);
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), bien: r => r?.index === 0 };
});
/* ══════════════ FLOATERS (19-11) ══════════════
   E: «¿es capaz de entender que si crashea su floater, aunque coma daño,
   puede buscar una carta en su deck que resuelva la situación? ¿sabe que
   invocar tu floater y hacer Creature Swap puede ser extremadamente
   potente?». Los rulings, preguntados al motor en check-floaters.mjs. */
const ataqueCon = (d) => preguntaBatalla([d.zones[0][L.MZONE][0]]);
pos("floaters 19-11", "Giant Rat se estrella contra su Jinzo para sacar Exiled Force",
    "E, 19-11: «aunque coma daño, puede buscar una carta que resuelva la mesa»", () => {
  const d = mesa({ mios:{ campo:["Giant Rat"] }, suyos:{ campo:["Jinzo"], mano:["Pot of Greed"] }, turno:6, mazoMio:["Exiled Force","Mystical Elf"] });
  return { d, q: ataqueCon(d), bien: r => r?.action === BA.SELECT_BATTLE };
});
pos("floaters 19-11", "…pero sin nada útil en el mazo, no se estrella",
    "contraejemplo", () => {
  const d = mesa({ mios:{ campo:["Giant Rat"] }, suyos:{ campo:["Jinzo"], mano:["Pot of Greed"] }, turno:6, mazoMio:["Mystical Elf"] });
  return { d, q: ataqueCon(d), bien: r => r?.action !== BA.SELECT_BATTLE };
});
pos("floaters 19-11", "…ni con la vida justa (2000 LP, me como 1000)",
    "contraejemplo: el daño cuesta el doble con poca vida", () => {
  const d = mesa({ mios:{ campo:["Giant Rat"] }, suyos:{ campo:["Jinzo"], mano:["Pot of Greed"] }, lp:[2000,8000], turno:6, mazoMio:["Exiled Force"] });
  return { d, q: ataqueCon(d), bien: r => r?.action !== BA.SELECT_BATTLE };
});
pos("floaters 19-11", "Pyramid Turtle se estrella contra Airknight: sale Ryu Kokki y le gana en esa batalla",
    "el reclutado ataca en la misma Battle Phase (check-floaters)", () => {
  const d = mesa({ mios:{ campo:["Pyramid Turtle"] }, suyos:{ campo:["Airknight Parshath"], mano:["Pot of Greed"] }, turno:6, mazoMio:["Ryu Kokki"] });
  return { d, q: ataqueCon(d), bien: r => r?.action === BA.SELECT_BATTLE };
});
pos("floaters 19-11", "Creature Swap: le doy mi Giant Rat y me llevo su Breaker",
    "E, 19-11: «robas el monstruo rival y si destruyes tu floater intercambiado, sigues teniendo su efecto»", () => {
  const d = mesa({ mios:{ mano:["Creature Swap"], campo:["Giant Rat","Luster Dragon"] }, suyos:{ campo:["Breaker the Magical Warrior"], mano:["Pot of Greed"] }, turno:6, mazoMio:["Exiled Force"] });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]] }), bien: r => r?.action === IA.SELECT_ACTIVATE };
});
pos("floaters 19-11", "…y sin batalla por delante para matarla, no",
    "contraejemplo: sin matarla, es darle una Rata", () => {
  const d = mesa({ mios:{ mano:["Creature Swap"], campo:["Giant Rat","Luster Dragon"] }, suyos:{ campo:["Breaker the Magical Warrior"], mano:["Pot of Greed"] }, turno:6, mazoMio:["Exiled Force"] });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]], bp:false }), bien: r => r?.action !== IA.SELECT_ACTIVATE };
});
pos("floaters 19-11", "al resolver Creature Swap, lo que doy es el floater",
    "control", () => {
  const d = resolviendo(mesa({ mios:{ campo:["Luster Dragon","Giant Rat"] }, suyos:{ campo:["Airknight Parshath"] }, turno:6 }), "Creature Swap");
  return { d, q: preguntaObjetivo(d.zones[0][L.MZONE].filter(Boolean)), bien: r => r?.indicies?.[0] === 1 };
});
pos("floaters 19-11", "mi Giant Rat en su campo: entre ella y su Mystic Tomato, ataca a la mía (el reclutamiento es mío)",
    "check-floaters, caso 1: la Rata va a MI cementerio y saca de MI mazo", () => {
  const d = mesa({ mios:{ campo:["Breaker the Magical Warrior"] },
                   suyos:{ campo:["Mystic Tomato", { carta:"Giant Rat", dueño:0 }], mano:["Pot of Greed"] }, turno:6, fase:0x10, mazoMio:["Exiled Force"] });
  return { d, previo: cb => cb(preguntaBatalla([d.zones[0][L.MZONE][0]]), 0),
           q: preguntaObjetivo(d.zones[1][L.MZONE].filter(Boolean)), bien: r => r?.indicies?.[0] === 1 };
});
/* E, 19-11: «depende de si tiene backrow para el Ryu Kokki o no». */
pos("floaters 19-11", "1900 contra su Pyramid Turtle sin nada boca abajo: no se ataca (sale un 2400)",
    "E, 19-11: «depende de si tiene backrow para el Ryu Kokki»", () => {
  const d = mesa({ mios:{ campo:["Luster Dragon"] }, suyos:{ campo:["Pyramid Turtle"], mano:["Pot of Greed"] }, turno:6 });
  return { d, q: preguntaBatalla([d.zones[0][L.MZONE][0]]), bien: r => r?.action !== BA.SELECT_BATTLE };
});
pos("floaters 19-11", "…y con Sakuretsu Armor puesta, sí: lo que salga se come la trampa",
    "contraejemplo", () => {
  const d = mesa({ mios:{ campo:["Luster Dragon"], mt:["Sakuretsu Armor"] }, suyos:{ campo:["Pyramid Turtle"], mano:["Pot of Greed"] }, turno:6 });
  return { d, q: preguntaBatalla([d.zones[0][L.MZONE][0]]), bien: r => r?.action === BA.SELECT_BATTLE };
});
pos("floaters 19-11", "…y con Bottomless Trap Hole, también (lo que sale es invocación especial)",
    "contraejemplo", () => {
  const d = mesa({ mios:{ campo:["Luster Dragon"], mt:["Bottomless Trap Hole"] }, suyos:{ campo:["Pyramid Turtle"], mano:["Pot of Greed"] }, turno:6 });
  return { d, q: preguntaBatalla([d.zones[0][L.MZONE][0]]), bien: r => r?.action === BA.SELECT_BATTLE };
});
/* ══════════════ ejecutar ══════════════ */
const familias = new Map();
const fallos = [];
let total = 0;

for(const P0 of POSICIONES){
  if(process.env.BANCO_FAMILIA && P0.familia !== process.env.BANCO_FAMILIA) continue;
  let nota = 0, hizo = "(reventó)";
  try{
    const { d, q, bien, regular, previo } = P0.montar();
    /* `previo` le hace preguntas al MISMO cerebro antes de la buena: para
       lo que depende de lo que ya hizo este turno (la segunda Waboku). */
    const cerebro = pensar(d);
    if(previo) previo(cerebro);
    const r = cerebro(q, 0);
    hizo = queHizo(r);
    nota = bien?.(r, cerebro) ? 1 : (regular?.(r, cerebro) ? 0.5 : 0);
  }catch(e){ hizo = "error: " + e.message; }
  total += nota;
  const f = familias.get(P0.familia) ?? { n:0, de:0 };
  f.n += nota; f.de += 1; familias.set(P0.familia, f);
  if(nota < 1) fallos.push({ ...P0, hizo, nota });
  if(!soloFallos && nota===1) console.log(`  ✓ ${P0.titulo}`);
}

const sobre100 = Math.round(total / POSICIONES.length * 100);
console.log(`\n═══ BANCO DE POSICIONES · ${destino} ═══`);
console.log(`nota: ${sobre100}/100   (${total} de ${POSICIONES.length} posiciones)\n`);
for(const [f, {n, de}] of familias)
  console.log(`  ${String(Math.round(n/de*100)).padStart(3)}%  ${f}  (${n}/${de})`);

if(fallos.length){
  console.log(`\n── falla en ${fallos.length} ──`);
  for(const f of fallos)
    console.log(`  ${f.nota ? "~" : "✗"} ${f.titulo}\n      hizo: ${f.hizo}   ·   de: ${f.de}`);
}
process.exit(0);
