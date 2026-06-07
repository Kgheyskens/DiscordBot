const { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const warningsService = require('../../lib/warningsService');
const { getSettings } = require('../../lib/guildSettings');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('clearwarnings')
		.setDescription('Clear all warnings for a member')
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.setDMPermission(false)
		.addUserOption(opt => opt.setName('user').setDescription('Member to clear warnings').setRequired(true)),
	async execute(interaction) {
		const user = interaction.options.getUser('user');

		const settings = getSettings(interaction.guildId);
		if (!settings.moderation?.enabled) {
			await interaction.reply({ content: '❌ Moderation system is disabled.', flags: 64 });
			return;
		}

		const beforeCount = warningsService.getWarningCount(interaction.guildId, user.id);
		warningsService.clearWarnings(interaction.guildId, user.id);

		const embed = new EmbedBuilder()
			.setColor(0x51cf66)
			.setTitle('✅ Warnings Cleared')
			.addFields(
				{ name: 'Member', value: `<@${user.id}>`, inline: true },
				{ name: 'Cleared by', value: `<@${interaction.user.id}>`, inline: true },
				{ name: 'Warnings Removed', value: `**${beforeCount}**`, inline: false },
			);

		// Post to modlog
		const logChannelId = settings.moderation?.logChannelId || settings.channels?.modlog;
		if (logChannelId) {
			const logChannel = await interaction.guild.channels.fetch(logChannelId).catch(() => null);
			if (logChannel) {
				await logChannel.send({ embeds: [embed] });
			}
		}

		await interaction.reply({ embeds: [embed] });
	},
};
