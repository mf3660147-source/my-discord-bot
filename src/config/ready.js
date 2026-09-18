const { SlashCommandBuilder, REST, Routes } = require('discord.js');
const db = require('../config/database');
const { startExpiryWorker } = require('../commands/slash/sampBan');

module.exports = function (client) {
    client.once('ready', async () => {
        console.log(`Logged in as ${client.user.tag}! Bot is ONLINE!`);

        // Test MySQL database connection
        try {
            const [rows] = await db.query('SELECT 1');
            console.log('✅ MySQL Database connected successfully!');
        } catch (dbErr) {
            console.error('❌ MySQL Database connection failed:', dbErr.message);
        }

        startExpiryWorker();

        const commands = [
            new SlashCommandBuilder()
                .setName('attendance-leaderboard')
                .setDescription('Shows the staff attendance leaderboard'),
            new SlashCommandBuilder()
                .setName('sampban')
                .setDescription('Ban a SAMP player through the database')
                .addStringOption(o => o.setName('player').setDescription('Exact in-game username').setRequired(true))
                .addStringOption(o => o.setName('reason').setDescription('Ban reason').setRequired(true))
                .addStringOption(o => o.setName('duration').setDescription('Type duration manually: 30m, 2h, 15d, or permanent').setRequired(true))
                .addStringOption(o => o.setName('ticket').setDescription('Ticket number/reference').setRequired(true)),
            new SlashCommandBuilder()
                .setName('changename')
                .setDescription('Change your own linked in-game name')
                .addStringOption(o => o.setName('new_name').setDescription('New Firstname_Lastname') .setRequired(true)),
            new SlashCommandBuilder()
                .setName('sampunban')
                .setDescription('Remove a SAMP player ban')
                .addStringOption(o => o.setName('player').setDescription('Exact in-game username').setRequired(true))
                .addStringOption(o => o.setName('reason').setDescription('Unban reason').setRequired(false))
        ];

        if (!process.env.GUILD_ID) {
            console.error('❌ GUILD_ID is missing. Add CLIENT_ID and GUILD_ID in Render Environment Variables.');
            return;
        }

        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        try {
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID || client.user.id, process.env.GUILD_ID),
                { body: commands }
            );
            console.log('✅ Guild slash commands registered successfully (custom duration text input enabled)!');
        } catch (error) {
            console.error('Slash Command Error:', error);
        }
    });
};
