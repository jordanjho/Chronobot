import sqlite3 from "sqlite3";

const db = new sqlite3.Database("../shared/messages.db");

export default db;