// IMPORTANT:
// 1. Create a Firebase project at https://console.firebase.google.com/
// 2. Go to Project Settings -> General tab.
// 3. Scroll down to "Your apps" and click the "</>" (Web) icon to register a web app.
// 4. After registering, Firebase will provide you with a config object.
// 5. Copy the values from that object and paste them into the placeholders below.

export const firebaseConfig = {
  // NOTE: To enable Firebase services, replace these placeholder values
  // with your actual Firebase project configuration. If these values
  // remain as placeholders, the app will run in local-only mode using IndexedDB.
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// This function checks if the config has been populated
export const isFirebaseConfigured = () => {
    return firebaseConfig.apiKey !== "YOUR_API_KEY" && firebaseConfig.projectId !== "YOUR_PROJECT_ID";
};
