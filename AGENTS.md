# Agent Rules

## Release Versioning

- Before creating or pushing a release tag, update `package.json` `version` to the same semantic version.
- Release tags may use a leading `v` (for example, `v1.2.3`), but `package.json` must omit it (`1.2.3`).
- Do not rely on CI to rewrite package metadata during release builds; electron-builder reads `${version}` from `package.json` when naming artifacts.
- If a release tag and `package.json` disagree, GitHub Actions is expected to fail before packaging.
