/* ══════════════════════════════════════════════════════════════════
   RETRO PACK 2 → datos del modo draft

   Uso (desde engine/draft/):   node importar-rp02.mjs

   La lista sale de la base oficial de Konami (producto pid=51107002 /
   11108002, «RETRO PACK 2», 101 cartas: 48 C · 24 R · 10 SR · 8 UR ·
   11 SE, comprobado el 02-11-2026). Konami no da IDs de carta en esa
   página, así que cada nombre inglés se ha casado A MANO con su passcode
   de BabelCDB y aquí se comprueba que el passcode existe y que su nombre
   coincide. Nada de coincidencias parciales.

   ── EL PASSCODE DEL MOTOR ──
   El perfil de reglas del draft es el del simulador (Goat, abril de
   2005, `MODE_GOAT`). Para las cartas que Project Ignis tiene en versión
   «(GOAT)» o «(Pre-Errata)» se usa ESA (la misma que traduce `alPool` en
   el juego): Nobleman destierra todas las copias, Ring of Destruction
   sin restricción, Necrovalley antiguo, Spy con su texto de 2005…
   Las 6 cartas de RP02 que no existían en Goat (Gorz, Light and Darkness
   Dragon, Dragon Master Knight, Victory Dragon, Green Baboon y
   Dreadscythe Harvester) más Yata-Garasu (prohibida en Goat) usan el
   texto y el script actuales: no hay otra versión. Queda documentado en
   el JSON (`perfil`) y en CLAUDE.md.

   Escribe:
     ../data/draft/rp02.json            la lista con todo lo que el modo necesita
     ../browser/out/cards.subset.json   + las cartas que faltaban (idempotente)
     ../browser/out/names.subset.json   + sus textos
   y `build-scripts.mjs` lee rp02.json para empaquetar sus scripts.
   ══════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(AQUI, "..", "data");
const OUT  = path.join(AQUI, "..", "browser", "out");
const J = f => JSON.parse(readFileSync(f, "utf-8"));

/* [nombre inglés, nombre en la base española, rareza, passcode oficial]
   En el orden de la página de Konami. */
