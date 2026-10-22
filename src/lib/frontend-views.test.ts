import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Dashboard } from "@/components/dashboard";
import { PreviewScreen, SuccessScreen } from "@/components/voice-screens";
import { SettingsScreen } from "@/components/settings-screen";
import {
  createMockVoiceService,
  createInput,
  draftFromParse,
} from "./voice-service";
const noop = () => {};
const title = (text: string) => createElement("h1", null, text);
describe("live UI distinctions", () => {
  it("does not present a failed load as a successful empty account", () => {
    const html = renderToStaticMarkup(
      createElement(Dashboard, {
        screen: "home",
        title,
        items: [],
        filter: "Upcoming",
        setFilter: noop,
        onCreate: noop,
        onOpen: noop,
        onViewAll: noop,
        isDemo: false,
        name: "Ada",
        timezone: "UTC",
        error: "Couldn’t load",
      }),
    );
    expect(html).toContain("Couldn’t load");
    expect(html).toContain("Try again");
    expect(html).not.toContain("A clear space. A fresh start.");
    expect(html).not.toContain("DEMO DAY");
    expect(html).toContain("Hello, Ada");
  });
  it("shows clarification choices and real save copy", async () => {
    const service = createMockVoiceService({ delay: 0 });
    const result = await service.parse(
      {
        text: "Remind me to renew my website hosting tomorrow at 10 AM.",
        timezone: "UTC",
      },
      new AbortController().signal,
    );
    const html = renderToStaticMarkup(
      createElement(PreviewScreen, {
        draft: draftFromParse(result),
        result: {
          ...result,
          needs_clarification: true,
          clarification_question: "Which day?",
          options: [{ label: "Friday 23 October", result }],
        },
        saving: false,
        error: "",
        uncertain: false,
        readback: true,
        onEdit: noop,
        onRetry: noop,
        onConfirm: noop,
        onCancel: noop,
        demo: false,
        onChoose: noop,
      }),
    );
    expect(html).toContain("Friday 23 October");
    expect(html).toContain("Only Confirm saves");
    expect(html).not.toContain("Demo session only");
  });
  it("does not offer a fake account email preference", () => {
    const html = renderToStaticMarkup(
      createElement(SettingsScreen, {
        title,
        timezone: "Asia/Kolkata",
        onTimezone: noop,
        emailEnabled: true,
        onEmail: noop,
        readback: true,
        onReadback: noop,
        onReplay: noop,
        onLeave: noop,
        onNotice: noop,
        isDemo: false,
        user: {
          id: "1",
          name: "Ada Obi",
          email: "ada@example.com",
          timezone: "Asia/Kolkata",
          onboarding_completed: true,
          created_at: "",
          updated_at: "",
        },
      }),
    );
    expect(html).toContain("Ada Obi");
    expect(html).toContain("Asia/Kolkata");
    expect(html).toContain("opt-out is not available");
    expect(html).toContain("Sign out");
    expect(html).not.toContain("Alex Okafor");
  });
  it("distinguishes account persistence from session-only success", async () => {
    const service = createMockVoiceService({ delay: 0 });
    const signal = new AbortController().signal;
    const result = await service.parse(
      {
        text: "Remind me to renew my website hosting tomorrow at 10 AM.",
        timezone: "UTC",
      },
      signal,
    );
    const saved = await service.save(createInput(draftFromParse(result)), {
      signal,
    });
    const html = renderToStaticMarkup(
      createElement(SuccessScreen, {
        saved,
        onHome: noop,
        onAnother: noop,
        onDetails: noop,
        demo: false,
      }),
    );
    expect(html).toContain("Saved to your account");
    expect(html).not.toContain("demo session");
  });
});
