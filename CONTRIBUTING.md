# Contributing

Thanks for your interest in skkuverse-app.

## Issues are welcome

Open an issue for a bug, unclear documentation or an idea. Say what you expected, what happened, and how to reproduce it. For a security problem, do not open an issue: follow [SECURITY.md](SECURITY.md).

## Pull requests are by invitation

This app runs a live service with one maintainer, so we accept pull requests only when a maintainer has asked for one, usually in an issue. A pull request that nobody asked for may be closed without review. If you want to work on something, open an issue first and ask.

The backend of the app is not in this repository. A change that touches Firebase data (Firestore documents, rules or callable functions) needs a maintainer: open an issue and wait for one to take it. Firebase client config files are not committed, so a full build also needs maintainer config.

Workflows on a pull request from a fork wait for a maintainer's approval before they run.

A maintainer may ask Claude about a pull request with `@claude` in a top-level comment. A review or a review comment does not start Claude: it runs on the pull request's merge ref, and Claude's token is available only to a run on `main`.

## How changes flow

- `dev` is the working branch. Every change reaches `dev`, by pull request or by a maintainer's commit.
- `main` is the release branch. It takes only the `dev` to `main` pull request.
- An invited pull request targets `dev`.

## Before you open an invited pull request

Run the same checks as CI:

```bash
yarn install
yarn typecheck
yarn lint
yarn test
```

- Follow [CLAUDE.md](CLAUDE.md) and the architecture decision ([docs/decisions/0020-app-architecture.md](docs/decisions/0020-app-architecture.md)).
- Write the test first. Never weaken, skip or delete an existing test to get green.
- Write code, comments, docs and commit messages in English. Use conventional commit subjects, such as `fix(map): ...`.

By contributing, you agree that your contribution is licensed under the [Apache License 2.0](LICENSE).
