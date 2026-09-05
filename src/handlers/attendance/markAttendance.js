const { EmbedBuilder } = require('discord.js');
const { ATTENDANCE_LOG_CHANNEL_ID } = require('../../config/constants');
const { attendanceData, dailyLogs } = require('../../state');

module.exports = async function handleMarkAttendance(interaction) {
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
};
