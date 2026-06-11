const { SlashCommandBuilder } = require('discord.js');
const musicService = require('../../lib/musicService');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('remove')
		.setDescription('Verwijder een nummer uit de wachtrij')
		.addIntegerOption(opt =>
			opt.setName('positie')
				.setDescription('Positie in de wachtrij (zie /queue)')
				.setMinValue(1)
				.setRequired(true)),
	async execute(interaction) {
		const position = interaction.options.getInteger('positie');
		const removed = musicService.removeAt(interaction.guildId, position);
		if (!removed) {
			await interaction.reply({ content: `❌ Geen nummer op positie ${position}.`, flags: 64 });
			return;
		}
		await interaction.reply({ content: `🗑️ Verwijderd: **${removed.title}**.` });
	},
};
