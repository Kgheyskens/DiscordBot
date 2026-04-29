const path = require('path');
const { PermissionFlagsBits } = require('discord.js');
const { readJson, writeJson } = require('./jsonStore');

const restrictionsFile = path.join(__dirname, '..', 'data', 'commandRestrictions.json');

const ALWAYS_ALLOWED_COMMANDS = new Set([
	'setup',
	'restrict',
	'setup-channel',
	'setup-role',
	'setup-economy',
	'setup-welcome',
]);

const DEFAULT_RULE = {
	mode: 'anywhere',
	allowedChannels: [],
	blockedChannels: [],
	allowedRoles: [],
	adminOnly: false,
};

function readAll() {
	return readJson(restrictionsFile, {});
}

function writeAll(data) {
	writeJson(restrictionsFile, data);
}

function getRule(guildId, commandName) {
	if (!guildId || !commandName) return { ...DEFAULT_RULE };
	const all = readAll();
	const rule = all[guildId]?.[commandName];
	return { ...DEFAULT_RULE, ...(rule || {}) };
}

function setRule(guildId, commandName, partial) {
	const all = readAll();
	const guild = all[guildId] || {};
	const current = { ...DEFAULT_RULE, ...(guild[commandName] || {}) };
	const next = { ...current, ...partial };
	if (Array.isArray(next.allowedChannels)) next.allowedChannels = [...new Set(next.allowedChannels)];
	if (Array.isArray(next.blockedChannels)) next.blockedChannels = [...new Set(next.blockedChannels)];
	if (Array.isArray(next.allowedRoles)) next.allowedRoles = [...new Set(next.allowedRoles)];
	guild[commandName] = next;
	all[guildId] = guild;
	writeAll(all);
	return next;
}

function clearRule(guildId, commandName) {
	const all = readAll();
	if (all[guildId]) {
		delete all[guildId][commandName];
		writeAll(all);
	}
}

function listRules(guildId) {
	const all = readAll();
	return all[guildId] || {};
}

function isAdmin(interaction) {
	return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
}

function checkCommandAllowed(interaction, commandName) {
	if (ALWAYS_ALLOWED_COMMANDS.has(commandName)) {
		return { allowed: true };
	}

	if (!interaction.guildId) {
		return { allowed: true };
	}

	const rule = getRule(interaction.guildId, commandName);

	if (rule.adminOnly && !isAdmin(interaction)) {
		return { allowed: false, reason: 'Dit command is alleen voor admins.' };
	}

	if (rule.allowedRoles.length > 0 && !isAdmin(interaction)) {
		const memberRoles = interaction.member?.roles?.cache;
		const hasRole = memberRoles
			? rule.allowedRoles.some(roleId => memberRoles.has(roleId))
			: false;
		if (!hasRole) {
			return { allowed: false, reason: 'Je hebt niet de juiste rol om dit command te gebruiken.' };
		}
	}

	const channelId = interaction.channelId;
	if (rule.mode === 'allowlist' && rule.allowedChannels.length > 0) {
		if (!rule.allowedChannels.includes(channelId)) {
			const mentions = rule.allowedChannels.map(id => `<#${id}>`).join(', ');
			return { allowed: false, reason: `Dit command werkt alleen in: ${mentions}.` };
		}
	} else if (rule.mode === 'blocklist' && rule.blockedChannels.includes(channelId)) {
		return { allowed: false, reason: 'Dit command is geblokkeerd in dit kanaal.' };
	}

	return { allowed: true };
}

module.exports = {
	restrictionsFile,
	DEFAULT_RULE,
	ALWAYS_ALLOWED_COMMANDS,
	getRule,
	setRule,
	clearRule,
	listRules,
	checkCommandAllowed,
};
