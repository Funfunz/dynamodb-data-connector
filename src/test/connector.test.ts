import { Connector } from '../index'
import config from './configs/MCconfig'
import settings from './configs/MCsettings'
import { Funfunz, IFunfunzConfig } from '@funfunz/core'

jest.mock('@funfunz/core', () => {
  return {
    Funfunz: function ({config: configData, settings: settingsData}) {
      return {
        config: () => {
          return {
            config: configData,
            settings: settingsData
          }
        }
      }
    }
  }
})

const connector = new Connector(
  {
    type: 'dynamodb',
    config
  },
  new Funfunz({
    config,
    settings
  } as IFunfunzConfig)
)

let ids: string[] = []
const userFields  = [
  'userId',
  'name',
  'createdAt',
  'updatedAt',
]
let familyUpdatedTestName = 'UpdatedTestFamily'
let createdId: number

describe('DynamoDB Data Connector', () => {
  it('Should return a list of results', (done) => {
    const fields  = [
      'userId',
      'name',
      'createdAt',
      'updatedAt',
    ]
    return connector.query({
      entityName: 'funfunzUsers',
      fields,
      skip: 0,
      take: 2,
    }).then(
      (result) => {
        const typedResult = result as Record<string, unknown>[]
        expect(typedResult.length).toBe(2)
        expect(Object.keys(typedResult[0]).filter(
          key => {
            return fields.includes(key)
          }
        ).length).toBe(fields.length)
        typedResult.forEach(
          (result) => {
            ids.push(result.userId as string)
          }
        )
        return done()
      }
    )
  })

  it('Should return a list of results _eq filter', (done) => {
    return connector.query({
      entityName: 'funfunzUsers',
      fields: userFields,
      filter: {
        userId: {
          _eq: ids[0]
        }
      },
      skip: 0,
      take: 2,
    }).then(
      (result) => {
        const typedResult = result as Record<string, unknown>[]
        expect(typedResult.length).toBe(1)
        expect(Object.keys(typedResult[0]).filter(
          key => {
            return userFields.includes(key)
          }
        ).length).toBe(userFields.length)
        return done()
      }
    )
  })

  it('Should return a list of results _in filter', (done) => {
    return connector.query({
      entityName: 'funfunzUsers',
      fields: userFields,
      filter: {
        userId: {
          _in: [...ids]
        }
      },
    }).then(
      (result) => {
        const typedResult = result as Record<string, unknown>[]
        expect(typedResult.length).toBe(2)
        expect(Object.keys(typedResult[0]).filter(
          key => {
            return userFields.includes(key)
          }
        ).length).toBe(userFields.length)
        return done()
      }
    )
  })

  it('Should return a list of results using a full table scan', (done) => {
    return connector.query({
      entityName: 'funfunzUsers',
      fields: userFields,
      filter: {
        name: {
          _eq: 'jejay'
        }
      },
    }).then(
      (result) => {
        const typedResult = result as Record<string, unknown>[]
        expect(typedResult.length).toBe(1)
        expect(Object.keys(typedResult[0]).filter(
          key => {
            return userFields.includes(key)
          }
        ).length).toBe(userFields.length)
        return done()
      }
    )
  })

  it('Should delete an item by primary key', (done) => {
    return connector.remove({
      entityName: 'funfunzUsers',
      filter: {
        userId: {
          _eq: '77554e6e-cc19-4d04-87af-1efb266e55cd'
        }
      },
    }).then(
      (result) => {
        expect(result).toBe(1)
        return done()
      }
    )
  })

  it('Should return 0 if item is not found', (done) => {
    return connector.remove({
      entityName: 'funfunzUsers',
      filter: {
        name: {
          _eq: 'somethingThatDoesn\'tExist'
        }
      },
    }).then(
      (result) => {
        expect(result).toBe(0)
        return done()
      }
    )
  })

  it('Should delete all items that match a filter', (done) => {
    return connector.remove({
      entityName: 'funfunzUsers',
      filter: {
        name: {
          _eq: 'test'
        }
      },
    }).then(
      (result) => {
        expect(result).toBe(0)
        return done()
      }
    )
  })
})
