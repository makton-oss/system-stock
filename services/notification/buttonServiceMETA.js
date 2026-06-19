async function sendButtonsMeta(phoneNumber, message, buttons) {
  try {
    // Meta max 3 buttons per message — split if needed
    const chunks = [];
    for (let i = 0; i < buttons.length; i += 3) {
      chunks.push(buttons.slice(i, i + 3));
    }

    for (const chunk of chunks) {
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
            type: "interactive",
            interactive: {
              type: "button",
              body: { text: message },
              action: {
                buttons: chunk.map(b => ({
                  type: "reply",
                  reply: {
                    id: b.id.slice(0, 256),     // Meta max 256 chars
                    title: b.title.slice(0, 20)  // Meta max 20 chars
                  }
                }))
              }
            }
          })
        }
      );

      const json = await response.json();

      if (!response.ok || json.error) {
        console.log("❌ META BUTTON ERROR:", json);
        return { ok: false };
      }
    }

    return { ok: true };

  } catch (err) {
    console.log("❌ META BUTTON FAIL:", err);
    return { ok: false };
  }
}

module.exports = { sendButtonsMeta };