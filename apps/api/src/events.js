const clients = new Set();

function registerClient(res, channels) {
  const entry = { res, channels: new Set(channels || []) };
  clients.add(entry);
  return () => clients.delete(entry);
}

function sendEvent(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function broadcast(event, payload) {
  for (const client of clients) {
    if (client.channels.size > 0) {
      const channel = payload.channel || "";
      if (!client.channels.has(channel) && !client.channels.has("*")) {
        continue;
      }
    }
    sendEvent(client.res, event, payload);
  }
}

module.exports = {
  registerClient,
  sendEvent,
  broadcast
};
