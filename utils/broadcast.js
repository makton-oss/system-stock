function chunkArray(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendBatchMessages(users, message, sendFn, batchSize = 5, delay = 1000) {

  const batches = chunkArray(users, batchSize);

  let success = 0;
  let failed = 0;

  for (const batch of batches) {

    await Promise.all(
      batch.map(async (u) => {
        try {
          await sendFn(u.chat_id, message);
          success++;
        } catch (err) {
          failed++;
        }
      })
    );

    await sleep(delay);
  }

  return { success, failed };
}

module.exports = {
  sendBatchMessages
};