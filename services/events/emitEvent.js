const listeners = require("./listeners");

async function emitEvent(event, payload) {

  const handlers =
    listeners[event] || [];

  for (const handler of handlers) {

    try {

      await handler(payload);

    } catch (err) {

      console.log(
        "EVENT ERROR:",
        event,
        err
      );
    }
  }
}

module.exports = { emitEvent };