# Đuro, blokiraj aerodrom!

Humoristična 3D browser igra u stilu Sega Mega Drive-a, po motivima filma *Balkanski špijun* (1984).

Kriminalci beže preko aerodroma. Đura ih hapsi pre nego što se ukrcaju u avion.
Bosove ne može da uhapsi dok je aerodrom otvoren, pa mora da spusti rampe na sva tri izlaza:
**blokira aerodrom**.

## Pokretanje

```sh
npm install
npm run dev      # razvojni server
npm run build    # produkcijski build u dist/
```

## Kontrole

| Taster | Akcija |
| --- | --- |
| WASD / strelice | kretanje |
| Shift | trčanje (troši kondiciju) |
| Space / J | hapšenje |
| E / K | pištaljka (zamrzne kriminalce u blizini) |
| P / Esc | pauza |
| M | zvuk |

Na telefonu se pojavljuju džojstik i dugmad na ekranu.

## Tehnički

- **three.js**. Scena se renderuje u 224 linije, a post-processing šejder kvantizuje boje na
  9-bitnu Mega Drive paletu (3 bita po kanalu, nelinearni DAC nivoi) uz Bayer dithering.
- Svi modeli su proceduralni (kutije i valjci). Nema eksternih asseta osim fontova.
- Zvuk je 2-operatorska FM sinteza kroz Web Audio (u duhu YM2612 čipa). Muzika je u 7/8 ritmu na hidžaz lestvici.
- Kretanje NPC-ova radi preko Dijkstra polja toka na mreži od 0,5 m. Zatvorene rampe menjaju polje.

| Fajl | Sadržaj |
| --- | --- |
| `src/main.js` | petlja igre, stanja, pravila |
| `src/world.js` | terminal, kolizije, polja toka, avioni, rampe |
| `src/entities.js` | Đura, putnici, kriminalci, bosovi |
| `src/levels.js` | nivoi, imena, dosetke |
| `src/models.js` | low-poly modeli |
| `src/render.js` | niska rezolucija i paletni šejder |
| `src/audio.js` | FM sintisajzer i muzika |
| `src/ui.js`, `src/style.css` | HUD, dijalozi, meniji |
