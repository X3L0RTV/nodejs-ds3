// DS3 - Tâche 3 : compter les actions en mémoire grâce aux événements.
const eventBus = require('./eventBus');

const actionCounts = { A: 0, B: 0, C: 0, D: 0 };

eventBus.on('action:triggered', ({ action }) => {
    if (Object.hasOwn(actionCounts, action)) {
        actionCounts[action]++;
    }
});

function getActionStats() {
    const total = Object.values(actionCounts).reduce((sum, count) => sum + count, 0);
    return { total, counts: { ...actionCounts } };
}

module.exports = { getActionStats };
