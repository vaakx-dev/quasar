// bus.js - Simple shared event bus
const EventEmitter = require('events');
const bus = new EventEmitter();

module.exports = { bus };
