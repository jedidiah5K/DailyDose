"""Cut the machine and mugs out of the scene pictures and paint the counter back in.
Run: python -I tools/cut-scene.py   (writes design/cafe/art/bg/<scene>/*.png and design/cafe/art/bg/scene.js)
Each piece is lifted by flood-filling from its box edge through anything lighter than the dark outline."""
from PIL import Image, ImageFilter
from collections import deque
import json, os

BG = 'D:/DailyDose/design/cafe/art/bg'
# boxes are (x0, y0, x1, y1) in the picture's own pixels, read off gridded crops
S = {
 'tall-day': dict(machine=(252,1066,650,1372), rush=(394,1265,496,1360), counter=1064, rays=[(220,276,276,372),(656,276,716,372)], bubble=[], row=(28,1332,914,1492), button=(186,1497,756,1604),
   cups=dict(shot=(44,1330,170,1490), blend=(182,1330,314,1490), hilo=(484,1330,620,1490), link=(632,1330,764,1490), ladder=(774,1330,898,1490)),
   home={'rush':(395,1483)}),
 'tall-night': dict(machine=(260,1016,650,1322), rush=(396,1228,498,1314), counter=1013, rays=[(212,220,290,352),(650,220,724,352)], bubble=[(198,564,552,664),(346,636,392,682)], row=(28,1296,914,1463), button=(186,1477,756,1590),
   cups=dict(shot=(38,1298,172,1458), blend=(182,1298,316,1458), hilo=(474,1298,620,1458), link=(628,1298,762,1458), ladder=(768,1298,904,1458)),
   home={'rush':(395,1450)}),
 'wide-day': dict(machine=(704,594,978,800), rush=(798,722,862,794), counter=616, rays=[(648,136,708,218),(966,136,1024,218)], bubble=[(458,296,724,378),(590,360,630,392)], row=(316,676,1302,803), button=(604,810,1066,892),
   cups=dict(shot=(324,678,420,795), blend=(444,678,546,795), extra=(568,678,668,795), hilo=(980,678,1078,795), link=(1084,678,1178,795), ladder=(1180,678,1278,795)),
   home={'rush':(618,788)}),
 'wide-night': dict(machine=(704,594,978,800), rush=(798,722,862,794), counter=616, rays=[(648,136,708,218),(966,136,1024,218)], bubble=[(458,296,724,378),(590,360,630,392)], row=(316,676,1302,803), button=(604,810,1066,892),
   cups=dict(shot=(324,668,420,795), blend=(444,678,546,795), extra=(568,678,668,795), hilo=(980,678,1078,795), link=(1084,678,1178,795), ladder=(1180,678,1278,795)),
   home={'rush':(618,788)}),
}
T = 70  # outline is near-black brown; anything lighter is passable background

def lum(p): return (p[0]*299 + p[1]*587 + p[2]*114) // 1000

def lift(im, box, free=frozenset()):
    """Return the set of pixels inside box NOT reachable from its edge (the object)."""
    x0,y0,x1,y1 = box; px = im.load()
    ok = lambda x,y: (x,y) in free or lum(px[x,y]) > T
    seen = set(); q = deque()
    for x in range(x0,x1):
        for y in (y0,y1-1): q.append((x,y))
    for y in range(y0,y1):
        for x in (x0,x1-1): q.append((x,y))
    while q:
        x,y = q.popleft()
        if (x,y) in seen or not (x0<=x<x1 and y0<=y<y1) or not ok(x,y): continue
        seen.add((x,y)); q.extend(((x+1,y),(x-1,y),(x,y+1),(x,y-1)))
    obj = {(x,y) for x in range(x0,x1) for y in range(y0,y1) if (x,y) not in seen}
    # keep the biggest connected blob (drops stray dark specks)
    best = set(); left = set(obj)
    while left:
        s = left.pop(); comp = {s}; q = deque([s])
        while q:
            x,y = q.popleft()
            for n in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
                if n in left: left.remove(n); comp.add(n); q.append(n)
        if len(comp) > len(best): best = comp
    return best

def grow(mask, r=2):
    out = set(mask)
    for x,y in mask:
        for dx in range(-r,r+1):
            for dy in range(-r,r+1): out.add((x+dx,y+dy))
    return out

def inpaint(im, mask):
    """Fill each masked run by blending the nearest clean pixels left and right (counter planks run sideways)."""
    im = im.copy(); px = im.load(); W,H = im.size
    rows = {}
    for x,y in mask:
        if 0<=x<W and 0<=y<H: rows.setdefault(y,[]).append(x)
    for y,xs in rows.items():
        xs = sorted(set(xs)); i = 0
        while i < len(xs):
            j = i
            while j+1 < len(xs) and xs[j+1] == xs[j]+1: j += 1
            a, b = xs[i]-1, xs[j]+1
            L = px[max(a,0),y]; R = px[min(b,W-1),y]
            n = b - a
            for x in range(xs[i], xs[j]+1):
                t = (x-a)/n; px[x,y] = tuple(round(L[k]*(1-t)+R[k]*t) for k in range(3))
            i = j+1
    return im

