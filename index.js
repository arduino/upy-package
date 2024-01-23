#!/usr/bin/env node

import { program } from 'commander'; // Import all exports as 'program'
import { PackageManager } from './package-manager.js';
import { BoardManager } from './board-manager.js';
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Extract the command version from the package.json file
const version = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'))).version;

const packageManager = new PackageManager();
const boardManager = new BoardManager();

// Main function to handle the command-line interface
export async function main() {
  program
    .version(version)
    .description('Arduino Tool - A command-line tool for Arduino development');

  program
    .command('list')
    .argument('[package]', 'Print package details')
    .description('List packages from registries')
    .action(async (selectedPackage) => {
      const packages = await packageManager.listPackages(selectedPackage);
      if (packages) {
        console.log(packages);
      }
    });

  program
    .command('install <package>')
    .option('--path <target-path>', 'Target path to install the package to')
    .option('--debug', 'Enable debug output')
    .description('Install a MicroPython package on a connected Arduino board')
    .action(async (packageName, options) => {
      const selectedBoardID = await boardManager.getBoardID();
      try {
        await packageManager.installPackage(packageName, selectedBoardID, options.path);
      } catch (error) {
        console.error(`❌ ${error.message}`);
        if (options.debug) {
          console.error(error.stack);
        } 
        process.exit(1);
      }
    });

  program
    .command('find <pattern>')
    .description('Find packages matching the supplied pattern')
    .action(async (pattern) => {
      const packages = await packageManager.findPackages(pattern);
      if (packages.length > 0) {
        for(const pkg of packages) {
          console.log(`📦 ${pkg.name}`);
        }
      } else {
          console.log(`🤷 No matching packages found.`);
      }
    });

  program.parse(process.argv);

  if (program.args.length === 0) {
    program.help(); // Display help if no command is provided
  }
}

main();
