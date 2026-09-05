require('dotenv').config();
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, SlashCommandBuilder, REST, Routes, UserSelectMenuBuilder } = require('discord.js');
const express = require('express');
const discordTranscripts = require('discord-html-transcripts');
const mysql = require('mysql2/promise');

// ---------------- MySQL DATABASE CONNECTION POOL ----------------
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: parseInt(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
});

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
const ticketMeta = new Map(); // channelId -> { ownerId, roleId, claimedBy }
let totalClosedTickets = 0; 

// ---------------- CHANNEL & ROLE CONFIGURATIONS ----------------
const ATTENDANCE_LOG_CHANNEL_ID = '1544149519472529418'; 
const LOG_CHANNEL_ID = '1542216463929311339'; 
const BANNER_IMAGE = 'https://i.ibb.co/yFZrkrVY/1787815678187.png'; 

// Name Change Channel IDs
const NC_ACCEPT_LOG_CHANNEL_ID = '1544552029748465664'; // Approved Log Channel
const NC_REJECT_LOG_CHANNEL_ID = '1544552097343873055'; // Rejected Log Channel
const NC_REVIEW_CHANNEL_ID = '1544553053922005024';     // Staff Review Channel

// Roles
const AUTO_JOIN_ROLE_ID = '1542503336484413460'; // ന്യൂ യൂസർ റോൾ ഐഡി
const TICKET_STAFF_ROLE_ID = '1542813114012012554';
const ADMIN_ROLE_ID = '1542813114012012554'; // Admin Role ID
const FACTION_ROLE_ID = '1543941439451435158';
const GANG_ROLE_ID = '1543941302423650396';

// Passport / IG Name Verification
const PASSPORT_INPUT_CHANNEL_ID = '1542732385542606908';  // Channel where citizens post their IG name
const PASSPORT_LOG_CHANNEL_ID = '1545117305967738990';    // Channel where approval is posted
const CITIZEN_ROLE_ID = '1542720207192195132';             // Role required to submit IG name
const PASSPORT_APPROVED_ROLE_ID = '1542216459520835603';   // Role given after approval

const CATEGORIES = {
    FRP: '1543445649520070787',
    GANG_FRP: '1543445685066666115',
    HELP: '1543449176476745910',
    FACTION_APP: '1543445813546451035',
    GANG_APP: '1543445864230555658',
    VIP: '1543445898875371600',
    ADMIN_APP: '1544379259525537922'
};

