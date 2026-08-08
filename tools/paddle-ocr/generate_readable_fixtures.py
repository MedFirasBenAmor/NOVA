import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

OUT = Path(__file__).parent / "fixtures-readable"
OUT.mkdir(exist_ok=True)
font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 38)
title = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 42)
identities = [
    ("ALEX", "MARTIN", "1998-04-17"),
    ("JAMIE", "EXAMPLE", "1987-11-03"),
    ("TAYLOR", "SAMPLE", "2001-02-28"),
]
categories = ["clean", "targeted", "rotation", "blur", "reduced_contrast"]
golden = []
for index in range(20):
    first, last, dob = identities[index % len(identities)]
    category = categories[index % len(categories)]
    image = Image.new("RGB", (1200, 700), "white")
    draw = ImageDraw.Draw(image)
    draw.text((80, 70), "SYNTHETIC DRIVER LICENSE", fill="black", font=title)
    draw.text((80, 210), f"SURNAME: {last}", fill="black", font=font)
    draw.text((80, 300), f"GIVEN NAME: {first}", fill="black", font=font)
    draw.text((80, 390), f"DOB: {dob}", fill="black", font=font)
    if category == "targeted": image = image.crop((40, 160, 1000, 510))
    if category == "rotation": image = image.rotate(3, expand=True, fillcolor="white")
    if category == "blur": image = image.filter(ImageFilter.GaussianBlur(1.2))
    if category == "reduced_contrast": image = ImageEnhance.Contrast(image).enhance(.55)
    path = OUT / f"license_{index + 1:02d}_{category}.png"
    image.save(path)
    golden.append({
        "fixture": path.name,
        "category": category,
        "collectionMode": "TARGETED_CAPTURE" if category == "targeted" else "FULL_DOCUMENT",
        "expected": {
            "driver.first_name": first,
            "driver.last_name": last,
            "driver.date_of_birth": dob,
        },
    })
(OUT / "golden.json").write_text(json.dumps(golden, indent=2) + "\n")
