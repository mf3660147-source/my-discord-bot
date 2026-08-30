const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const express = require('express');
const discordTranscripts = require('discord-html-transcripts');

const app = express();
app.get('/', (req, res) => res.send('ONE PEACE ROLEPLAY Bot is Online!'));
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
        console.error('Auto-role Error:', err);
    }
});

const BANNER_IMAGE = 'https://i.ibb.co/yFZrkrVY/1787815678187.png'; 
const LOG_CHANNEL_ID = 'YOUR_TICKET_LOGS_CHANNEL_ID'; // ⚠️ നിങ്ങളുടെ Staff Ticket Log Channel ID ഇവിടെ കൊടുക്കുക

const CATEGORIES = {
    FRP: '1543445649520070787',
    GANG_FRP: '1543445685066666115',
    HELP: '1543449176476745910',
    FACTION_APP: '1543445813546451035',
    GANG_APP: '1543445864230555658',
    VIP: '1543445898875371600'
};

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    try {
        if (message.content === '!setup-support') {
            const embed = new EmbedBuilder()
                .setTitle('🛡️ ONE PEACE ROLEPLAY - Support Desk')
                .setDescription('Click on the buttons below to open a ticket for general help or FRP reports.')
                .setImage(BANNER_IMAGE)
                .setColor('#3b82f6');

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ticket_frp').setLabel('FRP Ticket').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('ticket_gang_frp').setLabel('Gang FRP Ticket').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('ticket_help').setLabel('Help Support').setStyle(ButtonStyle.Success)
            );
            await message.channel.send({ embeds: [embed], components: [buttons] });
        }

        if (message.content === '!setup-faction') {
            const embed = new EmbedBuilder()
                .setTitle('📋 Faction Application')
                .setDescription('Click the button below to submit your Faction Application.')
                .setImage(BANNER_IMAGE)
                .setColor('#8b5cf6');

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ticket_faction_app').setLabel('Faction Application').setStyle(ButtonStyle.Primary)
            );
            await message.channel.send({ embeds: [embed], components: [buttons] });
        }

        if (message.content === '!setup-gangapp') {
            const embed = new EmbedBuilder()
                .setTitle('💀 Gang Application')
                .setDescription('Click the button below to register your gang.')
                .setImage(BANNER_IMAGE)
                .setColor('#10b981');

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ticket_gang_app').setLabel('Gang Application').setStyle(ButtonStyle.Success)
            );
            await message.channel.send({ embeds: [embed], components: [buttons] });
        }

        if (message.content === '!setup-vip') {
            const embed = new EmbedBuilder()
                .setTitle('👑 VIP & Donation Ticket')
                .setDescription('Click the button below regarding VIP perks, vehicles, or donations.')
                .setImage(BANNER_IMAGE)
                .setColor('#ef4444');

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ticket_vip').setLabel('VIP Ticket').setStyle(ButtonStyle.Danger)
            );
            await message.channel.send({ embeds: [embed], components: [buttons] });
        }
    } catch (err) {
        console.error('Command Execution Error:', err);
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
        try {
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
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory],
                    },
                ],
            };

            if (selectedConfig.categoryId && !selectedConfig.categoryId.startsWith('YOUR_') && selectedConfig.categoryId.length > 10) {
                channelOptions.parent = selectedConfig.categoryId;
            }

            const channel = await interaction.guild.channels.create(channelOptions);

            const ticketEmbed = new EmbedBuilder()
                .setColor('#E6A100')
                .setTitle(`✨ Ticket #${ticketNumber}`)
                .setDescription(`🏷️ **Category:** \`${selectedConfig.name}\`\n👤 **Owner:** <@${interaction.user.id}>\n🛠️ **Status:** \`Not Claimed\`\n\n-------------------------\n📨 **Please state your issue or query clearly.**\nAttach any screenshots or proof if necessary.\n-------------------------`)
                .setFooter({ text: 'ONE PEACE ROLEPLAY Support Team' })
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

            await interaction.reply({ content: `Your ticket has been created successfully: ${channel}`, ephemeral: true });
        } catch (err) {
            console.error('Ticket Creation Error:', err);
            await interaction.reply({ content: 'Error creating ticket. Please check bot permissions.', ephemeral: true });
        }
    }

    if (interaction.customId === 'claim_ticket') {
        await interaction.reply({ content: `✅ This ticket has been claimed by <@${interaction.user.id}>!` });
    }

    if (interaction.customId === 'unclaim_ticket') {
        await interaction.reply({ content: `⚠️ Ticket has been unclaimed!` });
    }

    if (interaction.customId === 'close_ticket') {
        await interaction.reply('🔒 Generating transcript and closing ticket in 5 seconds...');

        try {
            // 1. Generate HTML Transcript
            const file = await discordTranscripts.createTranscript(interaction.channel, {
                limit: -1,
                returnType: 'attachment',
                filename: `${interaction.channel.name}-transcript.html`,
                saveImages: true,
                poweredBy: false
            });

            // 2. Send transcript file to Staff Log Channel
            const logChannel = interaction.guild.channels.cache.get(1543481103866929223);
            if (logChannel) {
                await logChannel.send({
                    content: `📜 **Transcript for ${interaction.channel.name}**\nClosed by: <@${interaction.user.id}>`,
                    files: [file]
                });
            }
        } catch (err) {
            console.error('Transcript Generation Error:', err);
        }

        // 3. Delete channel after 5 seconds
        setTimeout(() => interaction.channel.delete(), 5000);
    }
});

client.login(process.env.DISCORD_TOKEN);

