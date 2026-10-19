// -----------------------------------------------------------------------------
// The hub against the in-memory Vikunja (real answers of vikunja/vikunja
// v2.7.0): counters, followed projects, scene events, the scene actions and
// the error cases. The clock starts on 19/10/2026 at 18:30 in Paris.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BASE_CONFIG,
  FakeVikunja,
  START,
  TOKEN,
  URL_1,
  createClock,
  createWorld,
  overviewId,
  projectId,
} from './helpers/world.js';

const HOUR = 60 * 60_000;
const at = (h, m = 0, s = 0) => Date.UTC(2026, 9, 19, h, m, s); // UTC, 19/10/2026

async function world(t, options = {}) {
  const w = await createWorld(options);
  t.after(() => w.app.stop());
  return w;
}

const counters = (w, ids) => ({
  open: w.fake.lastState(ids.feature('open')),
  toDo: w.fake.lastState(ids.feature('to_do_today')),
  overdue: w.fake.lastState(ids.feature('overdue')),
  next: w.fake.lastState(ids.feature('next_task')),
});

const keys = (w) => w.fake.sceneEvents.map((event) => `${event.key}:${event.data.task_id}`);

test('the counters of every followed project together and of each one', async (t) => {
  const w = await world(t);
  assert.deepEqual(counters(w, overviewId(w.gladys)), {
    open: 8,
    toDo: 4,
    overdue: 2,
    next: 'Arroser les plantes',
  });
  assert.deepEqual(counters(w, projectId(w.gladys, 2)), {
    open: 4,
    toDo: 3,
    overdue: 2,
    next: 'Arroser les plantes',
  });
  assert.deepEqual(counters(w, projectId(w.gladys, 3)), {
    open: 2,
    toDo: 1,
    overdue: 0,
    next: 'Payer la cantine',
  });
  assert.deepEqual(counters(w, projectId(w.gladys, 1)), {
    open: 1,
    toDo: 0,
    overdue: 0,
    next: 'Rappeler le garage',
  });
  assert.deepEqual(
    w.fake.discoveredDevices.map((device) => device.name),
    ['Vikunja', 'Vikunja Jardin', 'Vikunja Inbox', 'Vikunja Maison', 'Vikunja Courses'],
  );
  assert.equal(w.fake.connectionStatus.connected, true);
});

test('only the followed projects, by name or number; unknown ones are reported', async (t) => {
  const w = await world(t, { config: { ...BASE_CONFIG, projects: 'maison; 3, Atelier' } });
  assert.deepEqual(
    w.fake.discoveredDevices.map((device) => device.name),
    ['Vikunja', 'Vikunja Maison', 'Vikunja Courses'],
  );
  assert.equal(counters(w, overviewId(w.gladys)).open, 6, 'the overview follows them too');
  const ack = await w.fake.action('test_connection', {});
  assert.equal(ack.success, true, ack.error);
  assert.equal(
    ack.data.message.en,
    'Vikunja v2.7.0 OK: 6 open task(s) in 2 followed project(s). Unknown project(s) ignored: Atelier.',
  );
});

test('two projects with the same title get distinct device names', async (t) => {
  const server = new FakeVikunja({ now: createClock().now });
  server.projects.find((project) => project.id === 4).title = 'Maison';
  const w = await world(t, { server });
  assert.deepEqual(w.fake.discoveredDevices.map((device) => device.name).slice(1), [
    'Vikunja Maison #4',
    'Vikunja Inbox',
    'Vikunja Maison #2',
    'Vikunja Courses',
  ]);
});

test('the day turns at local midnight, not UTC midnight', async (t) => {
  const clock = createClock();
  const w = await world(t, { clock });
  clock.time = at(21, 30); // 23:30 in Paris
  await w.hub.poll();
  assert.equal(counters(w, overviewId(w.gladys)).toDo, 4);
  assert.equal(counters(w, overviewId(w.gladys)).overdue, 4);
  clock.time = at(22, 30); // 00:30 in Paris on the 20th, still the 19th in UTC
  await w.hub.poll();
  assert.equal(counters(w, overviewId(w.gladys)).toDo, 4, 'nothing new is due on the 20th');
});

