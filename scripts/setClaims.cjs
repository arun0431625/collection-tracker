const admin = require("firebase-admin");

// 🔐 Service account key load
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function setClaims(uid, role, branch) {
  await admin.auth().setCustomUserClaims(uid, {
    role: role,
    branch: branch,
  });

  console.log("✅ Custom claims set successfully:");
  console.log({ uid, role, branch });
}

/* ===== CHANGE ONLY THIS PART ===== */

// 👇 YAHAN USER KI UID DAALO
const USER_UID = "Ovim2YKy6vUO5EBVbORG0hBrIxu2";

// 👇 "ADMIN" ya "BRANCH"
const ROLE = "ADMIN";

// 👇 Branch code (HO, DEL, MUM, etc.)
const BRANCH = "HO";

/* ================================= */

setClaims(USER_UID, ROLE, BRANCH)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error setting claims:", err);
    process.exit(1);
  });
