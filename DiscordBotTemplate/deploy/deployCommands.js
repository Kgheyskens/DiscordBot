require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

console.log('✅ dotenv loaded');

const BOT_TOKEN = process.env.CLIENT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

console.log('✅ TOKEN:', !!BOT_TOKEN, 'ID:', CLIENT_ID);

function loadCommandPayload() {
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
    return commands;
}

async function deployToGuild(rest, guildId, commands) {
    try {
        const guildData = await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, guildId),
            { body: commands },
        );
        console.log(`Guild-deploy: ${guildData.length} commands in guild ${guildId}.`);
        return true;
    } catch (err) {
        console.error(`Guild-deploy mislukt voor guild ${guildId}:`, err.message || err);
        return false;
    }
}

const deploy = async () => {
    const commands = loadCommandPayload();
    console.log(`📋 Loaded ${commands.length} commands`);

    const rest = new REST().setToken(BOT_TOKEN);

    const devGuildIds = (process.env.DEV_GUILD_IDS || process.env.GUILD_ID || '')
        .split(',')
        .map(id => id.trim())
        .filter(Boolean);

    try {
        console.log(`🚀 Deploying ${commands.length} commands naar ${devGuildIds.length} guild(s)...`);
        for (const guildId of devGuildIds) {
            await deployToGuild(rest, guildId, commands);
        }
        console.log('✅ Deploy complete!');
    } catch (error) {
        console.error('Deploy failed:', error);
    }
    process.exit(0);
}

deploy.deployToGuild = async function (guildId) {
    const commands = loadCommandPayload();
    const rest = new REST().setToken(BOT_TOKEN);
    return deployToGuild(rest, guildId, commands);
};

// Run deploy if called directly
if (require.main === module) {
    deploy();
}

module.exports = deploy;
