/* ══════════════════════════════════════════════════════════════════
   EL PLAN DE PARTIDA — con qué gana ESTE mazo, y en qué orden.

   El bot jugaba las 20 barajas igual: puntuaba cartas sueltas y soltaba
   la de más nota. Un jugador no juega así. Antes de la primera carta ya
   sabe cómo gana —"yo alargo y quemo", "yo pongo un Black Luster Soldier
   y lo protejo", "yo volteo un bicho cada turno debajo de un Gravity
   Bind"— y eso cambia lo que vale cada carta de su mano.

   Los datos de aquí NO son inventados: salen de las guías de cada mazo
   de goatformat.com, contrastadas una a una con la lista que lleva cada
   baraja del juego. Las citas están en los comentarios de cada plan para
   que se pueda comprobar y corregir.

   Es una TABLA, no código por mazo. Añadir una baraja nueva debe ser
   añadir filas. WindBot, la IA de EDOPro, hace lo contrario —un
   "executor" programado a mano por mazo— y por eso solo juega bien lo
   que alguien programó.

   Lo que sale de aquí lo usa `brain.js`:
     objetivo   cómo se gana de verdad: pegando, quemando, deckeando…
     agresivo   cuánto vale el daño frente a la ventaja de cartas
     aguanta    el plan es llegar vivo al final
     claves     las cartas CON LAS QUE SE GANA, con peso: 3 = es la
                partida, 2 = jugada de poder, 1 = ayuda. No se descartan,
                no se cambian por cualquier cosa y se buscan primero.
     motor      lo que hace funcionar el plan: se juega pronto
     sostener   lo que tiene que SEGUIR EN EL CAMPO para que el plan
                exista (Necrovalley, Level Limit, Wave-Motion Cannon).
                Ni se destruye solo ni se deja destruir.
     volteos    el plan es voltear monstruos una y otra vez. Tres mazos
                de los veinte ganan así y el freno anti-bucle del bot los
                dejaba sin jugar.
     pasos      el guion, en orden. Sale en el log para poder leer si el
                bot lo está siguiendo o no.
   ══════════════════════════════════════════════════════════════════ */
import { canon } from "./knowledge.js";

/* Gana el PRIMERO que llega a su mínimo, de lo más especializado a lo más
   genérico: Scapegoat, Metamorphosis y Tsukuyomi están en casi todas las
   barajas del formato, así que contar "el que más señales tenga" dejaba al
   mazo de Burn etiquetado como Goat Control. Los mínimos están puestos
   mirando las 20 listas de verdad, no a ojo. */
