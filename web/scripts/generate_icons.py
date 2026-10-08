import os
from PIL import Image, ImageDraw

icons_dir = os.path.join(os.path.dirname(__file__), "..", "public", "icons")
os.makedirs(icons_dir, exist_ok=True)


def create_lumina_icon(size: int, is_maskable: bool = False) -> Image.Image:
    # High-tech camera lens / director aperture logo
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0) if not is_maskable else (9, 10, 15, 255))
    draw = ImageDraw.Draw(img)

    margin = size * 0.1 if is_maskable else size * 0.05
    radius = (size - 2 * margin) / 2
    center_x, center_y = size / 2, size / 2

    # Outer rounded camera body background
    if not is_maskable:
        draw.rounded_rectangle(
            [margin, margin, size - margin, size - margin],
            radius=size * 0.22,
            fill=(15, 17, 26, 255),
            outline=(56, 189, 248, 200),
            width=max(2, int(size * 0.02)),
        )

    # Glowing aperture ring
    outer_ring_r = radius * 0.72
    draw.ellipse(
        [
            center_x - outer_ring_r,
            center_y - outer_ring_r,
            center_x + outer_ring_r,
            center_y + outer_ring_r,
        ],
        fill=(22, 27, 46, 255),
        outline=(168, 85, 247, 240),
        width=max(2, int(size * 0.03)),
    )

    # Inner lens with gradient-like reflection
    inner_ring_r = radius * 0.44
    draw.ellipse(
        [
            center_x - inner_ring_r,
            center_y - inner_ring_r,
            center_x + inner_ring_r,
            center_y + inner_ring_r,
        ],
        fill=(99, 102, 241, 255),
        outline=(56, 189, 248, 255),
        width=max(2, int(size * 0.025)),
    )

    # Core AI sparkle (director lens flare)
    flare_r = radius * 0.16
    draw.ellipse(
        [
            center_x - flare_r - radius * 0.1,
            center_y - flare_r - radius * 0.1,
            center_x + flare_r - radius * 0.1,
            center_y + flare_r - radius * 0.1,
        ],
        fill=(255, 255, 255, 230),
    )

    # Top right lens reflection dot
    dot_r = radius * 0.08
    draw.ellipse(
        [
            center_x + outer_ring_r * 0.5,
            center_y - outer_ring_r * 0.5,
            center_x + outer_ring_r * 0.5 + dot_r * 2,
            center_y - outer_ring_r * 0.5 + dot_r * 2,
        ],
        fill=(52, 211, 153, 240),
    )

    return img


for sz in [72, 96, 128, 144, 152, 192, 384, 512]:
    icon = create_lumina_icon(sz, is_maskable=False)
    icon.save(os.path.join(icons_dir, f"icon-{sz}x{sz}.png"))

# Maskable icons
for sz in [192, 512]:
    icon = create_lumina_icon(sz, is_maskable=True)
    icon.save(os.path.join(icons_dir, f"maskable-icon-{sz}x{sz}.png"))

# Apple touch icon and favicon
apple_icon = create_lumina_icon(180, is_maskable=True)
apple_icon.save(os.path.join(os.path.dirname(__file__), "..", "public", "apple-touch-icon.png"))
favicon = create_lumina_icon(64, is_maskable=False)
favicon.save(os.path.join(os.path.dirname(__file__), "..", "public", "favicon.png"))

print("Successfully generated all PWA icons!")
