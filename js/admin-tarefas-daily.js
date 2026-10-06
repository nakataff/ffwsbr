(function () {
  'use strict';
  const zone = 'America/Sao_Paulo';
  const days = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  function parts(at) { return Object.fromEntries(formatter.formatToParts(new Date(at)).filter(p => p.type !== 'literal').map(p => [p.type, p.value])); }
  function today(at = Date.now()) { const p = parts(at); return `${p.year}-${p.month}-${p.day}`; }
  function weekday(date) { return new Date(date + 'T12:00:00Z').getUTCDay(); }
  function addDays(date, count) { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + count); return d.toISOString().slice(0, 10); }
  function instant(date, time) {
    const target = Date.parse(date + 'T' + time + ':00Z');
    let result = target;
    // Convert the scheduled Brazilian wall-clock time, independent of device timezone.
    for (let i = 0; i < 2; i++) {
      const p = parts(result);
      const apparent = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
      result += target - apparent;
    }
    return result;
  }
  function duration(milliseconds) {
    const minutes = Math.max(1, Math.ceil(Math.abs(milliseconds) / 60000));
    const d = Math.floor(minutes / 1440), h = Math.floor(minutes % 1440 / 60), m = minutes % 60;
    return [d ? d + 'd' : '', h ? h + 'h' : '', m ? m + 'min' : ''].filter(Boolean).join(' ');
  }
  function status(post, at = Date.now()) {
    const date = today(at), scheduled = post.days.includes(weekday(date)), done = scheduled && post.completedDates?.[date] === true;
    if (done) return { date, scheduled, done, level: 'done', label: 'Concluído hoje' };
    let next = date;
    for (let i = 0; i < 7; i++) { next = addDays(date, i); if (post.days.includes(weekday(next))) break; }
    const nextLabel = days[weekday(next)] + ', ' + next.slice(8) + '/' + next.slice(5, 7);
    if (!post.time) return { date, scheduled, done: false, level: 'neutral', label: scheduled ? 'Hoje · sem horário' : 'Próximo: ' + nextLabel };
    const delta = instant(next, post.time) - at;
    const label = delta < 0 ? 'Atrasado há ' + duration(delta) : delta < 60000 ? 'Hora de postar' : 'Falta ' + duration(delta);
    return { date, scheduled, done: false, level: delta < 0 ? 'late' : delta <= 3600000 ? 'soon' : 'neutral', label };
  }
  window.CFF_TASKS_DAILY = { days, today, weekday, instant, status };
})();
