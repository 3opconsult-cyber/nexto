#!/usr/bin/env python3
"""Rasterise une page HTML du kit de marque en PNG (Chromium).
Usage: python3 shoot.py <fichier.html> <sortie.png> [largeur] [--full]
Chromium sert au contrôle visuel et aux visuels écran (posts, planches).
Les PDF print passent par weasyprint (build.py) — pas par wkhtmltopdf.
"""
import sys, pathlib, asyncio
from playwright.async_api import async_playwright

async def main():
    src = pathlib.Path(sys.argv[1]).resolve()
    out = pathlib.Path(sys.argv[2]).resolve()
    width = int(sys.argv[3]) if len(sys.argv) > 3 and sys.argv[3].isdigit() else 1480
    out.parent.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": width, "height": 1000}, device_scale_factor=2)
        await pg.goto(src.as_uri())
        await pg.wait_for_timeout(700)
        await pg.screenshot(path=str(out), full_page=True)
        await b.close()
    print(out)

asyncio.run(main())
