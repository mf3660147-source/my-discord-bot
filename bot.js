const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Bot is Live!'));
app.listen(3000, () => console.log('Server Ready'));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

client.on('guildMemberAdd', async (member) => {
    try {
        const roleId = '1542503336484413460'; 
        const role = member.guild.roles.cache.get(roleId);
        if (role) await member.roles.add(role);
    } catch (err) {
        console.error(err);
    }
});

client.login(process.env.DISCORD_TOKEN);
;
;


