import os
import sys
try:
    from PIL import Image, ImageDraw
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
    from PIL import Image, ImageDraw

def add_corners(im, rad):
    circle = Image.new('L', (rad * 2, rad * 2), 0)
    draw = ImageDraw.Draw(circle)
    draw.ellipse((0, 0, rad * 2 - 1, rad * 2 - 1), fill=255)
    alpha = Image.new('L', im.size, 255)
    w, h = im.size
    alpha.paste(circle.crop((0, 0, rad, rad)), (0, 0))
    alpha.paste(circle.crop((0, rad, rad, rad * 2)), (0, h - rad))
    alpha.paste(circle.crop((rad, 0, rad * 2, rad)), (w - rad, 0))
    alpha.paste(circle.crop((rad, rad, rad * 2, rad * 2)), (w - rad, h - rad))
    im.putalpha(alpha)
    return im

def main():
    img_path = "build/icon.png"
    if not os.path.exists(img_path):
        print("icon.png not found")
        sys.exit(1)
        
    im = Image.open(img_path).convert("RGBA")
    # 25% of width as radius for rounded corners
    rad = int(im.size[0] * 0.25)
    im_rounded = add_corners(im, rad)
    im_rounded.save("build/icon.png")
    
    # Also generate ico
    icon_sizes = [(16,16), (32, 32), (48, 48), (64,64), (128, 128), (256, 256)]
    im_rounded.save("build/icon.ico", format="ICO", sizes=icon_sizes)
    print("Rounded icon generated.")

if __name__ == "__main__":
    main()
