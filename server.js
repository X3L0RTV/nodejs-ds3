// TP4 - Étapes 3 à 8 : serveur HTTP et émission des événements.
const http = require('http');
const fs = require('fs');
const path = require('path');
const eventBus = require('./eventBus');
const { getActionStats } = require('./actions');
const { createSession, getSession } = require('./auth');

// Étape 5 : lire et envoyer un fichier HTML.
function serveFile(res, filePath, contentType = 'text/html; charset=utf-8', values = {}) {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Erreur serveur');
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        // Remplacer uniquement les marqueurs prévus dans les pages HTML.
        const html = data.toString().replace(/\{\{(\w+)\}\}/g, (_, key) => escapeHtml(values[key] ?? ''));
        res.end(html);
    });
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
}

function sessionUrl(pathname, sessionId) {
    return `${pathname}?session=${encodeURIComponent(sessionId)}`;
}

// Étape 6 : rediriger le navigateur avec un statut HTTP 302.
function redirect(res, location) {
    res.writeHead(302, { Location: location });
    res.end();
}

function loadUsers() {
    const usersPath = path.join(__dirname, 'config', 'users.json');
    const fileContent = fs.readFileSync(usersPath, 'utf-8');
    return JSON.parse(fileContent);
}

function isValidLogin(email, password, users) {
    return users.some((u) => u.email === email && u.password === password);
}

const failedAttempts = Object.create(null);