const LISTA = [
 ["Gorz the Emissary of Darkness","Gorz el Emisario de la Oscuridad","SE",44330098],
 ["Jinzo","Jinzo","UR",77585513],
 ["Parasite Paracide","Parásito Paracida","C",27911549],
 ["Swords of Revealing Light","Espada de la Fuerza de Luz","C",72302403],
 ["Chain Destruction","Destrucción en Cadena","R",1248895],
 ["Dust Tornado","Tornado de Polvo","C",60082869],
 ["Call of the Haunted","Llamada de los Condenados","C",97077563],
 ["Mirror Wall","Muro de Espejo","UR",22359980],
 ["Appropriate","Apropiación","C",48539234],
 ["Ceasefire","Tregua","R",36468556],
 ["Magical Hats","Sombreros Mágicos","R",81210420],
 ["Nobleman of Crossout","Noble de Crossout","C",71044499],
 ["Premature Burial","Entierro Prematuro","C",70828912],
 ["Buster Blader","Buster Blader","SR",78193831],
 ["Skull Invitation","Invitación del Cráneo","C",98139712],
 ["Limiter Removal","Quitar el Limitador","SR",23171610],
 ["Insect Imitation","Imitación de Insecto","C",96965364],
 ["Magic Drain","Drenaje Mágico","C",59344077],
 ["Gravity Bind","Atar a la Gravedad","C",85742772],
 ["The Legendary Fisherman","El Pescador Legendario","R",3643300],
 ["Thousand-Eyes Idol","Ídolo de los Mil Ojos","C",27125110],
 ["Thousand-Eyes Restrict","Límite de los Mil Ojos","UR",63519819],
 ["4-Starred Ladybug of Doom","Ladybug de 4 Estrellas de la Perdición","C",83994646],
 ["Mad Sword Beast","Bestia Loca de la Espada","C",79870141],
 ["Goblin Attack Force","Fuerza de Ataque Goblin","C",78658564],
 ["Gearfried the Iron Knight","Gearfried el Caballero de Hierro","R",423705],
 ["Gemini Elf","Elfo Géminis","C",69140098],
 ["The Masked Beast","La Bestia Enmascarada","SR",49064413],
 ["Revival Jam","Gelatina Reanimada","R",31709826],
 ["Melchid the Four-Face Beast","Melchid la Bestia de las Cuatro Caras","C",86569121],
 ["Curse of the Masked Beast","Maldición de la Bestia Enmascarada","C",94377247],
 ["Mask of Restrict","Máscara de Restricción","C",29549364],
 ["Lightning Blade","Hoja de Rayos","C",55226821],
 ["Tornado Wall","Muro de Tornado","C",18605135],
 ["Torrential Tribute","Tributo Torrencial","C",53582587],
 ["Infinite Cards","Cartas Infinitas","R",94163677],
 ["Jam Defender","Defensor de Gelatina","SR",21558682],
 ["Card of Safe Return","Carta de Retorno Seguro","C",57953380],
 ["United We Stand","Estamos Juntos","UR",56747793],
 ["Mage Power","Poder del Mago","R",83746708],
 ["Kycoo the Ghost Destroyer","Kycoo el Destructor de Fantasmas","C",88240808],
 ["Bazoo the Soul-Eater","Bazoo el Come Almas","C",40133511],
 ["Dark Necrofear","Necrofear Oscuro","SR",31829185],
 ["Gilasaurus","Gilasaurus","C",45894482],
 ["Dark Spirit of the Silent","Espíritu Oscuro de los Silenciosos","C",93599951],
 ["Destiny Board","Tablero del Destino","SR",94212438],
 ["Spirit Message \"I\"","Mensaje Espiritual \"I\"","C",31893528],
 ["Spirit Message \"N\"","Mensaje Espiritual \"N\"","C",67287533],
 ["Spirit Message \"A\"","Mensaje Espiritual \"A\"","C",94772232],
 ["Spirit Message \"L\"","Mensaje Espiritual \"L\"","C",30170981],
 ["Magic Cylinder","Cilindro Mágico","R",62279055],
 ["Yata-Garasu","Yata-Garasu","C",3078576],
 ["Dark Ruler Ha Des","Gobernante Oscuro Ha Des","UR",53982768],
 ["Opticlops","Opticíclope","C",14531242],
 ["Freed the Matchless General","Freed el General Sin Igual","R",49681811],
 ["Emergency Provisions","Provisiones de Emergencia","C",53046408],
 ["Tyrant Dragon","Dragón Tirano","SR",94568601],
 ["Spear Dragon","Dragón Lanza","C",31553716],
 ["Airknight Parshath","Caballero del Aire Parsath","R",18036057],
 ["Yamata Dragon","Dragón Yamata","R",76862289],
 ["Hino-Kagu-Tsuchi","Hino-Kagu-Tsuchi","SR",75745607],
 ["Asura Priest","Sacerdote de Asura","C",2134346],
 ["A Legendary Ocean","Un Océano Legendario","C",295517],
 ["Creature Swap","Intercambio de Criatura","C",31036355],
 ["Bottomless Trap Hole","Agujero Trampa Sin Fondo","C",29401950],
 ["Injection Fairy Lily","Hada de la Inyección Lily","UR",79575620],
 ["Ring of Destruction","Anillo Destructor","SE",83555666],
 ["Guardian Sphinx","Esfinge Guardiana","C",40659562],
 ["Don Zaloog","Don Zaloog","R",76922029],
 ["Book of Taiyou","Libro de Taiyou","C",38699854],
 ["Book of Moon","Libro de la Luna","C",14087893],
 ["Reckless Greed","Codicia Imprudente","C",37576645],
 ["Dark Jeroid","Jeroid Oscuro","R",90980792],
 ["Newdoria","Newdoria","R",4335645],
 ["Helpoemer","Helpoemer","UR",76052811],
 ["Gravekeeper's Spy","Espía del Cuidador de Tumbas","C",24317029],
 ["Gravekeeper's Chief","Jefe del Cuidador de Tumbas","C",62473983],
 ["Gravekeeper's Assailant","Asaltante del Cuidador de Tumbas","C",25262697],
 ["Dark Room of Nightmare","Habitación Oscura de Pesadilla","C",85562745],
 ["Necrovalley","Necrovalle","R",47355498],
 ["Barrel Behind the Door","Cañón Tras la Puerta","C",78783370],
 ["Nightmare Wheel","Rueda de la Pesadilla","R",54704216],
 ["Lava Golem","Golem de Lava","SR",102380],
 ["Morphing Jar","Jarra de la Metamorfosis","R",33508719],
 ["Royal Decree","Decreto Real","R",51452091],
 ["Swift Gaia the Fierce Knight","Gaia el Caballero Feroz Rápido","UR",16589042],
 ["Obnoxious Celtic Guard","Guardia Celta Convertido","R",52077741],
 ["Kaiser Sea Horse","Caballo de Mar Kaiser","R",17444133],
 ["Insect Queen","Reina Insecto","SR",91512835],
 ["Alpha The Magnet Warrior","Alfa el Guerrero Magnético","R",99785935],
 ["Beta The Magnet Warrior","Beta el Guerrero Magnético","R",39256679],
 ["Gamma The Magnet Warrior","Gamma el Guerrero Magnético","R",11549357],
 ["Valkyrion the Magna Warrior","Valkyrion el Guerrero Magno","SE",75347539],
 ["Harpie's Pet Dragon","Dragón Mascota de Arpía","SE",52040216],
 ["Archfiend of Gilfer","Archidemonio de Gilfer","SE",50287060],
 ["Light and Darkness Dragon","Dragón de la Luz y la Oscuridad","SE",47297616],
 ["Blue-Eyes Shining Dragon","Dragón Brillante de Ojos Azules","SE",53347303],
 ["Dragon Master Knight","Caballero Amo del Dragón","SE",62873545],
 ["Victory Dragon","Dragón de la Victoria","SE",44910027],
 ["Green Baboon, Defender of the Forest","Babuino Verde Defensor de la Selva","SE",46668237],
 ["Dreadscythe Harvester","Cosechador de la Guadaña del Terror","SE",66973070],
];

