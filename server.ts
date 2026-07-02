import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import webpush from "web-push";
import { Firestore } from "@google-cloud/firestore";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

const DATA_FILE = path.join(process.cwd(), "data.json");

// VAPID keys setup for Web Push
const SUBSCRIPTIONS_FILE = path.join(process.cwd(), "subscriptions.json");
const VAPID_KEYS_FILE = path.join(process.cwd(), "vapid-keys.json");
let vapidKeys = { publicKey: "", privateKey: "" };

if (fs.existsSync(VAPID_KEYS_FILE)) {
  try {
    vapidKeys = JSON.parse(fs.readFileSync(VAPID_KEYS_FILE, "utf-8"));
  } catch (err) {
    console.error("Error reading VAPID keys:", err);
  }
}

if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
  try {
    vapidKeys = webpush.generateVAPIDKeys();
    fs.writeFileSync(VAPID_KEYS_FILE, JSON.stringify(vapidKeys, null, 2), "utf-8");
  } catch (err) {
    console.error("Error generating VAPID keys:", err);
  }
}

if (vapidKeys.publicKey && vapidKeys.privateKey) {
  webpush.setVapidDetails(
    "mailto:timechrono.tc@gmail.com",
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );
}

function readSubscriptions(): any[] {
  try {
    if (fs.existsSync(SUBSCRIPTIONS_FILE)) {
      return JSON.parse(fs.readFileSync(SUBSCRIPTIONS_FILE, "utf-8"));
    }
  } catch (err) {
    console.error("Error reading subscriptions:", err);
  }
  return [];
}

function writeSubscriptions(subs: any[]) {
  try {
    fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(subs, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing subscriptions:", err);
  }
}

async function checkAndSendLowStockAlerts(newWatches: any[], oldWatches: any[] = []) {
  const lowStockItems = newWatches.filter((w: any) => w.stock < 5);
  if (lowStockItems.length === 0) return;

  const alertedItems = [];
  for (const item of lowStockItems) {
    const oldItem = oldWatches.find((o: any) => o.id === item.id);
    if (!oldItem || oldItem.stock >= 5 || oldItem.stock !== item.stock) {
      alertedItems.push(item);
    }
  }

  if (alertedItems.length === 0) return;

  const subscriptions = readSubscriptions();
  if (subscriptions.length === 0) return;

  const title = "🚨 នាឡិកាជិតអស់ពីស្តុក (Low Stock Alert)";
  const body = alertedItems.map((item: any) => 
    `- ${item.brand} ${item.model} (${item.color || "ទូទៅ"}): នៅសល់តែ ${item.stock} គ្រឿង!`
  ).join("\n");

  const payload = JSON.stringify({
    title,
    body,
    data: { url: "/" }
  });

  const remainingSubs: any[] = [];
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(sub, payload);
      remainingSubs.push(sub);
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        console.log("Subscription expired/invalid, removing...");
      } else {
        console.error("Error sending push notification:", err);
        remainingSubs.push(sub);
      }
    }
  }

  if (remainingSubs.length !== subscriptions.length) {
    writeSubscriptions(remainingSubs);
  }
}

// Helper to race a promise against a timeout
function withTimeout<T>(promise: Promise<T>, ms: number, timeoutErrorMsg: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(timeoutErrorMsg));
    }, ms);
    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// Load Firebase configuration
const CONFIG_FILE = path.join(process.cwd(), "firebase-applet-config.json");
let firebaseConfig: any = null;
if (fs.existsSync(CONFIG_FILE)) {
  try {
    firebaseConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
  } catch (err) {
    console.error("Error reading firebase config:", err);
  }
}

