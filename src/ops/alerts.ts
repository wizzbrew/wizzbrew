import { NotImplemented } from "../errors.js";

export async function alertStaff(_event: string, _detail: string): Promise<void> {
  throw new NotImplemented("alerts.alertStaff");
}

export async function isPaused(): Promise<boolean> {
  throw new NotImplemented("alerts.isPaused");
}
