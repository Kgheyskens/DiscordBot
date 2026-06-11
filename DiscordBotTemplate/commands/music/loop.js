const { SlashCommandBuilder } = require('discord.js');
const musicService = require('../../lib/musicService');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('loop')
		.setDescription('Stel de herhaalmodus in')
		.addStringOption(opt =>
			opt.setName('modus')
				.setDescription('Wat moet herhaald worden')
				.setRequired(true)
				.addChoices(
					{ name: 'uit', value: 'off' },
					{ name: 'nummer', value: 'track' },
					{ name: 'wachtrij', value: 'queue' },
				)),
	async execute(interaction) {
		if (!musicService.isConnected(interaction.guildId)) {
			await interaction.reply({ content: '❌ Er speelt nu niets.', flags: 64 });
			return;
		}
		const mode = interaction.options.getString('modus');
		musicService.setLoop(interaction.guildId, mode);
		const label = { off: 'uit', track: '🔂 huidig nummer', queue: '🔁 hele wachtrij' }[mode];
		await interaction.reply({ content: `Loop staat nu op **${label}**.` });
	},
};
