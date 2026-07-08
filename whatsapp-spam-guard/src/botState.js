const botState = {
  client: null,
  ready: false,
  authenticated: false,
  config: null,
  moderator: null,
  listeners: {
    configChange: [],
  },
};

function setBotState(partial) {
  Object.assign(botState, partial);
}

function onConfigChange(callback) {
  botState.listeners.configChange.push(callback);
}

function emitConfigChange(config) {
  botState.config = config;

  if (botState.moderator) {
    botState.moderator.config = config;
  }

  for (const callback of botState.listeners.configChange) {
    callback(config);
  }
}

module.exports = {
  botState,
  setBotState,
  onConfigChange,
  emitConfigChange,
};
