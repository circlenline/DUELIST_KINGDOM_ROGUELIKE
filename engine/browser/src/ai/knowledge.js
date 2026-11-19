/* ══════════════════════════════════════════════════════════════════
   CONOCIMIENTO DE CARTAS — indexado por NOMBRE, no por passcode.

   Clave del diseño: añadir un mazo nuevo debe ser añadir filas aquí,
   nunca escribir código. WindBot, la IA de EDOPro, hace lo contrario
   (un "executor" programado por mazo) y por eso solo juega bien los
   mazos que alguien programó a mano. Con 20+ mazos por delante, esto
   tiene que ser una tabla.
   ══════════════════════════════════════════════════════════════════ */

// El nombre canónico ignora las variantes: "Scapegoat (GOAT)" → "Scapegoat"
export const canon = n => String(n||"").replace(/\s*\((GOAT|Pre-errata|Anime)\)\s*$/i,"").trim();

/* rol: para qué sirve · valor: cuánto duele perderla (en "cartas")
   cuando: política de uso · notas: por qué (para el log de la IA)

   Cuatro banderas más, copiadas del vocabulario de WindBot (la IA de
   EDOPro), que es donde están los conceptos que a la nuestra le faltaban:

     peligroso    contra este monstruo no se ataca aunque las cuentas
                  salgan: D.D. Warrior Lady destierra a los dos, Spirit
                  Reaper no muere en combate, un muro de 2000 se lo come
                  todo. (WindBot: IsMonsterDangerous)
     prioritario  esto hay que quitarlo YA, antes que ninguna otra cosa:
                  Jinzo, Royal Decree, Thousand-Eyes Restrict, Level Limit.
                  Mientras esté puesto, tu mazo no funciona.
                  (WindBot: IsFloodgate)
     espiritu     vuelve a tu mano en la End Phase, así que invocarlo sin
                  poder atacar ese mismo turno es tirar la invocación.
     invoca       su efecto pone en el campo la carta que diga; si esa
                  carta ya está fuera, el efecto no consigue nada. */
