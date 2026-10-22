"use client";
import { useState } from "react";
import type { ApiReminder } from "@/types/api";
import { type VoiceDraft, type VoiceService } from "@/lib/voice-service";
import { useVoiceReminder } from "@/hooks/use-voice-reminder";
import { ReminderEditor } from "./reminder-editor";
import {
  ListeningScreen,
  PreviewScreen,
  ProcessingScreen,
  SuccessScreen,
  VoiceErrorScreen,
  VoiceFrame,
} from "./voice-screens";

/** Only the confirmed save callback may update the app's reminder list. */
export function VoiceFlow({
  timezone,
  initial,
  readback,
  onSaved,
  onCancel,
  onDetails,
  service,
}: {
  timezone: string;
  initial?: VoiceDraft;
  readback: boolean;
  onSaved: (reminder: ApiReminder) => void;
  onCancel: () => void;
  onDetails: () => void;
  service?: VoiceService;
}) {
  const flow = useVoiceReminder({ timezone, initial, service });
  const [editing, setEditing] = useState(!!initial);
  const retry = () => {
    setEditing(false);
    flow.retry();
  };
  if (flow.stage === "recording")
    return (
      <ListeningScreen
        elapsed={flow.elapsed}
        paused={flow.paused}
        onPause={() => flow.setPaused(!flow.paused)}
        sample={flow.sample}
        onSample={flow.setSample}
        onFinish={() => {
          void flow.finish();
        }}
        onCancel={onCancel}
      />
    );
  if (flow.stage === "transcribing" || flow.stage === "parsing")
    return <ProcessingScreen stage={flow.stage} onCancel={onCancel} />;
  if (flow.stage === "error")
    return (
      <VoiceErrorScreen
        message={flow.error}
        onRetry={retry}
        onCancel={onCancel}
      />
    );
  if (flow.stage === "success" && flow.saved)
    return (
      <SuccessScreen
        saved={flow.saved}
        onHome={onCancel}
        onAnother={retry}
        onDetails={onDetails}
      />
    );
  if (!flow.draft) return null;
  if (editing)
    return (
      <VoiceFrame
        step={2}
        eyebrow="A LITTLE FINE-TUNING"
        title="Make it yours."
        description="Your words, with every detail in place."
        onCancel={() => setEditing(false)}
      >
        <ReminderEditor
          draft={flow.draft}
          onReview={(value) => {
            flow.updateDraft(value);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </VoiceFrame>
    );
  return (
    <PreviewScreen
      draft={flow.draft}
      result={flow.result}
      saving={flow.stage === "saving"}
      error={flow.error}
      uncertain={flow.uncertain}
      readback={readback}
      onEdit={() => setEditing(true)}
      onRetry={retry}
      onConfirm={() => {
        void flow.confirm().then((saved) => {
          if (saved) onSaved(saved);
        });
      }}
      onCancel={onCancel}
    />
  );
}
