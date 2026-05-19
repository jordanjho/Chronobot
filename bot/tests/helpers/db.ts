import sqlite3 from 'sqlite3';

/**
 * Creates an in-memory SQLite database with the messages table schema.
 * Use this in tests instead of the real database.
 */
export function createTestDb(): sqlite3.Database {
  const db = new sqlite3.Database(':memory:');

  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id TEXT,
    send_times TEXT,
    content TEXT,
    frequency TEXT,
    attachment_url TEXT,
    user_id TEXT
  )`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_user_id ON messages(user_id)`);

  return db;
}

export function insertMessage(
  db: sqlite3.Database,
  msg: {
    channel_id: string;
    send_times: string[];
    content: string;
    frequency: string;
    attachment_url?: string | null;
    user_id: string;
  },
): Promise<number> {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO messages (channel_id, send_times, content, frequency, attachment_url, user_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        msg.channel_id,
        JSON.stringify(msg.send_times),
        msg.content,
        msg.frequency,
        msg.attachment_url ?? null,
        msg.user_id,
      ],
      function(this: { lastID: number }, err: Error | null) {
        if (err) reject(err);
        else resolve(this.lastID);
      },
    );
  });
}

export function getMessages(
  db: sqlite3.Database,
  userId: string,
): Promise<Array<{
  id: number;
  channel_id: string;
  send_times: string;
  content: string;
  frequency: string;
  attachment_url: string | null;
  user_id: string;
}>> {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM messages WHERE user_id = ?`,
      [userId],
      (err: Error | null, rows) => {
        if (err) reject(err);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        else resolve(rows as any);
      },
    );
  });
}

export function closeDb(db: sqlite3.Database): Promise<void> {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}
