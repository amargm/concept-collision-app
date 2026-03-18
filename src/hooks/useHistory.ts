import {useState, useEffect, useCallback} from 'react';
import {auth, firestore} from '../services/firebase';
import {CollisionResult} from './useCollision';

export interface HistoryEntry {
  id: string;
  date: string;
  problem: string;
  result: CollisionResult;
}

export function useHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    const user = auth().currentUser;
    if (!user) {
      setHistory([]);
      return;
    }

    const unsub = firestore()
      .collection('collisions')
      .doc(user.uid)
      .collection('items')
      .orderBy('timestamp', 'desc')
      .limit(50)
      .onSnapshot(
        snapshot => {
          const entries: HistoryEntry[] = snapshot.docs.map(doc => {
            const data = doc.data();
            const ts: Date = data.timestamp?.toDate?.() ?? new Date();
            return {
              id: doc.id,
              date: ts.toISOString(),
              problem: data.problem ?? '',
              result: data.result ?? {},
            };
          });
          setHistory(entries);
        },
        () => {
          // permission errors silently keep existing state
        },
      );

    return unsub;
  }, []);

  // Backend writes to Firestore — no local add needed.
  const add = useCallback(async (_problem: string, _result: CollisionResult) => {
    // no-op: history comes from Firestore in real time
  }, []);

  const clear = useCallback(async () => {
    const user = auth().currentUser;
    if (!user) {return;}
    const snapshot = await firestore()
      .collection('collisions')
      .doc(user.uid)
      .collection('items')
      .get();
    const batch = firestore().batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }, []);

  // no-op: onSnapshot keeps state live; retained for call-site compat
  const reload = useCallback(() => {}, []);

  return {history, add, clear, reload};
}
