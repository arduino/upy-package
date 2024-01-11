// Import necessary modules
import { execSync } from 'child_process';
import axios from 'axios';
import yaml from 'js-yaml';
import inquirer from 'inquirer';

// Hardcoded registry URLs
const registryUrls = [
  'https://raw.githubusercontent.com/arduino/package-index-py/main/package-list.yaml',
  // Add more registry URLs as needed
];

// Function to list packages from a given registry URL
export async function listPackages(registryUrl) {
    const packageList = await getPackageList(registryUrl);
  
    if (packageList && packageList.packages && typeof packageList.packages === 'object') {
      console.log(`Packages in ${registryUrl}:`);
      Object.entries(packageList.packages).forEach(([key, pkg]) => {
        console.log(`- ${key}: ${pkg.name} - ${pkg.description}`);
      });
    } else {
      console.log(`Invalid or empty package list structure in '${registryUrl}'.`);
    }
  }
  
  
  // Function to fetch and parse the package list from a given registry URL
  async function getPackageList(registryUrl) {
    try {
      const response = await axios.get(registryUrl);
      return yaml.load(response.data);
    } catch (error) {
      console.error(`Error fetching package list from ${registryUrl}:`, error.message);
      process.exit(1);
    }
  }

// Function to install MicroPython packages using mpremote
export function installPackage(packageName, board) {
  const command = `mpremote install ${packageName} --board ${board}`;
  try {
    execSync(command, { stdio: 'inherit' });
  } catch (error) {
    console.error('Error installing package:', error.message);
    process.exit(1);
  }
}

// Function to list and select Arduino boards
export function listAndSelectBoards() {
  const command = 'arduino-cli board list';
  const output = execSync(command, { encoding: 'utf-8' });

  const boards = output
    .trim()
    .split('\n')
    .map((line) => line.split('\t')[0])
    .filter((board) => board.toLowerCase().includes('arduino'));

  if (boards.length === 0) {
    console.log('No Arduino boards found.');
    process.exit(1);
  }

  return inquirer.prompt([
    {
      type: 'list',
      name: 'selectedBoard',
      message: 'Select an Arduino board:',
      choices: boards,
    },
  ]);
}

// Main function to handle the command-line interface
export async function main() {
    const argv = process.argv.slice(2);
  
    if (argv.length === 0) {
      console.log('Usage:');
      console.log('  node arduino-tool.mjs list');
      console.log('  node arduino-tool.mjs install <package>');
      process.exit(1);
    }
  
    const command = argv[0];
  
    if (command === 'list') {
      for (const registryUrl of registryUrls) {
        await listPackages(registryUrl);
      }
    } else if (command === 'install') {
      const packageName = argv[1];
      for (const registryUrl of registryUrls) {
        await listPackages(registryUrl);
      }
      const { selectedBoard } = await listAndSelectBoards();
      installPackage(packageName, selectedBoard);
    } else {
      console.log('Invalid command. Please use "list" or "install".');
      process.exit(1);
    }
  }

main();
