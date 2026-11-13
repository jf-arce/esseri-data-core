#!/usr/bin/env python3
"""Genera los dos documentos de diagramas (DER y modelo de clases) a partir de
una única fuente de verdad: model.json.

Ambos documentos comparten el mismo conjunto de 73 entidades, la misma
nomenclatura y la misma red de relaciones, de modo que son equivalentes y
trazables uno a uno.

Salida: HTML por documento, listo para convertir a PDF con Chrome headless.
"""
import heapq
import json
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
M = json.loads((HERE / 'model.json').read_text())
ENT = {e['table']: e for e in M['entities']}
REL = M['relations']

PAGE_W, PAGE_H = 1587, 1123          # A3 horizontal @96dpi
MARGIN = {'l': 68, 'r': 68, 't': 92, 'b': 58}
AVAIL_W = PAGE_W - MARGIN['l'] - MARGIN['r']
AVAIL_H = PAGE_H - MARGIN['t'] - MARGIN['b']

CH = 5.95          # ancho de carácter Menlo a 10px
LH = 14.5
HEAD_H = 19
PAD_X = 12
COL_GAP = 34
ROW_GAP = 9
WRAP_H = 880
REF_GAP = 58
REF_H = 34
REF_GAP_Y = 8

MODULE_ORDER = [
    'Autenticación y Roles', 'Familias y Alumnos', 'Académico', 'Inscripciones',
    'Facturación y Cobranza', 'Proveedores y Compras',
    'Motor de Workflows y Notificaciones', 'Comunicaciones', 'Núcleo compartido e IA',
]

MARK_COLOR = {'PK': '#B85350', 'FK': '#D69B00', 'UK': '#5D7E99'}


# ---------------------------------------------------------------- métricas
def der_card_size(e):
    name_w = max(len(c['name']) for c in e['columns'])
    type_w = max(len(c['type']) for c in e['columns'])
    w = max(name_w + type_w, len(e['table'])) * CH + 34 + PAD_X * 2
    h = HEAD_H + len(e['columns']) * LH + 8
    return max(148, round(w)), round(h)


def class_card_size(e):
    body = class_attrs(e) + class_ops(e)
    w = max([len(class_name(e))] + [len(t) for t, _ in body]) * CH + 26 + PAD_X * 2
    h = HEAD_H + len(class_attrs(e)) * LH + (len(class_ops(e)) * LH + 8 if class_ops(e) else 0) + 10
    if is_bridge(e):
        h += 13
    return max(150, round(w)), round(h)


def class_name(e):
    return e['class']


def is_bridge(e):
    fks = [c for c in e['columns'] if c['fk']]
    rest = [c for c in e['columns'] if not c['fk'] and not c['pk']]
    return len(fks) == 2 and not rest


def show_fks(e):
    """Si la clase no tiene atributos propios, sus FK se muestran para no dejarla vacía."""
    return not any(not c['fk'] and not c['pk'] for c in e['columns'])


def class_attrs(e):
    out = []
    bridge = show_fks(e)
    for c in e['columns']:
        if c['fk'] and not bridge:
            continue                                  # en UML es asociación, no atributo
        mark = '{id}' if c['pk'] else ('{unique}' if c['unique'] else '')
        t = c['type']
        if c['null'] and not c['pk']:
            t += ' [0..1]'
        out.append((f"+ {c['name']}: {t}", mark))
    return out


def class_ops(e):
    return [(f"+ {op}()", '') for op in e['operations']]


SIZE = {'der': der_card_size, 'class': class_card_size}


# ---------------------------------------------------------------- layout
def break_cycles(tables, inner):
    adj = defaultdict(list)
    for r in inner:
        adj[r['parent']].append(r)
    state = {t: 0 for t in tables}
    back = set()

    def dfs(u):
        state[u] = 1
        for r in adj[u]:
            v = r['child']
            if state[v] == 1:
                back.add((r['parent'], v, r['column']))
            elif state[v] == 0:
                dfs(v)
        state[u] = 2

    for t in tables:
        if state[t] == 0:
            dfs(t)
    return back


def assign_layers(tables, inner):
    back = break_cycles(tables, inner)
    fwd = [r for r in inner if (r['parent'], r['child'], r['column']) not in back]
    lay = {t: 0 for t in tables}
    for _ in range(len(tables)):
        changed = False
        for r in fwd:
            if lay[r['child']] < lay[r['parent']] + 1:
                lay[r['child']] = lay[r['parent']] + 1
                changed = True
        if not changed:
            break
    return lay


