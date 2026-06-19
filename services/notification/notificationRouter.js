const { sendWhatsApp }     = require("./whatsappService");
const { sendWhatsAppMeta } = require("./whatsappServiceMETA");
const { sendButtons }      = require("./buttonService");
const { sendButtonsMeta }  = require("./buttonServiceMETA");

const USE_META = process.env.META_ENABLED === "true";

async function sendText(phoneNumber, text) {
  if (USE_META) return sendWhatsAppMeta(phoneNumber, text);
  return sendWhatsApp(phoneNumber, text);
}

async function sendButtonsRouter(phoneNumber, message, buttons) {
  if (USE_META) return sendButtonsMeta(phoneNumber, message, buttons);
  return sendButtons(phoneNumber, message, buttons);
}

module.exports = { sendText, sendButtonsRouter };