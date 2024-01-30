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
const ARDUINO_VID = '0x2341';

const packageManager = new PackageManager();
const boardManager = new BoardManager();

async function printPackagesWithHighlights(pattern) {
  const packages = await packageManager.findPackages(pattern);
  if (packages && packages.length > 0) {
      for (const [index, pkg] of packages.entries()) {
          const { name, description, tags } = pkg;
          const highlightedName = highlightPattern(name, pattern);
          console.log(`📦 ${highlightedName}`);

          if (description && description.toLowerCase().includes(pattern)) {
              let truncatedDescription = description;
              const patternIndex = truncatedDescription.toLowerCase().indexOf(pattern);
              if (truncatedDescription.length > 80) {
                  let start = Math.max(0, patternIndex - Math.floor((80 - pattern.length) / 2));
                  truncatedDescription = truncatedDescription.substring(start, start + 80 - pattern.length);
                  if (start > 0) {
                      truncatedDescription = `...${truncatedDescription}`;
                  }
                  truncatedDescription += '...';
              }
              if (patternIndex > -1) {
                  truncatedDescription = truncatedDescription.replace(
                      new RegExp(pattern, 'gi'),
                      match => highlightPattern(match, pattern)
                  );
              }
              console.log(`   - Description: ${truncatedDescription}`);
          }

          if (tags && tags.length > 0) {
              const matchingTags = tags.filter(tag => tag.toLowerCase().includes(pattern));
              if (matchingTags.length > 0) {
                  const highlightedTags = matchingTags.map(tag => highlightPattern(tag, pattern));
                  console.log(`   - Tags: ${highlightedTags.join(', ')}`);
              }
          }

          // Add an empty line if it's not the last package
          if (index < packages.length - 1) {
              console.log(); // Print an empty line
          }
      }
  } else {
      console.log(`🤷 No matching packages found.`);
  }
}

function highlightPattern(text, pattern) {
  const highlightColor = '\x1b[38;5;196m'; // ANSI escape code for a bright red foreground color
  const boldFormatting = '\x1b[1m'; // ANSI escape code for bold formatting
  const resetColorAndFormat = '\x1b[0m'; // ANSI escape code to reset color and formatting
  const regex = new RegExp(pattern, 'gi');
  return text.replace(regex, match => `${boldFormatting}${highlightColor}${match}${resetColorAndFormat}`);
}

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
      printPackagesWithHighlights(pattern);
      // const packages = await packageManager.findPackages(pattern);
      // if (packages.length > 0) {
      //   for (const pkg of packages) {
      //     console.log(`📦 ${pkg.name}`);
      //   }
      // } else {
      //   console.log(`🤷 No matching packages found.`);
      // }
    });

  program
    .command('install')
    .argument('<package-names...>', 'Package names to install')
    .option('--path <target-path>', 'Target path to install the package(s) to')
    .option('--debug', 'Enable debug output')
    .description('Install MicroPython packages on a connected Arduino board')
    .action(async (packageNames, options) => {
      const selectedBoard = await boardManager.getBoard(ARDUINO_VID);
      if(!selectedBoard) {
        console.error(`🤷 No connected Arduino board found. Please connect a board and try again.`);
        process.exit(1);
      }
      
      try {
        for(const packageName of packageNames) {
          console.log(`📦 Installing ${packageName} on '${selectedBoard.name}' (ID: ${selectedBoard.ID})`);
          await packageManager.installPackage(packageName, selectedBoard.ID, options.path);
        }
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