test('nothing fires at the first reading; reminders, due times and midnight fire once', async (t) => {
  const clock = createClock();
  const w = await world(t, { clock });
  assert.deepEqual(w.fake.sceneEvents, [], 'what already passed is not news');

  clock.time = at(17, 0, 5); // the reminder of the canteen, one hour before
  await w.hub.poll();
  await w.hub.poll();
  assert.deepEqual(keys(w), ['task_reminder:12']);
  assert.deepEqual(w.fake.sceneEvents[0].data, {
    task: 'Payer la cantine',
    task_id: 12,
    project: projectId(w.gladys, 3).device,
    project_name: 'Courses',
    priority: 4,
    due_date: '2026-10-19T18:00:00.000Z',
    reminder: '2026-10-19T17:00:00.000Z',
  });

  clock.time = at(18, 0, 2); // the 17:15 reminder and the two 18:00 due times
  await w.hub.poll();
  assert.deepEqual(keys(w).slice(1), ['task_reminder:10', 'task_due:9', 'task_due:12']);

  clock.time = at(22, 0, 2); // midnight in Paris: three tasks of the 19th left undone
  await w.hub.poll();
  await w.hub.poll();
  assert.deepEqual(keys(w).slice(4), ['task_overdue:8', 'task_overdue:9', 'task_overdue:12']);
});

test('a task done before its due time fires nothing', async (t) => {
  const clock = createClock();
  const w = await world(t, { clock });
  const ack = await w.fake.sceneAction('complete_task', { task: 'payer la CANTINE' });
  assert.equal(ack.success, true, ack.error);
  clock.time = at(22, 0, 2);
  await w.hub.poll();
  assert.ok(!keys(w).some((key) => key.endsWith(':12')), keys(w).join());
});

test('a due date moved into the past by hand is no crossing', async (t) => {
  const clock = createClock();
  const w = await world(t, { clock });
  w.server.task(13).due_date = '2026-10-19T16:00:00Z';
  clock.advance(60_000);
  await w.hub.poll();
  assert.deepEqual(w.fake.sceneEvents, []);
  assert.equal(counters(w, overviewId(w.gladys)).overdue, 3);
});

test('the events survive a restart, without repeats, and are dropped when too late', async (t) => {
  const clock = createClock();
  const first = await createWorld({ clock });
  await first.app.stop();
  // Down from 16:30 to 18:10 UTC: the reminders and due times passed meanwhile;
  // the 17:00 reminder is more than an hour old, dropped.
  clock.time = at(18, 10);
  const second = await createWorld({ clock, dataDir: first.dataDir });
  t.after(() => second.app.stop());
  assert.deepEqual(keys(second), ['task_reminder:10', 'task_due:9', 'task_due:12']);
  await second.app.stop();
  const third = await createWorld({ clock, dataDir: first.dataDir });
  t.after(() => third.app.stop());
  assert.deepEqual(third.fake.sceneEvents, [], 'nothing twice');

  await third.app.stop();
  clock.time = at(23, 30); // midnight passed 90 minutes ago: too late to be useful
  const fourth = await createWorld({ clock, dataDir: first.dataDir });
  t.after(() => fourth.app.stop());
  assert.deepEqual(fourth.fake.sceneEvents, []);
});

