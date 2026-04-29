const path = require('path');
const { ChannelType, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const { readJson, writeJson } = require('../../lib/jsonStore');

const reactionRolesFile = path.join(__dirname, '..', '..', 'data', 'reactionRoles.json');

function parseRoleEntries(input) {
	return input
		.split(/\r?\n|,/)
		.map(entry => entry.trim())
		.filter(Boolean)
		.map(entry => {
			const parts = entry.split('|').map(part => part.trim());
			if (parts.length < 2) {
				return null;
			}

			const emoji = parts[0];
			const roleToken = parts[1];
			const label = parts[2] || roleToken;
			const roleId = roleToken.replace(/[<@&>]/g, '');

			return { emoji, roleId, label };
		})
		.filter(Boolean);
}

async function resolveRoleLabels(guild, roles) {
	const resolvedRoles = [];

	for (const roleEntry of roles) {
		const role = guild.roles.cache.get(roleEntry.roleId) || await guild.roles.fetch(roleEntry.roleId).catch(() => null);
		resolvedRoles.push({
			emoji: roleEntry.emoji,
			roleId: roleEntry.roleId,
			label: role?.name || roleEntry.label || roleEntry.roleId,
		});
	}

	return resolvedRoles;
}

function buildReactionRoleEmbed(title, description, roles) {
	const embed = new EmbedBuilder()
		.setColor(0xb40f0f)
		.setTitle(title)
		.setDescription(`${description}\n\nReact met de emoji die bij jouw rol hoort om de rol te krijgen of te verwijderen.`);

	embed.addFields({
		name: 'Rollen',
		value: roles.map(role => `${role.emoji} - ${role.label}`).join('\n').slice(0, 4000),
	});

	return embed;
}

async function postOrEditReactionRoleMessage({ interaction, channel, title, description, roles, messageId }) {
	const allMenus = readJson(reactionRolesFile, {});
	const storedRoles = await resolveRoleLabels(interaction.guild, roles);
	const embed = buildReactionRoleEmbed(title, description, storedRoles);

	let targetMessage = null;
	if (messageId) {
		targetMessage = await channel.messages.fetch(messageId).catch(() => null);
		if (!targetMessage) {
			return { ok: false, error: 'Kon het bestaande bericht niet vinden in dat kanaal.' };
		}

		await targetMessage.edit({ embeds: [embed] }).catch(err => {
			console.error('Failed to edit reaction role message:', err);
			throw err;
		});

		await targetMessage.reactions.removeAll().catch(() => null);
	} else {
		targetMessage = await channel.send({ embeds: [embed] });
	}

	for (const role of storedRoles) {
		await targetMessage.react(role.emoji).catch(err => {
			console.error(`Failed to add reaction ${role.emoji}:`, err);
		});
	}

	allMenus[targetMessage.id] = {
		guildId: interaction.guildId,
		channelId: channel.id,
		messageId: targetMessage.id,
		title,
		description,
		roles: storedRoles,
	};
	writeJson(reactionRolesFile, allMenus);

	return { ok: true, message: targetMessage };
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('rolemenu')
		.setDescription('Maakt of bewerkt een reaction role embed')
		.addChannelOption(option =>
			option
				.setName('channel')
				.setDescription('Kanaal waar het menu komt te staan')
				.addChannelTypes(ChannelType.GuildText)
				.setRequired(true))
		.addStringOption(option =>
			option
				.setName('title')
				.setDescription('Titel van de embed')
				.setRequired(true))
		.addStringOption(option =>
			option
				.setName('description')
				.setDescription('Beschrijving van de embed')
				.setRequired(true))
		.addStringOption(option =>
			option
				.setName('roles')
				.setDescription('Per regel: emoji | @Rol | optionele naam')
				.setRequired(true))
		.addStringOption(option =>
			option
				.setName('messageid')
				.setDescription('Bewerk een bestaand bericht via message ID')
				.setRequired(false)),
	async execute(interaction) {
		if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
			await interaction.reply({ content: 'Je hebt Manage Roles nodig om dit in te stellen.', flags: 64 });
			return;
		}

		const channel = interaction.options.getChannel('channel');
		const title = interaction.options.getString('title');
		const description = interaction.options.getString('description');
		const rolesInput = interaction.options.getString('roles');
		const messageId = interaction.options.getString('messageid');
		const parsedRoles = parseRoleEntries(rolesInput);

		if (!channel || !channel.isTextBased()) {
			await interaction.reply({ content: 'Kies een tekstkanaal.', flags: 64 });
			return;
		}

		if (parsedRoles.length < 1) {
			await interaction.reply({ content: 'Geen geldige rollen gevonden. Gebruik per regel: emoji | @Rol | optionele naam', flags: 64 });
			return;
		}

		if (parsedRoles.length > 20) {
			await interaction.reply({ content: 'Je kunt maximaal 20 reaction roles in één embed zetten.', flags: 64 });
			return;
		}

		try {
			const result = await postOrEditReactionRoleMessage({
				interaction,
				channel,
				title,
				description,
				roles: parsedRoles,
				messageId,
			});

			if (!result.ok) {
				await interaction.reply({ content: result.error, flags: 64 });
				return;
			}

			await interaction.reply({
				content: messageId ? `Reaction role embed ${messageId} is bijgewerkt.` : `Reaction role embed geplaatst in ${channel}.`,
				flags: 64,
			});
		} catch (error) {
			console.error('rolemenu failed:', error);
			await interaction.reply({ content: 'Kon het reaction role menu niet maken of bewerken.', flags: 64 });
		}
	},
};