async function getFirestoreConfig() {
  if (!firebaseConfig) {
    console.warn("Firebase configuration not found. Syncing is currently offline.");
    return null;
  }
  const { projectId, firestoreDatabaseId, apiKey } = firebaseConfig;

  let dbId = firestoreDatabaseId || "(default)";

  // Obtain a token if possible
  let token: string | null = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const metadataResponse = await fetch(
      "http://metadata.google.internal/computeMetadata/v1/instance/service-account/default/token",
      {
        headers: { "Metadata-Flavor": "Google" },
        signal: controller.signal
      }
    );
    clearTimeout(timer);
    if (metadataResponse.ok) {
      const data: any = await metadataResponse.json();
      if (data && data.access_token) {
        token = data.access_token;
        console.log("Successfully retrieved GCP service account metadata token for Firestore.");
      }
    } else {
      console.warn("GCP metadata server responded status:", metadataResponse.status);
    }
  } catch (err: any) {
    // Normal when running locally or on network sandbox, but let's log the reason
    console.log("GCP metadata server token fetch did not complete (expected if running locally):", err?.message || err);
  }

  const configs: any[] = [];

  // 1. API Key with (default) database - Most compatible and reliable with public/anonymous access rules
  configs.push({
    name: "API Key with (default) database",
    url: `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/shop/kunthy_watch?key=${apiKey}`,
    headers: {
      "Content-Type": "application/json"
    }
  });

  // 2. API Key with configured database ID
  if (dbId !== "(default)") {
    configs.push({
      name: `API Key with custom database ID (${dbId})`,
      url: `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents/shop/kunthy_watch?key=${apiKey}`,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }

  // 3. Bearer Token with (default) database
  if (token) {
    configs.push({
      name: "Bearer Token with (default) database",
      url: `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/shop/kunthy_watch`,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    });

    if (dbId !== "(default)") {
      configs.push({
        name: `Bearer Token with custom database ID (${dbId})`,
        url: `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents/shop/kunthy_watch`,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });
    }
  }

  return configs;
}

let firestoreDb: Firestore | null = null;

function getFirestore() {
  if (firestoreDb) return firestoreDb;
  if (!firebaseConfig) {
    console.warn("Firebase configuration not found. Cannot initialize Firestore SDK.");
    return null;
  }
  try {
    const { projectId, firestoreDatabaseId } = firebaseConfig;
    const dbId = firestoreDatabaseId || "(default)";
    firestoreDb = new Firestore({
      projectId,
      databaseId: dbId,
    });
    console.log(`Successfully initialized @google-cloud/firestore for project ${projectId}, db ${dbId}`);
    return firestoreDb;
  } catch (err) {
    console.error("Error initializing @google-cloud/firestore:", err);
    return null;
  }
}

// Write data to Firestore
async function writeToFirestore(data: any) {
  const db = getFirestore();
  if (db) {
    try {
      const docRef = db.collection("shop").doc("kunthy_watch");
      await withTimeout(
        docRef.set({
          json: JSON.stringify(data)
        }),
        3000,
        "Firestore SDK write timed out"
      );
      console.log("Firestore write succeeded using @google-cloud/firestore SDK");
      return true;
    } catch (sdkError: any) {
      console.warn("Firestore write attempt failed using SDK, trying REST fallback. Error:", sdkError?.message || sdkError);
    }
  }

  const configs = await getFirestoreConfig();
  if (!configs || configs.length === 0) return false;

  const payload = {
    fields: {
      json: {
        stringValue: JSON.stringify(data)
      }
    }
  };

  for (const config of configs) {
    try {
      // For Firestore REST API PATCH, specify updateMask.fieldPaths to ensure a successful upsert
      const patchUrl = config.url.includes("?") 
        ? config.url.replace("?", "?updateMask.fieldPaths=json&") 
        : `${config.url}?updateMask.fieldPaths=json`;

      const controller = new AbortController();
      const fetchTimer = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(patchUrl, {
        method: "PATCH",
        headers: config.headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(fetchTimer);
      
      if (response.ok) {
        console.log(`Firestore write succeeded using fallback: ${config.name}`);
        return true;
      }
      const errText = await response.text();
      console.error(`Firestore write fallback failed using ${config.name}. Status: ${response.status}, Error Details:`, errText);
    } catch (error) {
      console.error(`Firestore write fallback error using ${config.name}:`, error);
    }
  }
  console.error("All Firestore write attempts failed.");
  return false;
}

// Read data from Firestore
async function readFromFirestore() {
  const db = getFirestore();
  if (db) {
    try {
      const docRef = db.collection("shop").doc("kunthy_watch");
      const docSnap = await withTimeout(
        docRef.get(),
        3000,
        "Firestore SDK read timed out"
      );
      if (docSnap.exists) {
        const docData = docSnap.data();
        if (docData && typeof docData.json === "string") {
          console.log("Firestore read succeeded using @google-cloud/firestore SDK");
          return JSON.parse(docData.json);
        }
      } else {
        console.log("Firestore document not found via SDK");
        return null; // document genuinely not found under this database config
      }
    } catch (sdkError: any) {
      console.warn("Firestore read attempt failed using SDK, trying REST fallback. Error:", sdkError?.message || sdkError);
    }
  }

  const configs = await getFirestoreConfig();
  if (!configs || configs.length === 0) return null;

  for (const config of configs) {
    try {
      console.log(`Trying Firestore read fallback using: ${config.name}`);
      const controller = new AbortController();
      const fetchTimer = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(config.url, {
        headers: config.headers,
        signal: controller.signal
      });
      clearTimeout(fetchTimer);

      if (response.ok) {
        const doc: any = await response.json();
        const jsonStr = doc.fields?.json?.stringValue;
        if (jsonStr) {
          console.log(`Firestore read fallback succeeded using: ${config.name}`);
          return JSON.parse(jsonStr);
        }
      } else if (response.status === 404) {
        console.log(`Firestore read fallback returned 404 (document not found) using: ${config.name}`);
        return null; // document genuinely not found under this database config
      } else {
        const errText = await response.text();
        console.warn(`Firestore read fallback failed with status ${response.status} using ${config.name}:`, errText);
      }
    } catch (error) {
      console.warn(`Firestore read fallback error using ${config.name}:`, error);
    }
  }
  
  // If we couldn't contact Firestore at all (all configurations returned non-200/404 statuses)
  // throw an error to fail safe and use local storage fallback.
  throw new Error("All Firestore read attempts failed.");
}

// Default initial database state
const defaultDbState = {
  watches: [],
  sales: [],
  incomes: [],
  expenses: [],
  capitalTransactions: []
};

// Helper to read data from data.json
function readData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, "utf-8");
      return JSON.parse(content);
    }
  } catch (error) {
    console.error("Error reading data file:", error);
  }
  return defaultDbState;
}

