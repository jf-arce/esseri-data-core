"""Extrae el modelo de dominio desde los modelos SQLAlchemy y lo serializa a JSON.

Uso: backend/venv/bin/python database/schema/generator/build_model.py
"""
import json, re, sys, glob
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'backend'))

from src.models import Base
import src.auth.models, src.familias_alumnos.models, src.academico.models
import src.inscripciones.models, src.facturacion.models, src.proveedores_compras.models
import src.workflows.models, src.ia_sugerencias.models, src.comunicaciones.models

MODULES = {
    'auth':              ('Autenticación y Roles', '#5D7E99'),
    'familias_alumnos':  ('Familias y Alumnos',    '#82B366'),
    'academico':         ('Académico',             '#D5B655'),
    'inscripciones':     ('Inscripciones',         '#B85350'),
    'facturacion':       ('Facturación y Cobranza','#9573A6'),
    'proveedores_compras':('Proveedores y Compras','#D69B00'),
    'workflows':         ('Motor de Workflows y Notificaciones','#6699CC'),
    'comunicaciones':    ('Comunicaciones',        '#4E9A8F'),
    'ia_sugerencias':    ('Núcleo compartido e IA','#666666'),
    'core':              ('Núcleo compartido e IA','#666666'),
}

# tabla -> (clase, modulo, operaciones)
meta = {}
for f in glob.glob(str(ROOT / 'backend/src/*/models.py')):
    mod = f.split('/')[-2]
    src = open(f, encoding='utf-8').read()
    for blk in re.split(r'\n(?=class )', src):
        m = re.match(r'class (\w+)\(', blk)
        t = re.search(r'__tablename__\s*=\s*["\'](\w+)', blk)
        if not (m and t):
            continue
        ops = re.findall(r'@property\s*\n\s*def\s+(\w+)\s*\(', blk)
        ann = {a: b for a, b in re.findall(r'^\s+(\w+):\s*Mapped\[([^\]]+)\]', blk, re.M)}
        meta[t.group(1)] = (m.group(1), mod, ops, ann)
for t in ('persona', 'audit_log', 'event_log'):
    src = open(ROOT / 'backend/src/models.py', encoding='utf-8').read()
    for blk in re.split(r'\n(?=class )', src):
        m = re.match(r'class (\w+)\(', blk)
        tt = re.search(r'__tablename__\s*=\s*["\'](\w+)', blk)
        if m and tt and tt.group(1) == t:
            meta[t] = (m.group(1), 'core',
                       re.findall(r'@property\s*\n\s*def\s+(\w+)\s*\(', blk),
                       {a: b for a, b in re.findall(r'^\s+(\w+):\s*Mapped\[([^\]]+)\]', blk, re.M)})

PY_TYPE = {
    'uuid.uuid': 'uuid', 'str': 'string', 'datetime.datetime': 'datetime',
    'datetime.date': 'date', 'bool': 'boolean', 'decimal.decimal': 'decimal',
    'dict': 'jsonb', 'int': 'integer', 'bytes': 'bytea', 'float': 'float',
}


def typename(t):
    s = str(t).lower()
    if 'uuid' in s: return 'uuid'
    if 'datetime' in s: return 'datetime'
    if s.startswith('date'): return 'date'
    if 'bool' in s: return 'boolean'
    if 'json' in s: return 'jsonb'
    if 'numeric' in s or 'decimal' in s: return 'decimal'
    if 'int' in s: return 'integer'
    if 'largebinary' in s or 'bytea' in s: return 'bytea'
    if 'string' in s or 'text' in s or 'varchar' in s: return 'string'
    return s

entities = []
for tname, table in sorted(Base.metadata.tables.items()):
    cls, mod, ops, annots = meta.get(tname, (tname.title().replace('_', ''), 'core', [], {}))
    cols = []
    for c in table.columns:
        fk = None
        if c.foreign_keys:
            fk = list(c.foreign_keys)[0].target_fullname.split('.')[0]
        py = annots.get(c.name, '').replace(' | None', '').strip().lower()
        cols.append({
            'name': c.name,
            'type': PY_TYPE.get(py, typename(c.type)),
            'null': bool(c.nullable),
            'pk': bool(c.primary_key),
            'unique': bool(c.unique),
            'fk': fk,
        })
    mname, color = MODULES[mod]
    entities.append({
        'table': tname, 'class': cls, 'module': mod, 'module_name': mname,
        'color': color, 'columns': cols, 'operations': ops,
    })

# relaciones derivadas de las FK
by_table = {e['table']: e for e in entities}
relations = []
for e in entities:
    for c in e['columns']:
        if not c['fk']:
            continue
        parent = by_table.get(c['fk'])
        if not parent:
            continue
        # extremo padre: 1 si la FK es obligatoria, 0..1 si admite NULL
        parent_mult = '0..1' if c['null'] else '1'
        # extremo hijo: 0..1 si la FK es unica (1:1), si no 0..*
        child_mult = '0..1' if c['unique'] else '0..*'
        relations.append({
            'child': e['table'], 'parent': parent['table'],
            'column': c['name'], 'parent_mult': parent_mult, 'child_mult': child_mult,
        })

out = {
    'entities': entities,
    'relations': relations,
    'modules': [{'key': k, 'name': v[0], 'color': v[1]} for k, v in MODULES.items()],
}
dest = ROOT / 'database/schema/generator/model.json'
dest.write_text(json.dumps(out, ensure_ascii=False, indent=1))
print(f'entidades: {len(entities)}  relaciones: {len(relations)}  -> {dest}')
