# Funfunz S3 Data Connector

[![Discord][discord-badge]][discord]
[![Build Status][actions-badge]][actions]
[![codecov][codecov-badge]][codecov]
![node][node]
[![npm version][npm-badge]][npm]
[![PRs Welcome][prs-badge]][prs]
[![GitHub][license-badge]][license]

This connector can be used to connect to any DynamoDB table

At the moment, the connector is using the local machine AWS credentials

## Usage

**Dynamo config**

```js
{
  connectors: {
    [key: string]: { // user defined name for the connector
      type: '@funfunz/dynamodb-data-connector',
      config: {}
    }
    ...
  }
}
```

## Entity structure

Refer to [@Funfunz/core](https://funfunz.github.io/funfunz/#/configuration/settings) docs

[discord-badge]: https://img.shields.io/discord/774439225520554004?logo=discord
[discord]: https://discord.gg/HwZ7zMJKwg

[actions-badge]: https://github.com/funfunz/dynamodb-data-connector/workflows/Node.js%20CI/badge.svg
[actions]: https://github.com/Funfunz/dynamodb-data-connector/actions

[codecov-badge]: https://codecov.io/gh/Funfunz/dynamodb-data-connector/branch/master/graph/badge.svg
[codecov]: https://codecov.io/gh/Funfunz/dynamodb-data-connector

[node]: https://img.shields.io/node/v/@funfunz/dynamodb-data-connector

[npm-badge]: https://img.shields.io/npm/v/@funfunz/dynamodb-data-connector?color=brightgreen
[npm]: https://www.npmjs.com/package/@funfunz/dynamodb-data-connector

[prs-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg
[prs]: http://makeapullrequest.com

[license-badge]: https://img.shields.io/github/license/JWebCoder/funfunz.svg
[license]: https://github.com/JWebCoder/funfunz/blob/master/LICENSE