test('complete_task: by title or number, the whole task kept, repeating ones move on', async (t) => {
  const w = await world(t);
  const ok = await w.fake.sceneAction('complete_task', { task: '  VIDER le lave-vaisselle ' });
  assert.equal(ok.success, true, ok.error);
  assert.deepEqual(ok.data.outputs, {
    task: 'Vider le lave-vaisselle',
    task_id: 8,
    project_name: 'Maison',
    next_due_date: '',
  });
  const done = w.server.task(8);
  assert.equal(done.done, true);
  assert.equal(done.due_date, '2026-10-19T10:00:00+02:00', 'the update did not wipe the task');
  assert.equal(done.priority, 2);
  assert.equal(counters(w, overviewId(w.gladys)).overdue, 1, 'the counters follow at once');

  const repeating = await w.fake.sceneAction('complete_task', { task: '#9' });
  assert.equal(repeating.success, true, repeating.error);
  assert.equal(repeating.data.outputs.next_due_date, '2026-10-20T18:00:00.000Z');
  assert.equal(w.server.task(9).done, false);

  assert.equal((await w.fake.sceneAction('complete_task', { task: 13 })).data.outputs.task_id, 13);
  const missing = await w.fake.sceneAction('complete_task', { task: '#999' });
  assert.match(missing.error, /No open task/);
  const empty = await w.fake.sceneAction('complete_task', { task: ' ' });
  assert.match(empty.error, /title or the number/);
  w.server.task(14).title = 'Acheter du pain';
  const twice = await w.fake.sceneAction('complete_task', { task: 'acheter du pain' });
  assert.match(twice.error, /Several open tasks/);
});

test('create_task: in a project by name or number, or in the first one', async (t) => {
  const w = await world(t);
  const ok = await w.fake.sceneAction('create_task', {
    title: ' Acheter du lait ',
    project: 'courses',
  });
  assert.equal(ok.success, true, ok.error);
  assert.deepEqual(ok.data.outputs, {
    task: 'Acheter du lait',
    task_id: 100,
    project_name: 'Courses',
  });
  assert.equal(counters(w, projectId(w.gladys, 3)).open, 3);

  const inbox = await w.fake.sceneAction('create_task', { title: 'Appeler mamie' });
  assert.equal(inbox.data.outputs.project_name, 'Inbox');
  const byNumber = await w.fake.sceneAction('create_task', { title: 'Semer', project: '#4' });
  assert.equal(byNumber.data.outputs.project_name, 'Jardin');

  const unknown = await w.fake.sceneAction('create_task', { title: 'x', project: 'Atelier' });
  assert.match(unknown.error, /No project has this name/);
  const empty = await w.fake.sceneAction('create_task', { title: '  ' });
  assert.match(empty.error, /title of the new task/);
});

test('read_today: a sentence for a message or a voice announcement', async (t) => {
  const clock = createClock();
  const w = await world(t, { clock, config: { ...BASE_CONFIG, language: 'fr' } });
  const all = await w.fake.sceneAction('read_today', {});
  assert.equal(all.success, true, all.error);
  assert.deepEqual(all.data.outputs, {
    count: 4,
    overdue: 2,
    text: "4 tâche(s) à faire aujourd'hui : Sortir les poubelles, Vider le lave-vaisselle, Arroser les plantes et Payer la cantine. 2 en retard.",
  });
  const courses = await w.fake.sceneAction('read_today', { project: 'Courses' });
  assert.equal(courses.data.outputs.text, "1 tâche(s) à faire aujourd'hui : Payer la cantine.");
  const garden = await w.fake.sceneAction('read_today', { project: 'jardin' });
  assert.equal(garden.data.outputs.text, "Rien à faire aujourd'hui.");
  const unknown = await w.fake.sceneAction('read_today', { project: 'Atelier' });
  assert.match(unknown.error, /Aucun projet/);
});

test('the scene actions answer in the language of the configuration', async (t) => {
  const w = await world(t, { config: { ...BASE_CONFIG, language: 'de' } });
  const missing = await w.fake.sceneAction('complete_task', { task: 'nichts' });
  assert.match(missing.error, /Keine offene Aufgabe/);
});

