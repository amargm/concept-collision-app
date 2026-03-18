# Concept Collision — Brainstorm

## Context

**App:** Concept Collision — a cross-domain structural pattern engine. Users submit a problem, the app finds 4 domain collisions (each showing how a completely different field solved the same structural pattern), and generates a synthesis insight. Users can go deeper into any domain using Collision Chains (Pro feature), spawning 3 sub-domain collisions recursively up to 3 levels deep.

**Current stack:**
- React Native 0.73.6 (bare Expo workflow)
- Firebase Auth (Google Sign-In) + Firestore
- Cloud Run backend (Node.js) calling Gemini 2.5 Flash Lite
- Codemagic CI/CD → Android APK
- Navigation: React Navigation v6 (native-stack + bottom-tabs)
- Plans: free (10 collisions/month) | pro (unlimited + Collision Chains)

**Current data model:**
- `users/{uid}` — plan, collisionCount, collisionResetDate, email
- `collisions/{uid}/items/{id}` — problem, result (full CollisionResult JSON), timestamp, mode, domains[], structuralEssence, promptVersion, bookmarked

**CollisionResult shape:**
```ts
{
  structural_essence: string;
  collisions: Array<{
    domain: string;
    title: string;
    how_they_solved_it: string;
    bridge: string;
  }>;
  synthesis: string;
}
```

**Collision Chains:** When a user taps "Go Deeper" on a collision card, a `deeper` mode call is made to the backend with `{ problem, mode: 'deeper', domain, structuralEssence }`. The backend returns 3 sub-domain collisions within that domain. This is recursive up to 3 levels. Chain results are NOT currently saved to Firestore — they only exist in component state.

---

## Problems to Brainstorm

### 1. Collision Chain History — Persistence & Data Model

**The problem:** Chain collisions (Go Deeper results) are ephemeral — they exist only in component state and are lost when the user navigates away. The root collision is saved to Firestore, but its chains are not. When a user opens history and taps a past collision, they see the root result but none of the chains they previously explored.

**Questions to explore:**
- Should chains be saved automatically when generated, or only on explicit user action?
- What's the right Firestore data model? Options:
  - Flat: save each chain call as a separate `collisions/{uid}/items/{id}` with a `parentId` field
  - Nested: store chains as a tree inside the root collision document (risk: Firestore 1MB doc limit)
  - Subcollection: `collisions/{uid}/items/{rootId}/chains/{chainId}` per depth level
- Should the full tree be reconstructable from history, or just the root?
- How do we display a chain history entry — do you restore the full expanded tree on open, or just show the root and let the user re-expand?
- Performance: re-calling Gemini to rebuild chains is expensive. Cache in Firestore vs. local AsyncStorage per session?

### 2. Chain Viewing Experience

**The problem:** The current chain UX is functional but has issues:
- Long chains (3 levels × 3 domains) create very deep scroll with many nested indented cards
- You can't see which chains you've already expanded at a glance
- No way to collapse an expanded chain once opened
- No summary view of "what you've explored so far" in a session
- The breadcrumb trail is hard to follow visually at depth 3

**Questions to explore:**
- Collapsible sections: toggle show/hide on a chain block?
- Lateral navigation: instead of nesting deeper, slide to a new screen per chain level?
- Exploration map: a visual tree showing which domains you've drilled into?
- Sticky breadcrumb header that updates as you scroll?
- "Chain summary" card that appears after all 3 chain cards load showing the common thread?

### 3. History Screen UX

**The problem:** History currently shows a flat list of root collisions. There's no way to tell which ones had deep chains, which modes were used, or to filter/search past collisions.

**Questions to explore:**
- Show chain depth indicator on history entries (e.g. a small "3 chains" tag)?
- Filter by mode (core / learning / narrative / chain)?
- Search by problem text or domain?
- Bookmarking: field exists in Firestore (`bookmarked: false`) but no UI yet
- Group by date (Today, This Week, Earlier)?
