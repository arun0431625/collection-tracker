export const ROLES = {
  ADMIN: "ADMIN",
  BRANCH: "BRANCH",
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

export const STATUS = {
  ALL: "ALL",
  PENDING: "PENDING",
  PARTIAL: "PARTIAL",
  COLLECTED: "COLLECTED",
} as const;

export type StatusFilter = typeof STATUS[keyof typeof STATUS];
