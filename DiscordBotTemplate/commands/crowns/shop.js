const { SlashCommandBuilder } = require('discord.js');
const shopMenu = require('../../lib/shopMenu');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('shop')
		.setDescription('Open de server shop'),
	async execute(interaction) {
		await interaction.reply({ ...shopMenu.buildHome(interaction), flags: 64 });
	},
};
