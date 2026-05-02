const {
	ActionRowBuilder,
	ChannelType,
	EmbedBuilder,
	ModalBuilder,
	PermissionFlagsBits,
	SlashCommandBuilder,
	TextInputBuilder,
	TextInputStyle,
} = require('discord.js');

function formatBody(raw) {
	if (!raw) return '';
	const replaced = raw.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
	const lines = replaced.split('\n');
	const out = [];
	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed === '---') { out.push('━━━━━━━━━━━━━━━'); continue; }
		const heading = trimmed.match(/^(#{1,3})\s+(.*)$/);
		if (heading) { out.push(`__**${heading[2]}**__`); continue; }
		const num = trimmed.match(/^(\d+)[\.\)]\s+(.*)$/);
		if (num) { out.push(`**${num[1]}.** ${num[2]}`); continue; }
		const bullet = trimmed.match(/^[-*•]\s+(.*)$/);
		if (bullet) { out.push(`• ${bullet[1]}`); continue; }
		out.push(line);
	}
	return out.join('\n');
}

module.exports = {
	formatBody,
	data: new SlashCommandBuilder()
		.setName('redembed')
		.setDescription('Plaats een rode embed (met opmaak en lijsten)')
		.addChannelOption(opt => opt.setName('channel').setDescription('Kanaal (default: huidige)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(false))
		.addStringOption(opt => opt.setName('messageid').setDescription('ID om bestaande embed te bewerken').setRequired(false)),
	async execute(interaction) {
		if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
			await interaction.reply({ content: 'Je hebt Manage Messages nodig om dit te doen.', flags: 64 });
			return;
		}

		const channel = interaction.options.getChannel('channel') || interaction.channel;
		const messageId = interaction.options.getString('messageid') || '';

		const modal = new ModalBuilder()
			.setCustomId(`redembed:submit:${channel.id}:${messageId}`)
			.setTitle('Rode embed opstellen');

		modal.addComponents(
			new ActionRowBuilder().addComponents(
				new TextInputBuilder().setCustomId('title').setLabel('Titel').setStyle(TextInputStyle.Short).setMaxLength(256).setRequired(true),
			),
			new ActionRowBuilder().addComponents(
				new TextInputBuilder().setCustomId('body').setLabel('Inhoud (nieuwe regels + lijsten)')
					.setStyle(TextInputStyle.Paragraph).setMaxLength(4000).setRequired(true)
					.setPlaceholder('# Kop\n1. Eerste regel\n2. Tweede regel\n- Bullet\n---\nGewone tekst.'),
			),
			new ActionRowBuilder().addComponents(
				new TextInputBuilder().setCustomId('footer').setLabel('Footer (optioneel)').setStyle(TextInputStyle.Short).setMaxLength(2048).setRequired(false),
			),
			new ActionRowBuilder().addComponents(
				new TextInputBuilder().setCustomId('color').setLabel('Hex kleur (optioneel, default b40f0f)').setStyle(TextInputStyle.Short).setMaxLength(7).setRequired(false),
			),
		);
		await interaction.showModal(modal);
	},
	async handleModal(interaction) {
		const parts = interaction.customId.split(':');
		const channelId = parts[2];
		const messageId = parts[3] || '';
		const title = interaction.fields.getTextInputValue('title');
		const body = interaction.fields.getTextInputValue('body');
		const footer = interaction.fields.getTextInputValue('footer');
		const colorRaw = (interaction.fields.getTextInputValue('color') || 'b40f0f').replace('#', '').trim();
		const color = parseInt(colorRaw, 16) || 0xb40f0f;

		const description = formatBody(body).slice(0, 4000);

		const embed = new EmbedBuilder().setColor(color).setTitle(title).setDescription(description);
		if (footer) embed.setFooter({ text: footer });

		const channel = interaction.guild.channels.cache.get(channelId)
			|| await interaction.guild.channels.fetch(channelId).catch(() => null);
		if (!channel?.isTextBased()) {
			await interaction.reply({ content: 'Kanaal niet gevonden of niet text-based.', flags: 64 });
			return;
		}

		if (messageId) {
			const target = await channel.messages.fetch(messageId).catch(() => null);
			if (!target) {
				await interaction.reply({ content: 'Bericht niet gevonden in dat kanaal.', flags: 64 });
				return;
			}
			await target.edit({ embeds: [embed] }).catch(() => null);
			await interaction.reply({ content: `Embed bijgewerkt in <#${channel.id}>.`, flags: 64 });
			return;
		}

		const sent = await channel.send({ embeds: [embed] }).catch(() => null);
		if (!sent) {
			await interaction.reply({ content: 'Kon embed niet plaatsen (permissies?).', flags: 64 });
			return;
		}
		await interaction.reply({ content: `Embed geplaatst in <#${channel.id}> (ID: \`${sent.id}\`).`, flags: 64 });
	},
};
