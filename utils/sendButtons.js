async function sendButtons(text, outletId, buttons) {
  const managers = await getManagersByOutlet(outletId);

  for (const m of managers) {
    await fetch(`${process.env.BOTCOMMERCE_BUTTONS}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiToken: process.env.BOTCOMMERCE_API,
        phone_number_id: process.env.PHONE_NUMBER_ID,
        phone_number: m.chat_id,
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
  }
}

module.exports = { sendButtons };