import { Connector } from '../index'
import config from './configs/MCconfig'
import settings from './configs/MCsettings'
import { Funfunz, IFunfunzConfig } from '@funfunz/core'

jest.mock('@funfunz/core', () => {
  return {
    Funfunz: function ({config: configData, settings: settingsData}) {
      return {
        config: () => {
          console.log(configData, settingsData)
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

let familyTestName = 'TestFamily'
let familyUpdatedTestName = 'UpdatedTestFamily'
let createdId: number

describe('DynamoDB Data Connector', () => {
  it('Should return a list of results', (done) => {
    const fields  = [
      'id',
      'Image'
    ]
    return connector.query({
      entityName: 'jaegerTable',
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
        return done()
      }
    )
  })

  it('Should return a list of results _eq filter', (done) => {
    const fields  = [
      'id',
      'Image'
    ]
    return connector.query({
      entityName: 'jaegerTable',
      fields,
      filter: {
        id: {
          _eq: 3
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
            return fields.includes(key)
          }
        ).length).toBe(fields.length)
        return done()
      }
    )
  })

  it('Should return a list of results _in filter', (done) => {
    const fields  = [
      'id',
      'Image'
    ]
    return connector.query({
      entityName: 'jaegerTable',
      fields,
      filter: {
        id: {
          _in: [3, 7]
        }
      },
    }).then(
      (result) => {
        const typedResult = result as Record<string, unknown>[]
        console.log(typedResult)
        expect(typedResult.length).toBe(2)
        expect(Object.keys(typedResult[0]).filter(
          key => {
            return fields.includes(key)
          }
        ).length).toBe(fields.length)
        return done()
      }
    )
  })
})
