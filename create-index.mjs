import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const searchPackages = (directory, outputFilename) => {
  const result = { packages: [] };

  const search = (dir) => {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const isDirectory = fs.statSync(filePath).isDirectory();

      if (isDirectory) {
        search(filePath);
      } else {
        const isPackageJson = file === 'package.json';
        const isManifestPy = file === 'manifest.py';

        if (isPackageJson || isManifestPy) {
          const packageInfo = {
            name: path.basename(dir),
            url: path.basename(dir), // Use folder name as the URL
          };

          if (isManifestPy) {
            try {
              const content = fs.readFileSync(filePath, 'utf8');
              const descriptionMatch = /description="(.*?)"/.exec(content);

              if (descriptionMatch && descriptionMatch[1]) {
                packageInfo.description = descriptionMatch[1];
              }
            } catch (error) {
              console.error(`Error reading ${file}: ${error.message}`);
            }
          }

          result.packages.push(packageInfo);
        }
      }
    }
  };

  search(directory);

  try {
    const yamlData = yaml.dump(result);
    fs.writeFileSync(outputFilename, `---\n${yamlData}`);
    console.log(`YAML file saved to ${outputFilename}`);
  } catch (error) {
    console.error(`Error writing YAML file: ${error.message}`);
  }
};

// Check if command line arguments are provided
if (process.argv.length < 4) {
  console.error('Usage: node searchPackages.mjs <directory> <outputFilename>');
} else {
  const directory = process.argv[2];
  const outputFilename = process.argv[3];

  searchPackages(directory, outputFilename);
}