test('a token refused, or without a permission, says so', async (t) => {
  const refused = await world(t, { config: { ...BASE_CONFIG, api_token: 'tk_wrong' } });
  assert.equal(refused.fake.connectionStatus.connected, false);
  assert.match(refused.fake.connectionStatus.message.en, /API token refused/);
  assert.equal(refused.fake.discoveredDevices.length, 0);

  const server = new FakeVikunja({
    now: createClock().now,
    permissions: { projects: ['read_all'], tasks: ['read_all', 'read_one'] },
  });
  const readOnly = await world(t, { server });
  assert.equal(readOnly.fake.connectionStatus.connected, true);
  const ack = await readOnly.fake.sceneAction('complete_task', { task: '#8' });
  assert.equal(ack.success, false);
  assert.match(ack.error, /missing a permission: see the documentation \(HTTP 401\)/);
  assert.ok(!ack.error.includes(TOKEN));
});

test('an address that is not Vikunja, or that does not answer', async (t) => {
  const w = await world(t, { config: { ...BASE_CONFIG, url: 'http://192.0.2.99:3456' } });
  assert.match(w.fake.connectionStatus.message.en, /does not answer/);
  const ack = await w.fake.action('test_connection', {});
  assert.equal(ack.success, false);
  assert.equal(ack.error, 'Vikunja: Vikunja does not answer.');

  const server = new FakeVikunja({ now: createClock().now });
  server.handle = () => ({ status: 200, headers: {}, body: '<!DOCTYPE html>' });
  const html = await world(t, { server });
  assert.match(html.fake.connectionStatus.message.en, /no Vikunja API/);
});

test('no configuration: a clear status, no request', async (t) => {
  const w = await world(t, { config: { url: '', api_token: '' } });
  assert.match(w.fake.connectionStatus.message.en, /Enter the address/);
  assert.equal(w.server.requests.length, 0);
  const typo = await world(t, { config: { url: 'http://', api_token: TOKEN } });
  assert.match(typo.fake.connectionStatus.message.en, /Address not understood/);
});

test('an outage keeps the devices and marks them unreachable, then back', async (t) => {
  const w = await world(t);
  w.server.online = false;
  await w.hub.poll();
  assert.equal(w.fake.connectionStatus.connected, false);
  assert.equal(w.hub.tasks.length, 8, 'last known tasks kept');
  w.server.online = true;
  await w.hub.poll();
  assert.equal(w.fake.connectionStatus.connected, true);
});

test('Vikunja before 1.0: the task list at /tasks/all', async (t) => {
  const server = new FakeVikunja({ now: createClock().now });
  server.legacyTaskList = true;
  const w = await world(t, { server });
  assert.equal(counters(w, overviewId(w.gladys)).open, 8);
  const before = server.requests.length;
  await w.hub.poll();
  assert.deepEqual(
    server.requests.slice(before).map((request) => request.path),
    ['/api/v1/projects', '/api/v1/tasks/all'],
    'remembered: no second try at /tasks',
  );
});

test('every page of the task list is read', async (t) => {
  const server = new FakeVikunja({ now: createClock().now });
  for (let i = 0; i < 120; i += 1) {
    server.tasks.push({ id: 1000 + i, title: `Tâche ${i}`, project_id: 1, done: false });
  }
  const w = await world(t, { server });
  assert.equal(counters(w, overviewId(w.gladys)).open, 128);
  assert.equal(server.requests.filter((r) => r.path === '/api/v1/tasks').length, 3);
});

test('the states are published again when a device is added', async (t) => {
  const w = await world(t);
  const before = w.fake.states.length;
  await w.fake.deviceCreated(w.fake.discoveredDevices[0]);
  assert.ok(w.fake.states.length > before);
});

test('a reading of the old instance during a reconfiguration is dropped', async (t) => {
  const w = await world(t);
  const reading = w.hub.poll();
  await w.fake.configUpdated({ ...w.fake.config, url: 'http://192.0.2.99:3456' });
  await reading;
  assert.deepEqual(w.hub.tasks, [], 'nothing of the old instance kept');
  assert.equal(w.fake.connectionStatus.connected, false);
});

test('the fixtures start where the tests expect them', () => {
  assert.equal(new Date(START).toISOString(), '2026-10-19T16:30:00.000Z');
  assert.equal(URL_1, 'http://192.0.2.20:3456');
  assert.equal(HOUR, 3_600_000);
});
