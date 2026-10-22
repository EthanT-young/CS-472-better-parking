"""Trace UNLV Park and Go floor screenshots into a stall JSON + floor plan SVGs.

Usage: python3 trace_floorplan.py <screenshots_dir> <out_dir> [stall_width_px]

Expects l1.png ... l4.png (one per level, same framing). Stall rows are found by
their legend color, split into stalls of stall_width_px, and written in the same
format as data/garage-stalls-CG.json. OVERLAYS, ANGLE and CROP are tuned to the
Tropicana screenshots (map pin / icons to paint over, rotation, garage bounds).

Needs: pip install numpy opencv-python-headless
"""
import json, os, sys
import numpy as np, cv2

D = os.path.join(sys.argv[1], '')
OUT = os.path.join(sys.argv[2], '')
STALL_W = float(sys.argv[3]) if len(sys.argv) > 3 else 12.0  # px in screenshot

PAL = {
    'Student': ((164, 169, 172), 14),
    'Staff': ((245, 226, 70), 45),
    'ADA': ((42, 178, 234), 45),
    'Reserved': ((225, 62, 58), 40),
    'ShortTerm': ((98, 178, 98), 40),
    'EV': ((245, 110, 30), 40),
    'Motorcycle': ((118, 88, 160), 40),
}
TYPE = {
    'Student': ('Student', 'standard'), 'Staff': ('Staff', 'yellow'),
    'ADA': ('Accessibility (ADA)', 'ada'), 'Reserved': ('Reserved', 'red'),
    'ShortTerm': ('Short Term Paid Parking', 'green'), 'EV': ('Electric Vehicle', 'orange'),
    'Motorcycle': ('Motorcycle', 'purple'),
}
OVERLAYS = [(150, 235, 215, 305), (198, 292, 248, 348), (162, 668, 218, 722)]  # x0,y0,x1,y1
ANGLE = -1.8  # degrees; deskews the garage
SCALE = 2.6
CROP = (30, 88, 405, 1052)  # x0,y0,x1,y1 in the deskewed screenshot


def fill_overlays(m):
    for x0, y0, x1, y1 in OVERLAYS:
        for x in range(x0, x1):
            above = m[y0 - 3:y0, x].max()
            below = m[y1:y1 + 3, x].max()
            if above and below:
                m[y0:y1, x] = 1
            else:
                m[y0:y1, x] = 0
    return m


def deskew(img, interp=cv2.INTER_NEAREST):
    h, w = img.shape[:2]
    M = cv2.getRotationMatrix2D((w / 2, h / 2), ANGLE, 1.0)
    return cv2.warpAffine(img, M, (w, h), flags=interp, borderValue=0)


def level(lvl):
    img = cv2.cvtColor(cv2.imread(D + f'l{lvl}.png'), cv2.COLOR_BGR2RGB).astype(int)
    rows = []
    for key, (col, tol) in PAL.items():
        d = np.sqrt(((img - np.array(col)) ** 2).sum(-1))
        m = (d < tol).astype(np.uint8)
        m = fill_overlays(m)
        m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
        m = deskew(m)
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        n, lab, st, _ = cv2.connectedComponentsWithStats(m)
        for i in range(1, n):
            x, y, w, h, area = st[i]
            if area < 60 or min(w, h) < 6:
                continue
            fill = area / (w * h)
            rows.append(dict(key=key, x=x, y=y, w=w, h=h, fill=fill))
    blk = (img.max(-1) < 60).astype(np.uint8)
    blk = deskew(blk)
    return rows, blk


def split_rows(rows, depth):
    out = []
    for r in rows:
        vertical = r['h'] >= r['w']
        short = r['w'] if vertical else r['h']
        k = max(1, round(short / depth)) if short > 1.5 * depth else 1
        for j in range(k):
            if vertical:
                out.append(dict(r, x=r['x'] + j * short / k, w=short / k, vertical=True))
            else:
                out.append(dict(r, y=r['y'] + j * short / k, h=short / k, vertical=False))
    return out


def overlap(a, b):
    w = min(a['x'] + a['w'], b['x'] + b['w']) - max(a['x'], b['x'])
    h = min(a['y'] + a['h'], b['y'] + b['h']) - max(a['y'], b['y'])
    return max(0, w) * max(0, h)


# Components of different colors (or split halves) can overlap; keep the bigger row.
def dedupe(rows):
    kept = []
    for r in sorted(rows, key=lambda r: -r['w'] * r['h']):
        area = r['w'] * r['h']
        if any(overlap(r, k) > 0.3 * area for k in kept):
            continue
        kept.append(r)
    return kept


def stalls_for(row, stall_w):
    length = row['h'] if row['vertical'] else row['w']
    n = max(1, round(length / stall_w))
    step = length / n
    polys = []
    for i in range(n):
        if row['vertical']:
            x0, x1 = row['x'], row['x'] + row['w']
            y0, y1 = row['y'] + i * step, row['y'] + (i + 1) * step
        else:
            x0, x1 = row['x'] + i * step, row['x'] + (i + 1) * step
            y0, y1 = row['y'], row['y'] + row['h']
        polys.append([[x0, y1], [x1, y1], [x1, y0], [x0, y0]])
    return polys


