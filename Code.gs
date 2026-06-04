// Telegram bot Apps Script — updated with new TOKEN and Web App helpers
// IMPORTANT: For security, consider storing the token in Script Properties and remove the hardcoded token later.
var TOKEN = (function(){
  // Prefer token from Script Properties if set, otherwise fallback to the provided token below
  var prop = PropertiesService.getScriptProperties().getProperty('BOT_TOKEN');
  if (prop) return prop;
  return "8729282707:AAF26nrkfjDOi6oq7gr2U9FQ9fhWClMT43g"; // fallback token (you provided)
})();

var ADMIN_ID = 8485164743;
var API_URL = "https://api.telegram.org/bot" + TOKEN + "/";

// Agar Google Sheets bilan avtomatik ishlashni xohlasangiz, shu yerga Spreadsheet ID-ni joylang:
// Masalan: "1aBcD...XYZ"
var SPREADSHEET_ID = ""; // <-- BU YERNI TO'LDIRING agar avtomatik yozilsin

var RECEIPT_FOLDER_NAME = "Telegram Receipts";

// UC PAKETLARI
var UC_PACKAGES = [
  {name: "32 UC - 5.800 So'm", price: 5800, comp: "32"},
  {name: "63 UC - 11.500 So'm", price: 11500, comp: "63"},
  {name: "95 UC - 17.500 So'm", price: 17500, comp: "63+32"},
  {name: "126 UC - 23.000 So'm", price: 23000, comp: "63+63"},
  {name: "189 UC - 34.500 So'm", price: 34500, comp: "63+63+63"},
  {name: "252 UC - 46.000 So'm", price: 46000, comp: "63+63+63+63"},
  {name: "340 UC - 57.500 So'm", price: 57500, comp: "340"},
  {name: "435 UC - 74.800 So'm", price: 74800, comp: "340+63+32"},
  {name: "530 UC - 92.500 So'm", price: 92500, comp: "340+63+63+32+32"},
  {name: "690 UC - 115.000 So'm", price: 115000, comp: "690"},
  {name: "753 UC - 126.500 So'm", price: 126500, comp: "690+63"},
  {name: "816 UC - 138.000 So'm", price: 138000, comp: "690+63+63"},
  {name: "942 UC - 161.000 So'm", price: 161000, comp: "690+63+63+63+63"},
  {name: "1030 UC - 172.500 So'm", price: 172500, comp: "690+340"},
  {name: "1380 UC - 230.000 So'm", price: 230000, comp: "690+690"},
  {name: "1506 UC - 253.000 So'm", price: 253000, comp: "690+690+63+63"},
  {name: "1875 UC - 287.500 So'm", price: 287500, comp: "1875"},
  {name: "2565 UC - 413.000 So'm", price: 413000, comp: "1875+690"},
  {name: "4000 UC - 575.000 So'm", price: 575000, comp: "4000"},
  {name: "8400 UC - 1.150.000 So'm", price: 1150000, comp: "8400"},
  {name: "16800 UC - 2.300.000 So'm", price: 2300000, comp: "16800"}
];

function doPost(e) {
  if(typeof e !== 'undefined') {
    var update = JSON.parse(e.postData.contents);
    if(update.message) handleMessage(update.message);
    else if(update.callback_query) handleCallback(update.callback_query);
  }
  return HtmlService.createHtmlOutput("OK");
}

// Simple health-check GET endpoint for Web App
function doGet(e) {
  return HtmlService.createHtmlOutput("OK - Telegram Bot Web App is running.");
}

// Helper to set Telegram webhook to your deployed Web App URL
function setWebhook(webAppUrl) {
  if (!webAppUrl) throw new Error('Please provide the deployed Web App URL.');
  var url = API_URL + 'setWebhook?url=' + encodeURIComponent(webAppUrl);
  var resp = UrlFetchApp.fetch(url);
  return resp.getContentText();
}