def save_piece(im, mask, path):
    xs = [p[0] for p in mask]; ys = [p[1] for p in mask]
    x0,y0,x1,y1 = min(xs),min(ys),max(xs)+1,max(ys)+1
    out = Image.new('RGBA',(x1-x0,y1-y0),(0,0,0,0)); src = im.load(); dst = out.load()
    for x,y in mask: dst[x-x0,y-y0] = src[x,y] + (255,)
    out.save(path)
    return [x0,y0,x1-x0,y1-y0]

def opening(mask, r=2):
    """Drop thin strands (e.g. a neighbour's outline) while keeping solid shapes."""
    core = {p for p in mask if all((p[0]+dx,p[1]+dy) in mask for dx in range(-r,r+1) for dy in range(-r,r+1))}
    return grow(core, r) & mask

def rect(b): return {(x,y) for x in range(b[0],b[2]) for y in range(b[1],b[3])}

layout = {}
for name, cfg in S.items():
    im = Image.open(f'{BG}/{name}-ref.png').convert('RGB'); W,H = im.size
    os.makedirs(f'{BG}/{name}', exist_ok=True)
    L = {'w':W,'h':H,'cups':{},'home':cfg['home']}
    rush = opening(lift(im, cfg['rush']))
    L['cups']['rush'] = save_piece(im, rush, f'{BG}/{name}/rush.png')
    cupmasks = {}
    for k,box in cfg['cups'].items():
        m = opening(lift(im, box)); cupmasks[k] = m
        if k != 'extra': L['cups'][k] = save_piece(im, m, f'{BG}/{name}/{k}.png')
    free = frozenset(set().union(*cupmasks.values()))
    mach = opening(lift(im, cfg['machine']) - free)
    mach |= rush
    # patch the grate where the red cup stood: repeat the grate's own hole pattern from the right
    mimg = im.copy(); mp = mimg.load()
    rx0,ry0,rx1,ry1 = cfg['rush']; gy = ry1-22
    row = [lum(mp[x,gy]) for x in range(rx1, min(rx1+160, W))]
    def score(P): return sum(abs(row[i]-row[i+P]) for i in range(len(row)-P))/(len(row)-P)
    P = min(range(14,70), key=score)
    hole = grow(rush, 4) & (mach | grow(rush,4))
    for x,y in sorted(hole, key=lambda q:-q[0]):
        k = 1
        while (x+k*P, y) in hole: k += 1
        mp[x,y] = mp[x+k*P, y]
    mach |= {q for q in hole if (q[0]+P,q[1]) in mach}
    L['machine'] = save_piece(mimg, mach, f'{BG}/{name}/machine.png')
    c = cfg['counter']; mb = cfg['machine']
    erase = grow(mach | free | rush, 2) | rect(cfg['button']) | rect((mb[0]-28,max(mb[1],c),mb[2]+6,mb[3]+16))
    erase |= rect(cfg['row'])
    L['button'] = [cfg['button'][0],cfg['button'][1],cfg['button'][2]-cfg['button'][0],cfg['button'][3]-cfg['button'][1]]
    bg = inpaint(im, erase)
    # remove the title's orange rays and the speech bubble (Job, 2026-11-15)
    import numpy as np, cv2
    a = np.array(bg); m = np.zeros(a.shape[:2], np.uint8)
    for x0,y0,x1,y1 in cfg['rays']:
        r,g,b = [a[y0:y1,x0:x1,i].astype(int) for i in range(3)]
        lu = (r*299+g*587+b*114)//1000
        m[y0:y1,x0:x1] = (((r>170)&(g>80)&(g<200)&(b<110)&(r-b>110)) | ((lu<95)&(r>b+8)&(r>=g))).astype(np.uint8)*255
    m = cv2.dilate(m, np.ones((7,7),np.uint8))
    for x0,y0,x1,y1 in cfg['bubble']: m[y0:y1,x0:x1] = 255
    bg = Image.fromarray(cv2.inpaint(a, m, 7, cv2.INPAINT_TELEA))
    bg.save(f'{BG}/{name}/bg.png')
    layout[name] = L
    print(name, 'machine', L['machine'], {k:v for k,v in L['cups'].items()})
open(f'{BG}/scene.js','w').write('window.SCENES=' + json.dumps(layout) + ';\n')
