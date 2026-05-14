async function notifyBatch(targets, send, text) {
  const batchSize = 5;

  for (let i = 0; i < targets.length; i += batchSize) {
    const batch = targets.slice(i, i + batchSize);

    const results = await Promise.allSettled(
      batch.map(u => send(u.chat_id, text))
    );

    results.forEach((r, i) => {
      if (r.status === "rejected") {
        console.log("SEND FAIL:", batch[i].chat_id);
      }
    });

    await new Promise(r => setTimeout(r, 500));
  }
}

module.exports = { notifyBatch };