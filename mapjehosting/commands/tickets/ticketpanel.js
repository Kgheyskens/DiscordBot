const path = require('path');
const {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ChannelType,
	EmbedBuilder,
	PermissionFlagsBits,
	SlashCommandBuilder,
} = require('discord.js');
const { readJson, writeJson } = require('../../lib/jsonStore');

const ticketPanelsFile = path.join(__dirname, '..', '..', 'data', 'ticketPanels.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ticketpanel')
		.setDescription('Plaats een ticket paneel')
		.addChannelOption(option =>
			option
				.setName('channel')
				.setDescription('Kanaal waar het ticketpaneel komt')
				.addChannelTypes(ChannelType.GuildText)
				.setRequired(true))
		.addChannelOption(option =>
			option
				.setName('category')
				.setDescription('Categorie waar tickets in komen')
				.addChannelTypes(ChannelType.GuildCategory)
				.setRequired(false))
		.addRoleOption(option =>
			option
				.setName('supportrole')
				.setDescription('Rol die toegang krijgt tot tickets')
				.setRequired(false)),
	async execute(interaction) {
		if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
			await interaction.reply({ content: 'Alleen administrators kunnen dit doen.', flags: 64 });
			return;
		}

		const channel = interaction.options.getChannel('channel');
		const category = interaction.options.getChannel('category');
		const supportRole = interaction.options.getRole('supportrole');

		if (!channel?.isTextBased()) {
			await interaction.reply({ content: 'Kies een tekstkanaal.', flags: 64 });
			return;
		}

		const panelEmbed = new EmbedBuilder()
			.setColor(0xb40f0f)
			.setTitle('Ticket paneel')
			.setDescription('Kies hieronder waarvoor je een ticket wilt openen.');

		const buttons = new ActionRowBuilder().addComponents(
			new ButtonBuilder().setCustomId('ticketpanel:partnerships').setLabel('partnerships').setStyle(ButtonStyle.Danger),
			new ButtonBuilder().setCustomId('ticketpanel:vragen').setLabel('vragen').setStyle(ButtonStyle.Danger),
			new ButtonBuilder().setCustomId('ticketpanel:twitch_promotie').setLabel('twitch promotie').setStyle(ButtonStyle.Danger),
			new ButtonBuilder().setCustomId('ticketpanel:sollicitaties').setLabel('sollicitaties').setStyle(ButtonStyle.Danger),
		);

		const sentMessage = await channel.send({ embeds: [panelEmbed], components: [buttons] });
		const allPanels = readJson(ticketPanelsFile, {});
		allPanels[interaction.guildId] = {
			channelId: channel.id,
			messageId: sentMessage.id,
			categoryId: category?.id || null,
			supportRoleId: supportRole?.id || null,
		};
		writeJson(ticketPanelsFile, allPanels);

		await interaction.reply({ content: `Ticketpaneel geplaatst in ${channel}.`, flags: 64 });
	},
};