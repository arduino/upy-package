import yaml from 'js-yaml';
import { execSync } from 'child_process';

const registryUrls = [
    'https://raw.githubusercontent.com/arduino/package-index-py/main/package-list.yaml',
    // Add more registry URLs as needed
];

export class PackageManager {
    /**
     * Converts a github URL to a mpremote compatible URL
     * @param {string} url A Github repository URL such as https://github.com/arduino/arduino-iot-cloud-py
     * @param {string} branch If specified, the branch to use, e.g. main
     * @returns The converted URL, e.g. github:arduino/arduino-iot-cloud-py@branch
     */
    convertGithubURL(url, branch = null) {
        if (url.startsWith('github:')) {
            return url;
        }

        if (!url.includes("github.com")) {
            return null;
        }

        const parts = url.split('/');
        const user = parts[parts.length - 2];
        const repo = parts[parts.length - 1].split('.')[0];

        let constructedURL = `github:${user}/${repo}`;
        if (branch) {
            constructedURL += `@${branch}`;
        }
        return constructedURL;
    }

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

    // Function to list packages from a given registry URL
    async listPackages(selectedPackage = null) {
        const packageList = await this.getPackageList();

        if (packageList) {
            if (selectedPackage) {
                let packageInfo = packageList.find((pkg) => pkg.name === selectedPackage);
                if (!packageInfo) return;
                return `📦 ${packageInfo.name}\n🔗 ${packageInfo.url}\n📄 ${packageInfo.description}`;
            } else {
                return packageList.map((pkg) => `📦 ${pkg.name}`).join('\n');
            }
        } else {
            return null;
        }
    }

    // Function to find a package matching the supplied pattern
    async findPackages(pattern) {
        const packageList = await this.getPackageList();
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

            return matchingPackages;
        } else {
            return null;
        }
    }

    // Function to install MicroPython packages using mpremote
    async installPackage(packageName, boardID, targetPath = null) {
        const packageList = await this.getPackageList();
        const selectedPackage = packageList.find((pkg) => pkg.name === packageName);
        
        if (!selectedPackage) {
            throw new Error(`Package '${packageName}' not found.`);
        }

        const packageURL = this.convertGithubURL(selectedPackage?.url);
        if (!packageURL) {
            throw new Error(`Package ${packageName} not found`);
        }

        const targetPathArg = targetPath ? `--target=${targetPath}` : '';
        const command = `mpremote connect id:${boardID} mip install ${targetPathArg} ${packageURL}`;
        
        try {
            execSync(command, { stdio: ['ignore', 'inherit', 'pipe'] });
        } catch (error) {
            let installationError = new Error(`Error installing package '${packageName}'`);
            installationError.stack = error.message;
            throw installationError;
        }
    }
}