// അഡ്മിൻ പെർമിഷനോ അഡ്മിൻ റോളോ ഉണ്ടോ എന്ന് പരിശോധിക്കുന്ന ഫംഗ്ഷൻ
function hasAdminAccess(member) {
    if (!member) return false;
    return member.permissions.has(PermissionFlagsBits.Administrator) || member.roles.cache.has(ADMIN_ROLE_ID);
}

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}! Bot is ONLINE!`);

    // Test MySQL database connection
    try {
        const [rows] = await db.query('SELECT 1');
        console.log('✅ MySQL Database connected successfully!');
    } catch (dbErr) {
        console.error('❌ MySQL Database connection failed:', dbErr.message);
    }

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

// പുതിയ യൂസർ ജോയിൻ ചെയ്യുമ്പോൾ കൊടുക്കുന്ന റോൾ ഇവിടെ മാറ്റിയിട്ടുണ്ട്
client.on('guildMemberAdd', async (member) => {
    try {
        const role = member.guild.roles.cache.get(AUTO_JOIN_ROLE_ID);
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
            if (!hasAdminAccess(message.member)) {
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
            if (!hasAdminAccess(message.member)) {
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

        // --- PASSPORT / IG NAME VERIFICATION SYSTEM ---
        if (message.channel.id === PASSPORT_INPUT_CHANNEL_ID) {
            // Only citizens with the required role can use this
            if (!message.member.roles.cache.has(CITIZEN_ROLE_ID)) return;

            const igName = message.content.trim();

            // Strict name format validation: Firstname_Lastname (uppercase start, letters only, no numbers/symbols)
            const nameRegex = /^[A-Z][a-z]+_[A-Z][a-z]+$/;
            if (!igName || !nameRegex.test(igName)) {
                await message.react('❌');
                return message.reply('❌ Invalid name format!\n\n✅ Correct: `Oggy_Ftw`, `Itz_Thor`\n❌ Wrong: `oggy_ftw`, `OGGY_FTW`, `Oggy123_Ftw`, `Oggy Ftw`\n\nName must be **Firstname_Lastname** — each part starting with a **capital letter**, **letters only**, no numbers or symbols.');
            }

            try {
                const [rows] = await db.query('SELECT username, locked FROM users WHERE username = ?', [igName]);

                if (rows.length === 0) {
                    // Account not found in the database
                    await message.react('⚠️');
                    return message.reply(`⚠️ **${igName}** is not registered in-game. Please register first!`);
                }

                const user = rows[0];

                if (user.locked === 0) {
                    // Account exists but locked is 0 — already used/taken
                    await message.react('🔒');
                    return message.reply(`🔒 **${igName}** is already in use. If this is your account, contact staff.`);
                }

                // locked === 1 → Approve: set locked to 0
                await db.query('UPDATE users SET locked = 0 WHERE username = ?', [igName]);

                // Give the approved role and remove citizen role
                const approvedRole = message.guild.roles.cache.get(PASSPORT_APPROVED_ROLE_ID);
                if (approvedRole) {
                    await message.member.roles.add(approvedRole).catch(err => console.error('Role Add Error:', err));
                }
                const citizenRole = message.guild.roles.cache.get(CITIZEN_ROLE_ID);
                if (citizenRole) {
                    await message.member.roles.remove(citizenRole).catch(err => console.error('Role Remove Error:', err));
                }

                // Set nickname to IG name
                await message.member.setNickname(igName).catch(err => console.error('Nickname Error:', err));

                // React with checkmark
                await message.react('✅');

                // Post approval to the log channel
                const logChannel = await message.guild.channels.fetch(PASSPORT_LOG_CHANNEL_ID).catch(() => null);
                if (logChannel) {
                    const approvalEmbed = new EmbedBuilder()
                        .setTitle('✅ Passport Approved')
                        .setColor('#22c55e')
                        .addFields(
                            { name: '👤 Discord User', value: `<@${message.author.id}>`, inline: true },
                            { name: '🎮 IG Name', value: `\`${igName}\``, inline: true }
                        )
                        .setFooter({ text: 'ONE PEACE ROLEPLAY • Passport System' })
                        .setTimestamp();

                    await logChannel.send({
                        content: `<@${message.author.id}> your passport has been approved! Enjoy your RP 🎉`,
                        embeds: [approvalEmbed]
                    });
                }

            } catch (dbErr) {
                console.error('Passport DB Error:', dbErr);
                await message.reply('❌ An error occurred while verifying your IG name. Please try again later.');
            }
        }

    } catch (err) {
        console.error('Command Execution Error:', err);
    }
});