function handleMessage(message) {
  var chatId = message.chat.id;
  var text = message.text;
  var messageId = message.message_id;
  var cache = CacheService.getScriptCache();
  var state = cache.get("state_" + chatId);
  var isEditing = cache.get("is_editing_" + chatId) === "true";

  function cleanChat() {
    var lastBotMsg = cache.get("last_msg_" + chatId);
    if (lastBotMsg) deleteMessage(chatId, lastBotMsg);
    deleteMessage(chatId, messageId);
  }

  // --- /START VA BEKOR QILISH FILTRI ---
  if (text === "/start" || text === "❌ Bekor qilish") {
    cleanChat();

    // Agar foydalanuvchi tahrirlash jarayonida bo'lsa, asosiy menyuga o'tkazmaymiz!
    if (isEditing) {
      var sent = sendMessage(chatId, "⚠️ <b>Sizda tahrirlanishi kerak bo'lgan buyurtma bor!</b>\nIltimos, avval PUBG ID raqamingizni kiriting:", {keyboard: [["🔙 Orqaga qaytish"]], resize_keyboard: true});
      cache.put("last_msg_" + chatId, sent.result.message_id, 3600);
      return;
    }

    cache.remove("state_" + chatId);
    var welcome = "👋 Assalomu alaykum Hurmatli mijozimiz....\nBu yerda siz:\n💸 UC sotib olishingiz\n🏆 Turnirlarga yozilishingiz\n🤝 PUBG account olish yoki sotishingiz\n🌐 YouTube xizmatlaridan foydalanishiz mumkin.\n\nKerakli bo'limni tanlang...👉";
    var sent = sendMessage(chatId, welcome, getMainKeyboard());
    cache.put("last_msg_" + chatId, sent.result.message_id, 3600);
    return;
  }

  // --- ASOSIY BO'LIMLAR (TAHRIR PAYTI BLOKLANADI) ---
  if (!isEditing) {
    if (text === "💸 UC Sotib olish") {
      cleanChat();
      cache.put("state_" + chatId, "SELECT_UC", 600);
      var sent = sendMessage(chatId, "📦 <b>PUBG UC Paketini tanlang:</b>", getUCKeyboard());
      cache.put("last_msg_" + chatId, sent.result.message_id, 3600);
      return;
    } 
    else if (text === "🏆 Turnirga yozilish") {
      cleanChat();
      cache.put("state_" + chatId, "SELECT_TOURNEY_TYPE", 600);
      var sent = sendMessage(chatId, "🏆 <b>Turnir turini tanlang:</b>", getTourneyTypeKeyboard());
      cache.put("last_msg_" + chatId, sent.result.message_id, 3600);
      return;
    }
    else if (text === "🌐 YouTube xizmati") {
      cleanChat();
      cache.put("state_" + chatId, "YT_SERVICES", 600);
      var sent = sendMessage(chatId, "🌐 <b>YouTube xizmatini tanlang:</b>", getYTKeyboard());
      cache.put("last_msg_" + chatId, sent.result.message_id, 3600);
      return;
    }
  }

  // --- ORQAGA QAYTISH MANTIQI ---
  if (text === "🔙 Orqaga qaytish") {
    cleanChat();
    // Tahrir paytida faqat ID kiritishga qaytaradi
    if (isEditing) {
      cache.put("state_" + chatId, "AWAITING_ID", 600);
      var sent = sendMessage(chatId, "🆔 <b>Yangi PUBG ID raqamingizni kiriting:</b>", {keyboard: [["🔙 Orqaga qaytish"]], resize_keyboard: true});
      cache.put("last_msg_" + chatId, sent.result.message_id, 3600);
      return;
    }

    if (state === "SELECT_UC" || state === "SELECT_TOURNEY_TYPE" || state === "YT_SERVICES") {
      cache.remove("state_" + chatId);
      var sent = sendMessage(chatId, "Asosiy menyu:", getMainKeyboard());
      cache.put("last_msg_" + chatId, sent.result.message_id, 3600);
    } 
    else if (state === "AWAITING_ID") {
      cache.put("state_" + chatId, "SELECT_UC", 600);
      var sent = sendMessage(chatId, "📦 <b>Paketni tanlang:</b>", getUCKeyboard());
      cache.put("last_msg_" + chatId, sent.result.message_id, 3600);
    }
    else if (state === "AWAITING_NICK") {
      cache.put("state_" + chatId, "AWAITING_ID", 600);
      var sent = sendMessage(chatId, "🆔 <b>PUBG ID raqamingizni qayta kiriting:</b>", {keyboard: [["🔙 Orqaga qaytish"]], resize_keyboard: true});
      cache.put("last_msg_" + chatId, sent.result.message_id, 3600);
    }
    else if (state === "AWAITING_RECEIPT") {
      cache.put("state_" + chatId, "AWAITING_NICK", 600);
      var sent = sendMessage(chatId, "🎮 <b>Nickname'ingizni qayta kiriting:</b>", {keyboard: [["🔙 Orqaga qaytish"]], resize_keyboard: true});
      cache.put("last_msg_" + chatId, sent.result.message_id, 3600);
    }
    else if (state === "SELECT_TURNIR_LEVEL") {
      cache.put("state_" + chatId, "SELECT_TOURNEY_TYPE", 600);
      var sent = sendMessage(chatId, "🏆 <b>Turnir turini tanlang:</b>", getTourneyTypeKeyboard());
      cache.put("last_msg_" + chatId, sent.result.message_id, 3600);
    }
    return;
  }

  // --- TURNIR MANTIQI ---
  if (state === "SELECT_TOURNEY_TYPE" && !isEditing) {
    if (text === "⚔️ TDM" || text === "🌍 KLASSIKA") {
      cleanChat();
      cache.put("state_" + chatId, "SELECT_TURNIR_LEVEL", 600);
      var sent = sendMessage(chatId, "🏆 " + text + " darajasini tanlang:", getTurnirLevelKeyboard());
      cache.put("last_msg_" + chatId, sent.result.message_id, 3600);
    }
    return;
  }

  // --- UC JARAYONI ---
  var pkgNames = UC_PACKAGES.map(function(p) { return p.name; });
  if (state === "SELECT_UC" && pkgNames.indexOf(text) !== -1 && !isEditing) {
    cleanChat();
    cache.put("chosen_pkg_idx_" + chatId, pkgNames.indexOf(text), 600);
    cache.put("state_" + chatId, "AWAITING_ID", 600);
    var sent = sendMessage(chatId, "🆔 <b>PUBG ID raqamingizni kiriting:</b>", {keyboard: [["🔙 Orqaga qaytish"]], resize_keyboard: true});
    cache.put("last_msg_" + chatId, sent.result.message_id, 3600);
  } 
  else if (state === "AWAITING_ID") {
    if (!/^\d+$/.test(text)) {
      cleanChat();
      var sent = sendMessage(chatId, "⚠️ <b>ID faqat raqamlardan iborat bo'lishi kerak!</b>\nIltimos, qaytadan kiriting:", {keyboard: [["🔙 Orqaga qaytish"]], resize_keyboard: true});
      cache.put("last_msg_" + chatId, sent.result.message_id, 3600);
      return;
    }
    cleanChat();
    cache.put("pubg_id_" + chatId, text, 600);
    cache.put("state_" + chatId, "AWAITING_NICK", 600);
    var sent = sendMessage(chatId, "🎮 <b>Nickname'ingizni kiriting:</b>", {keyboard: [["🔙 Orqaga qaytish"]], resize_keyboard: true});
    cache.put("last_msg_" + chatId, sent.result.message_id, 3600);
  } 
  else if (state === "AWAITING_NICK") {
    cleanChat();
    cache.put("pubg_nick_" + chatId, text, 600);

    if (isEditing) {
      finishOrder(chatId, message.from, true);
    } else {
      cache.put("state_" + chatId, "AWAITING_RECEIPT", 600);
      var pkg = UC_PACKAGES[cache.get("chosen_pkg_idx_" + chatId)];
      var payText = "💳 <b>To'lov ma'lumotlari:</b>\n💰 Summa: <b>" + pkg.price + " so'm</b>\n💳 Karta: <code>9860 1606 0199 4383</code>\n👤 Egasi: <b>OLIMBEK QADIROV</b>\n\n⚠️ To'lovdan so'ng chekni rasm shaklida yuboring.";
      var sent = sendMessage(chatId, payText, {keyboard: [["🔙 Orqaga qaytish"]], resize_keyboard: true});
      cache.put("last_msg_" + chatId, sent.result.message_id, 3600);
      // Chek yuborish bosqichida ham keshga ma'lumotni saqlaymiz (chat tozalansa qaytarish uchun)
      cache.put("pending_payment_" + chatId, "true", 3600);
    }

  } 
  else if (state === "AWAITING_RECEIPT" && message.photo) {
    cleanChat();
    var fileId = message.photo[message.photo.length - 1].file_id;
    cache.put("last_file_id_" + chatId, fileId, 3600 * 24);
    cache.remove("pending_payment_" + chatId);
    finishOrder(chatId, message.from, false);
  }
}

