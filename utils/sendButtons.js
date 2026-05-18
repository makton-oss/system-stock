async function sendButtons(phoneNumber, text, buttons = []) {
  try {
    const response = await fetch( process.env.BOTCOMMERCE_BUTTONS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiToken: process.env.BOTCOMMERCE_API,
          phone_number_id: process.env.PHONE_NUMBER_ID,
          phone_number: phoneNumber,
          message: text,
          buttons: buttons
        })
      }
    );

    const resText = await response.text();

    if (!response.ok) {
      console.log("❌ BUTTON HTTP ERROR:", resText);
      return { ok: false };
    }

    try {
      const json = JSON.parse(resText);

      if (json.status !== "1") {
        console.log("❌ BUTTON FAIL:", json);

        if (json.message?.includes("24 hour")) {
          return { ok: false, reason: "24h_window" };
        }

        return { ok: false };
      }

      return { ok: true };

    } catch {
      return { ok: true };
    }

  } catch (err) {
    console.log("❌ BUTTON SEND FAIL:", err);
    return { ok: false };
  }
}

module.exports = { sendButtons };