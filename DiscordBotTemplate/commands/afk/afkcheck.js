const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { getAfk, formatDuration } = require('../../lib/afkService');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('afkcheck')
		.setDescription('Bekijk hoe lang iemand al AFK is')
		.addUserOption(opt => opt.setName('user').setDescription('Welke gebruiker').setRequired(true)),
	async execute(interaction) {
		const target = interaction.options.getUser('user');
		const entry = getAfk(interaction.guildId, target.id);
		if (!entry) {
			await interaction.reply({ content: `${target} is niet AFK.`, flags: 64 });
			return;
		}
		const since = Date.now() - entry.since;
		const embed = new EmbedBuilder()
			.setColor(0xb40f0f)
			.setTitle(`${target.username} is AFK`)
			.addFields(
				{ name: 'Reden', value: entry.reason, inline: false },
				{ name: 'AFK sinds', value: `<t:${Math.floor(entry.since / 1000)}:R> (${formatDuration(since)})`, inline: false },
			);
		await interaction.reply({ embeds: [embed] });
	},
};
