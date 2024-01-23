import { execSync } from 'child_process';
import yaml from 'js-yaml';
import inquirer from 'inquirer';
import { program } from 'commander'; // Import all exports as 'program'

const registryUrls = [
  'https://raw.githubusercontent.com/arduino/package-index-py/main/package-list.yaml',
  // Add more registry URLs as needed
];

/**
 * Converts a github URL to a mpremote compatible URL
 * @param {string} url A Github repository URL such as https://github.com/arduino/arduino-iot-cloud-py
 * @param {string} branch If specified, the branch to use, e.g. main
 * @returns The converted URL, e.g. github:arduino/arduino-iot-cloud-py@branch
 */
function convertGithubURL(url, branch = null){
  if(url.startsWith('github:')){
    return url;
  }

  if(!url.includes("github.com")){
    return null;
  }

  const parts = url.split('/');
  const user = parts[parts.length - 2];
  const repo = parts[parts.length - 1].split('.')[0];
  
  let constructedURL = `github:${user}/${repo}`;
  if(branch){
    constructedURL += `@${branch}`;
  } 
  return constructedURL;
}

// Function to fetch and parse the package list from a given registry URL
async function getPackageList() {
  let packages = [];

  for (const registryUrl of registryUrls) {
    try {
      const response = await fetch(registryUrl);
      const data = await response.text();
      packages = packages.concat(yaml.load(data).packages);
    } catch (error) {
      console.error(`Error fetching package list from ${registryUrl}:`, error.message);
      process.exit(1);
    }
  }
  return packages;
}

// Function to list packages from a given registry URL
export async function listPackages(selectedPackage = null) {
  const packageList = await getPackageList();

  if (packageList) {
    if(selectedPackage){
      let packageInfo = packageList.find((pkg) => pkg.name === selectedPackage);
      if(!packageInfo) return;      
      console.log(`📦 ${packageInfo.name}\n🔗 ${packageInfo.url}\n📄 ${packageInfo.description}`);
    } else {
      console.log(packageList.map((pkg) => `📦 ${pkg.name}`).join('\n'));
    }
  } else {
    console.log(`Could not fetch package list.`);
  }
}

// Function to install MicroPython packages using mpremote
export async function installPackage(packageName, board, targetPath = null) {
  const packageList = await getPackageList();
  const selectedPackage = packageList.find((pkg) => pkg.name === packageName);
  const packageURL = convertGithubURL(selectedPackage?.url);
  if(!packageURL){
    console.error(`Could not find package ${packageName}`);
    process.exit(1);
  }
  const targetPathArg = targetPath ? `--target=${targetPath}` : '';
  const command = `mpremote connect id:${board} mip install ${targetPathArg} ${packageURL}`;
  console.log(command)

  try {
    execSync(command, { stdio: 'inherit' });
  } catch (error) {
    console.error('Error installing package:', error.message);
    process.exit(1);
  }
}

// Function to list and select Arduino boards
export function listAndSelectBoards() {
  const command = 'arduino-cli board list --format json';
  const output = JSON.parse(execSync(command, { encoding: 'utf-8' }));

  // Filter boards with vid 0x2341
  const boards = output.filter((board) => {
    const { port } = board;
    return port.properties && port.properties.vid === '0x2341';
  });

  if (boards.length === 0) {
    console.log('No Arduino boards found.');
    process.exit(1);
  }

  if(boards.length === 1) {
    return { selectedBoard: boards[0].port.hardware_id };
  }

  // TODO Test this
  return inquirer.prompt([
    {
      type: 'list',
      name: 'selectedBoard',
      message: 'Select an Arduino board:',
      choices: boards,
    },
  ]);
}

// Function to find a package matching the supplied pattern
export async function findPackage(pattern) {
  const packageList = await getPackageList();
  if (packageList) {
    const matchingPackages = packageList
      .filter((pkg) => {
        const { name, description, tags } = pkg;
        return (
          name.includes(pattern) ||
          (description && description.includes(pattern)) ||
          (tags && tags.some((tag) => tag.includes(pattern)))
        );
      });

    if (matchingPackages.length > 0) {
      matchingPackages.forEach((pkg) => {
        console.log(`📦 ${pkg.name}`);
      });
    } else {
      console.log(`No matching packages found in ${registryUrl}.`);
    }
  } else {
    console.log(`Could not fetch package list.`);
  }
}

// Main function to handle the command-line interface
export async function main() {
  program
    .version('1.0.0')
    .description('Arduino Tool - A command-line tool for Arduino development');

  program
    .command('list')
    .argument('[package]', 'Print package details')
    .description('List packages from registries')
    .action(async (selectedPackage) => {
      await listPackages(selectedPackage);
    });

  program
    .command('install <package>')
    .option('--path <target-path>', 'Target path to install the package to')
    .description('Install a MicroPython package on a connected Arduino board')
    .action(async (packageName, options) => {
      const { selectedBoard } = await listAndSelectBoards();
      installPackage(packageName, selectedBoard, options.path);
    });

  program
    .command('find <pattern>')
    .description('Find packages matching the supplied pattern')
    .action((pattern) => {
      findPackage(pattern);
    });

  program.parse(process.argv);

  if (program.args.length === 0) {
    program.help(); // Display help if no command is provided
  }
}

main();
