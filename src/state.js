// Shared in-memory state across all modules
// These Maps persist for the lifetime of the bot process

// അറ്റൻഡൻസ് സൂക്ഷിക്കുന്ന മെമ്മറി
const attendanceData = new Map(); // userId -> totalCount
const dailyLogs = new Map(); // userId -> lastDate

// ടിക്കറ്റ് ഓണറെ തിരിച്ചറിയാനും ടാസ്‌ക് ട്രാക്ക് ചെയ്യാനും
const ticketMeta = new Map(); // channelId -> { ownerId, roleId, claimedBy }
const totalClosedTickets = { count: 0 }; // object wrapper so mutations propagate

module.exports = {
    attendanceData,
    dailyLogs,
    ticketMeta,
    totalClosedTickets
};
