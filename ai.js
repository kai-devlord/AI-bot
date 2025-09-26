import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import mysql2 from "mysql2";

dotenv.config();

class Bot {
  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    this.tele = new Telegraf(process.env.BOT_TOKEN);
  }

  // Hàm chia nhỏ tin nhắn
  splitMessage(text, maxLength = 4096) {
    const parts = [];
    while (text.length > 0) {
      parts.push(text.slice(0, maxLength));
      text = text.slice(maxLength);
    }
    return parts;
  }

  saveData(user, question, answer) {
    const connection = mysql2.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB,
      charset: "utf8mb4",
    });
    connection.connect((err) => {
      if (err) {
        console.error("Connect to database failed\n", err);
        throw err;
      }
      console.log("Connect to database success.\n");

      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS users (
          id BIGINT PRIMARY KEY,
          is_bot BOOLEAN,
          first_name VARCHAR(255),
          username VARCHAR(255),
          language_code VARCHAR(10),
          question TEXT,
          answer TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
      `;

      connection.query(createTableQuery, (err) => {
        if (err) {
          console.error("Create table failed\n", err);
          connection.end();
          return;
        }

        const insertQuery = `
          INSERT INTO users (id, is_bot, first_name, username, language_code, question, answer)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            is_bot = VALUES(is_bot),
            first_name = VALUES(first_name),
            username = VALUES(username),
            language_code = VALUES(language_code),
            question = VALUES(question),
            answer = VALUES(answer);
        `;

        if (user && question && answer) {
          const values = [
            user.id,
            user.is_bot,
            user.first_name,
            user.username,
            user.language_code,
            question,
            answer,
          ];

          connection.query(insertQuery, values, (err) => {
            if (err) {
              console.error("Insert user failed\n", err);
            } else {
              console.log("User saved successfully.\n");
            }
            connection.end();
          });
        }
      });
    });
  }

  async main() {
    this.tele.on(message("text"), async (ctx) => {
      const question = ctx.message.text;
      const user = ctx.from;

      const input = ctx.message.text;
      const response = await this.ai.models.generateContent({
        model: "gemini-2.0-flash-001",
        contents: input,
      });

      this.saveData(user, question, response.text);

      const cleanText = response.text.replace(/[*_~`]/g, "");
      const messages = this.splitMessage(cleanText);

      for (const msg of messages) {
        await ctx.reply(msg);
      }
    });

    this.tele.launch();
    console.log("Bot is running...");
  }
}

const bot = new Bot();
bot.main();