const full  = J(path.join(DATA, "full_cards.json"));
const names = J(path.join(DATA, "names.json"));
const pool  = new Set(J(path.join(DATA, "goat-pool.json")));
const sub   = J(path.join(OUT, "cards.subset.json"));
const subN  = J(path.join(OUT, "names.subset.json"));

const errores = [];
if(LISTA.length !== 101) errores.push(`la lista tiene ${LISTA.length} cartas, no 101`);
const cuenta = {};
for(const [, , r] of LISTA) cuenta[r] = (cuenta[r] ?? 0) + 1;
const ESPERADO = { C:48, R:24, SR:10, UR:8, SE:11 };
for(const r in ESPERADO) if(cuenta[r] !== ESPERADO[r]) errores.push(`${r}: ${cuenta[r]} (Konami dice ${ESPERADO[r]})`);

const salida = [];
let añadidas = 0;
for(const [en, es, rareza, oficial] of LISTA){
  const n = names[String(oficial)];
  if(!n) { errores.push(`${en}: el passcode ${oficial} no está en BabelCDB`); continue; }
  if(n.name !== en) { errores.push(`${en}: el passcode ${oficial} es «${n.name}»`); continue; }
  /* La versión del motor: la del pool si existe; si no, la variante (GOAT)
     del pool cuyo alias es la oficial (la de número más bajo, que es la
     que elige `alPool` al cargar el pool en orden); si no, la oficial. */
  let motor = oficial, perfil = "goat";
  if(!pool.has(oficial)){
    const variantes = [...pool].filter(x => full[String(x)]?.alias === oficial).sort((a,b) => a-b);
    if(variantes.length){ motor = variantes[0]; perfil = "goat-variante"; }
    else perfil = "actual";
  }
  const d = full[String(motor)];
  const t = names[String(motor)] ?? n;
  if(!d) { errores.push(`${en}: sin datos para ${motor}`); continue; }
  if(!sub[String(motor)]) { sub[String(motor)] = d; añadidas++; }
  if(!subN[String(motor)]) subN[String(motor)] = { name: t.name, desc: t.desc };
  salida.push({ id: motor, oficial, nombre: en, es, rareza, perfil,
                tipo: d.type, nivel: d.level, atk: d.attack, def: d.defense,
                raza: Number(d.race), atributo: d.attribute, texto: t.desc });
}
/* Las fichas que invocan estas cartas también necesitan datos en el
   motor: sin ellos el script pide una carta que no existe y el efecto
   no hace nada. Gorz → Emissary of Darkness Token; Insect Queen → Insect
   Monster Token (este faltaba también en el modo Goat). */
for(const token of [44330099, 91512836]){
  const d = full[String(token)], t = names[String(token)];
  if(!d) { errores.push(`ficha ${token}: sin datos`); continue; }
  if(!sub[String(token)]) { sub[String(token)] = d; añadidas++; }
  if(!subN[String(token)] && t) subN[String(token)] = { name: t.name, desc: t.desc };
}
if(errores.length){ console.error("✗ " + errores.join("\n✗ ")); process.exit(1); }

mkdirSync(path.join(DATA, "draft"), { recursive: true });
/* La calibración con partidas (browser/calibrar-draft.mjs → ajustar-notas.py),
   si existe, viaja dentro: la IA corrige sus notas con ella (cartas.js). */
let calibracion = null;
try{ calibracion = J(path.join(DATA, "draft", "calibracion.json")); }catch(e){}
writeFileSync(path.join(DATA, "draft", "rp02.json"), JSON.stringify({
  producto: "Retro Pack 2", fuente: "https://www.db.yugioh-card.com/yugiohdb/card_search.action?ope=1&pid=11108002&rp=99999",
  comprobado: "2026-11-02",
  rarezas: cuenta,
  perfil: "Reglas Goat (MODE_GOAT, abril de 2005). Versión (GOAT)/(Pre-Errata) de Project Ignis cuando existe; texto actual para las cartas sin versión antigua.",
  calibracion,
  cartas: salida }, null, 1));
writeFileSync(path.join(OUT, "cards.subset.json"), JSON.stringify(sub));
writeFileSync(path.join(OUT, "names.subset.json"), JSON.stringify(subN));
const porPerfil = salida.reduce((m,c) => (m[c.perfil] = (m[c.perfil] ?? 0) + 1, m), {});
console.log(`rp02.json: ${salida.length} cartas`, JSON.stringify(cuenta), "· perfiles", JSON.stringify(porPerfil),
            `· ${añadidas} añadidas al subset`);
console.log("  sin versión Goat:", salida.filter(c => c.perfil === "actual").map(c => c.nombre).join(", "));
