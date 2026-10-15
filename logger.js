// TP4 - Étape 2 : écouter les événements et écrire les logs.
const fs = require('fs');
const path = require('path');
const eventBus = require('./eventBus');
const logFilePath = path.join(__dirname, 'data', 'logs.txt');

function writeLog(message) {
    const now = new Date().toISOString();
    const logLine = `[${now}] ${message}\n`;
    fs.appendFile(logFilePath, logLine, (err) => {
        if (err) {
            console.error('Erreur écriture log:', err);
        }
    });
}

eventBus.on('custom:message', (message) => {
    console.log('LOG EVENT:', message);
    writeLog(`custom:message - ${message}`);
});

// Étape 4 : journaliser le démarrage.
eventBus.on('server:start', ({ port }) => {
    console.log(`LOG EVENT: server:start (port ${port})`);
    writeLog(`server:start - port ${port}`);
});

// Étape 6 : journaliser les tentatives et leurs résultats.
eventBus.on('auth:attempt', ({ email, ip }) => {
    writeLog(`auth:attempt - ${email} - ${ip}`);
});
eventBus.on('auth:success', ({ email, ip }) => {
    writeLog(`auth:success - ${email} - ${ip}`);
});
eventBus.on('auth:failure', ({ email, ip }) => {
    writeLog(`auth:failure - ${email} - ${ip}`);
});

// Étape 7 : réagir aux boutons du dashboard.
eventBus.on('action:triggered', ({ action, ip, email }) => {
    console.log(`ACTION ${action} déclenchée depuis ${ip}`);
    writeLog(`action:triggered - ${email} - ${ip} - action ${action}`);
});

eventBus.on('auth:locked', ({ email, ip }) => {
    console.log(`Compte ${email} verrouillé depuis ${ip}`);
    writeLog(`auth:locked - ${email} - ${ip}`);
});

// DS3 - Tâche 4 : tracer les sessions sans écrire leur identifiant dans les logs.
eventBus.on('session:created', ({ email, ip }) => {
    console.log(`Session créée pour ${email}`);
    writeLog(`session:created - ${email} - ${ip}`);
});
eventBus.on('session:invalid', ({ ip }) => {
    writeLog(`session:invalid - ${ip}`);
});
    
