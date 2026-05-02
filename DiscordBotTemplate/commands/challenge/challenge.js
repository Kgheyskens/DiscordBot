const {
	EmbedBuilder,
	PermissionFlagsBits,
	SlashCommandBuilder,
} = require('discord.js');
const { getSettings, setChallenge } = require('../../lib/guildSettings');
const challengeService = require('../../lib/challengeService');

function buildChallengeEmbed(state) {
	return new EmbedBuilder()
		.setColor(0xb40f0f)
		.setTitle('🧩 Daily Challenge')
		.setDescription(`**${state.question}**\n\nEerste die het juiste antwoord typt in dit kanaal wint kroontjes!`)
		.setFooter({ text: `Datum: ${state.date}` });
}

module.exports = {
	buildChallengeEmbed,
	data: new SlashCommandBuilder()
		.setName('challenge')
		.setDescription('Beheer de daily challenge puzzels')
		.addSubcommand(sub =>
			sub.setName('add')
				.setDescription('Voeg een puzzel toe aan de pool (admin)')
				.addStringOption(opt => opt.setName('vraag').setDescription('De puzzelvraag').setRequired(true))
				.addStringOption(opt => opt.setName('antwoord').setDescription('Het juiste antwoord').setRequired(true)))
		.addSubcommand(sub =>
			sub.setName('remove')
				.setDescription('Verwijder een eigen puzzel (admin)')
				.addIntegerOption(opt => opt.setName('index').setDescription('Index uit /challenge list').setMinValue(1).setRequired(true)))
		.addSubcommand(sub => sub.setName('list').setDescription('Bekijk eigen puzzels'))
		.addSubcommand(sub => sub.setName('force').setDescription('Post nu een challenge in het challenge-kanaal (admin)')),
	async execute(interaction) {
		const sub = interaction.options.getSubcommand();
		const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);

		if (sub === 'list') {
			const settings = getSettings(interaction.guildId);
			const puzzles = settings.challenge?.customPuzzles || [];
			if (puzzles.length === 0) {
				await interaction.reply({ content: 'Geen eigen puzzels. Gebruik `/challenge add`.', flags: 64 });
				return;
			}
			const lines = puzzles.map((p, i) => `**${i + 1}.** ${p.question} → \`${p.answer}\``);
			await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xb40f0f).setTitle('Eigen puzzels').setDescription(lines.join('\n'))], flags: 64 });
			return;
		}

		if (sub === 'add') {
			if (!isAdmin) {
				await interaction.reply({ content: 'Alleen admins.', flags: 64 });
				return;
			}
			const question = interaction.options.getString('vraag').trim();
			const answer = interaction.options.getString('antwoord').trim();
			if (!question || !answer) {
				await interaction.reply({ content: 'Vraag en antwoord zijn beide verplicht.', flags: 64 });
				return;
			}
			const settings = getSettings(interaction.guildId);
			const list = [...(settings.challenge?.customPuzzles || []), { question, answer }];
			setChallenge(interaction.guildId, { customPuzzles: list });
			await interaction.reply({ content: `Puzzel toegevoegd (${list.length} totaal).`, flags: 64 });
			return;
		}

		if (sub === 'remove') {
			if (!isAdmin) {
				await interaction.reply({ content: 'Alleen admins.', flags: 64 });
				return;
			}
			const index = interaction.options.getInteger('index') - 1;
			const settings = getSettings(interaction.guildId);
			const list = [...(settings.challenge?.customPuzzles || [])];
			if (index < 0 || index >= list.length) {
				await interaction.reply({ content: 'Ongeldige index.', flags: 64 });
				return;
			}
			const [removed] = list.splice(index, 1);
			setChallenge(interaction.guildId, { customPuzzles: list });
			await interaction.reply({ content: `Verwijderd: "${removed.question}"`, flags: 64 });
			return;
		}

		if (sub === 'force') {
			if (!isAdmin) {
				await interaction.reply({ content: 'Alleen admins.', flags: 64 });
				return;
			}
			const settings = getSettings(interaction.guildId);
			const channelId = settings.channels?.challenge;
			if (!channelId) {
				await interaction.reply({ content: 'Geen challenge-kanaal ingesteld. Gebruik `/setup` → Challenge.', flags: 64 });
				return;
			}
			const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
			if (!channel?.isTextBased()) {
				await interaction.reply({ content: 'Het challenge-kanaal is niet (meer) beschikbaar.', flags: 64 });
				return;
			}

			const existing = challengeService.getActive(interaction.guildId);
			if (existing && !existing.solved && existing.date === challengeService.todayKey()) {
				await interaction.reply({ content: 'Er loopt al een challenge vandaag.', flags: 64 });
				return;
			}

			const state = challengeService.startChallenge(interaction.guildId, channelId);
			if (!state) {
				await interaction.reply({ content: 'Geen puzzels in de pool.', flags: 64 });
				return;
			}
			const sent = await channel.send({ embeds: [buildChallengeEmbed(state)] }).catch(() => null);
			if (sent) challengeService.attachMessage(interaction.guildId, sent.id);
			await interaction.reply({ content: 'Challenge gepost.', flags: 64 });
		}
	},
};
