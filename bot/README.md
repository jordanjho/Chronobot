# Chronobot

Chronobot is a Discord scheduling bot that allows users to automate sending messages, images, videos, and GIFs to Discord channels at specified times and frequencies. It supports per-user scheduling limits, multi-line message formatting, and timezone-aware scheduling and display.

## Features

- **Schedule Messages:** Use slash commands to schedule messages to be sent once, daily, or weekly.
- **Multi-line Content:** Supports rich, multi-line message formatting via Discord modals.
- **Attachments:** Schedule messages with images, videos, or GIFs.
- **Timezone Support:** Users can set their timezone; all scheduling and listing is localized.
- **Per-user Limits:** Each user can have up to 5 scheduled messages at a time.
- **Secure Editing/Deleting:** Only the user who scheduled a message can edit or delete it.
- **Persistent Scheduling:** Scheduled messages are restored automatically after bot restarts.
- **Efficient Data Retrieval:** Indexed database queries for scalable performance.

## Technologies Used

- Node.js
- discord.js
- sqlite3
- node-schedule
- dayjs (+ timezone plugins)

## Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/chronobot.git
   cd chronobot
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Discord credentials:**
   - Create a `config.json` file with your bot token, client ID, and (optionally) guild ID:
     ```json
     {
       "token": "YOUR_BOT_TOKEN",
       "clientId": "YOUR_CLIENT_ID",
       "guildId": "YOUR_GUILD_ID"
     }
     ```

4. **Run the bot:**
   ```bash
   node index.js
   ```

## Usage

### Commands

- `/schedule <frequency> <timestamp> <content> [attachment]`
  - Schedule a message. Frequency: once, daily, weekly. Timestamp format: `YYYY-MM-DD HH:mm` (your local time).
  - Content input is multi-line via modal.
- `/settimezone <timezone>`
  - Set your timezone (e.g. `America/New_York`). Used for scheduling and displaying times.
- `/list`
  - List all your scheduled messages, with times shown in your timezone.
- `/edit <id> [content] [attachment]`
  - Edit your scheduled message. Only your own messages can be edited.
- `/delete <id>`
  - Delete your scheduled message. Only your own messages can be deleted.
- `/help`
  - Show all commands.

## Example

1. Set your timezone:
   ```
   /settimezone America/Los_Angeles
   ```

2. Schedule a message:
   ```
   /schedule daily 2025-08-01 14:00
   ```
   - Enter your message in the modal that appears.

3. List your scheduled messages:
   ```
   /list
   ```

## Contributing

Pull requests and suggestions are welcome! Please open an issue for bugs or feature requests.

## License

MIT License

---

**Chronobot** is designed for Discord communities that need reliable, timezone-aware message automation with rich formatting and secure user controls.
