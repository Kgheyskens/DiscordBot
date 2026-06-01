const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const BOT_TOKEN = process.env.CLIENT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const deploy = async () => {
    const commands = [];
    const foldersPath = path.join(__dirname, '../commands');
    const commandFolders = fs.readdirSync(foldersPath);

    for (const folder of commandFolders) {
        const commandsPath = path.join(foldersPath, folder);
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);
            if ('data' in command && 'execute' in command) {
                commands.push(command.data.toJSON());
            } else {
                console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
            }
        }
    }

    const rest = new REST().setToken(BOT_TOKEN);

    // Bepaal welke guilds direct geüpdatet moeten worden (instant zichtbaar).
    // DEV_GUILD_IDS is een komma-separated lijst. Voor backwards compat ook GUILD_ID.
    const devGuildIds = (process.env.DEV_GUILD_IDS || process.env.GUILD_ID || '')
        .split(',')
        .map(id => id.trim())
        .filter(Boolean);

    (async () => {
        try {
            // 1) Altijd globaal deployen — werkt voor elke server waar de bot in zit
            //    (Discord cache kan tot 1 uur duren om dit overal te tonen)
            console.log(`Globally refreshing ${commands.length} application (/) commands...`);
            const globalData = await rest.put(
                Routes.applicationCommands(CLIENT_ID),
                { body: commands },
            );
            console.log(`✅ Globally reloaded ${globalData.length} application (/) commands.`);

            // 2) Voor de servers in DEV_GUILD_IDS doen we ook een guild-deploy
            //    Die verschijnt METEEN — handig om te testen zonder te wachten.
            for (const guildId of devGuildIds) {
                try {
                    const guildData = await rest.put(
                        Routes.applicationGuildCommands(CLIENT_ID, guildId),
                        { body: commands },
                    );
                    console.log(`✅ Guild-deploy: ${guildData.length} commands in guild ${guildId}.`);
                } catch (err) {
                    console.error(`❌ Guild-deploy mislukt voor guild ${guildId}:`, err.message || err);
                }
            }
        } catch (error) {
            console.error('Deploy failed:', error);
        }
    })();
}

module.exports = deploy;
