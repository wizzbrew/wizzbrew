import { NotImplemented } from "../errors.js";

export function nowBlock(_now: Date): string {
  throw new NotImplemented("time.nowBlock");
}

export function parseWizzrobeTime(_iso: string): Date {
  throw new NotImplemented("time.parseWizzrobeTime");
}

export function discordTimestamp(_d: Date, _style?: "f" | "F" | "t" | "R"): string {
  throw new NotImplemented("time.discordTimestamp");
}

export function communityDate(_d: Date): string {
  throw new NotImplemented("time.communityDate");
}

export function parseUserDateTime(
  _text: string,
  _now: Date,
): { date: string; time: string; instant: Date } {
  throw new NotImplemented("time.parseUserDateTime");
}

export function dayWindowUtc(_date: string): { start: Date; end: Date } {
  throw new NotImplemented("time.dayWindowUtc");
}
