// What Sentry may collect (spec §12: log only necessary operational data).
// SDK v11 defaults collect request bodies, cookies and query data; ARGZEL
// requests carry passwords, transcripts and reminder text, so all of that is off.
export const sentryDataCollection = {
  userInfo: false, // no automatic IP/email; only the user id we set explicitly
  cookies: false, // the session cookie
  httpHeaders: { request: { deny: ['cookie', 'authorization', 'x-forwarded-for'] }, response: false },
  httpBodies: [], // passwords, transcripts, audio, reminder text
  genAI: { inputs: false, outputs: false }, // prompts contain what the user said
  databaseQueryData: false, // queries contain emails, titles, notes
  stackFrameVariables: false, // locals may hold any of the above
};
