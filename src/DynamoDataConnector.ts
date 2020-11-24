import Debug from 'debug'
import { Funfunz } from '@funfunz/core'
import { DynamoDB } from 'aws-sdk'
import type { ICreateArgs, IQueryArgs, IRemoveArgs, IUpdateArgs, DataConnector, IDataConnector } from '@funfunz/core/lib/types/connector'
import type { FilterValues, IFilter, OperatorsType } from '@funfunz/core/lib/middleware/utils/filter'
import type { ExpressionAttributeNameMap } from 'aws-sdk/clients/dynamodb'
import type { IEntityInfo, ISettings } from '@funfunz/core/lib/generator/configurationTypes'

const debug = Debug('funfunz:DynamoDBDataConnector')

debug('Hello')

function getPKs(TABLE_CONFIG: IEntityInfo) {
  return TABLE_CONFIG.properties.filter(
    (entity) => entity.model.isPk
  ).map(
    (property) => property.name
  )
}

function getTableConfig(entity: string, settings: ISettings) {
  return settings.filter(
    (tableItem) => tableItem.name === entity
  )[0]
}

export class Connector implements DataConnector{
  public connection: DynamoDB.DocumentClient
  private funfunz: Funfunz
  private operatorMatcher = {
    _eq: '=',
    _neq: '<>',
    _lt: '<',
    _lte: '<=',
    _gt: '>',
    _gte: '>=',
    _in: 'IN',
    _like: 'contains',    
  }
  private allowedQueryOperators = [
    '_eq',
    '_neq',
    '_lt',
    '_lte',
    '_gt',
    '_gte'
  ]
  
  constructor(connector: IDataConnector, funfunz: Funfunz) {
    this.funfunz = funfunz
    this.connection = new DynamoDB.DocumentClient()
  }

  public query(args: IQueryArgs): Promise<Record<string, unknown>[] | number> {
    
    const tableConfig = getTableConfig(args.entityName, this.funfunz.config().settings)
    const pks = getPKs(tableConfig)

    const ExpressionAttributeNames: ExpressionAttributeNameMap = {}
    const ProjectionExpression: string[] = []
    args.fields.forEach(
      (field) => {
        const newFieldId = `#${field}`
        ExpressionAttributeNames[newFieldId] = field
        ProjectionExpression.push(newFieldId)
      }
    )

    let isQuery = false

    let filterExpressions: {
      filterExpression?: string,
      expressionAttributeValues?: DynamoDB.DocumentClient.ExpressionAttributeValueMap,
      expressionAttributeNames?: DynamoDB.DocumentClient.ExpressionAttributeNameMap,
    } = {
      filterExpression: undefined,
      expressionAttributeValues: undefined,
      expressionAttributeNames: undefined
    }

    if (args.filter) {
      isQuery = this.isQuery(pks, args.filter)
      filterExpressions = this.buildScanExpressions(args.filter)
    }

    const params: DynamoDB.DocumentClient.ScanInput | DynamoDB.DocumentClient.QueryInput = {
      TableName : args.entityName,
      ExpressionAttributeNames: {
        ...ExpressionAttributeNames,
        ...filterExpressions.expressionAttributeNames,
      },
      ProjectionExpression: ProjectionExpression.join(', '),
      ExpressionAttributeValues: filterExpressions.expressionAttributeValues,
    }

    if (isQuery) {
      (params as DynamoDB.DocumentClient.QueryInput).KeyConditionExpression = filterExpressions.filterExpression
    } else {
      params.FilterExpression = filterExpressions.filterExpression
    }
    
    
    if (args.skip || args.take) {
      params.Limit = args.take
    }

    return new Promise(
      (res, rej) => {
        const result = (err, data) => {
          if (err) {
            return rej(err)
          }
          if (args.count) {
            return res(data.Count)
          }
          res(data.Items)
        }
        if (isQuery) {
          return this.connection.query(
            params,
            result
          )
        }
        this.connection.scan(
          params,
          result
        )
      }
    )
  }

