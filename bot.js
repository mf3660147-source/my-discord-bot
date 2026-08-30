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

client.on('guildMemberAdd', async (member) => {
    try {
        const roleId = '1542503336484413460';
        const role = member.guild.roles.cache.get(roleId);
        if (role) await member.roles.add(role);
    } catch (err) {
        console.error(err);
    }
});

const BANNER_IMAGE = 'https://googleusercontent.com'; 

const CATEGORIES = {
    FRP: '1543445649520070787',
    GANG_FRP: '1543445685066666115',
    HELP: '1543449176476745910',
    FACTION_APP: '1543445813546451035',
    GANG_APP: '1543445864230555658',
    VIP: '1543445898875371600'
};

client.on('messageCreate', async (message) => {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;

    // 1. Support Panel (FRP, Gang FRP, Help)
    if (message.content === '!setup-support') {
        const embed = new EmbedBuilder().setTitle('Support & FRP Tickets').setImage(BANNER_IMAGE).setColor('#3b82f6');
        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket_frp').setLabel('FRP Ticket').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('ticket_gang_frp').setLabel('Gang FRP Ticket').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('ticket_help').setLabel('Help Support').setStyle(ButtonStyle.Success)
        );
        await message.channel.send({ embeds: [embed], components: [buttons] });
    }

    // 2. Faction Application Panel
    if (message.content === '!setup-faction') {
        const embed = new EmbedBuilder().setTitle('Faction Application').setImage(BANNER_IMAGE).setColor('#8b5cf6');
        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket_faction_app').setLabel('Faction Application').setStyle(ButtonStyle.Primary)
        );
        await message.channel.send({ embeds: [embed], components: [buttons] });
    }

    // 3. Gang Application Panel
    if (message.content === '!setup-gangapp') {
        const embed = new EmbedBuilder().setTitle('Gang Application').setImage(BANNER_IMAGE).setColor('#10b981');
        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket_gang_app').setLabel('Gang Application').setStyle(ButtonStyle.Success)
        );
        await message.channel.send({ embeds: [embed], components: [buttons] });
    }

    // 4. VIP Tickets Panel
    if (message.content === '!setup-vip') {
        const embed = new EmbedBuilder().setTitle('VIP & Donation Ticket').setImage(BANNER_IMAGE).setColor('#ef4444');
        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket_vip').setLabel('VIP Ticket').setStyle(ButtonStyle.Danger)
        );
        await message.channel.send({ embeds: [embed], components: [buttons] });
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    const configMap = {
        'ticket_frp': { name: 'FRP', categoryId: CATEGORIES.FRP },
        'ticket_gang_frp': { name: 'Gang FRP', categoryId: CATEGORIES.GANG_FRP },
        'ticket_help': { name: 'Help', categoryId: CATEGORIES.HELP },
        'ticket_faction_app': { name: 'Faction Application', categoryId: CATEGORIES.FACTION_APP },
        'ticket_gang_app': { name: 'Gang Application', categoryId: CATEGORIES.GANG_APP },
        'ticket_vip': { name: 'VIP', categoryId: CATEGORIES.VIP }
    };

    const selectedConfig = configMap[interaction.customId];

    if (selectedConfig) {
        const ticketNumber = Math.floor(1000 + Math.random() * 9000);
        const channelName = `${selectedConfig.name.toLowerCase().replace(/\s+/g, '-')}-${interaction.user.username}`;

        const channelOptions = {
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
        };

        if (selectedConfig.categoryId && !selectedConfig.categoryId.startsWith('YOUR_')) {
            channelOptions.parent = selectedConfig.categoryId;
        }

        const channel = await interaction.guild.channels.create(channelOptions);

        const ticketEmbed = new EmbedBuilder()
            .setColor('#E6A100')
            .setTitle(`✨ Ticket #${ticketNumber}`)
            .setDescription(`🏷️ **Category:** \`${selectedConfig.name}\`\n👤 **Owner:** <@${interaction.user.id}>\n🛠️ **Status:** \`Not Claimed\`\n\n-------------------------\n📨 **Please describe your issue or details clearly.**\nAttach screenshots or proof if needed.\n-------------------------`)
            .setFooter({ text: 'Our staff will assist shortly' })
            .setTimestamp();

        const controlButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('claim_ticket').setLabel('Claim').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('unclaim_ticket').setLabel('Unclaim').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('close_ticket').setLabel('Close').setStyle(ButtonStyle.Danger)
        );

        await channel.send({
            content: `<@${interaction.user.id}>`,
            embeds: [ticketEmbed],
            components: [controlButtons]
        });

        await interaction.reply({ content: `Your ticket has been created: ${channel}`, ephemeral: true });
    }

    if (interaction.customId === 'claim_ticket') {
        await interaction.reply({ content: `Ticket claimed by <@${interaction.user.id}>!` });
    }

    if (interaction.customId === 'unclaim_ticket') {
        await interaction.reply({ content: `Ticket has been unclaimed!` });
    }

    if (interaction.customId === 'close_ticket') {
        await interaction.reply('Closing this ticket in 5 seconds...');
        setTimeout(() => interaction.channel.delete(), 5000);
    }
});

client.login(process.env.DISCORD_TOKEN);

