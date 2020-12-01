import Debug from 'debug'
import { Funfunz } from '@funfunz/core'
import { DynamoDB } from 'aws-sdk'
import type { ICreateArgs, IQueryArgs, IRemoveArgs, IUpdateArgs, DataConnector, IDataConnector } from '@funfunz/core/lib/types/connector'
import type { FilterValues, IFilter, OperatorsType } from '@funfunz/core/lib/middleware/utils/filter'
import type { ExpressionAttributeNameMap } from 'aws-sdk/clients/dynamodb'
import { getPKs } from './helpers'

const debug = Debug('funfunz:DynamoDBDataConnector')
debug('Hello')

export type DynamoConfig = {
  region: string
}

export class Connector implements DataConnector{
  public connection: DynamoDB.DocumentClient
  private config: DynamoConfig
  private funfunz: Funfunz
  private operatorMatcher = {
    _eq: '=',
    _neq: '<>',
    _lt: '<',
    _lte: '<=',
    _gt: '>',
    _gte: '>=',
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
  
  constructor(connector: IDataConnector<DynamoConfig>, funfunz: Funfunz) {
    this.funfunz = funfunz

    this.config = connector.config

    debug(this.config)
    this.connection = new DynamoDB.DocumentClient(this.config)
  }

  public async query(args: IQueryArgs): Promise<Record<string, unknown>[] | number> {
    const pks = getPKs(args.entityName, this.funfunz.config().settings)

    const {
      ExpressionAttributeNames,
      ProjectionExpression
    } = this.buildFieldsAttributes(args.fields)
    
    const params: DynamoDB.DocumentClient.ScanInput | DynamoDB.DocumentClient.QueryInput = {
      TableName : args.entityName,
      ExpressionAttributeNames,
      ProjectionExpression: ProjectionExpression.join(', '),
    }

    let isQuery = false

    if (args.filter) {
      isQuery = this.isQuery(pks, args.filter)
      const filterExpressions = this.buildFilterExpressions(args.filter)
      params.ExpressionAttributeNames = {
        ...params.ExpressionAttributeNames,
        ...filterExpressions.expressionAttributeNameMap,
      }
      params.ExpressionAttributeValues = filterExpressions.expressionAttributeValues
      
      if (isQuery) {
        (params as DynamoDB.DocumentClient.QueryInput).KeyConditionExpression = filterExpressions.filterExpression
      } else {
        params.FilterExpression = filterExpressions.filterExpression
      }
    } 

    if (args.skip && pks) {
      params.ExclusiveStartKey = await this.skipEntries(params, args.skip, pks, isQuery)
    }

    const data = await this.takeEntriesRequest(params, args.take || 0, isQuery, [])
    
    if ((args as ICreateArgs | IQueryArgs | IUpdateArgs).count) {
      return data.length
    }
    return data
  }

  public async update(args: IUpdateArgs): Promise<Record<string, unknown>[] | number> {
    const pks = getPKs(args.entityName, this.funfunz.config().settings) || []
    const queryArgs: IQueryArgs = {
      entityName: args.entityName,
      count: false,
      fields: pks,
      filter: args.filter,
      skip: args.skip,
      take: args.take,
    }
    const foundItems = await this.query(queryArgs) as Record<string, unknown>[]
    const updatePromises = foundItems.map(
      (item) => {
        const Key: DynamoDB.DocumentClient.Key = {}

        pks.forEach(
          (pk) => {
            Key[pk] = item[pk]
          }
        )

        const UpdateExpression: string[] = []
        const ExpressionAttributeNames: DynamoDB.DocumentClient.ExpressionAttributeNameMap = {}
        const ExpressionAttributeValues: DynamoDB.DocumentClient.ExpressionAttributeValueMap = {}

        Object.entries(args.data).forEach(
          ([key, value]) => {
            ExpressionAttributeNames[`#${key}`] = key
            ExpressionAttributeValues[`:${key}`] = value
            UpdateExpression.push(`#${key} = :${key}`)
          }, {})

        const params: DynamoDB.DocumentClient.UpdateItemInput = {
          TableName: args.entityName,
          ReturnValues: 'ALL_NEW',
          Key,
          UpdateExpression: `set ${UpdateExpression.join(', ')}`,
          ExpressionAttributeNames,
          ExpressionAttributeValues
        }
        return new Promise<DynamoDB.DocumentClient.AttributeMap>(
          (res, rej) => {
            this.connection.update(
              params,
              (err, data) => {
                if (err) {
                  return rej(err)
                }
                res(data.Attributes as DynamoDB.DocumentClient.AttributeMap)
              }
            )
          }
        )
      }
    )
    return Promise.all(updatePromises).then(
      (results) => {
        if (args.count) {
          return results.length
        }
        return results
      }
    )
  }

  public create(args: ICreateArgs): Promise<Record<string, unknown>[] | Record<string, unknown> | number> {
    const params: DynamoDB.DocumentClient.PutItemInput = {
      TableName: args.entityName,
      Item: args.data
    }
    
    return new Promise(
      (res, rej) => {
        this.connection.put(
          params,
          (err) => {
            if (err) {
              return rej(err)
            }
            res(args.data)
          }
        )
      }
    )
  }

  public remove(args: IRemoveArgs): Promise<number> {
    const deletePromise = (params: DynamoDB.DocumentClient.DeleteItemInput): Promise<DynamoDB.DocumentClient.DeleteItemOutput> => {
      return new Promise(
        (res, rej) => {
          this.connection.delete(
            params,
            (err, data) => {
              if (err) {
                return rej(err)
              }
              res(data)
            }
          )
        }
      )
    }
    const pks = getPKs(args.entityName, this.funfunz.config().settings)
    if (!pks) {
      return Promise.resolve(0)
    }
    const queryArgs: IQueryArgs = {
      ...args,
      fields: pks
    }
    return this.query(queryArgs).then(
      (data) => {
        const itemsToDelete: DynamoDB.DocumentClient.DeleteItemInput['Key'][] = []

        ;(data as Record<string, unknown>[]).forEach(
          (entry) => {
            const itemToDelete = {}
            pks.forEach(
              (pk) => {
                itemToDelete[pk] = entry[pk]
              }
            )
            const params: DynamoDB.DocumentClient.DeleteItemInput = {
              TableName : args.entityName,
              Key: itemToDelete
            }
            itemsToDelete.push(deletePromise(params))
          }
        )
        return Promise.all(itemsToDelete)
      }
    ).then(
      (deleted) => {
        return deleted.length
      }
    )
  }

  private takeEntriesRequest(
    params: DynamoDB.DocumentClient.ScanInput | DynamoDB.DocumentClient.QueryInput,
    take: number,
    isQuery: boolean,
    taken: DynamoDB.DocumentClient.ItemList = []
  ): Promise<DynamoDB.DocumentClient.ItemList> {
    const newParams = {
      ...params,
    }

    if (take !== 0) {
      newParams.Limit = 1000
    }

    return this.requestQueryOrScan(params, isQuery).then(
      (data) => {
        if (take === 0) {
          return data.Items || []
        }
        
        if (data.Items) {
          taken = [
            ...taken,
            ...data.Items.slice(0, take - taken.length)
          ]
        }

        if (taken.length >= take) {
          return taken
        }

        if (data.LastEvaluatedKey) {
          return this.takeEntriesRequest(params, take, isQuery, taken)
        }
        
        return taken
      }
    )
  }

  private skipEntriesRequest(
    params: DynamoDB.DocumentClient.ScanInput | DynamoDB.DocumentClient.QueryInput,
    skipTo: number,
    pks: string[],
    isQuery: boolean,
    skipped: number
  ): Promise<DynamoDB.DocumentClient.Key | undefined> {
    return this.requestQueryOrScan(params, isQuery).then(
      (data) => {
        if (!data.Items) {
          return
        }
        const ExclusiveStartKey: DynamoDB.DocumentClient.Key = {}
        const allSkipped = data.Items.some(
          (item) => {
            skipped += 1
            if (skipped >= skipTo) {
              pks.forEach(
                (pk) => {
                  ExclusiveStartKey[pk] = item[pk]
                }
              )
              return true
            }
          }
        )
        return allSkipped
          ? ExclusiveStartKey
          : this.skipEntriesRequest(params, skipTo, pks, isQuery, skipped)
      }
    )
  }

  private skipEntries(
    params: DynamoDB.DocumentClient.ScanInput | DynamoDB.DocumentClient.QueryInput,
    skipTo: number,
    pks: string[],
    isQuery: boolean
  ): Promise<DynamoDB.DocumentClient.Key | undefined> {
    const newFields = this.buildFieldsAttributes(pks)
    const newParams = {
      ...params,
      ExpressionAttributeNames: {
        ...params.ExpressionAttributeNames,
        ...newFields.ExpressionAttributeNames
      },
      ProjectionExpression: newFields.ProjectionExpression.join(', '),
      Limit: 1000
    }
    return this.skipEntriesRequest(newParams, skipTo, pks, isQuery, 0)
  }

  private requestQueryOrScan(
    params: DynamoDB.DocumentClient.ScanInput | DynamoDB.DocumentClient.QueryInput,
    isQuery: boolean
  ) {
    return new Promise<DynamoDB.DocumentClient.ScanOutput | DynamoDB.DocumentClient.QueryOutput>(
      (res, rej) => {
        if (isQuery) {
          this.connection.query(
            params,
            (err, data) => {
              if (err) {
                return rej(err)
              }
              res(data)
            }
          )
        } else {
          this.connection.scan(
            params,
            (err, data) => {
              if (err) {
                return rej(err)
              }
              res(data)
            }
          )
        }
      }
    )
  }

  private buildFieldsAttributes(fields: string[]): {
    ExpressionAttributeNames: ExpressionAttributeNameMap
    ProjectionExpression: string[]
  } {
    const ExpressionAttributeNames: ExpressionAttributeNameMap = {}
    const ProjectionExpression: string[] = []
    fields.forEach(
      (field) => {
        const newFieldId = `#${field}`
        ExpressionAttributeNames[newFieldId] = field
        ProjectionExpression.push(newFieldId)
      }
    )
    return {
      ExpressionAttributeNames,
      ProjectionExpression
    }
  }

  private isQuery(pks: string[] | undefined, filters: IFilter): boolean {
    return !pks || !Object.keys(filters).some(
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

  private buildFilterExpressions(
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
              const innerGetExpression = this.buildFilterExpressions(innerfilter, key === '_and' ? 'AND' : 'OR', innerIndex + index + parentIndex)
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