require("dotenv").config();

(async () => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const url   = process.env.APP_URL; // APP_URL dah include /webhook/telegram

  console.log("Registering webhook:", url);

  const res = await fetch(
    `https://api.telegram.org/bot${token}/setWebhook`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    }
  );

  const json = await res.json();
  console.log("REGISTER RESULT:", json);
})();