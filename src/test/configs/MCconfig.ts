const config = {
  connectors: {
    mainDatabase: {
      type: "@funfunz/dynamodb-data-connector",
      config: {
        region: "eu-west-1"
      }
    }
  }
}
export default config