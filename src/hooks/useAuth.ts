import { useEffect, useState } from 'react';
import { FirebaseAuthTypes } from '@react-native-firebase/auth';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { auth, firestore } from '../services/firebase';

// Configure once at module load — replace webClientId with the value from
// your google-services.json > oauth_client[type=3].client_id
GoogleSignin.configure({
  webClientId: '27409883752-99jtg7903rhgf1bmd8gtqd0n5at0t5ts.apps.googleusercontent.com',
});

function firstDayOfNextMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

async function ensureUserDocument(user: FirebaseAuthTypes.User): Promise<void> {
  const ref = firestore().collection('users').doc(user.uid);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      email: user.email ?? '',
      createdAt: firestore.FieldValue.serverTimestamp(),
      plan: 'free',
      collisionCount: 0,
      collisionResetDate: firstDayOfNextMonth(),
      mode: null,
      domains: [],
    });
  }
}

export interface AuthHook {
  user: FirebaseAuthTypes.User | null;
  loading: boolean;
  signIn: () => Promise<boolean>;
  signOut: () => Promise<void>;
}

export function useAuth(): AuthHook {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged((firebaseUser) => {
      if (firebaseUser) {
        // Fire-and-forget: don't block auth state update on Firestore
        ensureUserDocument(firebaseUser).catch(() => {});
      }
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  async function signIn(): Promise<boolean> {
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response: any = await GoogleSignin.signIn();

      // v11+ format: { type: 'success'|'cancelled'|..., data: { idToken, ... } }
      // v9/v10 format: { idToken, user, ... } directly
      const isNewFormat = response.type !== undefined;

      if (isNewFormat) {
        if (response.type === 'cancelled') return false;
        if (response.type !== 'success') {
          throw new Error(`Google Sign-In returned: ${response.type}`);
        }
      }

      const idToken: string | null =
        response.data?.idToken ?? response.idToken ?? null;

      if (!idToken) {
        throw new Error('No ID token — check Firebase OAuth client config.');
      }

      const credential = auth.GoogleAuthProvider.credential(idToken);
      await auth().signInWithCredential(credential);
      return true;
    } catch (error: any) {
      if (
        error.code === statusCodes.SIGN_IN_CANCELLED ||
        error.code === statusCodes.IN_PROGRESS
      ) {
        return false;
      }
      throw error;
    } finally {
      setLoading(false);
    }
  }

  async function signOut(): Promise<void> {
    setLoading(true);
    try {
      await GoogleSignin.revokeAccess();
      await GoogleSignin.signOut();
      await auth().signOut();
    } finally {
      setLoading(false);
    }
  }

  return { user, loading, signIn, signOut };
}
