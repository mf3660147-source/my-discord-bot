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

// ടിക്കറ്റ് ഓണറെ തിരിച്ചറിയാനും ടാസ്‌ക് ട്രാക്ക് ചെയ്യാനും
const ticketMeta = new Map(); // channelId -> { ownerId }
let totalClosedTickets = 0; 

// ---------------- CHANNEL & ROLE CONFIGURATIONS ----------------
const ATTENDANCE_LOG_CHANNEL_ID = '1544149519472529418'; 
const LOG_CHANNEL_ID = '1542216463929311339'; 
const BANNER_IMAGE = 'https://i.ibb.co/yFZrkrVY/1787815678187.png'; 

// Name Change Channel IDs
const NC_ACCEPT_LOG_CHANNEL_ID = '1544552029748465664'; // Approved Log Channel
const NC_REJECT_LOG_CHANNEL_ID = '1544552097343873055'; // Rejected Log Channel
const NC_REVIEW_CHANNEL_ID = '1544553053922005024';     // Staff Review Channel

// Staff Ticket Access Role ID
const TICKET_STAFF_ROLE_ID = '1542813114012012554';

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
        // --- NAME CHANGE PORTAL SETUP COMMAND ---
        if (message.content === '!setup-nc') {
            if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return message.reply('❌ Only admins can setup the Name Change Portal!');
            }

            const embed = new EmbedBuilder()
                .setTitle('📝 Name Change Portal')
                .setDescription('Welcome to the official **ONE PEACE ROLEPLAY** name change system.\n\nSubmit your request below and wait for management approval.\n\n-------------------------\n\n✍️ **Name Format**\n```\n✅ Firstname_Lastname\n✅ Example: Oggy_Ftw\n```\n-------------------------\n\n📊 **Status**\n🟢 System: **Online**\n🧑‍💼 Managed by: **OPRP Staff**\n📅 Review Time: **Within 24 Hours**')
                .setImage(BANNER_IMAGE)
                .setColor('#ef4444')
                .setFooter({ text: 'ONE PEACE ROLEPLAY • Name Change Department' })
                .setTimestamp();

            const button = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('nc_apply_btn')
                    .setLabel('Apply for Name Change')
                    .setEmoji('📝')
                    .setStyle(ButtonStyle.Danger)
            );

            await message.channel.send({ embeds: [embed], components: [button] });
            await message.delete().catch(() => {});
        }

        // --- SUPPORT TICKET SETUPS ---
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
    
    // --- 1. MODAL SUBMIT HANDLERS ---
    if (interaction.isModalSubmit()) {
        
        // Ticket Rename Modal
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

        // Name Change Application Modal Submission
        if (interaction.customId === 'nc_modal_submit') {
            const newName = interaction.fields.getTextInputValue('nc_new_name');
            const currentName = interaction.fields.getTextInputValue('nc_current_name');
            const level = interaction.fields.getTextInputValue('nc_level');
            const reason = interaction.fields.getTextInputValue('nc_reason');

            await interaction.reply({ content: '✅ Your Name Change Application has been submitted for staff review!', ephemeral: true });

            const reviewChannel = await interaction.guild.channels.fetch(NC_REVIEW_CHANNEL_ID).catch(() => null);
            if (reviewChannel) {
                const reviewEmbed = new EmbedBuilder()
                    .setTitle('📝 New Name Change Application')
                    .setColor('#f59e0b')
                    .addFields(
                        { name: '👤 User', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: false },
                        { name: '📛 Current In-Game Name', value: `\`${currentName}\``, inline: true },
                        { name: '✨ Requested New Name', value: `\`${newName}\``, inline: true },
                        { name: '📊 In-Game Level', value: `\`${level}\``, inline: true },
                        { name: '📝 Reason', value: reason, inline: false }
                    )
                    .setFooter({ text: 'ONE PEACE ROLEPLAY • NC Review System' })
                    .setTimestamp();

                const buttons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`nc_accept_${interaction.user.id}_${encodeURIComponent(currentName)}_${encodeURIComponent(newName)}`)
                        .setLabel('Approve')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`nc_reject_${interaction.user.id}_${encodeURIComponent(currentName)}_${encodeURIComponent(newName)}`)
                        .setLabel('Deny')
                        .setStyle(ButtonStyle.Danger)
                );

                await reviewChannel.send({ embeds: [reviewEmbed], components: [buttons] });
            }
            return;
        }
    }

    // --- 2. SLASH COMMAND HANDLER ---
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

    // --- 3. NAME CHANGE BUTTON CLICK HANDLERS ---
    
    // Open Name Change Form Modal
    if (interaction.customId === 'nc_apply_btn') {
        const modal = new ModalBuilder()
            .setCustomId('nc_modal_submit')
            .setTitle('📝 Name Change Application');

        const newNameInput = new TextInputBuilder()
            .setCustomId('nc_new_name')
            .setLabel('New Name (Firstname_Lastname)')
            .setPlaceholder('e.g. Oggy_Ftw')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const currentNameInput = new TextInputBuilder()
            .setCustomId('nc_current_name')
            .setLabel('Current In-Game Name')
            .setPlaceholder('e.g. Itz_Thor')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const levelInput = new TextInputBuilder()
            .setCustomId('nc_level')
            .setLabel('In-Game Level')
            .setPlaceholder('e.g. Level 3')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const reasonInput = new TextInputBuilder()
            .setCustomId('nc_reason')
            .setLabel('Reason for Name Change')
            .setPlaceholder('Explain why you want to change your RP name...')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(newNameInput),
            new ActionRowBuilder().addComponents(currentNameInput),
            new ActionRowBuilder().addComponents(levelInput),
            new ActionRowBuilder().addComponents(reasonInput)
        );

        return await interaction.showModal(modal);
    }

    // Staff Accept Action
    if (interaction.customId.startsWith('nc_accept_')) {
        const isStaff = interaction.member.permissions.has(PermissionFlagsBits.Administrator) || 
                        interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) ||
                        interaction.member.roles.cache.has(TICKET_STAFF_ROLE_ID);
        if (!isStaff) return await interaction.reply({ content: '❌ Only staff can approve applications!', ephemeral: true });

        const parts = interaction.customId.split('_');
        const targetUserId = parts[2];
        const oldName = decodeURIComponent(parts[3]);
        const newName = decodeURIComponent(parts[4]);

        const acceptLogChannel = await interaction.guild.channels.fetch(NC_ACCEPT_LOG_CHANNEL_ID).catch(() => null);
        if (acceptLogChannel) {
            const acceptEmbed = new EmbedBuilder()
                .setTitle('✅ Name Change Approved Log')
                .setColor('#22c55e')
                .addFields(
                    { name: '👤 User', value: `<@${targetUserId}>`, inline: false },
                    { name: '📛 Old Name', value: `\`${oldName}\``, inline: false },
                    { name: '✨ New Name', value: `\`${newName}\``, inline: false },
                    { name: '🧑‍💼 Approved By', value: `<@${interaction.user.id}>`, inline: false }
                )
                .setTimestamp();

            await acceptLogChannel.send({ 
                content: `✅ Name change approved for <@${targetUserId}>`, 
                embeds: [acceptEmbed] 
            });
        }

        await interaction.update({ content: `✅ **Approved by <@${interaction.user.id}>**`, components: [] });
        return;
    }

    // Staff Reject Action
    if (interaction.customId.startsWith('nc_reject_')) {
        const isStaff = interaction.member.permissions.has(PermissionFlagsBits.Administrator) || 
                        interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) ||
                        interaction.member.roles.cache.has(TICKET_STAFF_ROLE_ID);
        if (!isStaff) return await interaction.reply({ content: '❌ Only staff can deny applications!', ephemeral: true });

        const parts = interaction.customId.split('_');
        const targetUserId = parts[2];
        const oldName = decodeURIComponent(parts[3]);
        const newName = decodeURIComponent(parts[4]);

        const rejectLogChannel = await interaction.guild.channels.fetch(NC_REJECT_LOG_CHANNEL_ID).catch(() => null);
        if (rejectLogChannel) {
            const rejectEmbed = new EmbedBuilder()
                .setTitle('❌ Name Change Denied Log')
                .setColor('#ef4444')
                .addFields(
                    { name: '👤 User', value: `<@${targetUserId}>`, inline: false },
                    { name: '📛 Old Name', value: `\`${oldName}\``, inline: false },
                    { name: '✨ Requested Name', value: `\`${newName}\``, inline: false },
                    { name: '🧑‍💼 Rejected By', value: `<@${interaction.user.id}>`, inline: false }
                )
                .setTimestamp();

            await rejectLogChannel.send({ 
                content: `❌ Name change denied for <@${targetUserId}>`, 
                embeds: [rejectEmbed] 
            });
        }

        await interaction.update({ content: `❌ **Denied by <@${interaction.user.id}>**`, components: [] });
        return;
    }

    // --- 4. ATTENDANCE BUTTON CLICK HANDLER ---
    if (interaction.customId === 'mark_attendance_btn') {
        const userId = interaction.user.id;
        const today = new Date().toISOString().split('T')[0];

        if (dailyLogs.get(userId) === today) {
            return await interaction.reply({ 
                content: '❌ നിങ്ങൾ ഇന്നത്തെ അറ്റൻഡൻസ് നേരത്തെ രേഖപ്പെടുത്തിയിട്ടുണ്ട്!', 
                ephemeral: true 
            });
        }

        dailyLogs.set(userId, today);
        const currentCount = (attendanceData.get(userId) || 0) + 1;
        attendanceData.set(userId, currentCount);

        await interaction.reply({ 
            content: `✅ നിങ്ങളുടെ അറ്റൻഡൻസ് ഇന്ന് (${today}) രേഖപ്പെടുത്തിയിരിക്കുന്നു! (Total: ${currentCount} Days)`, 
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
                    { name: 'Total Attendance', value: `${currentCount} Days`, inline: true }
                )
                .setTimestamp();

            await logChannel.send({ embeds: [logEmbed] });
        }
        return;
    }

    // --- 5. TICKET SYSTEM HANDLERS ---
    const isStaff = interaction.member.permissions.has(PermissionFlagsBits.Administrator) || 
                    interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) ||
                    interaction.member.roles.cache.has(TICKET_STAFF_ROLE_ID);

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

    if (selectedConfig) {
        try {
            if (!isStaff) {
                const userTickets = Array.from(ticketMeta.values()).filter(t => t.ownerId === interaction.user.id);

                if (userTickets.length >= 2) {
                    return await interaction.reply({ 
                        content: '❌ **You can only have a maximum of 2 open tickets at the same time!**', 
                        ephemeral: true 
                    });
                }
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
                    {
                        id: TICKET_STAFF_ROLE_ID,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory],
                    },
                ],
            };

            if (selectedConfig.categoryId && selectedConfig.categoryId.length > 10) {
                channelOptions.parent = selectedConfig.categoryId;
            }

            const channel = await interaction.guild.channels.create(channelOptions);
            ticketMeta.set(channel.id, { ownerId: interaction.user.id });

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
                content: `<@${interaction.user.id}> <@&${TICKET_STAFF_ROLE_ID}>`,
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
            let ticketOwner = 'Unknown';
            const metaData = ticketMeta.get(interaction.channel.id);
            if (metaData) {
                ticketOwner = `<@${metaData.ownerId}>`;
            } else {
                const nonStaffPermissions = interaction.channel.permissionOverwrites.cache.find(
                    p => p.type === 1 && p.id !== client.user.id && p.id !== interaction.guild.roles.everyone.id
                );
                if (nonStaffPermissions) ticketOwner = `<@${nonStaffPermissions.id}>`;
            }

            const categoryName = interaction.channel.parent ? interaction.channel.parent.name : 'General';
            totalClosedTickets += 1;

            const attachment = await discordTranscripts.createTranscript(interaction.channel, {
                limit: -1,
                returnType: 'attachment',
                filename: `${interaction.channel.name}-transcript.html`,
                saveImages: true,
                poweredBy: false
            });

            const logChannel = await interaction.guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
            if (logChannel) {
                const closeEmbed = new EmbedBuilder()
                    .setTitle('📜 Ticket Closed & Transcripts Logged')
                    .setColor('#ef4444')
                    .addFields(
                        { name: '👤 Ticket Owner', value: ticketOwner, inline: true },
                        { name: '🔢 Ticket No.', value: `#${interaction.channel.name.replace('ticket-', '')}`, inline: true },
                        { name: '🏷️ Category', value: categoryName, inline: true },
                        { name: '🔒 Closed By', value: `<@${interaction.user.id}>`, inline: true },
                        { name: '📊 Total Closed Tickets', value: `${totalClosedTickets}`, inline: true }
                    )
                    .setFooter({ text: 'ONE PEACE ROLEPLAY Support Logs' })
                    .setTimestamp();

                await logChannel.send({
                    embeds: [closeEmbed],
                    files: [attachment]
                });
            }
        } catch (err) {
            console.error('Transcript Log Error:', err);
        }

        ticketMeta.delete(interaction.channel.id);
        setTimeout(() => interaction.channel.delete().catch(console.error), 5000);
    }
});

client.login(process.env.DISCORD_TOKEN);
