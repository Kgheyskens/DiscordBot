const {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	SlashCommandBuilder,
} = require('discord.js');

const SECTIONS = {
	main: {
		title: 'Bot menu',
		description: 'Een overzicht van alle features. Klik op een categorie voor de bijhorende commands.',
		fields: [
			{ name: 'Categorieën', value: '🛠️ Setup • 🛡️ Administratie • 💰 Economy • 🎮 Minigames • ⭐ Levels & rollen • 🎫 Tickets • 🧰 Misc' },
		],
	},
	setup: {
		title: '🛠️ Setup',
		description: 'Configureer de bot voor je server. Alleen admins.',
		fields: [
			{ name: '/setup', value: 'Volledige configuratie via knoppen: channels, rollen, economy, welcome, counting, tickets, rolcategorieën, minigames, crownshop, restricties.' },
		],
	},
	admin: {
		title: '🛡️ Administratie',
		description: 'Moderatie commands (later toe te voegen): kick, ban, timeout. Voor nu kun je via Discord zelf modereren.',
		fields: [
			{ name: 'Geplande commands', value: '/kick • /ban • /timeout • /afk • /afkcheck' },
			{ name: 'Aanwezig', value: '/restrict — beperk commands tot bepaalde channels of rollen.' },
		],
	},
	economy: {
		title: '💰 Economy',
		description: 'Verdien en spendeer kroontjes.',
		fields: [
			{ name: 'Verdienen', value: '/work • /daily • kroontjes verschijnen ook willekeurig in chat' },
			{ name: 'Spelen', value: '/gamble • /blackjack • /rob • /pay' },
			{ name: 'Stats', value: '/balance • /leaderboard' },
			{ name: 'Shop', value: '/shop view/buy/add/remove • /crownshop buyxp/buysave/saves' },
		],
	},
	minigames: {
		title: '🎮 Minigames',
		description: 'Win kroontjes met puzzels.',
		fields: [
			{ name: 'Spelen', value: '/minigame start <wordle|hangman|minesweeper> • /minigame stop' },
			{ name: 'Hulp', value: '/minigame help <game> — uitleg per game' },
			{ name: 'Tip', value: 'Wordle/Hangman: typ je gok in de chat. Minesweeper: gebruik de knoppen.' },
		],
	},
	levels: {
		title: '⭐ Levels & rollen',
		description: 'XP per bericht, rolbeloningen, rolmenu\'s.',
		fields: [
			{ name: 'Levels', value: '/level — bekijk je niveau • /levelreward • /levelroles • /setlevelchannel' },
			{ name: 'Rolmenu', value: '/rolemenu — klassiek emoji-reaction menu • Rol categorieën via /setup' },
			{ name: 'Crowns', value: '/givexp • /resetxp (admin)' },
		],
	},
	tickets: {
		title: '🎫 Tickets',
		description: 'Open tickets voor support, vragen, sollicitaties etc.',
		fields: [
			{ name: 'Setup', value: 'Plaats het panel via /setup → Tickets → Plaats ticket-panel.' },
			{ name: 'Gebruik', value: 'Klik op een knop in het ticket-panel om een ticket te openen.' },
		],
	},
	misc: {
		title: '🧰 Misc',
		description: 'Extra functies.',
		fields: [
			{ name: 'Memes', value: '/getmeme' },
			{ name: 'Twitch', value: '/twitch — koppel een streamer voor live notifications.' },
			{ name: 'Embeds', value: '/redembed — plaats een rode embed met titel + beschrijving' },
		],
	},
};

function buildEmbed(section) {
	const cfg = SECTIONS[section] || SECTIONS.main;
	const embed = new EmbedBuilder()
		.setColor(0xb40f0f)
		.setTitle(cfg.title)
		.setDescription(cfg.description);
	if (cfg.fields?.length) embed.addFields(cfg.fields);
	return embed;
}

function buildButtons(active) {
	const make = (id, label) => new ButtonBuilder()
		.setCustomId(`menu:${id}`)
		.setLabel(label)
		.setStyle(active === id ? ButtonStyle.Danger : ButtonStyle.Secondary);
	return [
		new ActionRowBuilder().addComponents(
			make('main', 'Overzicht'),
			make('setup', '🛠️ Setup'),
			make('admin', '🛡️ Administratie'),
			make('economy', '💰 Economy'),
			make('minigames', '🎮 Minigames'),
		),
		new ActionRowBuilder().addComponents(
			make('levels', '⭐ Levels'),
			make('tickets', '🎫 Tickets'),
			make('misc', '🧰 Misc'),
		),
	];
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('menu')
		.setDescription('Overzicht van alle bot commands per categorie')
		.setDMPermission(false),
	async execute(interaction) {
		await interaction.reply({
			embeds: [buildEmbed('main')],
			components: buildButtons('main'),
			flags: 64,
		});
	},
	buildEmbed,
	buildButtons,
	SECTIONS,
};
