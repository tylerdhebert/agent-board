import type { Card, Comment, Feature } from "../db/schema";

export function formatCardRef(refNum: number) {
  return `card-${refNum}`;
}

export function formatFeatureRef(refNum: number) {
  return `feat-${refNum}`;
}

export function serializeFeature(feature: Feature) {
  return {
    ...feature,
    ref: formatFeatureRef(feature.refNum),
  };
}

export function serializeCard(card: Card) {
  return {
    ...card,
    ref: formatCardRef(card.refNum),
  };
}

export function serializeCardWithComments(card: Card, comments: Comment[]) {
  return {
    ...serializeCard(card),
    comments,
  };
}
