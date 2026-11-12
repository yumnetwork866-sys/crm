const oneLine = (value, max = 160) => {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

module.exports = {
  colorize: Boolean(process.stdout.isTTY) && !('NO_COLOR' in process.env),
  translateTime: 'SYS:HH:MM:ss',
  singleLine: false,
  hideObject: true,
  ignore: 'pid,hostname,service,environment,component',
  errorLikeObjectKeys: [],
  messageFormat(log, messageKey) {
    const component = oneLine(log.component || 'app', 24)
      .replace(/(Routes|Controller|Service)$/, '');
    const parts = [];
    if (log.component === 'http' && log.method) {
      parts.push(`${log.method} ${oneLine(log.path, 90)} → ${log.status}`);
    } else {
      parts.push(oneLine(log[messageKey]).replace(/^\[[^\]]+\]\s*/, '').replace(/:\s*$/, ''));
      if (log.err) {
        const error = oneLine(log.err.message || log.err, 180);
        if (error && !parts[0].includes(error)) parts.push(error);
      }
      if (log.port) parts.push(`:${log.port}`);
      if (log.mode) parts.push(oneLine(log.mode, 30));
      if (log.wabaId) parts.push(`waba=…${String(log.wabaId).slice(-4)}`);
      if (log.badgeCleared) parts.push('badge cleared');
    }
    if (Number.isFinite(log.durationMs)) parts.push(`${Math.round(log.durationMs)}ms`);
    if (log.level >= 40 && log.requestId) parts.push(`#${String(log.requestId).slice(0, 8)}`);
    return `[${component}] ${parts.join(' · ')}`;
  },
};
