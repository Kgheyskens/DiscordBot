const { PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const { logModAction } = require('../../lib/modService');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ban')
		.setDescription('Ban een lid uit de server')
		.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
		.setDMPermission(false)
		.addUserOption(opt => opt.setName('user').setDescription('Wie bannen').setRequired(true))
		.addStringOption(opt => opt.setName('reden').setDescription('Reden').setRequired(false))
		.addIntegerOption(opt => opt.setName('delete_dagen').setDescription('Hoeveel dagen aan berichten verwijderen (0-7)').setMinValue(0).setMaxValue(7)),
	async execute(interaction) {
		if (!interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
			await interaction.reply({ content: 'Je hebt Ban Members nodig.', flags: 64 });
			return;
		}
		const target = interaction.options.getUser('user');
		const reason = interaction.options.getString('reden');
		const days = interaction.options.getInteger('delete_dagen') ?? 0;

		try {
			await interaction.guild.bans.create(target.id, {
				reason: reason || `Banned by ${interaction.user.tag}`,
				deleteMessageSeconds: days * 86400,
			});
		} catch (err) {
			console.error('ban failed:', err);
			await interaction.reply({ content: 'Kon dit lid niet bannen (permissies of hiërarchie).', flags: 64 });
			return;
		}
		await interaction.reply({ content: `${target} is gebanned.${reason ? ` Reden: ${reason}` : ''}` });
		await logModAction(interaction.guild, { action: 'ban', moderator: interaction.user, target, reason, extra: days ? `Deleted ${days}d aan berichten.` : null });
	},
}; 