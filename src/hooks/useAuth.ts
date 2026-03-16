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
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

export function useAuth(): AuthHook {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  async function signIn(): Promise<void> {
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const { idToken } = await GoogleSignin.signIn();
      const credential = auth.GoogleAuthProvider.credential(idToken);
      const result = await auth().signInWithCredential(credential);
      await ensureUserDocument(result.user);
    } catch (error: any) {
      if (
        error.code !== statusCodes.SIGN_IN_CANCELLED &&
        error.code !== statusCodes.IN_PROGRESS
      ) {
        throw error;
      }
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
