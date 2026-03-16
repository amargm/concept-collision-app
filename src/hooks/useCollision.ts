import {useState} from 'react';
import {auth} from '../services/firebase';
import {BACKEND_URL} from '../utils/constants';

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
      const token = await auth().currentUser?.getIdToken();
      if (!token) {
        throw new Error('Not signed in');
      }

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

      const data: CollisionResult = await response.json();

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
