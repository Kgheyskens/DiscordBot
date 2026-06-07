const { SlashCommandBuilder } = require('discord.js');
const { getCountingSaves } = require('../../lib/countingSavesService');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('saves')
		.setDescription('Bekijk hoeveel counting saves je hebt'),
	async execute(interaction) {
		const saves = getCountingSaves(interaction.guildId, interaction.user.id);
		await interaction.reply({
			content: `Je hebt **${saves}** counting save${saves === 1 ? '' : 's'}. Een save wordt automatisch gebruikt als je een fout maakt in counting. Koop saves via /shop → Kroontjes of /crownshop.`,
			flags: 64,
		});
	},
};
