# 📦 upy-package

`upy-package` is a command-line tool designed to simplify the installation of MicroPython packages on Arduino boards. It connects to the [Arduino MicroPython package index](https://github.com/arduino/package-index-py/).

## ✨ Features

- Searches multiple package indices
- Installs to connected Arduino board automatically
    - If multiple boards are connected, it will ask you to select a board.

## 💻 Usage

```bash
upy-package [options] [command]
```

### Options
- `-V`, `--version`: Outputs the version number of the tool.
- `-h`, `--help`: Displays help information for the tool.

### Commands
- `list`: Lists packages available from registries.
- `info <package>`: Retrieves detailed information about a specific package.
- `find <pattern>`: Searches for packages using the supplied pattern.
- `install [options] <package-names...>`: Installs MicroPython packages onto a connected Arduino board. When installing multiple packages, they should be separated by a space. It supports installing packages by name or URL. In the latter case you can specify the version using an @version suffix (e.g. github:arduino/arduino-iot-cloud-py@v1.3.3).
    - `--debug`: Enable debug output
- `help [command]`: Displays help information for a specific command.

## ⚙️ Installation

`npm install -g upy-package`

## 🐛 Reporting Issues
If you encounter any issue, please open a bug report [here](https://github.com/sebromero/upy-package/issues).

## 💪 Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## 🤙 Contact
For questions, comments, or feedback on this package, please create an issue on this repository.