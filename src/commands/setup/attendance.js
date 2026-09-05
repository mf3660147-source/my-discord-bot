const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = async function setupAttendance(message) {
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
};
