# Klarsti

Klarsti er en gratis, selvstændig hjælpeapp til mennesker med ordblindhed og
talblindhed. Den virker direkte i browseren uden konto, reklamer, analyse eller
server.

## Funktioner

- valg af lokal dansk oplæser, stemmeprøve, hastighed, pause og stop
- fokus på én sætning ad gangen
- diktering, når browseren understøtter det
- valgfri skriftstørrelse, skrifttype, afstand, farver og kontrast
- plus, minus, gange og division med korte mellemtrin
- pladsværdi, brøker, decimaltal og procent
- rabat, byttepenge og tidsforskel
- offlinebrug efter første besøg på en udgivet HTTPS-side

Kun ufølsomme appindstillinger gemmes lokalt. Klarsti gemmer eller uploader
ikke indsat og dikteret tekst. Browserens diktering kan dog bruge en online
taletjeneste fra browser- eller enhedsleverandøren. Klarsti vælger automatisk
en lokal oplæser; en stemme, der er mærket “kan bruge internet”, bruges kun,
hvis du selv vælger den. Det samme gælder en stemme, hvis placering ikke er
oplyst af browseren.

## GitHub Pages

Upload disse filer til roden af et GitHub-lager:

- `index.html`
- `styles.css`
- `math-helpers.js`
- `speech-helpers.js`
- `app.js`
- `manifest.webmanifest`
- `sw.js`
- `icon.svg`
- `icon-192.png`
- `icon-512.png`

Vælg derefter **Settings → Pages → Deploy from a branch → main → /(root)**.

Appen er et hjælpemiddel og ikke en diagnose eller erstatning for faglig støtte.
