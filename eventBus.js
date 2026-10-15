// eventBus.js
// Objectif : centraliser tous les événements custom de l'application
const EventEmitter = require('events');
// On crée un "bus d'événements" partagé dans toute l'application
const eventBus = new EventEmitter();
module.exports = eventBus;
