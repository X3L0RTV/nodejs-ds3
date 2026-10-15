// DS3 - Tâche 4 : sessions simples, stockées uniquement en mémoire.
const { randomUUID } = require('node:crypto');
const sessions = new Map();

function createSession(email) {
    const sessionId = randomUUID();
    sessions.set(sessionId, { email });
    return sessionId;
}

function getSession(sessionId) {
    return sessions.get(sessionId);
}

module.exports = { createSession, getSession };
