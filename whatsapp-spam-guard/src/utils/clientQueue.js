const DEFAULT_TIMEOUT_MS = 45000;

let chain = Promise.resolve();

function withTimeout(promise, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    Promise.resolve(promise)
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function runClientTask(task, label = 'client-task', timeoutMs = DEFAULT_TIMEOUT_MS) {
  const run = chain
    .then(() => withTimeout(task(), timeoutMs, label))
    .catch((error) => {
      error.clientTask = label;
      throw error;
    });

  chain = run.catch(() => {});
  return run;
}

module.exports = {
  runClientTask,
  DEFAULT_TIMEOUT_MS,
};
