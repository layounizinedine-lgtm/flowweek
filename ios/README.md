# FlowWeek iOS

Native SwiftUI scaffold for iPhone and iPad.

## What is included

- Speech dictation with Apple's Speech framework.
- AI polish, summarize, formalize, translate, and bullet actions via the FlowWeek backend proxy.
- Local history and snippets with `UserDefaults`.
- Copy and share actions.
- No API keys in the iOS app.

## Open in Xcode

Recommended path:

1. Install Xcode.
2. Install XcodeGen if you want to generate the project from `project.yml`.
3. From this folder, run `xcodegen generate`.
4. Open `FlowWeek.xcodeproj`.
5. Set your Apple Team in Signing & Capabilities.

The iOS app expects the same backend proxy as the web app:

`https://flowweek-one.vercel.app/api/chat`

## Security notes

The app never stores an Anthropic API key. It only talks to the FlowWeek proxy. Keep `ALLOWED_ORIGINS` tight for the web app, and use separate mobile auth/rate-limiting when the native app gets a production backend token flow.

