const { PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const { logModAction } = require('../../lib/modService');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('timeout')
		.setDescription('Geef een lid een time-out')
		.setDMPermission(false)
		.addUserOption(opt => opt.setName('user').setDescription('Wie time-out').setRequired(true))
		.addIntegerOption(opt => opt.setName('minuten').setDescription('Hoelang in minuten (0 = opheffen)').setMinValue(0).setMaxValue(40320).setRequired(true))
		.addStringOption(opt => opt.setName('reden').setDescription('Reden').setRequired(false)),
	async execute(interaction) {
		if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
			await interaction.reply({ content: 'Je hebt Moderate Members nodig.', flags: 64 });
			return;
		}
		const target = interaction.options.getUser('user');
		const minutes = interaction.options.getInteger('minuten');
		const reason = interaction.options.getString('reden');
		const member = await interaction.guild.members.fetch(target.id).catch(() => null);
		if (!member) {
			await interaction.reply({ content: 'Lid niet gevonden.', flags: 64 });
			return;
		}
		if (!member.moderatable) {
			await interaction.reply({ content: 'Ik kan dit lid geen time-out geven.', flags: 64 });
			return;
		}
		const ms = minutes * 60_000;
		try {
			await member.timeout(ms || null, reason || `Timeout by ${interaction.user.tag}`);
		} catch (err) {
			console.error('timeout failed:', err);
			await interaction.reply({ content: 'Kon de time-out niet toepassen.', flags: 64 });
			return;
		}
		await interaction.reply({ content: minutes === 0 ? `Time-out voor ${target} opgeheven.` : `${target} heeft ${minutes} minuten time-out.${reason ? ` Reden: ${reason}` : ''}` });
		await logModAction(interaction.guild, { action: minutes === 0 ? 'timeout opgeheven' : `timeout ${minutes}m`, moderator: interaction.user, target, reason });
	},
};
