const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, SlashCommandBuilder, REST, Routes } = require('discord.js');
const express = require('express');
const discordTranscripts = require('discord-html-transcripts');
const mongoose = require('mongoose');

const app = express();
app.get('/', (req, res) => res.send('ONE PEACE ROLEPLAY Bot is Online!'));
app.listen(3000, () => console.log('Server Ready'));

// --- MONGODB CONNECTION SETUP ---
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://fmh3510_db_user:PnUlbQCbd4EhI6BY@cluster0.n5o3rd0.mongodb.net/?appName=Cluster0';

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Successfully connected to MongoDB Atlas Database!'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// Database Schema & Model Definitions
const AttendanceSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    totalDays: { type: Number, default: 0 },
    lastMarkedDate: { type: String, default: '' }
});

const Attendance = mongoose.model('Attendance', AttendanceSchema);

// Memory Meta Storage for Active Tickets
const ticketMeta = new Map(); // channelId -> { ownerId, openTime, claimedBy }
let totalClosedTickets = 0;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const ATTENDANCE_LOG_CHANNEL_ID = '1544149519472529418'; 
const LOG_CHANNEL_ID = '1542216463929311339'; 
const BANNER_IMAGE = 'https://i.ibb.co/yFZrkrVY/1787815678187.png'; 

