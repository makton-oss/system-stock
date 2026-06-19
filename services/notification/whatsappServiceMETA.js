async function sendWhatsAppMeta(phoneNumber, text) {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v20.0/${process.env.META_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.META_ACCESS_TOKEN}`
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phoneNumber,
          type: "text",
          text: { body: text }
        })
      }
    );

    const json = await response.json();

    if (!response.ok) {
      console.log("❌ META HTTP ERROR:", json);
      return { ok: false };
    }

    if (json.error) {
      console.log("❌ META API ERROR:", json.error);

      if (json.error.code === 131047) {
        return { ok: false, reason: "24h_window" };
      }

      return { ok: false };
    }

    return { ok: true };

  } catch (err) {
    console.log("❌ META SEND FAIL:", err);
    return { ok: false };
  }
}

module.exports = { sendWhatsAppMeta };