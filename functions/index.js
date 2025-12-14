/**
 * Import function triggers from their respective submodules:
 * Deploy Timestamp: 2025-12-15 01:10
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

  if (!update) {
    return res.status(200).send("OK");
  }

  // A. HANDLE MESSAGES
  if (update.message) {
    const message = update.message;
    const chatId = message.chat.id;
    const text = message.text;

    // Handle /start command
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

      const responsePayload = {
        method: "sendMessage",
        chat_id: chatId,
        text: "Hi, I'm Sai\nHow can I help you?",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "📄 View My Resume", web_app: { url: "https://tnvsai.github.io/resume/" } },
            ],
            [
              { text: "🚀 Projects", callback_data: "show_projects" },
              { text: "📬 Contact", callback_data: "show_contact" },
            ],
          ],
        },
      };
      return res.status(200).json(responsePayload);
    }
  }

  // B. HANDLE CALLBACK QUERIES (Button Clicks)
  if (update.callback_query) {
    const callbackQuery = update.callback_query;
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    let responseText = "";

    if (data === "show_projects") {
      responseText = "🚀 **My Key Projects**\n\n" +
        "1. **STM32F103RB_Baremetal**\n" +
        "   baremetal project for STM32F103RB.\n" +
        "   [View on GitHub](https://github.com/tnvsai/STM32F103RB_Baremetal)\n\n" +
        "2. **YatraMate**\n" +
        "   smart display for bike.\n" +
        "   [View on GitHub](https://github.com/tnvsai/YatraMate)\n\n" +
        "3. **NagaCryptTool**\n" +
        "   encryption tool.\n" +
        "   [View on GitHub](https://github.com/tnvsai/NagaCryptTool)"
        ;
    } else if (data === "show_contact") {
      responseText = "📬 **Contact Me**\n\n" +
        "• **GitHub**: [tnvsai](https://github.com/tnvsai)\n" +
        "• **Email**: tnvsai@gmail.com\n" +
        "• **Youtube**: [Sai Tadepalli](https://www.youtube.com/@tnvsai)\n";
    }

    if (responseText) {
      // We answer the callback query and send a new message
      const responsePayload = {
        method: "sendMessage",
        chat_id: chatId,
        text: responseText,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      };
      return res.status(200).json(responsePayload);
    }
  }

  return res.status(200).send("OK");
});
