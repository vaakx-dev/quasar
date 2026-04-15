/**
 * Argument validation system for commands.
 * Provides schema-based validation with auto-generated error messages.
 * @module server/lib/args-validator
 */

/**
 * Validate arguments against a command schema.
 * @param {string[]} rawArgs - Raw string arguments from command
 * @param {Object} schema - Command schema definition with args array
 * @param {Object} context - Execution context (sim, player, etc.)
 * @returns {{ valid: boolean, args?: Object, error?: string, usage?: string }}
 */
function validateArgs(rawArgs, schema, context) {
	if (!schema?.args || schema.args.length === 0) return { valid: true, args: {} };

	/** @type {Object} */
	const validatedArgs = {};
	/** @type {string[]} */
	const errors = [];

	let argIndex = 0;

	for (let i = 0; i < schema.args.length; i++) {
		const argDef = schema.args[i];
		const { name, type = 'string', required = true, default: defaultValue, enum: enumValues, description } = argDef;

		// Check if we have remaining args
		const rawValue = rawArgs[argIndex];

		// Handle rest type (captures all remaining args)
		if (type === 'rest') {
			if (rawValue !== undefined) validatedArgs[name] = rawArgs.slice(argIndex);
			else if (required) errors.push(`missing required argument: ${name}`);
			else if (defaultValue !== undefined) validatedArgs[name] = defaultValue;
			break; // rest consumes all remaining
		}

		// Skip if no more args and not required
		if (rawValue === undefined) {
			if (required) errors.push(`missing required argument: ${name}`);
			else if (defaultValue !== undefined) validatedArgs[name] = defaultValue;
			continue;
		}

		argIndex++;

		// Type validation
		let parsedValue = rawValue;
		let valid = true;

		switch (type) {
			case 'number': {
				const num = Number(rawValue);
				if (isNaN(num)) {
					errors.push(`${name} must be a number, got "${rawValue}"`);
					valid = false;
				}
				parsedValue = num;
				break;
			}
			case 'boolean': {
				const lower = rawValue.toLowerCase();
				if (['true', '1', 'yes'].includes(lower)) parsedValue = true;
				else if (['false', '0', 'no'].includes(lower)) parsedValue = false;
				else {
					errors.push(`${name} must be true/false, got "${rawValue}"`);
					valid = false;
				}
				break;
			}
			case 'enum': {
				// Resolve enum values (can be array or function)
				let validEnumValues = enumValues;
				if (typeof enumValues === 'function') validEnumValues = enumValues(context);

				if (!validEnumValues || !validEnumValues.includes(rawValue)) {
					const validList = validEnumValues ? validEnumValues.join('|') : '(no valid values defined)';
					errors.push(`${name} must be one of: ${validList}, got "${rawValue}"`);
					valid = false;
				}
				parsedValue = rawValue;
				break;
			}
			case 'string':
			default:
				parsedValue = rawValue;
				break;
		}

		if (valid) validatedArgs[name] = parsedValue;
	}

	// Check for extra arguments (unless there's a rest arg)
	if (argIndex < rawArgs.length && !schema.args.some(s => s.type === 'rest')) {
		const extras = rawArgs.slice(argIndex).map(a => `"${a}"`).join(', ');
		errors.push(`too many arguments: ${extras}`);
	}

	if (errors.length > 0) {
		return {
			valid: false,
			error: errors.join('; ')
		};
	}

	return { valid: true, args: validatedArgs };
}

/**
 * Generate usage string from schema.
 * @param {string} commandName - Command name with prefix (e.g. ".mode")
 * @param {Object} schema - Command schema definition
 * @returns {string} Usage text
 */
function generateUsage(commandName, schema) {
	if (!schema?.args || schema.args.length === 0) return commandName;

	const parts = [commandName];

	for (const arg of schema.args) {
		const { name, required = true, type, enum: enumValues, description } = arg;
		let part;

		if (type === 'rest') part = required ? `<${name}...>` : `[${name}...]`;
		else if (type === 'enum' && enumValues) {
			// For enum, show the actual values instead of the name
			let values = enumValues;
			if (typeof values === 'function') values = ['<options>'];
			const options = values.join('|');
			part = required ? `<${options}>` : `[${options}]`;
		}
		else part = required ? `<${name}>` : `[${name}]`;

		parts.push(part);
	}

	return parts.join(' ');
}

module.exports = {
	validateArgs,
	generateUsage
};
