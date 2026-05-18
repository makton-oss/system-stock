
async function sendButtons(chatId, message, buttons) {
  try {
    const response = await fetch(process.env.BOTCOMMERCE_BUTTONS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiToken: process.env.BOTCOMMERCE_API,
        phone_number_id: process.env.PHONE_NUMBER_ID,
        phone_number: chatId,
        message: text,
        buttons: buttons.map(b => ({
          type: "reply",
          reply: {
            id: b.id,
            title: b.title
          }
        }))
      })
    });

    const resText = await response.text();

    try {
      const json = JSON.parse(resText);

      if (json.status !== "1") {
        console.log("❌ BUTTON FAIL:", json);
        return { ok: false };
      }

      return { ok: true };

    } catch {
      return { ok: true };
    }

  } catch (err) {
    console.log("❌ BUTTON ERROR:", err);
    return { ok: false };
  }
}

module.exports = { sendButtons };