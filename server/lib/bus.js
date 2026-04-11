/**
 * Shared event bus for cross-component communication.
 * Use this instead of direct references between sibling components.
 *
 * @module server/lib/bus
 *
 * @example
 * // Emit a request
 * bus.emit('player:validate', { name, gameKey });
 *
 * // Listen for responses (scoped by player name)
 * bus.once(`player:validation:${name}`, (result) => { ... });
 *
 * @fires bus#player:validate - Request player validation
 * @fires bus#player:validation:[name] - Validation result for specific player
 * @fires bus#root:send - Send data to root server
 */
const EventEmitter = require("events");

/** @type {EventEmitter} */
const bus = new EventEmitter();

module.exports = { bus };
