// Structured logger
const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const LOG_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL] ?? LOG_LEVELS.info;

const logger = {
	_format(level, msg, data) {
		const timestamp = new Date().toISOString();
		const base = `[${timestamp}] [${level.toUpperCase()}] ${msg}`;
		return data ? `${base} ${JSON.stringify(data)}` : base;
	},
	debug(msg, data) {
		if (LOG_LEVEL <= LOG_LEVELS.debug) console.log(this._format("debug", msg, data));
	},
	info(msg, data) {
		if (LOG_LEVEL <= LOG_LEVELS.info) console.log(this._format("info", msg, data));
	},
	warn(msg, data) {
		if (LOG_LEVEL <= LOG_LEVELS.warn) console.warn(this._format("warn", msg, data));
	},
	error(msg, data) {
		if (LOG_LEVEL <= LOG_LEVELS.error) console.error(this._format("error", msg, data));
	},
};

module.exports = { logger };
