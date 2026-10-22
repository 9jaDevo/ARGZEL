export function timezones(current: string): string[] {
  let supported: string[];
  try {
    supported = Intl.supportedValuesOf("timeZone");
  } catch {
    supported = [
      "Africa/Lagos",
      "America/New_York",
      "Europe/London",
      "Asia/Dubai",
      "Asia/Kolkata",
      "Australia/Sydney",
    ];
  }
  return Array.from(new Set(["UTC", current, ...supported])).sort();
}
