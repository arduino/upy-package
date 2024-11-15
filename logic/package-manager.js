import yaml from 'js-yaml';
import { DeviceManager } from './board/device-manager.js';
import { satisfies, valid } from 'semver';
import inquirer from 'inquirer';
import {Packager} from 'upy-packager';

const registryUrls = [
    // 'https://raw.githubusercontent.com/arduino/package-index-py/main/package-list.yaml',
    'https://raw.githubusercontent.com/arduino/package-index-py/file-override/package-list.yaml',
    'https://raw.githubusercontent.com/arduino/package-index-py/micropython-lib/micropython-lib.yaml'
];

export class PackageManager {

    // Function to fetch and parse the package list from a given registry URL
    async getPackageList() {
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

    async getPackageInfo(packageName) {
        const packageList = await this.getPackageList();
        let packageInfo = packageList.find((pkg) => pkg.name === packageName);
        if (!packageInfo) return null;
        let info = `📦 ${packageInfo.name}\n🔗 ${packageInfo.url}`;

        if(packageInfo.tags) {
            info += `\n🔖 [${packageInfo.tags.join(', ')}]`;
        }
        if(packageInfo.author) {
            info += `\n👤 ${packageInfo.author}`;
        }
        if(packageInfo.license) {
            info += `\n📜 ${packageInfo.license}`;
        }

        if(packageInfo.description) {
            info += `\n\n${packageInfo.description}`;
        }
        return info;
    }

    // Function to list packages from a given registry URL
    async listPackages() {
        const packageList = await this.getPackageList();
        return packageList ? packageList.map((pkg) => `📦 ${pkg.name}`).join('\n') : null;
    }

    // Function to find a package matching the supplied pattern
    async findPackages(pattern) {
        const packageList = await this.getPackageList();
        if (packageList) {
            const matchingPackages = packageList
                .filter((pkg) => {
                    const { name, description, tags } = pkg;
                    return (
                        name.toLowerCase().includes(pattern) ||
                        (description && description.toLowerCase().includes(pattern)) ||
                        (tags && tags.some((tag) => tag.toLowerCase().includes(pattern)))
                    );
                });

            return matchingPackages;
        } else {
            return null;
        }
    }

    async checkRequiredRuntime(selectedPackage, device) {
        let requiredRuntime = selectedPackage.runtime;
        requiredRuntime ||= selectedPackage.overrides?.runtime;
        if (!requiredRuntime) {
            return true;
        }

        const deviceManager = new DeviceManager();
        const boardRuntime = await deviceManager.getMicroPythonVersion(device);
        
        if(!valid(boardRuntime)){
            throw new Error(`Board runtime version ${boardRuntime} is not valid.`);
        }

        const runsRequiredVersion = satisfies(boardRuntime, requiredRuntime);
        if (!runsRequiredVersion) {
            console.warn(`🚨 Package '${selectedPackage.name}' requires a different runtime version (${requiredRuntime}) than the one running on the board (${boardRuntime}).`);
            // Use inquirer to prompt the user to continue or abort
            const response = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'continue',
                    message: 'Do you want to continue with the installation?',
                    default: false,
                },
            ]);
            return response.continue;
        }
        return true;
    }

    async getPackage(packageName) {
        const packageList = await this.getPackageList();
        const foundPackage = packageList.find((pkg) => pkg.name === packageName);
        
        if (!foundPackage) {
            throw new Error(`Package '${packageName}' not found.`);
        }

        return foundPackage;
    }

    // Function to install MicroPython packages using mpremote
    async installPackage(packageURL, board) {
        if(!board){
            throw new Error('No board was selected.');
        }

        // TODO remove full url for official packages, maybe add a source field in the package list?
        // TODO add support for package.json overrides
        const packager = new Packager(board.serialPort);
        try {
          await packager.packageAndInstall(packageURL);
          console.debug('✅ Done');
        } catch (error) {
          console.error(`❌ ${error.message}`);
        }
    }
}