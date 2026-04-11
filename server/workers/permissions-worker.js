/**
 * Permissions manager worker.
 * Handles file I/O, hot-reloading, and ban checking.
 * @module server/workers/permissions-worker
 */

const fs = require("fs");
const path = require("path");
const { bus } = require("../lib/bus");
const { logger } = require("../lib/logger");
const { isBanned, canBanUser } = require("../lib/permissions");

const ROLES_FILE = path.join(process.cwd(), "data", "roles.json");
const BANS_FILE = path.join(process.cwd(), "data", "bans.json");
const RELOAD_INTERVAL = 30000; // 30 seconds

/**
 * Manages permissions data and hot-reloading.
 * @listens bus#permissions:ban
 * @listens bus#permissions:unban
 * @listens bus#permissions:role
 * @listens bus#permissions:check
 * @fires bus#permissions:reloaded
 * @fires bus#permissions:kick
 */
class PermissionsWorker {
	constructor(config) {
		this.config = config;
		this.roles = null;
		this.bans = null;
		this.rolesStats = null;
		this.bansStats = null;
		this.reloadTimer = null;
		this.stopped = true;

		this._banHandler = (data) => this._handleBan(data);
		this._unbanHandler = (data) => this._handleUnban(data);
		this._roleHandler = (data) => this._handleRoleChange(data);
		this._checkHandler = (request) => this._handleCheck(request);
		this._kickHandler = (data) => this._handleKick(data);
	}

	// === PUBLIC API ===

	/** Start the permissions worker. */
	start() {
		this.stopped = false;
		this._ensureDataDirectory();
		this._loadInitialFiles();
		this._setupBusListeners();
		this._startReloadTimer();

		logger.info("PermissionsWorker started");
	}

	/** Stop the permissions worker. */
	stop() {
		this.stopped = true;
		this._stopReloadTimer();
		this._removeBusListeners();
	}

	/** Get current roles config. @returns {Object} Roles config */
	getRoles() { return this.roles; }

	/** Get current bans config. @returns {Object} Bans config */
	getBans() { return this.bans; }

	// === PRIVATE METHODS ===

	/** @private Create data directory if it doesn't exist. */
	_ensureDataDirectory() {
		const dataDir = path.dirname(ROLES_FILE);
		if (!fs.existsSync(dataDir)) {
			fs.mkdirSync(dataDir, { recursive: true });
		}
	}

	/** @private Load initial permissions from files or create defaults. */
	_loadInitialFiles() {
		// Load or create roles.json
		if (fs.existsSync(ROLES_FILE)) {
			this._reloadRoles();
		} else {
			this._createDefaultRoles();
		}

		// Load or create bans.json
		if (fs.existsSync(BANS_FILE)) {
			this._reloadBans();
		} else {
			this._createDefaultBans();
		}
	}

	/** @private Create default roles file. */
	_createDefaultRoles() {
		const defaultRoles = {
			version: 1,
			roles: [
				{ name: "owner", members: [] },
				{ name: "admin", members: [] },
				{ name: "mod", members: [] },
				{ name: "vip", members: [] }
			]
		};

		this._saveRoles(defaultRoles);
		this.roles = defaultRoles;

		logger.info("Created default roles file", { file: ROLES_FILE });
	}

	/** @private Create default bans file. */
	_createDefaultBans() {
		const defaultBans = {
			version: 1,
			names: [],
			ips: []
		};

		this._saveBans(defaultBans);
		this.bans = defaultBans;

		logger.info("Created default bans file", { file: BANS_FILE });
	}

	/** @private Reload roles from file. */
	_reloadRoles() {
		try {
			const stats = fs.statSync(ROLES_FILE);
			if (this.rolesStats && stats.mtime.getTime() === this.rolesStats.mtime.getTime()) {
				return;
			}

			const data = fs.readFileSync(ROLES_FILE, "utf8");
			this.roles = JSON.parse(data);
			this.rolesStats = stats;

			bus.emit('permissions:reloaded', { type: 'roles' });
			logger.info("Roles reloaded");
		} catch (err) {
			logger.error("Failed to load roles", { error: err.message });
		}
	}

	/** @private Reload bans from file. */
	_reloadBans() {
		try {
			const stats = fs.statSync(BANS_FILE);
			if (this.bansStats && stats.mtime.getTime() === this.bansStats.mtime.getTime()) {
				return;
			}

			const data = fs.readFileSync(BANS_FILE, "utf8");
			this.bans = JSON.parse(data);
			this.bansStats = stats;

			bus.emit('permissions:reloaded', { type: 'bans' });
			logger.info("Bans reloaded");
		} catch (err) {
			logger.error("Failed to load bans", { error: err.message });
		}
	}

