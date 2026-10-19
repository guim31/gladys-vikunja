// -----------------------------------------------------------------------------
// The "today's tasks" widget: content within the core budget (validated by
// the SDK's validateWidgetContent), the overview and project views, the
// "done" buttons, and the degraded states.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { BASE_CONFIG, createClock, createWorld, overviewId, projectId } from './helpers/world.js';

async function world(t, options = {}) {
  const w = await createWorld(options);
  t.after(() => w.app.stop());
  return w;
}

async function content(w, settings = {}, language = 'en') {
  const ack = await w.fake.widgetGet('tasks_today', { settings, language, units: 'metric' });
  assert.equal(ack.success, true, ack.error);
  const { content: tree } = ack.data;
  assert.deepEqual(validateWidgetContent(tree), [], 'within the core vocabulary and budget');
  return tree;
}

const ofType = (data, type) => data.components.filter((component) => component.type === type);

test('the overview: tiles, the tasks of the day with their project, four buttons', async (t) => {
  const w = await world(t);
  const data = await content(w);
  assert.ok(data.components.length <= 8);
  assert.deepEqual(
    ofType(data, 'value').map((tile) => tile.value),
    [4, 2],
  );
  assert.deepEqual(
    ofType(data, 'status')[0].items.map((row) => [row.label, row.value, row.color]),
    [
      ['Sortir les poubelles', 'Overdue · Maison', 'danger'],
      ['Vider le lave-vaisselle', 'Overdue · Maison', 'danger'],
      ['Arroser les plantes', '20:00 · Maison', 'neutral'],
      ['Payer la cantine', '20:00 · Courses', 'warning'],
    ],
  );
  assert.deepEqual(
    ofType(data, 'button').map((button) => [button.action.key, button.action.params.id]),
    [
      ['done_1', 7],
      ['done_2', 8],
      ['done_3', 9],
      ['done_4', 12],
    ],
  );
  assert.deepEqual(await content(w, { device: overviewId(w.gladys).device }), data);
});

test('a project view shows only its tasks, in the language of the user', async (t) => {
  const w = await world(t);
  const data = await content(w, { device: projectId(w.gladys, 3).device }, 'fr');
  assert.deepEqual(
    ofType(data, 'status')[0].items.map((row) => [row.label, row.value]),
    [['Payer la cantine', '20:00']],
  );
  assert.equal(ofType(data, 'value')[0].label, 'À faire');
});

test('nothing today: a sentence and the next task', async (t) => {
  const w = await world(t);
  const data = await content(w, { device: projectId(w.gladys, 4).device }, 'fr');
  assert.equal(ofType(data, 'text')[0].text, "Plus rien à faire aujourd'hui.");
  assert.deepEqual(
    ofType(data, 'status')[0].items.map((row) => [row.label, row.value]),
    [['Tailler la haie', 'Prochaine · dim. 25 oct.']],
  );
});

test('a "done" button marks the task done and answers a toast', async (t) => {
  const w = await world(t);
  const due = Date.parse('2026-10-18T09:00:00Z');
  const ack = await w.fake.widgetAction('tasks_today', 'done_1', { id: 7, due }, { settings: {} });
  assert.equal(ack.success, true, ack.error);
  assert.equal(ack.data.message.fr, '« Sortir les poubelles » marquée comme faite.');
  assert.equal(w.server.task(7).done, true);
  const bad = await w.fake.widgetAction('tasks_today', 'done_9', { id: 7 }, { settings: {} });
  assert.equal(bad.success, false);
});

test('a stale button does not complete the next occurrence of a repeating task', async (t) => {
  const w = await world(t);
  const due = Date.parse('2026-10-19T18:00:00Z');
  w.server.markDone(w.server.task(9)); // done in Vikunja meanwhile: due tomorrow now
  const ack = await w.fake.widgetAction('tasks_today', 'done_3', { id: 9, due }, { settings: {} });
  assert.equal(ack.success, false);
  assert.match(ack.error, /already done meanwhile/);
  assert.equal(w.server.task(9).due_date, '2026-10-20T18:00:00.000Z', 'not moved twice');
});

test('degraded states: not configured, unknown project, Vikunja down', async (t) => {
  const empty = await world(t, { config: { url: '', api_token: '' } });
  assert.match((await content(empty)).components[0].text, /Enter the address/);

  const w = await world(t, { config: { ...BASE_CONFIG, projects: 'Maison' } });
  const gone = await content(w, { device: projectId(w.gladys, 3).device });
  assert.match(gone.components[0].text, /no longer followed/);

  w.server.online = false;
  await w.hub.poll();
  const stale = await content(w);
  assert.equal(stale.components[0].variant, 'caption');
  assert.deepEqual(ofType(stale, 'button'), [], 'no button while Vikunja is down');

  const clock = createClock();
  const down = await createWorld({ clock, connect: false });
  t.after(() => down.app.stop());
  down.server.online = false;
  await down.gladys.connect();
  await down.app.ready;
  assert.match((await content(down)).components[0].text, /does not answer/);
});
