// -----------------------------------------------------------------------------
// Unit tests of the pure parts: the address and the project list typed by the
// user, the parsing of real Vikunja answers, the counters, the search by
// number or title.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeConfig, parseProjectList, parseServerUrl } from '../src/config.js';
import {
  findByIdOrTitle,
  localDay,
  parseProjects,
  parseTasks,
  summarize,
} from '../src/vikunja/model.js';

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`./fixtures/vikunja/${name}.json`, import.meta.url), 'utf8'));

test('the address: bare host, copied browser URL, API URL, reverse proxy prefix', () => {
  assert.equal(parseServerUrl('192.0.2.10:3456'), 'http://192.0.2.10:3456');
  assert.equal(
    parseServerUrl(' https://tasks.example.org/projects/2/1 '),
    'https://tasks.example.org',
  );
  assert.equal(parseServerUrl('http://192.0.2.10:3456/api/v1/'), 'http://192.0.2.10:3456');
  assert.equal(parseServerUrl('https://example.org/vikunja/'), 'https://example.org/vikunja');
  assert.equal(parseServerUrl('https://user:pass@example.org'), null, 'no credentials');
  assert.equal(parseServerUrl('ftp://example.org'), null);
  assert.equal(parseServerUrl(''), null);
});

test('the followed projects and the defaults', () => {
  assert.deepEqual(parseProjectList(' Maison, 3 ;Maison,, '), ['Maison', '3']);
  const config = normalizeConfig({ url: '192.0.2.10', api_token: ' tk_x ', poll_interval: '7' });
  assert.equal(config.token, 'tk_x');
  assert.equal(config.pollIntervalMs, 300_000);
  assert.equal(config.language, 'fr');
  assert.deepEqual(config.projects, []);
});

test('real projects: no saved filter, no archived project, by position', () => {
  const projects = parseProjects([
    ...fixture('real-projects'),
    { id: 9, title: 'Ancien', is_archived: true },
  ]);
  assert.deepEqual(
    projects.map((project) => [project.id, project.title, project.parentId]),
    [
      [4, 'Jardin', 2],
      [1, 'Inbox', 0],
      [2, 'Maison', 0],
      [3, 'Courses', 0],
    ],
  );
});

test('real tasks: year 1 is no date, reminders in ms, repeating flag', () => {
  const tasks = parseTasks(fixture('real-tasks-open'));
  assert.equal(tasks.length, 8);
  const bread = tasks.find((task) => task.id === 11);
  assert.equal(bread.dueAt, null);
  assert.equal(tasks.at(-1).id, 11, 'undated last');
  const canteen = tasks.find((task) => task.id === 12);
  assert.deepEqual(canteen.reminders, [Date.UTC(2026, 9, 19, 17, 0)]);
  assert.equal(canteen.priority, 4);
  assert.equal(tasks.find((task) => task.id === 9).repeats, true);
  assert.deepEqual(parseTasks([{ id: 1, done: true }, null, { title: 'no id' }]), []);
});

test('the counters of a day, overdue included in "to do today"', () => {
  const tasks = parseTasks(fixture('real-tasks-open'));
  const now = Date.UTC(2026, 9, 19, 16, 30);
  const day = localDay(now, 'Europe/Paris');
  assert.equal(new Date(day.start).toISOString(), '2026-10-18T22:00:00.000Z');
  const all = summarize(tasks, { now, day });
  assert.deepEqual([all.open, all.toDoToday, all.overdue, all.next.id], [8, 4, 2, 9]);
  const garden = summarize(tasks, { now, day, projectId: 4 });
  assert.deepEqual([garden.open, garden.toDoToday, garden.overdue], [1, 0, 0]);
});

test('find by number or exact title', () => {
  const items = [
    { id: 3, title: 'Café' },
    { id: 12, title: 'Sortir les  poubelles' },
    { id: 14, title: 'cafe' },
    { id: 20, title: '12' },
  ];
  assert.equal(findByIdOrTitle(items, '#12').item.id, 12);
  assert.equal(findByIdOrTitle(items, 12).item.id, 12);
  assert.equal(findByIdOrTitle(items, 'sortir LES poubelles').item.id, 12);
  assert.equal(findByIdOrTitle(items, 'CAFÉ').reason, 'ambiguous');
  assert.equal(findByIdOrTitle(items, '#99').reason, 'not_found');
  assert.equal(findByIdOrTitle(items, '').reason, 'empty');
});