const server = http.createServer((req, res) => {
    console.log('Nouvelle requête reçue');
    // Ne pas afficher les identifiants de session dans les traces.
    const requestUrl = new URL(req.url, 'http://localhost');
    console.log('URL:', requestUrl.pathname);
    console.log('Méthode:', req.method);

    // Séparer le chemin des paramètres pour servir aussi /login?error=1.
    const pathname = requestUrl.pathname;

    // Tâche 4 : vérifier la session avant l'accès aux pages et actions protégées.
    const sessionId = requestUrl.searchParams.get('session');
    const session = getSession(sessionId);
    const protectedRoute = pathname === '/dashboard' || pathname === '/stats'
        || /^\/action\/[abcd]$/.test(pathname);
    if (protectedRoute && !session) {
        eventBus.emit('session:invalid', { ip: req.socket.remoteAddress });
        redirect(res, '/login?error=session');
        return;
    }

    // Étape 6 : recevoir le formulaire par morceaux, puis le traiter.
    if (req.method === 'POST' && pathname === '/login') {
        let body = '';
        req.on('data', (chunk) => {
            body += chunk.toString();
        });
        req.on('error', (err) => {
            eventBus.emit('request:error', { message: err.message });
            if (!res.headersSent && !res.destroyed) {
                res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Erreur lors de la réception des données');
            }
        });
        req.on('end', () => {
            const params = new URLSearchParams(body);
            const email = params.get('email');
            const password = params.get('password');
            const ip = req.socket.remoteAddress;
            eventBus.emit('auth:attempt', { email, ip });
            const users = loadUsers();

            if (failedAttempts[email] >= 3) {
                console.log(`Compte bloqué pour ${email} après 3 échecs`);
                redirect(res, '/login?error=locked');
                return;
            }

            if (isValidLogin(email, password, users)) {
                eventBus.emit('auth:success', { email, ip });
                const newSessionId = createSession(email);
                eventBus.emit('session:created', { email, ip });
                redirect(res, sessionUrl('/dashboard', newSessionId));
            } else {
                if (!failedAttempts[email]) {
                    failedAttempts[email] = 0;
                }
                failedAttempts[email]++;
                console.log(`Échecs pour ${email}: ${failedAttempts[email]}`);
                eventBus.emit('auth:failure', { email, ip });
                // Signaler le blocage une seule fois, au troisième échec.
                if (failedAttempts[email] === 3) {
                    eventBus.emit('auth:locked', { email, ip });
                    redirect(res, '/login?error=locked');
                    return;
                }
                redirect(res, '/login?error=1');
            }
        });
        return;
    }

    // Étape 5 : servir les deux pages HTML.
    if (req.method === 'GET' && pathname === '/login') {
        const messages = {
            '1': 'Email ou mot de passe incorrect.',
            locked: 'Compte bloqué après trois échecs de connexion.',
            session: 'Session absente ou invalide. Connectez-vous.'
        };
        const error = requestUrl.searchParams.get('error');
        const message = Object.hasOwn(messages, error) ? messages[error] : '';
        serveFile(res, path.join(__dirname, 'public', 'login.html'), undefined, { message });
        return;
    }
    if (req.method === 'GET' && pathname === '/dashboard') {
        serveFile(res, path.join(__dirname, 'public', 'dashboard.html'), undefined, {
            email: session.email,
            session: sessionId,
            historyUrl: `/historique?email=${encodeURIComponent(session.email)}`
        });
        return;
    }

    // Étape 7 : chaque action émet un événement, puis redirige.
    if (req.method === 'GET' && pathname === '/action/a') {
        const ip = req.socket.remoteAddress;
        eventBus.emit('action:triggered', { action: 'A', ip, email: session.email });
        redirect(res, sessionUrl('/dashboard', sessionId));
        return;
    }
    if (req.method === 'GET' && pathname === '/action/b') {
        const ip = req.socket.remoteAddress;
        eventBus.emit('action:triggered', { action: 'B', ip, email: session.email });
        redirect(res, sessionUrl('/dashboard', sessionId));
        return;
    }
    if (req.method === 'GET' && pathname === '/action/c') {
        const ip = req.socket.remoteAddress;
        eventBus.emit('action:triggered', { action: 'C', ip, email: session.email });
        redirect(res, sessionUrl('/dashboard', sessionId));
        return;
    }

    // DS3 - Tâche 3 : nouvelle action, journalisée comme les actions A/B/C.
    if (req.method === 'GET' && pathname === '/action/d') {
        const ip = req.socket.remoteAddress;
        eventBus.emit('action:triggered', { action: 'D', ip, email: session.email });
        redirect(res, sessionUrl('/dashboard', sessionId));
        return;
    }

    // DS3 - Tâche 3 : statistiques en HTML, sans API JSON.
    if (req.method === 'GET' && pathname === '/stats') {
        const { total, counts } = getActionStats();
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Statistiques des actions</title></head>
<body>
    <h1>Statistiques des actions</h1>
    <p>Nombre total d'actions : ${total}</p>
    <ul>
        <li>Action A : ${counts.A}</li>
        <li>Action B : ${counts.B}</li>
        <li>Action C : ${counts.C}</li>
        <li>Action D : ${counts.D}</li>
    </ul>
    <p>Les compteurs sont remis à zéro au redémarrage du serveur.</p>
    <a href="${escapeHtml(sessionUrl('/dashboard', sessionId))}">Retour au dashboard</a>
</body>
</html>`);
        return;
    }

    // Étape 8 : consulter les logs en texte brut.
    if (req.method === 'GET' && pathname === '/logs') {
        const logPath = path.join(__dirname, 'data', 'logs.txt');
        fs.readFile(logPath, 'utf-8', (err, content) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Impossible de lire le fichier de logs');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(content);
        });
        return;
    }

    // Étape 8 : consulter les logs en texte brut.
    if (req.method === 'GET' && pathname === '/historique') {
        const url = new URL(req.url, 'http://localhost');
        const email = url.searchParams.get('email');
        const logPath = path.join(__dirname, 'data', 'logs.txt');

        if (email === null || email.trim() === '') {
            res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Email requis');
            return;
        }

        fs.readFile(logPath, 'utf-8', (err, content) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Impossible de lire le fichier de logs');
                return;
            }
            // Comparer le champ email complet, pas une partie de la ligne.
            // Format des logs : [date] événement - email - IP.
            const historique = content
                .split(/\r?\n/)
                .filter(line => line.split(' - ')[1] === email.trim())
                .join('\n');
            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(historique || 'Aucun historique pour cet email.');
        });
        return;
    }

    // Étape 3 : routes initiales et réponse 404.
    if (pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>Accueil</h1>');
    } else if (pathname === '/about') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>À propos</h1>');
    } else {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>Page non trouvée</h1>');
    }
});

// Étape 4 : le démarrage déclenche aussi un événement personnalisé.
// PORT permet aux tests de choisir un port libre ; usage normal : 3000.
const PORT = Number(process.env.PORT ?? 3000);
server.listen(PORT, () => {
    const port = server.address().port;
    console.log(`Serveur démarré sur le port ${port}`);
    eventBus.emit('server:start', { port });
});

module.exports = server;
