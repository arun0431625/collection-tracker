const admin = require("firebase-admin");
const XLSX = require("xlsx");
const path = require("path");

/* ========== INIT FIREBASE ADMIN ========== */

const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const auth = admin.auth();
const db = admin.firestore();

/* ========== LOAD EXCEL ========== */

const filePath = path.join(__dirname, "branches.xlsx");
const wb = XLSX.readFile(filePath);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws);

/* ========== CONFIG ========== */

const DEFAULT_PASSWORD = "Branch@123";
const DOMAIN = "tracker.com";

/* ========== MAIN LOGIC ========== */

async function run() {
  console.log(`🚀 Starting branch creation: ${rows.length} rows\n`);

  for (const row of rows) {
    const branchCode = String(row.branch_code || "").trim().toUpperCase();
    const branchName = String(row.branch_name || "").trim();
    const areaManager = String(row.area_manager || "").trim();

    if (!branchCode) {
      console.log("⚠️ Skipped row with missing branch_code");
      continue;
    }

    const email = `${branchCode.toLowerCase()}@${DOMAIN}`;

    try {
      /* ---------- CREATE AUTH USER ---------- */
      let user;
      try {
        user = await auth.getUserByEmail(email);
        console.log(`ℹ️ User already exists: ${email}`);
      } catch {
        user = await auth.createUser({
          email,
          password: DEFAULT_PASSWORD,
          displayName: branchName || branchCode,
        });
        console.log(`✅ User created: ${email}`);
      }

      /* ---------- SET CUSTOM CLAIMS ---------- */
      await auth.setCustomUserClaims(user.uid, {
        role: "BRANCH",
        branch: branchCode,
      });

      /* ---------- SAVE BRANCH DOC ---------- */
      await db.collection("branches").doc(branchCode).set(
        {
          branch_code: branchCode,
          branch_name: branchName,
          area_manager: areaManager,
          active: true,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      console.log(`🔐 Claims set + Branch saved: ${branchCode}\n`);
    } catch (err) {
      console.error(`❌ Failed for ${branchCode}:`, err.message);
    }
  }

  console.log("🎉 Branch automation completed");
}

run().then(() => process.exit());
