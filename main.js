#!/usr/bin/env node

import { program } from 'commander'; // Import all exports as 'program'
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

import { PackageManager } from './logic/package-manager.js';
import { DeviceManager } from './logic/board/device-manager.js';
import { printPackagesWithHighlights } from './logic/format.js';
import { isCustomPackage } from 'upy-packager';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Extract the command version from the package.json file
const version = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'))).version;
const ARDUINO_VID = 0x2341;

const packageManager = new PackageManager();
const boardManager = new DeviceManager();

// Main function to handle the command-line interface
export async function main() {
  program
    .version(version)
    .description('upy-package - A command-line tool to install MicroPython packages on Arduino boards');

  program
    .command('list')
    .description('List packages from registries')
    .action(async () => {
      const packages = await packageManager.listPackages();
      if (packages) {
        console.log(packages);
      }
    });

  program
    .command('info <package>')
    .description('Get information about a package')
    .action(async (packageName) => {
      const packageInfo = await packageManager.getPackageInfo(packageName);
      if (packageInfo) {
        console.log(packageInfo);
      } else {
        console.log(`🤷 No package found with name ${packageName}`);
      }
    });

  program
    .command('find <pattern>')
    .description('Find packages using the supplied search pattern')
    .action(async (pattern) => {
      const packages = await packageManager.findPackages(pattern);
      printPackagesWithHighlights(packages, pattern);
    });

  program
    .command('install')
    .argument('<package-names...>', 'Package names to install')
    // .option('--path <target-path>', 'Target path to install the package(s) to')
    .option('--debug', 'Enable debug output')
    .description('Install MicroPython packages on a connected Arduino board')
    .action(async (packageNames, options) => {
      const selectedBoard = await boardManager.getDevice(ARDUINO_VID);
      if(!selectedBoard) {
        console.error(`🤷 No connected Arduino board found. Please connect a board and try again.`);
        process.exit(1);
      }
      
      try {
        for(const packageName of packageNames) {
          console.log(`📦 Installing ${packageName} on '${selectedBoard.name}' (SN: ${selectedBoard.serialNumber})`);
         
          if(isCustomPackage(packageName)) {
            await packageManager.installPackage(packageName, selectedBoard);
            continue;
          }

          const aPackage = await packageManager.getPackage(packageName);
          
          if(aPackage && !await packageManager.checkRequiredRuntime(aPackage, selectedBoard)){
            console.error(`🙅 Installation of '${packageName}' skipped. Unsupported runtime installed.`);
            continue;
          }

          // Official micropython-lib packages don't have a URL field in the registry,
          // so they are installed by supplying the name as the URL
          const packageURL = aPackage.url ? aPackage.url : aPackage.name;
          await packageManager.installPackage(packageURL, selectedBoard);
        }
        console.log(`✅ Installation complete`);
      } catch (error) {
        console.error(`❌ ${error.message}`);
        if (options.debug) {
          console.error(error.stack);
        }
        process.exit(1);
      }
    });

  program.parse(process.argv);

  if (program.args.length === 0) {
    program.help(); // Display help if no command is provided
  }
}

main();
