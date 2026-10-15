# DS3 - Application événementielle Node.js

Ce projet reprend le TP4 avec les quatre fonctionnalités du DS3.
Il utilise uniquement les modules intégrés de Node.js, sans framework ni base de données.

## Démarrer

Avec Node.js installé, ouvrir un terminal dans ce dossier :

```bash
npm start
```

Ouvrir http://localhost:3000/login.

Comptes de démonstration du TP :
- jean@example.com : azerty
- julie@example.com : 123456

## Fonctionnalités

1. Trois échecs pour un email bloquent les connexions suivantes. Le troisième échec déclenche `auth:locked`.
2. `/historique?email=jean%40example.com` affiche les lignes correspondant exactement à cet email.
3. Le dashboard propose les actions A, B, C et D. Le lien Statistiques affiche leur total et leur répartition.
4. Une connexion réussie crée une session associée à l'email. L'identifiant est transmis dans les liens avec le paramètre `session`, sans cookie ni JWT. Un accès au dashboard sans session valide est refusé.

Les compteurs, blocages et sessions sont en mémoire et disparaissent au redémarrage.
Les événements restent enregistrés dans `data/logs.txt`, consultable via `/logs`.
Les mots de passe et les identifiants de session ne sont pas écrits dans ce fichier.
Utiliser les liens du dashboard pour conserver la session.

## Organisation

- `app.js` : charge le logger et le serveur.
- `server.js` : routes, connexion, blocage et affichage des pages.
- `eventBus.js` : bus partagé des événements.
- `logger.js` : écoute les événements et écrit les logs avec leur date réelle.
- `actions.js` : compte les actions en mémoire.
- `auth.js` : crée et retrouve les sessions en mémoire.
- `config/users.json` : comptes de test du professeur.
- `public/` : formulaire et dashboard.
- `data/logs.txt` : journal des événements.
- `captures/` : six captures du démarrage, du dashboard, des statistiques, du blocage et des historiques.

## Vérifications

```bash
npm test
```

Les tests utilisent un port libre, vérifient les quatre tâches et ajoutent leurs événements réels dans les logs. Ils n'arrêtent pas un serveur déjà ouvert.

## Démonstration et captures pour le rendu

1. Démarrer avec `npm start` et capturer le terminal.
2. Se connecter avec Julie et capturer le dashboard avec son email.
3. Cliquer sur A, B, C et D, puis capturer les statistiques.
4. Ouvrir une autre page de connexion et saisir trois fois un mauvais mot de passe pour Jean. Essayer ensuite son bon mot de passe : la connexion reste bloquée. Capturer le message et la ligne `auth:locked` dans les logs.
5. Capturer l'historique de Jean ou de Julie et les événements dans `/logs`.
6. Pour montrer la protection des sessions, ouvrir `/dashboard` sans paramètre : retour à la connexion avec un message d'erreur.

Déposer le lien du dépôt Git public (consigne Teams) ou une archive ZIP du projet, avec les logs remplis et les captures. Ne pas partager une URL de session comme lien du rendu.
