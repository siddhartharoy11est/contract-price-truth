import type { RoleId } from "./types";

export interface RoleInfo {
  id: RoleId;
  name: string;
  title: string;
  short: string;
}

export const ROLES: RoleInfo[] = [
  { id: "procurement", name: "Priya Nair", title: "Procurement Manager", short: "Procurement" },
  { id: "finance", name: "Dev Mehta", title: "AP Analyst, Finance", short: "Finance" },
  { id: "legal", name: "Anika Rao", title: "Legal Counsel", short: "Legal" },
];

export const roleById = (id: RoleId) => ROLES.find((r) => r.id === id)!;
