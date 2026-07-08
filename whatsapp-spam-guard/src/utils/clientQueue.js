let chain = Promise.resolve();

function runClientTask(task, label = 'client-task') {
  const run = chain.then(() => task()).catch((error) => {
    error.clientTask = label;
    throw error;
  });

  chain = run.catch(() => {});
  return run;
}

module.exports = {
  runClientTask,
};
