// Bump this whenever the persisted game/slot schema changes in a breaking way.
// Old saves whose version doesn't match are treated as empty (no migration).
// v3: added sharedPlans (whispered vote plans) to the social slice.
export const SAVE_VERSION = 3;
