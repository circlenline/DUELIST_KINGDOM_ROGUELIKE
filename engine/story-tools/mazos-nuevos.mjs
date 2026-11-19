/* ════════════════════════════════════════════════════════════════
   CUATRO MAZOS META MÁS PARA EL TORNEO Y EL DUELO LIBRE (19-11)

   E, con el feedback de la comunidad: «el modo torneo Bo3 gusta, pero no
   la variedad de mazos: hay demasiadas variaciones de Chaos Control.
   Debería haber aggro, control, combo, midrange… Quiero incluir aggro
   warrior, mazo de Umi, earth aggro (gigantes, Goblin Attack Force) y
   Relinquished».

   Las listas son las de las guías de goatformat.com (beta.goatformat.com/
   deck-guides/…), copiadas carta a carta:
     · Warrior: la lista de Sean Montague, 4.º en Clash of Champions.
     · Earth Aggro: Giant Rat, Gigantes, The Rock Spirit, Goblin Attack Force.
     · Water Aggro: A Legendary Ocean (cuenta como «Umi»), Mermaid Knight,
       Abyss Soldier, Mother Grizzly → Levia-Dragon - Daedalus.
     · Relinquished Control: el armazón de Goat Control con Relinquished,
       Black Illusion Ritual, Manju y Senju.
   Ninguna página trae Extra Deck: se usa el de un mazo hermano del juego.
   El side lo pone después `sides-meta.mjs`, como a los otros veinte.

   Uso:  node story-tools/mazos-nuevos.mjs [--escribir]
         y después  node story-tools/sides-meta.mjs --escribir
   ════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync } from "node:fs";

const NAMES = JSON.parse(readFileSync(new URL("../browser/out/names.subset.json", import.meta.url)));
const POOL  = new Set(JSON.parse(readFileSync(new URL("../data/goat-pool.json", import.meta.url))).map(Number));
const LIM   = JSON.parse(readFileSync(new URL("../data/goat-limites.json", import.meta.url)));
const rutaMazos = new URL("../data/mazos.json", import.meta.url);
const MAZOS = JSON.parse(readFileSync(rutaMazos));

const base = n => String(n||"").replace(/\s*\((GOAT|Pre-Errata|Anime)\)\s*$/i,"").trim();
const codigo = nombre => {
  const cs = Object.keys(NAMES).filter(k => POOL.has(+k) && base(NAMES[k].name) === nombre).map(Number);
  if(!cs.length) throw new Error(`no está en el pool: ${nombre}`);
  return cs[0];
};
const limite = c => LIM[c] ?? LIM[String(c)] ?? 3;
const lista = txt => txt.trim().split("\n").flatMap(l => {
  const m = l.trim().match(/^(\d+)x?\s+(.+)$/); if(!m) throw new Error("línea rara: " + l);
  return Array(+m[1]).fill(codigo(m[2].trim()));
});
const extraDe = nombre => (MAZOS.find(m => m.nombre === nombre)?.extra ?? []).slice();

const NUEVOS = [
  { nombre:"Warrior Aggro", portada:"Blade Knight", extra: extraDe("Warrior Goat Control"),
    fuente:"goatformat.com/deck-guides/warrior (Sean Montague, 4.º Clash of Champions)", main:`
1 Black Luster Soldier - Envoy of the Beginning
3 Blade Knight
1 Breaker the Magical Warrior
1 D.D. Warrior Lady
1 Don Zaloog
1 Exiled Force
2 Kycoo the Ghost Destroyer
2 Mystic Swordsman LV2
1 Ninja Grandmaster Sasuke
1 Zombyra the Dark
2 Book of Moon
1 Delinquent Duo
1 Enemy Controller
1 Graceful Charity
1 Heavy Storm
1 Mystical Space Typhoon
2 Nobleman of Crossout
1 Pot of Greed
1 Premature Burial
2 Reinforcement of the Army
1 Snatch Steal
1 Call of the Haunted
1 Dust Tornado
1 Mirror Force
1 Ring of Destruction
2 Sakuretsu Armor
3 Solemn Judgment
3 Trap Dustshoot` },
  { nombre:"Earth Aggro", portada:"Goblin Attack Force", extra: extraDe("Warrior Goat Control"),
    fuente:"goatformat.com/deck-guides/earth-aggro", main:`
1 Breaker the Magical Warrior
3 D.D. Assailant
1 D.D. Warrior Lady
1 Exiled Force
3 Giant Rat
3 Gigantes
3 Goblin Attack Force
1 Injection Fairy Lily
1 Mystic Swordsman LV2
2 The Rock Spirit
1 Delinquent Duo
1 Graceful Charity
1 Heavy Storm
1 Mystical Space Typhoon
2 Nobleman of Crossout
1 Pot of Greed
1 Premature Burial
2 Reinforcement of the Army
2 Smashing Ground
1 Snatch Steal
1 Call of the Haunted
2 Dust Tornado
1 Mirror Force
1 Ring of Destruction
1 Torrential Tribute
2 Trap Dustshoot` },
  { nombre:"Umi · Water Aggro", portada:"Mermaid Knight", extra: extraDe("Warrior Goat Control"),
    fuente:"goatformat.com/deck-guides/water-aggro", main:`
2 Abyss Soldier
1 Breaker the Magical Warrior
3 Lekunga
1 Levia-Dragon - Daedalus
3 Mermaid Knight
3 Mother Grizzly
1 Revival Jam
1 Sangan
1 Sinister Serpent
1 Tribe-Infecting Virus
1 Yomi Ship
3 A Legendary Ocean
1 Delinquent Duo
1 Graceful Charity
1 Heavy Storm
1 Mystical Space Typhoon
2 Nobleman of Crossout
1 Pot of Greed
1 Premature Burial
1 Snatch Steal
1 Terraforming
1 Call of the Haunted
1 Mirror Force
1 Ring of Destruction
3 Sakuretsu Armor
3 Solemn Judgment` },
  { nombre:"Relinquished Control", portada:"Relinquished", extra: extraDe("Goat Control · Worlds 2020"),
    fuente:"goatformat.com/deck-guides/relinquished-control", main:`
1 Black Luster Soldier - Envoy of the Beginning
1 Breaker the Magical Warrior
2 Magician of Faith
3 Manju of the Ten Thousand Hands
1 Sangan
1 Senju of the Thousand Hands
1 Sinister Serpent
1 Sonic Bird
1 Tribe-Infecting Virus
3 Tsukuyomi
2 Relinquished
2 Black Illusion Ritual
1 Book of Moon
1 Delinquent Duo
1 Graceful Charity
1 Heavy Storm
3 Metamorphosis
2 Nobleman of Crossout
1 Pot of Greed
3 Scapegoat
1 Snatch Steal
1 Mirror Force
1 Ring of Destruction
2 Sakuretsu Armor
3 Solemn Judgment` },
];

let mal = 0;
for(const n of NUEVOS){
  const main = lista(n.main);
  const cuenta = new Map();
  for(const c of [...main, ...n.extra]) cuenta.set(c, (cuenta.get(c) ?? 0) + 1);
  const pasados = [...cuenta].filter(([c, k]) => k > limite(c)).map(([c, k]) => `${NAMES[c].name} ${k}/${limite(c)}`);
  console.log(`${n.nombre.padEnd(24)} main ${main.length} · extra ${n.extra.length}${pasados.length ? " · ⚠ límite: " + pasados.join(", ") : ""}`);
  if(main.length !== 40 || pasados.length) mal++;
  const i = MAZOS.findIndex(m => m.nombre === n.nombre);
  const fila = { nombre:n.nombre, main, extra:n.extra, side: MAZOS[i]?.side ?? [], portada: codigo(n.portada) };
  if(i >= 0) MAZOS[i] = fila; else MAZOS.push(fila);
}
if(mal){ console.log("\nhay mazos mal: no se escribe nada"); process.exit(1); }
if(process.argv.includes("--escribir")){
  writeFileSync(rutaMazos, JSON.stringify(MAZOS, null, 0));
  const ydk = (m) => ["#created by Goat simulator (mazos-nuevos.mjs)", "#main", ...m.main, "#extra", ...m.extra, "!side", ...(m.side ?? [])].join("\n") + "\n";
  NUEVOS.forEach((n, k) => {
    const m = MAZOS.find(x => x.nombre === n.nombre);
    writeFileSync(new URL(`../../mazos/${22 + k}_${n.nombre.replace(/[^A-Za-z0-9]+/g, "_").replace(/_+$/,"")}.ydk`, import.meta.url), ydk(m));
  });
  console.log(`\nescrito data/mazos.json (${MAZOS.length} mazos) y los .ydk en mazos/`);
}
