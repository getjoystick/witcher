# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.1] - 2023-08-21

### Changed

- Minor removal of unnecessary code

## [0.3.0] - 2023-08-21

### Added

- Keywords, repository and homepage in `package.json`
- Demo configurations as an example of how to use `witcher`

### Changed

- README with TLDR section and summary about the project
- License updated to `MIT`

## [0.2.0] - 2023-08-18

### Added

- Param `waitForMs` to test unit configuration (will wait for given amount of time before running the test)
- Test web server for E2E verification of `witcher`
- E2E test for eventual-consistent APIs
- Verification pipeline step for E2E tests

### Changed

- Structure of testing configuration files
- README to reflect changes in the project

## [0.1.0] - 2023-08-14

### Added

- Interactive mode to visually select configuration for the test
- Non-interactive mode to run the application in CI environment
- Joystick as a data-source for testing configurations and devs collaboration
- Structure of configurations files
- Dedicated files structure to store secrets needed for tests (e.g. database credentials)
- Variables shared between test steps
- Assertions based on responses and changes in the database
