"""Turns a photograph or scan of a signature into docs/signature.png.

Keeps the ink, drops the paper — and anything pink, since signature scans are
often taken off a coloured form. The result has a transparent background, so it
sits on the signature line instead of in a white rectangle.

    python3 scripts/prepare-signature.py path/to/scan.jpg
"""

import sys
from PIL import Image
import numpy as np

source = sys.argv[1] if len(sys.argv) > 1 else sys.exit(__doc__)

image = np.array(Image.open(source).convert("RGB")).astype(int)
red, green, blue = image[..., 0], image[..., 1], image[..., 2]

darkness = 255 - image.min(axis=2)
pinkish = (red > 195) & (blue > 185) & (red - green > 22)
ink = (darkness > 55) & ~pinkish

if not ink.any():
    sys.exit("No ink found — is the scan very faint?")

rows, cols = np.where(ink)
alpha = np.clip((darkness - 30) * 5, 0, 255).astype("uint8")
alpha[~ink] = 0

out = np.zeros((*alpha.shape, 4), dtype="uint8")
out[..., 0:3] = 20  # near-black ink
out[..., 3] = alpha

signature = Image.fromarray(out, "RGBA").crop(
    (max(int(cols.min()) - 15, 0), max(int(rows.min()) - 15, 0), int(cols.max()) + 15, int(rows.max()) + 15)
)
signature.thumbnail((1600, 1600), Image.LANCZOS)
signature.save("docs/signature.png")
print("wrote docs/signature.png", signature.size)
