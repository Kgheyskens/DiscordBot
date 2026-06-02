const { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const warningsService = require('../../lib/warningsService');
const { getSettings } = require('../../lib/guildSettings');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('warnings')
		.setDescription('View warnings for a member')
		.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
		.setDMPermission(false)
		.addUserOption(opt => opt.setName('user').setDescription('Member to check (default: yourself)')),
	async execute(interaction) {
		const user = interaction.options.getUser('user') || interaction.user;

		const settings = getSettings(interaction.guildId);
		if (!settings.moderation?.enabled) {
			await interaction.reply({ content: '❌ Moderation system is disabled.', flags: 64 });
			return;
		}

		const warnings = warningsService.getWarnings(interaction.guildId, user.id);

		if (warnings.length === 0) {
			await interaction.reply({
				content: `✅ <@${user.id}> has no warnings.`,
				flags: 64,
			});
			return;
		}

		const lines = warnings.map((w, idx) => {
			const date = new Date(w.warnedAt).toLocaleString();
			return `**#${idx + 1}** — ${w.reason}\n_Warned by <@${w.warnedBy}> on ${date}_`;
		});

		const embed = new EmbedBuilder()
			.setColor(0xff6b6b)
			.setTitle(`⚠️ Warnings for ${user.username}`)
			.setDescription(lines.join('\n\n'))
			.setFooter({ text: `Total: ${warnings.length} warning(s)` });

		await interaction.reply({ embeds: [embed] });
	},
};
