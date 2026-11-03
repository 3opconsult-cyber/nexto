"""Lecteur partagé des animations (commandes, vitesse, rubriques, ?admin / ?embed / ?scene).
Chaque build.py appelle `apply(html)` : remplace %%PLAYER_CSS%% (dans un <style>), %%PLAYER_CONTROLS%% et %%PLAYER_JS%%."""
import pathlib

D = pathlib.Path(__file__).parent


def apply(html):
    head = (D / "player_head.js").read_text()
    css = (D / "player.css").read_text()
    # le script d'en-tête (classes admin/embed/rec sur <html>) s'insère en fermant puis rouvrant le <style>
    return (html.replace("%%PLAYER_CSS%%", f"</style><script>{head}</script><style>\n{css}")
            .replace("%%PLAYER_CONTROLS%%", (D / "player_controls.html").read_text())
            .replace("%%PLAYER_JS%%", (D / "player.js").read_text()))
