/* ══════════════════════════════════════════════════════════════════
   AZAR DEL DRAFT — tres generadores separados

     producto   qué sale en cada sobre (un único flujo, en orden de asiento)
     decisión   el desempate de cada bot en cada pick: azarDe(semilla|asiento|ronda|paso)
     partida    las semillas de los duelos del evento

   Separarlos es lo que permite depurar: cambiar cómo decide un bot no
   cambia qué sale en los sobres, y la decisión de un pick no depende de
   cuántas veces se haya tirado el dado antes. mulberry32: el estado es un
   solo entero, cabe en el guardado.
   ══════════════════════════════════════════════════════════════════ */
export function hashTexto(t){
  let h = 2166136261 >>> 0;
  const s = String(t);
  for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  h ^= h >>> 15; h = Math.imul(h, 2246822507) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 3266489909) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}
export function crearAzar(estado){
  let a = estado >>> 0;
  const f = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.estado = () => a;
  return f;
}
export const azarDe = texto => crearAzar(hashTexto(texto));