const CATEGORIES = {
    FRP: '1543445649520070787',
    GANG_FRP: '1543445685066666115',
    HELP: '1543449176476745910',
    FACTION_APP: '1543445813546451035',
    GANG_APP: '1543445864230555658',
    VIP: '1543445898875371600',
    ADMIN_APP: '1544379259525537922'
};

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}! Bot is ONLINE!`);

    const commands = [
        new SlashCommandBuilder()
            .setName('attendance-leaderboard')
            .setDescription('Shows the staff attendance leaderboard')
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log('Attendance Slash commands registered successfully!');
    } catch (error) {
        console.error('Slash Command Error:', error);
    }
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

        if (message.content === '!setup-admin') {
            const embed = new EmbedBuilder()
                .setTitle('👑 Admin Application')
                .setDescription('Click the button below to submit your Admin Application.')
                .setImage(BANNER_IMAGE)
                .setColor('#6366f1');

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ticket_admin_app').setLabel('Admin Application').setStyle(ButtonStyle.Primary)
            );
            await message.channel.send({ embeds: [embed], components: [buttons] });
        }

        if (message.content === '!setup-attendance') {
            if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return message.reply('❌ Only admins can setup attendance!');
            }

            const today = new Date().toISOString().split('T')[0];
            const embed = new EmbedBuilder()
                .setTitle('📋 Staff Attendance Panel')
                .setDescription(`Click the button below to mark your attendance for **${today}**.`)
                .setColor('#10b981')
                .setFooter({ text: 'ONE PEACE ROLEPLAY Attendance System' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('mark_attendance_btn')
                    .setLabel('Mark Attendance')
                    .setStyle(ButtonStyle.Success)
            );

            await message.channel.send({ embeds: [embed], components: [row] });
            await message.delete().catch(() => {});
        }

    } catch (err) {
        console.error('Command Execution Error:', err);
    }
});

client.on('interactionCreate', async (interaction) => {
    // 1. Modal Submits Handling
    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'rename_ticket_modal') {
            const newName = interaction.fields.getTextInputValue('new_ticket_name');
            try {
                await interaction.channel.setName(newName);
                await interaction.reply({ content: `✅ Ticket renamed to **${newName}**`, ephemeral: true });
            } catch (err) {
                console.error('Rename Error:', err);
                await interaction.reply({ content: '❌ Failed to rename channel. Check bot permissions.', ephemeral: true });
            }
            return;
        }

        // Close Ticket Reason Modal Handling
        if (interaction.customId === 'close_ticket_modal') {
            const reason = interaction.fields.getTextInputValue('close_reason_input');
            const data = ticketMeta.get(interaction.channel.id) || {};
            
            await interaction.reply('🔒 Generating transcript and logging data before closing...');

            try {
                totalClosedTickets += 1;
                const categoryName = interaction.channel.parent ? interaction.channel.parent.name : 'General';

                const attachment = await discordTranscripts.createTranscript(interaction.channel, {
                    limit: -1,
                    returnType: 'attachment',
                    filename: `${interaction.channel.name}-transcript.html`,
                    saveImages: true,
                    poweredBy: false
                });

                // Transcript Log
                const logChannel = await interaction.guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
                if (logChannel) {
                    const closeEmbed = new EmbedBuilder()
                        .setTitle('📜 Ticket Closed & Transcripts Logged')
                        .setColor('#ef4444')
                        .addFields(
                            { name: '👤 Ticket Owner', value: data.ownerId ? `<@${data.ownerId}>` : 'Unknown', inline: true },
                            { name: '🔢 Ticket No.', value: `#${interaction.channel.name.replace('ticket-', '')}`, inline: true },
                            { name: '🏷️ Category', value: categoryName, inline: true },
                            { name: '🛡️ Claimed By', value: data.claimedBy ? `<@${data.claimedBy}>` : 'Not Claimed', inline: true },
                            { name: '🔒 Closed By', value: `<@${interaction.user.id}>`, inline: true },
                            { name: '📊 Total Closed Tickets', value: `${totalClosedTickets}`, inline: true }
                        )
                        .setFooter({ text: 'ONE PEACE ROLEPLAY Support Logs' })
                        .setTimestamp();

                    await logChannel.send({ embeds: [closeEmbed], files: [attachment] });
                }

                // Attendance Log Channel Update
                const attendanceLogChannel = await interaction.guild.channels.fetch(ATTENDANCE_LOG_CHANNEL_ID).catch(() => null);
                if (attendanceLogChannel) {
                    const ticketLogEmbed = new EmbedBuilder()
                        .setTitle('🎫 Ticket Attendance & Details Log')
                        .setColor('#3b82f6')
                        .addFields(
                            { name: '🔢 Ticket Name/Number', value: `\`${interaction.channel.name}\``, inline: true },
                            { name: '👤 Ticket Owner', value: data.ownerId ? `<@${data.ownerId}>` : 'Unknown', inline: true },
                            { name: '🛡️ Claimed By', value: data.claimedBy ? `<@${data.claimedBy}>` : 'Not Claimed', inline: true },
                            { name: '🔒 Closed By', value: `<@${interaction.user.id}>`, inline: true },
                            { name: '⏰ Open Time', value: data.openTime ? `<t:${Math.floor(data.openTime / 1000)}:F>` : 'Unknown', inline: true },
                            { name: '📝 Closing Reason', value: reason || 'No reason provided', inline: false }
                        )
                        .setFooter({ text: 'ONE PEACE ROLEPLAY System' })
                        .setTimestamp();

                    await attendanceLogChannel.send({ embeds: [ticketLogEmbed] });
                }

            } catch (err) {
                console.error('Ticket Closure Error:', err);
            }

            ticketMeta.delete(interaction.channel.id);
            setTimeout(() => interaction.channel.delete().catch(console.error), 4000);
            return;
        }
    }

    // 2. Attendance Leaderboard Slash Command (Fetched from MongoDB)
    if (interaction.isChatInputCommand() && interaction.commandName === 'attendance-leaderboard') {
        try {
            const records = await Attendance.find().sort({ totalDays: -1 }).limit(10);

            if (!records || records.length === 0) {
                return interaction.reply({ content: '❌ ഇതുവരെ ആരും അറ്റൻഡൻസ് രേഖപ്പെടുത്തിയിട്ടില്ല.', ephemeral: true });
            }

            let leaderboardText = records.map(([record, index]) => {
                return `**#${index + 1}** <@${record.userId}> — **${record.totalDays} Days**`;
            }).join('\n');

            const lbEmbed = new EmbedBuilder()
                .setTitle('🏆 Staff Attendance Leaderboard')
                .setDescription(leaderboardText)
                .setColor('#f59e0b')
                .setFooter({ text: 'ONE PEACE ROLEPLAY Staff Team' })
                .setTimestamp();

            return await interaction.reply({ embeds: [lbEmbed] });
        } catch (err) {
            console.error('Leaderboard Fetch Error:', err);
            return interaction.reply({ content: '❌ Error fetching leaderboard data.', ephemeral: true });
        }
    }

    if (!interaction.isButton()) return;

    // 3. Mark Attendance Button (Saved directly to MongoDB Database)
    if (interaction.customId === 'mark_attendance_btn') {
        const userId = interaction.user.id;
        const today = new Date().toISOString().split('T')[0];

        try {
            let userDoc = await Attendance.findOne({ userId });

            if (userDoc && userDoc.lastMarkedDate === today) {
                return await interaction.reply({ 
                    content: '❌ നിങ്ങൾ ഇന്നത്തെ അറ്റൻഡൻസ് നേരത്തെ രേഖപ്പെടുത്തിയിട്ടുണ്ട്!', 
                    ephemeral: true 
                });
            }

            if (!userDoc) {
                userDoc = new Attendance({ userId, totalDays: 1, lastMarkedDate: today });
            } else {
                userDoc.totalDays += 1;
                userDoc.lastMarkedDate = today;
            }

            await userDoc.save();

            await interaction.reply({ 
                content: `✅ നിങ്ങളുടെ അറ്റൻഡൻസ് ഇന്ന് (${today}) രേഖപ്പെടുത്തിയിരിക്കുന്നു! (Total: ${userDoc.totalDays} Days)`, 
                ephemeral: true 
            });

            const logChannel = await interaction.guild.channels.fetch(ATTENDANCE_LOG_CHANNEL_ID).catch(() => null);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('📌 Staff Attendance Logged')
                    .setColor('#10b981')
                    .addFields(
                        { name: 'Staff Member', value: `<@${userId}>`, inline: true },
                        { name: 'Date', value: today, inline: true },
                        { name: 'Total Attendance', value: `${userDoc.totalDays} Days`, inline: true }
                    )
                    .setTimestamp();

                await logChannel.send({ embeds: [logEmbed] });
            }
        } catch (err) {
            console.error('Attendance Save Error:', err);
            await interaction.reply({ content: '❌ Error saving attendance.', ephemeral: true });
        }
        return;
    }

    const isStaff = interaction.member.permissions.has(PermissionFlagsBits.Administrator) || 
                    interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);

    const configMap = {
        'ticket_frp': { name: 'FRP', categoryId: CATEGORIES.FRP },
        'ticket_gang_frp': { name: 'Gang FRP', categoryId: CATEGORIES.GANG_FRP },
        'ticket_help': { name: 'Help', categoryId: CATEGORIES.HELP },
        'ticket_faction_app': { name: 'Faction Application', categoryId: CATEGORIES.FACTION_APP },
        'ticket_gang_app': { name: 'Gang Application', categoryId: CATEGORIES.GANG_APP },
        'ticket_vip': { name: 'VIP', categoryId: CATEGORIES.VIP },
        'ticket_admin_app': { name: 'Admin Application', categoryId: CATEGORIES.ADMIN_APP }
    };

    const selectedConfig = configMap[interaction.customId];

    // 4. Ticket Creation
    if (selectedConfig) {
        try {
            const userTickets = interaction.guild.channels.cache.filter(c => 
                c.name.startsWith('ticket-') && 
                c.permissionsFor(interaction.user.id)?.has(PermissionFlagsBits.ViewChannel)
            );

            if (userTickets.size >= 2) {
                return await interaction.reply({ 
                    content: '❌ **You can only have a maximum of 2 open tickets at the same time!**', 
                    ephemeral: true 
                });
            }

            const ticketNumber = Math.floor(1000 + Math.random() * 9000);
            const channelName = `ticket-${ticketNumber}`;

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

            if (selectedConfig.categoryId && selectedConfig.categoryId.length > 10) {
                channelOptions.parent = selectedConfig.categoryId;
            }

            const channel = await interaction.guild.channels.create(channelOptions);

            // Record Ticket Metadata
            ticketMeta.set(channel.id, {
                ownerId: interaction.user.id,
                openTime: Date.now(),
                claimedBy: null
            });

            const ticketEmbed = new EmbedBuilder()
                .setColor('#E6A100')
                .setTitle(`✨ Ticket #${ticketNumber}`)
                .setDescription(`🏷️ **Category:** \`${selectedConfig.name}\`\n👤 **Owner:** <@${interaction.user.id}>\n🛠️ **Status:** \`Not Claimed\`\n\n-------------------------\n📨 **Please state your issue clearly.**\n-------------------------`)
                .setFooter({ text: 'ONE PEACE ROLEPLAY Support Team' })
                .setTimestamp();

            const controlButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('claim_ticket').setLabel('Claim').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('unclaim_ticket').setLabel('Unclaim').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('rename_ticket').setLabel('Rename').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('close_ticket').setLabel('Close').setStyle(ButtonStyle.Danger)
            );

            await channel.send({
                content: `<@${interaction.user.id}>`,
                embeds: [ticketEmbed],
                components: [controlButtons]
            });

            await interaction.reply({ content: `Your ticket has been created: ${channel}`, ephemeral: true });
        } catch (err) {
            console.error('Ticket Creation Error:', err);
            await interaction.reply({ content: 'Error creating ticket.', ephemeral: true });
        }
    }

    // 5. Claim Ticket
    if (interaction.customId === 'claim_ticket') {
        if (!isStaff) return await interaction.reply({ content: '❌ **Only staff members can claim tickets!**', ephemeral: true });

        const data = ticketMeta.get(interaction.channel.id) || {};
        data.claimedBy = interaction.user.id;
        ticketMeta.set(interaction.channel.id, data);

        await interaction.reply({ content: `✅ Ticket claimed by <@${interaction.user.id}>!` });
    }

    // 6. Unclaim Ticket
    if (interaction.customId === 'unclaim_ticket') {
        if (!isStaff) return await interaction.reply({ content: '❌ **Only staff members can unclaim tickets!**', ephemeral: true });

        const data = ticketMeta.get(interaction.channel.id) || {};
        data.claimedBy = null;
        ticketMeta.set(interaction.channel.id, data);

        await interaction.reply({ content: `⚠️ Ticket unclaimed!` });
    }

    // 7. Rename Ticket
    if (interaction.customId === 'rename_ticket') {
        if (!isStaff) return await interaction.reply({ content: '❌ **Only staff members can rename tickets!**', ephemeral: true });

        const modal = new ModalBuilder().setCustomId('rename_ticket_modal').setTitle('Rename Ticket');
        const nameInput = new TextInputBuilder()
            .setCustomId('new_ticket_name')
            .setLabel('Enter new channel name')
            .setStyle(TextInputStyle.Short)
            .setValue(interaction.channel.name)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
        await interaction.showModal(modal);
    }

    // 8. Close Ticket Button Handle (Prompts Modal for Reason)
    if (interaction.customId === 'close_ticket') {
        if (!isStaff) {
            return await interaction.reply({ 
                content: '❌ **Citizens cannot close tickets! Only Staff/Admins can close this ticket.**', 
                ephemeral: true 
            });
        }

        const modal = new ModalBuilder()
            .setCustomId('close_ticket_modal')
            .setTitle('Close Ticket');

        const reasonInput = new TextInputBuilder()
            .setCustomId('close_reason_input')
            .setLabel('Reason for closing this ticket')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Enter closing reason here...')
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
        await interaction.showModal(modal);
    }
});

client.login(process.env.DISCORD_TOKEN);
