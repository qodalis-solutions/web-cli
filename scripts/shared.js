// Promisified exec function
export function runCommand(exec, command, folder) {
  return new Promise((resolve, reject) => {
    console.log(`Running command: "${command}" in folder: ${folder}`);
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error in folder ${folder}:`, error.message);
        return reject(error);
      }
      if (stdout) console.log(`Output from ${folder}:\n${stdout}`);
      if (stderr) console.error(`Error output from ${folder}:\n${stderr}`);
      resolve();
    });
  });
}
