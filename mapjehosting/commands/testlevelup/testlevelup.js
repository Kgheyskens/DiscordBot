const path = require('path');
const { ChannelType, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const { readJson, writeJson } = require('../../lib/jsonStore');

const levelsChannelFile = path.join(__dirname, '..', '..', 'data', 'levelsChannel.json');
const rewardsFile = path.join(__dirname, '..', '..', 'data', 'roleRewards.json');

async function resolveLevelsChannel(guild) {
	const allLevelChannels = readJson(levelsChannelFile, {});
	const configuredChannelId = allLevelChannels[guild.id]?.channelId;

	if (configuredChannelId) {
		const configuredChannel = guild.channels.cache.get(configuredChannelId) || await guild.channels.fetch(configuredChannelId).catch(() => null);
		if (configuredChannel && configuredChannel.isTextBased()) {
			return configuredChannel;
		}
	}

	let levelsChannel = guild.channels.cache.find(channel => channel.name === 'levels' && channel.isTextBased());
	if (levelsChannel) {
		allLevelChannels[guild.id] = { channelId: levelsChannel.id };
		writeJson(levelsChannelFile, allLevelChannels);
		return levelsChannel;
	}

	const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
	if (!botMember?.permissions?.has(PermissionFlagsBits.ManageChannels)) {
		return null;
	}

	try {
		levelsChannel = await guild.channels.create({
			name: 'levels',
			type: ChannelType.GuildText,
			reason: 'Level-up announcements channel',
		});
		allLevelChannels[guild.id] = { channelId: levelsChannel.id };
		writeJson(levelsChannelFile, allLevelChannels);
		return levelsChannel;
	} catch {
		return null;
	}
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('testlevelup')
		.setDescription('Stuurt een test level-up bericht naar het levels-kanaal')
		.addIntegerOption(option =>
			option
				.setName('level')
				.setDescription('Level om te testen')
				.setRequired(true))
		.addUserOption(option =>
			option
				.setName('user')
				.setDescription('Gebruiker die in het bericht genoemd wordt')
				.setRequired(false)),
	async execute(interaction) {
		if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
			await interaction.reply({ content: 'Alleen administrators kunnen dit doen.', flags: 64 });
			return;
		}

		const targetUser = interaction.options.getUser('user') || interaction.user;
		const level = interaction.options.getInteger('level');
		const levelsChannel = await resolveLevelsChannel(interaction.guild);

		if (!levelsChannel) {
			await interaction.reply({ content: 'Kon geen levels-kanaal vinden of aanmaken.', flags: 64 });
			return;
		}

		const allRewards = readJson(rewardsFile, {});
		const guildRewards = allRewards[interaction.guildId] || [];
		const rewardMessages = guildRewards
			.filter(reward => reward.level <= level)
			.map(reward => interaction.guild.roles.cache.get(reward.roleId)?.name)
			.filter(Boolean);

		const levelUpEmbed = new EmbedBuilder()
			.setColor(0xff0000)
			.setTitle('Level up')
			.setDescription(`Gefeliciteerd ${targetUser.username}, je hebt level ${level} bereikt.`)
			.setFooter({ text: 'Level systeem' });

		if (rewardMessages.length) {
			levelUpEmbed.addFields({
				name: 'Ontvangen rollen',
				value: rewardMessages.map(roleName => `- ${roleName}`).join('\n'),
			});
		}

		await levelsChannel.send({ content: `<@${targetUser.id}>`, embeds: [levelUpEmbed] }).catch(err => {
			console.error('Failed to send test level-up message:', err);
		});

		await interaction.reply({ content: `Test level-up bericht verstuurd naar ${levelsChannel}.`, flags: 64 });
	},
};
