(function () {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const lists = ['tasks', 'notes', 'usefulLinks', 'dailyPosts', 'services', 'columns', 'platforms', 'tags', 'projects', 'projectCompanies', 'projectNetworks', 'projectFields'];
  // Realtime Database omits empty arrays. Repair older board payloads before validation.
  function decode(payload) {
    if (!payload) return null;
    const state = typeof payload.stateJson === 'string' ? JSON.parse(payload.stateJson) : clone(payload.state || payload);
    if (!state || ![1, 2].includes(state.version)) throw Error('Quadro da nuvem inválido');
    lists.forEach(key => { if (state[key] == null) state[key] = key === 'services' ? clone(window.CFF_TASKS_DEFAULT_SERVICES || []) : []; });
    state.tasks.forEach(task => {
      ['platforms', 'tags', 'links', 'subtasks', 'attachments', 'history'].forEach(key => { if (task[key] == null) task[key] = []; });
    });
    return state;
  }
  function fields(base, local, remote) {
    const result = clone(remote || {});
    for (const key of new Set([...Object.keys(base || {}), ...Object.keys(local || {})])) {
      if (same(base?.[key], local?.[key])) continue;
      if (local?.[key] === undefined) delete result[key];
      else if (key === 'completedDates') result[key] = fields(base?.[key], local[key], remote?.[key]);
      else result[key] = clone(local[key]);
    }
    return result;
  }
  // Apply only this device's edits to the latest server state, preserving other edits.
  function merge(base, local, remote) {
    if (!base) return clone(local);
    const result = fields(base, local, remote);
    lists.forEach(key => {
      const before = new Map((base[key] || []).map(item => [item.id, item]));
      const after = new Map((local[key] || []).map(item => [item.id, item]));
      const current = new Map((remote[key] || []).map(item => [item.id, clone(item)]));
      before.forEach((_, id) => { if (!after.has(id)) current.delete(id); });
      after.forEach((item, id) => {
        // Two devices may initialise the same supplied project at once.
        // Compare against its original defaults so untouched seed data cannot erase edits.
        const previous = before.get(id) || (current.has(id) && window.CFF_TASKS_PROJECTS?.keys.includes(key)
          ? window.CFF_TASKS_PROJECTS.seedBaseline(key, id) : undefined);
        if (!previous) current.set(id, clone(item));
        else if (!same(previous, item)) current.set(id, fields(previous, item, current.get(id) || previous));
      });
      // Reordering columns is an explicit edit; otherwise preserve the remote order.
      const ordered = key === 'columns' && !same((base[key] || []).map(x => x.id), (local[key] || []).map(x => x.id));
      result[key] = ordered ? [...after.keys(), ...[...current.keys()].filter(id => !after.has(id))].filter(id => current.has(id)).map(id => current.get(id)) : [...current.values()];
    });
    result.settings = fields(base.settings, local.settings, remote.settings);
    return result;
  }
  window.CFF_TASKS_SYNC = { decode, merge, same };
})();

