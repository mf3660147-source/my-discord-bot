const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Bot is Live!'));
app.listen(3000, () => console.log('Server Ready'));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}! Bot is ONLINE!`);
});

// Auto Role Assigning
client.on('guildMemberAdd', async (member) => {
    try {
        const roleId = '1542503336484413460';
        const role = member.guild.roles.cache.get(roleId);
        if (role) await member.roles.add(role);
    } catch (err) {
        console.error(err);
    }
});

// Setup Ticket Panel Command (!setup-ticket)
client.on('messageCreate', async (message) => {
    if (message.content === '!setup-ticket') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;

        const button = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('create_ticket')
                .setLabel('📩 Create Ticket')
                .setStyle(ButtonStyle.Primary)
        );

        await message.channel.send({
            content: 'Click the button below to open a support ticket:',
            components: [button]
        });
    }
});

// Ticket Handling System
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'create_ticket') {
        const ticketNumber = Math.floor(1000 + Math.random() * 9000);
        const channelName = `ticket-${ticketNumber}`;

        const channel = await interaction.guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                {
                    id: interaction.guild.id,
                    deny: [PermissionFlagsBits.ViewChannel],
                },
                {
                    id: interaction.user.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                },
            ],
        });

        // Embed Message Creation
        const ticketEmbed = new EmbedBuilder()
            .setColor('#E6A100')
            .setTitle(`✨ Ticket #${ticketNumber}`)
            .setDescription(`🏷️ **Category:** \`HELP\`\n👤 **Owner:** <@${interaction.user.id}>\n🛠️ **Status:** \`Not Claimed\`\n\n-------------------------\n📨 **Please describe your issue clearly**\nAttach screenshots or proof if possible.\n-------------------------`)
            .setFooter({ text: `Our staff will assist shortly` })
            .setTimestamp();

        // Control Buttons
        const buttonsRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('claim_ticket').setLabel('Claim').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('unclaim_ticket').setLabel('Unclaim').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('close_ticket').setLabel('Close').setStyle(ButtonStyle.Danger)
        );

        await channel.send({
            content: `<@${interaction.user.id}>`,
            embeds: [ticketEmbed],
            components: [buttonsRow]
        });

        await interaction.reply({ content: `Your ticket has been created: ${channel}`, ephemeral: true });
    }

    if (interaction.customId === 'claim_ticket') {
        await interaction.reply({ content: `Ticket claimed by <@${interaction.user.id}>!`, ephemeral: false });
    }

    if (interaction.customId === 'unclaim_ticket') {
        await interaction.reply({ content: `Ticket has been unclaimed!`, ephemeral: false });
    }

    if (interaction.customId === 'close_ticket') {
        await interaction.reply('Closing this ticket in 5 seconds...');
        setTimeout(() => interaction.channel.delete(), 5000);
    }
});

client.login(process.env.DISCORD_TOKEN);
