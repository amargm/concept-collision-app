import {useState} from 'react';
import {auth, firestore} from '../services/firebase';
import {BACKEND_URL} from '../utils/constants';
import {FirebaseAuthTypes} from '@react-native-firebase/auth';

function firstDayOfNextMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

async function ensureUserDocument(user: FirebaseAuthTypes.User): Promise<void> {
  const ref = firestore().collection('users').doc(user.uid);
  const snap = await ref.get();
  if (!snap.exists) {
    // Doc doesn't exist — create with all required fields
    await ref.set({
      email: user.email ?? '',
      createdAt: firestore.FieldValue.serverTimestamp(),
      plan: 'free',
      collisionCount: 0,
      collisionResetDate: firestore.Timestamp.fromDate(firstDayOfNextMonth()),
      mode: null,
      domains: [],
    });
  } else {
    // Doc exists — ensure critical fields are present (handles stale/partial docs)
    const data = snap.data() ?? {};
    const missing: Record<string, any> = {};
    if (!data.plan) missing.plan = 'free';
    if (data.collisionCount === undefined) missing.collisionCount = 0;
    if (!data.collisionResetDate) missing.collisionResetDate = firestore.Timestamp.fromDate(firstDayOfNextMonth());
    if (Object.keys(missing).length > 0) {
      await ref.set(missing, {merge: true});
    }
  }
}

export interface Collision {
  domain: string;
  title: string;
  how_they_solved_it: string;
  bridge: string;
}

export interface CollisionResult {
  structural_essence: string;
  collisions: Collision[];
  synthesis: string;
}

export type CollisionMode = 'core' | 'learning' | 'narrative' | 'chain';

export function useCollision() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitExceeded, setLimitExceeded] = useState(false);

  const collide = async (
    problem: string,
    mode: CollisionMode = 'core',
  ): Promise<CollisionResult | null> => {
    setLoading(true);
    setError(null);
    setLimitExceeded(false);

    try {
      const currentUser = auth().currentUser;
      if (!currentUser) {
        throw new Error('Not signed in');
      }

      // Guarantee user doc exists before backend checks it
      await ensureUserDocument(currentUser);

      const token = await currentUser.getIdToken();

      const response = await fetch(`${BACKEND_URL}/collide`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({problem, mode}),
      });

      // Rate limit — user has hit their monthly cap
      if (response.status === 429) {
        let body: any = {};
        try { body = await response.json(); } catch {}
        if (body?.error === 'limit_exceeded') {
          setLimitExceeded(true);
          return null;
        }
        throw new Error('Too many requests. Try again later.');
      }

      if (!response.ok) {
        let body: any = {};
        try { body = await response.json(); } catch {}
        const msg = body?.error ?? body?.message ?? `Server error ${response.status}`;
        throw new Error(msg);
      }

      const body = await response.json();
      const data: CollisionResult = body.result ?? body;

      if (
        !data.structural_essence ||
        !Array.isArray(data.collisions) ||
        data.collisions.length !== 4 ||
        !data.synthesis
      ) {
        throw new Error('Unexpected response shape from server');
      }

      return data;
    } catch (e: any) {
      const msg: string = e?.message ?? 'Something went wrong';
      setError(msg.length > 150 ? msg.slice(0, 150) + '…' : msg);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {collide, loading, error, limitExceeded};
}
