# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.1] - 2026-10-22

### Security

- Rebuilt on Node.js 24.22.1, the October 2026 security release (remote code
  execution in the Brotli decoder, CVE-2026-111497; TLS hostname and DNS
  fixes).

## [1.0.0] - 2026-10-19

### Added

- Vikunja tasks in Gladys: a "Vikunja" device for every followed project
  together and one device per project, with the open tasks, the tasks to do
  today (overdue ones included), the overdue tasks and the next task.
- A choice of the followed projects, by name or number (all by default).
- Dashboard widget "Today's tasks": the tasks of the day, overdue first, with
  a button to mark each of the four most urgent done; for every project or one.
- Scene triggers "Vikunja task due", "Vikunja task reminder" and "Vikunja task
  overdue" (at midnight), with project and title filters, and the task, its
  project, priority and due date as variables.
- Scene actions "Mark a Vikunja task done" (by title or number; repeating tasks
  move to their next due date), "Create a Vikunja task" and "Read today's
  Vikunja tasks" (a sentence for a message or a voice announcement).
- Counters and events on time at each due time, reminder and local midnight,
  whatever the refresh interval (1 to 10 minutes).
- A "Test the connection" button and a connection status naming the problem.
- Every text in English, French, German and Spanish.

[Unreleased]: https://github.com/guim31/gladys-vikunja/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/guim31/gladys-vikunja/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/guim31/gladys-vikunja/releases/tag/v1.0.0
