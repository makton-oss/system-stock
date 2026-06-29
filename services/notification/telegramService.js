const BASE_URL = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

async function sendTelegram(chatId, text) {
  try {
    const response = await fetch(`${BASE_URL}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML"
      })
    });

    const json = await response.json();

    if (!json.ok) {
      console.log("❌ TELEGRAM SEND ERROR:", json);
      return { ok: false };
    }

    return { ok: true };

  } catch (err) {
    console.log("❌ TELEGRAM SEND FAIL:", err);
    return { ok: false };
  }
}

async function sendButtonsTelegram(chatId, message, buttons) {
  try {
    // Telegram inline keyboard — 2 buttons per row
    const rows = [];
    for (let i = 0; i < buttons.length; i += 2) {
      const row = buttons.slice(i, i + 2).map(b => ({
        text: b.title,
        callback_data: b.id.slice(0, 64) // Telegram max 64 chars
      }));
      rows.push(row);
    }

    const response = await fetch(`${BASE_URL}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: rows
        }
      })
    });

    const json = await response.json();

    if (!json.ok) {
      console.log("❌ TELEGRAM BUTTON ERROR:", json);
      return { ok: false };
    }

    return { ok: true };

  } catch (err) {
    console.log("❌ TELEGRAM BUTTON FAIL:", err);
    return { ok: false };
  }
}

async function answerCallbackQuery(callbackQueryId, text = "✅") {
  try {
    await fetch(`${BASE_URL}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text
      })
    });
  } catch (err) {
    console.log("❌ ANSWER CALLBACK ERROR:", err);
  }
}

async function requestContact(chatId) {
  try {
    const response = await fetch(`${BASE_URL}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "👋 Sila kongsikan nombor telefon anda untuk mendaftar.\n\nContoh: <code>60135835253</code>\n\nTekan butang di bawah atau taip nombor telefon anda.",
        parse_mode: "HTML",
        reply_markup: {
          keyboard: [[{
            text: "📱 Kongsi Nombor Telefon",
            request_contact: true
          }]],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      })
    });

    const json = await response.json();
    if (!json.ok) console.log("❌ REQUEST CONTACT ERROR:", json);

  } catch (err) {
    console.log("❌ REQUEST CONTACT FAIL:", err);
  }
}

module.exports = {
  sendTelegram,
  sendButtonsTelegram,
  answerCallbackQuery,
  requestContact
};