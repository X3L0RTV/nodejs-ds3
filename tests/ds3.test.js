// Tests des quatre tâches, sur un port libre sans arrêter le serveur de travail.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { once } = require('node:events');

process.env.PORT = '0';
const root = path.join(__dirname, '..');
const logPath = path.join(root, 'data', 'logs.txt');
const originalLogs = fs.readFileSync(logPath, 'utf8');
const originalUsers = fs.readFileSync(path.join(root, 'config', 'users.json'), 'utf8');
require('../app');
const server = require('../server');

test('DS3 : blocage, historique, actions et sessions', async () => {
    try {
        if (!server.listening) await once(server, 'listening');
        const base = `http://127.0.0.1:${server.address().port}`;
        async function request(route, options = {}) {
            const response = await fetch(base + route, { redirect: 'manual', ...options });
            return {
                status: response.status,
                location: response.headers.get('location'),
                cookie: response.headers.get('set-cookie'),
                body: await response.text()
            };
        }
        function login(email, password) {
            return request('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ email, password }).toString()
            });
        }

        // Session obligatoire et refus des identifiants inconnus.
        assert.equal((await request('/dashboard')).location, '/login?error=session');
        assert.equal((await request('/dashboard?session=inconnue')).location, '/login?error=session');
        assert.equal((await request('/action/d')).location, '/login?error=session');
        const julie = await login('julie@example.com', '123456');
        assert.equal(julie.status, 302);
        assert.equal(julie.cookie, null);
        const sessionId = new URL(julie.location, base).searchParams.get('session');
        assert.ok(sessionId);
        const dashboard = await request(julie.location);
        assert.equal(dashboard.status, 200);
        assert.match(dashboard.body, /Bienvenue julie@example.com/);
        assert.ok(dashboard.body.includes(`/action/d?session=${sessionId}`));
        const secondLogin = await login('julie@example.com', '123456');
        assert.notEqual(secondLogin.location, julie.location);
        assert.equal((await request(julie.location)).status, 200);

        // Trois échecs de Jean ; son bon mot de passe est ensuite refusé.
        for (let i = 1; i <= 3; i++) {
            const result = await login('jean@example.com', 'incorrect');
            assert.equal(result.location, i === 3 ? '/login?error=locked' : '/login?error=1');
        }
        assert.equal((await login('jean@example.com', 'azerty')).location, '/login?error=locked');
        assert.equal((await request('/login?error=locked')).status, 200);
        assert.match((await request('/login?error=locked')).body, /Compte bloqué/);
        assert.equal((await login('julie@example.com', '123456')).status, 302);

        // Compteurs et redirections conservant la session.
        const statsRoute = `/stats?session=${sessionId}`;
        assert.match((await request(statsRoute)).body, /Nombre total d'actions : 0/);
        for (const action of ['a', 'b', 'c', 'd', 'd']) {
            const response = await request(`/action/${action}?session=${sessionId}`);
            assert.equal(response.status, 302);
            assert.equal(response.location, julie.location);
        }
        const stats = await request(statsRoute);
        assert.match(stats.body, /Nombre total d'actions : 5/);
        assert.match(stats.body, /Action A : 1/);
        assert.match(stats.body, /Action B : 1/);
        assert.match(stats.body, /Action C : 1/);
        assert.match(stats.body, /Action D : 2/);
        assert.equal((await request(`/action/z?session=${sessionId}`)).status, 404);
        assert.match((await request(statsRoute)).body, /Nombre total d'actions : 5/);

        // Attendre les écritures asynchrones réelles avant d'inspecter les logs.
        let newLogs = '';
        for (let i = 0; i < 50; i++) {
            newLogs = fs.readFileSync(logPath, 'utf8').slice(originalLogs.length);
            if ((newLogs.match(/action:triggered/g) || []).length === 5) break;
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        assert.equal((newLogs.match(/auth:locked - jean@example.com/g) || []).length, 1);
        assert.equal((newLogs.match(/auth:failure - jean@example.com/g) || []).length, 3);
        assert.match(newLogs, /session:created - julie@example.com/);
        assert.match(newLogs, /session:invalid/);
        assert.equal((newLogs.match(/action:triggered/g) || []).length, 5);
        assert.ok(!newLogs.includes(sessionId));
        assert.ok(!newLogs.includes('azerty'));
        assert.ok(!newLogs.includes('123456'));

        // Historique : email complet, cas vide et utilisateur inconnu.
        const history = await request('/historique?email=julie%40example.com');
        assert.equal(history.status, 200);
        assert.ok(history.body.split('\n').every(line => line.split(' - ')[1] === 'julie@example.com'));
        assert.match(history.body, /action:triggered/);
        assert.match(history.body, /session:created/);
        for (const route of ['/historique', '/historique?email=', '/historique?email=%20']) {
            assert.equal((await request(route)).status, 400);
        }
        assert.equal((await request('/historique?email=example.com')).body, 'Aucun historique pour cet email.');
        assert.equal((await request('/historique?email=inconnu%40example.test')).body, 'Aucun historique pour cet email.');
        assert.equal((await request('/logs')).status, 200);
        assert.equal(fs.readFileSync(path.join(root, 'config', 'users.json'), 'utf8'), originalUsers);
    } finally {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
    }
});
