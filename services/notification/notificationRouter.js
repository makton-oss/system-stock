const { sendWhatsApp }     = require("./whatsappService");
const { sendWhatsAppMeta } = require("./whatsappServiceMETA");
const { sendButtons }      = require("./buttonService");
const { sendButtonsMeta }  = require("./buttonServiceMETA");

async function sendText(phoneNumber, text, channel = "botcommerce") {
  if (channel === "meta") return sendWhatsAppMeta(phoneNumber, text);
  return sendWhatsApp(phoneNumber, text);
}

async function sendButtonsRouter(phoneNumber, message, buttons, channel = "botcommerce") {
  if (channel === "meta") return sendButtonsMeta(phoneNumber, message, buttons);
  return sendButtons(phoneNumber, message, buttons);
}

module.exports = { sendText, sendButtonsRouter };