const PLANES = [
  {
    /* goatformat.com/library-ftk: bucle de Royal Magical Library con
       cartas mágicas baratas, Reversal Quiz + Black Pendant para rematar.
       No juega al juego: roba hasta cerrar. */
    nombre: "Library FTK",
    objetivo: "combo",
    condicion: "no jugar al juego: robar en bucle hasta cerrar el combo",
    senal: ["Royal Magical Library","Reversal Quiz","Archfiend's Oath",
            "Toon Table of Contents","Spell Reproduction"],
    minimo: 4,
    agresivo: 0.0, aguanta: true,
    claves: { "Royal Magical Library":3, "Reversal Quiz":3, "Black Pendant":2 },
    motor: ["Archfiend's Oath","Toon Table of Contents","Spell Reproduction",
            "A Feather of the Phoenix","Reload","Upstart Goblin","Giant Trunade",
            "Pot of Greed","Graceful Charity"],
    sostener: ["Royal Magical Library","Convulsion of Nature","Level Limit - Area B"],
    pasos: ["poner Royal Magical Library y protegerla",
            "encadenar mágicas baratas para cargar contadores",
            "robar en bucle con Reproduction y Feather of the Phoenix",
            "cerrar con Reversal Quiz + Black Pendant"],
  },
  {
    /* goatformat.com/empty-jar: Card Destruction encadenando Serial Spell.
       Tú te quedas sin mano y el rival se deckea. */
    nombre: "Empty Jar",
    objetivo: "deckout",
    condicion: "vaciarle el mazo: Card Destruction encadenada a Serial Spell",
    senal: ["Serial Spell","Spell Reproduction","Book of Taiyou","The Shallow Grave",
            "Mind Control","Reload"],
    minimo: 5,
    agresivo: 0.1, aguanta: true,
    claves: { "Serial Spell":3, "Card Destruction":3, "Morphing Jar":2, "Cyber Jar":2 },
    motor: ["Spell Reproduction","A Feather of the Phoenix","Reload","Upstart Goblin",
            "Book of Taiyou","The Shallow Grave","Giant Trunade","Mystic Tomato"],
    sostener: [],
    pasos: ["montar la mano con Reload y Upstart",
            "poner Morphing Jar o Cyber Jar y voltearla con Book of Taiyou",
            "Card Destruction encadenando Serial Spell",
            "repetir hasta que se quede sin mazo"],
  },
  {
    /* goatformat.com/final-countdown: activas la cuenta atrás y aguantas
       veinte turnos detrás de muros. No hay que atacar para nada. */
    nombre: "Final Countdown",
    objetivo: "reloj",
    condicion: "activar la cuenta atrás y llegar vivo a los veinte turnos",
    senal: ["Final Countdown","Different Dimension Capsule","Nimble Momonga",
            "Wall of Revealing Light","Solemn Wishes","Light of Intervention"],
    minimo: 5,
    agresivo: 0.0, aguanta: true,
    claves: { "Final Countdown":3 },
    motor: ["Upstart Goblin","Graceful Charity","Pot of Greed","Different Dimension Capsule"],
    sostener: ["Wall of Revealing Light","Level Limit - Area B","Gravity Bind",
               "Solemn Wishes","Light of Intervention"],
    pasos: ["poner los muros antes que nada",
            "activar Final Countdown en cuanto el campo esté seguro",
            "sobrevivir: fichas, Spirit Reaper y Nimble Momonga",
            "no atacar salvo que sea gratis"],
  },
  {
    /* goatformat.com/pacman: "pure advantage camels munch all noobs".
       Monstruos de Pharaonic Guardian que hacen algo al voltearse Y se
       vuelven a poner boca abajo solos, protegidos por Gravity Bind y
       Level Limit. El plan ES voltear, cada turno, para siempre. */
    nombre: "PACMAN",
    objetivo: "control",
    condicion: "voltear un bicho cada turno debajo de los muros y ahogarle en cartas",
    senal: ["Des Lacooda","Swarm of Scarabs","Swarm of Locusts","Medusa Worm",
            "Golem Sentry","Threatening Roar"],
    minimo: 6,
    agresivo: 0.05, aguanta: true, volteos: true,
    claves: { "Medusa Worm":2, "Swarm of Locusts":2, "Swarm of Scarabs":2, "Des Lacooda":2 },
    motor: ["Des Lacooda","Golem Sentry","Swarm of Scarabs","Swarm of Locusts","Medusa Worm"],
    sostener: ["Gravity Bind","Level Limit - Area B","Wall of Revealing Light"],
    pasos: ["poner los muros: Gravity Bind, Level Limit, Wall of Revealing Light",
            "colocar los bichos y voltearlos CADA turno",
            "Book of Moon y Compulsory guardados para Thousand-Eyes Restrict",
            "ganar por cartas, no por daño"],
  },
  {
    /* goatformat.com/clown-control: Dream Clown destruye al pasar a
       DEFENSA y Blade Rabbit al voltearse; Stumbling los dispara solos.
       "Con Stumbling puesto y un Tsukuyomi en la mano, basta un Clown
       para destruir algo cada turno". */
    nombre: "Clown Control",
    objetivo: "control",
    condicion: "Dream Clown y Stumbling: destruirle un monstruo cada turno",
    senal: ["Dream Clown","Blade Rabbit","Stumbling","Mataza the Zapper","Des Lacooda"],
    minimo: 5,
    agresivo: 0.25, aguanta: true, volteos: true,
    claves: { "Dream Clown":2, "Blade Rabbit":2, "Mataza the Zapper":2 },
    motor: ["Stumbling","Reinforcement of the Army","Des Lacooda","Tsukuyomi",
            "Magician of Faith","Sangan"],
    sostener: ["Stumbling","Gravity Bind","Level Limit - Area B"],
    pasos: ["Stumbling puesto: todo lo que invoque va a defensa",
            "Dream Clown de defensa a ataque para destruirle un monstruo",
            "Tsukuyomi para repetir el volteo",
            "Mataza cierra la partida con dos golpes directos"],
  },
  {
    /* goatformat.com/gravekeeper: Necrovalley + muros, y Spear Soldier
       perfora. Necrovalley es la carta: sin ella el mazo es vainilla. */
    nombre: "Gravekeeper",
    objetivo: "beatdown",
    condicion: "Necrovalley puesto y golpear con lo que perfora",
    senal: ["Gravekeeper's Spy","Gravekeeper's Guard","Gravekeeper's Assailant",
            "Gravekeeper's Spear Soldier","Necrovalley","Terraforming"],
    minimo: 6,
    agresivo: 0.6, aguanta: false,
    claves: { "Necrovalley":3, "Gravekeeper's Spear Soldier":2, "Gravekeeper's Assailant":2 },
    motor: ["Terraforming","Gravekeeper's Spy","Gravekeeper's Guard","Rite of Spirit"],
    sostener: ["Necrovalley"],
    pasos: ["Necrovalley en el campo cuanto antes (Terraforming la busca)",
            "Gravekeeper's Spy de muro y para sacar más cuerpos",
            "Assailant obliga a defensa y Spear Soldier perfora",
            "Rite of Spirit recupera bajo Necrovalley"],
  },
  {
    /* goatformat.com/reasoning-gate-otk: Reasoning y Monster Gate vacían
       el mazo y sacan el monstruo gordo; Dimension Fusion llena el campo
       y se remata en un turno. */
    nombre: "Reasoning Gate",
    objetivo: "combo",
    condicion: "sacar el bicho gordo del mazo y rematar en un turno",
    senal: ["Reasoning","Monster Gate","Dimension Fusion","Sacred Crane"],
    minimo: 5,
    agresivo: 0.9, aguanta: false,
    claves: { "Reasoning":3, "Monster Gate":3, "Dimension Fusion":3,
              "Dark Magician of Chaos":2, "Black Luster Soldier - Envoy of the Beginning":2 },
    motor: ["Sacred Crane","Giant Trunade","Graceful Charity","Pot of Greed",
            "Card Destruction","Scapegoat","Metamorphosis"],
    sostener: [],
    pasos: ["fichas de Scapegoat como material y muro",
            "Reasoning o Monster Gate para sacar el monstruo grande",
            "Dimension Fusion para llenar el campo de golpe",
            "atacar con todo: la partida se acaba este turno"],
  },
  {
    /* goatformat.com/bazoo-return: destierras con Bazoo y luego Return
       from the Different Dimension llena el campo sin avisar. */
    nombre: "Bazoo Return",
    objetivo: "combo",
    condicion: "desterrar con Bazoo y devolverlo todo de golpe para rematar",
    senal: ["Bazoo the Soul-Eater","Return from the Different Dimension","Skull Lair"],
    minimo: 4,
    agresivo: 0.85, aguanta: false,
    claves: { "Return from the Different Dimension":3, "Bazoo the Soul-Eater":2,
              "Black Luster Soldier - Envoy of the Beginning":2 },
    motor: ["Thunder Dragon","Dekoichi the Battlechanted Locomotive","Magical Merchant",
            "Graceful Charity","Card Destruction","Morphing Jar","Cyber Jar"],
    sostener: [],
    pasos: ["llenar el cementerio: Thunder Dragon, Merchant, descartes",
            "Bazoo se come el cementerio y pega con 2500",
            "guardar Return para cuando haya bastante desterrado",
            "Return y atacar con todo"],
  },
  {
    /* goatformat.com/burn (variante Goat): Wave-Motion Cannon suma 1000
       por turno y Des Koala pega por cartas en mano. No cambia golpes. */
    nombre: "Burn",
    objetivo: "quema",
    condicion: "quemar desde detrás de un muro: sus puntos de vida son el reloj",
    senal: ["Wave-Motion Cannon","Des Koala","Secret Barrel","Just Desserts",
            "Ookazi","Magic Cylinder","Ceasefire","Spell Shield Type-8"],
    minimo: 4,
    agresivo: 0.2, aguanta: true,
    claves: { "Wave-Motion Cannon":3, "Des Koala":2, "Magic Cylinder":2 },
    motor: ["Magical Merchant","Scapegoat","Swords of Revealing Light",
            "Magician of Faith","Night Assailant","Graceful Charity"],
    sostener: ["Wave-Motion Cannon","Swords of Revealing Light"],
    pasos: ["Wave-Motion Cannon puesta cuanto antes: cada turno vale 1000 más",
            "fichas y flips para no recibir daño",
            "Spell Shield protege la Cannon del Heavy Storm",
            "cobrar la Cannon solo cuando mata"],
  },
  {
    /* goatformat.com/horus: se escala LV4 → LV6 → LV8, y el LV8 apaga
       las mágicas. Fusilier + Metamorphosis hace King Dragun. */
    nombre: "Horus",
    objetivo: "beatdown",
    condicion: "escalar hasta Horus LV8 y dejarle sin mágicas",
    senal: ["Horus the Black Flame Dragon LV6","Horus the Black Flame Dragon LV8",
            "Horus the Black Flame Dragon LV4","Fusilier Dragon, the Dual-Mode Beast"],
    minimo: 4,
    agresivo: 0.75, aguanta: false,
    claves: { "Horus the Black Flame Dragon LV8":3, "Horus the Black Flame Dragon LV6":2 },
    motor: ["Horus the Black Flame Dragon LV4","Fusilier Dragon, the Dual-Mode Beast",
            "Magical Merchant","Magician of Faith","Metamorphosis","Sangan"],
    sostener: [],
    pasos: ["Horus LV4 al campo y que ataque para subir a LV6",
            "el LV6 sobrevive al Book of Moon y a la Snatch Steal",
            "que el LV6 ataque para sacar el LV8",
            "con el LV8 fuera, sus mágicas no existen"],
  },
  {
    /* goatformat.com/sacred-phoenix: Apprentice Magician busca las
       piezas, Hand of Nephthys saca el Phoenix, y el Phoenix vuelve solo
       cada End Phase. Old Vindictive + Tsukuyomi es un bucle de remoción. */
    nombre: "Phoenix",
    objetivo: "control",
    condicion: "sacar el Phoenix, que vuelve solo, y limpiar con el bucle de Vindictive",
    senal: ["Hand of Nephthys","Sacred Phoenix of Nephthys","Apprentice Magician",
            "Old Vindictive Magician"],
    minimo: 4,
    /* OJO: Monarch lleva 3 Apprentice Magician y un Old Vindictive, así que
       llegaba al mínimo y se etiquetaba como Phoenix. Contar señales no
       basta cuando dos mazos comparten el motor: hace falta la carta que
       SOLO tiene este plan. */
    requiere: ["Hand of Nephthys","Sacred Phoenix of Nephthys"],
    agresivo: 0.55, aguanta: false, volteos: true,
    claves: { "Sacred Phoenix of Nephthys":3, "Hand of Nephthys":2 },
    motor: ["Apprentice Magician","Old Vindictive Magician","Magician of Faith",
            "Tsukuyomi","Creature Swap","Sangan","Dekoichi the Battlechanted Locomotive"],
    sostener: [],
    pasos: ["Apprentice Magician para colocar las piezas del mazo",
            "Old Vindictive + Tsukuyomi: un monstruo suyo menos cada turno",
            "Hand of Nephthys solo si el Phoenix no está ya fuera",
            "el Phoenix vuelve en cada End Phase: no hay que protegerlo"],
  },
  {
    /* goatformat.com/cat-control: Rescue Cat + The Wicked Worm Beast es
       un +1 porque el Worm vuelve a la mano en vez de destruirse.
       Metamorphosis → TER, y luego el TER se tributa por Manticore. */
    nombre: "Cat Control",
    objetivo: "control",
    condicion: "Rescue Cat de +1, cerrar con Thousand-Eyes y rematar con Manticore",
    senal: ["Rescue Cat","The Wicked Worm Beast","Manticore of Darkness",
            "Gyaku-Gire Panda","Milus Radiant"],
    minimo: 5,
    agresivo: 0.55, aguanta: false,
    claves: { "Manticore of Darkness":3, "Rescue Cat":2, "Thousand-Eyes Restrict":2 },
    motor: ["Rescue Cat","The Wicked Worm Beast","Metamorphosis","Scapegoat",
            "Sangan","Milus Radiant"],
    sostener: [],
    pasos: ["Rescue Cat sacando Wicked Worm Beast: dos monstruos gratis",
            "ficha o Milus Radiant → Metamorphosis → Thousand-Eyes Restrict",
            "el TER cierra el campo mientras se limpia",
            "tributar el TER por Manticore, que vuelve solo"],
  },
  {
    /* goatformat.com/monarch: cada turno un tributo que hace daño al
       entrar. Apprentice y Old Vindictive son la comida. */
    nombre: "Monarcas",
    objetivo: "beatdown",
    condicion: "un tributo cada turno: que no llegue a tener campo",
    senal: ["Mobius the Frost Monarch","Thestalos the Firestorm Monarch",
            "Zaborg the Thunder Monarch","Treeborn Frog","Brain Control"],
    minimo: 4,
    agresivo: 0.75, aguanta: false,
    claves: { "Mobius the Frost Monarch":2, "Zaborg the Thunder Monarch":2,
              "Thestalos the Firestorm Monarch":2,
              "Black Luster Soldier - Envoy of the Beginning":2 },
    motor: ["Apprentice Magician","Old Vindictive Magician","Brain Control",
            "Scapegoat","Sangan","Magician of Faith"],
    sostener: [],
    pasos: ["poner comida barata: Apprentice, Old Vindictive, fichas",
            "Brain Control roba un monstruo y sirve de tributo",
            "Mobius contra el backrow, Zaborg contra su monstruo",
            "seguir invocando: que no levante campo"],
  },
  {
    /* goatformat.com/deck-guides/relinquished-control (19-11): el armazón
       de Goat Control con Relinquished como remoción que se repite: cada
       turno se lleva un monstruo suyo. Manju y Senju buscan las piezas del
       ritual y Tsukuyomi las vuelve a voltear para buscar otra vez. Va
       ANTES que Goat Control: comparte Scapegoat, Metamorphosis y Tsukuyomi. */
    nombre: "Relinquished",
    objetivo: "control",
    condicion: "ritual de Relinquished y absorber su mejor monstruo cada turno",
    senal: ["Relinquished","Black Illusion Ritual","Manju of the Ten Thousand Hands","Senju of the Thousand Hands"],
    minimo: 4,
    requiere: ["Relinquished"],
    agresivo: 0.45, aguanta: false,
    claves: { "Relinquished":3, "Black Illusion Ritual":2, "Thousand-Eyes Restrict":2,
              "Black Luster Soldier - Envoy of the Beginning":3 },
    motor: ["Manju of the Ten Thousand Hands","Senju of the Thousand Hands","Tsukuyomi",
            "Magician of Faith","Scapegoat","Sangan","Graceful Charity","Pot of Greed"],
    sostener: ["Relinquished"],
    pasos: ["Manju o Senju: buscar Relinquished o el ritual",
            "ritual cuando tenga algo suyo boca arriba que absorber",
            "Relinquished se lleva su mejor monstruo; el equipo le hace de escudo",
            "Tsukuyomi re-tapa a Manju para buscar otra vez"],
  },
  {
    /* goatformat.com/deck-guides/earth-aggro: Giant Rat saca lo que haga
       falta, Gigantes y The Rock Spirit salen gratis desterrando TIERRA del
       cementerio, Goblin Attack Force rompe muros. Llenar la mesa y pegar. */
    nombre: "Earth Aggro",
    objetivo: "beatdown",
    condicion: "llenar la mesa de TIERRA y pegar cada turno",
    senal: ["Gigantes","The Rock Spirit","Goblin Attack Force","Giant Rat","D.D. Assailant"],
    minimo: 8,
    agresivo: 0.9, aguanta: false,
    claves: { "Gigantes":2, "Goblin Attack Force":2, "Injection Fairy Lily":2 },
    motor: ["Giant Rat","Reinforcement of the Army","Smashing Ground","Trap Dustshoot"],
    sostener: [],
    pasos: ["Giant Rat: lo que muera, saca otro TIERRA",
            "Gigantes y The Rock Spirit salen gratis del cementerio",
            "Goblin Attack Force contra los muros",
            "Smashing Ground y Dust Tornado abren el último golpe"],
  },
  {
    /* goatformat.com/deck-guides/water-aggro: A Legendary Ocean (cuenta
       como Umi) sube a los AGUA y baja su nivel: Levia-Dragon - Daedalus
       sale con un tributo y se lleva todo lo demás. Mother Grizzly busca. */
    nombre: "Umi",
    objetivo: "beatdown",
    condicion: "A Legendary Ocean en el campo y presionar con los AGUA",
    senal: ["A Legendary Ocean","Mermaid Knight","Abyss Soldier","Mother Grizzly","Lekunga","Levia-Dragon - Daedalus"],
    minimo: 7,
    agresivo: 0.8, aguanta: false,
    claves: { "A Legendary Ocean":2, "Levia-Dragon - Daedalus":3, "Abyss Soldier":2 },
    motor: ["Mother Grizzly","Terraforming","Lekunga","Mermaid Knight"],
    sostener: ["A Legendary Ocean"],
    pasos: ["A Legendary Ocean pronto: es lo que sube a todo el mazo",
            "Mother Grizzly busca otro AGUA al morir",
            "Abyss Soldier devuelve a la mano su mejor carta",
            "Levia-Dragon - Daedalus limpia la mesa cuando voy por detrás"],
  },
  {
    /* goatformat.com/zombie: la cadena de Pyramid Turtle saca Vampire
       Lord o Ryu Kokki; Creature Swap con fichas es robo puro. */
    nombre: "Zombie",
    objetivo: "beatdown",
    condicion: "encadenar Pyramid Turtle y machacar con lo que sale",
    senal: ["Pyramid Turtle","Vampire Lord","Ryu Kokki","Book of Life","Spirit Reaper"],
    minimo: 4,
    agresivo: 0.8, aguanta: false,
    claves: { "Vampire Lord":2, "Ryu Kokki":2,
              "Black Luster Soldier - Envoy of the Beginning":2 },
    motor: ["Pyramid Turtle","Book of Life","Creature Swap","Scapegoat","Sangan"],
    sostener: [],
    pasos: ["Pyramid Turtle al campo: muera como muera, sale un zombi",
            "Creature Swap: le das una ficha y te llevas su monstruo",
            "Book of Life devuelve el zombi y le destierra el cementerio",
            "Vampire Lord no se va: cada golpe le roba una carta"],
  },
  {
    /* goatformat.com/beastdown: agresión pura. Enraged Battle Ox da
       perforación al resto de bestias; Pitch-Black Warwolf le apaga las
       trampas mientras atacas. */
    nombre: "Beastdown",
    objetivo: "beatdown",
    condicion: "presión desde el turno uno y no dejarle respirar",
    senal: ["Berserk Gorilla","Enraged Battle Ox","King Tiger Wanghu",
            "Pitch-Black Warwolf","Bazoo the Soul-Eater"],
    minimo: 5,
    agresivo: 0.95, aguanta: false,
    claves: { "Enraged Battle Ox":2, "King Tiger Wanghu":2 },
    motor: ["Berserk Gorilla","Pitch-Black Warwolf","Bazoo the Soul-Eater","Asura Priest"],
    sostener: [],
    pasos: ["monstruo grande cada turno y a la cara",
            "Enraged Battle Ox: las bestias perforan la defensa",
            "King Tiger Wanghu le mata todo lo pequeño que invoque",
            "Pitch-Black Warwolf apaga sus trampas mientras atacas"],
  },
  {
    /* goatformat.com/chaos-turbo: flips y descarte para alimentar a
       Chaos Sorcerer y al Black Luster Soldier. Thunder Dragon es la
       carta más característica. */
    nombre: "Chaos",
    objetivo: "beatdown",
    condicion: "llenar el cementerio de LUZ y OSCURIDAD y poner el Black Luster Soldier",
    senal: ["Black Luster Soldier - Envoy of the Beginning","Chaos Sorcerer",
            "Dark Magician of Chaos","Thunder Dragon"],
    minimo: 4,
    agresivo: 0.8, aguanta: false,
    claves: { "Black Luster Soldier - Envoy of the Beginning":3, "Chaos Sorcerer":2 },
    motor: ["Thunder Dragon","Graceful Charity","Card Destruction","Sangan",
            "Mystic Tomato","Night Assailant","Magical Merchant",
            "Dekoichi the Battlechanted Locomotive","Gravekeeper's Spy"],
    sostener: [],
    pasos: ["flips y descartes para llenar el cementerio de LUZ y OSCURIDAD",
            "Gravekeeper's Spy y Dekoichi aguantan mientras tanto",
            "Chaos Sorcerer destierra lo que estorbe",
            "Black Luster Soldier: protegerlo, es la partida"],
  },
  {
    /* goatformat.com/goat-control + el artículo de Pojo "40 Common
       Mistakes". La baraja que da nombre al formato. */
    nombre: "Goat Control",
    objetivo: "control",
    condicion: "ganar cartas, cerrar el campo con Thousand-Eyes y picar",
    senal: ["Scapegoat","Metamorphosis","Tsukuyomi"],
    minimo: 4,
    agresivo: 0.45, aguanta: false,
    claves: { "Thousand-Eyes Restrict":3, "Metamorphosis":2, "Airknight Parshath":2,
              "Black Luster Soldier - Envoy of the Beginning":3 },
    motor: ["Scapegoat","Magician of Faith","Sinister Serpent","Sangan",
            "Graceful Charity","Pot of Greed","Delinquent Duo","Dekoichi the Battlechanted Locomotive"],
    sostener: ["Snatch Steal","Premature Burial","Call of the Haunted"],
    pasos: ["robar y quitarle cartas de la mano antes que nada",
            "Scapegoat colocada, encadenada en su End Phase",
            "ficha → Metamorphosis → Thousand-Eyes Restrict sobre su mejor monstruo",
            "picar con Airknight y guardar el Black Luster para cerrar"],
  },
  {
    /* goatformat.com/deck-guides/warrior (19-11): la lista de Sean Montague,
       4.º en Clash of Champions. Sin Scapegoat ni Metamorphosis: presión
       desde el turno uno con guerreros de 1600-1800, Reinforcement of the
       Army para encontrar la respuesta y trampas para su jugada. Va DESPUÉS
       de Goat Control para que el Warrior Goat Control siga siendo control. */
    nombre: "Warrior Aggro",
    objetivo: "beatdown",
    condicion: "presión desde el turno uno con guerreros y quitar lo que estorbe",
    senal: ["Blade Knight","D.D. Warrior Lady","Exiled Force","Kycoo the Ghost Destroyer",
            "Mystic Swordsman LV2","Don Zaloog","Ninja Grandmaster Sasuke","Zombyra the Dark",
            "Reinforcement of the Army"],
    minimo: 10,
    agresivo: 0.9, aguanta: false,
    claves: { "Black Luster Soldier - Envoy of the Beginning":3, "Blade Knight":1, "Zombyra the Dark":1 },
    motor: ["Reinforcement of the Army","Trap Dustshoot","Delinquent Duo"],
    sostener: [],
    pasos: ["un guerrero cada turno y a pegar",
            "Reinforcement of the Army: la respuesta que pida la mesa",
            "Nobleman, Kycoo y Sasuke contra lo colocado",
            "Solemn y Sakuretsu para su jugada fuerte"],
  },
];

