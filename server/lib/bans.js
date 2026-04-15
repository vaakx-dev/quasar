/**
 * Bans singleton class.
 * Manages ban data and file I/O.
 * @module server/lib/bans
 */

const fs = require("fs");
const path = require("path");

const IP_REGEX = /^\d+\.\d+\.\d+\.\d+$/;
const BANS_FILE = path.join(process.cwd(), "data", "bans.json");

/**
 * Manages bans data with singleton pattern.
 * Supports banning by player name or IP address.
 */
class Bans {
	constructor() {
		if (Bans._instance) return Bans._instance;
		this._path = BANS_FILE;
		this._data = null;
		Bans._instance = this;
	}

	/**
	 * Get bans data, loading from file if needed.
	 * @returns {Object} Bans data containing version, names array, and ips array
	 */
	get data() {
		if (!this._data) this._load();
		return this._data;
	}

	/**
	 * Check if value is banned (name or IP).
	 * @param {string} value - Player name or IP address to check
	 * @returns {boolean} True if the value is in the bans list
	 */
	has(value) {
		return this.names.includes(value) || this.ips.includes(value);
	}

	/**
	 * Get banned player names.
	 * @returns {Array<string>} Banned names array
	 */
	get names() { return this.data.names; }

	/**
	 * Get banned IP addresses.
	 * @returns {Array<string>} Banned IPs array
	 */
	get ips() { return this.data.ips; }

	/**
	 * Add a ban entry.
	 * @param {string} value - Player name or IP address to ban
	 * @returns {boolean} True if added, false if already banned
	 */
	add(value) {
		if (IP_REGEX.test(value)) {
			if (this.ips.includes(value)) return false;
			this.ips.push(value);
		} else {
			if (this.names.includes(value)) return false;
			this.names.push(value);
		}
		this._save();
		return true;
	}

	/**
	 * Remove a ban entry.
	 * @param {string} value - Player name or IP address to unban
	 * @returns {boolean} True if removed, false if not found
	 */
	remove(value) {
		let removed = false;
		const nameIndex = this.names.indexOf(value);
		if (nameIndex !== -1) {
			this.names.splice(nameIndex, 1);
			removed = true;
		}
		const ipIndex = this.ips.indexOf(value);
		if (ipIndex !== -1) {
			this.ips.splice(ipIndex, 1);
			removed = true;
		}
		if (removed) this._save();
		return removed;
	}

	/**
	 * Check if value is banned and return reason.
	 * @param {string} value - Player name or IP address to check
	 * @returns {string|undefined} Ban reason message, or undefined if not banned
	 */
	check(value) {
		if (this.names.includes(value)) return "Name is banned";
		if (this.ips.includes(value)) return "IP is banned";
		return undefined;
	}

	/**
	 * Load bans from file or create default.
	 * @private
	 */
	_load() {
		const dataDir = path.dirname(this._path);
		if (!fs.existsSync(dataDir)) {
			fs.mkdirSync(dataDir, { recursive: true });
		}

		if (fs.existsSync(this._path)) {
			try {
				this._data = JSON.parse(fs.readFileSync(this._path, "utf8"));
			} catch (err) {
				this._createDefault();
			}
		} else {
			this._createDefault();
		}
	}

	/**
	 * Create default bans file.
	 * @private
	 */
	_createDefault() {
		this._data = { version: 1, names: [], ips: [] };
		this._save();
	}

	/**
	 * Save bans to file.
	 * @private
	 */
	_save() {
		fs.writeFileSync(this._path, JSON.stringify(this._data, null, 2), "utf8");
	}
}

module.exports = new Bans();
