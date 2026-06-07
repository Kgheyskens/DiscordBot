const { SlashCommandBuilder } = require('discord.js');
const birthdayService = require('../../lib/birthdayService');

const MONTH_NAMES = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

module.exports = {
	data: new SlashCommandBuilder()
		.setName('birthday')
		.setDescription('Stel je verjaardag in')
		.addIntegerOption(opt =>
			opt.setName('dag')
				.setDescription('Dag van je verjaardag (1-31)')
				.setMinValue(1)
				.setMaxValue(31)
				.setRequired(true))
		.addIntegerOption(opt =>
			opt.setName('maand')
				.setDescription('Maand van je verjaardag')
				.setRequired(true)
				.addChoices(...MONTH_NAMES.map((name, i) => ({ name, value: i + 1 }))))
		.addIntegerOption(opt =>
			opt.setName('jaar')
				.setDescription('Geboortejaar (optioneel — dan wenst de bot je bv. een gelukkige 18e)')
				.setMinValue(1900)
				.setMaxValue(new Date().getFullYear())
				.setRequired(false)),
	async execute(interaction) {
		const day = interaction.options.getInteger('dag');
		const month = interaction.options.getInteger('maand');
		const year = interaction.options.getInteger('jaar');

		if (day > DAYS_IN_MONTH[month - 1]) {
			await interaction.reply({ content: `❌ ${MONTH_NAMES[month - 1]} heeft maar ${DAYS_IN_MONTH[month - 1]} dagen.`, flags: 64 });
			return;
		}

		try {
			birthdayService.setBirthday(interaction.guildId, interaction.user.id, { day, month, year });
			const dateText = `${day} ${MONTH_NAMES[month - 1]}${year ? ` ${year}` : ''}`;
			const ageText = year ? ` Je wordt dit jaar **${new Date().getFullYear() - year}**.` : '';
			await interaction.reply({
				content: `🎂 Je verjaardag is ingesteld op **${dateText}**!${ageText} Op die dag krijg je een felicitatie van de bot.`,
				flags: 64,
			});
		} catch (err) {
			await interaction.reply({ content: `❌ Fout: ${err.message}`, flags: 64 });
		}
	},
};
