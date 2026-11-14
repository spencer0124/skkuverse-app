# skkuverse-app

> The React Native app behind [skkuverse](https://skkuverse.com), a campus companion for Sungkyunkwan University students.

## Features

- Live positions of the campus shuttle and city buses, and the shuttle timetables
- Department notices with AI summaries, per-source subscriptions and push notifications
- A campus map with building and room search, shared by the map and transit tabs
- Mini apps and mini games, opened inside the app
- A home screen and map whose sections the server decides

## How it fits

The app reads public data (buses, notices, buildings, the map) from skkuverse-server, and keeps
user data in Firebase Auth and Firestore. The server-side rules and functions it talks to are kept
outside this repository. The pages it opens in a web view come from
skkuverse-web, a repository outside this one, and the notices from
skkuverse-crawler and skkuverse-ai.

## Repository layout

| Path | What it holds |
| --- | --- |
| `apps/mobile/` | The Expo and React Native app: routes in `app/`, features in `src/features/` |
| `packages/shared/` | The API client, stores, React Query hooks, types, design tokens and i18n |
| `packages/sds/` | The Skku Design System components |
| `packages/bridge/` | The message contract between the app and its web view pages |
| `docs/` | The documentation, whose writing rules are [docs/README.md](docs/README.md) |

## Getting started

The app runs as a native build on a simulator, an emulator or a device, with Node from `.nvmrc`
and Yarn 1. Expo Go does not work. [Getting Started](docs/tutorials/getting-started.md) walks from
a fresh clone to a running app. A full build needs Firebase config files that are not committed,
which a maintainer provides to invited contributors.

[CLAUDE.md](CLAUDE.md) holds the architecture and its rules, and
[ADR 0020](docs/decisions/0020-app-architecture.md) the module shape. The maintainers make store
releases and OTA updates from outside this repository.

## Contributing

Issues are welcome, and pull requests are by invitation. [CONTRIBUTING.md](CONTRIBUTING.md) says
how changes flow and which checks to run.

## Security

Report a vulnerability privately, as [SECURITY.md](SECURITY.md) describes, never in a public issue.

## License

[Apache License 2.0](LICENSE), copyright 2024-2026 spencer0124. Third-party code, fixture data and
brand assets are listed in [NOTICE](NOTICE).
