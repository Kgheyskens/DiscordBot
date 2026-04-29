const path = require('path');
const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { transfer, isEconomyEnabled } = require('../../lib/economyService');

const crownsFile = path.join(__dirname, '..', '..', 'data', 'crowns.json');
const crownsConfigFile = path.join(__dirname, '..', '..', 'data', 'crownsConfig.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('pay')
		.setDescription('Stuur kroontjes naar een ander lid')
		.addUserOption(option => option.setName('user').setDescription('Wie krijgt de kroontjes?').setRequired(true))
		.addIntegerOption(option => option.setName('amount').setDescription('Hoeveel kroontjes?').setMinValue(1).setRequired(true)),
	async execute(interaction) {
		if (!isEconomyEnabled(interaction.guildId, crownsConfigFile)) {
			await interaction.reply({ content: 'Het kroontjessysteem staat uit.', flags: 64 });
			return;
		}

		const target = interaction.options.getUser('user');
		const amount = interaction.options.getInteger('amount');

		if (target.bot) {
			await interaction.reply({ content: 'Je kunt geen kroontjes naar een bot sturen.', flags: 64 });
			return;
		}

		const result = transfer({
			crownsFile,
			guildId: interaction.guildId,
			fromUserId: interaction.user.id,
			toUserId: target.id,
			amount,
		});

		if (result.error) {
			await interaction.reply({ content: result.error, flags: 64 });
			return;
		}

		const embed = new EmbedBuilder()
			.setColor(0xb40f0f)
			.setTitle('Overschrijving voltooid')
			.setDescription(`<@${interaction.user.id}> stuurde ${result.amount} kroontjes naar <@${target.id}>.`)
			.addFields(
				{ name: 'Belasting', value: `${result.tax} kroontjes`, inline: true },
				{ name: 'Ontvangen', value: `${result.received} kroontjes`, inline: true },
				{ name: 'Jouw balans', value: `${result.fromBalance}`, inline: true },
			);

		await interaction.reply({ embeds: [embed] });
	},
};
