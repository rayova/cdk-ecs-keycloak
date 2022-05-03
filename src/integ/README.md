# Integration Test Directory

We include these in the src bundle to work around a limitation in Projen's
default config for importing from these files.

Deploy any of the integration tests in this directory by typing:

`yarn cdk --app "ts-node -P tsconfig.dev.json src/integ/test-name-here" deploy`