// Helper to write data to data.json
function writeData(data: any) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch (error) {
    console.error("Error writing data file:", error);
    return false;
  }
}

// Ensure database file exists on startup
if (!fs.existsSync(DATA_FILE)) {
  writeData(defaultDbState);
}

// --- API Endpoints ---

// 1. Auth Login Endpoint
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  const normalizedUser = (username || "").toLowerCase().trim();

  // Look up in dynamic user database accounts if exist
  const data = readData();
  if (data && Array.isArray(data.users)) {
    const matchedUser = data.users.find(
      (u: any) => (u.username || "").toLowerCase().trim() === normalizedUser
    );
    if (matchedUser && matchedUser.password === password) {
      return res.json({
        success: true,
        role: matchedUser.role,
        name: matchedUser.name,
        message: `ការចូលប្រើប្រាស់ជោគជ័យជា ${matchedUser.name}!`,
      });
    }
  }

  if ((normalizedUser === "admin" || normalizedUser === "kunthy") && password === "123456") {
    res.json({ success: true, role: "owner", name: "Kunthy", message: "ការចូលប្រើប្រាស់ជោគជ័យ!" });
  } else if (normalizedUser === "pich" && password === "123456") {
    res.json({ success: true, role: "staff", name: "Pich", message: "ការចូលប្រើប្រាស់ជោគជ័យជាបុគ្គលិក Pich!" });
  } else {
    res.status(401).json({ success: false, message: "Username ឬ Password មិនត្រឹមត្រូវទេ!" });
  }
});