def tx(p):
    return [round((p[0] - CROP[0]) * SCALE, 1), round((p[1] - CROP[1]) * SCALE, 1)]


def main():
    os.makedirs(OUT, exist_ok=True)
    W = round((CROP[2] - CROP[0]) * SCALE)
    H = round((CROP[3] - CROP[1]) * SCALE)
    data = {'viewBox': [0, 0, W, H], 'stall_size_units': [round(STALL_W * SCALE, 1), None], 'levels': {}}
    total = 0
    summary = {}
    for lvl in range(1, 5):
        rows, blk = level(lvl)
        shorts = sorted(min(r['w'], r['h']) for r in rows if max(r['w'], r['h']) > 3 * min(r['w'], r['h']))
        depth = shorts[len(shorts) // 2] if shorts else 24
        data['stall_size_units'][1] = round(depth * SCALE, 1)
        rows = split_rows(rows, depth)
        # Sort into strips: left to right, top to bottom.
        rows.sort(key=lambda r: (round(r['y'] / 40), r['x']))
        stalls = []
        counts = {}
        accepted = []
        # Colored (non-student) stalls win where they overlap a gray strip.
        order = sorted(range(len(rows)), key=lambda i: (rows[i]['key'] == 'Student', -rows[i]['w'] * rows[i]['h']))
        keep = {}
        for i in order:
            for pi, poly in enumerate(stalls_for(rows[i], STALL_W)):
                box = dict(x=poly[0][0], y=poly[2][1], w=poly[1][0] - poly[0][0], h=poly[0][1] - poly[2][1])
                if any(overlap(box, a) > 0.35 * box['w'] * box['h'] for a in accepted):
                    continue
                accepted.append(box)
                keep.setdefault(i, []).append(poly)
        for si, row in enumerate(rows):
            strip = f"{si + 1}"
            t, zone = TYPE[row['key']]
            for pi, poly in enumerate(keep.get(si, [])):
                stalls.append({
                    'id': f"TR-L{lvl}-R{int(strip):02d}-{pi + 1:02d}",
                    'strip': strip, 'type': t, 'zone': zone,
                    'points': [tx(p) for p in poly],
                })
                counts[t] = counts.get(t, 0) + 1
        data['levels'][f'level{lvl}'] = stalls
        total += len(stalls)
        summary[lvl] = (len(stalls), counts)
        write_svg(OUT + f'level{lvl}.svg', lvl, rows, blk, W, H)
    with open(OUT + 'garage-stalls-TR.json', 'w') as f:
        json.dump(data, f, separators=(',', ':'))
    for lvl, (n, c) in summary.items():
        print(lvl, n, c)
    print('total', total)


def write_svg(path, lvl, rows, blk, W, H):
    # Walls: line segments from the black pixels (outline and dividers), inside the garage crop.
    x0, y0, x1, y1 = CROP
    b = np.zeros_like(blk)
    b[y0:y1, x0:x1] = blk[y0:y1, x0:x1]
    segs = cv2.HoughLinesP(b * 255, 1, np.pi / 180, threshold=25, minLineLength=18, maxLineGap=4)
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">',
             f'<rect x="0" y="0" width="{W}" height="{H}" fill="#f8fafc"/>',
             f'<text x="{W / 2}" y="22" font-family="Arial, sans-serif" font-size="20" font-weight="bold" text-anchor="middle" fill="#0f172a">LEVEL {lvl}{" (GROUND)" if lvl == 1 else ""}</text>']
    ys, xs = np.where(b > 0)
    if len(xs):
        lo = tx([np.percentile(xs, 0.1), np.percentile(ys, 0.1)])
        hi = tx([np.percentile(xs, 99.9), np.percentile(ys, 99.9)])
        parts.append(f'<rect x="{lo[0]}" y="{lo[1]}" width="{round(hi[0] - lo[0], 1)}" height="{round(hi[1] - lo[1], 1)}" fill="#ffffff" stroke="#0f172a" stroke-width="6"/>')
    for r in rows:
        p = [tx([r['x'], r['y']]), tx([r['x'] + r['w'], r['y'] + r['h']])]
        parts.append(f'<rect x="{p[0][0]}" y="{p[0][1]}" width="{round(p[1][0] - p[0][0], 1)}" height="{round(p[1][1] - p[0][1], 1)}" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1"/>')
    if segs is not None:
        for s in segs.reshape(-1, 4):
            a, c = tx(s[:2]), tx(s[2:])
            parts.append(f'<line x1="{a[0]}" y1="{a[1]}" x2="{c[0]}" y2="{c[1]}" stroke="#0f172a" stroke-width="5" stroke-linecap="square"/>')
    parts.append('</svg>')
    with open(path, 'w') as f:
        f.write('\n'.join(parts))


main()