def pack_column(nodes, sizes, limit):
    cols, cur, h = [], [], 0
    for t in nodes:
        th = sizes[t][1]
        if cur and h + th + ROW_GAP > limit:
            cols.append(cur)
            cur, h = [], 0
        cur.append(t)
        h += th + ROW_GAP
    if cur:
        cols.append(cur)
    return cols


def layout_page(own_tables, kind, page_h=AVAIL_H):
    """Devuelve posiciones relativas (x=0,y=0) y el tamaño total del contenido."""
    size = SIZE[kind]
    sizes = {t: size(ENT[t]) for t in own_tables}
    ts = set(own_tables)
    inner = [r for r in REL if r['child'] in ts and r['parent'] in ts]
    lay = assign_layers(ts, inner)

    by_layer = defaultdict(list)
    for t in ts:
        by_layer[lay[t]].append(t)
    for k in by_layer:
        by_layer[k].sort(key=lambda t: (-sizes[t][1], t))

    columns = []
    for k in sorted(by_layer):
        for group in pack_column(by_layer[k], sizes, page_h):
            columns.append((group, max(sizes[t][0] for t in group)))

    rel = {}
    x = 0
    max_h = 0
    for group, w in columns:
        col_h = sum(sizes[t][1] for t in group) + ROW_GAP * (len(group) - 1)
        max_h = max(max_h, col_h)
        y = 0
        for t in group:
            cw, ch = sizes[t]
            rel[t] = (x + (w - cw) // 2, y, cw, ch)
            y += ch + ROW_GAP
        x += w + COL_GAP
    total_w = x - COL_GAP if columns else 0
    return rel, total_w, max_h


def estimate(own_tables, kind):
    size = SIZE[kind]
    sizes = {t: size(ENT[t]) for t in own_tables}
    ts = set(own_tables)
    inner = [r for r in REL if r['child'] in ts and r['parent'] in ts]
    lay = assign_layers(ts, inner)
    by = defaultdict(list)
    for t in ts:
        by[lay[t]].append(t)
    cols = []
    for k in sorted(by):
        for g in pack_column(sorted(by[k], key=lambda t: (-sizes[t][1], t)), sizes, AVAIL_H):
            cols.append((g, max(sizes[t][0] for t in g)))
    w = sum(c[1] for c in cols) + COL_GAP * (len(cols) - 1)
    h = max(sum(sizes[t][1] for t in g) + ROW_GAP * (len(g) - 1) for g, _ in cols)
    return lay, w, h


def plan_pages(tables, kind):
    """Parte un módulo en varias páginas cuando no entra en una sola."""
    ts = set(tables)
    inner = [r for r in REL if r['child'] in ts and r['parent'] in ts]
    lay = assign_layers(ts, inner)
    groups = sorted({lay[t] for t in tables})
    approx_area = AVAIL_W - 300          # deja lugar para la columna de referencias
    chunks, cur = [], []
    for g in groups:
        layer_nodes = [t for t in tables if lay[t] == g]
        trial = cur + layer_nodes
        _, w, h = estimate(trial, kind)
        if cur and (w > approx_area or h > AVAIL_H):
            chunks.append(cur)
            cur = layer_nodes
        else:
            cur = trial
    if cur:
        chunks.append(cur)
    return chunks


def page_fits(tables, kind):
    ts = set(tables)
    ext_set = {r['parent'] if r['child'] in ts else r['child']
               for r in REL if (r['child'] in ts) != (r['parent'] in ts)}
    ext_set = {t for t in ext_set if t not in ts}
    rel, content_w, content_h = layout_page(tables, kind)
    ref_w = max((ref_size(t, kind)[0] for t in ext_set), default=0)
    sources = set()
    for r in REL:
        a_own, b_own = r['parent'] in ts, r['child'] in ts
        if a_own != b_own:
            sources.add(r['parent'] if a_own else r['child'])
    span = 16 + len(sources) * 15 if sources else 0
    comp = content_w + (span + 16 + ref_w if ext_set else 0)
    return comp <= AVAIL_W and content_h <= AVAIL_H


def fits_both(tables):
    return page_fits(tables, 'der') and page_fits(tables, 'class')


def split_until_fits(tables):
    """Parte hasta que la página entre en los dos documentos, para que compartan paginación."""
    if len(tables) <= 1 or fits_both(tables):
        return [tables]
    ts = set(tables)
    inner = [r for r in REL if r['child'] in ts and r['parent'] in ts]
    lay = assign_layers(ts, inner)
    groups = sorted({lay[t] for t in tables})
    if len(groups) < 2:
        mid = len(tables) // 2
        return split_until_fits(tables[:mid]) + split_until_fits(tables[mid:])
    mid = len(groups) // 2
    a = [t for t in tables if lay[t] in groups[:mid]]
    b = [t for t in tables if lay[t] in groups[mid:]]
    return split_until_fits(a) + split_until_fits(b)


DOC_PAGES = None


def plan_doc_pages():
    """Plan de páginas único, compartido por ambos documentos."""
    global DOC_PAGES
    if DOC_PAGES is not None:
        return DOC_PAGES
    groups = defaultdict(list)
    for e in M['entities']:
        groups[e['module_name']].append(e)
    pages = []
    for mod in MODULE_ORDER:
        tables = [e['table'] for e in sorted(groups[mod], key=lambda x: x['table'])]
        for chunk in plan_pages(tables, 'class'):
            for sub in split_until_fits(chunk):
                pages.append((mod, sub))
    DOC_PAGES = pages
    return pages


def ref_size(t, kind):
    name = ENT[t]['class'] if kind == 'class' else ENT[t]['table']
    mod = ENT[t]['module_name']
    w = max(len(name) * 6.6, len(mod) * 4.9) + 24
    return max(120, min(230, round(w))), REF_H


# ---------------------------------------------------------------- routing
def _hits(p, q, rect, margin=0.0):
    """True si el segmento toca el rectángulo, agrandado por `margin`."""
    (x1, y1), (x2, y2) = p, q
    rx0, ry0, rw, rh = rect
    rx1, ry1 = rx0 + rw, ry0 + rh
    rx0 -= margin; ry0 -= margin; rx1 += margin; ry1 += margin
    if rx0 >= rx1 or ry0 >= ry1:
        return False
    if abs(y1 - y2) < 0.01:
        if not (ry0 < y1 < ry1):
            return False
        lo, hi = sorted((x1, x2))
        return hi > rx0 and lo < rx1
    if abs(x1 - x2) < 0.01:
        if not (rx0 < x1 < rx1):
            return False
        lo, hi = sorted((y1, y2))
        return hi > ry0 and lo < ry1
    return False


def _free(p, q, obstacles, margin=4.0):
    return not any(_hits(p, q, o, margin) for o in obstacles)


ROUTE_STATS = {'fallback': 0, 'routed': 0}


def route_ortho(src, dst, obstacles):
    """Camino ortogonal de src a dst esquivando los rectángulos de obstacles."""
    sx, sy, sw, sh = src
    dx, dy, dw, dh = dst
    if dx >= sx + sw:
        s, t = (sx + sw, sy + sh * 0.45), (dx, dy + dh * 0.45)
    elif dx + dw <= sx:
        s, t = (sx, sy + sh * 0.45), (dx + dw, dy + dh * 0.45)
    else:
        s = (sx + sw, sy + sh * 0.45)
        t = (dx + dw, dy + dh * 0.45)

    xs = {s[0], t[0]}
    ys = {s[1], t[1]}
    for x, y, w, h in obstacles:
        xs.update((x - 8, x + w + 8))
        ys.update((y - 6, y + h + 6))
    xs = sorted(xs)
    ys = sorted(ys)
    xs = sorted(xs + [(a + b) / 2 for a, b in zip(xs, xs[1:])])
    ys = sorted(ys + [(a + b) / 2 for a, b in zip(ys, ys[1:])])
    xi = {v: i for i, v in enumerate(xs)}
    yi = {v: i for i, v in enumerate(ys)}

    start = (xi[s[0]], yi[s[1]], -1)
    goal = (xi[t[0]], yi[t[1]])
    dist = {start: 0.0}
    prev = {}
    pq = [(0.0, start)]
    best = None
    while pq:
        d, st = heapq.heappop(pq)
        if d > dist.get(st, 1e18):
            continue
        i, j, direction = st
        if (i, j) == goal:
            best = st
            break
        for ni, nj, nd in ((i + 1, j, 0), (i - 1, j, 0), (i, j + 1, 1), (i, j - 1, 1)):
            if not (0 <= ni < len(xs) and 0 <= nj < len(ys)):
                continue
            a = (xs[i], ys[j])
            b = (xs[ni], ys[nj])
            if not _free(a, b, obstacles):
                continue
            cost = abs(xs[ni] - xs[i]) + abs(ys[nj] - ys[j])
            if direction not in (-1, nd):
                cost += 14
            ns = (ni, nj, nd)
            if d + cost < dist.get(ns, 1e18):
                dist[ns] = d + cost
                prev[ns] = st
                heapq.heappush(pq, (d + cost, ns))
    if best is None:
        ROUTE_STATS['fallback'] += 1
        return [s, (s[0], t[1]), t]
    ROUTE_STATS['routed'] += 1
    pts = []
    st = best
    while st is not None:
        pts.append((xs[st[0]], ys[st[1]]))
        st = prev.get(st)
    pts.reverse()
    out = [pts[0]]
    for p in pts[1:]:
        if len(out) >= 2:
            a, b = out[-2], out[-1]
            if (abs(a[0] - b[0]) < 0.01 and abs(b[0] - p[0]) < 0.01) or \
               (abs(a[1] - b[1]) < 0.01 and abs(b[1] - p[1]) < 0.01):
                out[-1] = p
                continue
        out.append(p)
    return out


def svg_path(pts, color):
    d = f'M {pts[0][0]:.1f} {pts[0][1]:.1f} ' + ' '.join(f'L {x:.1f} {y:.1f}' for x, y in pts[1:])
    return f'<path d="{d}" fill="none" stroke="{color}" stroke-width="1.1" stroke-linejoin="round"/>'


def crow(x, y, direction, mult, color):
    s = 5 if direction == 'right' else -5
    p = []
    if mult == '0..*':
        for dy in (-4, 0, 4):
            p.append(f'<path d="M {x:.1f} {y:.1f} L {x + s:.1f} {y + dy:.1f}" stroke="{color}" stroke-width="1.1" fill="none"/>')
    elif mult == '0..1':
        p.append(f'<circle cx="{x + s * 0.55:.1f}" cy="{y:.1f}" r="2.6" fill="#fff" stroke="{color}" stroke-width="1.1"/>')
        p.append(f'<path d="M {x:.1f} {y - 4:.1f} L {x:.1f} {y + 4:.1f}" stroke="{color}" stroke-width="1.1"/>')
    else:
        p.append(f'<path d="M {x:.1f} {y - 4.5:.1f} L {x:.1f} {y + 4.5:.1f}" stroke="{color}" stroke-width="1.1"/>')
        p.append(f'<path d="M {x + s * 0.5:.1f} {y - 4.5:.1f} L {x + s * 0.5:.1f} {y + 4.5:.1f}" stroke="{color}" stroke-width="1.1"/>')
    return ''.join(p)


# ---------------------------------------------------------------- html
def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def der_card(e):
    x, y, w, _ = e['_pos']
    rows = []
    for c in e['columns']:
        mark = 'FK' if c['fk'] else ('PK' if c['pk'] else ('UK' if c['unique'] else ''))
        cls = ' fk' if c['fk'] else (' pk' if c['pk'] else '')
        rows.append(f'<div class="row{cls}"><span class="nm">{esc(c["name"])}</span>'
                    f'<span class="ty">{esc(c["type"])}</span>'
                    f'<span class="mk" style="color:{MARK_COLOR.get(mark, "#aaa")}">{mark}</span></div>')
    return (f'<div class="card" style="left:{x}px;top:{y}px;width:{w}px;border-color:{e["color"]}">'
            f'<div class="hd" style="background:{e["color"]}">{esc(e["table"])}</div>'
            f'{"".join(rows)}</div>')


def class_card(e):
    x, y, w, _ = e['_pos']
    rows = ''.join(f'<div class="row"><span class="nm">{esc(t)}</span>'
                   f'<span class="mk">{esc(m)}</span></div>' for t, m in class_attrs(e))
    ops = class_ops(e)
    opblock = ''
    if ops:
        opblock = '<div class="ops">' + ''.join(
            f'<div class="row"><span class="nm">{esc(t)}</span><span class="mk"></span></div>'
            for t, _ in ops) + '</div>'
    st = '<div class="st">«tabla puente»</div>' if is_bridge(e) else ''
    return (f'<div class="card" style="left:{x}px;top:{y}px;width:{w}px;border-color:{e["color"]}">'
            f'<div class="hd" style="background:{e["color"]}">{esc(class_name(e))}</div>'
            f'{st}{rows}{opblock}</div>')


def ref_card(t, box, kind):
    x, y, w, h = box
    e = ENT[t]
    name = e['class'] if kind == 'class' else e['table']
    return (f'<div class="ref" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;border-color:{e["color"]}">'
            f'<div class="rn" style="color:{e["color"]}">{esc(name)}</div>'
            f'<div class="rm">{esc(e["module_name"])}</div></div>')


def build_page(own_tables, kind):
    """Geometría de una página: posiciones, referencias y aristas trazadas."""
    ts = set(own_tables)
    ext_set = {r['parent'] if r['child'] in ts else r['child']
               for r in REL if (r['child'] in ts) != (r['parent'] in ts)}
    ext_set = {t for t in ext_set if t not in ts}

    rel, content_w, content_h = layout_page(own_tables, kind)

    ref_src = {}
    source_set = set()
    for r in REL:
        a_own, b_own = r['parent'] in ts, r['child'] in ts
        if a_own == b_own:
            continue
        own = r['parent'] if a_own else r['child']
        ref = r['child'] if a_own else r['parent']
        if ref in ext_set:
            ref_src.setdefault(ref, own)
            source_set.add(own)
    sources = sorted(source_set, key=lambda t: (rel[t][0], rel[t][1]))
    span = 16 + len(sources) * 15 if sources else 0

    ref_w = max((ref_size(t, kind)[0] for t in ext_set), default=0)
    comp_w = content_w + (span + 16 + ref_w if ext_set else 0)
    x0 = MARGIN['l'] + max(0, (AVAIL_W - comp_w) // 2)
    y0 = MARGIN['t'] + max(0, (AVAIL_H - content_h) // 2)
    pos = {t: (x0 + rx, y0 + ry, rw, rh) for t, (rx, ry, rw, rh) in rel.items()}

    refs = {}
    trunks = {}
    ext = []
    if ext_set:
        ext = sorted(ref_src, key=lambda t: (sources.index(ref_src[t]), t))
        rx = x0 + content_w + span + 16
        total_h = len(ext) * (REF_H + REF_GAP_Y) - REF_GAP_Y
        y = MARGIN['t'] + max(0, (AVAIL_H - total_h) // 2)
        for t in ext:
            refs[t] = (rx, y, ref_w, REF_H)
            y += REF_H + REF_GAP_Y
        for i, src in enumerate(sources):
            trunks[src] = x0 + content_w + 16 + i * 15

    edges = []
    boxes = {**pos, **refs}
    for r in REL:
        a_own = r['parent'] in ts
        b_own = r['child'] in ts
        if not (a_own or b_own):
            continue
        if r['parent'] == r['child']:
            x, y, w, h = boxes[r['parent']]
            pts = [(x + w, y + h * 0.30), (x + w + 20, y + h * 0.30),
                   (x + w + 20, y + h + 18), (x + w * 0.55, y + h + 18),
                   (x + w * 0.55, y + h)]
        else:
            obstacles = [b for n, b in boxes.items() if n not in (r['parent'], r['child'])]
            pts = route_ortho(boxes[r['parent']], boxes[r['child']], obstacles)
        edges.append((r, pts, ENT[r['child']]['color']))
    return pos, refs, ext, edges


def page_html(title, own_tables, kind, footer, page_no, total):
    pos, refs, ext, edges = build_page(own_tables, kind)
    for t, p in pos.items():
        ENT[t]['_pos'] = p

    paths = []
    for r, pts, col in edges:
        if len(pts) < 2:
            continue
        paths.append(svg_path(pts, col))
        px, py = pts[0]
        paths.append(crow(px, py, 'right' if pts[1][0] > px else 'left', r['parent_mult'], col))
        qx, qy = pts[-1]
        paths.append(crow(qx, qy, 'left' if pts[-2][0] < qx else 'right', r['child_mult'], col))

    cards = ''.join((der_card if kind == 'der' else class_card)(ENT[t]) for t in own_tables)
    refs_html = ''.join(ref_card(t, refs[t], kind) for t in ext)
    svg = (f'<svg class="edges" width="{PAGE_W}" height="{PAGE_H}" '
           f'viewBox="0 0 {PAGE_W} {PAGE_H}">{"".join(paths)}</svg>')
    return (f'<section class="page"><div class="title">{esc(title)}</div>'
            f'{svg}{cards}{refs_html}'
            f'<div class="foot">{esc(footer)}</div>'
            f'<div class="pnum">{page_no} / {total}</div></section>')


CSS = """
@page { size: A3 landscape; margin: 0 }
* { box-sizing: border-box }
html, body { margin: 0; padding: 0 }
body { font-family: 'Liberation Sans', Arial, sans-serif; -webkit-print-color-adjust: exact; }
.page { width: %(pw)dpx; height: %(ph)dpx; position: relative; overflow: hidden;
        background: #fff; page-break-after: always; }
.page:last-child { page-break-after: auto }
.title { position: absolute; left: 68px; top: 42px; font-size: 21px; font-weight: 700; color: #1a1a1a; }
.edges { position: absolute; left: 0; top: 0; }
.card { position: absolute; background: #fff; border: 1.4px solid #888; border-radius: 2px;
        font-family: Menlo, monospace; }
.hd { color: #fff; font-size: 10.5px; font-weight: 700; padding: 3px 7px 4px;
      white-space: nowrap; overflow: hidden; }
.row { display: flex; align-items: baseline; padding: 0 7px; height: %(lh)spx; line-height: %(lh)spx;
       font-size: 10px; color: #212121; }
.row .nm { flex: 1 1 auto; white-space: pre; overflow: hidden; }
.row .ty { flex: 0 0 auto; color: #444; margin-left: 8px; white-space: pre; }
.row .mk { flex: 0 0 auto; width: 24px; text-align: right; font-weight: 700; font-size: 9px; }
.row.pk .nm { font-weight: 700; text-decoration: underline; }
.row.fk .nm { color: #D69B00; }
.st { font-size: 8px; color: #777; padding: 2px 7px 0; }
.ops { border-top: 1px solid #ddd; margin-top: 2px; padding-top: 3px; }
.ref { position: absolute; border: 1.2px dashed #999; border-radius: 3px; background: #fff;
       display: flex; flex-direction: column; align-items: center; justify-content: center;
       font-family: Menlo, monospace; }
.ref .rn { font-size: 9.5px; font-weight: 700; }
.ref .rm { font-size: 7px; color: #777; margin-top: 2px; }
.foot { position: absolute; left: 68px; bottom: 30px; font-size: 10px; color: #888; }
.pnum { position: absolute; right: 68px; bottom: 30px; font-size: 10px; color: #888; }
.cover h1 { position: absolute; left: 68px; top: 78px; margin: 0; font-size: 34px; letter-spacing: -.5px; }
.cover h2 { position: absolute; left: 68px; top: 128px; margin: 0; font-size: 21px; font-weight: 400; color: #5D7E99; }
.cover .lead { position: absolute; left: 68px; top: 168px; margin: 0; font-size: 12px; color: #666; }
.cover hr { position: absolute; left: 68px; right: 68px; top: 196px; border: 0; border-top: 1px solid #ccc; }
.cover h3 { position: absolute; left: 68px; font-size: 15px; font-weight: 700; margin: 0; }
.cover h3.k1 { top: 222px }
.cover ul { position: absolute; left: 68px; top: 252px; width: 660px; margin: 0; padding-left: 18px;
            font-size: 11.5px; line-height: 1.62; color: #333; }
.cover h3.k2 { top: 432px }
.cover .ix-list { position: absolute; left: 68px; top: 464px; width: 700px; }
.cover .ix { display: flex; align-items: baseline; padding: 5px 0; border-bottom: 1px solid #eee; font-size: 11.5px; }
.cover .ixn { width: 46px; color: #888 }
.cover .ixt { flex: 1 }
.cover .ixc { color: #888 }
""" % {'pw': PAGE_W, 'ph': PAGE_H, 'lh': LH}


def cover_html(title, subtitle, lead, howto, index, total, kind):
    unit = 'tablas' if kind == 'der' else 'clases'
    rows = ''.join(
        f'<div class="ix"><span class="ixn">{pno}</span><span class="ixt">{esc(mod)}</span>'
        f'<span class="ixc">{cnt} {unit}</span></div>'
        for pno, mod, cnt in index)
    items = ''.join(f'<li>{h}</li>' for h in howto)
    foot = 'DER' if kind == 'der' else 'Diagrama de Clases'
    return (f'<section class="page cover">'
            f'<h1>{esc(title)}</h1><h2>{esc(subtitle)}</h2><p class="lead">{esc(lead)}</p><hr>'
            f'<h3 class="k1">Cómo leer {"el DER" if kind == "der" else "el diagrama"}</h3><ul>{items}</ul>'
            f'<h3 class="k2">Contenido</h3><div class="ix-list">{rows}</div>'
            f'<div class="foot">ESSERI Data Core · {foot}</div>'
            f'<div class="pnum">1 / {total}</div></section>')


DER_HOWTO = [
    'Cada página muestra un módulo del sistema; los módulos grandes ocupan más de una. Cada recuadro es una tabla, con sus atributos y su tipo de dato.',
    '<b>id</b> subrayado y marcado <b>PK</b>: clave primaria. <b>UK</b>: valor único.',
    'Atributo en <b>naranja</b> marcado <b>FK</b>: clave foránea, apunta a la tabla con la que se relaciona.',
    'Cada línea es una relación, con su cardinalidad en cada extremo: <b>1</b>, <b>0..1</b> o <b>0..*</b>.',
    'Los recuadros grises con borde punteado son tablas de otro módulo, mostradas solo con su nombre '
    'y el módulo al que pertenecen, para no cortar la relación.',
    'Toda tabla del DER tiene una clase homónima en el diagrama de clases: la correspondencia es uno a uno.',
]

CLASS_HOWTO = [
    'Cada página muestra un módulo del sistema; los módulos grandes ocupan más de una. Cada recuadro es una clase, con atributos y operaciones.',
    '<b>+ atributo: tipo</b> es el tipo declarado en el modelo. <b>[0..1]</b> indica que admite nulo.',
    '<b>{id}</b> identifica la clase; <b>{unique}</b> marca un valor único.',
    'Las operaciones son propiedades derivadas del modelo. Si la clase no tiene, el compartimento queda vacío.',
    'Cada línea es una asociación, con su multiplicidad en cada extremo.',
    'Los recuadros grises con borde punteado son clases de otro módulo, mostradas solo con su nombre '
    'y el módulo al que pertenecen, para no cortar la asociación.',
    'Toda clase tiene una tabla homónima en el DER: la correspondencia es uno a uno.',
]


def doc(kind, title, subtitle, lead, howto, out):
    groups = defaultdict(list)
    for e in M['entities']:
        groups[e['module_name']].append(e)

    pages = plan_doc_pages()
    total = len(pages) + 1
    foot = 'DER' if kind == 'der' else 'Diagrama de Clases'

    seen = defaultdict(int)
    for mod, _ in pages:
        seen[mod] += 1
    idx = defaultdict(int)
    index = []
    for i, (mod, chunk) in enumerate(pages, start=2):
        label = mod if seen[mod] == 1 else f'{mod} ({idx[mod] + 1}/{seen[mod]})'
        index.append((i, label, len(chunk)))
        idx[mod] += 1
    body = [cover_html(title, subtitle, lead, howto, index, total, kind)]
    idx = defaultdict(int)
    for i, (mod, tables) in enumerate(pages, start=2):
        idx[mod] += 1
        ptitle = mod if seen[mod] == 1 else f'{mod} ({idx[mod]}/{seen[mod]})'
        body.append(page_html(ptitle, tables, kind, f'ESSERI Data Core · {foot}', i, total))

    html_doc = (f'<!doctype html><html lang="es"><head><meta charset="utf-8">'
                f'<title>{esc(title)}</title><style>{CSS}</style></head>'
                f'<body>{"".join(body)}</body></html>')
    Path(out).write_text(html_doc)
    print(f'{out}: {total} páginas')


if __name__ == '__main__':
    n, rel = len(M['entities']), len(M['relations'])
    doc('der', 'Diagrama Entidad-Relación', 'ESSERI Data Core',
        f'{n} tablas · 9 módulos · {rel} relaciones', DER_HOWTO, str(HERE / 'der.html'))
    doc('class', 'Diagrama de Clases', 'ESSERI Data Core',
        f'{n} clases · 9 módulos · {rel} relaciones', CLASS_HOWTO, str(HERE / 'clases.html'))
