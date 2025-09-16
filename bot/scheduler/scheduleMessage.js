import schedule from "node-schedule";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter.js";
import { client } from "../index.js";
import db from "../db/database.js";

dayjs.extend(utc);
dayjs.extend(isSameOrAfter);

export default function scheduleMessage(
  id,
  channelId,
  isoTime,
  content,
  attachmentUrl
) {
  const date = new Date(isoTime);
  schedule.scheduleJob(`${id}-${isoTime}`, date, async () => {
    try {
      // Fetch the latest content and attachment from the DB
      db.get(
        `SELECT content, attachment_url FROM messages WHERE id = ?`,
        [id],
        async (err, row) => {
          if (err || !row) return;
          const channel = await client.channels.fetch(channelId);
          if (channel) {
            const payload = { content: row.content };
            if (row.attachment_url) payload.files = [row.attachment_url];
            await channel.send(payload);
          }
        }
      );
    } catch (err) {
      console.error(`Failed to send scheduled message ${id}:`, err);
    }

    db.get(`SELECT send_times FROM messages WHERE id = ?`, [id], (err, row) => {
      if (err || !row) return;
      let times = JSON.parse(row.send_times);
      times = times.filter((t) => t !== isoTime);
      if (times.length === 0) db.run(`DELETE FROM messages WHERE id = ?`, [id]);
      else
        db.run(`UPDATE messages SET send_times = ? WHERE id = ?`, [
          JSON.stringify(times),
          id,
        ]);
    });
  });
}
