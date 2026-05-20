const express = require("express");
require("dotenv").config();

const supabase = require("./services/db");
const handlerMap = require("./core/handlerMap");
const { createContext } = require("./core/context");
const { sendWhatsApp } = require("./utils/helpers");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ strict: false }));
app.use(express.urlencoded({ extended: true }));

app.get("/health", (req, res) => {
  res.send("OK");
});

async function reply(chatId, text) {

  try {

    console.log(
      "REPLY TO:",
      chatId,
      "|",
      text.slice(0, 50)
    );

    await sendWhatsApp(chatId, text);

  } catch (err) {

    console.error("REPLY ERROR:", err);
  }
}

// ======================
// WEBHOOK
// ======================
app.post("/webhook", async (req, res) => {

  let body =
    typeof req.body === "string"
      ? JSON.parse(req.body)
      : req.body || {};

  console.log(
    "WEBHOOK BODY:",
    JSON.stringify(body, null, 2)
  );

  const chatId = (
    body.chat_id ||
    body.subscriber_id ||
    body.user_id ||
    ""
  ).split("-")[0];

  if (!chatId) {
    return res.end();
  }

  // ======================
  // USER FETCH
  // ======================

  const {
    data: user,
    error: userError
  } = await supabase
    .from("users")
    .select("*, outlets(name)")
    .eq("chat_id", chatId)
    .maybeSingle();

  if (userError) {

    console.log(
      "USER FETCH ERROR:",
      userError
    );

    return res.end();
  }

  if (!user) {
    return res.end();
  }

  // ======================
  // MESSAGE PARSE
  // ======================

  let message =
    body.user_message ||
    body.message ||
    body.text ||
    "";

  // ======================
  // BUTTON PARSE
  // ======================

  const raw = body.user_message || "";

  if (raw.startsWith("#Button Reply#")) {

    const clean = raw
      .replace("#Button Reply#", "")
      .trim();

    const upperClean =
      clean.toUpperCase();

    console.log(
      "BUTTON CLICK:",
      clean
    );

    // ======================
    // APPROVE / REJECT SINGLE
    // ======================

    if (/^APPROVE \d+$/i.test(clean)) {

      message = upperClean;
    }

    else if (/^REJECT \d+$/i.test(clean)) {

      message = upperClean;
    }

    // ======================
    // APPROVE / REJECT ALL
    // ======================

    else if (
      upperClean.startsWith(
        "APPROVE_ALL_"
      )
    ) {

      message = upperClean;
    }

    else if (
      upperClean.startsWith(
        "REJECT_ALL_"
      )
    ) {

      message = upperClean;
    }

    // ======================
    // REPORT TYPE
    // ======================

    else if (
      upperClean.startsWith(
        "REPORT_TYPE"
      )
    ) {

      message = upperClean;
    }

    else if (
      [
        "SUMMARY",
        "INVENTORY",
        "FLOW"
      ].includes(upperClean)
    ) {

      message =
        `REPORT_MONTH ${upperClean}`;
    }

    // ======================
    // REPORT MONTH
    // ======================

    else if (

      upperClean === "CURRENT" ||

      /^[A-Z]{3}-\d{2}$/i.test(clean)

    ) {

      if (

        body.reply_message_id &&

        global.reportModeMap?.[chatId]

      ) {

        const mode =
          global.reportModeMap[chatId];

        message =
          `REPORT ${mode} ${clean.toLowerCase()}`;
      }
    }

    // ======================
    // DEFAULT
    // ======================

    else {

      message = upperClean;
    }
  }

  if (!message) {
    return res.end();
  }

  const parts =
    message
      .trim()
      .split(/\s+/);

  let type =
    parts[0]?.toUpperCase();

  // ======================
  // APPROVE ALL FIX
  // ======================

  if (
    type?.startsWith(
      "APPROVE_ALL_"
    )
  ) {

    type = "APPROVE";
  }

  // ======================
  // REJECT ALL FIX
  // ======================

  if (
    type?.startsWith(
      "REJECT_ALL_"
    )
  ) {

    type = "REJECT";
  }

  // ======================
  // REPORT MENU
  // ======================

  if (
    type === "REPORT" &&
    parts.length === 1
  ) {

    const handler =
      handlerMap.REPORTMENU;

    const ctx = createContext({
      chatId,
      user,
      parts,
      body: message,
      res,
      reply
    });

    return await handler(ctx);
  }

  if (!type) {
    return res.end();
  }

  const handler =
    handlerMap[type];

  if (!handler) {

    console.log(
      "NO HANDLER:",
      type
    );

    return res.end();
  }

  const ctx = createContext({
    chatId,
    user,
    parts,
    body: message,
    res,
    reply
  });

  try {

    return await handler(ctx);

  } catch (err) {

    console.error(
      "HANDLER ERROR:",
      err
    );

    await reply(
      chatId,
      "❌ SYSTEM ERROR"
    );

    return res.end();
  }
});

app.listen(PORT, () => {

  console.log(
    `🚀 Server running on port ${PORT}`
  );
});