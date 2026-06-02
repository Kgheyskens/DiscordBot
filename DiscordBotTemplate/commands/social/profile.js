const path = require('path');
const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { getBalance } = require('../../lib/coinService');
const { readJson } = require('../../lib/jsonStore');

const coinsFile = path.join(__dirname, '..', '..', 'data', 'coins.json');
const levelsFile = path.join(__dirname, '..', '..', 'data', 'levels.json');
const crownsFile = path.join(__dirname, '..', '..', 'data', 'crowns.json');
const minigamesFile = path.join(__dirname, '..', '..', 'data', 'minigames.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('profile')
		.setDescription('View your or someone else\'s profile')
		.addUserOption(opt => opt.setName('user').setDescription('Which user\'s profile to view')),
	async execute(interaction) {
		const targetUser = interaction.options.getUser('user') || interaction.user;
		const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

		if (!member) {
			await interaction.reply({ content: '❌ Member not found.', flags: 64 });
			return;
		}

		const coins = getBalance(coinsFile, interaction.guildId, targetUser.id);
		const crowns = getBalance(crownsFile, interaction.guildId, targetUser.id) || 0;

		const levelsData = readJson(levelsFile, {});
		const userLevel = levelsData[interaction.guildId]?.[targetUser.id] || { level: 0, xp: 0 };
		const nextLevelXp = 50 + (userLevel.level * 50);
		const xpPercent = Math.round((userLevel.xp / nextLevelXp) * 100);

		const minigamesData = readJson(minigamesFile, {});
		const guildMinigames = minigamesData[interaction.guildId] || {};
		let totalWins = 0;
		let winsBreakdown = [];
		for (const [game, state] of Object.entries(guildMinigames)) {
			if (state && typeof state === 'object' && state.winners) {
				const userWins = state.winners?.[targetUser.id] || 0;
				if (userWins > 0) {
					totalWins += userWins;
					winsBreakdown.push(`${game}: ${userWins}`);
				}
			}
		}

		const joinDate = member.joinedAt ? member.joinedAt.toLocaleDateString() : 'Unknown';
		const topRole = member.roles.highest.name !== '@everyone' ? member.roles.highest.name : 'None';

		const embed = new EmbedBuilder()
			.setAuthor({
				name: targetUser.username,
				iconURL: targetUser.displayAvatarURL(),
			})
			.setColor(member.displayColor || 0xb40f0f)
			.setThumbnail(targetUser.displayAvatarURL())
			.addFields(
				{ name: '🎮 Level', value: `**${userLevel.level}** (${userLevel.xp}/${nextLevelXp} XP · ${xpPercent}%)`, inline: true },
				{ name: '💰 Balance', value: `**${coins}** coins`, inline: true },
				{ name: '👑 Crowns', value: `**${crowns}**`, inline: true },
				{ name: '🏆 Minigame Wins', value: `**${totalWins}** ${winsBreakdown.length > 0 ? `\n${winsBreakdown.join(', ')}` : '(none yet)'}`, inline: false },
				{ name: '📅 Join Date', value: joinDate, inline: true },
				{ name: '👥 Top Role', value: topRole, inline: true },
			)
			.setTimestamp();

		await interaction.reply({ embeds: [embed] });
	},
};
