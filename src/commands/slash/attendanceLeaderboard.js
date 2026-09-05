const { EmbedBuilder } = require('discord.js');
const { attendanceData } = require('../../state');

module.exports = async function handleAttendanceLeaderboard(interaction) {
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
};
