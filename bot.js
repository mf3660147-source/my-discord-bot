const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, SlashCommandBuilder, REST, Routes } = require('discord.js');
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

// അറ്റൻഡൻസ് സൂക്ഷിക്കുന്ന മെമ്മറി
const attendanceData = new Map(); // userId -> totalCount
const dailyLogs = new Map(); // userId -> lastDate

const ATTENDANCE_LOG_CHANNEL_ID = '1544149519472529418'; // നിങ്ങൾ തന്ന ചാനൽ ഐഡി

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}! Bot is ONLINE!`);

    // Slash Command Register ചെയ്യൽ (/attendance-leaderboard)
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

const BANNER_IMAGE = 'https://i.ibb.co/yFZrkrVY/1787815678187.png'; 
const LOG_CHANNEL_ID = '1543481103866929223'; 

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

        // --- STAFF ATTENDANCE SETUP COMMAND ---
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
    // 1. Modal submit - Rename Handle
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
        }
        return;
    }

    // 2. Attendance Leaderboard Slash Command
    if (interaction.isChatInputCommand() && interaction.commandName === 'attendance-leaderboard') {
        if (attendanceData.size === 0) {
            return interaction.reply({ content: '❌ ഇതുവരെ ആരും അറ്റൻഡൻസ് രേഖപ്പെടുത്തിയിട്ടില്ല.', ephemeral: true });
        }

        const sorted = Array.from(attendanceData.entries()).sort((a, b) => b[1] - a[1]);
        let leaderboardText = sorted.map(([user, count], index) => {
            return `**#${index + 1}** <@${user}> — **${count} Days**`;
        }).join('\n');

        const lbEmbed = new EmbedBuilder()
            .setTitle('🏆 Staff Attendance Leaderboard')
            .setDescription(leaderboardText)
            .setColor('#f59e0b')
            .setFooter({ text: 'ONE PEACE ROLEPLAY Staff Team' })
            .setTimestamp();

        return await interaction.reply({ embeds: [lbEmbed] });
    }

    if (!interaction.isButton()) return;

    // --- ATTENDANCE BUTTON CLICK HANDLE ---
    if (interaction.customId === 'mark_attendance_btn') {
        const userId = interaction.user.id;
        const today = new Date().toISOString().split('T')[0];

        // ഇന്നത്തെ ദിവസം അറ്റൻഡൻസ് ഇട്ടിട്ടുണ്ടോ എന്ന് പരിശോധിക്കുന്നു
        if (dailyLogs.get(userId) === today) {
            return await interaction.reply({ 
                content: '❌ നിങ്ങൾ ഇന്നത്തെ അറ്റൻഡൻസ് നേരത്തെ രേഖപ്പെടുത്തിയിട്ടുണ്ട്!', 
                ephemeral: true 
            });
        }

        // അറ്റൻഡൻസ് കൗണ്ട് അപ്‌ഡേറ്റ് ചെയ്യൽ
        dailyLogs.set(userId, today);
        const currentCount = (attendanceData.get(userId) || 0) + 1;
        attendanceData.set(userId, currentCount);

        await interaction.reply({ 
            content: `✅ നിങ്ങളുടെ അറ്റൻഡൻസ് ഇന്ന് (${today}) രേഖപ്പെടുത്തിയിരിക്കുന്നു! (Total: ${currentCount} Days)`, 
            ephemeral: true 
        });

        // ലോഗ് ചാനലിലേക്ക് അറ്റൻഡൻസ് വിവരം അയക്കൽ
        const logChannel = await interaction.guild.channels.fetch(ATTENDANCE_LOG_CHANNEL_ID).catch(() => null);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setTitle('📌 Staff Attendance Logged')
                .setColor('#10b981')
                .addFields(
                    { name: 'Staff Member', value: `<@${userId}>`, inline: true },
                    { name: 'Date', value: today, inline: true },
                    { name: 'Total Attendance', value: `${currentCount} Days`, inline: true }
                )
                .setTimestamp();

            await logChannel.send({ embeds: [logEmbed] });
        }
        return;
    }

    // Staff/Admin Check
    const isStaff = interaction.member.permissions.has(PermissionFlagsBits.Administrator) || 
                    interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);

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

            if (selectedConfig.categoryId && !selectedConfig.categoryId.startsWith('YOUR_') && selectedConfig.categoryId.length > 10) {
                channelOptions.parent = selectedConfig.categoryId;
            }

            const channel = await interaction.guild.channels.create(channelOptions);

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

    if (interaction.customId === 'claim_ticket') {
        if (!isStaff) return await interaction.reply({ content: '❌ **Only staff members can claim tickets!**', ephemeral: true });
        await interaction.reply({ content: `✅ Ticket claimed by <@${interaction.user.id}>!` });
    }

    if (interaction.customId === 'unclaim_ticket') {
        if (!isStaff) return await interaction.reply({ content: '❌ **Only staff members can unclaim tickets!**', ephemeral: true });
        await interaction.reply({ content: `⚠️ Ticket unclaimed!` });
    }

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

    if (interaction.customId === 'close_ticket') {
        if (!isStaff) {
            return await interaction.reply({ 
                content: '❌ **Citizens cannot close tickets! Only Staff/Admins can close this ticket.**', 
                ephemeral: true 
            });
        }

        await interaction.reply('🔒 Generating transcript and closing ticket in 5 seconds...');

        try {
            const attachment = await discordTranscripts.createTranscript(interaction.channel, {
                limit: -1,
                returnType: 'attachment',
                filename: `${interaction.channel.name}-transcript.html`,
                saveImages: true,
                poweredBy: false
            });

            const logChannel = await interaction.guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
            if (logChannel) {
                await logChannel.send({
                    content: `📜 **Transcript Log for \`#${interaction.channel.name}\`**\n📌 **Closed By:** <@${interaction.user.id}>`,
                    files: [attachment]
                });
            } else {
                console.error(`Log channel not found! Check ID: ${LOG_CHANNEL_ID}`);
            }
        } catch (err) {
            console.error('Transcript Log Error:', err);
        }

        setTimeout(() => interaction.channel.delete().catch(console.error), 5000);
    }
});

client.login(process.env.DISCORD_TOKEN);