function finishOrder(chatId, from, isEdited) {
  var cache = CacheService.getScriptCache();
  var pkgIdx = cache.get("chosen_pkg_idx_" + chatId);
  var pkg = UC_PACKAGES[pkgIdx];
  var fileId = cache.get("last_file_id_" + chatId);
  var username = from.username ? "@" + from.username : "kiritilmagan";
  var header = isEdited ? "🔄 <b>TAHRILLANGAN BUYURTMA!</b>" : "🔔 <b>YANGI BUYURTMA!</b>";

  if (isEdited) {
    var oldAdminMsgId = cache.get("admin_msg_to_delete_" + chatId);
    if (oldAdminMsgId) deleteMessage(ADMIN_ID, oldAdminMsgId);
  }

  var report = header + "\n" +
               "👤 Mijoz: " + (from.first_name || "Mijoz") + "\n" +
               "🔗 Username: " + username + "\n" +
               "📦 Paket: " + pkg.name + "\n" +
               "⚙️ Midas: <code>" + pkg.comp + "</code>\n" +
               "🆔 ID: <code>" + cache.get("pubg_id_" + chatId) + "</code>\n" +
               "🎮 Nick: " + cache.get("pubg_nick_" + chatId);

  // Avval jadvalga yozib qo'yamiz (agar SPREADSHEET_ID berilgan bo'lsa)
  try {
    logOrderToSheet(chatId, from, pkg, fileId, isEdited);
  } catch (e) {
    // Xatolik bo'lsa adminga xabar beramiz (log)
    sendMessage(ADMIN_ID, "Xatolik: logOrderToSheet bajarilmadi: " + e.message);
  }

  var admKb = { 
    inline_keyboard: [
      [{text: "✅ Tasdiqlash", callback_data: "adm_confirm_" + chatId}],
      [{text: "⚠️ Xato bor", callback_data: "adm_error_" + chatId}],
      [{text: "❌ Rad etish", callback_data: "adm_reject_" + chatId}]
    ]
  };

  var sentAdm = sendPhoto(ADMIN_ID, fileId, report, admKb);
  if (sentAdm && sentAdm.result) {cache.put("admin_msg_to_delete_" + chatId, sentAdm.result.message_id, 3600 * 24);
  }

  var sent = sendMessage(chatId, "✅ Buyurtma adminga yuborildi!", getMainKeyboard());
  cache.put("user_confirm_msg_to_delete_" + chatId, sent.result.message_id, 3600 * 24);
  cache.put("last_msg_" + chatId, sent.result.message_id, 3600);

  cache.remove("state_" + chatId);
  cache.remove("is_editing_" + chatId);
}

