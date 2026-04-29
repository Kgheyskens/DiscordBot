const path = require('path');
const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { readJson, writeJson } = require('../../lib/jsonStore');

const twitchLinksFile = path.join(__dirname, '..', '..', 'data', 'twitchLinks.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('twitchlink')
		.setDescription('Deel je Twitch-streamlink in het kanaal')
		.addStringOption(option =>
			option
				.setName('link')
				.setDescription('Je Twitch link')
				.setRequired(true))
		.addStringOption(option =>
			option
				.setName('title')
				.setDescription('Titel voor de post')
				.setRequired(false))
		.addStringOption(option =>
			option
				.setName('description')
				.setDescription('Extra info')
				.setRequired(false)),
	async execute(interaction) {
		const link = interaction.options.getString('link');
		const title = interaction.options.getString('title') || 'Twitch stream';
		const description = interaction.options.getString('description') || 'Bekijk deze stream!';

		const embed = new EmbedBuilder()
			.setColor(0xb40f0f)
			.setTitle(title)
			.setDescription(`${description}\n\n${link}`)
			.setFooter({ text: `Gedeeld door ${interaction.user.tag}` });

		const allLinks = readJson(twitchLinksFile, {});
		allLinks[interaction.guildId] = allLinks[interaction.guildId] || {};
		allLinks[interaction.guildId][interaction.user.id] = { link, title, description, timestamp: Date.now() };
		writeJson(twitchLinksFile, allLinks);

		await interaction.reply({ content: `${interaction.user}`, embeds: [embed] });
	},
};