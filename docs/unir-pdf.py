#!/usr/bin/env python3
"""Une todos los PDF de un directorio en uno solo, en orden alfabético.

Uso: backend/venv/bin/python docs/unir-pdf.py <directorio> <salida.pdf>
"""
import sys
from pathlib import Path

from pypdf import PdfReader, PdfWriter

src, dst = Path(sys.argv[1]), Path(sys.argv[2])
files = sorted(src.glob('*.pdf'))
if not files:
    sys.exit(f'no hay PDF en {src}')

writer = PdfWriter()
for f in files:
    for page in PdfReader(f).pages:
        writer.add_page(page)
dst.parent.mkdir(parents=True, exist_ok=True)
with open(dst, 'wb') as fh:
    writer.write(fh)
print(f'{dst} · {len(files)} vistas · {len(writer.pages)} páginas')
