# Vikunja for Gladys Assistant

An external integration for [Gladys Assistant](https://gladysassistant.com)
that brings the tasks of a self-hosted [Vikunja](https://vikunja.io) into
Gladys, over the local network: what is left to do today, what is overdue,
reminders as scene triggers, and tasks marked done or created from a scene or
the dashboard.

> **Feedback welcome.** The integration was checked against a real Vikunja
> server (Docker image `vikunja/vikunja` v2.7.0, October 2026), but not yet in
> everyday use with a real Gladys. Please report what works and what does not
> in the [issues](https://github.com/guim31/gladys-vikunja/issues).

## Features

- **A "Vikunja" device** for every followed project together, and **one
  device per followed project** (all by default, or a list of names or
  numbers), each with four features: _open tasks_, _tasks to do today_
  (overdue ones included), _overdue tasks_ and the _next task_ (text).
- **Dashboard widget** "Today's tasks": two tiles, the list of the tasks of the
  day (overdue first, time, project, high priority in orange) and a button to
  mark each of the four most urgent done; for every project or one.
- **Scene triggers**: _Vikunja task due_, _Vikunja task reminder_ and _Vikunja
  task overdue_ (at midnight, the task of the day still undone); filters on
  the project and the title; the task, its number, project, priority and due
  date as variables. Once each, across restarts.
- **Scene actions**: _Mark a Vikunja task done_ (title or number; a repeating
  task moves to its next due date), _Create a Vikunja task_ (in a project by
  name or number) and _Read today's Vikunja tasks_ (a sentence for a message or
  a voice announcement).
- On time: besides the refresh interval (1 to 10 minutes, 5 by default), the
  integration reads Vikunja at each due time, reminder and local midnight (the
  time zone of Gladys).
- A **Test the connection** button, a connection status that names the
  problem (token refused, no Vikunja at this address, certificate…), and a
  transport badge per device.
- Every text in English, French, German and Spanish.

## Requirements

- Gladys Assistant **5.1.0** or later (widgets, scene triggers and actions).
- A **self-hosted Vikunja** (0.22 or later), reachable from Gladys, and an
  **API token** of one of its users (Vikunja → Settings → API Tokens) with the
  permissions _Projects: read_all_ and _Tasks: read_all, read_one, update,
  create_. The integration acts as this user.

## Installation

1. In Gladys, open **Integrations** → **Install from GitHub** and enter the
   address of this repository: `https://github.com/guim31/gladys-vikunja`
   (or install **Vikunja** from the catalog once it is listed).
2. In **Configuration**, enter the address of Vikunja
   (`http://192.168.1.20:3456`, `https://tasks.example.org`…) and the API
   token. Save, then click **Test the connection**.
3. Open the **Discover** tab and add the devices.

The user guide is in [`docs/en.md`](docs/en.md) (also in
[French](docs/fr.md), [German](docs/de.md) and [Spanish](docs/es.md)); Gladys
links it from the Configuration screen.

## How it works

The integration uses the REST API of Vikunja, `/api/v1`, with the API token in
the `Authorization: Bearer` header:

| Request                                        | Use                                               |
| ---------------------------------------------- | ------------------------------------------------- |
| `GET /api/v1/info`                             | version, "is this Vikunja" (no token)             |
| `GET /api/v1/projects`                         | projects (archived ones and filters left out)     |
| `GET /api/v1/tasks?filter=done = false&page=N` | open tasks, 50 per page (`/tasks/all` before 1.0) |
| `GET` then `POST /api/v1/tasks/{id}`           | mark a task done (the whole task sent back)       |
| `PUT /api/v1/projects/{id}/tasks`              | create a task                                     |

An update replaces the whole task in Vikunja: a body `{ "done": true }` alone
also wipes its due date, priority and reminders, so the task is read first.
Vikunja is read on a timer of the container; the devices are published with
`should_poll: false`. States are published only when they change, and every
12 hours otherwise. The scene events are the moments (due time, reminder, end
of the due day) crossed since the previous reading; the time of the last
reading is kept in `/data/vikunja-state.json`. Vikunja webhooks are not used.

## Checked on a real Vikunja, and what was not

Checked against `vikunja/vikunja` v2.7.0 (SQLite) in a Docker network: an
account, a limited API token, projects (one archived, one sub-project) and
tasks due in the past, today and later, with fixed and relative reminders, a
repeating task, created through the API. The real answers are in
`test/fixtures/vikunja/` and drive the tests; the integration ran in its own
container under the Gladys sandbox limits (read-only root, no capabilities,
256 MB) against that server, against the SDK's fake Gladys.

Not checked: a real Gladys instance, Vikunja 0.22 to 0.24 (the `/tasks/all`
fallback is tested against the fake server only), Vikunja behind a reverse
proxy with a path prefix.

## Limitations

- Marks tasks done and creates tasks; does not edit, delete, move or assign.
- A change made in Vikunja shows up within the refresh interval.
- Up to 1,000 open tasks are read.

## Development

```bash
npm ci
npm run format:check
npm run lint
npm test
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

The tests use the fake Gladys of the SDK (`@gladysassistant/integration-sdk/testing`)
and an in-memory Vikunja (`test/helpers/fakeVikunja.js`) built from real
answers. See [`CLAUDE.md`](CLAUDE.md) for the project rules.

## Credits

- [Vikunja](https://vikunja.io) by its authors (AGPL-3.0): the integration only
  talks to its API; no code was copied. The cover uses the Vikunja logo from
  its [repository](https://github.com/go-vikunja/vikunja) (`frontend/originalMedia/images/logo-full-white.svg`),
  to name the service.
- The architecture and the conformity tests follow
  [gladys-donetick](https://github.com/guim31/gladys-donetick) and
  [gladys-wled](https://github.com/guim31/gladys-wled).

## Disclaimer

This project is not affiliated with, endorsed or sponsored by Vikunja. The
Vikunja name and logo belong to their owners.

## License

Apache-2.0