	/** @private Save roles to file. */
	_saveRoles(roles) {
		try {
			const data = JSON.stringify(roles, null, 2);
			fs.writeFileSync(ROLES_FILE, data, "utf8");
			this.roles = roles;
			this.rolesStats = fs.statSync(ROLES_FILE);
		} catch (err) {
			logger.error("Failed to save roles", { error: err.message });
		}
	}

	/** @private Save bans to file. */
	_saveBans(bans) {
		try {
			const data = JSON.stringify(bans, null, 2);
			fs.writeFileSync(BANS_FILE, data, "utf8");
			this.bans = bans;
			this.bansStats = fs.statSync(BANS_FILE);
		} catch (err) {
			logger.error("Failed to save bans", { error: err.message });
		}
	}

	/** @private Start periodic file check timer. */
	_startReloadTimer() {
		this.reloadTimer = setInterval(() => {
			this._reloadRoles();
			this._reloadBans();
		}, RELOAD_INTERVAL);
	}

	/** @private Stop reload timer. */
	_stopReloadTimer() {
		if (this.reloadTimer) {
			clearInterval(this.reloadTimer);
			this.reloadTimer = null;
		}
	}

	/** @private Subscribe to bus events. */
	_setupBusListeners() {
		bus.on("permissions:ban", this._banHandler);
		bus.on("permissions:unban", this._unbanHandler);
		bus.on("permissions:role", this._roleHandler);
		bus.on("permissions:check", this._checkHandler);
		bus.on("permissions:kick", this._kickHandler);
	}

	/** @private Unsubscribe from bus events. */
	_removeBusListeners() {
		bus.off("permissions:ban", this._banHandler);
		bus.off("permissions:unban", this._unbanHandler);
		bus.off("permissions:role", this._roleHandler);
		bus.off("permissions:check", this._checkHandler);
		bus.off("permissions:kick", this._kickHandler);
	}

	/** @private Handle ban request. */
	_handleBan(data) {
		if (!this.bans) return;

		const { type, target, reason, bannedBy, targetName } = data;
		const banner = bannedBy;

		// Check role level for name bans
		if (type === 'name' && targetName) {
			if (!canBanUser(this.roles, banner, targetName)) {
				return logger.warn("Ban denied - insufficient permissions", { banner, target: targetName });
			}
		}

		switch (type) {
			case 'name':
				if (this.bans.names.includes(target)) break;
				this.bans.names.push(target);
				this._saveBans(this.bans);
				logger.info("Name banned", { target, by: banner });
				break;
			case 'ip':
				if (this.bans.ips.includes(target)) break;
				this.bans.ips.push(target);
				this._saveBans(this.bans);
				logger.info("IP banned", { target, by: banner });
				break;
		}

		bus.emit('permissions:kick', { target, reason: reason || "Banned" });
	}

	/** @private Handle unban request. */
	_handleUnban(data) {
		if (!this.bans) return;

		const { target } = data;

		const nameIndex = this.bans.names.indexOf(target);
		if (nameIndex !== -1) {
			this.bans.names.splice(nameIndex, 1);
			this._saveBans(this.bans);
			logger.info("Name unbanned", { target, by: data.unbannedBy });
		}

		const ipIndex = this.bans.ips.indexOf(target);
		if (ipIndex !== -1) {
			this.bans.ips.splice(ipIndex, 1);
			this._saveBans(this.bans);
			logger.info("IP unbanned", { target, by: data.unbannedBy });
		}
	}

	/** @private Handle role change request. */
	_handleRoleChange(data) {
		if (!this.roles) return;

		const { action, player, role } = data;
		const roleObj = this.roles.roles.find(r => r.name === role);
		if (!roleObj) return logger.warn("Role not found", { role });

		switch (action) {
			case 'add':
				if (roleObj.members.includes(player)) break;
				roleObj.members.push(player);
				this._saveRoles(this.roles);
				return logger.info("Player added to role", { player, role });
			case 'remove':
				const index = roleObj.members.indexOf(player);
				if (index === -1) break;
				roleObj.members.splice(index, 1);
				this._saveRoles(this.roles);
				return logger.info("Player removed from role", { player, role });
		}
	}

	/** @private Handle ban check request. */
	_handleCheck(request) {
		if (!request.callback) return;

		const banReason = isBanned(this.bans, request.name, request.ip);

		request.callback({
			banned: !!banReason,
			reason: banReason
		});
	}

	/** @private Handle kick request - emit for ClientWorker to handle. */
	_handleKick(data) {
		// This event is listened to by ClientWorker instances
		logger.info("Kick requested", { target: data.target });
	}
}

module.exports = { PermissionsWorker };