client.on('interactionCreate', async (interaction) => {
    
    // --- 1. USER SELECT MENU HANDLERS ---
    if (interaction.isUserSelectMenu()) {
        const userIsAdmin = hasAdminAccess(interaction.member);

        // Adding User Process
        if (interaction.customId === 'add_user_select') {
            if (!userIsAdmin) return await interaction.reply({ content: '❌ Only Admins can use this feature!', ephemeral: true });

            const targetUserId = interaction.values[0];
            try {
                await interaction.channel.permissionOverwrites.edit(targetUserId, {
                    ViewChannel: true,
                    SendMessages: true,
                    AttachFiles: true,
                    ReadMessageHistory: true
                });

                await interaction.reply({ content: `✅ Successfully added <@${targetUserId}> to this ticket!` });
            } catch (err) {
                console.error('Add User Error:', err);
                await interaction.reply({ content: '❌ Failed to add user. Check bot permissions.', ephemeral: true });
            }
            return;
        }

        // Removing User Process
        if (interaction.customId === 'remove_user_select') {
            if (!userIsAdmin) return await interaction.reply({ content: '❌ Only Admins can use this feature!', ephemeral: true });

            const targetUserId = interaction.values[0];
            const meta = ticketMeta.get(interaction.channel.id);

            if (meta && meta.ownerId === targetUserId) {
                return await interaction.reply({ content: '❌ You cannot remove the ticket owner/creator!', ephemeral: true });
            }

            try {
                await interaction.channel.permissionOverwrites.delete(targetUserId);
                await interaction.reply({ content: `🚫 Successfully removed <@${targetUserId}> from this ticket!` });
            } catch (err) {
                console.error('Remove User Error:', err);
                await interaction.reply({ content: '❌ Failed to remove user.', ephemeral: true });
            }
            return;
        }
    }

    // --- 2. MODAL SUBMIT HANDLERS ---
    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'rename_ticket_modal') {
            if (!hasAdminAccess(interaction.member)) {
                return await interaction.reply({ content: '❌ Only Admins can rename tickets!', ephemeral: true });
            }

            const newName = interaction.fields.getTextInputValue('new_ticket_name');
            try {
                await interaction.channel.setName(newName);
                await interaction.reply({ content: `✅ Ticket renamed to **${newName}**!`, ephemeral: true });
            } catch (err) {
                console.error('Rename Error:', err);
                await interaction.reply({ content: '❌ Failed to rename channel. Check bot permissions.', ephemeral: true });
            }
            return;
        }

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

    // --- 3. SLASH COMMAND HANDLER ---
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

    // --- 4. NAME CHANGE BUTTON CLICK HANDLERS ---
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

    if (interaction.customId.startsWith('nc_accept_')) {
        if (!hasAdminAccess(interaction.member)) {
            return await interaction.reply({ content: '❌ Only Admins can approve applications!', ephemeral: true });
        }

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

    if (interaction.customId.startsWith('nc_reject_')) {
        if (!hasAdminAccess(interaction.member)) {
            return await interaction.reply({ content: '❌ Only Admins can deny applications!', ephemeral: true });
        }

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

    // --- 5. ATTENDANCE BUTTON CLICK HANDLER ---
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

    // --- 6. TICKET SYSTEM HANDLERS ---
    const userIsAdmin = hasAdminAccess(interaction.member);

    const configMap = {
        'ticket_frp': { name: 'FRP', categoryId: CATEGORIES.FRP, allowAdmin: true },
        'ticket_gang_frp': { name: 'Gang FRP', categoryId: CATEGORIES.GANG_FRP, allowAdmin: true },
        'ticket_help': { name: 'Help', categoryId: CATEGORIES.HELP, allowAdmin: true },
        'ticket_faction_app': { name: 'Faction Application', categoryId: CATEGORIES.FACTION_APP, specificRoleId: FACTION_ROLE_ID, allowAdmin: false },
        'ticket_gang_app': { name: 'Gang Application', categoryId: CATEGORIES.GANG_APP, specificRoleId: GANG_ROLE_ID, allowAdmin: false },
        'ticket_vip': { name: 'VIP', categoryId: CATEGORIES.VIP, allowAdmin: false },
        'ticket_admin_app': { name: 'Admin Application', categoryId: CATEGORIES.ADMIN_APP, allowAdmin: false }
    };

    const selectedConfig = configMap[interaction.customId];

    if (selectedConfig) {
        try {
            if (!userIsAdmin) {
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

            const permissionOverwrites = [
                {
                    id: interaction.guild.id,
                    deny: [PermissionFlagsBits.ViewChannel],
                },
                {
                    id: interaction.user.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory],
                }
            ];

            if (selectedConfig.allowAdmin && ADMIN_ROLE_ID) {
                permissionOverwrites.push({
                    id: ADMIN_ROLE_ID,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory],
                });
            } else if (ADMIN_ROLE_ID) {
                permissionOverwrites.push({
                    id: ADMIN_ROLE_ID,
                    deny: [PermissionFlagsBits.ViewChannel],
                });
            }

            if (selectedConfig.specificRoleId) {
                permissionOverwrites.push({
                    id: selectedConfig.specificRoleId,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory],
                });
            }

            const channelOptions = {
                name: channelName,
                type: ChannelType.GuildText,
                permissionOverwrites: permissionOverwrites,
            };

            if (selectedConfig.categoryId && selectedConfig.categoryId.length > 10) {
                channelOptions.parent = selectedConfig.categoryId;
            }

            const channel = await interaction.guild.channels.create(channelOptions);
            ticketMeta.set(channel.id, { ownerId: interaction.user.id, roleId: selectedConfig.specificRoleId || null, claimedBy: null });

            const ticketEmbed = new EmbedBuilder()
                .setColor('#E6A100')
                .setTitle(`✨ Ticket #${ticketNumber}`)
                .setDescription(`🏷️ **Category:** \`${selectedConfig.name}\`\n👤 **Owner:** <@${interaction.user.id}>\n🛠️ **Status:** \`Not Claimed\`\n\n-------------------------\n📨 **Please state your issue clearly.**\n-------------------------`)
                .setFooter({ text: 'ONE PEACE ROLEPLAY Support Team' })
                .setTimestamp();

            const controlButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('claim_ticket').setLabel('Claim').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('unclaim_ticket').setLabel('Unclaim').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('add_user_ticket').setLabel('Add User').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('remove_user_ticket').setLabel('Remove User').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('close_ticket').setLabel('Close').setStyle(ButtonStyle.Danger)
            );

            let tagContent = `<@${interaction.user.id}> <@&${ADMIN_ROLE_ID}>`;
            if (selectedConfig.specificRoleId) {
                tagContent += ` <@&${selectedConfig.specificRoleId}>`;
            }

            await channel.send({
                content: tagContent,
                embeds: [ticketEmbed],
                components: [controlButtons]
            });

            await interaction.reply({ content: `Your ticket has been created: ${channel}`, ephemeral: true });
        } catch (err) {
            console.error('Ticket Creation Error:', err);
            await interaction.reply({ content: 'Error creating ticket.', ephemeral: true });
        }
    }

    // --- CLAIM TICKET HANDLER ---
    if (interaction.customId === 'claim_ticket') {
        if (!userIsAdmin) return await interaction.reply({ content: '❌ **Only Admins can claim tickets!**', ephemeral: true });

        const meta = ticketMeta.get(interaction.channel.id) || {};
        if (meta.claimedBy) {
            return await interaction.reply({ content: `❌ This ticket is already claimed by <@${meta.claimedBy}>!`, ephemeral: true });
        }

        try {
            await interaction.channel.permissionOverwrites.edit(ADMIN_ROLE_ID, { ViewChannel: false });
            await interaction.channel.permissionOverwrites.edit(interaction.user.id, {
                ViewChannel: true,
                SendMessages: true,
                AttachFiles: true,
                ReadMessageHistory: true
            });

            meta.claimedBy = interaction.user.id;
            ticketMeta.set(interaction.channel.id, meta);

            await interaction.reply({ content: `✅ Ticket claimed by <@${interaction.user.id}>!` });
        } catch (err) {
            console.error('Claim Error:', err);
            await interaction.reply({ content: '❌ Failed to claim ticket. Check bot permissions.', ephemeral: true });
        }
    }

    // --- UNCLAIM TICKET HANDLER ---
    if (interaction.customId === 'unclaim_ticket') {
        if (!userIsAdmin) return await interaction.reply({ content: '❌ **Only Admins can unclaim tickets!**', ephemeral: true });

        const meta = ticketMeta.get(interaction.channel.id) || {};
        if (!meta.claimedBy) {
            return await interaction.reply({ content: '❌ This ticket is not claimed yet!', ephemeral: true });
        }

        try {
            await interaction.channel.permissionOverwrites.edit(ADMIN_ROLE_ID, {
                ViewChannel: true,
                SendMessages: true,
                AttachFiles: true,
                ReadMessageHistory: true
            });

            meta.claimedBy = null;
            ticketMeta.set(interaction.channel.id, meta);

            await interaction.reply({ content: `⚠️ Ticket unclaimed!` });
        } catch (err) {
            console.error('Unclaim Error:', err);
            await interaction.reply({ content: '❌ Failed to unclaim ticket.', ephemeral: true });
        }
    }

    // --- ADD USER BUTTON CLICK (Show Searchable User Menu) ---
    if (interaction.customId === 'add_user_ticket') {
        if (!userIsAdmin) return await interaction.reply({ content: '❌ **Only Admins can add users to tickets!**', ephemeral: true });

        const userSelect = new UserSelectMenuBuilder()
            .setCustomId('add_user_select')
            .setPlaceholder('Select or Search a member to ADD...')
            .setMinValues(1)
            .setMaxValues(1);

        const row = new ActionRowBuilder().addComponents(userSelect);

        await interaction.reply({
            content: '🔍 Search and select the user you want to add:',
            components: [row],
            ephemeral: true
        });
        return;
    }

    // --- REMOVE USER BUTTON CLICK (Show Searchable User Menu) ---
    if (interaction.customId === 'remove_user_ticket') {
        if (!userIsAdmin) return await interaction.reply({ content: '❌ **Only Admins can remove users from tickets!**', ephemeral: true });

        const userSelect = new UserSelectMenuBuilder()
            .setCustomId('remove_user_select')
            .setPlaceholder('Select or Search a member to REMOVE...')
            .setMinValues(1)
            .setMaxValues(1);

        const row = new ActionRowBuilder().addComponents(userSelect);

        await interaction.reply({
            content: '🔍 Search and select the user you want to remove:',
            components: [row],
            ephemeral: true
        });
        return;
    }

    if (interaction.customId === 'rename_ticket') {
        if (!userIsAdmin) return await interaction.reply({ content: '❌ **Only Admins can rename tickets!**', ephemeral: true });

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
        if (!userIsAdmin) {
            return await interaction.reply({ 
                content: '❌ **Only Admins can close this ticket.**', 
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
