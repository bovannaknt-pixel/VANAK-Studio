const firebaseConfig = {
  "projectId": "gen-lang-client-0676245327",
  "apiKey": "AIzaSyAm1vUmlbDINX8kzIaY7Sisx4IAu88-47I",
  "firestoreDatabaseId": "ai-studio-9cf7c6ea-53e3-4d98-b001-e95d740fe1a8"
};

const payload = {
  fields: {
    json: {
      stringValue: JSON.stringify({ test: true, timestamp: Date.now() })
    }
  }
};

async function run() {
  const { projectId, apiKey, firestoreDatabaseId } = firebaseConfig;
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${firestoreDatabaseId}/documents/shop/kunthy_watch?key=${apiKey}`;
  const patchUrl = `${url}?updateMask.fieldPaths=json`;

  try {
    const response = await fetch(patchUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    console.log("Status:", response.status);
    const text = await response.text();
    console.log("Body:", text);
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
