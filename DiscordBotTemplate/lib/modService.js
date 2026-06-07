const { EmbedBuilder } = require('discord.js');
const { getSettings } = require('./guildSettings');

async function logModAction(guild, { action, moderator, target, reason, extra }) {
	const settings = getSettings(guild.id);
	const channelId = settings.moderation?.logChannelId || settings.channels?.modlog;
	if (!channelId) return;
	const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
	if (!channel?.isTextBased()) return;

	const embed = new EmbedBuilder()
		.setColor(0xb40f0f)
		.setTitle(`Mod actie: ${action}`)
		.addFields(
			{ name: 'Doelwit', value: target ? `${target} (${target.id})` : '_onbekend_', inline: true },
			{ name: 'Moderator', value: `${moderator} (${moderator.id})`, inline: true },
			{ name: 'Reden', value: reason || '_geen reden opgegeven_', inline: false },
		)
		.setTimestamp(new Date());
	if (extra) embed.addFields({ name: 'Extra', value: extra });

	await channel.send({ embeds: [embed] }).catch(() => null);
}

module.exports = { logModAction };
