const path = require('path');
const { readJson, writeJson } = require('./jsonStore');
const { getSettings } = require('./guildSettings');

const colorRolesFile = path.join(__dirname, '..', 'data', 'colorRoles.json');

const COLORS = [
	{ key: 'red', name: 'Rood', hex: 0xE74C3C, emoji: '🔴' },
	{ key: 'orange', name: 'Oranje', hex: 0xE67E22, emoji: '🟠' },
	{ key: 'yellow', name: 'Geel', hex: 0xF1C40F, emoji: '🟡' },
	{ key: 'lime', name: 'Limoen', hex: 0x2ECC71, emoji: '🟢' },
	{ key: 'green', name: 'Groen', hex: 0x1F8B4C, emoji: '🌲' },
	{ key: 'teal', name: 'Teal', hex: 0x1ABC9C, emoji: '🪼' },
	{ key: 'cyan', name: 'Cyaan', hex: 0x3498DB, emoji: '💧' },
	{ key: 'blue', name: 'Blauw', hex: 0x206694, emoji: '🔵' },
	{ key: 'purple', name: 'Paars', hex: 0x9B59B6, emoji: '🟣' },
	{ key: 'magenta', name: 'Magenta', hex: 0xE91E63, emoji: '🩷' },
	{ key: 'pink', name: 'Roze', hex: 0xFF7FA8, emoji: '🌸' },
	{ key: 'white', name: 'Wit', hex: 0xFFFFFF, emoji: '⚪' },
	{ key: 'gray', name: 'Grijs', hex: 0x95A5A6, emoji: '🩶' },
	{ key: 'brown', name: 'Bruin', hex: 0x8B5A2B, emoji: '🟤' },
	{ key: 'black', name: 'Zwart', hex: 0x23272A, emoji: '⚫' },
];

function getColor(key) {
	return COLORS.find(c => c.key === key) || null;
}

function readAll() {
	return readJson(colorRolesFile, {});
}

function writeAll(data) {
	writeJson(colorRolesFile, data);
}

function getGuildData(guildId) {
	const all = readAll();
	return all[guildId] || { roles: {}, users: {} };
}

function getUserColors(guildId, userId) {
	const guildData = getGuildData(guildId);
	return guildData.users[userId] || { owned: [], active: null };
}

function getColorRolePrice(guildId) {
	const settings = getSettings(guildId);
	return settings.crownshop?.colorRolePrice ?? 750;
}

async function ensureColorRole(guild, colorKey) {
	const color = getColor(colorKey);
	if (!color) return null;

	const all = readAll();
	const guildData = all[guild.id] || { roles: {}, users: {} };
	const existingId = guildData.roles[colorKey];

	if (existingId) {
		const existing = guild.roles.cache.get(existingId) || await guild.roles.fetch(existingId).catch(() => null);
		if (existing) return existing;
	}

	const role = await guild.roles.create({
		name: color.name,
		color: color.hex,
		permissions: [],
		mentionable: false,
		reason: 'Shop kleurrol',
	}).catch(err => {
		console.error(`Failed to create color role ${colorKey} in ${guild.id}:`, err.message);
		return null;
	});
	if (!role) return null;

	guildData.roles[colorKey] = role.id;
	all[guild.id] = guildData;
	writeAll(all);
	return role;
}

function ownColor(guildId, userId, colorKey) {
	const all = readAll();
	const guildData = all[guildId] || { roles: {}, users: {} };
	const user = guildData.users[userId] || { owned: [], active: null };
	if (!user.owned.includes(colorKey)) user.owned.push(colorKey);
	guildData.users[userId] = user;
	all[guildId] = guildData;
	writeAll(all);
}

async function activateColor(guild, member, colorKey) {
	const role = await ensureColorRole(guild, colorKey);
	if (!role) return { error: 'Kon de kleurrol niet aanmaken. Heeft de bot Manage Roles?' };

	const all = readAll();
	const guildData = all[guild.id] || { roles: {}, users: {} };
	const user = guildData.users[member.id] || { owned: [], active: null };

	if (user.active && user.active !== colorKey) {
		const oldRoleId = guildData.roles[user.active];
		if (oldRoleId && member.roles.cache.has(oldRoleId)) {
			await member.roles.remove(oldRoleId).catch(() => null);
		}
	}

	const added = await member.roles.add(role).then(() => true).catch(err => {
		console.error(`Failed to add color role ${colorKey} to ${member.id}:`, err.message);
		return false;
	});
	if (!added) return { error: 'Kon de rol niet toekennen. Check de bot-permissies en rol-hiërarchie.' };

	user.active = colorKey;
	if (!user.owned.includes(colorKey)) user.owned.push(colorKey);
	guildData.users[member.id] = user;
	all[guild.id] = guildData;
	writeAll(all);
	return { success: true, role };
}

module.exports = {
	COLORS,
	getColor,
	getUserColors,
	getColorRolePrice,
	ensureColorRole,
	ownColor,
	activateColor,
};
