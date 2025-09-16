
import scheduleMessage from "./scheduleMessage.js"
import db from "../db/database.js";

export default function restoreScheduledMessages() {
  db.all(`SELECT * FROM messages`, [], (err, rows) => {
    if (err) return console.error("Failed to restore messages:", err);
    for (const row of rows) {
      const times = JSON.parse(row.send_times);
      times.forEach((time) =>
        scheduleMessage(
          row.id,
          row.channel_id,
          time,
          row.content,
          row.attachment_url
        )
      );
    }
  });
}