function handleCallback(callbackQuery) {
  var data = callbackQuery.data;
  var chatId = callbackQuery.message.chat.id;
  var messageId = callbackQuery.message.message_id;
  var cache = CacheService.getScriptCache();

  if (data.startsWith("adm_")) {
    var parts = data.split("_");
    var action = parts[1];
    var targetId = parts[2];

    if (action === "confirm") {
      sendMessage(targetId, "✅ Buyurtmangiz bajarildi!");
      editMessageCaption(ADMIN_ID, messageId, "✅ Bajarildi");
      cache.remove("user_confirm_msg_to_delete_" + targetId);
    } else if (action === "error") {
      // 1. "✅ Buyurtma adminga yuborildi!" xabarini o'chirish
      var userConfirmMsgId = cache.get("user_confirm_msg_to_delete_" + targetId);
      if (userConfirmMsgId) {
        deleteMessage(targetId, userConfirmMsgId);
      }

      // 2. Foydalanuvchiga faqat tahrirlash tugmasini yuborish
      var editKb = { inline_keyboard: [[{text: "📝 Tahrirlash", callback_data: "user_edit_start"}]] };
      sendMessage(targetId, "⚠️ <b>DIQQAT Ma'lumotlarda xatolik aniqlandi.</b>\nIltimos, ma'lumotlarni tahrirlab qayta yuboring...!", editKb);

      editMessageCaption(ADMIN_ID, messageId, "⚠️ Xatolik yuborildi (Mijoz tahrirlashi kutilmoqda)");
      cache.put("admin_msg_to_delete_" + targetId, messageId, 3600 * 24);
      cache.put("is_editing_" + targetId, "true", 3600 * 24); // Tahrirlash holatini yoqish
    } else if (action === "reject") {
      sendMessage(targetId, "❌ Buyurtmangiz rad etildi.");
      editMessageCaption(ADMIN_ID, messageId, "❌ Rad etildi");
      cache.remove("user_confirm_msg_to_delete_" + targetId);
      cache.remove("is_editing_" + targetId);
    }

  } 
  else if (data === "user_edit_start") {
    deleteMessage(chatId, messageId);
    cache.put("state_" + chatId, "AWAITING_ID", 600);
    var sent = sendMessage(chatId, "🆔 <b>Yangi PUBG ID raqamingizni kiriting:</b>", {keyboard: [["🔙 Orqaga qaytish"]], resize_keyboard: true});
    cache.put("last_msg_" + chatId, sent.result.message_id, 3600);
  }
  answerCallbackQuery(callbackQuery.id);
}

