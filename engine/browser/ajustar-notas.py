"""Estima cuánto suma cada carta de RP02 a ganar un duelo (regresión logística
con L2 sobre la diferencia de copias A−B) a partir de calibracion.jsonl
(calibrar-draft.mjs) y lo compara con la nota `base` de src/draft/cartas.js.
Uso: python3 ajustar-notas.py > ../data/draft/calibracion.json"""
import json, sys, re
import numpy as np
rp = json.load(open('../data/draft/rp02.json'))
ids = [c['id'] for c in rp['cartas']]; idx = {c: i for i, c in enumerate(ids)}
nom = {c['id']: c['nombre'] for c in rp['cartas']}
X = []; y = []
for l in open('calibracion.jsonl'):
    r = json.loads(l)
    if r['gana'] is None: continue
    v = np.zeros(len(ids) + 1)
    for c in r['a']: v[idx[c]] += 1
    for c in r['b']: v[idx[c]] -= 1
    v[-1] = 1 if r['empieza'] == 0 else -1       # a empieza
    X.append(v); y.append(1 if r['gana'] == 'a' else 0)
X = np.array(X); y = np.array(y)
w = np.zeros(X.shape[1]); lam = 2.0
for it in range(400):                               # Newton con L2
    p = 1 / (1 + np.exp(-X @ w))
    g = X.T @ (p - y) + lam * np.r_[w[:-1], 0]
    H = (X * (p * (1 - p))[:, None]).T @ X + lam * np.diag(np.r_[np.ones(len(ids)), 0])
    paso = np.linalg.solve(H, g); w -= paso
    if np.abs(paso).max() < 1e-7: break
# la nota base actual, leída del fuente
src = open('src/draft/cartas.js', encoding='utf-8').read()
base = {}
for m in re.finditer(r'^\s*["\']([^"\']+)["\']:\s*\{\s*base:([\d.]+)', src, re.M): base[m.group(1)] = float(m.group(2))
filas = [(nom[c], w[idx[c]], base.get(nom[c])) for c in ids]
print(json.dumps({ 'partidas': int(len(y)), 'ventajaEmpezar': float(w[-1]),
  'cartas': { n: round(float(x), 4) for n, x, b in filas } }, ensure_ascii=False, indent=1))
v = [(x, b) for n, x, b in filas if b is not None and b > 0.5]
xs = np.array([a for a, b in v]); bs = np.array([b for a, b in v])
print(f"partidas {len(y)} · ventaja de empezar {w[-1]:+.3f} · correlación nota/medida {np.corrcoef(xs, bs)[0,1]:.2f}", file=sys.stderr)
for n, x, b in sorted(filas, key=lambda t: -t[1]): print(f"{x:+.3f}  base {b}  {n}", file=sys.stderr)
