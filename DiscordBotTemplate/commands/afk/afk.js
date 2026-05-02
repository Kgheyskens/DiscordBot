const { SlashCommandBuilder } = require('discord.js');
const { setAfk } = require('../../lib/afkService');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('afk')
		.setDescription('Markeer jezelf als AFK')
		.addStringOption(opt => opt.setName('reden').setDescription('Waarom ben je AFK').setRequired(false)),
	async execute(interaction) {
		const reason = interaction.options.getString('reden') || 'AFK';
		setAfk(interaction.guildId, interaction.user.id, reason);
		await interaction.reply({ content: `💤 ${interaction.user} is nu AFK: *${reason}*` });
	},
};
