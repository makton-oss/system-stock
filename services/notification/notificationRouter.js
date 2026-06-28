const { sendWhatsApp }        = require("./whatsappService");
const { sendWhatsAppMeta }    = require("./whatsappServiceMETA");
const { sendButtons }         = require("./buttonService");
const { sendButtonsMeta }     = require("./buttonServiceMETA");
const { sendTelegram, sendButtonsTelegram } = require("./telegramService");

async function sendText(phoneNumber, text, channel = "botcommerce") {
  if (channel === "meta")     return sendWhatsAppMeta(phoneNumber, text);
  if (channel === "telegram") return sendTelegram(phoneNumber, text);
  return sendWhatsApp(phoneNumber, text);
}

async function sendButtonsRouter(phoneNumber, message, buttons, channel = "botcommerce") {
  if (channel === "meta")     return sendButtonsMeta(phoneNumber, message, buttons);
  if (channel === "telegram") return sendButtonsTelegram(phoneNumber, message, buttons);
  return sendButtons(phoneNumber, message, buttons);
}

module.exports = { sendText, sendButtonsRouter };