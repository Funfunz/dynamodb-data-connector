import Debug from 'debug'
import { Funfunz } from '@funfunz/core'
import { DynamoDB } from 'aws-sdk'
import type { ICreateArgs, IQueryArgs, IRemoveArgs, IUpdateArgs, DataConnector, IDataConnector } from '@funfunz/core/lib/types/connector'
import type { FilterValues, IFilter, OperatorsType } from '@funfunz/core/lib/middleware/utils/filter'

const debug = Debug('funfunz:DynamoDBDataConnector')

debug('Hello')

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
  
  constructor(connector: IDataConnector, funfunz: Funfunz) {
    this.funfunz = funfunz
    
    this.connection = new DynamoDB.DocumentClient()
  }

  public query(args: IQueryArgs): Promise<Record<string, unknown>[] | number> {
    const filterExpressions = args.filter ? this.buildScanExpressions(args.filter) : {
      filterExpression: undefined,
      expressionAttributeValues: undefined
    }

    const params: DynamoDB.DocumentClient.ScanInput = {
      TableName : args.entityName,
      ProjectionExpression: args.fields.join(', '),
      ExpressionAttributeValues: filterExpressions.expressionAttributeValues,
      FilterExpression: filterExpressions.filterExpression
    }
    
    if (args.skip || args.take) {
      params.Limit = args.take
    }

    return new Promise(
      (res, rej) => {
        this.connection.scan(
          params,
          (err, data) => {
            if (err) {
              return rej(err)
            }
            if (args.count) {
              return res(data.Count)
            }
            res(data.Items)
          }
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

  private buildScanExpressions(
    filters: IFilter,
    unionOperator = 'AND',
    parentIndex = 0,
  ): {
    filterExpression: string,
    expressionAttributeValues: Record<string, unknown>
  } {
    const filterExpression: string[] = []
    let expressionAttributeValues: Record<string, unknown> = {}
    Object.keys(filters).forEach(
      (key, index) => {
        if (key === '_and' || key === '_or') {
          
          const innerFilters = (filters[key] as IFilter['_and'] | IFilter['_or']) || []
  
          innerFilters.forEach(
            (innerfilter, innerIndex) => {
              const innerGetExpression = this.buildScanExpressions(innerfilter, key === '_and' ? 'AND' : 'OR', innerIndex + index + parentIndex)
              filterExpression.push(`(${innerGetExpression.filterExpression})`)
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
            
            filterExpression.push(`(${key} IN (${inValues.join(', ')}))`)
            break
          }
          case '_is_null':
            expressionAttributeValues[':null'] = null
            filterExpression.push(`(${key} = :null)`)
            break
          default:
            expressionAttributeValues[valueId] = value
            filterExpression.push(`(${key} ${this.operatorMatcher[OPERATOR]} ${valueId})`)
            break
          }
        }
      }
    )
    return {
      filterExpression: filterExpression.join(` ${unionOperator} `),
      expressionAttributeValues
    }
  }
}