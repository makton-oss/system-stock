// ======================
// WHATSAPP SENDER
// ======================
async function sendWhatsApp(phoneNumber, text) {
  try {
    const response = await fetch(process.env.BOTCOMMERCE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiToken: process.env.BOTCOMMERCE_API,
        phone_number_id: process.env.PHONE_NUMBER_ID,
        phone_number: phoneNumber,
        message: text
      })
    });

    const resText = await response.text();

    if (!response.ok) {
      console.log("❌ HTTP ERROR:", resText);
      return { ok: false };
    }

    try {
      const json = JSON.parse(resText);

      if (json.status !== "1") {

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
    console.log("❌ SEND FAIL:", err);
    return { ok: false };
  }
}

module.exports = {
  sendWhatsApp
};