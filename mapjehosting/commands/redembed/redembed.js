const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('redembed')
		.setDescription('Sends a red embed')
		.addStringOption(option =>
			option
				.setName('title')
				.setDescription('Embed title')
				.setRequired(false))
		.addStringOption(option =>
			option
				.setName('description')
				.setDescription('Embed description')
				.setRequired(false)),
	async execute(interaction) {
		const title = interaction.options.getString('title') || 'Rode embed';
		const description = interaction.options.getString('description') || 'Dit is een rode embed.';

		const embed = new EmbedBuilder()
			.setColor(0xff0000)
			.setTitle(title)
			.setDescription(description)
			.setFooter({ text: `Aangevraagd door ${interaction.user.tag}` });

		await interaction.reply({ embeds: [embed] });
	},
};