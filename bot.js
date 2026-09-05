require('dotenv').config();
const express = require('express');
const client = require('./src/config/client');

// Express keepalive server
const app = express();
app.get('/', (req, res) => res.send('ONE PEACE ROLEPLAY Bot is Online!'));
app.listen(3000, () => console.log('Server Ready'));

// Register all event handlers
require('./src/events/ready')(client);
require('./src/events/guildMemberAdd')(client);
require('./src/events/messageCreate')(client);
require('./src/events/interactionCreate')(client);

// Login
client.login(process.env.DISCORD_TOKEN);
