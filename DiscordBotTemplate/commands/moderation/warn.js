const { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const warningsService = require('../../lib/warningsService');
const { getSettings } = require('../../lib/guildSettings');

async function checkAutoAction(guild, member, warnCount, settings) {
	const escalation = settings.moderation?.warningsEscalation || {
		timeoutAt: 3,
		kickAt: 5,
		banAt: 7,
	};

	const logChannelId = settings.moderation?.logChannelId;
	const logChannel = logChannelId ? await guild.channels.fetch(logChannelId).catch(() => null) : null;

	if (warnCount >= escalation.banAt) {
		try {
			await member.ban({ reason: `Auto-ban: ${warnCount} warnings` });
			if (logChannel) {
				await logChannel.send(
					`🚫 <@${member.id}> was **banned** (auto-action: ${warnCount} warnings)`,
				);
			}
		} catch (err) {
			console.error('Failed to ban member:', err);
		}
	} else if (warnCount >= escalation.kickAt) {
		try {
			await member.kick(`Auto-kick: ${warnCount} warnings`);
			if (logChannel) {
				await logChannel.send(
					`⚠️ <@${member.id}> was **kicked** (auto-action: ${warnCount} warnings)`,
				);
			}
		} catch (err) {
			console.error('Failed to kick member:', err);
		}
	} else if (warnCount >= escalation.timeoutAt) {
		try {
			await member.timeout(3600000, `Auto-timeout: ${warnCount} warnings`);
			if (logChannel) {
				await logChannel.send(
					`⏱️ <@${member.id}> was **timed out** for 1h (auto-action: ${warnCount} warnings)`,
				);
			}
		} catch (err) {
			console.error('Failed to timeout member:', err);
		}
	}
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('warn')
		.setDescription('Warn a member')
		.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
		.setDMPermission(false)
		.addUserOption(opt => opt.setName('user').setDescription('Member to warn').setRequired(true))
		.addStringOption(opt => opt.setName('reason').setDescription('Reason for warning').setMaxLength(200)),
	async execute(interaction) {
		const user = interaction.options.getUser('user');
		const reason = interaction.options.getString('reason') || 'No reason provided';

		if (user.bot) {
			await interaction.reply({ content: '❌ Cannot warn a bot.', flags: 64 });
			return;
		}

		const settings = getSettings(interaction.guildId);
		if (!settings.moderation?.enabled) {
			await interaction.reply({ content: '❌ Moderation system is disabled.', flags: 64 });
			return;
		}

		const warnCount = warningsService.warnUser(interaction.guildId, user.id, reason, interaction.user.id);

		const embed = new EmbedBuilder()
			.setColor(0xff6b6b)
			.setTitle('⚠️ Member Warned')
			.addFields(
				{ name: 'Member', value: `<@${user.id}>`, inline: true },
				{ name: 'Warned by', value: `<@${interaction.user.id}>`, inline: true },
				{ name: 'Reason', value: reason, inline: false },
				{ name: 'Total Warnings', value: `**${warnCount}**`, inline: true },
			);

		// Post to modlog
		const logChannelId = settings.moderation?.logChannelId;
		if (logChannelId) {
			const logChannel = await interaction.guild.channels.fetch(logChannelId).catch(() => null);
			if (logChannel) {
				await logChannel.send({ embeds: [embed] });
			}
		}

		await interaction.reply({ embeds: [embed] });

		// Check auto-actions
		const member = await interaction.guild.members.fetch(user.id).catch(() => null);
		if (member) {
			await checkAutoAction(interaction.guild, member, warnCount, settings);
		}
	},
};