/* Si no se reconoce nada, es un mazo de pegar: monstruos y remoción. */
const POR_DEFECTO = {
  nombre: "Beatdown", objetivo: "beatdown",
  condicion: "presión constante: monstruos grandes y quitar lo que estorbe",
  agresivo: 0.8, aguanta: false, claves: {}, motor: [], sostener: [],
  pasos: ["invocar el monstruo más grande que se pueda",
          "quitar de en medio lo que frene el ataque",
          "guardar las trampas para su jugada fuerte"],
};

/* `decklist` son passcodes; `names` traduce a nombre. */
export function planDe(decklist, names){
  const cuenta = new Map();
  for(const code of (decklist ?? [])){
    const n = canon(names?.[code]?.name ?? "");
    if(n) cuenta.set(n, (cuenta.get(n) ?? 0) + 1);
  }
  const p = PLANES.find(pl =>
    pl.senal.reduce((s,n)=> s + (cuenta.get(n) ?? 0), 0) >= pl.minimo &&
    /* `requiere` es la carta sin la cual el plan no existe. El recuento de
       señales solo no distingue mazos que comparten motor. */
    (!pl.requiere || pl.requiere.some(n => cuenta.has(n)))) ?? POR_DEFECTO;

  return materializarPlan(p);
}

/* Una fila de plan (como las de PLANES) → el objeto que usa el cerebro.
   Lo usa también el modo draft, que escribe el plan del mazo que ha
   construido (src/draft/mazo.js · planParaDuelo). */
export function materializarPlan(p){
  const claves = p.claves ?? {};
  const motor  = new Set(p.motor ?? []);
  const sost   = new Set(p.sostener ?? []);
  return {
    nombre: p.nombre, condicion: p.condicion, objetivo: p.objetivo ?? "beatdown",
    agresivo: p.agresivo, aguanta: !!p.aguanta, volteos: !!p.volteos,
    pasos: p.pasos ?? [],
    /* peso 0..3 de lo que aporta esta carta A GANAR LA PARTIDA. Es lo que
       permite decir "esta no se descarta" o "esta se busca primero" sin
       escribir un caso por carta en el cerebro. */
    peso:    n => claves[canon(n)] ?? 0,
    esClave: n => (claves[canon(n)] ?? 0) > 0,
    esMotor: n => motor.has(canon(n)),
    sostiene:n => sost.has(canon(n)),
  };
}
