// Empaqueta en un módulo JS las librerías Lua + los scripts de las cartas
// que necesite la lista de mazos. Sin esto habría que servir 53 MB de ficheros.
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// la raíz del proyecto es la carpeta que contiene engine/
const RAIZ = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
const S = path.join(RAIZ, "CardScripts-master", "CardScripts-master");
const DIRS=["","official","goat","pre-errata","pre-release"];
const find=b=>{ for(const d of DIRS){ const f=path.join(S,d,b); if(existsSync(f)) return f; } return null; };

const LIBS=["constant.lua","utility.lua","debug_utility.lua","chain.lua",
  "cards_specific_functions.lua","deprecated_functions.lua",
  "card_counter_constants.lua","archetype_setcode_constants.lua",
  ...readdirSync(S).filter(f=>f.startsWith("proc_"))];

const codes=JSON.parse(readFileSync(process.argv[2],"utf-8"));
/* El modo draft (Retro Pack 2) trae 7 cartas que no están en el pool de
   Goat (Gorz, Yata, Light and Darkness Dragon…). Sus scripts van también:
   sin ellos entrarían mudas al duelo. Ver engine/draft/importar-rp02.mjs. */
{ const f = path.join(RAIZ, "engine", "data", "draft", "rp02.json");
  if(existsSync(f)) for(const c of JSON.parse(readFileSync(f,"utf-8")).cartas) codes.push(c.id); }
const cardsRaw=JSON.parse(readFileSync(path.join(RAIZ,"engine","data","full_cards.json"),"utf-8"));
const bundle={}; let missing=[], viaAlias=0;
for(const name of LIBS){ const f=find(name); if(f) bundle[name]=parchear(name, readFileSync(f,"utf-8")); else missing.push(name); }

/* ══════════════════════════════════════════════════════════════════
   LOS SCRIPTS SON MÁS NUEVOS QUE EL CORE, Y ESO MATA EFECTOS ENTEROS

   E: «he descartado Kuriboh y aun así me he comido el daño y mi
   monstruo se ha destruido». Y era verdad. En el log, con la carta ya
   en el cementerio y la cadena montada:

     [string "chain.lua"]:85: Passed invalid CHAININFO flag.

   No es de Kuriboh. `chain.lua` envuelve `Duel.RegisterEffect` para
   apuntarse las propiedades de la carta que registra (línea 573), y para
   eso recorre TODAS las `CHAININFO_*` que conocen los CardScripts
   modernos —incluidas `..._SETCODES` (30) y `..._TRIGGERING_LINK` (31)—.
   El core que usamos es ocgcore 0.1.2, más antiguo, y no las reconoce:
   lanza un error de Lua que se lleva por delante la resolución ENTERA.
   O sea que Kuriboh se descarta, la cadena se resuelve… y el efecto
   nunca llega a registrarse.

   Y no es un problema de una carta: revienta CUALQUIER carta que
   registre un efecto al resolverse. Waboku, Threatening Roar, Gravity
   Bind, las que ponen un efecto de campo temporal… todas.

   Lo que se apunta ahí es información de conveniencia de Project Ignis,
   no una regla: si un dato no está disponible, `nil` es la respuesta
   correcta. Así que la consulta se hace con `pcall` y una bandera que el
   core no entienda pasa a valer `nil` en vez de tumbar la resolución.
   Mismo patrón que el parche del core en `bundle.mjs`: se toca el texto
   de un archivo de terceros y se avisa si algún día deja de encajar.
   ══════════════════════════════════════════════════════════════════ */
function parchear(nombre, texto){
  if(nombre !== "chain.lua") return texto;
  const viejo = `local function chaininfo_fn(info)
	return function(ch)
		return Duel.GetChainInfo(ch or 0,info)
	end
end`;
  if(!texto.includes(viejo))
    throw new Error(
      "\n\n  chain.lua ha cambiado: `chaininfo_fn` ya no es la que se parchea.\n" +
      "  Sin el parche, cualquier carta que registre un efecto al resolverse\n" +
      "  muere con «Passed invalid CHAININFO flag» y su efecto no ocurre.\n" +
      "  Revisa si el core nuevo ya soporta todas las CHAININFO_*.\n");
  const nuevo = `local function chaininfo_fn(info)
	return function(ch)
		-- PARCHE (engine/browser/build-scripts.mjs): el core compilado es
		-- más antiguo que estos scripts y no conoce todas las CHAININFO_*.
		-- Una bandera que no entienda vale nil; sin esto, el error de Lua
		-- se lleva por delante la resolución entera de la carta.
		local r={pcall(Duel.GetChainInfo,ch or 0,info)}
		if not r[1] then return nil end
		return table.unpack(r,2)
	end
end`;
  return texto.replace(viejo, nuevo);
}
for(const code of new Set(codes)){
  const b=`c${code}.lua`;
  let f=find(b);
  if(!f){
    // Las variantes (arte alternativo, pre-errata) no llevan script propio:
    // heredan el de la carta a la que apuntan con "alias". Igual que hace EDOPro.
    const alias=cardsRaw[code]?.alias;
    if(alias){ f=find(`c${alias}.lua`); if(f) viaAlias++; }
  }
  if(f) bundle[b]=readFileSync(f,"utf-8"); else missing.push(b);
}
const js=`// Scripts Lua empaquetados (ProjectIgnis CardScripts, AGPL-3.0)
export const SCRIPTS = ${JSON.stringify(bundle)};
export function scriptReader(name){
  const b = name.split(/[\\\\/]/).pop();
  return SCRIPTS[b] ?? null;
}
`;
writeFileSync("./out/scripts.bundle.js", js);
console.log(`scripts.bundle.js: ${(js.length/1024).toFixed(0)} KB · ${Object.keys(bundle).length} archivos`);
console.log("  resueltos por alias:", viaAlias);
if(missing.length) console.log("  sin script (cartas normales sin efecto):", missing.length, missing.slice(0,6).join(" "));