// 2. Clear Database (Reset) Endpoint
app.post("/api/shop/reset", async (req, res) => {
  try {
    writeData(defaultDbState);
    await writeToFirestore(defaultDbState);
    res.json({ success: true, data: defaultDbState });
  } catch (err) {
    console.error("Error resetting shop data:", err);
    res.status(500).json({ error: "មិនអាចកំណត់ទិន្នន័យឡើងវិញបានទេ" });
  }
});

// Web Push & Subscriptions Endpoints
app.get("/api/notifications/vapid-public-key", (req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

app.post("/api/notifications/subscribe", (req, res) => {
  const subscription = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: "Invalid subscription details" });
  }

  const subscriptions = readSubscriptions();
  const exists = subscriptions.some(sub => sub.endpoint === subscription.endpoint);
  if (!exists) {
    subscriptions.push(subscription);
    writeSubscriptions(subscriptions);
  }

  res.status(201).json({ success: true, message: "Subscription registered successfully" });
});

app.post("/api/notifications/test", async (req, res) => {
  const subscriptions = readSubscriptions();
  if (subscriptions.length === 0) {
    return res.status(400).json({ error: "No client subscriptions registered." });
  }

  const payload = JSON.stringify({
    title: "🔔 តេស្តការជូនដំណឹង (Test Notification)",
    body: "ប្រព័ន្ធដំឡើងការជូនដំណឹងពី Kunthy Watch Store រួចរាល់ហើយ!",
    data: { url: "/" }
  });

  let sentCount = 0;
  const remainingSubs: any[] = [];
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(sub, payload);
      sentCount++;
      remainingSubs.push(sub);
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        console.log("Test subscription expired, removing...");
      } else {
        console.error("Error during test push notification:", err);
        remainingSubs.push(sub);
      }
    }
  }

  if (remainingSubs.length !== subscriptions.length) {
    writeSubscriptions(remainingSubs);
  }

  res.json({ success: true, sentCount });
});

// 3. Get Shop Data
app.get("/api/shop", async (req, res) => {
  try {
    let data = await readFromFirestore();
    if (data) {
      writeData(data); // Sync local file
    } else {
      // document does not exist in Firestore, initialize Firestore with local data
      data = readData();
      await writeToFirestore(data);
    }
    res.json(data);
  } catch (err) {
    console.error("Error loading shop data:", err);
    res.json(readData()); // Return local data if network fails
  }
});

// 4. Save/Update Shop Data
app.post("/api/shop", async (req, res) => {
  const data = req.body;
  if (data && typeof data === "object") {
    try {
      // Fetch former state to check for low stock
      const oldData = readData();
      
      writeData(data); // Save local cache immediately
      await writeToFirestore(data); // Save to Firestore
      
      // Compare watches and send alerts if any watch dipped or stays < 5
      if (Array.isArray(data.watches)) {
        await checkAndSendLowStockAlerts(data.watches, oldData.watches || []);
      }
      
      res.json({ success: true, data });
    } catch (err) {
      console.error("Error saving shop data:", err);
      res.status(500).json({ error: "មិនអាចរក្សាទុកទិន្នន័យបានទេ" });
    }
  } else {
    res.status(400).json({ error: "ទិន្នន័យមិនត្រឹមត្រូវ" });
  }
});

