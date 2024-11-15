#!/usr/bin/env node

import { program } from 'commander'; // Import all exports as 'program'
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

import { PackageManager } from './logic/package-manager.js';
import { DeviceManager } from './logic/board/device-manager.js';
import { printPackagesWithHighlights } from './logic/format.js';
import { isCustomPackage } from 'upy-packager';
import inquirer from 'inquirer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Extract the command version from the package.json file
const version = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'))).version;
const ARDUINO_VID = 0x2341;

const packageManager = new PackageManager();
const deviceManager = new DeviceManager();

// Main function to handle the command-line interface
export async function main() {
  program
    .version(version)
    .description('upy-package - A command-line tool to install MicroPython packages on Arduino boards');

  program
    .command('list')
    .description('List packages from registries')
    .action(async () => {
      const packageList = await packageManager.getPackageList();
      const packages = packageList ? packageList.map((pkg) => `📦 ${pkg.name}`).join('\n') : null;

      if (packages) {
        console.log(packages);
      }
    });

  program
    .command('info <package>')
    .description('Get information about a package')
    .action(async (packageName) => {
      const packageInfo = (await packageManager.getPackage(packageName)).toString();
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
      const selectedBoard = await deviceManager.getDevice(ARDUINO_VID);
      if(!selectedBoard) {
        console.error(`🤷 No connected Arduino board found. Please connect a board and try again.`);
        process.exit(1);
      }
      
      try {
        for(const packageName of packageNames) {
          console.log(`📦 Installing ${packageName} on '${selectedBoard.name}' (SN: ${selectedBoard.serialNumber})`);
         
          if(isCustomPackage(packageName)) {
            await packageManager.installPackageFromURL(packageName, selectedBoard);
            continue;
          }

          const aPackage = await packageManager.getPackage(packageName);

          if(aPackage.required_runtime){
            const boardRuntime = await deviceManager.getMicroPythonVersion(selectedBoard);
            const matchesRequirement = await packageManager.matchesRequiredRuntime(aPackage, boardRuntime);

            if(!matchesRequirement) {
              console.warn(`🚨 Package '${aPackage.name}' requires a different runtime version (${aPackage.required_runtime}) than the one running on the board (${boardRuntime}).`);
              const response = await inquirer.prompt([
                  { type: 'confirm', name: 'continue', message: 'Do you want to continue with the installation?', default: false }
              ]);
              
              if(!response.continue){
                console.error(`🙅 Installation of '${packageName}' skipped.`);
                continue;
              }
            }
          }


          await packageManager.installPackage(aPackage, selectedBoard);
        }
        console.log(`✅ Done.`);
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
