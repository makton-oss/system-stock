const webpush = require("web-push");
const supabase = require("../db");

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// ======================
// SEND PUSH — ke semua device yang subscribe
// payload: { title, body, url, tag }
// ======================
async function sendPushNotification(payload = {}) {

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("*");

  if (error) {
    console.log("PUSH_SUBS_FETCH_ERROR:", error);
    return;
  }

  if (!subs?.length) {
    console.log("PUSH SKIP — tiada device subscribed");
    return;
  }

  const body = JSON.stringify({
    title: payload.title || "StokBot",
    body:  payload.body  || "",
    url:   payload.url   || "/admin/logs.html",
    tag:   payload.tag
  });

  await Promise.all(
    subs.map(async (sub) => {

      const subscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth }
      };

      try {
        await webpush.sendNotification(subscription, body);
      } catch (err) {

        // ======================
        // 410 Gone / 404 = subscription dah invalid
        // (uninstall app, clear browser data, dll) — cleanup
        // ======================
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          console.log("🧹 REMOVED STALE PUSH SUBSCRIPTION:", sub.endpoint);
        } else {
          console.log("PUSH_SEND_ERROR:", err.statusCode, err.message);
        }
      }
    })
  );
}

module.exports = { sendPushNotification };