// --- KLAVIATURALAR ---
function getMainKeyboard() { return { keyboard: [["💸 UC Sotib olish", "🏆 Turnirga yozilish"], ["🤝 Account Savdo", "🌐 YouTube xizmati"], ["👨‍💻 m24 KOREN 🇺🇿 ga murojat...⁉️"]], resize_keyboard: true }; }
function getTourneyTypeKeyboard() { return { keyboard: [["⚔️ TDM", "🌍 KLASSIKA"], ["🔙 Orqaga qaytish"]], resize_keyboard: true }; }
function getTurnirLevelKeyboard() { return { keyboard: [["🥇 Yangi boshlovchi"], ["🏅 O'rta boshlovchi"], ["🎖 Pro darajadagilar"], ["🏆 Ultimatum lar"], ["🔙 Orqaga qaytish"]], resize_keyboard: true }; }
function getYTKeyboard() { return { keyboard: [["🛠 Kanalni sozlash"], ["🎨 Dizayn to'plami"], ["💰 Monetizatsiyaga ulash"], ["💸 Pul chiqarishga yordam"], ["🔙 Orqaga qaytish"]], resize_keyboard: true }; }

function getUCKeyboard() {
  var kb = { keyboard: [["🔙 Orqaga qaytish"]], resize_keyboard: true };
  for (var i = 0; i < UC_PACKAGES.length; i += 2) {
    var left = UC_PACKAGES[i];
    var leftLabel = computeUCAmount(left.comp) + " UC - " + formatCurrency(left.price) + " So'm";
    var row = [leftLabel];
    if (i + 1 < UC_PACKAGES.length) {
      var right = UC_PACKAGES[i+1];
      var rightLabel = computeUCAmount(right.comp) + " UC - " + formatCurrency(right.price) + " So'm";
      row.push(rightLabel);
    }
    kb.keyboard.push(row);
  }
  return kb;
}

