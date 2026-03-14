import {useState} from 'react';
import {GEMINI_ENDPOINT, SYSTEM_PROMPT} from '../utils/constants';

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

export function useCollision() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const collide = async (
    problem: string,
    apiKey: string,
  ): Promise<CollisionResult | null> => {
    setLoading(true);
    setError(null);

    try {
      const url = `${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{text: problem}],
            },
          ],
          systemInstruction: {
            parts: [{text: SYSTEM_PROMPT}],
          },
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 1200,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          response.status === 400
            ? 'Invalid request — check your API key'
            : response.status === 403
              ? 'API key not authorized'
              : response.status === 429
                ? 'Rate limited — try again in a moment'
                : `API error ${response.status}: ${body.slice(0, 120)}`,
        );
      }

      const data = await response.json();
      const text =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const parsed: CollisionResult = JSON.parse(text);

      if (
        !parsed.structural_essence ||
        !Array.isArray(parsed.collisions) ||
        parsed.collisions.length !== 4 ||
        !parsed.synthesis
      ) {
        throw new Error('Unexpected response shape from API');
      }

      return parsed;
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {collide, loading, error};
}
