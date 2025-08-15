import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";

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

  async main() {
    this.tele.on(message("text"), async (ctx) => {
      const user = ctx.from;
      console.log("👤 User:", user);

      const input = ctx.message.text;
      const response = await this.ai.models.generateContent({
        model: "gemini-2.0-flash-001",
        contents: input,
      });

      const cleanText = response.text.replace(/[*_~`]/g, "");
      const messages = this.splitMessage(cleanText);

      for (const msg of messages) {
        await ctx.reply(msg);
      }
    });

    this.tele.launch();
    console.log("✅ Bot is running...");
  }
}

const bot = new Bot();
bot.main();
