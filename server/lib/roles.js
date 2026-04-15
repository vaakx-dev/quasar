/**
 * Roles singleton class.
 * Manages role data and file I/O.
 * @module server/lib/roles
 */

const fs = require("fs");
const path = require("path");

const ROLES_FILE = path.join(process.cwd(), "data", "roles.json");

/**
 * Manages roles data with singleton pattern.
 * Provides role lookup, member management, and rank queries.
 * Default roles: owner, admin, mod, vip.
 */
class Roles {
	constructor() {
		if (Roles._instance) return Roles._instance;
		this._path = ROLES_FILE;
		this._data = null;
		Roles._instance = this;
	}

	/**
	 * Get roles data, loading from file if needed.
	 * @returns {Object} Roles data containing version and roles array
	 */
	get data() {
		if (!this._data) this._load();
		return this._data;
	}

	/**
	 * Get roles array from data.
	 * @returns {Array<Object>} Roles array with name and members properties
	 */
	get roles() { return this.data.roles; }

	/**
	 * Get player's role name.
	 * @param {string} name - Player name to look up
	 * @returns {string|null} Role name if player is a member, null otherwise
	 */
	get(name) {
		for (const role of this.roles) {
			if (role.members?.includes(name)) {
				return role.name;
			}
		}
		return null;
	}

	/**
	 * Add player to role.
	 * @param {string} name - Player name to add
	 * @param {string} role - Role name to add player to
	 */
	add(name, role) {
		const r = this.roles.find(x => x.name === role);
		if (!r) return;
		if (r.members.includes(name)) return;
		r.members.push(name);
		this._save();
	}

	/**
	 * Remove player from role.
	 * @param {string} name - Player name to remove
	 * @param {string} role - Role name to remove player from
	 */
	remove(name, role) {
		const r = this.roles.find(x => x.name === role);
		if (!r) return;
		const i = r.members.indexOf(name);
		if (i === -1) return;
		r.members.splice(i, 1);
		this._save();
	}

	/**
	 * Get role level (0=owner, higher index = lower privilege).
	 * @param {string} role - Role name to look up
	 * @returns {number} Role level index, or -1 if role not found
	 */
	level(role) {
		const i = this.roles.findIndex(r => r.name === role);
		return i === -1 ? -1 : i;
	}

	/**
	 * Get player's role level (highest privilege if multiple roles).
	 * @param {string} name - Player name to look up
	 * @returns {number} Role level index, or -1 if player has no role
	 */
	rank(name) {
		let highest = -1;
		for (const role of this.roles) {
			if (role.members?.includes(name)) {
				const lvl = this.level(role.name);
				if (lvl !== -1 && (highest === -1 || lvl < highest)) {
					highest = lvl;
				}
			}
		}
		return highest;
	}

	/**
	 * Load roles from file or create default.
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
	 * Create default roles file.
	 * @private
	 */
	_createDefault() {
		this._data = {
			version: 1,
			roles: [
				{ name: "owner", members: [] },
				{ name: "admin", members: [] },
				{ name: "mod", members: [] }
			]
		};
		this._save();
	}

	/**
	 * Save roles to file.
	 * @private
	 */
	_save() {
		fs.writeFileSync(this._path, JSON.stringify(this._data, null, 2), "utf8");
	}
}

module.exports = new Roles();