// --- HELPER FUNCTIONS ---
function formatCurrency(n) {
  var s = String(n);
  // Insert space as thousand separator
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
function computeUCAmount(compString) {
  if (!compString) return 0;
  var parts = compString.toString().split("+");
  var sum = 0;
  for (var i = 0; i < parts.length; i++) {
    var v = parseInt(parts[i], 10);
    if (!isNaN(v)) sum += v;
  }
  return sum;
}

// --- API FUNKSIYALAR ---
function sendMessage(chatId, text, kb) {
  var payload = { method: "sendMessage", chat_id: String(chatId), text: text, parse_mode: "HTML", reply_markup: JSON.stringify(kb) };
  return JSON.parse(UrlFetchApp.fetch(API_URL, { method: "post", payload: payload }).getContentText());
}
function sendPhoto(chatId, fileId, caption, kb) {
  var payload = { method: "sendPhoto", chat_id: String(chatId), photo: fileId, caption: caption, parse_mode: "HTML", reply_markup: JSON.stringify(kb) };
  return JSON.parse(UrlFetchApp.fetch(API_URL, { method: "post", payload: payload }).getContentText());
}
function editMessageCaption(chatId, messageId, caption) {
  UrlFetchApp.fetch(API_URL + "editMessageCaption?chat_id=" + chatId + "&message_id=" + messageId + "&caption=" + encodeURIComponent(caption));
}
function deleteMessage(chatId, messageId) { try { UrlFetchApp.fetch(API_URL + "deleteMessage?chat_id=" + chatId + "&message_id=" + messageId); } catch (e) {} }
function answerCallbackQuery(id) { UrlFetchApp.fetch(API_URL + "answerCallbackQuery?callback_query_id=" + id); }

// Utility: set BOT_TOKEN into Script Properties (run this once from Apps Script editor for security)
function setScriptToken(token) {
  if (!token) throw new Error('Token is required');
  PropertiesService.getScriptProperties().setProperty('BOT_TOKEN', token);
  return 'Token saved to Script Properties.';
}

// --- GOOGLE SHEETS / DRIVE INTEGRATION ---
function logOrderToSheet(chatId, from, pkg, fileId, isEdited) {
  if (!SPREADSHEET_ID) {
    // Agar SPREADSHEET_ID berilmagan bo'lsa, hech narsa qilmaymiz
    return;
  }
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  ensureSheets(ss);

  var sheet = ss.getSheetByName("💸 UC_Orders");
  var timezone = "GMT+5";
  var dateStr = Utilities.formatDate(new Date(), timezone, "yyyy-MM-dd HH:mm:ss");

  // Order ID generatsiyasi
  var props = PropertiesService.getScriptProperties();
  var lastNum = parseInt(props.getProperty("LAST_ORDER_NUM") || "1000", 10);
  lastNum++;
  props.setProperty("LAST_ORDER_NUM", String(lastNum));
  var orderId = "ORD-" + lastNum;

  var username = from.username ? "@" + from.username : "kiritilmagan";
  var customerName = from.first_name || "Mijoz";

  // Telefonni olish (agar oldindan cache yoki boshqa joyda saqlangan bo'lsa)
  var phone = "kiritilmagan";
  try {
    var cache = CacheService.getScriptCache();
    var maybePhone = cache.get("phone_" + chatId);
    if (maybePhone) phone = maybePhone;
  } catch (e) {}

  var pubgId = SpreadsheetApp.newRichTextValue().build(); // placeholder if later needed
  var pubg_id_val = CacheService.getScriptCache().get("pubg_id_" + chatId) || "kiritilmagan";
  var nick_val = CacheService.getScriptCache().get("pubg_nick_" + chatId) || "kiritilmagan";

  // Paket UC hajmini hisoblaymiz
  var ucAmount = computeUCAmount(pkg.comp);
  var sumVal = pkg.price || 0;

  // Receiptni Drive ga yuklash va link olish
  var receiptLink = "";
  if (fileId) {
    try {
      receiptLink = saveReceiptToDrive(fileId, orderId);
    } catch (e) {
      receiptLink = "ERROR: " + e.message;
    }
  } else {
    receiptLink = "yuklanmagan";
  }

  // Jadvalga satr qo'shish — ustunlar:
  // A Sana, B Buyurtma ID, C Mijoz, D Telefon, E PUBG ID, F Nick, G Paket UC, H Summa, I Midas, J Holat, K Baho, L Receipt link, M Referral
  var row = [
    dateStr,
    orderId,
    customerName + " (" + username + ")",
    phone,
    pubg_id_val,
    nick_val,
    ucAmount,
    sumVal,
    "", // Midas (admin qo'lda to'ldiradi)
    "Kutilmoqda",
    "", // Baho
    receiptLink,
    "" // Referral
  ];
  sheet.appendRow(row);

  // Data validation — Holat ustuniga dropdown qo'yamiz (J ustun = 10)
  var lastRow = sheet.getLastRow();
  var statusRange = sheet.getRange(2, 10, sheet.getMaxRows()-1); // but better set on full column header area once via ensureSheets
  // (ensureSheets funksiyasida data validation allaqachon qoʻyilgan)

  // Qo'shimcha: adminga log xabari jo'natsa bo'ladi
  return orderId;
}

function ensureSheets(ss) {
  // Yaratish va sarlavhalarni sozlash
  var ordersName = "💸 UC_Orders";
  var tourneyName = "🏆 Tournament_Reg";
  var botStatusName = "Bot_Status";
  var blacklistName = "Blacklist";

  var orders = ss.getSheetByName(ordersName);
  if (!orders) {
    orders = ss.insertSheet(ordersName);
    var headers = ["Sana", "Buyurtma ID", "Mijoz", "Telefon", "PUBG ID", "Nickname", "Paket UC", "Summa", "Midas", "Holat", "Baho", "Receipt link", "Referral"];
    orders.getRange(1,1,1,headers.length).setValues([headers]);
    // Holat ustuniga data validation
    var statusRule = SpreadsheetApp.newDataValidation().requireValueInList(["Kutilmoqda","Tasdiqlandi","Rad etildi"], true).build();
    orders.getRange(2, 10, orders.getMaxRows()-1).setDataValidation(statusRule);
  }

  var tourney = ss.getSheetByName(tourneyName);
  if (!tourney) {
    tourney = ss.insertSheet(tourneyName);
    var tHeaders = ["Sana", "Tur", "Daraja", "Mijoz", "PUBG ID", "Nickname", "Telefon", "Qo'shimcha"];
    tourney.getRange(1,1,1,tHeaders.length).setValues([tHeaders]);
  }

  var botStatus = ss.getSheetByName(botStatusName);
  if (!botStatus) {
    botStatus = ss.insertSheet(botStatusName);
    botStatus.getRange("A1").setValue("Hozirgi Holat");
    botStatus.getRange("B1").setValue("Oxirgi soatdagi savdo");
    botStatus.getRange("C1").setValue("Chegirma (%)");
  }

  var blacklist = ss.getSheetByName(blacklistName);
  if (!blacklist) {
    blacklist = ss.insertSheet(blacklistName);
    blacklist.getRange(1,1,1,3).setValues([["UserID","Reason","BlockedUntil"]]);
  }
}

function saveReceiptToDrive(fileId, orderId) {
  // 1) Telegram getFile orqali file_pathni olamiz
  var getFileResp = JSON.parse(UrlFetchApp.fetch(API_URL + "getFile?file_id=" + fileId).getContentText());
  if (!getFileResp.ok) throw new Error("Telegram getFile xatosi");
  var filePath = getFileResp.result.file_path;
  var fileUrl = "https://api.telegram.org/file/bot" + TOKEN + "/" + filePath;

  // 2) Yuklab blob olish
  var blobRes = UrlFetchApp.fetch(fileUrl);
  var contentType = blobRes.getHeaders()['Content-Type'] || blobRes.getAllHeaders()['Content-Type'];
  var blob = blobRes.getBlob().setName(orderId + "_" + fileId);

  // 3) Drive papkasini olish/yaratish
  var folder = getOrCreateFolder(RECEIPT_FOLDER_NAME);
  var file = folder.createFile(blob);
  // 4) Faylga umumiy link berish (agar kerak bo'lsa faylga sharing)
  // Eslatma: ommaviy link uchun faylni hamma uchun ko'rinarli qilishingiz kerak (agar kerak bo'lsa)
  try {
    file.setSharing(DriveApp.Permission.VIEW, DriveApp.Access.ANYONE_WITH_LINK);
  } catch (e) {
    // agar ruxsat bo'lmasa, uzatmaymiz
  }
  return file.getUrl();
}

function getOrCreateFolder(name) {
  var folders = DriveApp.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(name);
}

/* 
  Qo'shimcha takliflar (dashboard formulas, analytics va "dynamic personality" funktsiyalari)
*/