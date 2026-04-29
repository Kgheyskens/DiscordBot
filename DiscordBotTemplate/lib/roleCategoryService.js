const path = require('path');
const {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
} = require('discord.js');
const { readJson, writeJson } = require('./jsonStore');

const roleCategoriesFile = path.join(__dirname, '..', 'data', 'roleCategories.json');

function readAll() {
	return readJson(roleCategoriesFile, {});
}

function writeAll(data) {
	writeJson(roleCategoriesFile, data);
}

function generateId() {
	return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

function listCategories(guildId) {
	const all = readAll();
	return all[guildId] || [];
}

function getCategory(guildId, categoryId) {
	return listCategories(guildId).find(cat => cat.id === categoryId) || null;
}

function createCategory(guildId, { name, description = '', exclusive = false }) {
	if (!name || typeof name !== 'string') return { error: 'Naam is verplicht.' };
	const all = readAll();
	const cats = all[guildId] || [];
	const cat = {
		id: generateId(),
		name: name.slice(0, 80),
		description: (description || '').slice(0, 500),
		exclusive: Boolean(exclusive),
		roleIds: [],
		channelId: null,
		messageId: null,
	};
	cats.push(cat);
	all[guildId] = cats;
	writeAll(all);
	return { success: true, category: cat };
}

function updateCategory(guildId, categoryId, patch) {
	const all = readAll();
	const cats = all[guildId] || [];
	const idx = cats.findIndex(c => c.id === categoryId);
	if (idx === -1) return { error: 'Categorie niet gevonden.' };
	const cat = cats[idx];
	if (typeof patch.name === 'string') cat.name = patch.name.slice(0, 80);
	if (typeof patch.description === 'string') cat.description = patch.description.slice(0, 500);
	if (typeof patch.exclusive === 'boolean') cat.exclusive = patch.exclusive;
	if (Array.isArray(patch.roleIds)) cat.roleIds = patch.roleIds.slice(0, 25);
	if (typeof patch.channelId === 'string' || patch.channelId === null) cat.channelId = patch.channelId;
	if (typeof patch.messageId === 'string' || patch.messageId === null) cat.messageId = patch.messageId;
	cats[idx] = cat;
	all[guildId] = cats;
	writeAll(all);
	return { success: true, category: cat };
}

function deleteCategory(guildId, categoryId) {
	const all = readAll();
	const cats = all[guildId] || [];
	const idx = cats.findIndex(c => c.id === categoryId);
	if (idx === -1) return { error: 'Categorie niet gevonden.' };
	const [removed] = cats.splice(idx, 1);
	all[guildId] = cats;
	writeAll(all);
	return { success: true, category: removed };
}

function findCategoryByMessageId(guildId, messageId) {
	return listCategories(guildId).find(c => c.messageId === messageId) || null;
}

function buildCategoryEmbed(guild, category) {
	const embed = new EmbedBuilder()
		.setColor(0xb40f0f)
		.setTitle(category.name)
		.setDescription(category.description || 'Klik op een knop om een rol te krijgen of te verwijderen.');

	const roleLines = category.roleIds.map(roleId => {
		const role = guild.roles.cache.get(roleId);
		return `• ${role ? `<@&${roleId}>` : `_(rol ${roleId} niet gevonden)_`}`;
	});
	if (roleLines.length) {
		embed.addFields({ name: 'Rollen', value: roleLines.join('\n').slice(0, 1000) });
	}
	embed.setFooter({ text: category.exclusive ? 'Je kunt maar 1 rol uit deze categorie kiezen.' : 'Je kunt meerdere rollen kiezen.' });
	return embed;
}

function buildCategoryButtons(guild, category) {
	const rows = [];
	let current = new ActionRowBuilder();
	let count = 0;

	for (const roleId of category.roleIds) {
		const role = guild.roles.cache.get(roleId);
		const label = role?.name?.slice(0, 80) || `Rol ${roleId.slice(0, 6)}`;
		const button = new ButtonBuilder()
			.setCustomId(`rolecat:toggle:${category.id}:${roleId}`)
			.setLabel(label)
			.setStyle(ButtonStyle.Danger);
		current.addComponents(button);
		count += 1;
		if (count % 5 === 0) {
			rows.push(current);
			current = new ActionRowBuilder();
		}
		if (rows.length >= 5) break;
	}
	if (current.components.length > 0 && rows.length < 5) {
		rows.push(current);
	}
	return rows;
}

async function postOrUpdateCategoryMessage(guild, category) {
	if (!category.channelId) return { error: 'Geen kanaal ingesteld voor deze categorie.' };
	if (category.roleIds.length === 0) return { error: 'Voeg eerst rollen toe aan de categorie.' };

	const channel = guild.channels.cache.get(category.channelId)
		|| await guild.channels.fetch(category.channelId).catch(() => null);
	if (!channel?.isTextBased()) return { error: 'Kanaal niet gevonden of niet text-based.' };

	const embed = buildCategoryEmbed(guild, category);
	const components = buildCategoryButtons(guild, category);

	let message = null;
	if (category.messageId) {
		message = await channel.messages.fetch(category.messageId).catch(() => null);
	}
	if (message) {
		await message.edit({ embeds: [embed], components }).catch(() => null);
	} else {
		message = await channel.send({ embeds: [embed], components }).catch(() => null);
		if (!message) return { error: 'Kon bericht niet versturen (permissies?).' };
		updateCategory(guild.id, category.id, { messageId: message.id });
	}
	return { success: true, message };
}

module.exports = {
	roleCategoriesFile,
	listCategories,
	getCategory,
	createCategory,
	updateCategory,
	deleteCategory,
	findCategoryByMessageId,
	buildCategoryEmbed,
	buildCategoryButtons,
	postOrUpdateCategoryMessage,
};
