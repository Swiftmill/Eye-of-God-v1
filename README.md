# Eye of God – Interface immersive

Cette expérience front-end propose une page d’accueil futuriste autour d’une Terre 3D reliée à des transmissions vidéo.

## Structure

- `index.html` – point d’entrée, structure HTML et overlay vidéo.
- `styles.css` – palette bleu-cyan, styles « hacker chic », responsive + fallback mobile.
- `main.js` – orchestration UI, accessibilité, chargement des JSON et gestion de l’overlay.
- `three/scene.js` – initialisation de Three.js, Terre 3D, nœuds, fils lumineux, post-traitements.
- `animations.js` – animations GSAP (caméra, glitch, labels).
- `videos.json` – sources vidéo locales/externalisées (muted autoplay friendly).
- `whitelist.json` – liste blanche sécurisée pour les redirections « random site ».

## Prérequis

Aucun bundler n’est requis. Un simple serveur HTTP statique suffit (autoplay vidéo nécessite le protocole `http://` ou `https://`).

## Démarrage rapide

```bash
# depuis la racine du projet
python3 -m http.server 8080
```

Ensuite ouvrez [http://localhost:8080](http://localhost:8080) dans votre navigateur.

## Fonctionnalités clés

- Terre 3D rotative avec halo scintillant, étoiles et post-processing (bloom + vignette).
- 12 nœuds interconnectés par des fils pulsants interactifs (hover label + zoom caméra à la sélection).
- Overlay vidéo plein écran avec effet glitch, lecture auto (muted) et bouton « go to random site » sécurisé.
- Panneau accessibilité : réduction des animations, mute vidéo, raccourcis clavier (Esc pour fermer, Space/Enter sur fallback mobile).
- Mode « Low Motion » respectant `prefers-reduced-motion` et bouton manuel.
- Fallback mobile : image statique + grille de transmissions cliquables.

## Accessibilité & bonnes pratiques

- Focus management lors de l’ouverture/fermeture de l’overlay.
- Option « Low Motion » + checkbox accessibilité.
- Vidéos muettes par défaut, lecture/pause accessible via bouton.
- Liste blanche strictement respectée pour les redirections externes.

## Personnalisation

- Ajoutez/supprimez des vidéos via `videos.json` (titre, description, URL MP4).
- Modifiez la liste des sites autorisés dans `whitelist.json`.
- Ajustez la palette ou les animations dans `styles.css` / `animations.js`.

## Tests

Chargement testé sur Chrome/Firefox récents. Les textures/procédures sont légères pour de bonnes performances.