export const CARTAS = {
  // ── Motores de ventaja ──────────────────────────────────────────
  "Pot of Greed":        { rol:"draw", valor:2.0, cuando:"siempre" },
  "Graceful Charity":    { rol:"draw", valor:2.0, cuando:"conDescarteBueno",
                           nota:"Guardarla hasta tener Sinister Serpent u otro descarte gratis" },
  /* Trap Dustshoot: con 4+ cartas en su mano, mira la mano y devuelve un
     monstruo al mazo. Su momento es la Draw/Standby del rival, recién
     robado y antes de que baje nada (E, 20-09: se quedó puesta con él a
     cuatro cartas). */
  "Trap Dustshoot":      { rol:"trampaMano", valor:1.2, reactiva:true },
  /* Phoenix Wing Wind Blast: descarta 1 y pone una carta suya encima de
     su mazo. No destruye: no dispara floaters (Sangan, Tomato), no le da
     LIGHT/DARK para el Chaos y le hace volver a robar esa carta
     (goatformat, «Phoenix Wing: An Often Overlooked Gem»). */
  "Phoenix Wing Wind Blast":{ rol:"giro", valor:1.3, reactiva:true },
  "Delinquent Duo":      { rol:"handRip", valor:1.8, cuando:"sinSerpentRival",
                           nota:"Si el rival tiene Sinister Serpent en mano, se neutraliza" },
  "Card Destruction":    { rol:"draw", valor:1.2, cuando:"conManoMala" },

  // ── Remoción puntual ────────────────────────────────────────────
  /* `soloCaraArriba`: la carta solo puede apuntar a monstruos boca arriba.
     Sin esto, con el rival todo tapado, `amenazaMayor` devolvía una tapada,
     la carta se activaba y el único objetivo legal era un monstruo PROPIO. */
  "Smashing Ground":     { rol:"removal", valor:1.0, cuando:"siHayAmenaza", soloCaraArriba:true },
  "Nobleman of Crossout":{ rol:"removal", valor:1.2, cuando:"contraBocaAbajo",
                           nota:"Solo contra monstruos colocados; desterrar mata a los flip" },
  "Ring of Destruction": { rol:"removal", valor:1.6, cuando:"amenazaGrande", rapida:true, soloCaraArriba:true,
                           nota:"No es remoción normal: guardarla para lo gordo o para rematar" },
  "Exiled Force":        { rol:"removal", valor:1.0, cuando:"siHayAmenaza" },
  "Tribe-Infecting Virus":{ rol:"removal", valor:1.2, cuando:"conDescarteBarato" },
  /* Solo apunta a monstruos BOCA ARRIBA. Sin esto, con el rival solo con
     tapadas (o vacío), el único objetivo legal era él mismo (E, 19-09). */
  "Chaos Sorcerer":      { rol:"removal", valor:1.6, cuando:"siHayAmenaza", noAtacaTrasEfecto:true, soloCaraArriba:true },
  "D.D. Warrior Lady":   { rol:"trade", valor:1.0, peligroso:true,
                           nota:"Destierra a los dos: atacarla nunca es un cambio a favor" },
  "Sakuretsu Armor":     { rol:"trapRemoval", valor:0.9, reactiva:true },
  "Mirror Force":        { rol:"trapMass", valor:1.6, reactiva:true },
  "Torrential Tribute":  { rol:"trapMass", valor:1.6, reactiva:true,
                           nota:"Castiga al que invoca tras haber gastado remoción" },
  "Solemn Judgment":     { rol:"counter", valor:1.4, reactiva:true, costeLP:0.5 },

  // ── Remoción masiva y de magias ─────────────────────────────────
  "Heavy Storm":         { rol:"massRemoval", valor:1.8, cuando:"jugadaDePoder",
                           nota:"Solo cuando prepara una jugada fuerte, no para limpiar por limpiar" },
  "Mystical Space Typhoon":{ rol:"spellRemoval", valor:1.0, cuando:"contraEquipoOReanimacion",
                           rapida:true,
                           nota:"Guardarla para Snatch Steal, Premature Burial o Call of the Haunted" },
  "Dust Tornado":        { rol:"spellRemoval", valor:1.0, reactiva:true },

  // ── Control y tempo ─────────────────────────────────────────────
  "Scapegoat":           { rol:"stall", valor:1.2, rapida:true, restringeInvocacion:true,
                           nota:"No usarla en tu turno: bloquea tu invocación. Encadenar en End Phase rival" },
  "Book of Moon":        { rol:"trick", valor:1.1, rapida:true, soloCaraArriba:true,
                           nota:"Corta ataques, apaga efectos y prepara Nobleman" },
  /* Espíritu, sí, pero se invoca POR SU EFECTO —tumbar un monstruo boca
     abajo— no para pegar. `efectoAlInvocar` lo distingue de Asura Priest,
     que sin poder atacar ese turno no hace nada. */
  "Tsukuyomi":           { rol:"trick", valor:1.4, espiritu:true, efectoAlInvocar:true, soloCaraArriba:true,
                           nota:"Reutiliza tus flip y desactiva monstruos rivales" },
  "Thousand-Eyes Restrict":{ rol:"lock", valor:2.0, cuando:"conObjetivoBueno", prioritario:true, absorbe:true,
                           nota:"Sin un monstruo rival fuerte que absorber, no compensa. Enfrente: bloquea ataques y cambios de posición, hay que quitarlo antes que nada" },
  /* Relinquished (19-11, E): «la IA ve que relinquished es un 0/0 y no
     lee el efecto». Cada turno se lleva un monstruo del rival como
     equipo, copia su ATK/DEF, el equipo muere en su lugar en combate y el
     daño que recibe se le devuelve al otro. Es el mismo tipo de carta que
     el TER: una LLAVE del tablero, no un cuerpo de 0. */
  "Relinquished":        { rol:"lock", valor:2.0, cuando:"conObjetivoBueno", prioritario:true, absorbe:true,
                           nota:"Absorbe un monstruo rival por turno; enfrente hay que quitarlo antes que nada (Book of Moon le rompe el equipo)" },
  /* El ritual de Relinquished. Sin esta fila el texto («This card is used
     to Ritual Summon…») no decía nada a `lectura.js`, valía cero y el mazo
     de Relinquished no lo sacaba NUNCA: medido, 0 por partida (19-11). */
  /* Buscan al ser INVOCADOS (normal o por volteo): colocados no hacen
     nada hasta que alguien los voltee. El mazo de Relinquished los
     colocaba y perdía un turno de búsqueda (19-11). */
  "Manju of the Ten Thousand Hands":{ rol:"beater", valor:1.3, efectoAlInvocar:true, buscaAlInvocar:true },
  "Senju of the Thousand Hands":    { rol:"beater", valor:1.3, efectoAlInvocar:true, buscaAlInvocar:true },
  "Sonic Bird":                     { rol:"beater", valor:1.0, efectoAlInvocar:true, buscaAlInvocar:true },
  "Black Illusion Ritual":{ rol:"invocador", valor:1.0, invoca:"Relinquished", ritual:true },
  "Metamorphosis":       { rol:"fusion", valor:1.4, cuando:"conObjetivoBueno" },
  /* Las fichas de Scapegoat no son cartas: no cuestan nada y son justo el
     combustible de Metamorphosis. Valían 1.0 como cualquier desconocida y
     el bot prefería sacrificar un monstruo de verdad antes que una ficha. */
  "Sheep Token":         { rol:"ficha", valor:0.05, esFicha:true,
                           nota:"Material de Metamorphosis y muro; no cuenta como carta" },
  "Creature Swap":       { rol:"swap", valor:1.3,
                           nota:"Con fichas en campo: le das una ficha y te llevas su monstruo" },
  "Enemy Controller":    { rol:"trick", valor:1.1, rapida:true },

  // ── Reanimación y robo ──────────────────────────────────────────
  "Premature Burial":    { rol:"revival", valor:1.3, costeLP:800, vulnerable:true },
  "Call of the Haunted": { rol:"revival", valor:1.3, vulnerable:true,
                           nota:"Mejor de forma agresiva; en defensa el rival la responde" },
  "Snatch Steal":        { rol:"equipSteal", valor:1.6, vulnerable:true, prioritario:true },
  /* E, 26-09 (Empty Jar, p2): «jugar Mind Control para no pegar o usar de
     material de sacrificio, no merece la pena nunca». En esta versión el
     robado NO puede atacar ni tributarse: lo único que compra es quitarle
     ese monstruo de delante durante MI batalla. */
  "Mind Control":        { rol:"prestamoMudo", valor:1.1 },

  // ── Monstruos con función ───────────────────────────────────────
  "Sinister Serpent":    { rol:"recurso", valor:1.5, noColocar:true,
                           nota:"Vale más en la mano: protege de Delinquent Duo y alimenta descartes" },
  "Sangan":              { rol:"floater", valor:1.2, noColocar:true,
                           nota:"Colocado muere a Nobleman; se usa atacando" },
  "Mystic Tomato":       { rol:"floater", valor:1.1 },
  /* Los reclutadores de atributo que faltaban (19-11): Shining Angel no
     contaba como floater y matarlo «gratis» valía igual que un cuerpo. */
  "Shining Angel":       { rol:"floater", valor:1.1, recurrente:true },
  "Mother Grizzly":      { rol:"floater", valor:1.1, recurrente:true },
  "UFO Turtle":          { rol:"floater", valor:1.1, recurrente:true },
  "Flying Kamakiri #1":  { rol:"floater", valor:1.1, recurrente:true },
  "Howling Insect":      { rol:"floater", valor:1.0, recurrente:true },
  "Masked Dragon":       { rol:"floater", valor:1.1, recurrente:true },
  /* 400 de ataque que pegan con 3400. Reportado por E: el bot le atacó
     «porque 400 es poco» y perdió el monstruo. `atkSiPaga` lo mira
     `evaluar.js` cuando se decide un ataque, contando los LP de su
     dueño: si no le llegan los 2000, la Lily es lo que pone. */
  "Injection Fairy Lily":{ rol:"beater", valor:1.5, atkSiPaga:3000, costeLPAtaque:2000,
                           nota:"Paga 2000 LP y pega con 3400: no se le ataca con nada por debajo" },
  "Magician of Faith":   { rol:"flip", valor:1.4, colocarPreferente:true },
  "Dekoichi the Battlechanted Locomotive":{ rol:"flip", valor:1.2, colocarPreferente:true },
  /* Su volteo DESTRUYE un monstruo del rival (el texto de «vuelve un
     volteo del cementerio» es otro efecto, el de cuando se descarta). Sin
     `destruyeAlVoltear` el bot lo volteaba contra un Sangan: E, 25-09. */
  "Night Assailant":     { rol:"flip", valor:1.1, colocarPreferente:true, destruyeAlVoltear:true,
                           voltearVale:"monstruoRival" },
  /* Los espíritus vuelven a la mano en tu End Phase. Un usuario de Reddit
     reportó al bot invocando Asura Priest en el turno 1, donde no hay
     Battle Phase: la invocación del turno tirada a la basura. */
  "Asura Priest":        { rol:"beater", valor:1.3, atacaTodos:true, espiritu:true },
  "Airknight Parshath":  { rol:"beater", valor:1.6, perfora:true, robaAlGolpear:true },
  "Breaker the Magical Warrior":{ rol:"beater", valor:1.4, rompeBackrow:true },
  /* Su efecto de desterrar le quita el ataque de ese turno; si destruye
     en batalla, ataca otra vez seguido (guía, P05 y C29). */
  "Black Luster Soldier - Envoy of the Beginning":{ rol:"bomba", valor:2.2, noAtacaTrasEfecto:true, dobleAtaque:true },
  "Jinzo":               { rol:"bomba", valor:1.8, apagaTrampas:true, prioritario:true },

  // ── Buscadores que se agotan ────────────────────────────────────
  /* Thunder Dragon descarta para buscar DOS copias. Cuando ya no quedan
     copias en el mazo, activarlo es tirar una carta a la basura: E lo vio
     hacerlo dos veces seguidas con las dos copias que acababa de buscar.
     `necesitaCopias` lo dice; `brain.js` mira lo que queda de mazo. */
  /* E, 19-09: «invocar Thunder Dragon casi nunca es bueno: está para
     acelerar el mazo, como descarte y como combustible de los Chaos».
     `soloMaterial`: no se invoca ni se coloca salvo que remate. */
  "Thunder Dragon":      { rol:"buscador", valor:1.1, necesitaCopias:1, soloMaterial:true,
                           nota:"Sin copias en el mazo no busca nada: es descartar por descartar" },
  "Magical Merchant":    { rol:"flip", valor:1.0, colocarPreferente:true },
  "Mystic Swordsman LV2":{ rol:"removal", valor:1.1, contraBocaAbajo:true },
  "Gravekeeper's Spy":   { rol:"muro", valor:1.3, colocarPreferente:true,
                           nota:"2000 de defensa y busca otra al voltearse. Boca arriba en ataque son 1200 y sí hay que pegarle: los números ya lo dicen, no hace falta marcarla" },
  "Giant Soldier of Stone":{ rol:"muro", valor:0.7, colocarPreferente:true },
  "Gravekeeper's Guard": { rol:"muro", valor:1.1, colocarPreferente:true },
  "Big Shield Gardna":   { rol:"muro", valor:0.9, colocarPreferente:true },
  /* ══ SISTEMA C · REACTIVAS QUE SE GASTABAN A NADA ══
     Dos casos del mismo log de E. `Waboku` se activaba en la PROPIA Main
     Phase 1 del bot, donde no hay ningún ataque que anular: la carta se
     iba a la basura. `Just Desserts` se encadenaba en la Draw Phase del
     rival por 500 puntos, con un solo monstruo en la mesa.

     Ninguna de las dos estaba en esta tabla, así que caían en la lectura
     genérica del texto y sacaban nota suficiente para jugarse. Ahora
     tienen rol propio y el cerebro sabe QUÉ tiene que haber en la mesa
     para que valgan algo. */
  "Waboku":              { rol:"proteccionBatalla", valor:1.1, reactiva:true },
  /* Threatening Roar NO para un ataque ya declarado: impide DECLARAR
     ataques. Su momento es el inicio de la Battle Phase del rival (o su
     Main Phase 1), antes del primer ataque (E, 25-09, PACMAN T4). */
  "Threatening Roar":    { rol:"antiAtaque", valor:1.0, reactiva:true },
  "Draining Shield":     { rol:"proteccionBatalla", valor:1.3, reactiva:true },
  "Negate Attack":       { rol:"proteccionBatalla", valor:1.2, reactiva:true },
  "Just Desserts":       { rol:"quemaPorMonstruos", valor:1.2, reactiva:true, porCabeza:500 },
  "Ceasefire":           { rol:"quemaPorMonstruos", valor:1.4, reactiva:true, porCabeza:500 },
  "Secret Barrel":       { rol:"quemaPorMonstruos", valor:1.2, reactiva:true, porCabeza:200 },

  /* ══ SISTEMA B · CARTAS CUYO VALOR DEPENDE DE CÓMO ENTRAN ══
     Man-Eater Bug invocada de frente es un cuerpo de 450 que no hace
     nada; colocada, se lleva un monstruo en cuanto la tocan. Es el
     ejemplo perfecto de carta que hay que COLOCAR, no invocar. */
  "Man-Eater Bug":       { rol:"flip", valor:1.5, colocarPreferente:true, prefiereSet:true,
                           voltearVale:"monstruoRival", destruyeAlVoltear:true },
  "Nobleman-Eater Bug":  { rol:"flip", valor:1.5, colocarPreferente:true, prefiereSet:true,
                           voltearVale:"monstruoRival", destruyeAlVoltear:true },
  /* Devuelve a la mano el monstruo con el que combate: puede atacar
     HACIA ARRIBA a propósito, comerse el daño y quitar de en medio un
     monstruo que no podría matar de otra forma. */
  "Hyper Hammerhead":    { rol:"beater", valor:1.3, rebota:true },
  /* Pasa a defensa con 0 al atacar: si va a ser tributado, que ataque
     ANTES; después ya no vale para nada. */
  "Goblin Attack Force": { rol:"beater", valor:1.4, atacaAntesDeTributar:true },
  "Goblin Elite Attack Force": { rol:"beater", valor:1.4, atacaAntesDeTributar:true },
  /* Con tres contadores se transforma en Dark Magician. Antes de
     gastarlo conviene mirar si su propio ataque vale más. */
  "Skilled Dark Magician": { rol:"beater", valor:1.6, invoca:"Dark Magician",
                             atacaAntesDeTributar:true },
  "Skilled White Magician": { rol:"beater", valor:1.4, atacaAntesDeTributar:true },
  /* Un cuerpo de 800 cuyo valor es el combo: de frente solo cobra daño. */
  "Black Dragon's Chick": { rol:"apoyo", valor:1.1, prefiereSet:true },

  "Spirit Reaper":       { rol:"muro", valor:1.2, inmuneCombate:true,
                           nota:"No muere en combate por mucho ataque que le eches: la cuenta de ATK no vale para él" },
  "Pyramid Turtle":      { rol:"floater", valor:1.2 },
  "Emissary of the Afterlife":{ rol:"floater", valor:1.0 },
  "Morphing Jar":        { rol:"flip", valor:1.3, colocarPreferente:true },
  "Exiled Force":        { rol:"removal", valor:1.0, cuando:"siHayAmenaza" },
  "D.D. Assailant":      { rol:"trade", valor:1.0, peligroso:true },
  "Blade Knight":        { rol:"beater", valor:1.2 },
  "Don Zaloog":          { rol:"beater", valor:1.3 },

  // ── Quema y control de largo plazo ──────────────────────────────
  "Des Koala":           { rol:"quema", valor:1.4, colocarPreferente:true },
  "Magic Cylinder":      { rol:"trapRemoval", valor:1.3, reactiva:true, quema:true },
  "Ceasefire":           { rol:"quema", valor:1.1, reactiva:true },
  "Level Limit - Area B":{ rol:"muroGlobal", valor:1.5, continua:true, prioritario:true },
  "Gravity Bind":        { rol:"muroGlobal", valor:1.5, continua:true, prioritario:true },
  "Messenger of Peace":  { rol:"muroGlobal", valor:1.3, continua:true, costeLP:100, prioritario:true },
  "Wall of Revealing Light":{ rol:"muroGlobal", valor:1.4, continua:true, prioritario:true },
  "Swords of Revealing Light":{ rol:"stallGlobal", valor:1.3 },
  "Royal Decree":        { rol:"lock", valor:1.6, continua:true, prioritario:true },
  /* ── CARTAS QUE HABILITAN A OTRAS ──
     Toon World no hace NADA por sí sola: paga 1000 puntos de vida y ya.
     Lo que hace es que el resto del mazo exista. El lector de textos no
     puede sacar eso de "Pay 1000 Life Points", así que sin este caso el
     Pegasus del modo historia jugaba un mazo con nueve cartas muertas y
     perdía el 75% contra el mazo inicial sin mejorar. `habilita` es la
     marca del nombre: todo lo que empiece por "Toon " depende de ella. */
  "Toon World":          { rol:"habilita", valor:1.9, continua:true, costeLP:1000,
                           habilita:"Toon", prioritario:true },
  "Magic Reflector":     { rol:"protege", valor:0.9, protege:"continua" },
  "Final Countdown":     { rol:"reloj", valor:2.5 },
  /* ══════════════════════════════════════════════════════════════
     MOTORES DE VOLTEO — el plan de tres de los veinte mazos.

     PACMAN, Clown Control y Phoenix no ganan atacando: ganan volteando
     el mismo bicho cada turno. Des Lacooda roba una carta cada vez que
     se voltea; Swarm of Scarabs le destruye una tapada; Swarm of
     Locusts, una mágica o trampa; Medusa Worm, el monstruo que sea;
     Golem Sentry se lo devuelve a la mano; Blade Rabbit destruye al
     voltearse y Dream Clown al pasar a DEFENSA.

     Para el bot esto era invisible por partida doble: no sabía que esas
     cartas hacían algo al voltearse, y su freno anti-bucle —"llevas dos
     giros con esta carta, para"— apagaba justamente el motor del mazo.

     `voltearVale` dice QUÉ tiene que haber para que el volteo consiga
     algo, y `aDefensa` marca las que se disparan yendo a defensa. */
  /* `reTapa`: «una vez por turno, puedes poner esta carta boca abajo en
     defensa». Es la otra mitad del motor (E, 25-09, PACMAN): se voltea
     para usar el efecto y en la Main Phase 2 se vuelve a tapar, así no
     se queda de frente con 300 de ataque y el turno siguiente se voltea
     otra vez. */
  "Des Lacooda":         { rol:"flip", valor:1.2, colocarPreferente:true, reTapa:true,
                           voltearVale:"siempre", nota:"Roba una carta cada volteo: es el motor" },
  "Swarm of Scarabs":    { rol:"flip", valor:1.3, colocarPreferente:true, reTapa:true,
                           voltearVale:"monstruoRival", destruyeAlVoltear:true },
  "Swarm of Locusts":    { rol:"flip", valor:1.3, colocarPreferente:true, reTapa:true,
                           voltearVale:"backrowRival" },
  "Medusa Worm":         { rol:"flip", valor:1.4, colocarPreferente:true, reTapa:true,
                           voltearVale:"monstruoRival", destruyeAlVoltear:true },
  "Golem Sentry":        { rol:"flip", valor:1.2, colocarPreferente:true, reTapa:true,
                           voltearVale:"monstruoRival" },
  /* Texto: al pasar de ataque a defensa boca arriba, destruye 1 monstruo
     rival. Es de la familia de los Clown (`aDefensa`), no un volteo. */
  "Blade Rabbit":        { rol:"flip", valor:1.1, colocarPreferente:true, aDefensa:true,
                           voltearVale:"monstruoRival" },
  "Dream Clown":         { rol:"flip", valor:1.3, colocarPreferente:true,
                           aDefensa:true, voltearVale:"monstruoRival",
                           nota:"Destruye al pasar a DEFENSA, no al voltearse" },
  "Crass Clown":         { rol:"flip", valor:1.1, colocarPreferente:true, aDefensa:true,
                           voltearVale:"monstruoRival" },
  "Old Vindictive Magician":{ rol:"flip", valor:1.3, colocarPreferente:true,
                           voltearVale:"monstruoRival" },
  "Cyber Jar":           { rol:"flip", valor:1.6, colocarPreferente:true,
                           voltearVale:"siempre" },
  "Stumbling":           { rol:"apoyo", valor:1.3, continua:true,
                           nota:"Todo lo que invoque va a defensa: dispara a los Clown" },

  // ── piezas de mazo que el bot no conocía ────────────────────────
  "Rescue Cat":          { rol:"buscador", valor:1.6, necesitaCopias:0,
                           nota:"Con The Wicked Worm Beast es un +1: el Worm vuelve a la mano" },
  "The Wicked Worm Beast":{ rol:"chatarra", valor:0.6 },
  "Manticore of Darkness":{ rol:"bomba", valor:1.9,
                           nota:"Vuelve solo descartando monstruos: no se protege, se usa" },
  "Milus Radiant":       { rol:"apoyo", valor:0.8 },
  "Gyaku-Gire Panda":    { rol:"beater", valor:1.1 },
  "Bazoo the Soul-Eater":{ rol:"beater", valor:1.4,
                           nota:"Se come el cementerio y pega con 2500" },
  "Return from the Different Dimension":{ rol:"masiva", valor:2.2,
                           nota:"Devuelve todo lo desterrado de golpe: es el remate" },
  /* Vuelve en la Standby si lo destruye una carta del rival. Contra él,
     DESTERRAR vale mucho más que destruir (guía, V27). */
  "Vampire Lord":        { rol:"beater", valor:1.6, recurrente:true },
  /* Las que se aprovechan de morir: matarlas les da algo; desterrarlas no. */
  "Pyramid Turtle":      { rol:"floater", valor:1.1, recurrente:true },
  "Giant Rat":           { rol:"floater", valor:1.0, recurrente:true },
  /* ══ TRAMPAS DE INVOCACIÓN ══
     Estaban sin escribir y caían en la lectura automática, que les ponía
     un umbral de ataque. E, 18-09: «el bottomless traphole probablemente
     era mejor usarlo en el vamp, no esperar a un tribute summon; hay que
     jugarlo dependiendo de la mesa, no de un threshold de atk». Se
     decide en `brain.js`, caso "trapInvocacion", mirando la mesa. */
  "Bottomless Trap Hole":{ rol:"trapInvocacion", valor:1.4, reactiva:true, destierra:true },
  "Trap Hole":           { rol:"trapInvocacion", valor:1.2, reactiva:true },
  /* E, 19-09 (Gravekeeper, p1): la IA devolvió a la mano un Spirit Reaper
     recién COLOCADO. Compulsory Evacuation Device es tempo: rinde contra lo
     que costó más que una carta traer (tributos, invocaciones especiales,
     Extra) o contra el que me está atacando. `brain.js`, caso "rebote". */
  "Compulsory Evacuation Device":{ rol:"rebote", valor:1.3, reactiva:true },
  /* ══ ODIO AL CEMENTERIO ══
     E, 18-09: «turno 1 el soul release no aporta nada». Destierra hasta
     cinco cartas de los cementerios: vale lo que haya que quitarle. */
  "Soul Release":        { rol:"cementerioHate", valor:1.2 },
  "Ryu Kokki":           { rol:"beater", valor:1.5 },
  "Book of Life":        { rol:"revival", valor:1.3 },
  "Enraged Battle Ox":   { rol:"beater", valor:1.3, perfora:true,
                           nota:"Da perforación a todas tus bestias" },
  "Berserk Gorilla":     { rol:"beater", valor:1.2 },
  "King Tiger Wanghu":   { rol:"beater", valor:1.3, prioritario:true,
                           nota:"Le mata todo lo que invoque por debajo de 1400" },
  "Pitch-Black Warwolf": { rol:"beater", valor:1.2,
                           nota:"Mientras ataca, sus trampas no existen" },
  "Mataza the Zapper":   { rol:"beater", valor:1.4,
                           nota:"Ataca dos veces: 2600 de daño directo por turno" },
  "Gravekeeper's Spear Soldier":{ rol:"beater", valor:1.3, perfora:true },
  "Gravekeeper's Assailant":{ rol:"beater", valor:1.3 },
  "Necrovalley":         { rol:"campo", valor:1.8, prioritario:true,
                           nota:"Sin ella el mazo Gravekeeper es vainilla" },
  "Terraforming":        { rol:"buscador", valor:1.1, necesitaCopias:0 },
  "Rite of Spirit":      { rol:"revival", valor:1.2 },
  "Horus the Black Flame Dragon LV4":{ rol:"beater", valor:1.2 },
  "Horus the Black Flame Dragon LV6":{ rol:"beater", valor:1.7 },
  "Horus the Black Flame Dragon LV8":{ rol:"bomba", valor:2.2, prioritario:true },
  "Fusilier Dragon, the Dual-Mode Beast":{ rol:"beater", valor:1.1 },
  "Sacred Crane":        { rol:"floater", valor:1.2 },
  "Reasoning":           { rol:"invocaDelMazo", valor:1.8 },
  "Monster Gate":        { rol:"invocaDelMazo", valor:1.8 },
  "Dimension Fusion":    { rol:"masiva", valor:2.2 },
  "Dark Magician of Chaos":{ rol:"bomba", valor:2.0, prioritario:true },
  "Wave-Motion Cannon":  { rol:"quema", valor:1.9, acumula:true, sostener:true,
                           nota:"Cada turno que aguanta puesta vale 1000 más" },

  /* Reportado en Reddit: el bot reanimó Hand of Nephthys teniendo ya el
     Phoenix en el campo y se voló dos monstruos suyos para nada. `invoca`
     dice qué pone en el campo; si eso ya está fuera, el efecto no
     consigue nada y no se activa. */
  "Hand of Nephthys":    { rol:"invocador", valor:1.2, colocarPreferente:true,
                           invoca:"Sacred Phoenix of Nephthys" },
  "Sacred Phoenix of Nephthys":{ rol:"bomba", valor:1.9, prioritario:true },
  "Apprentice Magician": { rol:"floater", valor:1.1 },
  "Kycoo the Ghost Destroyer":{ rol:"beater", valor:1.2 },
  "Berserk Gorilla":     { rol:"beater", valor:1.1 },
  "Mystic Swordsman LV2":{ rol:"removal", valor:1.1, contraBocaAbajo:true },
};

/* Cuando una carta no está en la tabla, se deduce del propio dato de
   carta. Así el motor de IA nunca se queda mudo con un mazo nuevo. */
export function conocer(nombre, datos){
  const k = CARTAS[canon(nombre)];
  if(k) return k;
  const t = datos?.type ?? 0;
  if(t & 0x1){        // monstruo
    const atk = datos.attack ?? 0;
    // 0x4000 es TYPE_TOKEN: una ficha no es una carta, perderla no cuesta nada
    if(t & 0x4000) return { rol:"ficha", valor:0.05, esFicha:true, deducido:true };
    return { rol: atk>=1900 ? "beater" : atk>=1500 ? "beater" : "chatarra",
             valor: atk>=2400 ? 1.6 : atk>=1700 ? 1.1 : 0.8, deducido:true };
  }
  if(t & 0x4) return { rol:"trapRemoval", valor:1.0, reactiva:true, deducido:true };
  if(t & 0x2) return { rol:"spell", valor:1.0, deducido:true };
  return { rol:"desconocido", valor:1.0, deducido:true };
}
