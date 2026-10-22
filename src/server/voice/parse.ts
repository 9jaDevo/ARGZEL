import type { ParseResult } from '@/types/api';
import { addDays, utcToZoned, weekdayIndex } from '../time';
import { WEEKDAYS, parseExtraction, type Extraction } from './extraction';
import { aiUnavailable, generate } from './gemma';
import { resolveReminder } from './resolve';

// Voice parsing pipeline: Gemma describes the reminder, resolve.ts computes it.

export const SYSTEM_PROMPT = `You extract reminder details from what a user said to the ARGZEL voice reminder app.
Reply with ONLY one JSON object (no prose, no code fences) with exactly these keys:
{"title": string|null, "notes": string|null, "date": "YYYY-MM-DD"|null, "day_offset": integer|null, "day_of_month": integer|null,"weekday": "monday"|"tuesday"|"wednesday"|"thursday"|"friday"|"saturday"|"sunday"|null, "weekday_modifier": "this"|"next"|null, "minute_offset": integer|null, "time": "HH:mm"|null, "time_ambiguous_meridiem": boolean, "day_part": "morning"|"afternoon"|"evening"|"night"|null, "recurrence": "none"|"daily"|"weekly"|"monthly", "recurrence_unsupported": boolean, "confidence": number, "clarification_question": string|null}

Rules:
- title: the task as a short phrase starting with a verb, in the user's own words, without "remind me to". Examples: "Renew my hosting", "Call James", "Pray", "Go to the dentist". At most 80 characters. null if the user did not say what the reminder is for.
- notes: extra details that are neither the task nor the time, else null.
- Describe WHEN with the fields below. Do not compute dates yourself, except for "date".
  - day_offset: today = 0, tomorrow = 1, the day after tomorrow = 2, "in 3 days" = 3.
  - weekday: for named weekdays, including "every Monday". weekday_modifier: "this" or "next" only if the user said that word, else null.
  - day_of_month: when the user names only a day number without a month ("on the 5th", "every month on the 30th"): 5, 30.
  - date: only when the user names a month and day ("October 23", "23rd of November"). Use the calendar given to pick the year: the next such date on or after today.
  - minute_offset: for "in 20 minutes" (20), "in two hours" (120), "in an hour and a half" (90). When set, leave date, day_offset, day_of_month, weekday and time null.
- time: 24-hour "HH:mm" when the user states a clock time: "10 AM" = "10:00", "8 in the morning" = "08:00", "half past 7 in the evening" = "19:30", "noon" = "12:00", "midnight" = "00:00". If no clock time is stated, null. Never invent a time.
- time_ambiguous_meridiem: true when a time such as "at 7" has no AM/PM and nothing else in the sentence says which; still put your best guess in time.
- day_part: "morning", "afternoon", "evening" or "night" when the user names a part of the day ("tonight" = night with day_offset 0, "this evening" = evening with day_offset 0), else null.
- recurrence: "daily" (every day, every morning, nightly), "weekly" (every Monday, each week), "monthly" (every month, monthly on the 5th), else "none".
- recurrence_unsupported: true for other repeat patterns (every other day, weekdays only, every two weeks, yearly); then set recurrence to the closest supported value.
- confidence: 0 to 1, how sure you are that these fields capture what the user meant.
- clarification_question: a short question only if something essential is unclear and not covered by the fields above, else null.

Examples:
User: "Remind me to renew my hosting next Friday at 10 AM."
{"title":"Renew my hosting","notes":null,"date":null,"day_offset":null,"day_of_month":null,"weekday":"friday","weekday_modifier":"next","minute_offset":null,"time":"10:00","time_ambiguous_meridiem":false,"day_part":null,"recurrence":"none","recurrence_unsupported":false,"confidence":0.9,"clarification_question":null}
User: "Tomorrow morning remind me to call James about the contract."
{"title":"Call James","notes":"About the contract","date":null,"day_offset":1,"day_of_month":null,"weekday":null,"weekday_modifier":null,"minute_offset":null,"time":null,"time_ambiguous_meridiem":false,"day_part":"morning","recurrence":"none","recurrence_unsupported":false,"confidence":0.85,"clarification_question":null}
User: "Every Monday at 7 AM remind me to pray."
{"title":"Pray","notes":null,"date":null,"day_offset":null,"day_of_month":null,"weekday":"monday","weekday_modifier":null,"minute_offset":null,"time":"07:00","time_ambiguous_meridiem":false,"day_part":null,"recurrence":"weekly","recurrence_unsupported":false,"confidence":0.95,"clarification_question":null}`;

export type ParseRequest = {
  text: string;
  clarification?: { question: string; answer: string };
  timezone: string;
  now: Date;
};

/** The per-request message: today's date in the user's timezone, a 14-day calendar, and what they said. */
export function buildUserPrompt({ text, clarification, timezone, now }: ParseRequest) {
  const today = utcToZoned(now, timezone);
  const day = (offset: number) => {
    const date = addDays(today.date, offset);
    const name = WEEKDAYS[weekdayIndex(date)];
    return `${name.charAt(0).toUpperCase()}${name.slice(1, 3)} ${date}${offset === 0 ? ' (today)' : ''}`;
  };
  const lines = [
    `Now: ${day(0).replace(' (today)', '')} ${today.time} (${timezone}).`,
    `Calendar: ${Array.from({ length: 14 }, (_, i) => day(i)).join(', ')}.`,
    `User: ${JSON.stringify(text)}`,
  ];
  if (clarification) {
    lines.push(
      `The app then asked: ${JSON.stringify(clarification.question)}`,
      `User answered: ${JSON.stringify(clarification.answer)}`,
      'Combine the original request with the answer.',
    );
  }
  return lines.join('\n');
}

export async function parseReminder(request: ParseRequest): Promise<ParseResult> {
  const prompt = buildUserPrompt(request);
  let extraction: Extraction | null = null;
  // One retry covers the occasional reply that is not valid JSON.
  for (let attempt = 0; attempt < 2 && !extraction; attempt++) {
    extraction = parseExtraction(await generate(SYSTEM_PROMPT, prompt));
  }
  if (!extraction) throw aiUnavailable();

  const sourceText = request.clarification ? `${request.text} — ${request.clarification.answer}` : request.text;
  return resolveReminder(extraction, { now: request.now, timezone: request.timezone, sourceText });
}
