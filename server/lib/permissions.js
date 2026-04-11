/**
 * Permission checking library.
 * Pure functions for role hierarchy, ban checking, and command access.
 * @module server/lib/permissions
 */

/**
 * Get the level of a role (0 = highest/owner).
 * @param {Object} roles - Roles config with roles array
 * @param {string} roleName - Role name to check
 * @returns {number} Role level (0 = highest, -1 = not found)
 */
function getRoleLevel(roles, roleName) {
	if (!roles.roles || !Array.isArray(roles.roles)) return -1;
	const index = roles.roles.findIndex(r => r.name === roleName);
	return index === -1 ? -1 : index;
}

/**
 * Get the role level of a player.
 * Returns highest role (lowest index) if player has multiple roles.
 * @param {Object} roles - Roles config
 * @param {string} playerName - Player name
 * @returns {number} Role level (-1 if no role)
 */
function getPlayerRoleLevel(roles, playerName) {
	if (!roles.roles) return -1;

	let highestLevel = -1;
	for (const role of roles.roles) {
		if (role.members?.includes(playerName)) {
			const level = getRoleLevel(roles, role.name);
			if (level !== -1 && (highestLevel === -1 || level < highestLevel)) {
				highestLevel = level;
			}
		}
	}
	return highestLevel;
}

/**
 * Get the role name for a player.
 * @param {Object} roles - Roles config
 * @param {string} playerName - Player name
 * @returns {string|null} Role name or null
 */
function getPlayerRole(roles, playerName) {
	if (!roles.roles) return null;
	for (const role of roles.roles) {
		if (role.members?.includes(playerName)) {
			return role.name;
		}
	}
	return null;
}

/**
 * Check if a name is banned.
 * @param {Object} bans - Bans config
 * @param {string} name - Name to check
 * @returns {boolean}
 */
function isNameBanned(bans, name) {
	return bans?.names?.includes(name) || false;
}

/**
 * Check if an IP is banned.
 * @param {Object} bans - Bans config
 * @param {string} ip - IP address to check
 * @returns {boolean}
 */
function isIpBanned(bans, ip) {
	return bans?.ips?.includes(ip) || false;
}

/**
 * Check if a player is banned (by name OR IP).
 * Returns ban reason if banned.
 * @param {Object} bans - Bans config
 * @param {string} name - Player name
 * @param {string} ip - Player IP
 * @returns {string|undefined} Ban reason or undefined
 */
function isBanned(bans, name, ip) {
	if (isNameBanned(bans, name)) return "Name is banned";
	if (isIpBanned(bans, ip)) return "IP is banned";
	return undefined;
}

/**
 * Check if a player can execute a command.
 * @param {Object} roles - Roles config
 * @param {Object} bans - Bans config
 * @param {string} playerName - Player name
 * @param {Object} command - Command object
 * @param {Object} player - Player object from sim
 * @returns {boolean}
 */
function canExecuteCommand(roles, bans, playerName, command, player) {
	// First check if banned
	const banReason = isBanned(bans, playerName, player?.ip);
	if (banReason) return false;

	// hostOverride: Host can always use this command
	if (command.hostOverride && player?.host) return true;

	// playerOverride: Any active player (not spectator) can use
	if (command.playerOverride && player && player.side !== "spectators") return true;

	// Check role requirement
	if (command.requiredRole) {
		const playerLevel = getPlayerRoleLevel(roles, playerName);
		if (playerLevel === -1) return false;

		const requiredLevel = getRoleLevel(roles, command.requiredRole);
		if (requiredLevel === -1) return false;

		// Player's level must be >= required level (lower index = higher)
		return playerLevel <= requiredLevel;
	}

	return true;
}

/**
 * Get all commands a player can access.
 * @param {Object} roles - Roles config
 * @param {Object} bans - Bans config
 * @param {string} playerName - Player name
 * @param {Map} commands - All commands map
 * @param {Object} player - Player object
 * @returns {Array} Array of accessible command names
 */
function getAccessibleCommands(roles, bans, playerName, commands, player) {
	const accessible = [];
	for (const [name, command] of commands) {
		if (canExecuteCommand(roles, bans, playerName, command, player)) {
			accessible.push(name);
		}
	}
	return accessible;
}

/**
 * Check if a player can ban another player.
 * Banner must have higher role level (lower index) than target.
 * @param {Object} roles - Roles config
 * @param {string} bannerName - Name of player doing the banning
 * @param {string} targetName - Name of player to be banned
 * @returns {boolean}
 */
function canBanUser(roles, bannerName, targetName) {
	const bannerLevel = getPlayerRoleLevel(roles, bannerName);
	const targetLevel = getPlayerRoleLevel(roles, targetName);

	// If target has no role, anyone with a role can ban them
	if (targetLevel === -1) return bannerLevel !== -1;
	// Banner must have a role and be higher level (lower index) than target
	return bannerLevel !== -1 && bannerLevel < targetLevel;
}

module.exports = {
	getRoleLevel,
	getPlayerRoleLevel,
	getPlayerRole,
	isNameBanned,
	isIpBanned,
	isBanned,
	canExecuteCommand,
	getAccessibleCommands,
	canBanUser,
};
