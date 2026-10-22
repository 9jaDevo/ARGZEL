"use client";
import { useState } from "react";
import type { ApiReminder } from "@/types/api";
import { type VoiceDraft, type VoiceService } from "@/lib/voice-service";
import { useVoiceReminder } from "@/hooks/use-voice-reminder";
import { ReminderEditor } from "./reminder-editor";
import { Button } from "./ui";
import { useAudioCapture } from "@/hooks/use-audio-capture";
import {
  ListeningScreen,
  PreviewScreen,
  ProcessingScreen,
  SuccessScreen,
  VoiceErrorScreen,
  VoiceFrame,
} from "./voice-screens";

function TypedReminder({
  initial = "",
  onParse,
}: {
  initial?: string;
  onParse: (text: string) => void;
}) {
  const [text, setText] = useState(initial);
  return (
    <form
      className="typed-reminder"
      onSubmit={(event) => {
        event.preventDefault();
        onParse(text);
      }}
    >
      <label className="field">
        <span>Type your reminder</span>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          required
          maxLength={500}
          rows={3}
          placeholder="Remind me to call James tomorrow at 9 AM"
        />
      </label>
      <Button type="submit" className="full">
        Review this reminder
      </Button>
    </form>
  );
}
function CapturePane({
  onFinish,
  onParse,
  onCancel,
}: {
  onFinish: (audio: Blob) => void;
  onParse: (text: string) => void;
  onCancel: () => void;
}) {
  const audio = useAudioCapture();
  const [typing, setTyping] = useState(false);
  if (typing)
    return (
      <VoiceFrame
        step={1}
        eyebrow="A THOUGHT, IN YOUR OWN WORDS"
        title="What’s on your mind?"
        description="Type naturally. You’ll review every detail before saving."
        onCancel={onCancel}
      >
        <TypedReminder onParse={onParse} />
        <Button
          variant="ghost"
          className="full"
          onClick={() => setTyping(false)}
        >
          Use my microphone
        </Button>
      </VoiceFrame>
    );
  return (
    <>
      <ListeningScreen
        elapsed={audio.elapsed}
        paused={audio.state === "paused"}
        onPause={audio.toggle}
        sample="hosting"
        onSample={() => {}}
        captureState={audio.state}
        onFinish={() => {
          void audio.finish().then((blob) => {
            if (blob) onFinish(blob);
          });
        }}
        onCancel={onCancel}
      />
      <div className="capture-alternative">
        {audio.error && (
          <p className="voice-alert" role="alert">
            {audio.error}
          </p>
        )}
        <Button
          variant="ghost"
          className="full"
          onClick={() => {
            audio.cancel();
            setTyping(true);
          }}
        >
          Type instead
        </Button>
      </div>
    </>
  );
}

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
  if (flow.stage === "recording" && flow.mode === "api")
    return (
      <CapturePane
        onFinish={(audio) => {
          void flow.finish(audio);
        }}
        onParse={(text) => {
          void flow.parseText(text);
        }}
        onCancel={onCancel}
      />
    );
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
    return (
      <ProcessingScreen
        demo={flow.mode === "demo"}
        stage={flow.stage}
        onCancel={onCancel}
      />
    );
  if (flow.stage === "error")
    return (
      <>
        <VoiceErrorScreen
          message={flow.error}
          onRetry={retry}
          onCancel={onCancel}
        />
        {flow.mode === "api" && (
          <div className="capture-alternative">
            <TypedReminder
              initial={flow.transcript}
              onParse={(text) => {
                void flow.parseText(text);
              }}
            />
          </div>
        )}
      </>
    );
  if (flow.stage === "success" && flow.saved)
    return (
      <SuccessScreen
        saved={flow.saved}
        demo={flow.mode === "demo"}
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
      demo={flow.mode === "demo"}
      onChoose={flow.chooseClarification}
      onAnswer={
        flow.mode === "api"
          ? (answer) => {
              void flow.parseText(
                flow.result?.source_text ?? flow.transcript,
                answer,
              );
            }
          : undefined
      }
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