// 5. Chat with Gemini using shop live context
app.post("/api/gemini/chat", async (req, res) => {
  try {
    const { message, history, context } = req.body;

    if (!message) {
      return res.status(400).json({ error: "សារមិនអាចទទេបានទេ" });
    }

    // Load full state to be precise
    let currentData = context;
    if (!currentData) {
      currentData = await readFromFirestore();
      if (currentData) {
        writeData(currentData);
      } else {
        currentData = readData();
      }
    }

    // Prepare clear structured prompt
    const systemInstruction = `អ្នកគឺជា AI Assistant សម្រាប់ជួយគ្រប់គ្រងហាងលក់នាឡិកាដៃ "Kunthy Watch Store Management" ដែលមានម្ចាស់ហាង (Owner) ឈ្មោះ Kunthy និងអ្នកគ្រប់គ្រង (Admin) ឈ្មោះ Kunthy។
ភារកិច្ចរបស់អ្នកគឺឆ្លើយសំណួររបស់ Kunthy ទាក់ទងនឹងការគ្រប់គ្រងការចូលប្រើប្រាស់ ស្តុកនាឡិកា ការលក់ ចំណូល ចំណាយ និងប្រាក់ដើម។

ខាងក្រោមនេះជាទិន្នន័យផ្សាយផ្ទាល់ (Live Database State) នៃហាងនាឡិកាដៃបច្ចុប្បន្ន៖
----------------------------------------
១. បញ្ជីនាឡិកាក្នុងស្តុក (Watches):
${JSON.stringify(currentData.watches, null, 2)}

២. កំណត់ត្រាការលក់ (Sales):
${JSON.stringify(currentData.sales, null, 2)}

៣. កំណត់ត្រាចំណូល (Other Incomes):
${JSON.stringify(currentData.incomes, null, 2)}

៤. កំណត់ត្រាចំណាយ (Expenses):
${JSON.stringify(currentData.expenses, null, 2)}

៥. ប្រតិបត្តិការប្រាក់ដើម (Capital Transactions):
${JSON.stringify(currentData.capitalTransactions, null, 2)}
----------------------------------------

ច្បាប់សំខាន់បំផុតដែលអ្នកត្រូវតែគោរពតាម៖
- ត្រូវតែឆ្លើយជាភាសាខ្មែរជានិច្ច ក្នុងនាមជាជំនួយការរួសរាយរាក់ទាក់។
- ហាមបង្កើតឬប្រឌិតទិន្នន័យដោយខ្លួនឯងជាដាច់ខាត (កុំបង្កើតទិន្នន័យដោយខ្លួនឯង)។ ត្រូវផ្អែកលើទិន្នន័យផ្សាយផ្ទាល់ខាងលើតែប៉ុណ្ណោះ។ បើគ្មានទិន្នន័យទេ ត្រូវឆ្លើយថាគ្មាន។
- ប្រសិនបើព័ត៌មានដែលអ្នកទទួលបានមិនគ្រប់គ្រាន់ដើម្បីគណនា ឬឆ្លើយតបទេ ត្រូវសួរបន្ថែមដើម្បីទទួលបានព័ត៌មានច្បាស់លាស់ (បើព័ត៌មានមិនគ្រប់ ត្រូវសួរបន្ថែម)។
- ត្រូវបង្ហាញទិន្នន័យជាទម្រង់តារាង (Markdown Table) ជានិច្ចសម្រាប់ការប្រៀបធៀប បញ្ជី ឬរបាយការណ៍ ដើម្បីឱ្យអ្នកប្រើប្រាស់ងាយស្រួលអាន (ត្រូវបង្ហាញទិន្នន័យជាតារាងងាយអាន)។
- ត្រូវតែបង្ហាញ "Owner: Kunthy" នៅក្នុង Header ឬផ្នែកខាងលើនៃរាល់របាយការណ៍/តារាងដែលអ្នកបង្កើត ឬឆ្លើយតបជានិច្ច!
- បើអ្នកប្រើប្រាស់សួរពីរបៀបផ្ដើម ឬដំឡើងកម្មវិធី App លើ Chrome (Install App Chrome) ត្រូវណែនាំជំហានដូចខាងក្រោម៖
  1. បើក Chrome
  2. ចុចប៊ូតុង Install App (បើមាននៅក្នុង URL bar)
  3. ឬចុច Menu ត្រីចំណុច (⋮) របស់ Chrome
  4. ជ្រើសរើស "Install App" ឬ "Add to Home Screen"
  5. បន្ទាប់មកបើកប្រើប្រាស់ដូចជា App ទូរស័ព្ទ ឬ Desktop ធម្មតា
- រាល់ការគណនាប្រាក់ចំណេញសុទ្ធ ចំណេញពីការលក់ ឬស្ថិតិ ត្រូវគណនាឲ្យបានច្បាស់លាស់ និងម៉ត់ចត់៖
  + តម្លៃលក់សរុប = ចំនួនលក់ * តម្លៃលក់
  + ប្រាក់ចំណេញពីការលក់ = (តម្លៃលក់ - តម្លៃដើម) * បរិមាណ
  + ប្រាក់ដើមបច្ចុប្បន្ន = ប្រាក់ដើមដំបូង + ប្រាក់បន្ថែម - ប្រាក់ដក
  + ប្រាក់ចំណេញសុទ្ធ = ផលបូកចំណេញការលក់ទាំងអស់ + ចំណូលផ្សេងៗទាំងអស់ - ចំណាយទាំងអស់។
- រក្សាភាពគួរសម និងអាជីពជានិច្ច។`;

    const chatHistory = history ? history.map((h: any) => ({
      role: h.sender === "user" ? "user" : "model",
      parts: [{ text: h.text }]
    })) : [];

    // Send context + request to Gemini
    const chat = ai.chats.create({
      model: "gemini-3.5-flash",
      config: {
        systemInstruction,
        temperature: 0.2, // Low temperature to prevent hallucinations
      },
      history: chatHistory
    });

    const response = await chat.sendMessage({
      message: message
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini Chat Error:", error);
    res.status(500).json({ error: "មានបញ្ហាបច្ចេកទេសក្នុងការទាក់ទងជាមួយ AI! សូមព្យាយាមម្តងទៀត។" });
  }
});

// 6. Intelligent Stock / Watch Parser via Gemini (PDF / Excel / Text)
app.post("/api/gemini/parse-stock", async (req, res) => {
  try {
    const { text, fileBase64, mimeType } = req.body;

    if (!text && !fileBase64) {
      return res.status(400).json({ error: "គ្មានទិន្នន័យសម្រាប់ធ្វើការវិភាគទេ (No content to parse)" });
    }

    let contents: any;
    const systemInstruction = `You are an expert AI stock inventory analyzer for "Kunthy Watch Store".
Your goal is to parse supplier invoices, restock receipts, or inventory lists (which can be in English, Khmer, or Chinese) and extract watch items into a list.

Ensure the extracted data maps precisely to the following fields for each watch:
1. "id": A unique string ID (SKU / Code). If a clear SKU, reference code, barcode, or serial number is provided in the document for the item, use it. Otherwise, generate a code starting with 'W' followed by 5 digits (e.g., 'W59281').
2. "brand": Brand name (e.g., 'CASIO', 'SEIKO', 'FOSSIL', 'TISSOT', 'ROLEX', etc.). Clean up uppercase letters.
3. "model": Model name or model number (e.g., 'MTP-V001D-1B', 'SRPD55').
4. "category": Choose from 'men', 'women', or 'unisex' based on terms in the document (e.g., "Lady", "Men", "L", "M", etc.). Default to 'unisex' if unclear.
5. "color": Color description (e.g., "Silver", "Gold", "Black", "Rose Gold", or in Khmer "ទឹកប្រាក់", "មាស", "ខ្មៅ").
6. "costPrice": Wholesale unit cost price in USD. If in KHR, convert to USD using rate of 4100. Always a number.
7. "sellPrice": Suggested retail price in USD. If not specified, estimate a standard markup (e.g., costPrice * 1.5, rounded to nearest dollar). Always a number.
8. "stock": Quantity being added/restocked. If quantity is not specified, default to 1. Always an integer.

You must return a JSON array of these watch objects. Do not hallucinate. If the document has table columns, analyze columns carefully to map:
- Column for Item / Name / Model -> brand and model.
- Column for Qty / QTY / PCS / Vol / Quantity -> stock.
- Column for Unit Price / Cost / Cost Price -> costPrice.
- Column for Retail Price / Selling Price -> sellPrice.

Format of the response:
You must output a JSON object containing an array of watches under the key "watches".`;

    if (fileBase64 && mimeType) {
      // PDF file upload
      const filePart = {
        inlineData: {
          mimeType: mimeType,
          data: fileBase64,
        },
      };
      contents = {
        parts: [
          filePart,
          { text: "Analyze this document and extract the list of watches being restocked in JSON format." }
        ]
      };
    } else {
      // Excel text or other parsed text
      contents = {
        parts: [
          { text: `Analyze the following inventory/invoice text and extract watches:\n\n${text}` }
        ]
      };
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            watches: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: "Unique SKU code from invoice or generated like W12345" },
                  brand: { type: Type.STRING },
                  model: { type: Type.STRING },
                  category: { type: Type.STRING, description: "men, women, or unisex" },
                  color: { type: Type.STRING },
                  costPrice: { type: Type.NUMBER },
                  sellPrice: { type: Type.NUMBER },
                  stock: { type: Type.INTEGER }
                },
                required: ["brand", "model"]
              }
            }
          },
          required: ["watches"]
        }
      }
    });

    const resultText = response.text || "{}";
    const parsed = JSON.parse(resultText);
    const rawWatches = parsed.watches || [];

    const validatedWatches = rawWatches.map((w: any) => {
      // 1. brand
      const brand = (w.brand || "CASIO").toString().trim().toUpperCase();
      
      // 2. model
      const model = (w.model || "MTP-V001D").toString().trim().toUpperCase();
      
      // 3. id (SKU)
      let id = (w.id || "").toString().trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
      if (!id) {
        // Generate a random SKU code
        const randNum = Math.floor(10000 + Math.random() * 90000);
        id = `W${randNum}`;
      }

      // 4. category
      // Map category string to one of the valid select options in the frontend:
      // "Watch Quartz", "Automatic Watch", "Digital Watch", "Watch Sport", "Smart Watch"
      let category = "Watch Quartz";
      const rawCat = (w.category || "").toLowerCase();
      if (rawCat.includes("auto") || rawCat.includes("self") || rawCat.includes("automatic")) {
        category = "Automatic Watch";
      } else if (rawCat.includes("digital") || rawCat.includes("electronic")) {
        category = "Digital Watch";
      } else if (rawCat.includes("sport") || rawCat.includes("runner") || rawCat.includes("diver")) {
        category = "Watch Sport";
      } else if (rawCat.includes("smart") || rawCat.includes("wearable") || rawCat.includes("apple") || rawCat.includes("galaxy")) {
        category = "Smart Watch";
      }

      // 5. color
      const color = (w.color || "ទូទៅ").toString().trim();

      // 6. costPrice
      const costPrice = typeof w.costPrice === "number" && !isNaN(w.costPrice) ? w.costPrice : 0;

      // 7. sellPrice
      let sellPrice = typeof w.sellPrice === "number" && !isNaN(w.sellPrice) ? w.sellPrice : 0;
      if (sellPrice <= 0 && costPrice > 0) {
        // Estimate markup (costPrice * 1.5, rounded to nearest dollar)
        sellPrice = Math.round(costPrice * 1.5);
      }

      // 8. stock
      const stock = typeof w.stock === "number" && !isNaN(w.stock) && w.stock > 0 ? Math.floor(w.stock) : 1;

      return {
        id,
        brand,
        model,
        category,
        color,
        costPrice,
        sellPrice,
        stock
      };
    });

    res.json({
      success: true,
      watches: validatedWatches
    });

  } catch (error: any) {
    console.error("Parse Stock Error:", error);
    res.status(500).json({ error: "បរាជ័យក្នុងការវិភាគឯកសារ៖ " + (error.message || "Unknown error") });
  }
});

// --- Handle Vite Frontend & Static Assets ---

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, when running node dist/server.cjs, __dirname is the dist directory.
    // Fall back to process.cwd() / dist if index.html is not right at __dirname.
    const distPath = fs.existsSync(path.join(__dirname, "index.html"))
      ? __dirname
      : path.join(process.cwd(), "dist");
    
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        const basename = path.basename(filePath);
        if (basename === "sw.js" || filePath.endsWith(".html") || basename === "manifest.json") {
          res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
        } else {
          // Static assets (like bundled JS/CSS in assets/) can be cached aggressively since they have hashes
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      }
    }));
    app.get("*", (req, res) => {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
