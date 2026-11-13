import sys
sys.path.insert(0,'.')
import render as R
EPS=2.0

def overlap(p,q,rect):
    (x1,y1),(x2,y2)=p,q
    rx0,ry0,rw,rh=rect; rx1,ry1=rx0+rw,ry0+rh
    rx0+=EPS; ry0+=EPS; rx1-=EPS; ry1-=EPS
    if rx0>=rx1 or ry0>=ry1: return 0.0
    if abs(y1-y2)<0.01:
        if not (ry0<y1<ry1): return 0.0
        lo,hi=sorted((x1,x2)); return max(0.0,min(hi,rx1)-max(lo,rx0))
    if abs(x1-x2)<0.01:
        if not (rx0<x1<rx1): return 0.0
        lo,hi=sorted((y1,y2)); return max(0.0,min(hi,ry1)-max(lo,ry0))
    return 0.0

def audit(kind,label):
    pages=R.plan_doc_pages(); total=0; severe=[]; minor=0
    for pno,(mod,tables) in enumerate(pages,start=2):
        pos,refs,ext,edges=R.build_page(tables,kind)
        boxes={**pos,**refs}
        for r,pts,col in edges:
            total+=1
            src,dst=r['parent'],r['child']; worst=0; who=None
            for a,b in zip(pts,pts[1:]):
                for name,box in boxes.items():
                    if name in (src,dst): continue
                    o=overlap(a,b,box)
                    if o>worst: worst,who=o,name
            if worst>30: severe.append((pno,mod,f"{r['parent']}.{r['column']} -> {r['child']}",round(worst),who))
            elif worst>0: minor+=1
    print(f'=== {label}: {total} aristas | severas (>30px) {len(severe)} | roces {minor} | limpias {total-len(severe)-minor}')
    from collections import Counter
    c=Counter((p,m) for p,m,_,_,_ in severe)
    for (p,m),n in sorted(c.items()): print(f'   pag {p} · {m}: {n}')
    return severe

s1=audit('der','DER')
print()
s2=audit('class','CLASES')
print('\n--- peores casos DER ---')
for x in sorted(s1,key=lambda t:-t[3])[:8]: print(f'  pag {x[0]} {x[2]}  cruza {x[4]} por {x[3]}px')
print('\n--- peores casos CLASES ---')
for x in sorted(s2,key=lambda t:-t[3])[:8]: print(f'  pag {x[0]} {x[2]}  cruza {x[4]} por {x[3]}px')