  public update(args: IUpdateArgs): Promise<Record<string, unknown>[] | number> {
    console.log(args)
    return Promise.resolve(0)
  }

  public create(args: ICreateArgs): Promise<Record<string, unknown>[] | Record<string, unknown> | number> {
    console.log(args)
    return Promise.resolve(0)
  }

  public remove(args: IRemoveArgs): Promise<number> {
    console.log(args)
    return Promise.resolve(0)
  }

  private isQuery(pks: string[], filters: IFilter) {
    return !Object.keys(filters).some(
      (key) => {
        if (key === '_and' || key === '_or') {
          
          const innerFilters = (filters[key] as IFilter['_and'] | IFilter['_or']) || []
  
          return innerFilters.some(
            (innerFilter) => {
              return this.isQuery(pks, innerFilter)
            }
          )
        } else if (key === '_exists') {
          console.log('exists')
        } else {
          return pks.indexOf(key) === -1 || this.allowedQueryOperators.indexOf(Object.keys(filters[key] as Record<OperatorsType, FilterValues>)[0]) === -1
        }
      }
    ) || false
    
  }

  private buildScanExpressions(
    filters: IFilter,
    unionOperator = 'AND',
    parentIndex = 0,
  ): {
    filterExpression: string,
    expressionAttributeValues: DynamoDB.DocumentClient.ExpressionAttributeValueMap,
    expressionAttributeNameMap: DynamoDB.DocumentClient.ExpressionAttributeNameMap,
  } {
    const filterExpression: string[] = []
    let expressionAttributeNameMap: DynamoDB.DocumentClient.ExpressionAttributeNameMap = {}
    let expressionAttributeValues: DynamoDB.DocumentClient.ExpressionAttributeValueMap = {}
    Object.keys(filters).forEach(
      (key, index) => {
        if (key === '_and' || key === '_or') {
          
          const innerFilters = (filters[key] as IFilter['_and'] | IFilter['_or']) || []
  
          innerFilters.forEach(
            (innerfilter, innerIndex) => {
              const innerGetExpression = this.buildScanExpressions(innerfilter, key === '_and' ? 'AND' : 'OR', innerIndex + index + parentIndex)
              filterExpression.push(`(${innerGetExpression.filterExpression})`)
              expressionAttributeNameMap = {
                ...expressionAttributeNameMap,
                ...innerGetExpression.expressionAttributeNameMap
              }
              expressionAttributeValues = {
                ...expressionAttributeValues,
                ...innerGetExpression.expressionAttributeValues
              }
            }
          )
        } else if (key === '_exists') {
          console.log('exists')
        } else {
          const OPERATOR: OperatorsType = Object.keys(filters[key] as Record<OperatorsType, FilterValues>)[0] as OperatorsType
          const valueId = `:${key}_${index + parentIndex}`
          const attributeName = `#${key}`
          expressionAttributeNameMap[attributeName] = key
          const value = (filters[key] as Record<OperatorsType, FilterValues>)[OPERATOR]
          switch (OPERATOR) {
          case '_nin' || '_nlike':
            console.log(OPERATOR)// TODO
            break
          case '_in': {
            const inValues = (value as string[]).map(
              (inValue, index) => {
                const newId = `${valueId}_${index}`
                expressionAttributeValues[`${newId}`] = inValue
                return newId
              }
            )
            
            filterExpression.push(`(${attributeName} IN (${inValues.join(', ')}))`)
            break
          }
          case '_is_null':
            expressionAttributeValues[':null'] = null
            filterExpression.push(`(${attributeName} = :null)`)
            break
          default:
            expressionAttributeValues[valueId] = value
            filterExpression.push(`(${attributeName} ${this.operatorMatcher[OPERATOR]} ${valueId})`)
            break
          }
        }
      }
    )
    return {
      filterExpression: filterExpression.join(` ${unionOperator} `),
      expressionAttributeValues,
      expressionAttributeNameMap,
    }
  }
}