import yaml from 'js-yaml';
import { satisfies, valid } from 'semver';
import {Packager} from 'upy-packager';
import { SerialDevice } from './board/serialDeviceFinder.js';

const registryUrls = [
    'https://raw.githubusercontent.com/arduino/package-index-py/main/package-list.yaml',
    'https://raw.githubusercontent.com/arduino/package-index-py/main/micropython-lib.yaml'
];

export class Package {

    static fromObject(obj) {
        const aPackage = new Package();
        Object.assign(aPackage, obj);
        return aPackage;
    }

    toString() {
        let info = `📦 ${this.name}`;

        if(this.url) {
            info += `\n🔗 ${this.url}`;
        }

        if(this.docs) {
            info += `\n📚 ${this.docs}`
        };

        if(this.tags) {
            info += `\n🔖 [${this.tags.join(', ')}]`;
        }
        if(this.author) {
            info += `\n👤 ${this.author}`;
        }
        if(this.license) {
            info += `\n📜 ${this.license}`;
        }

        if(this.description) {
            info += `\n\n${this.description}`;
        }
        return info;
    }
}

export class PackageManager {

    /**
     * Function to fetch and parse the package list from given registry URLs.
     * @returns {Promise<Array<Package>} List of available packages.
     */
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
        packages = packages.map(Package.fromObject);
        return packages;
    }

    /**
     * Function to find a package matching the supplied pattern
     * @param {string} pattern 
     * @returns {Promise<Array<Package>>} List of packages matching the pattern
     */
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

    /**
     * Checks if the selected package requires a runtime version that is supported by the device.
     * @param {Package} selectedPackage The package to be installed
     * @param {string} deviceRuntime The runtime version of the device as a string (e.g. '1.0.0')
     * @returns {Promise<boolean>} A promise that resolves to true if the device runtime version satisfies the package requirements
     */
    async matchesRequiredRuntime(selectedPackage, deviceRuntime) {
        let requiredRuntime = selectedPackage.required_runtime;
        if (!requiredRuntime) {
            return true;
        }

        if(!valid(deviceRuntime)){
            throw new Error(`Board runtime version ${boardRuntime} is not valid.`);
        }

        return satisfies(deviceRuntime, requiredRuntime);
    }

    /**
     * Get a package by name
     * @param {string} packageName
     * @returns {Promise<Package>} The package with the given name
     */
    async getPackage(packageName) {
        const packageList = await this.getPackageList();
        const foundPackage = packageList.find((pkg) => pkg.name === packageName);
        
        if (!foundPackage) {
            throw new Error(`Package '${packageName}' not found.`);
        }

        return foundPackage;
    }

    /**
     * Function to install a package from a URL
     * @param {string} packageURL The URL of the package to install.
     * @param {SerialDevice} device The board to install the package on.
     */
    async installPackageFromURL(packageURL, device) {
        await this.installPackage({ "url" : packageURL }, device);
    }

    /**
     * Function to install a package on a board from a package object
     * @param {Package} aPackage The package to install.
     * @param {SerialDevice} device The board to install the package on.
     */
    async installPackage(aPackage, device) {
        if(!device){
            throw new Error('No board was selected.');
        }

        // Official micropython-lib packages don't have a URL field in the registry,
        // so they are installed by supplying the name as the URL
        const packageURL = aPackage.url ? aPackage.url : aPackage.name;
        const customPackageJson = aPackage.package_descriptor;

        const packager = new Packager(device.serialPort);
        await packager.packageAndInstall(packageURL, null, customPackageJson);
        console.debug(`✅ Package installed: ${packageURL}`);
    }
}