import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import ccxt from "ccxt";
import moment from "moment";

dotenv.config();

class Bot {
  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    this.tele = new Telegraf(process.env.BOT_TOKEN);
    this.binance = new ccxt.binance({
      apiKey: process.env.APIKey,
      secret: process.env.SecretKey,
    });
    this.binance.setSandboxMode(true);
    this.binance.options = { adjustForTimeDifference: true };
    this.userChatId = null;
  }

  async fetchAndAnalyze() {
    const prices = await this.binance.fetchOHLCV("ETH/USDT", "1h");
    const bPrices = prices.map((price) => ({
      timestamp: moment(price[0]).format("YYYY-MM-DD HH:mm:ss"),
      open: price[1],
      high: price[2],
      close: price[3],
      volume: price[4],
    }));

    const formattedData = bPrices
      .map(
        (p) =>
          `Thời gian: ${p.timestamp}, Open: ${p.open}, High: ${p.high}, Close: ${p.close}, Volume: ${p.volume}`
      )
      .join("\n");

    const input = `Dữ liệu ETH/USDT:\n${formattedData}\n\n
        Phân tích và đưa ra điểm vào lệnh mua phù hợp.\n\n
        Trả lời dưới dạng \n B[giá mua] V[số lượng mua(không quá $100)] S[chốt lời 12 - 15% là có thể chốt lời rồi] ví dụ B118390 V0.00084 S135278 
        định dạng vào lệnh bắt buộc phải ở sau cùng để mình có thể xử lí nó như đầu vào của code
    `;

    const response = await this.ai.models.generateContent({
      model: "gemini-2.0-flash-001",
      contents: input,
    });

    return response.text.replace(/[*_~`]/g, "");
  }

  async main() {
    this.tele.on(message("text"), async (ctx) => {
      this.userChatId = ctx.chat.id;

      const analysis = await this.fetchAndAnalyze();
      await ctx.reply(analysis);
    });

    // Gửi tự động
    setInterval(async () => {
      if (!this.userChatId) return;

      const analysis = await this.fetchAndAnalyze();
      await this.tele.telegram.sendMessage(this.userChatId, analysis);
    }, 200000);

    this.tele.launch();
    console.log("✅ Bot is running...");
  }
}

const bot = new Bot();
bot.main();
