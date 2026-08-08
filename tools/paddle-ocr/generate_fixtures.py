import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

OUT = Path(__file__).parent / "fixtures"
OUT.mkdir(exist_ok=True)
font = ImageFont.load_default()
cases = [
    ("clean", 0, 1.0, 1.0, {"driver.first_name": "ALEX", "driver.last_name": "MARTIN", "driver.date_of_birth": "1998-04-17"}),
    ("targeted", 0, 1.0, 1.0, {"driver.first_name": "JAMIE", "driver.last_name": "EXAMPLE", "driver.date_of_birth": "1987-11-03"}),
    ("rotated", 3, 1.0, 1.0, {"driver.first_name": "TAYLOR", "driver.last_name": "SAMPLE", "driver.date_of_birth": "2001-02-28"}),
    ("blurred", 0, 1.0, 1.0, {"driver.first_name": "ALEX", "driver.last_name": "MARTIN", "driver.date_of_birth": "1998-04-17"}),
    ("low_contrast", 0, .65, .85, {"driver.first_name": "JAMIE", "driver.last_name": "EXAMPLE", "driver.date_of_birth": "1987-11-03"}),
]
golden = []
for i in range(20):
    kind, angle, contrast, scale, expected = cases[i % len(cases)]
    image = Image.new("RGB", (1000, 500), "white")
    draw = ImageDraw.Draw(image)
    draw.text((80, 100), f"DRIVER LICENSE  SYNTHETIC {i+1:02d}", fill="black", font=font)
    first = expected["driver.first_name"]
    last = expected["driver.last_name"]
    dob = expected["driver.date_of_birth"]
    draw.text((80, 190), f"SURNAME: {last}", fill="black", font=font)
    draw.text((80, 240), f"GIVEN NAME: {first}", fill="black", font=font)
    draw.text((80, 290), f"DOB: {dob}", fill="black", font=font)
    if kind == "blurred": image = image.filter(ImageFilter.GaussianBlur(1.4))
    if contrast != 1.0: image = ImageEnhance.Contrast(image).enhance(contrast)
    if angle: image = image.rotate(angle, expand=True, fillcolor="white")
    path = OUT / f"license_{i+1:02d}_{kind}.png"
    image.save(path)
    golden.append({"fixture": path.name, "collectionMode": "TARGETED_CAPTURE" if kind == "targeted" else "FULL_DOCUMENT", "expected": expected})
(OUT / "golden.json").write_text(json.dumps(golden, indent=2) + "\n")
