/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const logger = require("firebase-functions/logger");
const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

// We use raw onRequest to handle the webhook to ensure we can reply
// using the response object, avoiding outbound network calls (which are blocked on Spark plan).

exports.telegramBot = functions.https.onRequest(async (req, res) => {
  // 1. Validation: Check for Secret Token
  const secretToken = req.headers["x-telegram-bot-api-secret-token"];
  // We use a config variable for the secret.
  // User must set this via: firebase functions:config:set telegram.webhook_secret="YOUR_SECRET"
  // And when setting webhook: https://api.telegram.org/bot<TOKEN>/setWebhook?url=<URL>&secret_token=<YOUR_SECRET>
  const config = functions.config().telegram;
  const expectedSecret = config && config.webhook_secret;

  if (expectedSecret && secretToken !== expectedSecret) {
    logger.warn("Unauthorized webhook attempt", { header: secretToken });
    return res.status(403).send("Unauthorized");
  }

  // 2. Parse Update
  const update = req.body;

  // If no message, just return 200
  if (!update || !update.message) {
    return res.status(200).send("OK");
  }

  const message = update.message;
  const chatId = message.chat.id;
  const text = message.text;

  // 3. Handle /start command
  // Logic: When user sends /start, reply with Welcome message + Resume Button
  if (text === "/start") {
    // TRACKING: Save visitor to Firestore
    const user = message.from;
    try {
      await admin.firestore().collection("visitors").doc(String(user.id)).set({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        username: user.username || "",
        last_seen: admin.firestore.FieldValue.serverTimestamp(),
        visit_count: admin.firestore.FieldValue.increment(1),
      }, { merge: true });
      logger.info("Visitor tracked", { userId: user.id, username: user.username });
    } catch (error) {
      logger.error("Failed to track visitor", error);
    }

    // Construct the response payload for Telegram Webhook
    // This allows us to send a message WITHOUT making an outbound HTTP request.
    const responsePayload = {
      method: "sendMessage",
      chat_id: chatId,
      text: "Hi, I'm Sai\nEmbedded Software Engineer",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "📄 View My Resume",
              // web_app type opens the URL inside Telegram
              web_app: { url: "https://tnvsai.github.io/resume/" },
            },
          ],
        ],
      },
    };

    // Log for debugging
    logger.info("Received /start, sending welcome message.");

    return res.status(200).json(responsePayload);
  }

  // Handle other messages (Default response or ignore)
  // For now, just ignore other messages to be minimal.
  return res.status(200).send("OK");
});
