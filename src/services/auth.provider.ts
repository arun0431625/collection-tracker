import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";

export async function loginWithAuthProvider(
  branchCode: string,
  password: string
) {
  const cleaned = branchCode.trim().toLowerCase();

  const email = cleaned.includes("@")
    ? cleaned
    : `${cleaned}@tracker.com`;

  const cred = await signInWithEmailAndPassword(
    auth,
    email,
    password
  );

  const token = await cred.user.getIdTokenResult();

  return {
    user: cred.user,
    role: token.claims.role,
    branch: token.claims.branch,
    areaManager: token.claims.name || null,
  };
}
